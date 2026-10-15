# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Validate and normalize mutate-plan tool_args before task-tree insert (executable plan gate).
# Invariants:
# - L3 registry models must pass before a tool node is persisted.
# - Generative file_create names normalize to .md (not .txt); process prefixes stripped.
# - document_extractor may defer content id when the same plan already has catalog_list.
# - Multi-doc missions (≥2 file_create) opt into create_folder + shared folder_name (F3).
# Related:
# - api/ewa_platform/agentic/kernel/engine.py
# - api/ewa_platform/agentic/kernel/loop.py
# - api/ewa_platform/agentic/kernel/deliverable_classify.py
# ---

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from typing import Any, Literal

from api.ewa_platform.agentic.kernel.deliverable_classify import (
    normalize_agentic_doc_filename,
    resolve_use_expert_research,
)
from api.ewa_platform.agentic.kernel.research_plan_contract import goal_looks_like_research
from api.ewa_platform.agentic.kernel.tool_args_enrich import (
    enrich_tool_args,
    goal_text_from_session,
)
from api.ewa_platform.agentic.kernel.tool_args_validate import validate_tool_args_for_registry
from api.ewa_platform.agentic.orchestration.expert_chat_bridge import DEFAULT_AGENTIC_EXPERT_HEROES
from api.ewa_platform.companion.orchestration.tools.registry_core import REGISTRY

_FILE_NAME_TOOLS = frozenset({"file_create", "file_save_text", "file_delete", "file_open"})
_CONTENT_SOURCE_KEYS = ("unified_content_id", "document_id", "paperless_id", "file_base64")
_TOOLS_NEED_CONTENT_SOURCE = frozenset({"document_extractor"})
_TOOLS_NEED_RUNTIME_TEXT = frozenset({"llm_summarize"})
_TOOLS_NEED_EXPLICIT_BODY = frozenset({"file_save_text"})

MissionFolderRole = Literal["create", "reuse"]

_QUOTED_FILENAME_RE = re.compile(
    r"""['"]([^'"]{1,240}\.(?:txt|md|docx?|pdf|json|csv))['"]""",
    re.IGNORECASE,
)
_NAMED_FILENAME_RE = re.compile(
    r"(?i)(?:названием|именем|filename|file\s*name|named)\s+['\"]?([^\s'\",;]+\.(?:txt|md|docx?|pdf))",
)
_BARE_FILENAME_RE = re.compile(
    r"([\wА-Яа-яЁё][\wА-Яа-яЁё._\-]{0,200}\.(?:txt|md|docx?|pdf))",
    re.IGNORECASE,
)


class PlanToolArgsError(ValueError):
    """Raised when a mutate-plan tool node cannot be made executable."""


def infer_file_name_from_text(*texts: str | None) -> str | None:
    """Best-effort filename extraction from plan node title/instruction."""

    blob = " ".join(str(t or "").strip() for t in texts if str(t or "").strip())
    if not blob:
        return None
    for pattern in (_QUOTED_FILENAME_RE, _NAMED_FILENAME_RE, _BARE_FILENAME_RE):
        match = pattern.search(blob)
        if match:
            name = str(match.group(1)).strip()
            if name:
                return name[:512]
    return None


def _slug_filename_from_title(title: str) -> str | None:
    text = str(title or "").strip()
    if not text:
        return None
    slug = re.sub(r"[^\wА-Яа-яЁё]+", "_", text, flags=re.UNICODE).strip("_")
    if not slug:
        return None
    return normalize_agentic_doc_filename(f"{slug[:200]}.md")


def _has_content_source(args: Mapping[str, Any]) -> bool:
    return any(str(args.get(key) or "").strip() for key in _CONTENT_SOURCE_KEYS)


def _has_runtime_text(args: Mapping[str, Any]) -> bool:
    return any(str(args.get(key) or "").strip() for key in ("text", "body", "reply", "prompt"))


def _has_explicit_folder_intent(args: Mapping[str, Any]) -> bool:
    if args.get("create_folder") is True or args.get("reuse_folder") is True:
        return True
    return any(str(args.get(key) or "").strip() for key in ("folder_name", "folder_item_id", "folder_label"))


def _mission_folder_name(*, user_line: str, title: str) -> str:
    seed = str(user_line or "").strip() or str(title or "").strip() or "Mission_deliverables"
    slug = re.sub(r"[^\wА-Яа-яЁё]+", "_", seed, flags=re.UNICODE).strip("_")
    if not slug:
        slug = "Mission_deliverables"
    return slug[:80]


