# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Load KBSEW admin defaults and resolve per-surface prefetch blocks for AI consumers.
# Invariants:
# - Reads desktop_ai_chat_config.defaults.kbsew_search_settings only; no secrets.
# Related:
# - api/services/kbsew/kbsew_prefetch.py
# - api/services/desktop_chat/kbsew_search_settings.py
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from api.services.kbsew.kbsew_prefetch import prefetch_kbsew_outcome

logger = logging.getLogger(__name__)


async def fetch_kbsew_admin_defaults(db: Any) -> dict[str, Any]:
    from api.services.desktop_chat.service import fetch_config_defaults

    return await fetch_config_defaults(db)


async def resolve_kbsew_context_for_surface(
    *,
    agent_id: str,
    query: str,
    db: Any | None,
    defaults: Mapping[str, Any] | None = None,
    chat_settings: Mapping[str, Any] | None = None,
    max_total_chars: int = 4200,
) -> str:
    """Return KBSEW prompt block for *agent_id* when admin enabled it, else empty string."""

    q = (query or "").strip()
    if not q:
        return ""
    try:
        resolved_defaults = dict(defaults) if defaults is not None else None
        if resolved_defaults is None:
            if db is None:
                return ""
            resolved_defaults = await fetch_kbsew_admin_defaults(db)
        outcome = await prefetch_kbsew_outcome(
            query=q,
            agent_id=agent_id,
            defaults=resolved_defaults,
            chat_settings=chat_settings,
            max_total_chars=max_total_chars,
        )
        block = (outcome.block or "").strip()
        return block
    except Exception as exc:
        logger.debug("[STEP] kbsew_surface_context_skip agent=%s reason=%s", agent_id, exc)
        return ""


def merge_kbsew_into_prompt(*, prompt: str, kbsew_block: str, section_title: str) -> str:
    block = (kbsew_block or "").strip()
    if not block:
        return prompt
    title = section_title.strip()
    return f"{prompt.rstrip()}\n\n{title}\n{block}"
