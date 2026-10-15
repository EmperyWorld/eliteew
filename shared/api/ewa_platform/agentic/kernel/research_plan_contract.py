# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Detect research-style agentic goals and enforce expert-first empty-tree mutate plans
# when call_expert_chat is allowlisted. Mid-mission replan skips partner/multi expand
# after enough successful file_create acts (anti tree-explosion).
# Invariants:
# - Contract applies only when tree is empty and call_expert_chat is available.
# - For research goals with file_create/file_save_text, an expert node must appear
#   before every file node (presence alone is not enough).
# - file_create-only plans for research goals are rejected (not silently rewritten).
# Related:
# - api/ewa_platform/agentic/kernel/engine.py
# ---

from __future__ import annotations

import re
from collections.abc import Iterable, Mapping, Sequence
from typing import Any

from api.services.desktop_chat_ensemble.intent_signals import (
    goal_looks_like_multi_deliverable,
    goal_looks_like_partner_feedback,
    goal_requires_internet,
)

_RESEARCH_GOAL_RE = re.compile(
    r"(?is)"
    r"(?:исследован|research|анализ|analysis|эксперт|expert|"
    r"desktop\s*chat|ai[_\s-]?chat|ensemble|"
    r"два\s+документ|dual[_\s-]?doc|нескольк\w*\s+документ|"
    r"тезисн|roadmap|презентац|brief|синтез|synthesis|"
    r"изучи|разбери|проведи\s+анализ)"
)

_STUDY_FOLDER_RE = re.compile(
    r"(?is)"
    r"(?:изучи|разбери|прочитай|просмотри).{0,80}"
    r"(?:в\s+папк|в\s+каталог|folder|catalog|ewafile)|"
    r"(?:в\s+папк\w*|в\s+каталог\w*).{0,40}"
    r"(?:платформ\w*\s*eliteew|eliteew)"
)

_MAX_MID_MISSION_REPLANS = 2
# Partner / multi-deliverable expand only while fewer than this many successful file_create acts.
_MIN_FILE_CREATES_TO_SKIP_EXPAND = 2


def _completed_file_create_count(working_memory: Mapping[str, Any] | None) -> int:
    wm = working_memory if isinstance(working_memory, Mapping) else {}
    raw = wm.get("completed_file_create_count")
    try:
        return max(0, int(raw or 0))
    except TypeError, ValueError:
        return 0


def goal_looks_like_research(goal_text: str) -> bool:
    text = str(goal_text or "").strip()
    if not text:
        return False
    # Partner coaching / thesis feedback is not a greenfield market-research mission.
    if goal_looks_like_partner_feedback(text):
        return False
    if _RESEARCH_GOAL_RE.search(text):
        return True
    # Long multi-deliverable goals without explicit research keywords still need experts.
    return len(text) >= 280 and ("документ" in text.lower() or "document" in text.lower())


def resolve_agentic_expert_blueprint_id(
    goal_text: str,
    explicit: str | None = None,
) -> str | None:
    """Blueprint for call_expert_chat — None means do not force research_plan_v1.

    Partner/coaching goals win over an LLM-emitted ``research_plan_v1`` (or any
    explicit id): market-research scaffold must not reopen on dual-doc partner turns.
    """
    if goal_looks_like_partner_feedback(goal_text):
        return None
    forced = str(explicit or "").strip()
    if forced:
        return forced
    if goal_looks_like_research(goal_text):
        return "research_plan_v1"
    return None


def should_offer_mid_mission_replan(
    *,
    goal_text: str,
    working_memory: Mapping[str, Any] | None,
    completed_steps: int,
    completed_file_creates: int | None = None,
) -> tuple[bool, str]:
    """Return (offer, reason) when tree is idle after successful steps but goal may still need work."""
    wm = working_memory if isinstance(working_memory, Mapping) else {}
    rounds = int(wm.get("mid_mission_replan_count") or 0)
    if rounds >= _MAX_MID_MISSION_REPLANS:
        return False, "replan_budget_exhausted"
    if completed_steps < 1:
        return False, "no_completed_steps"
    goal = str(goal_text or "").strip()
    if not goal:
        return False, "empty_goal"
    file_creates = (
        max(0, int(completed_file_creates)) if completed_file_creates is not None else _completed_file_create_count(wm)
    )
    if goal_requires_internet(goal) and not wm.get("last_web_search_ok"):
        return True, "internet_research_without_web"
    if goal_looks_like_partner_feedback(goal) and rounds < 1 and file_creates < _MIN_FILE_CREATES_TO_SKIP_EXPAND:
        # Do not explode the tree after deliverables already landed (lady_boss rewrite churn).
        return True, "partner_feedback_refine"
    if goal_looks_like_multi_deliverable(goal) and rounds < 1:
        if file_creates < _MIN_FILE_CREATES_TO_SKIP_EXPAND:
            return True, "multi_deliverable_expand"
        return False, "multi_deliverable_docs_ready"
    if goal_looks_like_research(goal) and rounds < 1 and completed_steps <= 2:
        return True, "research_post_act_expand"
    return False, "goal_closure_ok"


def plan_nodes_include_expert(nodes: Sequence[Any]) -> bool:
    for node in nodes:
        tool = str(getattr(node, "tool_name", None) or "").strip()
        if not tool and isinstance(node, Mapping):
            tool = str(node.get("tool_name") or "").strip()
            kind = str(node.get("node_kind") or "").strip()
        else:
            kind = str(getattr(node, "node_kind", None) or "").strip()
        if tool == "call_expert_chat" or kind == "expert_chat":
            return True
    return False