def prepare_plan_node_tool_args(
    tool_name: str,
    tool_args: Mapping[str, Any] | None,
    *,
    user_line: str,
    instruction: str = "",
    title: str = "",
    session: Mapping[str, Any] | None = None,
    plan_has_preceding_catalog_list: bool = False,
    mission_folder_role: MissionFolderRole | None = None,
) -> dict[str, Any]:
    """Enrich, infer missing fields, and validate tool_args for task-tree insert."""

    name = str(tool_name or "").strip()
    if not name:
        raise PlanToolArgsError("plan node tool_name is empty")
    if name not in REGISTRY:
        raise PlanToolArgsError(f"tool {name!r} is not registered")

    raw_in = dict(tool_args or {})
    # Always re-resolve before enrich: classify is SoT (Think cannot veto research inject).
    if name == "file_create":
        from api.ewa_platform.agentic.kernel.tool_args_enrich import expert_research_text_from_session

        has_expert = bool(expert_research_text_from_session(session))
        raw_in["use_expert_research"] = resolve_use_expert_research(
            raw_in,
            title=title,
            instruction=instruction,
            name=str(raw_in.get("name") or ""),
            user_line=str(raw_in.get("user_line") or user_line),
            has_expert_research=has_expert,
        )

    args = enrich_tool_args(
        name,
        raw_in,
        user_line=user_line,
        node_instruction=instruction,
        session=session,
    )

    if name in _FILE_NAME_TOOLS and not str(args.get("name") or "").strip():
        # Prefer quoted deliverable from instruction over process title slug.
        inferred = infer_file_name_from_text(instruction, user_line, title)
        if not inferred:
            inferred = _slug_filename_from_title(title)
        if inferred:
            args["name"] = inferred

    if name == "file_create" and str(args.get("name") or "").strip():
        args["name"] = normalize_agentic_doc_filename(str(args["name"]))

    # Single-file creates stay in EwaFile root unless tool_args already name a folder.
    # Multi-doc missions share one mission folder (first create, later reuse).
    if name == "file_create" and mission_folder_role and not _has_explicit_folder_intent(args):
        folder_name = _mission_folder_name(user_line=user_line, title=title)
        args["folder_name"] = folder_name
        if mission_folder_role == "create":
            args["create_folder"] = True
            args.pop("reuse_folder", None)
        else:
            args["reuse_folder"] = True
            args.pop("create_folder", None)

    if name == "call_expert_chat":
        from api.ewa_platform.agentic.kernel.research_plan_contract import (
            resolve_agentic_expert_blueprint_id,
        )
        from api.services.desktop_chat_ensemble.intent_signals import goal_requires_internet

        goal = goal_text_from_session(session) if isinstance(session, Mapping) else ""
        goal = goal or str(user_line or "").strip()
        if goal_looks_like_research(goal):
            args["expert_roles"] = list(DEFAULT_AGENTIC_EXPERT_HEROES)
        if goal_requires_internet(goal):
            args["use_web_search"] = True
        bp = resolve_agentic_expert_blueprint_id(
            goal,
            str(args.get("blueprint_template_id") or "") or None,
        )
        if bp:
            args["blueprint_template_id"] = bp
        else:
            args.pop("blueprint_template_id", None)

    if name in _TOOLS_NEED_CONTENT_SOURCE and not _has_content_source(args):
        if plan_has_preceding_catalog_list:
            # Runtime enrich fills unified_content_id from last_catalog_hits after catalog_list.
            pass
        else:
            raise PlanToolArgsError(
                f"{name} requires unified_content_id (or document_id/paperless_id) at plan time; "
                "use catalog_list first, then continue with the resolved id"
            )

    if name in _TOOLS_NEED_RUNTIME_TEXT and not _has_runtime_text(args):
        source_text = str(args.get("user_line") or instruction or user_line).strip()
        if source_text:
            args["text"] = source_text

    if name in _TOOLS_NEED_EXPLICIT_BODY and not _has_runtime_text(args):
        raise PlanToolArgsError(
            f"{name} requires non-empty body (or text) at plan time; "
            "use file_create when the agent should compose document content"
        )

    return validate_tool_args_for_registry(
        name,
        args,
        user_line=user_line,
        node_instruction=instruction,
        session=session,
    )


def plan_nodes_have_preceding_catalog_list(
    nodes: Sequence[Any],
    *,
    current_index: int,
) -> bool:
    """True when an earlier plan node is catalog_list (same mutate batch)."""

    for idx, node in enumerate(nodes):
        if idx >= current_index:
            break
        tool = str(getattr(node, "tool_name", None) or "").strip()
        if not tool and isinstance(node, Mapping):
            tool = str(node.get("tool_name") or "").strip()
        if tool == "catalog_list":
            return True
    return False


__all__ = (
    "PlanToolArgsError",
    "infer_file_name_from_text",
    "plan_nodes_have_preceding_catalog_list",
    "prepare_plan_node_tool_args",
)
