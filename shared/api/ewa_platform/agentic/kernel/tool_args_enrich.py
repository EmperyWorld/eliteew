# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Inject missing tool_args from session goal, node instruction, expert research, and driver snapshot
# before L3 validation.
# Invariants:
# - Only enriches tools registered in CORE_TOOL_ARG_MODELS that require user_line.
# - file_create prefers node instruction over bare goal; prepends expert research only when
#   deliverable classify resolves inject (SoT here — Think continue/act cannot veto).
# - document_extractor may inherit unified_content_id from policy / driver / last_catalog_hits.
# - call_expert_chat may inherit the same id so post-create expert turns stay document-grounded.
# Related:
# - api/ewa_platform/agentic/kernel/engine.py
# - api/ewa_platform/agentic/kernel/loop.py
# - api/ewa_platform/agentic/kernel/deliverable_classify.py
# - api/ewa_platform/agentic/policy_content_bind.py
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from pydantic import ValidationError

from api.ewa_platform.agentic.goal_json import goal_text_from_goal_json
from api.ewa_platform.agentic.kernel.deliverable_classify import resolve_use_expert_research
from api.ewa_platform.agentic.schemas.tool_args import CORE_TOOL_ARG_MODELS
from api.ewa_platform.settings.access import ewa_getenv_int

_CONTENT_SOURCE_KEYS = ("unified_content_id", "document_id", "paperless_id", "file_base64")

_USER_LINE_MAX = 8000
_FILE_CREATE_USER_LINE_HARD_MAX = 64_000
_RESEARCH_CONTEXT_MAX = 48_000
_FILE_COMPOSE_TOOLS = frozenset({"file_create", "file_save_text"})


def _tool_requires_user_line(tool_name: str) -> bool:
    model = CORE_TOOL_ARG_MODELS.get(str(tool_name or "").strip())
    if model is None or "user_line" not in model.model_fields:
        return False
    try:
        model.model_validate({"user_line": ""})
    except ValidationError:
        return True
    return False


def _user_line_max_for_tool(tool_name: str) -> int:
    if tool_name != "file_create":
        return _USER_LINE_MAX
    return max(
        _USER_LINE_MAX,
        min(
            ewa_getenv_int("EWA_COMPANION_DOC_CREATE_CONTEXT_MAX_CHARS", default=48_000),
            _FILE_CREATE_USER_LINE_HARD_MAX,
        ),
    )


def _pick_user_line_fallback(*, user_line: str, node_instruction: str | None, max_chars: int) -> str:
    """Prefer richer node instruction over session goal when both exist."""

    goal = str(user_line or "").strip()
    instruction = str(node_instruction or "").strip()
    if instruction and goal:
        if instruction == goal:
            return instruction[:max_chars]
        # Instruction-first: plan node text is the per-file brief; goal is mission context.
        if len(instruction) >= len(goal) or instruction not in goal:
            merged = f"{instruction}\n\nMission context:\n{goal}"
            return merged[:max_chars]
        return goal[:max_chars]
    for candidate in (instruction, goal):
        if candidate:
            return candidate[:max_chars]
    return ""


def expert_research_text_from_session(session: Mapping[str, Any] | None) -> str:
    """Return latest expert ensemble markdown stored in working_memory_json."""

    if not isinstance(session, Mapping):
        return ""
    wm = session.get("working_memory_json")
    if not isinstance(wm, Mapping):
        return ""
    for key in ("last_expert_research_text", "expert_research_text"):
        text = str(wm.get(key) or "").strip()
        if text:
            return text[:_RESEARCH_CONTEXT_MAX]
    return ""


def _truthy_use_expert_research(args: Mapping[str, Any]) -> bool:
    if "use_expert_research" not in args:
        return False
    val = args.get("use_expert_research")
    if isinstance(val, bool):
        return val
    text = str(val or "").strip().lower()
    if text in {"0", "false", "no", "off", ""}:
        return False
    return text in {"1", "true", "yes", "on"} or bool(val)


def _with_research_context(
    user_line: str,
    session: Mapping[str, Any] | None,
    *,
    enabled: bool,
    max_chars: int,
) -> str:
    base = str(user_line or "").strip()
    if not enabled:
        return base[:max_chars]
    research = expert_research_text_from_session(session)
    if not research:
        return base[:max_chars]
    if not base:
        return f"Research context:\n{research}"[:max_chars]
    if research[:200] in base:
        return base[:max_chars]
    # The document request is authoritative and must survive clipping. Research uses only
    # the remaining budget so a large expert response cannot erase the deliverable brief.
    return f"Document request:\n{base}\n\nResearch context:\n{research}"[:max_chars]