def plan_nodes_include_file_create(nodes: Sequence[Any]) -> bool:
    for node in nodes:
        tool = str(getattr(node, "tool_name", None) or "").strip()
        if not tool and isinstance(node, Mapping):
            tool = str(node.get("tool_name") or "").strip()
        if tool in {"file_create", "file_save_text"}:
            return True
    return False


def _node_tool_and_kind(node: Any) -> tuple[str, str]:
    tool = str(getattr(node, "tool_name", None) or "").strip()
    kind = str(getattr(node, "node_kind", None) or "").strip()
    if not tool and isinstance(node, Mapping):
        tool = str(node.get("tool_name") or "").strip()
        kind = str(node.get("node_kind") or "").strip()
    return tool, kind


def plan_expert_precedes_file_creates(nodes: Sequence[Any]) -> bool:
    """True when the first expert node appears before any file_create/file_save_text."""

    first_expert_idx: int | None = None
    first_file_idx: int | None = None
    for idx, node in enumerate(nodes):
        tool, kind = _node_tool_and_kind(node)
        if first_expert_idx is None and (tool == "call_expert_chat" or kind == "expert_chat"):
            first_expert_idx = idx
        if first_file_idx is None and tool in {"file_create", "file_save_text"}:
            first_file_idx = idx
        if first_expert_idx is not None and first_file_idx is not None:
            break
    if first_file_idx is None:
        return True
    if first_expert_idx is None:
        return False
    return first_expert_idx < first_file_idx


def research_empty_tree_requires_expert(
    *,
    goal_text: str,
    allowlist: Iterable[str] | None,
    nodes: Sequence[Any],
) -> str | None:
    """Return error code when empty-tree research plan skips experts, else None."""

    if allowlist is not None and "call_expert_chat" not in set(allowlist):
        return None
    if not goal_looks_like_research(goal_text):
        return None
    if not plan_nodes_include_file_create(nodes):
        return None
    if plan_expert_precedes_file_creates(nodes):
        return None
    return "research_plan_requires_expert_chat_before_file_create"


def goal_looks_like_study_folder(goal_text: str) -> bool:
    """True when the goal asks to study materials already in the catalog/folder."""

    text = str(goal_text or "").strip()
    if not text:
        return False
    return bool(_STUDY_FOLDER_RE.search(text))


def _plan_tool_names(nodes: Sequence[Any]) -> list[str]:
    names: list[str] = []
    for node in nodes:
        tool = str(getattr(node, "tool_name", None) or "").strip()
        if not tool and isinstance(node, Mapping):
            tool = str(node.get("tool_name") or "").strip()
        if tool:
            names.append(tool)
    return names


def study_folder_empty_tree_requires_extract(
    *,
    goal_text: str,
    allowlist: Iterable[str] | None,
    nodes: Sequence[Any],
) -> str | None:
    """Reject catalog_list-only study plans when extract/open tools are allowlisted."""

    if not goal_looks_like_study_folder(goal_text):
        return None
    allowed = set(allowlist) if allowlist is not None else None
    if allowed is not None and "catalog_list" not in allowed:
        return None
    tools = _plan_tool_names(nodes)
    if "catalog_list" not in tools:
        return None
    has_read = any(t in {"document_extractor", "file_open"} for t in tools)
    if has_read:
        return None
    if allowed is not None and not ({"document_extractor", "file_open"} & allowed):
        return None
    return "study_folder_requires_catalog_then_extract"


RESEARCH_THINK_RULE = (
    "14. Research / multi-document missions (critical):\n"
    "   - When the goal asks for research, analysis, experts, dual documents, presentation theses, "
    "or a long multi-deliverable brief AND call_expert_chat is allowlisted: the FIRST executable "
    "mutate MUST include call_expert_chat (node_kind=expert_chat) BEFORE final file_create nodes.\n"
    "   - call_expert_chat tool_args: user_line (research brief); expert_roles MUST be the full "
    "canonical trio likiy_sorrento, arlyqueen, akimbo (never a single hero; never analyst/strategist).\n"
    "   - When the goal asks to search the internet / web: set use_web_search=true on call_expert_chat "
    "(do not pretend web research succeeded from empty RAG alone).\n"
    "   - Partner/feedback coaching (praise, thesis critique, «соавтор») is NOT market research: "
    "do not force a market/report plan; refine the user's thesis without inventing new product lines.\n"
    "   - file_create names: deliverable titles with .md (not .txt, not 'Создание_…' process names).\n"
    "   - After experts succeed, plan file_create nodes that turn research into deliverables. "
    "Do not set use_expert_research=false on research/worldbuilding docs (bible, sheets, "
    "guides, methodology artifacts): runtime classify forces inject after experts. "
    "Personal docs (work rules, intro algorithms) stay without expert bleed.\n"
    "   - After steps complete, if the goal still needs more work (web facts, table, second doc, "
    "feedback refine): emit mutate with NEW plan_nodes (replan) instead of terminate.\n"
    "15. Study-in-folder missions: when the goal says to study materials in a folder/catalog "
    "(e.g. EliteEW), plan catalog_list THEN document_extractor or file_open — list alone is rejected.\n"
    "16. Anti-hallucination: never invent media formats (generative video, AI-avatars, YouTube) "
    "or third-party products unless the goal/brief explicitly names them; mark evidence gaps.\n"
)

__all__ = (
    "RESEARCH_THINK_RULE",
    "goal_looks_like_research",
    "goal_looks_like_study_folder",
    "plan_expert_precedes_file_creates",
    "plan_nodes_include_expert",
    "plan_nodes_include_file_create",
    "research_empty_tree_requires_expert",
    "resolve_agentic_expert_blueprint_id",
    "should_offer_mid_mission_replan",
    "study_folder_empty_tree_requires_extract",
)
