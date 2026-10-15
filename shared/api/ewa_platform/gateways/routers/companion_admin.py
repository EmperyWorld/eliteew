# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# EWA companion admin HTTP API: tool catalog + action workflow definitions (WF-5 read, WF-6 write)
# + platform settings CRUD (Postgres-backed EWA_* flags).
# Invariants:
# - Requires product admin JWT; ``EWA_COMPANION_ADMIN_ENABLED`` from DB or **503**.
# - Mutating routes require ``EWA_COMPANION_ADMIN_WRITE=1`` and PG pool.
# Related:
# - api/ewa_platform/gateways/companion_http.py
# - documentation/product/ewa/EWA-COMPANION-WORKFLOW-TOOLS-STANDARD-MASTER-PLAN.md §7.2
# ---

from __future__ import annotations

import logging
from typing import Any, Literal, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, status  # type: ignore[import-untyped]

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.ewa_platform.companion import admin_users as admin_users_svc
from api.ewa_platform.companion.observability.degrade_log import companion_degrade_debug
from api.ewa_platform.companion.orchestration.tool_catalog_v2 import export_tool_catalog
from api.ewa_platform.companion.prompt_blocks import service as prompt_blocks_svc
from api.ewa_platform.companion.prompt_blocks.canon import PROMPT_BLOCK_CANON
from api.ewa_platform.companion.services import workflow_catalog
from api.ewa_platform.companion.sidecar.tool_router import (
    companion_tool_router_base_url,
    companion_tool_router_enabled,
    companion_tool_router_mode,
    companion_tool_router_model,
)
from api.ewa_platform.companion.workflows.action.registry import (
    effective_workflow_enabled,
    get_builtin_workflow,
)
from api.ewa_platform.companion.workflows.action.schema import CompanionWorkflowDefinitionV1
from api.ewa_platform.companion.workflows.config import (
    companion_admin_enabled,
    companion_admin_write_enabled,
    companion_workflow_pg_catalog_enabled,
)
from api.ewa_platform.gateways.ewa_service_unavailable import ewa_pool_unavailable_exception
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg
from api.ewa_platform.persistence_pg import companion_workflow_catalog_asyncpg as catalog_pg
from api.ewa_platform.persistence_pg import platform_settings_asyncpg as settings_pg
from api.ewa_platform.persistence_pg import prompt_blocks_asyncpg as prompt_blocks_pg
from api.ewa_platform.schemas.pydantic.companion_admin import (
    CompanionAdminStatusOut,
    CompanionAdminUserAuditNoteRequestV1,
    CompanionAdminUserClearNamespaceRequestV1,
    CompanionAdminUserDetailOut,
    CompanionAdminUserListOut,
    CompanionAdminUserPatchRequestV1,
    CompanionAdminUserSummaryOut,
    CompanionAdminUserTimelineOut,
    CompanionAdminUserTranscriptOut,
    CompanionAdminUserWipeOut,
    CompanionAdminUserWipeRequestV1,
    CompanionChatWorkflowListOut,
    CompanionChatWorkflowSummaryOut,
    CompanionPlatformSettingAuditEntryOut,
    CompanionPlatformSettingAuditListOut,
    CompanionPlatformSettingOut,
    CompanionPlatformSettingsListOut,
    CompanionPlatformSettingUpdateRequestV1,
    CompanionPromptBlockAuditEntryOut,
    CompanionPromptBlockAuditListOut,
    CompanionPromptBlockListOut,
    CompanionPromptBlockOut,
    CompanionPromptBlockUpdateRequestV1,
    CompanionToolCatalogOut,
    CompanionWorkflowAuditEntryOut,
    CompanionWorkflowAuditListOut,
    CompanionWorkflowCreateRequestV1,
    CompanionWorkflowDetailOut,
    CompanionWorkflowEnableRequestV1,
    CompanionWorkflowListOut,
    CompanionWorkflowSummaryOut,
)
from api.ewa_platform.schemas.pydantic.companion_chat import (
    CompanionTaskRunOut,
    CompanionTaskRunsOut,
)
from api.ewa_platform.schemas.pydantic.companion_tool_catalog import (
    CompanionToolCatalogEntryOut,
    CompanionToolRouterRuntimeOut,
)
from api.ewa_platform.schemas.pydantic.companion_workflow import (
    CompanionWorkflowValidateRequestV1,
    CompanionWorkflowValidateResponseV1,
)
from api.ewa_platform.settings.catalog import CATALOG
from api.ewa_platform.settings.service import update_setting_and_reload, validate_setting_value

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/companion", tags=["ewa-companion-admin"])

