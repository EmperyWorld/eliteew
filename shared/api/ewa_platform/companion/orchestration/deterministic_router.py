# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Pre-LLM deterministic routing kernel for EWA companion turns. Exact intents run server tools or structured
# output-surface branches before the chat LLM / Tool Router / intent planner are allowed to spend tokens.
# Invariants:
# - Only routes high-confidence, already allowlisted server branches; ambiguous requests must fall through to chat.
# - Never calls a model; LLM JSON slot filling remains a later layer for incomplete deterministic intents.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# - api/ewa_platform/companion/orchestration/tool_registry.py
# - documentation/product/ewa/EWA-COMPANION-CHAT-PIPELINE-2026-05.md
# ---
"""Deterministic pre-LLM router for EWA companion turns."""

from __future__ import annotations

import logging
from collections.abc import Mapping
from dataclasses import asdict, dataclass
from typing import Any, Final, Literal

import asyncpg

from api.core.auth import User
from api.ewa_platform.companion.orchestration.branch_line_gates import (
    early_tool_branch_may_probe,
    user_line_may_match_late_file_ops,
)
from api.ewa_platform.companion.orchestration.response import tag_orchestration_branch
from api.ewa_platform.companion.orchestration.tool_registry import ToolContext
from api.ewa_platform.settings.access import ewa_getenv

logger = logging.getLogger(__name__)

DeterministicToolIntent = Literal[
    "file_list",
    "file_open",
    "document_read",
    "document_edit_surface",
    "document_transform_selection",
    "other_tool",
]


@dataclass(frozen=True, slots=True)
class DeterministicRouteResult:
    """Typed envelope for deterministic routes that should not fall into the main chat LLM."""

    route: str
    intent: DeterministicToolIntent
    tool: str
    surface: str


_EXACT_TOOL_BRANCHES: Final[tuple[str, ...]] = (
    "check_task_status",
    "catalog_list",
    "file_rewrite",
    "theme_set",
    "music_xl_base_interactive",
    "music_generation_xl_base",
    "music_generation",
    "image_generation",
    "music_studio_open",
    "file_open",
    "app_open",
)
_EXACT_LATE_BRANCHES: Final[tuple[str, ...]] = (
    "file_create",
    "file_rename",
    "file_delete",
    "doc_insert",
)


def deterministic_router_enabled() -> bool:
    """Feature flag for the pre-LLM exact-intent router; on by default."""

    raw = ewa_getenv("EWA_COMPANION_DETERMINISTIC_ROUTER", "1").strip().lower()
    return raw not in {"0", "false", "no", "off"}


def _looks_cyrillic(text: str) -> bool:
    return any("\u0400" <= ch <= "\u04ff" for ch in str(text or ""))


def _debug(
    *,
    intent: str,
    route: str = "deterministic",
    llm_called: bool = False,
    surface: str = "none",
) -> dict[str, Any]:
    return {
        "route": route,
        "intent": intent,
        "llm_called": llm_called,
        "surface": surface,
    }


def _surface_name(response: Mapping[str, Any] | None) -> str:
    surface = response.get("output_surface") if isinstance(response, Mapping) else None
    if isinstance(surface, Mapping):
        mode = str(surface.get("mode") or "").strip()
        if mode:
            return mode
    return "none"


def classify_deterministic_tool_route(branch_name: str, response: Mapping[str, Any] | None) -> DeterministicRouteResult:
    """Map legacy branch names to the stable typed document/file tool family."""

    surface = _surface_name(response)
    if branch_name == "catalog_list":
        intent: DeterministicToolIntent = "file_list"
    elif branch_name == "file_open" and surface == "document_editor":
        intent = "document_edit_surface"
    elif branch_name == "file_open":
        intent = "file_open"
    elif branch_name == "catalog_discuss":
        intent = "document_read"
    elif branch_name == "doc_insert":
        intent = "document_transform_selection"
    else:
        intent = "other_tool"
    return DeterministicRouteResult(route="deterministic", intent=intent, tool=branch_name, surface=surface)


async def _workflow_surface_response(user_line: str) -> dict[str, Any] | None:
    from api.ewa_platform.companion.workflows.user.user_workflow_builder import answer_workflow_surface_intent

    out = answer_workflow_surface_intent(user_line)
    if out is None:
        return None
    branch = str(out.get("orchestration_branch") or "output_surface").strip() or "output_surface"
    out["routing_debug"] = _debug(intent=branch, surface=_surface_name(out))
    logger.info(
        "[STEP] companion_route_decision route=deterministic intent=%s llm_called=false surface=%s",
        branch,
        _surface_name(out),
    )
    return tag_orchestration_branch(out, branch)


