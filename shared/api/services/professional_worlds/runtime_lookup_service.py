# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Runtime lookups for Professional Worlds AI actions, photo presets, and prompt template rendering.
# Invariants:
# - Only active rows (is_active=true) are returned.
# Related:
# - api/services/professional_worlds/service.py
# - api/services/professional_worlds/ai_actions.py
# ---

from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any

from sqlalchemy import text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]


def _row(row: Mapping[str, Any] | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


async def get_ai_action(db: AsyncSession, vertical_slug: str, action_key: str) -> dict[str, Any] | None:
    """Resolve an active AI action for runtime use."""
    result = await db.execute(
        text(
            """
            SELECT id, vertical_slug, module_key, action_key, display_name, description, ugs_type_key,
                   workflow_slug, prompt_template, input_schema, output_schema, safety_rules,
                   artifact_kind, billing_hint, is_active, sort_order, created_at, updated_at
            FROM professional_ai_actions
            WHERE vertical_slug = :vertical_slug AND action_key = :action_key AND is_active = true
            """
        ),
        {"vertical_slug": vertical_slug, "action_key": action_key},
    )
    return _row(result.mappings().one_or_none())


async def get_photo_preset(db: AsyncSession, vertical_slug: str, preset_key: str) -> dict[str, Any] | None:
    """Resolve active photo preset."""
    result = await db.execute(
        text(
            """
            SELECT id, vertical_slug, preset_key, display_name, description, category, action_type,
                   ugs_type_key, prompt_template, parameters, is_active, sort_order, created_at, updated_at
            FROM professional_photo_presets
            WHERE vertical_slug = :vertical_slug AND preset_key = :preset_key AND is_active = true
            """
        ),
        {"vertical_slug": vertical_slug, "preset_key": preset_key},
    )
    return _row(result.mappings().one_or_none())


def render_ai_action_prompt(template: str, variables: Mapping[str, Any]) -> str:
    """Render a small safe prompt template with JSON variables."""
    prompt = template
    for key, value in variables.items():
        replacement = json.dumps(value, ensure_ascii=False, default=str) if not isinstance(value, str) else value
        prompt = prompt.replace("{{" + key + "}}", replacement)
    return prompt