_CHAT_WORKFLOW_CATALOG: tuple[CompanionChatWorkflowSummaryOut, ...] = (
    CompanionChatWorkflowSummaryOut(
        workflow_id="reflect_week",
        title_ru="Итоги недели",
        title_en="Weekly reflection",
        description_ru="LLM-only chat workflow: подведи итоги недели",
        description_en="LLM-only chat workflow triggered by weekly review phrases",
    ),
    CompanionChatWorkflowSummaryOut(
        workflow_id="plan_month",
        title_ru="План на месяц",
        title_en="Monthly plan",
        description_ru="Зарезервировано (chat workflow, не action engine)",
        description_en="Reserved chat workflow identifier",
    ),
    CompanionChatWorkflowSummaryOut(
        workflow_id="file_focus",
        title_ru="Фокус на файле",
        title_en="File focus",
        description_ru="Зарезервировано (chat workflow, не action engine)",
        description_en="Reserved chat workflow identifier",
    ),
)


def _require_companion_admin_feature() -> None:
    if not companion_admin_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ewa_companion_admin_disabled",
        )


def _require_companion_admin_write() -> None:
    _require_companion_admin_feature()
    if not companion_admin_write_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ewa_companion_admin_write_disabled",
        )


async def require_companion_admin_user(user: User = Depends(require_oauth2_user)) -> User:  # noqa: B008
    if user.role not in ("admin", "emperyworld_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator privileges required",
        )
    return user


def _pool_from_request(request: Request) -> asyncpg.Pool | None:
    return getattr(request.app.state, "ewa_orchestration_pool", None)


def _require_pg_pool(request: Request) -> asyncpg.Pool:
    pool = _pool_from_request(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    return pool


def _workflow_summary(
    definition: CompanionWorkflowDefinitionV1,
    *,
    source: str,
    effective: bool,
    catalog_enabled: bool | None = None,
) -> CompanionWorkflowSummaryOut:
    return CompanionWorkflowSummaryOut(
        workflow_id=definition.workflow_id,
        version=definition.version,
        title_ru=definition.title_ru,
        title_en=definition.title_en,
        execution_mode=str(definition.execution_mode),
        enabled=bool(catalog_enabled if catalog_enabled is not None else definition.enabled),
        effective_enabled=effective,
        source="pg" if source == "pg" else "builtin",
        env_gate=definition.env_gate,
        tags=list(definition.tags),
        step_count=len(definition.steps),
    )


async def _list_merged_workflow_summaries(pool: asyncpg.Pool | None) -> list[CompanionWorkflowSummaryOut]:
    from api.ewa_platform.companion.workflows.action.registry import list_builtin_workflows

    by_id: dict[str, CompanionWorkflowSummaryOut] = {}
    for definition in list_builtin_workflows(include_disabled=True):
        by_id[definition.workflow_id] = _workflow_summary(
            definition,
            source="builtin",
            effective=effective_workflow_enabled(definition),
        )

    if pool is not None and companion_workflow_pg_catalog_enabled():
        pg_rows = await catalog_pg.workflow_catalog_list(pool)
        grouped: dict[str, list[dict]] = {}
        for row in pg_rows:
            wid = str(row.get("workflow_id") or "").strip()
            if not wid:
                continue
            grouped.setdefault(wid, []).append(row)
        for wid, rows in grouped.items():
            enabled_row = next((r for r in rows if r.get("enabled")), None)
            chosen = enabled_row or rows[0]
            raw = chosen.get("definition")
            if not isinstance(raw, dict):
                continue
            try:
                model = CompanionWorkflowDefinitionV1.model_validate(raw)
            except Exception as exc:  # noqa: BLE001
                companion_degrade_debug(
                    logger,
                    "admin_workflow_definition_row",
                    "skip invalid PG workflow definition in admin list",
                    exc=exc,
                    workflow_id=wid,
                )
                continue
            by_id[wid] = _workflow_summary(
                model,
                source="pg",
                effective=workflow_catalog.pg_workflow_effective_enabled(chosen),
                catalog_enabled=bool(chosen.get("enabled")),
            )

    summaries = list(by_id.values())
    summaries.sort(key=lambda row: row.workflow_id)
    return summaries


async def _get_merged_workflow_detail(
    pool: asyncpg.Pool | None,
    workflow_id: str,
    *,
    version: int | None = None,
) -> CompanionWorkflowDetailOut:
    wid = str(workflow_id or "").strip()
    if companion_workflow_pg_catalog_enabled() and pool is not None:
        if version is not None:
            row = await catalog_pg.workflow_catalog_get(pool, workflow_id=wid, version=int(version))
        else:
            row = await catalog_pg.workflow_catalog_get_enabled(pool, workflow_id=wid)
            if row is None:
                pg_rows = await catalog_pg.workflow_catalog_list(pool, workflow_id=wid)
                row = pg_rows[0] if pg_rows else None
        if row is not None:
            raw = row.get("definition")
            if isinstance(raw, dict):
                definition = CompanionWorkflowDefinitionV1.model_validate(raw)
                return CompanionWorkflowDetailOut(
                    definition=definition,
                    effective_enabled=workflow_catalog.pg_workflow_effective_enabled(row),
                    source="pg",
                    catalog_enabled=bool(row.get("enabled")),
                    pg_version=int(row.get("version") or definition.version),
                )
    definition = get_builtin_workflow(wid)
    if definition is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="companion_workflow_not_found")
    return CompanionWorkflowDetailOut(
        definition=definition,
        effective_enabled=effective_workflow_enabled(definition),
        source="builtin",
    )


