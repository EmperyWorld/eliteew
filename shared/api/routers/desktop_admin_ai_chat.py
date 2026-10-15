# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Админские дефолты и шаблоны промптов для Desktop AI / ensemble.
# Invariants:
#   - Доступ только через require_admin_user; updated_at — utc_now_naive().
# Related:
#   - api/routers/desktop_ai_chat.py
# ------------------------------------------------------------------------------
"""Admin: Desktop AI Chat global defaults and prompt templates."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.auth import User as AuthUser
from api.core.database_manager import get_postgres_session
from api.models.desktop_ai_chat import (
    DesktopAiChatConfig,
    DesktopAiChatPromptTemplate,
    DesktopEnsemblePlanTemplate,
)
from api.routers.desktop_admin import require_admin_user
from api.services.desktop_chat.fetch_url_policy import (
    fetch_url_policy_blocked,
    fetch_url_require_allowlist,
    merge_fetch_url_allow_hosts,
)
from api.services.desktop_chat_ensemble.blueprint.catalog import (
    PlanTemplate,
    clear_plan_catalog_cache,
    get_plan_catalog_fresh,
)
from api.utils.datetime_helpers import utc_now_naive

router = APIRouter(prefix="/ai-chat", tags=["desktop-admin-ai-chat"])


class ConfigPatchBody(BaseModel):
    defaults: dict[str, Any] = Field(..., description="Merge into existing defaults JSON")


class PromptTemplateCreate(BaseModel):
    template_key: str = Field(..., min_length=1, max_length=100)
    display_name: str = Field(..., min_length=1, max_length=255)
    system_prompt: str = Field(..., min_length=1)
    company_id: UUID | None = None
    is_active: bool = True
    sort_order: int = 0


class PromptTemplatePatch(BaseModel):
    display_name: str | None = Field(default=None, max_length=255)
    system_prompt: str | None = None
    company_id: UUID | None = None
    is_active: bool | None = None
    sort_order: int | None = None


def _template_out(t: DesktopAiChatPromptTemplate) -> dict[str, Any]:
    return {
        "id": str(t.id),
        "template_key": t.template_key,
        "display_name": t.display_name,
        "system_prompt": t.system_prompt,
        "company_id": str(t.company_id) if t.company_id else None,
        "is_active": t.is_active,
        "sort_order": t.sort_order,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


@router.get("/config")
async def get_ai_chat_config(
    db: AsyncSession = Depends(get_postgres_session),
    admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    _ = admin
    row = await db.get(DesktopAiChatConfig, 1)
    if row is None:
        return {"id": 1, "defaults": {}}
    return {"id": row.id, "defaults": dict(row.defaults or {})}


@router.post("/probe")
async def post_ai_chat_probe(
    admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    from api.services.desktop_chat.desktop_ai_chat_admin_ops_service import probe_desktop_ai_chat_health

    _ = admin
    return await probe_desktop_ai_chat_health()


def _validate_defaults_merge(base: dict[str, Any], patch: dict[str, Any]) -> None:
    if "kbsew_search_settings" in patch:
        from api.services.desktop_chat.kbsew_search_settings import normalize_kbsew_search_settings

        try:
            normalize_kbsew_search_settings(patch.get("kbsew_search_settings"))
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    mem_keys = (
        "memory_cells_enabled",
        "memory_cells_max_per_user",
        "memory_cells_max_messages",
        "memory_cells_max_chunks",
        "memory_cells_retrieval_top_k",
        "memory_cells_min_score",
    )
    if any(k in patch for k in mem_keys):
        from api.services.desktop_chat.memory_cells_settings import normalize_memory_cells_admin_defaults

        normalized = normalize_memory_cells_admin_defaults(patch)
        for k, v in normalized.items():
            patch[k] = v

    from api.services.desktop_chat.generation_budgets_settings import (
        GENERATION_BUDGET_ADMIN_KEYS,
        normalize_generation_budgets_admin_defaults,
    )

    if any(k in patch for k in GENERATION_BUDGET_ADMIN_KEYS):
        budget_normalized = normalize_generation_budgets_admin_defaults(patch)
        for k, v in budget_normalized.items():
            patch[k] = v

    if not fetch_url_require_allowlist():
        return
    merged = dict(base)
    merged.update(patch)
    if "fetch_url_allow_hosts" not in patch and "tools_fetch_url_enabled" not in patch:
        return
    if merged.get("tools_fetch_url_enabled") is False:
        return
    allow_hosts = merge_fetch_url_allow_hosts(merged)
    blocked = fetch_url_policy_blocked(allow_hosts)
    if blocked:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=blocked)


@router.patch("/config")
async def patch_ai_chat_config(
    body: ConfigPatchBody,
    db: AsyncSession = Depends(get_postgres_session),
    admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    _ = admin
    row = await db.get(DesktopAiChatConfig, 1)
    if row is None:
        row = DesktopAiChatConfig(id=1, defaults={})
        db.add(row)
        await db.flush()
    base = dict(row.defaults or {})
    _validate_defaults_merge(base, body.defaults)
    base.update(body.defaults)
    row.defaults = base
    row.updated_at = utc_now_naive()
    await db.commit()
    await db.refresh(row)
    return {"id": row.id, "defaults": dict(row.defaults or {})}


@router.get("/prompt-templates")
async def list_prompt_templates(
    db: AsyncSession = Depends(get_postgres_session),
    admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    _ = admin
    r = await db.execute(
        select(DesktopAiChatPromptTemplate).order_by(
            DesktopAiChatPromptTemplate.sort_order.asc(),
            DesktopAiChatPromptTemplate.created_at.asc(),
        )
    )
    return {"items": [_template_out(x) for x in r.scalars().all()]}


@router.post("/prompt-templates", status_code=status.HTTP_201_CREATED)
async def create_prompt_template(
    body: PromptTemplateCreate,
    db: AsyncSession = Depends(get_postgres_session),
    admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    _ = admin
    t = DesktopAiChatPromptTemplate(
        template_key=body.template_key.strip(),
        display_name=body.display_name.strip(),
        system_prompt=body.system_prompt,
        company_id=body.company_id,
        is_active=body.is_active,
        sort_order=body.sort_order,
    )
    db.add(t)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e)) from e
    await db.refresh(t)
    return _template_out(t)


@router.patch("/prompt-templates/{template_id}")
async def patch_prompt_template(
    template_id: UUID,
    body: PromptTemplatePatch,
    db: AsyncSession = Depends(get_postgres_session),
    admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    _ = admin
    t = await db.get(DesktopAiChatPromptTemplate, template_id)
    if t is None:
        raise HTTPException(status_code=404, detail="Not found")
    if body.display_name is not None:
        t.display_name = body.display_name.strip()
    if body.system_prompt is not None:
        t.system_prompt = body.system_prompt
    if body.company_id is not None:
        t.company_id = body.company_id
    if body.is_active is not None:
        t.is_active = body.is_active
    if body.sort_order is not None:
        t.sort_order = body.sort_order
    t.updated_at = utc_now_naive()
    await db.commit()
    await db.refresh(t)
    return _template_out(t)


@router.delete("/prompt-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prompt_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    admin: AuthUser = Depends(require_admin_user),
) -> None:
    _ = admin
    t = await db.get(DesktopAiChatPromptTemplate, template_id)
    if t is None:
        raise HTTPException(status_code=404, detail="Not found")
    await db.execute(delete(DesktopAiChatPromptTemplate).where(DesktopAiChatPromptTemplate.id == template_id))
    await db.commit()


# --- Ensemble blueprint plan templates (DB черновики + подмешивание к файловому каталогу) ---


def _normalize_keywords(kw: list[str] | None) -> list[str]:
    if not kw:
        return []
    return [str(x).strip() for x in kw if str(x).strip()]


def _ensemble_plan_row_out(t: DesktopEnsemblePlanTemplate, *, include_body: bool) -> dict[str, Any]:
    base: dict[str, Any] = {
        "id": str(t.id),
        "template_id": t.template_id,
        "title": t.title,
        "description": t.description,
        "keywords": list(t.keywords or []) if isinstance(t.keywords, list) else [],
        "is_active": t.is_active,
        "sort_order": t.sort_order,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }
    if include_body:
        base["body"] = dict(t.body) if isinstance(t.body, dict) else {}
    return base


def _validate_plan_body(template_id: str, body: dict[str, Any]) -> PlanTemplate:
    data = dict(body)
    data["id"] = template_id.strip()
    return PlanTemplate.model_validate(data)


class EnsemblePlanTemplateCreate(BaseModel):
    template_id: str = Field(..., min_length=1, max_length=100)
    title: str = Field(default="", max_length=500)
    description: str = ""
    keywords: list[str] = Field(default_factory=list)
    body: dict[str, Any]
    is_active: bool = True
    sort_order: int = 0


class EnsemblePlanTemplatePatch(BaseModel):
    template_id: str | None = Field(default=None, min_length=1, max_length=100)
    title: str | None = Field(default=None, max_length=500)
    description: str | None = None
    keywords: list[str] | None = None
    body: dict[str, Any] | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class DuplicateBuiltinBody(BaseModel):
    source_id: str = Field(..., min_length=1, max_length=100)
    new_template_id: str = Field(..., min_length=1, max_length=100)
    title: str | None = Field(default=None, max_length=500)


class ValidateEnsemblePlanBodyPayload(BaseModel):
    """Validate a plan JSON body against PlanTemplate (optional id override for checks)."""

    template_id: str | None = Field(default=None, max_length=100)
    body: dict[str, Any] = Field(default_factory=dict)


@router.get("/ensemble-plan-templates/builtins")
async def list_ensemble_plan_builtins(
    admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    _ = admin
    cat = get_plan_catalog_fresh()
    items = []
    for ent in cat.manifest.templates:
        tpl = cat.templates_by_id.get(ent.id)
        items.append(
            {
                "id": ent.id,
                "title": tpl.title if tpl else ent.id,
                "keywords": list(ent.keywords),
                "example_command": (ent.example_command or "").strip(),
            }
        )
    return {"items": items}


@router.get("/ensemble-plan-templates/builtins/{source_id}")
async def get_ensemble_plan_builtin_detail(
    source_id: str,
    admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    """Full builtin template (for admin editor / prefilled duplicate). File catalog only."""
    _ = admin
    sid = source_id.strip()
    if not sid:
        raise HTTPException(status_code=400, detail="empty source_id")
    cat = get_plan_catalog_fresh()
    tpl = cat.templates_by_id.get(sid)
    if tpl is None:
        known = sorted(cat.templates_by_id.keys())
        raise HTTPException(
            status_code=404,
            detail=(
                f"builtin template not found: {sid!r}. "
                f"File catalog has {len(known)} template(s). "
                f"If this id is listed in GET .../builtins but missing here, redeploy API "
                f"with route GET .../builtins/{{source_id}} and plan_templates on disk. "
                f"Ids: {known}"
            ),
        )
    ent = cat.entries_by_id.get(sid)
    return {
        "template": tpl.model_dump(mode="json"),
        "keywords": list(ent.keywords) if ent else [],
    }


@router.post("/ensemble-plan-templates/validate")
async def validate_ensemble_plan_payload(
    body: ValidateEnsemblePlanBodyPayload,
    admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    _ = admin
    tid = (body.template_id or str(body.body.get("id") or "") or "").strip()
    if not tid:
        tid = "_validate"
    try:
        validated = _validate_plan_body(tid, body.body)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.errors()) from e
    return {"ok": True, "normalized": validated.model_dump(mode="json")}


@router.get("/ensemble-plan-templates")
async def list_ensemble_plan_templates(
    db: AsyncSession = Depends(get_postgres_session),
    admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    _ = admin
    r = await db.execute(
        select(DesktopEnsemblePlanTemplate).order_by(
            DesktopEnsemblePlanTemplate.sort_order.asc(),
            DesktopEnsemblePlanTemplate.created_at.asc(),
        )
    )
    return {"items": [_ensemble_plan_row_out(x, include_body=False) for x in r.scalars().all()]}


@router.get("/ensemble-plan-templates/{row_id}")
async def get_ensemble_plan_template(
    row_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    _ = admin
    t = await db.get(DesktopEnsemblePlanTemplate, row_id)
    if t is None:
        raise HTTPException(status_code=404, detail="Not found")
    return _ensemble_plan_row_out(t, include_body=True)


@router.post("/ensemble-plan-templates", status_code=status.HTTP_201_CREATED)
async def create_ensemble_plan_template(
    body: EnsemblePlanTemplateCreate,
    db: AsyncSession = Depends(get_postgres_session),
    admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    _ = admin
    tid = body.template_id.strip()
    try:
        validated = _validate_plan_body(tid, body.body)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.errors()) from e
    row = DesktopEnsemblePlanTemplate(
        template_id=tid,
        title=(body.title.strip() or validated.title or tid),
        description=(body.description or validated.description or ""),
        keywords=_normalize_keywords(body.keywords),
        body=validated.model_dump(mode="json"),
        is_active=body.is_active,
        sort_order=body.sort_order,
    )
    db.add(row)
    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(status_code=409, detail="template_id already exists") from e
    await db.refresh(row)
    clear_plan_catalog_cache()
    return _ensemble_plan_row_out(row, include_body=True)


@router.post("/ensemble-plan-templates/duplicate-builtin", status_code=status.HTTP_201_CREATED)
async def duplicate_builtin_ensemble_plan(
    body: DuplicateBuiltinBody,
    db: AsyncSession = Depends(get_postgres_session),
    admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    _ = admin
    cat = get_plan_catalog_fresh()
    src = cat.templates_by_id.get(body.source_id.strip())
    if src is None:
        raise HTTPException(status_code=404, detail="builtin template not found")
    ent = cat.entries_by_id.get(body.source_id.strip())
    new_id = body.new_template_id.strip()
    data = src.model_dump(mode="json")
    data["id"] = new_id
    try:
        validated = PlanTemplate.model_validate(data)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.errors()) from e
    title = (body.title.strip() if body.title else "") or validated.title or new_id
    kw = list(ent.keywords) if ent else []
    row = DesktopEnsemblePlanTemplate(
        template_id=new_id,
        title=title,
        description=validated.description or "",
        keywords=kw,
        body=validated.model_dump(mode="json"),
        is_active=True,
        sort_order=0,
    )
    db.add(row)
    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(status_code=409, detail="template_id already exists") from e
    await db.refresh(row)
    clear_plan_catalog_cache()
    return _ensemble_plan_row_out(row, include_body=True)


@router.patch("/ensemble-plan-templates/{row_id}")
async def patch_ensemble_plan_template(
    row_id: UUID,
    body: EnsemblePlanTemplatePatch,
    db: AsyncSession = Depends(get_postgres_session),
    admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    _ = admin
    t = await db.get(DesktopEnsemblePlanTemplate, row_id)
    if t is None:
        raise HTTPException(status_code=404, detail="Not found")
    new_tid = body.template_id.strip() if body.template_id is not None else t.template_id
    if body.template_id is not None:
        t.template_id = new_tid
    if body.title is not None:
        t.title = body.title.strip()
    if body.description is not None:
        t.description = body.description
    if body.keywords is not None:
        t.keywords = _normalize_keywords(body.keywords)
    if body.is_active is not None:
        t.is_active = body.is_active
    if body.sort_order is not None:
        t.sort_order = body.sort_order
    raw_body = dict(t.body) if isinstance(t.body, dict) else {}
    if body.body is not None:
        raw_body = dict(body.body)
    if body.body is not None or body.template_id is not None:
        try:
            validated = _validate_plan_body(new_tid, raw_body)
        except ValidationError as e:
            raise HTTPException(status_code=400, detail=e.errors()) from e
        t.body = validated.model_dump(mode="json")
        if body.title is None:
            t.title = (t.title or "").strip() or validated.title or new_tid
    t.updated_at = utc_now_naive()
    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(status_code=409, detail="template_id conflict") from e
    await db.refresh(t)
    clear_plan_catalog_cache()
    return _ensemble_plan_row_out(t, include_body=True)


@router.delete("/ensemble-plan-templates/{row_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ensemble_plan_template(
    row_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    admin: AuthUser = Depends(require_admin_user),
) -> None:
    _ = admin
    t = await db.get(DesktopEnsemblePlanTemplate, row_id)
    if t is None:
        raise HTTPException(status_code=404, detail="Not found")
    await db.execute(delete(DesktopEnsemblePlanTemplate).where(DesktopEnsemblePlanTemplate.id == row_id))
    await db.commit()
    clear_plan_catalog_cache()
