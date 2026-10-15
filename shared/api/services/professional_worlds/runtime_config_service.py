# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Runtime config resolver and user vertical activation helpers for Professional Worlds.
# AsyncSession-scoped helpers with no dependency on ProfessionalWorldsService.
# Invariants:
# - Runtime config omits private prompt templates and admin-only configuration fields.
# - All user activation queries are scoped by user_id.
# Related:
# - api/services/professional_worlds/service.py
# - api/services/professional_worlds/runtime_service.py
# - api/routers/professional_worlds_core.py
# ---

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Mapping
from typing import Any
from uuid import UUID

from sqlalchemy import text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.services.professional_worlds.snapshot_helpers import REALTOR_VERTICAL_SLUG

logger = logging.getLogger(__name__)


def _json(value: Any) -> str:
    """Serialize JSONB payloads consistently for SQL text queries."""
    return json.dumps(value, ensure_ascii=False, default=str)


def _row(row: Mapping[str, Any] | None) -> dict[str, Any] | None:
    """Convert SQLAlchemy RowMapping to a plain dict."""
    return dict(row) if row is not None else None


def _rows(rows: list[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """Convert SQLAlchemy RowMapping rows to plain dicts."""
    return [dict(row) for row in rows]


async def list_verticals(db: AsyncSession) -> list[dict[str, Any]]:
    """List active profession verticals."""
    result = await db.execute(
        text(
            """
            SELECT v.slug, v.name, v.description, v.icon_key, v.profile_schema, v.workspace_template,
                   COALESCE(
                       jsonb_agg(
                           jsonb_build_object(
                               'module_key', vm.module_key,
                               'name', m.name,
                               'category', m.category,
                               'icon_key', m.icon_key,
                               'sort_order', vm.sort_order
                           )
                           ORDER BY vm.sort_order, vm.module_key
                       ) FILTER (WHERE vm.is_enabled = true AND m.is_active = true),
                       '[]'::jsonb
                   ) AS modules
            FROM profession_verticals v
            LEFT JOIN professional_vertical_modules vm ON vm.vertical_slug = v.slug
            LEFT JOIN professional_modules m ON m.module_key = vm.module_key
            WHERE v.is_active = true
            GROUP BY v.slug, v.name, v.description, v.icon_key, v.profile_schema, v.workspace_template
            ORDER BY v.slug
            """
        )
    )
    return _rows(list(result.mappings().all()))


async def get_runtime_config(
    db: AsyncSession,
    vertical_slug: str = REALTOR_VERTICAL_SLUG,
    *,
    user_id: UUID | None = None,
) -> dict[str, Any]:
    """Resolve enabled runtime modules, schemas, AI actions, photo presets and integrations."""
    from api.services.professional_worlds.pack_service import (  # noqa: PLC0415
        ProfessionalWorldsPackService,
        runtime_config_hash_blob,
    )

    modules_result = await db.execute(
        text(
            """
            SELECT vm.id, vm.vertical_slug, vm.module_key, m.name AS module_name,
                   m.description AS module_description, m.category AS module_category,
                   m.icon_key, vm.config, vm.sort_order, vm.is_enabled,
                   vm.created_at, vm.updated_at
            FROM professional_vertical_modules vm
            JOIN professional_modules m ON m.module_key = vm.module_key
            WHERE vm.vertical_slug = :vertical_slug AND vm.is_enabled = true AND m.is_active = true
            ORDER BY vm.sort_order, vm.module_key
            """
        ),
        {"vertical_slug": vertical_slug},
    )
    schemas_result = await db.execute(
        text(
            """
            SELECT id, vertical_slug, schema_key, version, title, schema_json, ui_schema,
                   is_active, created_at, updated_at
            FROM professional_vertical_schemas
            WHERE vertical_slug = :vertical_slug AND is_active = true
            ORDER BY schema_key
            """
        ),
        {"vertical_slug": vertical_slug},
    )
    actions_result = await db.execute(
        text(
            """
            SELECT module_key, action_key, display_name, description, input_schema,
                   artifact_kind, sort_order
            FROM professional_ai_actions
            WHERE vertical_slug = :vertical_slug AND is_active = true
            ORDER BY module_key, sort_order, action_key
            """
        ),
        {"vertical_slug": vertical_slug},
    )
    presets_result = await db.execute(
        text(
            """
            SELECT id, vertical_slug, preset_key, display_name, description, category, action_type,
                   ugs_type_key, parameters, is_active, sort_order, created_at, updated_at
            FROM professional_photo_presets
            WHERE vertical_slug = :vertical_slug AND is_active = true
            ORDER BY category, sort_order, preset_key
            """
        ),
        {"vertical_slug": vertical_slug},
    )
    integrations_result = await db.execute(
        text(
            """
            SELECT id, vertical_slug, integration_key, display_name, config, is_enabled, created_at, updated_at
            FROM professional_integration_bindings
            WHERE vertical_slug = :vertical_slug AND is_enabled = true
            ORDER BY integration_key
            """
        ),
        {"vertical_slug": vertical_slug},
    )
    modules = _rows(list(modules_result.mappings().all()))
    schemas = _rows(list(schemas_result.mappings().all()))
    ai_actions = _rows(list(actions_result.mappings().all()))
    photo_presets = _rows(list(presets_result.mappings().all()))
    integrations = _rows(list(integrations_result.mappings().all()))

    playbooks: list[dict[str, Any]] = []
    try:
        pb_result = await db.execute(
            text(
                """
                SELECT playbook_key, display_name, description, sort_order
                FROM professional_ai_playbooks
                WHERE vertical_slug = :vertical_slug AND is_active = true
                ORDER BY sort_order, playbook_key
                """
            ),
            {"vertical_slug": vertical_slug},
        )
        playbooks = _rows(list(pb_result.mappings().all()))
    except Exception:
        logger.warning(
            "professional_worlds.get_runtime_config_playbooks_failed vertical_slug=%s",
            vertical_slug,
            exc_info=True,
        )
        playbooks = []

    runtime_epoch = 1
    try:
        epoch_result = await db.execute(
            text(
                """
                SELECT epoch FROM professional_vertical_runtime_epoch
                WHERE vertical_slug = :vertical_slug
                """
            ),
            {"vertical_slug": vertical_slug},
        )
        epoch_row = epoch_result.mappings().one_or_none()
        if epoch_row is not None:
            runtime_epoch = int(epoch_row["epoch"])
    except Exception:
        logger.warning(
            "professional_worlds.get_runtime_config_epoch_failed vertical_slug=%s",
            vertical_slug,
            exc_info=True,
        )
        runtime_epoch = 1

    active_release_id: UUID | None = None
    if user_id is not None:
        try:
            active_release_id = await ProfessionalWorldsPackService(db).resolve_active_release_id(
                user_id, vertical_slug
            )
        except Exception:
            logger.warning(
                "professional_worlds.get_runtime_config_release_failed user_id=%s vertical_slug=%s",
                user_id,
                vertical_slug,
                exc_info=True,
            )
            active_release_id = None

    payload_for_hash = {
        "vertical_slug": vertical_slug,
        "runtime_epoch": runtime_epoch,
        "modules": modules,
        "schemas": schemas,
        "ai_actions": ai_actions,
        "photo_presets": photo_presets,
        "integrations": integrations,
        "playbooks": playbooks,
        "active_release_id": str(active_release_id) if active_release_id else None,
    }
    return {
        "vertical_slug": vertical_slug,
        "modules": modules,
        "schemas": schemas,
        "ai_actions": ai_actions,
        "photo_presets": photo_presets,
        "integrations": integrations,
        "playbooks": playbooks,
        "config_version_hash": runtime_config_hash_blob(payload_for_hash),
        "runtime_epoch": runtime_epoch,
        "active_release_id": active_release_id,
    }


async def list_user_vertical_activations(db: AsyncSession, user_id: UUID) -> list[dict[str, Any]]:
    """List active Professional Worlds verticals for a user."""
    try:
        result = await db.execute(
            text(
                """
                SELECT vertical_slug, is_active, onboarding, entitlements, updated_at
                FROM professional_user_vertical_activations
                WHERE user_id = :uid AND is_active = true
                ORDER BY vertical_slug
                """
            ),
            {"uid": user_id},
        )
        rows = _rows(list(result.mappings().all()))
        if rows:
            return rows
    except Exception:
        logger.warning(
            "professional_worlds.list_user_vertical_activations_failed user_id=%s; using realtor fallback",
            user_id,
            exc_info=True,
        )
    logger.info(
        "[STEP] professional_worlds.realtor_fallback user_id=%s reason=no_active_vertical_activations",
        user_id,
    )
    return [
        {
            "vertical_slug": REALTOR_VERTICAL_SLUG,
            "is_active": True,
            "onboarding": {},
            "entitlements": {},
        }
    ]


async def upsert_user_vertical_activation(
    db: AsyncSession, user_id: UUID, vertical_slug: str, *, is_active: bool
) -> dict[str, Any]:
    """Activate or deactivate a vertical for the current user."""
    result = await db.execute(
        text(
            """
            INSERT INTO professional_user_vertical_activations (user_id, vertical_slug, is_active)
            VALUES (:uid, :v, :active)
            ON CONFLICT (user_id, vertical_slug)
            DO UPDATE SET is_active = EXCLUDED.is_active, updated_at = now()
            RETURNING vertical_slug, is_active, onboarding, entitlements, updated_at
            """
        ),
        {"uid": user_id, "v": vertical_slug, "active": is_active},
    )
    await db.commit()
    return _row(result.mappings().one()) or {}


async def patch_user_vertical_onboarding(
    db: AsyncSession, user_id: UUID, vertical_slug: str, onboarding: Mapping[str, Any]
) -> dict[str, Any]:
    """Patch onboarding JSON for a user's vertical activation."""
    result = await db.execute(
        text(
            """
            INSERT INTO professional_user_vertical_activations (user_id, vertical_slug, onboarding)
            VALUES (:uid, :v, CAST(:ob AS jsonb))
            ON CONFLICT (user_id, vertical_slug)
            DO UPDATE SET onboarding = EXCLUDED.onboarding, updated_at = now()
            RETURNING vertical_slug, is_active, onboarding, entitlements, updated_at
            """
        ),
        {"uid": user_id, "v": vertical_slug, "ob": _json(dict(onboarding))},
    )
    await db.commit()
    return _row(result.mappings().one()) or {}


async def list_runtime_configs_for_user(db: AsyncSession, user_id: UUID) -> list[dict[str, Any]]:
    """Return runtime config for every active user vertical."""
    activations = await list_user_vertical_activations(db, user_id)
    if not activations:
        return []
    configs = await asyncio.gather(
        *[get_runtime_config(db, str(row["vertical_slug"]), user_id=user_id) for row in activations]
    )
    return list(configs)