async def _attach_task_run_steps(
    pool: asyncpg.Pool,
    run: dict[str, Any],
    *,
    include_steps: bool,
) -> dict[str, Any]:
    if not include_steps:
        return run
    out = dict(run)
    out["steps"] = await companion_pg.companion_task_steps_list(pool, run_id=str(run.get("id") or ""))
    return out


@router.get("/status", response_model=CompanionAdminStatusOut)
async def companion_admin_status(
    _admin: User = Depends(require_companion_admin_user),  # noqa: B008
) -> CompanionAdminStatusOut:
    """Feature flags for operator UI (does not require ``EWA_COMPANION_ADMIN_ENABLED``)."""

    return CompanionAdminStatusOut(
        admin_enabled=companion_admin_enabled(),
        admin_write_enabled=companion_admin_write_enabled(),
        pg_catalog_enabled=companion_workflow_pg_catalog_enabled(),
    )


@router.get("/tools", response_model=CompanionToolCatalogOut)
async def list_companion_tools(
    _admin: User = Depends(require_companion_admin_user),  # noqa: B008
) -> CompanionToolCatalogOut:
    """Export read-only companion tool catalog (``ToolDescriptorV2``)."""

    _require_companion_admin_feature()
    catalog = export_tool_catalog()
    base_url = str(companion_tool_router_base_url() or "").strip()
    mode = companion_tool_router_mode()
    if mode not in {"shadow", "partial", "full"}:
        mode = "shadow"
    mode_literal = cast(Literal["shadow", "partial", "full"], mode)
    runtime = CompanionToolRouterRuntimeOut(
        enabled=companion_tool_router_enabled(),
        mode=mode_literal,
        base_url=base_url,
        model=str(companion_tool_router_model() or "").strip(),
        uses_gpu141=("192.168.1.141" in base_url or "gpu141" in base_url.lower()),
    )
    return CompanionToolCatalogOut(
        tools=[CompanionToolCatalogEntryOut.model_validate(entry) for entry in catalog],
        tool_router_runtime=runtime,
    )


@router.get("/workflows", response_model=CompanionWorkflowListOut)
async def list_companion_workflows(
    request: Request,
    _admin: User = Depends(require_companion_admin_user),  # noqa: B008
) -> CompanionWorkflowListOut:
    """List action workflow definitions (builtin + PG catalog merge)."""

    _require_companion_admin_feature()
    pool = _pool_from_request(request)
    workflows = await _list_merged_workflow_summaries(pool)
    return CompanionWorkflowListOut(workflows=workflows)


@router.get("/workflows/{workflow_id}", response_model=CompanionWorkflowDetailOut)
async def get_companion_workflow(
    workflow_id: str,
    request: Request,
    version: int | None = None,
    _admin: User = Depends(require_companion_admin_user),  # noqa: B008
) -> CompanionWorkflowDetailOut:
    """Return one action workflow definition by stable ``workflow_id`` (optional PG ``version``)."""

    _require_companion_admin_feature()
    return await _get_merged_workflow_detail(_pool_from_request(request), workflow_id, version=version)


@router.post("/workflows/validate", response_model=CompanionWorkflowValidateResponseV1)
async def validate_companion_workflow(
    body: CompanionWorkflowValidateRequestV1,
    _admin: User = Depends(require_companion_admin_user),  # noqa: B008
) -> CompanionWorkflowValidateResponseV1:
    """Dry-run Pydantic + tool registry cross-check without persisting."""

    _require_companion_admin_feature()
    return workflow_catalog.validate_workflow_definition_raw(body.definition.model_dump(mode="json"))


