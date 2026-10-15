# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# User CRUD for personal companion action workflows under ``/api/v1/ewa/companion-user-workflows``.
# Invariants:
# - Scoped to authenticated principal; gated by ``EWA_COMPANION_USER_WORKFLOWS_ENABLED``.
# Related:
# - api/ewa_platform/persistence_pg/companion_user_workflows_asyncpg.py
# ---

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status  # type: ignore[import-untyped]

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.ewa_platform.companion.workflows.config import companion_user_workflows_enabled
from api.ewa_platform.companion.workflows.dag.context import WorkflowValidationContext
from api.ewa_platform.companion.workflows.dag.validation import validate_dag_definition_for_execution
from api.ewa_platform.companion.workflows.user.observation_trigger_prefs import (
    ObservationTriggerPrefsPatchV1,
    fetch_observation_trigger_prefs,
    patch_observation_trigger_prefs,
)
from api.ewa_platform.companion.workflows.user.user_workflow_allowlist import USER_WORKFLOW_TOOL_CATALOG
from api.ewa_platform.companion.workflows.user.user_workflow_validation import (
    UserWorkflowCreateInV1,
    UserWorkflowPatchInV1,
    UserWorkflowTriggerPhraseV1,
    analyze_user_workflow_with_collisions,
    apply_user_workflow_v2_metadata,
    build_user_workflow_definition,
    build_user_workflow_definition_v2,
    validate_user_workflow_dag_payload,
    validate_user_workflow_payload,
)
from api.ewa_platform.gateways.ewa_service_unavailable import ewa_pool_unavailable_exception
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg
from api.ewa_platform.persistence_pg import companion_user_workflows_asyncpg as user_wf_pg
from api.ewa_platform.schemas.pydantic.companion import CompanionDeletedOut
from api.ewa_platform.schemas.pydantic.companion_user_workflow import (
    CompanionUserWorkflowObservationTriggersOut,
    CompanionUserWorkflowObservationTriggersPatchIn,
    CompanionUserWorkflowOut,
    CompanionUserWorkflowToolCatalogEntry,
    CompanionUserWorkflowValidateIn,
    CompanionUserWorkflowValidateOut,
)
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import (
    CompanionWorkflowDefinitionV2,
    CompanionWorkflowValidateV2Request,
    CompanionWorkflowValidateV2Response,
)

router = APIRouter(tags=["EWA - Companion user workflows"])


def _pool(request: Request) -> Any | None:
    return getattr(request.app.state, "ewa_orchestration_pool", None)


def _principal(auth_user: User) -> str:
    return str(auth_user.id)


def _require_feature() -> None:
    if not companion_user_workflows_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="companion_user_workflows_disabled",
        )


def _shape_row(row: dict[str, Any]) -> CompanionUserWorkflowOut:
    return CompanionUserWorkflowOut.model_validate(row)


async def _validate_dag_create_body(
    request: Request,
    *,
    auth_user: User,
    body: UserWorkflowCreateInV1,
    exclude_workflow_id: str | None = None,
) -> list[str]:
    pool = _pool(request)
    if pool is not None:
        analysis = await analyze_user_workflow_with_collisions(
            pool,
            principal_id=_principal(auth_user),
            body=body,
            exclude_workflow_id=exclude_workflow_id,
        )
        return list(analysis.errors)
    return validate_user_workflow_dag_payload(body, is_verified_user=bool(auth_user.is_verified))


def _is_v2_definition_raw(def_raw: Any) -> bool:
    return isinstance(def_raw, dict) and int(def_raw.get("schema_version") or 0) == 2


