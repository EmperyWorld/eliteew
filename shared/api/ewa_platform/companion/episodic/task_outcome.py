# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pure helpers for HCM episodic ``kind=task_outcome`` — compact bodies + dedupe keys
# so completed companion/agentic work is recallable across chat and missions.
# Invariants:
# - Body is user-facing prose only (no research_plan scaffold / channel tags).
# - Dedupe key is stable per ``source:run_id:status`` so mirror re-sync does not duplicate.
# Related:
# - api/ewa_platform/companion/episodic/writer.py
# - documentation/product/ewa/EWA-COMPANION-HCM-MEMORY.md
# ---

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

TASK_OUTCOME_KIND = "task_outcome"
TASK_OUTCOME_SOURCE_AGENTIC = "agentic"
TASK_OUTCOME_SOURCE_COMPANION_TASK = "companion_task"
TASK_OUTCOME_SOURCE_CHAT_TOOL = "chat_tool"
TASK_OUTCOME_MAX_BODY_CHARS = 2000
TASK_OUTCOME_MAX_ARTIFACTS = 3

_ALLOWED_SOURCES = frozenset(
    {
        TASK_OUTCOME_SOURCE_AGENTIC,
        TASK_OUTCOME_SOURCE_COMPANION_TASK,
        TASK_OUTCOME_SOURCE_CHAT_TOOL,
    }
)


def task_outcome_dedupe_key(*, source: str, run_id: str, status: str) -> str:
    src = str(source or "").strip()[:64] or TASK_OUTCOME_SOURCE_COMPANION_TASK
    rid = str(run_id or "").strip()[:128]
    st = str(status or "").strip().lower()[:64] or "unknown"
    return f"{src}:{rid}:{st}"


def normalize_task_outcome_source(source: str) -> str:
    raw = str(source or "").strip()[:64]
    if raw in _ALLOWED_SOURCES:
        return raw
    return TASK_OUTCOME_SOURCE_COMPANION_TASK


def _clip(text: str, limit: int) -> str:
    t = " ".join(str(text or "").split()).strip()
    if len(t) <= limit:
        return t
    return t[: max(0, limit - 1)].rstrip() + "…"


def build_task_outcome_body(
    *,
    goal: str,
    status: str,
    outcome: str = "",
    artifacts: Sequence[str] | None = None,
    mode: str = "",
) -> str:
    """Compact multi-line episode body for prompt/vector recall."""

    st = str(status or "").strip().lower() or "unknown"
    goal_line = _clip(goal, 720) or "(goal unspecified)"
    outcome_line = _clip(outcome, 720)
    mode_line = _clip(mode, 80)
    arts = [_clip(a, 160) for a in (artifacts or []) if str(a or "").strip()]
    arts = [a for a in arts if a][:TASK_OUTCOME_MAX_ARTIFACTS]

    parts: list[str] = [f"Task ({st}): {goal_line}"]
    if mode_line:
        parts.append(f"Mode: {mode_line}")
    if outcome_line:
        parts.append(f"Outcome: {outcome_line}")
    if arts:
        parts.append("Artifacts: " + "; ".join(arts))
    body = "\n".join(parts)
    if len(body) <= TASK_OUTCOME_MAX_BODY_CHARS:
        return body
    return body[: TASK_OUTCOME_MAX_BODY_CHARS - 1].rstrip() + "…"


def artifacts_from_created_documents(docs: Sequence[Mapping[str, Any]] | None) -> list[str]:
    out: list[str] = []
    for item in docs or []:
        if not isinstance(item, Mapping):
            continue
        name = str(item.get("name") or item.get("title") or "").strip()
        if not name:
            cid = str(item.get("unified_content_id") or item.get("content_id") or "").strip()
            name = cid[:36] if cid else ""
        if name:
            out.append(name)
        if len(out) >= TASK_OUTCOME_MAX_ARTIFACTS:
            break
    return out


def goal_from_task_run(run: Mapping[str, Any]) -> str:
    msg = str(run.get("user_message") or "").strip()
    if msg and not msg.lstrip().startswith("##"):
        return msg
    plan = run.get("plan_payload")
    if isinstance(plan, Mapping):
        for key in ("goal_text", "plan_summary", "mission_answer_summary", "primary_result"):
            val = str(plan.get(key) or "").strip()
            if val and not val.lstrip().startswith("##"):
                return val
    return msg if msg else ""


def outcome_from_task_run(run: Mapping[str, Any]) -> str:
    plan_raw = run.get("plan_payload")
    result_raw = run.get("result_payload")
    plan: Mapping[str, Any] = plan_raw if isinstance(plan_raw, Mapping) else {}
    result: Mapping[str, Any] = result_raw if isinstance(result_raw, Mapping) else {}
    for bag in (plan, result):
        for key in (
            "mission_answer_summary",
            "primary_result",
            "summary",
            "reply",
            "track_name",
        ):
            val = str(bag.get(key) or "").strip()
            if val and not val.lstrip().startswith("##"):
                return val
    err = run.get("error_payload")
    if isinstance(err, Mapping):
        reason = str(err.get("reason") or err.get("message") or "").strip()
        if reason:
            return reason
    return ""


def artifacts_from_task_run(run: Mapping[str, Any]) -> list[str]:
    plan_raw = run.get("plan_payload")
    plan: Mapping[str, Any] = plan_raw if isinstance(plan_raw, Mapping) else {}
    docs = plan.get("created_documents")
    if isinstance(docs, list):
        found = artifacts_from_created_documents(docs)
        if found:
            return found
    result_raw = run.get("result_payload")
    result: Mapping[str, Any] = result_raw if isinstance(result_raw, Mapping) else {}
    for key in ("track_name", "name", "filename"):
        val = str(result.get(key) or "").strip()
        if val:
            return [val]
    cid = str(result.get("unified_content_id") or result.get("content_id") or "").strip()
    return [cid[:36]] if cid else []


__all__ = (
    "TASK_OUTCOME_KIND",
    "TASK_OUTCOME_MAX_ARTIFACTS",
    "TASK_OUTCOME_MAX_BODY_CHARS",
    "TASK_OUTCOME_SOURCE_AGENTIC",
    "TASK_OUTCOME_SOURCE_CHAT_TOOL",
    "TASK_OUTCOME_SOURCE_COMPANION_TASK",
    "artifacts_from_created_documents",
    "artifacts_from_task_run",
    "build_task_outcome_body",
    "goal_from_task_run",
    "normalize_task_outcome_source",
    "outcome_from_task_run",
    "task_outcome_dedupe_key",
)