@router.post("/workflows", response_model=CompanionWorkflowDetailOut)
async def create_companion_workflow_version(
    body: CompanionWorkflowCreateRequestV1,
    request: Request,
    admin: User = Depends(require_companion_admin_user),  # noqa: B008
) -> CompanionWorkflowDetailOut:
    """Create or update one PG catalog version (disabled until explicitly enabled)."""

    _require_companion_admin_write()
    if not companion_workflow_pg_catalog_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ewa_companion_wf_pg_catalog_disabled",
        )
    pool = _require_pg_pool(request)
    validation = workflow_catalog.validate_workflow_definition_raw(body.definition.model_dump(mode="json"))
    if not validation.ok:
        await catalog_pg.workflow_catalog_audit_fail(
            pool,
            workflow_id=validation.workflow_id or body.definition.workflow_id,
            version=validation.version or body.definition.version,
            actor_sub=admin.username or admin.email,
            errors=list(validation.errors),
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "companion_workflow_invalid", "errors": validation.errors},
        )
    row = await catalog_pg.workflow_catalog_insert(
        pool,
        workflow_id=body.definition.workflow_id,
        version=body.definition.version,
        definition=body.definition.model_dump(mode="json"),
        actor_sub=admin.username or admin.email,
    )
    return CompanionWorkflowDetailOut(
        definition=body.definition,
        effective_enabled=workflow_catalog.pg_workflow_effective_enabled(row),
        source="pg",
        catalog_enabled=bool(row.get("enabled")),
        pg_version=int(row.get("version") or body.definition.version),
    )


@router.put("/workflows/{workflow_id}/enable", response_model=CompanionWorkflowDetailOut)
async def enable_companion_workflow_version(
    workflow_id: str,
    body: CompanionWorkflowEnableRequestV1,
    request: Request,
    admin: User = Depends(require_companion_admin_user),  # noqa: B008
) -> CompanionWorkflowDetailOut:
    """Enable one catalog version (disables other versions for the same ``workflow_id``)."""

    _require_companion_admin_write()
    if not companion_workflow_pg_catalog_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ewa_companion_wf_pg_catalog_disabled",
        )
    pool = _require_pg_pool(request)
    row = await catalog_pg.workflow_catalog_get(pool, workflow_id=workflow_id, version=body.version)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="companion_workflow_version_not_found")
    validation = workflow_catalog.validate_workflow_definition_raw(dict(row.get("definition") or {}))
    if not validation.ok:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "companion_workflow_invalid", "errors": validation.errors},
        )
    updated = await catalog_pg.workflow_catalog_set_enabled(
        pool,
        workflow_id=workflow_id,
        version=body.version,
        enabled=True,
        actor_sub=admin.username or admin.email,
    )
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="companion_workflow_version_not_found")
    definition = CompanionWorkflowDefinitionV1.model_validate(updated.get("definition") or {})
    return CompanionWorkflowDetailOut(
        definition=definition,
        effective_enabled=workflow_catalog.pg_workflow_effective_enabled(updated),
        source="pg",
        catalog_enabled=True,
        pg_version=int(updated.get("version") or body.version),
    )


@router.put("/workflows/{workflow_id}/disable", response_model=CompanionWorkflowDetailOut)
async def disable_companion_workflow(
    workflow_id: str,
    request: Request,
    admin: User = Depends(require_companion_admin_user),  # noqa: B008
) -> CompanionWorkflowDetailOut:
    """Disable the currently enabled PG catalog version (builtin may still apply)."""

    _require_companion_admin_write()
    if not companion_workflow_pg_catalog_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ewa_companion_wf_pg_catalog_disabled",
        )
    pool = _require_pg_pool(request)
    enabled_row = await catalog_pg.workflow_catalog_get_enabled(pool, workflow_id=workflow_id)
    if enabled_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="companion_workflow_not_enabled")
    updated = await catalog_pg.workflow_catalog_set_enabled(
        pool,
        workflow_id=workflow_id,
        version=int(enabled_row.get("version") or 0),
        enabled=False,
        actor_sub=admin.username or admin.email,
    )
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="companion_workflow_not_enabled")
    definition = CompanionWorkflowDefinitionV1.model_validate(updated.get("definition") or {})
    return CompanionWorkflowDetailOut(
        definition=definition,
        effective_enabled=workflow_catalog.pg_workflow_effective_enabled(updated),
        source="pg",
        catalog_enabled=False,
        pg_version=int(updated.get("version") or 0),
    )