def _has_content_source(args: Mapping[str, Any]) -> bool:
    return any(str(args.get(key) or "").strip() for key in _CONTENT_SOURCE_KEYS)


def catalog_hits_from_session(session: Mapping[str, Any] | None) -> list[dict[str, str]]:
    """Return compact catalog hits stored after a successful catalog_list act."""

    if not isinstance(session, Mapping):
        return []
    wm = session.get("working_memory_json")
    if not isinstance(wm, Mapping):
        return []
    raw = wm.get("last_catalog_hits")
    if not isinstance(raw, list):
        return []
    out: list[dict[str, str]] = []
    for item in raw[:10]:
        if not isinstance(item, Mapping):
            continue
        uid = str(item.get("unified_content_id") or item.get("id") or "").strip()
        if not uid:
            continue
        out.append(
            {
                "unified_content_id": uid,
                "name": str(item.get("name") or "").strip()[:200],
            }
        )
    return out


def unified_content_id_from_session(session: Mapping[str, Any] | None) -> str | None:
    if not isinstance(session, Mapping):
        return None
    policy = session.get("policy_json")
    if isinstance(policy, Mapping):
        uid = str(policy.get("unified_content_id") or policy.get("target_content_id") or "").strip()
        if uid:
            return uid
    wm = session.get("working_memory_json")
    if isinstance(wm, Mapping):
        driver = wm.get("driver_snapshot")
        if isinstance(driver, Mapping):
            uid = str(driver.get("unified_content_id") or "").strip()
            if uid:
                return uid
    hits = catalog_hits_from_session(session)
    if hits:
        return hits[0]["unified_content_id"]
    return None


def enrich_tool_args(
    tool_name: str,
    raw: Mapping[str, Any] | None,
    *,
    user_line: str,
    node_instruction: str | None = None,
    session: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Return tool_args with user_line filled when the L3 model requires it."""

    name = str(tool_name or "").strip()
    args = dict(raw or {})
    if name == "file_create":
        # Cause-layer SoT: every enrich path (plan prepare, Think continue, act validate)
        # re-resolves inject. Think use_expert_research=false cannot skip research docs.
        has_expert = bool(expert_research_text_from_session(session))
        resolved_line = str(args.get("user_line") or user_line or "").strip()
        args["use_expert_research"] = resolve_use_expert_research(
            args,
            title="",
            instruction=str(node_instruction or ""),
            name=str(args.get("name") or ""),
            user_line=resolved_line,
            has_expert_research=has_expert,
        )
    if name and _tool_requires_user_line(name):
        max_chars = _user_line_max_for_tool(name)
        existing = str(args.get("user_line") or "").strip()
        filled = existing or _pick_user_line_fallback(
            user_line=user_line,
            node_instruction=node_instruction,
            max_chars=max_chars,
        )
        if name in _FILE_COMPOSE_TOOLS:
            filled = _with_research_context(
                filled,
                session,
                enabled=_truthy_use_expert_research(args),
                max_chars=max_chars,
            )
        if filled:
            args["user_line"] = filled[:max_chars]
    if name == "catalog_list":
        mode = str(args.get("mode") or "").strip().lower()
        has_query = bool(str(args.get("file_query") or args.get("query") or args.get("keyword") or "").strip())
        if mode in {"", "search"} and not has_query:
            args["mode"] = "browse"
    if name == "document_extractor" and not _has_content_source(args):
        uid = unified_content_id_from_session(session)
        if uid:
            args["unified_content_id"] = uid
    if name == "call_expert_chat" and not str(args.get("unified_content_id") or "").strip():
        uid = unified_content_id_from_session(session)
        if uid:
            args["unified_content_id"] = uid
    if name == "call_expert_chat":
        from api.services.desktop_chat_ensemble.intent_signals import goal_requires_internet

        goal = goal_text_from_session(session) if isinstance(session, Mapping) else ""
        goal = goal or str(user_line or "").strip()
        if goal_requires_internet(goal):
            args["use_web_search"] = True
    return args


def goal_text_from_session(session: Mapping[str, Any]) -> str:
    goal = session.get("goal_json")
    if isinstance(goal, Mapping):
        return goal_text_from_goal_json(goal)
    return ""


__all__ = (
    "catalog_hits_from_session",
    "enrich_tool_args",
    "expert_research_text_from_session",
    "goal_text_from_session",
    "unified_content_id_from_session",
)