async def _active_operations_response(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    user_line: str,
) -> dict[str, Any] | None:
    from api.ewa_platform.companion.orchestration.active_task_runs_prompt import (
        answer_active_operations_status,
    )

    out = await answer_active_operations_status(pool, principal_id=principal_id, user_line=user_line)
    if out is None:
        return None
    out["routing_debug"] = _debug(intent="active_operations_status", surface=_surface_name(out))
    logger.info(
        "[STEP] companion_route_decision route=deterministic intent=active_operations_status "
        "llm_called=false surface=%s",
        _surface_name(out),
    )
    return tag_orchestration_branch(out, "active_operations_status")


async def _run_exact_tool_branch(
    branch_name: str,
    *,
    user_line: str,
    tool_ctx: ToolContext,
) -> dict[str, Any] | None:
    # Reuse the canonical tool normalizer/recorder rather than inventing a second action path.
    from api.ewa_platform.companion.orchestration.task_orchestrator import _run_tool_branch

    out = await _run_tool_branch(
        branch_name,
        {"user_line": user_line},
        tool_ctx,
        user_line=user_line,
    )
    if out is None or out.get("continue_main_llm"):
        return None
    branch = str(out.get("orchestration_branch") or branch_name).strip() or branch_name
    typed_route = classify_deterministic_tool_route(branch_name, out)
    out["deterministic_route"] = asdict(typed_route)
    out["routing_debug"] = _debug(intent=typed_route.intent, surface=typed_route.surface)
    logger.info(
        "[STEP] companion_route_decision route=deterministic intent=%s tool=%s llm_called=false surface=%s",
        typed_route.intent,
        typed_route.tool,
        typed_route.surface,
    )
    return tag_orchestration_branch(out, branch)


async def maybe_route_deterministic_turn(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    user_line: str,
    shell_norm: Mapping[str, Any] | None,
    content_catalog_user_id: str | None,
    oauth2_sub_for_content_alternate: str | None,
    bearer_token: str | None,
    auth_user: User | None,
    profile: Mapping[str, Any] | None,
    blocked_branches: frozenset[str] | None = None,
) -> dict[str, Any] | None:
    """Return an exact deterministic response, or ``None`` when the turn belongs to LLM chat."""

    if not deterministic_router_enabled():
        return None
    line = str(user_line or "").strip()
    if not line:
        return None

    blocked = blocked_branches or frozenset()

    surface = await _workflow_surface_response(line)
    if surface is not None:
        return surface

    active = await _active_operations_response(pool, principal_id=principal_id, user_line=line)
    if active is not None:
        return active

    tool_ctx = ToolContext(
        principal_id=principal_id,
        user_line=line,
        content_catalog_user_id=content_catalog_user_id,
        oauth2_sub_for_content_alternate=oauth2_sub_for_content_alternate,
        main_pool=None,
        companion_pool=pool,
        shell_norm=shell_norm,
        bearer_token=bearer_token,
        auth_user=auth_user,
        profile=profile,
    )

    for branch in _EXACT_TOOL_BRANCHES:
        if branch in blocked:
            logger.info(
                "[STEP] companion_deterministic_branch_blocked branch=%s blocked_by=intake_gate",
                branch,
            )
            continue
        if not early_tool_branch_may_probe(branch, line, profile, principal_id=principal_id):
            continue
        out = await _run_exact_tool_branch(branch, user_line=line, tool_ctx=tool_ctx)
        if out is not None:
            return out

    if user_line_may_match_late_file_ops(line):
        for branch in _EXACT_LATE_BRANCHES:
            if branch in blocked:
                logger.info(
                    "[STEP] companion_deterministic_branch_blocked branch=%s blocked_by=intake_gate",
                    branch,
                )
                continue
            out = await _run_exact_tool_branch(branch, user_line=line, tool_ctx=tool_ctx)
            if out is not None:
                return out

    logger.info(
        "[STEP] companion_route_decision route=chat_llm intent=chat_or_ambiguous llm_called=pending surface=none lang=%s",
        "ru" if _looks_cyrillic(line) else "en",
    )
    return None


__all__ = (
    "DeterministicRouteResult",
    "classify_deterministic_tool_route",
    "deterministic_router_enabled",
    "maybe_route_deterministic_turn",
)