@router.get("/workflows/{workflow_id}/audit", response_model=CompanionWorkflowAuditListOut)
async def list_companion_workflow_audit(
    workflow_id: str,
    request: Request,
    limit: int = 50,
    _admin: User = Depends(require_companion_admin_user),  # noqa: B008
) -> CompanionWorkflowAuditListOut:
    """Audit trail for operator mutations on one ``workflow_id``."""

    _require_companion_admin_feature()
    if not companion_workflow_pg_catalog_enabled():
        return CompanionWorkflowAuditListOut(workflow_id=workflow_id, entries=[])
    pool = _pool_from_request(request)
    if pool is None:
        return CompanionWorkflowAuditListOut(workflow_id=workflow_id, entries=[])
    rows = await catalog_pg.workflow_catalog_audit_list(pool, workflow_id=workflow_id, limit=limit)
    return CompanionWorkflowAuditListOut(
        workflow_id=workflow_id,
        entries=[CompanionWorkflowAuditEntryOut.model_validate(row) for row in rows],
    )


@router.get("/chat-workflows", response_model=CompanionChatWorkflowListOut)
async def list_companion_chat_workflows(
    _admin: User = Depends(require_companion_admin_user),  # noqa: B008
) -> CompanionChatWorkflowListOut:
    """Read-only chat LLM workflow identifiers (no durable task steps)."""

    _require_companion_admin_feature()
    return CompanionChatWorkflowListOut(workflows=list(_CHAT_WORKFLOW_CATALOG))


