# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Runtime resolver for Professional Worlds AI actions stored in admin configuration.
# Invariants:
# - Prompt templates are resolved server-side only and are never exposed by runtime config endpoints.
# - Action lookup always requires vertical_slug and action_key.
# Related:
# - api/services/professional_worlds/service.py
# - api/routers/professional_worlds.py
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from api.services.professional_worlds.service import ProfessionalWorldsService


class ProfessionalWorldsAiActionService:
    """Small orchestration layer for DB-backed Professional Worlds AI actions."""

    def __init__(self, service: ProfessionalWorldsService) -> None:
        self.service = service

    async def resolve_action(self, vertical_slug: str, action_key: str) -> dict[str, Any] | None:
        """Resolve an active AI action by vertical/action key."""
        return await self.service.get_ai_action(vertical_slug, action_key)

    async def build_prompt(
        self,
        *,
        vertical_slug: str,
        action_key: str,
        variables: Mapping[str, Any],
        fallback_prompt: str | None = None,
    ) -> tuple[dict[str, Any] | None, str]:
        """Build an action prompt from configured template or explicit fallback."""
        action = await self.resolve_action(vertical_slug, action_key)
        template = (action or {}).get("prompt_template") or fallback_prompt or ""
        if template.startswith("runtime:"):
            template = fallback_prompt or template
        return action, self.service.render_ai_action_prompt(template, variables)
