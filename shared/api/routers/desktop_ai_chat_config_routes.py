# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Desktop AI Chat config routes: effective-settings, ensemble blueprint commands, heroes catalog.
# Invariants:
# - Mounted without extra prefix under parent ``/desktop/ai-chat``.
# Related:
# - api/routers/desktop_ai_chat.py
# - documentation/product/desktop/DESKTOP-AI-CHAT-ROUTER-SPLIT-2026-08-06.md
# ---
"""Desktop AI Chat — config / catalog routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.auth import User as AuthUser
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.schemas.desktop_ai_chat import (
    DesktopAiEffectiveSettingsOut,
    DesktopAiHeroCatalogOut,
    EnsembleBlueprintCommandsOut,
)
from api.services.desktop_chat.service import fetch_config_defaults
from api.services.desktop_chat_ensemble.heroes_prompt_data import list_hero_catalog_entries

router = APIRouter(tags=["Desktop - AI Chat"])


@router.get("/effective-settings", response_model=DesktopAiEffectiveSettingsOut)
async def effective_settings(
    db: AsyncSession = Depends(get_postgres_session),
    user: AuthUser = Depends(require_oauth2_user),
) -> DesktopAiEffectiveSettingsOut:
    _ = user
    defaults = await fetch_config_defaults(db)
    return DesktopAiEffectiveSettingsOut.model_validate({"defaults": defaults})


@router.get("/ensemble-blueprint-commands", response_model=EnsembleBlueprintCommandsOut)
async def ensemble_blueprint_commands(
    user: AuthUser = Depends(require_oauth2_user),
) -> EnsembleBlueprintCommandsOut:
    """Список встроенных шаблонов blueprint с примерами запросов (manifest `example_command`)."""
    _ = user
    from api.services.desktop_chat_ensemble.blueprint.catalog import get_plan_catalog_fresh

    cat = get_plan_catalog_fresh()
    items: list[dict[str, Any]] = []
    for ent in cat.manifest.templates:
        tpl = cat.templates_by_id.get(ent.id)
        items.append(
            {
                "id": ent.id,
                "title": tpl.title if tpl else ent.id,
                "description": tpl.description if tpl else "",
                "artifact_type": tpl.artifact_type if tpl else "general",
                "required_context": list(tpl.required_context) if tpl else [],
                "example_command": (ent.example_command or "").strip(),
            }
        )
    return EnsembleBlueprintCommandsOut.model_validate({"items": items})


@router.get("/heroes", response_model=DesktopAiHeroCatalogOut)
async def list_heroes(
    user: AuthUser = Depends(require_oauth2_user),
) -> DesktopAiHeroCatalogOut:
    """Каталог героев Desktop AI Chat (без полного systemPrompt — резолвится на сервере)."""
    _ = user
    return DesktopAiHeroCatalogOut.model_validate({"items": list_hero_catalog_entries()})