@router.get("/task-runs", response_model=CompanionTaskRunsOut)
async def list_companion_admin_task_runs(
    request: Request,
    limit: int = 50,
    principal_id: str | None = None,
    status: str | None = None,
    intent_kind: str | None = None,
    include_steps: bool = False,
    _admin: User = Depends(require_companion_admin_user),  # noqa: B008
) -> CompanionTaskRunsOut:
    """Operator-wide recent companion task runs (debug tab)."""

    _require_companion_admin_feature()
    pool = _pool_from_request(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    runs = await companion_pg.companion_task_runs_list_operator(
        pool,
        limit=limit,
        principal_id=principal_id,
        status=status,
        intent_kind=intent_kind,
    )
    if include_steps:
        enriched: list[dict[str, Any]] = []
        for run in runs:
            enriched.append(await _attach_task_run_steps(pool, run, include_steps=True))
        runs = enriched
    return CompanionTaskRunsOut(runs=[CompanionTaskRunOut.model_validate(r) for r in runs])


@router.get("/task-runs/{run_id}", response_model=CompanionTaskRunOut)
async def get_companion_admin_task_run(
    run_id: str,
    request: Request,
    include_steps: bool = True,
    _admin: User = Depends(require_companion_admin_user),  # noqa: B008
) -> CompanionTaskRunOut:
    """Fetch one companion task run for operator debug (any principal)."""

    _require_companion_admin_feature()
    pool = _pool_from_request(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    run = await companion_pg.companion_task_run_fetch(pool, run_id=run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="companion_task_run_not_found")
    run = await _attach_task_run_steps(pool, run, include_steps=include_steps)
    return CompanionTaskRunOut.model_validate(run)


def _setting_out(row: dict[str, Any], *, mask_secrets: bool = True) -> CompanionPlatformSettingOut:
    payload = dict(row)
    key = str(payload.get("setting_key") or "")
    definition = CATALOG.get(key)
    if definition is not None:
        payload["title_ru"] = definition.title_ru
        payload["title_en"] = definition.title_en
        payload["description_ru"] = definition.description_ru
        payload["description_en"] = definition.description_en
        payload["allowed_values"] = definition.allowed_values
        payload["affects_ru"] = definition.affects_ru
        payload["affects_en"] = definition.affects_en
    else:
        payload.setdefault("title_ru", "")
        payload.setdefault("title_en", "")
    is_secret = bool(payload.get("is_secret"))
    value = str(payload.get("value_text") or "")
    masked = False
    if mask_secrets and is_secret and value.strip():
        payload["value_text"] = ""
        masked = True
    payload["value_masked"] = masked
    return CompanionPlatformSettingOut.model_validate(payload)


@router.get("/settings", response_model=CompanionPlatformSettingsListOut)
async def list_companion_platform_settings(
    request: Request,
    category: str | None = None,
    _admin: User = Depends(require_companion_admin_user),  # noqa: B008
) -> CompanionPlatformSettingsListOut:
    """Operator-editable EWA platform settings (Postgres source of truth).

    Intentionally does **not** require ``EWA_COMPANION_ADMIN_ENABLED`` so operators can
    bootstrap admin flags from the Settings tab (no env file).
    """

    pool = _pool_from_request(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    rows = await settings_pg.list_ewa_platform_settings(pool)
    db_total = len(rows)
    acquire = getattr(pool, "acquire", None)
    if callable(acquire):
        try:
            async with acquire() as conn:
                db_total = int(await conn.fetchval("SELECT COUNT(*) FROM ewa_platform_setting") or 0)
        except Exception as exc:  # noqa: BLE001 - metrics fallback must not break settings listing
            logger.warning("companion admin settings db_total fallback: %s", exc)
    if category:
        cat = category.strip().lower()
        rows = [r for r in rows if str(r.get("category") or "").lower() == cat]
    catalog_total = len(CATALOG)
    settings_out = [_setting_out(r) for r in rows]
    logger.info(
        "companion admin settings list db_total=%s list_rows=%s returned=%s catalog_total=%s category=%s",
        db_total,
        len(rows),
        len(settings_out),
        catalog_total,
        category or "all",
    )
    return CompanionPlatformSettingsListOut(
        settings=settings_out,
        settings_total=len(settings_out),
        db_total=db_total,
        catalog_total=catalog_total,
    )


@router.get("/settings/audit", response_model=CompanionPlatformSettingAuditListOut)
async def list_companion_platform_settings_audit(
    request: Request,
    setting_key: str | None = None,
    limit: int = 50,
    _admin: User = Depends(require_companion_admin_user),  # noqa: B008
) -> CompanionPlatformSettingAuditListOut:
    """Audit trail for EWA platform settings (operator-wide or one key).

    Intentionally does **not** require ``EWA_COMPANION_ADMIN_ENABLED`` (bootstrap parity with settings list).
    """

    pool = _pool_from_request(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    rows = await settings_pg.list_ewa_platform_setting_audit(
        pool,
        setting_key=setting_key,
        limit=limit,
    )
    return CompanionPlatformSettingAuditListOut(
        entries=[CompanionPlatformSettingAuditEntryOut.model_validate(r) for r in rows],
    )


@router.put("/settings/{setting_key}", response_model=CompanionPlatformSettingOut)
async def update_companion_platform_setting(
    setting_key: str,
    body: CompanionPlatformSettingUpdateRequestV1,
    request: Request,
    admin: User = Depends(require_companion_admin_user),  # noqa: B008
) -> CompanionPlatformSettingOut:
    """Update one EWA platform setting; refreshes in-process cache immediately.

    Admin JWT only — write gate flags themselves live in this table.
    """

    pool = _require_pg_pool(request)
    err = validate_setting_value(setting_key, body.value_text)
    if err:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=err)
    updated = await update_setting_and_reload(
        pool,
        setting_key=setting_key,
        value_text=body.value_text,
        actor_sub=admin.username or admin.email,
    )
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ewa_setting_not_found")
    return _setting_out(updated, mask_secrets=False)


@router.get("/prompt-blocks", response_model=CompanionPromptBlockListOut)
async def list_companion_prompt_blocks(
    request: Request,
    _admin: User = Depends(require_companion_admin_user),  # noqa: B008
) -> CompanionPromptBlockListOut:
    _require_companion_admin_feature()
    pool = _pool_from_request(request)
    db_rows: dict[str, dict[str, Any]] = {}
    if pool is not None:
        for row in await prompt_blocks_pg.list_prompt_blocks(pool):
            db_rows[str(row["block_key"])] = row
    blocks: list[CompanionPromptBlockOut] = []
    for key in sorted(PROMPT_BLOCK_CANON.keys()):
        spec = PROMPT_BLOCK_CANON[key]
        row = db_rows.get(key)
        if row:
            blocks.append(
                CompanionPromptBlockOut(
                    block_key=key,
                    category=str(row.get("category") or spec.category),
                    description=str(row.get("description") or spec.description),
                    body_text=str(row.get("body_text") or ""),
                    updated_at=row.get("updated_at"),
                    updated_by=row.get("updated_by"),
                    source="db",
                )
            )
        else:
            blocks.append(
                CompanionPromptBlockOut(
                    block_key=key,
                    category=spec.category,
                    description=spec.description,
                    body_text=spec.body_text,
                    source="canon",
                )
            )
    return CompanionPromptBlockListOut(blocks=blocks)


@router.get("/prompt-blocks/audit", response_model=CompanionPromptBlockAuditListOut)
async def list_companion_prompt_block_audit(
    request: Request,
    block_key: str | None = None,
    limit: int = 50,
    _admin: User = Depends(require_companion_admin_user),  # noqa: B008
) -> CompanionPromptBlockAuditListOut:
    _require_companion_admin_feature()
    pool = _require_pg_pool(request)
    rows = await prompt_blocks_pg.list_prompt_block_audit(pool, block_key=block_key, limit=limit)
    return CompanionPromptBlockAuditListOut(
        entries=[CompanionPromptBlockAuditEntryOut.model_validate(r) for r in rows],
    )


@router.put("/prompt-blocks/{block_key}", response_model=CompanionPromptBlockOut)
async def update_companion_prompt_block(
    block_key: str,
    body: CompanionPromptBlockUpdateRequestV1,
    request: Request,
    admin: User = Depends(require_companion_admin_user),  # noqa: B008
) -> CompanionPromptBlockOut:
    _require_companion_admin_feature()
    _require_companion_admin_write()
    if block_key not in PROMPT_BLOCK_CANON:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="prompt_block_unknown")
    pool = _require_pg_pool(request)
    updated = await prompt_blocks_svc.update_prompt_block(
        pool,
        block_key=block_key,
        body_text=body.body_text,
        actor_sub=admin.username or admin.email,
    )
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="prompt_block_not_found")
    return CompanionPromptBlockOut(
        block_key=str(updated["block_key"]),
        category=str(updated.get("category") or ""),
        description=str(updated.get("description") or ""),
        body_text=str(updated.get("body_text") or ""),
        updated_at=updated.get("updated_at"),
        updated_by=updated.get("updated_by"),
        source="db",
    )


@router.get("/users", response_model=CompanionAdminUserListOut)
async def list_companion_admin_users(
    request: Request,
    q: str | None = None,
    limit: int = 50,
    offset: int = 0,
    _admin: User = Depends(require_companion_admin_user),  # noqa: B008
) -> CompanionAdminUserListOut:
    _require_companion_admin_feature()
    pool = _require_pg_pool(request)
    rows = await companion_pg.companion_profile_list_admin(pool, q=q, limit=limit, offset=offset)
    return CompanionAdminUserListOut(
        users=[CompanionAdminUserSummaryOut.model_validate(r) for r in rows],
    )


@router.get("/users/{principal_id}", response_model=CompanionAdminUserDetailOut)
async def get_companion_admin_user(
    principal_id: str,
    request: Request,
    _admin: User = Depends(require_companion_admin_user),  # noqa: B008
) -> CompanionAdminUserDetailOut:
    _require_companion_admin_feature()
    pool = _require_pg_pool(request)
    profile = await companion_pg.companion_profile_fetch(pool, principal_id=principal_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="companion_profile_not_found")
    return CompanionAdminUserDetailOut(
        principal_id=str(profile["principal_id"]),
        seed_persona_id=str(profile.get("seed_persona_id") or "parent"),
        companion_revision=int(profile.get("companion_revision") or 1),
        updated_at=profile.get("updated_at"),
        summary=admin_users_svc.namespace_summary(profile),
    )


@router.get("/users/{principal_id}/timeline", response_model=CompanionAdminUserTimelineOut)
async def get_companion_admin_user_timeline(
    principal_id: str,
    request: Request,
    limit: int = 40,
    _admin: User = Depends(require_companion_admin_user),  # noqa: B008
) -> CompanionAdminUserTimelineOut:
    _require_companion_admin_feature()
    pool = _require_pg_pool(request)
    events = await admin_users_svc.build_user_timeline(pool, principal_id=principal_id, limit=limit)
    return CompanionAdminUserTimelineOut(principal_id=principal_id, events=events)


@router.get("/users/{principal_id}/transcript", response_model=CompanionAdminUserTranscriptOut)
async def get_companion_admin_user_transcript(
    principal_id: str,
    request: Request,
    limit: int = 40,
    _admin: User = Depends(require_companion_admin_user),  # noqa: B008
) -> CompanionAdminUserTranscriptOut:
    _require_companion_admin_feature()
    pool = _require_pg_pool(request)
    profile = await companion_pg.companion_profile_fetch(pool, principal_id=principal_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="companion_profile_not_found")
    return CompanionAdminUserTranscriptOut(
        principal_id=principal_id,
        messages=admin_users_svc.transcript_tail(profile, limit=limit),
    )


@router.patch("/users/{principal_id}", response_model=CompanionAdminUserDetailOut)
async def patch_companion_admin_user(
    principal_id: str,
    body: CompanionAdminUserPatchRequestV1,
    request: Request,
    admin: User = Depends(require_companion_admin_user),  # noqa: B008
) -> CompanionAdminUserDetailOut:
    _require_companion_admin_feature()
    _require_companion_admin_write()
    pool = _require_pg_pool(request)
    try:
        profile = await admin_users_svc.apply_admin_user_patch(
            pool,
            principal_id=principal_id,
            actor_sub=admin.username or admin.email,
            seed_persona_id=body.seed_persona_id,
            admin_note=body.admin_note,
            learned_patch=body.learned_patch,
            baseline_patch=body.baseline_patch,
            expected_revision=body.expected_revision,
        )
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="companion_profile_not_found") from None
    except ValueError as exc:
        detail = str(exc)
        code = status.HTTP_409_CONFLICT if detail == "revision_conflict" else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=detail) from None
    return CompanionAdminUserDetailOut(
        principal_id=str(profile["principal_id"]),
        seed_persona_id=str(profile.get("seed_persona_id") or "parent"),
        companion_revision=int(profile.get("companion_revision") or 1),
        updated_at=profile.get("updated_at"),
        summary=admin_users_svc.namespace_summary(profile),
    )


