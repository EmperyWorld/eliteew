# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Resolve which read-only probes are allowed for this ensemble turn.
# Invariants:
# - Web requires both request use_web_search and admin tools_web_search_enabled.
# - KBSEW requires admin kbsew_search_settings visible for desktop agent.
# - Chat RAG index may be empty; still allow probe (runner returns empty honestly) unless
#   turn prefetch already reported chat_rag_chunks=0 (see capabilities_without_empty_chat_rag).
# Related:
# - api/services/desktop_chat/kbsew_search_settings.py
# ---
"""Capability snapshot for ensemble actions."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from api.services.desktop_chat.kbsew_search_settings import (
    kbsew_tool_visible_for_agent,
    resolve_kbsew_search_settings,
)
from api.services.desktop_chat_ensemble.actions.types import CapabilitySnapshot


def resolve_action_capabilities(
    *,
    defaults: dict[str, Any],
    use_web_search: bool,
    use_project_rag: bool,
    project_id: UUID | None,
    chat_id: UUID | None,
    chat_settings: dict[str, Any] | None = None,
    kbsew_agent: str = "desktop",
) -> CapabilitySnapshot:
    web = bool(use_web_search) and bool(defaults.get("tools_web_search_enabled", False))
    vault = bool(use_project_rag) and project_id is not None
    # Chat RAG index may be empty; still allow probe (runner returns empty honestly).
    chat_rag = chat_id is not None

    merged_defaults = dict(defaults or {})
    if isinstance(chat_settings, dict) and chat_settings.get("kbsew_search_settings") is not None:
        merged_defaults = {
            **merged_defaults,
            "kbsew_search_settings": chat_settings.get("kbsew_search_settings"),
        }
    kss = resolve_kbsew_search_settings(merged_defaults)
    kbsew = kbsew_tool_visible_for_agent(kss, kbsew_agent)
    barrels = tuple(kss.allowed_barrels) if kbsew else ()

    return CapabilitySnapshot(
        web=web,
        chat_rag=chat_rag,
        project_vault=vault,
        kbsew=kbsew,
        kbsew_barrels=barrels,
        project_id=project_id,
        chat_id=chat_id,
    )
