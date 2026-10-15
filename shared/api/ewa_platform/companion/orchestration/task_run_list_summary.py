# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Trim companion task-run list rows for Operations summary polling — drop heavy blobs the SPA
# does not need until detail/SSE refresh while preserving status, progress, and artifact refs.
# Invariants:
# - Detail GET and per-run SSE remain full-fidelity; list_profile=summary applies only to list.
# - plan_summary text is capped; surface_blocks omitted (re-derived on detail).
# Related:
# - api/ewa_platform/gateways/routers/companion_chat.py
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

_SUMMARY_PLAN_KEYS: frozenset[str] = frozenset(
    {
        "kind",
        "agentic_session_id",
        "session_status",
        "mission_display_state",
        "mission_answer_summary",
        "primary_result",
        "recommended_next_action",
        "plan_summary",
        "goal",
        "created_documents",
        "theme_preview",
        "prompt_preview",
        "workflow_parent_run_id",
        "music_pipeline_progress",
        "gate",
        "image_tool_mode",
        "operation_mode",
    }
)

_SUMMARY_RESULT_KEYS: frozenset[str] = frozenset(
    {
        "unified_content_id",
        "content_id",
        "track_name",
        "name",
        "thumbnail_url",
        "mime_type",
        "prompt_preview",
        "ewrp_job_id",
        "job_id",
        "image_tool_mode",
        "operation_mode",
        "source_unified_content_id",
        "source_content_id",
        "content_missing",
        "content_unavailable",
    }
)

_SUMMARY_CONFIRMATION_KEYS: frozenset[str] = frozenset(
    {
        "kind",
        "state",
        "prompt",
        "title",
        "message",
        "decision_required",
        "gate_kind",
        "gate",
    }
)

_SUMMARY_ERROR_KEYS: frozenset[str] = frozenset(
    {
        "code",
        "message",
        "detail",
        "user_message",
    }
)

_MAX_PLAN_SUMMARY_CHARS = 480


def _pick_keys(payload: Mapping[str, Any], allowed: frozenset[str]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key in allowed:
        if key not in payload:
            continue
        value = payload[key]
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        out[key] = value
    return out


def _trim_plan_payload(plan: Mapping[str, Any] | None) -> dict[str, Any]:
    if not plan:
        return {}
    trimmed = _pick_keys(plan, _SUMMARY_PLAN_KEYS)
    summary = trimmed.get("plan_summary")
    if isinstance(summary, str) and len(summary) > _MAX_PLAN_SUMMARY_CHARS:
        trimmed["plan_summary"] = summary[:_MAX_PLAN_SUMMARY_CHARS].rstrip() + "…"
    return trimmed


def trim_task_run_for_list_summary(run: Mapping[str, Any]) -> dict[str, Any]:
    """Return a shallow copy of ``run`` suitable for Operations summary list polling."""

    out = dict(run)
    out["plan_payload"] = _trim_plan_payload(
        run.get("plan_payload") if isinstance(run.get("plan_payload"), Mapping) else None
    )
    result = run.get("result_payload")
    out["result_payload"] = _pick_keys(result, _SUMMARY_RESULT_KEYS) if isinstance(result, Mapping) else {}
    confirmation = run.get("confirmation_state")
    out["confirmation_state"] = (
        _pick_keys(confirmation, _SUMMARY_CONFIRMATION_KEYS) if isinstance(confirmation, Mapping) else {}
    )
    error = run.get("error_payload")
    out["error_payload"] = _pick_keys(error, _SUMMARY_ERROR_KEYS) if isinstance(error, Mapping) else {}
    out["surface_blocks"] = []
    return out


__all__ = ["trim_task_run_for_list_summary"]