@router.post("/users/{principal_id}/audit-note", response_model=CompanionAdminUserDetailOut)
async def post_companion_admin_user_audit_note(
    principal_id: str,
    body: CompanionAdminUserAuditNoteRequestV1,
    request: Request,
    admin: User = Depends(require_companion_admin_user),  # noqa: B008
) -> CompanionAdminUserDetailOut:
    _require_companion_admin_feature()
    _require_companion_admin_write()
    pool = _require_pg_pool(request)
    ok = await companion_pg.companion_audit_only(
        pool,
        principal_id=principal_id,
        action="admin_note",
        detail={"note": body.note, "actor_sub": admin.username or admin.email},
    )
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="companion_profile_not_found")
    profile = await companion_pg.companion_profile_fetch(pool, principal_id=principal_id)
    assert profile is not None
    return CompanionAdminUserDetailOut(
        principal_id=str(profile["principal_id"]),
        seed_persona_id=str(profile.get("seed_persona_id") or "parent"),
        companion_revision=int(profile.get("companion_revision") or 1),
        updated_at=profile.get("updated_at"),
        summary=admin_users_svc.namespace_summary(profile),
    )


@router.post("/users/{principal_id}/clear-namespace", response_model=CompanionAdminUserDetailOut)
async def clear_companion_admin_user_namespace(
    principal_id: str,
    body: CompanionAdminUserClearNamespaceRequestV1,
    request: Request,
    admin: User = Depends(require_companion_admin_user),  # noqa: B008
) -> CompanionAdminUserDetailOut:
    """Soft-clear one allowlisted learned namespace (PG only). Write-gated."""

    _require_companion_admin_feature()
    _require_companion_admin_write()
    ns = str(body.namespace or "").strip()
    confirm = str(body.confirm_namespace or "").strip()
    if not ns or confirm != ns:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="confirm_namespace_mismatch",
        )
    pool = _require_pg_pool(request)
    try:
        profile = await admin_users_svc.clear_learned_namespace(
            pool,
            principal_id=principal_id,
            namespace=ns,
            actor_sub=admin.username or admin.email,
            expected_revision=body.expected_revision,
        )
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="companion_profile_not_found",
        ) from None
    except ValueError as exc:
        detail = str(exc)
        code = status.HTTP_409_CONFLICT if detail == "revision_conflict" else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=detail) from None
    return CompanionAdminUserDetailOut(
        principal_id=str(profile["principal_id"]),
        seed_persona_id=str(profile.get("seed_persona_id") or "parent"),
        companion_revision=int(profile.get("companion_revision") or 1),
        updated_at=profile.get("updated_at"),
        summary=admin_users_svc.namespace_summary(profile),
    )