@router.get(
    "/companion-user-workflows/tool-catalog",
    response_model=list[CompanionUserWorkflowToolCatalogEntry],
    operation_id="ewa_companion_user_workflows_tool_catalog",
)
async def list_user_workflow_tool_catalog(
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[CompanionUserWorkflowToolCatalogEntry]:
    _require_feature()
    return [CompanionUserWorkflowToolCatalogEntry.model_validate(entry) for entry in USER_WORKFLOW_TOOL_CATALOG]


@router.post(
    "/companion-user-workflows/validate",
    response_model=CompanionUserWorkflowValidateOut,
    operation_id="ewa_companion_user_workflows_validate",
)
async def validate_user_workflow(
    request: Request,
    body: CompanionUserWorkflowValidateIn,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> CompanionUserWorkflowValidateOut:
    _require_feature()
    create_body = UserWorkflowCreateInV1(
        name=body.name,
        enabled=True,
        trigger=body.trigger,
        steps=body.steps,
    )
    pool = _pool(request)
    if pool is not None:
        analysis = await analyze_user_workflow_with_collisions(
            pool,
            principal_id=_principal(auth_user),
            body=create_body,
            exclude_workflow_id=str(body.exclude_workflow_id or "").strip() or None,
        )
    else:
        from api.ewa_platform.companion.workflows.user.user_workflow_validation import analyze_user_workflow

        analysis = analyze_user_workflow(create_body)
    return CompanionUserWorkflowValidateOut.model_validate(analysis.model_dump())


@router.post(
    "/companion-user-workflows/validate-v2",
    response_model=CompanionWorkflowValidateV2Response,
    operation_id="ewa_companion_user_workflows_validate_v2",
)
async def validate_user_workflow_v2(
    body: CompanionWorkflowValidateV2Request,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> CompanionWorkflowValidateV2Response:
    _require_feature()
    return validate_dag_definition_for_execution(
        body.definition,
        WorkflowValidationContext(is_verified_user=bool(auth_user.is_verified)),
    )


@router.get(
    "/companion-user-workflows",
    response_model=list[CompanionUserWorkflowOut],
    operation_id="ewa_companion_user_workflows_list",
)
async def list_user_workflows(
    request: Request,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[CompanionUserWorkflowOut]:
    _require_feature()
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    rows = await user_wf_pg.companion_user_workflows_list(pool, principal_id=_principal(auth_user))
    return [_shape_row(r) for r in rows]


@router.post(
    "/companion-user-workflows",
    response_model=CompanionUserWorkflowOut,
    operation_id="ewa_companion_user_workflows_create",
)
async def create_user_workflow(
    request: Request,
    body: UserWorkflowCreateInV1,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> CompanionUserWorkflowOut:
    _require_feature()
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    pid = _principal(auth_user)

    if body.dag is not None:
        errors = await _validate_dag_create_body(request, auth_user=auth_user, body=body)
        if errors:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"errors": errors})
        definition = build_user_workflow_definition_v2(
            workflow_id=f"user_{pid.replace('-', '')[:12]}",
            name=body.name,
            trigger=body.trigger,
            dag=body.dag,
            enabled=body.enabled,
        )
    else:
        errors = validate_user_workflow_payload(body)
        if errors:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"errors": errors})
        assert body.steps is not None
        definition = build_user_workflow_definition(
            workflow_id=f"user_{pid.replace('-', '')[:12]}",
            name=body.name,
            trigger=body.trigger,
            steps=body.steps,
            enabled=body.enabled,
        )

    row = await user_wf_pg.companion_user_workflow_create(
        pool,
        principal_id=pid,
        name=body.name.strip(),
        enabled=body.enabled,
        definition_json=definition.model_dump(mode="json"),
        trigger_json=body.trigger.model_dump(mode="json"),
    )
    return _shape_row(row)


@router.get(
    "/companion-user-workflows/{workflow_id}",
    response_model=CompanionUserWorkflowOut,
    operation_id="ewa_companion_user_workflows_get",
)
async def get_user_workflow(
    workflow_id: str,
    request: Request,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> CompanionUserWorkflowOut:
    _require_feature()
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    row = await user_wf_pg.companion_user_workflow_fetch(
        pool, principal_id=_principal(auth_user), workflow_id=workflow_id
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user_workflow_not_found")
    return _shape_row(row)


@router.patch(
    "/companion-user-workflows/{workflow_id}",
    response_model=CompanionUserWorkflowOut,
    operation_id="ewa_companion_user_workflows_patch",
)
async def patch_user_workflow(
    workflow_id: str,
    request: Request,
    body: UserWorkflowPatchInV1,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> CompanionUserWorkflowOut:
    _require_feature()
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    pid = _principal(auth_user)
    existing = await user_wf_pg.companion_user_workflow_fetch(pool, principal_id=pid, workflow_id=workflow_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user_workflow_not_found")

    name = body.name if body.name is not None else str(existing.get("name") or "")
    enabled = body.enabled if body.enabled is not None else bool(existing.get("enabled"))
    trigger_raw = existing.get("trigger_json") or {}
    if body.trigger is not None:
        trigger_raw = body.trigger.model_dump(mode="json")
    existing_def_raw = existing.get("definition_json") or {}
    is_v2 = _is_v2_definition_raw(existing_def_raw)

    definition_json: dict[str, Any] | None = None
    trigger_json: dict[str, Any] | None = None

    if body.dag is not None:
        if body.steps is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"errors": ["provide either steps or dag, not both"]},
            )
        trigger_model = UserWorkflowTriggerPhraseV1.model_validate(trigger_raw)
        patch_create = UserWorkflowCreateInV1(
            name=name,
            enabled=enabled,
            trigger=trigger_model,
            dag=body.dag,
        )
        errors = await _validate_dag_create_body(
            request,
            auth_user=auth_user,
            body=patch_create,
            exclude_workflow_id=workflow_id,
        )
        if errors:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"errors": errors})
        workflow_slug = str(existing_def_raw.get("workflow_id") or f"user_{workflow_id[:8]}")
        next_version = int(existing_def_raw.get("version") or 1) + 1
        definition = build_user_workflow_definition_v2(
            workflow_id=workflow_slug,
            name=name,
            trigger=trigger_model,
            dag=body.dag,
            enabled=enabled,
            version=next_version,
        )
        definition_json = definition.model_dump(mode="json")
        trigger_json = trigger_model.model_dump(mode="json")
    elif body.steps is not None:
        if is_v2:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"errors": ["cannot_patch_v2_workflow_with_steps"]},
            )
        trigger_model = UserWorkflowTriggerPhraseV1.model_validate(trigger_raw)
        patch_create = UserWorkflowCreateInV1(
            name=name,
            enabled=enabled,
            trigger=trigger_model,
            steps=body.steps,
        )
        errors = validate_user_workflow_payload(patch_create)
        if errors:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"errors": errors})
        definition = build_user_workflow_definition(
            workflow_id=str(existing_def_raw.get("workflow_id") or f"user_{workflow_id[:8]}"),
            name=name,
            trigger=trigger_model,
            steps=body.steps,
            enabled=enabled,
        )
        definition_json = definition.model_dump(mode="json")
        trigger_json = trigger_model.model_dump(mode="json")
    elif is_v2 and (body.trigger is not None or body.name is not None or body.enabled is not None):
        try:
            existing_definition = CompanionWorkflowDefinitionV2.model_validate(existing_def_raw)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"errors": [str(exc)]},
            ) from exc
        trigger_model = UserWorkflowTriggerPhraseV1.model_validate(trigger_raw)
        definition = apply_user_workflow_v2_metadata(
            existing_definition,
            name=name,
            trigger=trigger_model,
            enabled=enabled,
        )
        definition_json = definition.model_dump(mode="json")
        trigger_json = trigger_model.model_dump(mode="json")
    else:
        trigger_json = body.trigger.model_dump(mode="json") if body.trigger is not None else None

    row = await user_wf_pg.companion_user_workflow_update(
        pool,
        principal_id=pid,
        workflow_id=workflow_id,
        name=body.name,
        enabled=body.enabled,
        definition_json=definition_json,
        trigger_json=trigger_json,
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user_workflow_not_found")
    return _shape_row(row)


@router.delete(
    "/companion-user-workflows/{workflow_id}",
    response_model=CompanionDeletedOut,
    operation_id="ewa_companion_user_workflows_delete",
)
async def delete_user_workflow(
    workflow_id: str,
    request: Request,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> CompanionDeletedOut:
    _require_feature()
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    ok = await user_wf_pg.companion_user_workflow_delete(
        pool, principal_id=_principal(auth_user), workflow_id=workflow_id
    )
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user_workflow_not_found")
    return CompanionDeletedOut(deleted=True)


@router.post(
    "/companion-user-workflows/{workflow_id}/enable",
    response_model=CompanionUserWorkflowOut,
    operation_id="ewa_companion_user_workflows_enable",
)
async def enable_user_workflow(
    workflow_id: str,
    request: Request,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> CompanionUserWorkflowOut:
    _require_feature()
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    row = await user_wf_pg.companion_user_workflow_update(
        pool,
        principal_id=_principal(auth_user),
        workflow_id=workflow_id,
        enabled=True,
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user_workflow_not_found")
    return _shape_row(row)


@router.post(
    "/companion-user-workflows/{workflow_id}/disable",
    response_model=CompanionUserWorkflowOut,
    operation_id="ewa_companion_user_workflows_disable",
)
async def disable_user_workflow(
    workflow_id: str,
    request: Request,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> CompanionUserWorkflowOut:
    _require_feature()
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    row = await user_wf_pg.companion_user_workflow_update(
        pool,
        principal_id=_principal(auth_user),
        workflow_id=workflow_id,
        enabled=False,
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user_workflow_not_found")
    return _shape_row(row)


@router.get(
    "/companion-user-workflows/observation-triggers",
    response_model=CompanionUserWorkflowObservationTriggersOut,
    operation_id="ewa_companion_user_workflows_observation_triggers_get",
)
async def get_observation_triggers(
    request: Request,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> CompanionUserWorkflowObservationTriggersOut:
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    pid = _principal(auth_user)
    prefs = await fetch_observation_trigger_prefs(pool, principal_id=pid)
    profile = await companion_pg.companion_profile_fetch(pool, principal_id=pid)
    return CompanionUserWorkflowObservationTriggersOut(
        idle_enabled=prefs.idle_enabled,
        focus_app_enabled=prefs.focus_app_enabled,
        persisted=profile is not None,
    )


@router.patch(
    "/companion-user-workflows/observation-triggers",
    response_model=CompanionUserWorkflowObservationTriggersOut,
    operation_id="ewa_companion_user_workflows_observation_triggers_patch",
)
async def patch_observation_triggers_route(
    request: Request,
    body: CompanionUserWorkflowObservationTriggersPatchIn,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> CompanionUserWorkflowObservationTriggersOut:
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    prefs, persisted = await patch_observation_trigger_prefs(
        pool,
        principal_id=_principal(auth_user),
        patch=ObservationTriggerPrefsPatchV1(
            idle_enabled=body.idle_enabled,
            focus_app_enabled=body.focus_app_enabled,
        ),
    )
    return CompanionUserWorkflowObservationTriggersOut(
        idle_enabled=prefs.idle_enabled,
        focus_app_enabled=prefs.focus_app_enabled,
        persisted=persisted,
    )