@router.post("/users/{principal_id}/wipe", response_model=CompanionAdminUserWipeOut)
async def wipe_companion_admin_user(
    principal_id: str,
    body: CompanionAdminUserWipeRequestV1,
    request: Request,
    admin: User = Depends(require_companion_admin_user),  # noqa: B008
) -> CompanionAdminUserWipeOut:
    """Hard-reset companion state for one principal (first-meet). Write-gated."""

    _require_companion_admin_feature()
    _require_companion_admin_write()
    pid = str(principal_id or "").strip()
    confirm = str(body.confirm_principal_id or "").strip()
    if not pid or confirm != pid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="confirm_principal_id_mismatch",
        )
    pool = _require_pg_pool(request)
    try:
        result = await admin_users_svc.wipe_companion_principal(
            pool,
            principal_id=pid,
            actor_sub=admin.username or admin.email,
        )
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="companion_profile_not_found",
        ) from None
    except admin_users_svc.CompanionAdminWipeQdrantUnavailable as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="companion_wipe_qdrant_unavailable",
        ) from exc
    except admin_users_svc.CompanionAdminWipeQdrantFailed as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="companion_wipe_qdrant_purge_failed",
        ) from exc
    return CompanionAdminUserWipeOut.model_validate(result)


__all__ = ("require_companion_admin_user", "router")
