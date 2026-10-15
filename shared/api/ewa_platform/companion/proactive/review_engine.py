# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Deterministic proactive review for EWA companion: detect gaps/risks/next steps from PG task runs,
# turn_plan queue, shell_context, and profile state — emit ``ProactiveSuggestionV1`` (no LLM).
# Invariants:
# - Suggestions are questions, not past-tense completion claims; templates end with «?».
# - Dedupe via ``companion_proactive_state_v1`` (15 min window per suggestion_id).
# Related:
# - api/ewa_platform/companion/persona/anticipation.py
# - documentation/product/ewa/EWA-COMPANION-PROACTIVE-PROTOCOL.md
# ---

from __future__ import annotations

import hashlib
import logging
from collections.abc import Mapping
from datetime import UTC, datetime, timedelta
from typing import Any

from api.ewa_platform.companion.protocol.config import (
    companion_proactive_review_enabled,
    companion_proactive_review_every_n_turns,
    companion_proactive_review_on_subtask,
)
from api.ewa_platform.schemas.pydantic.companion_execution_report import ProactiveSuggestionV1
from api.ewa_platform.schemas.pydantic.companion_observation import CompanionHintOut

logger = logging.getLogger(__name__)

PROACTIVE_STATE_KEY = "companion_proactive_state_v1"
TURN_PLAN_KEY = "companion_turn_plan_v1"
DEDUPE_MINUTES = 15
STALE_RUN_MINUTES = 45


def load_proactive_state(learned_preferences: Mapping[str, Any] | None) -> dict[str, Any]:
    if not isinstance(learned_preferences, Mapping):
        return {}
    raw = learned_preferences.get(PROACTIVE_STATE_KEY)
    return dict(raw) if isinstance(raw, Mapping) else {}


def profile_from_learned(learned_preferences: Mapping[str, Any] | None) -> dict[str, Any]:
    if not isinstance(learned_preferences, Mapping):
        return {"learned_preferences": {}}
    return {"learned_preferences": dict(learned_preferences)}


def proactive_state_key() -> str:
    return PROACTIVE_STATE_KEY


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _suggestion_id(kind: str, ref: str) -> str:
    digest = hashlib.sha256(f"{kind}:{ref}".encode()).hexdigest()[:16]
    return f"{kind}_{digest}"


def _get_proactive_state(profile: Mapping[str, Any]) -> dict[str, Any]:
    prefs = profile.get("learned_preferences")
    if not isinstance(prefs, Mapping):
        return {}
    raw = prefs.get(PROACTIVE_STATE_KEY)
    return dict(raw) if isinstance(raw, Mapping) else {}


def _get_turn_plan(profile: Mapping[str, Any]) -> dict[str, Any]:
    prefs = profile.get("learned_preferences")
    if not isinstance(prefs, Mapping):
        return {}
    raw = prefs.get(TURN_PLAN_KEY)
    return dict(raw) if isinstance(raw, Mapping) else {}


def _is_dismissed(state: Mapping[str, Any], suggestion_id: str) -> bool:
    dismissed = state.get("dismissed_until")
    if not isinstance(dismissed, Mapping):
        return False
    until_raw = dismissed.get(suggestion_id)
    if not until_raw:
        return False
    try:
        until = datetime.fromisoformat(str(until_raw).replace("Z", "+00:00"))
    except ValueError:
        return False
    return datetime.now(UTC) < until


def _recently_shown(state: Mapping[str, Any], suggestion_id: str) -> bool:
    last_id = str(state.get("last_suggestion_id") or "")
    last_at_raw = state.get("last_suggestion_at")
    if last_id != suggestion_id or not last_at_raw:
        return False
    try:
        last_at = datetime.fromisoformat(str(last_at_raw).replace("Z", "+00:00"))
    except ValueError:
        return False
    return datetime.now(UTC) - last_at < timedelta(minutes=DEDUPE_MINUTES)


def bump_turn_counter(state: dict[str, Any]) -> dict[str, Any]:
    count = int(state.get("turn_counter") or 0) + 1
    out = dict(state)
    out["turn_counter"] = count
    out["updated_at"] = _now_iso()
    return out


def record_suggestion_shown(state: dict[str, Any], suggestion_id: str) -> dict[str, Any]:
    out = dict(state)
    out["last_suggestion_id"] = suggestion_id
    out["last_suggestion_at"] = _now_iso()
    return out


def dismiss_suggestion(state: dict[str, Any], suggestion_id: str) -> dict[str, Any]:
    out = dict(state)
    dismissed = dict(out.get("dismissed_until") or {})
    dismissed[suggestion_id] = (datetime.now(UTC) + timedelta(minutes=DEDUPE_MINUTES)).isoformat()
    out["dismissed_until"] = dismissed
    return out


def _parse_iso(iso: str | None) -> datetime | None:
    if not iso:
        return None
    try:
        return datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
    except ValueError:
        return None


def _run_has_artifact(run: Mapping[str, Any]) -> bool:
    result = run.get("result_payload")
    if not isinstance(result, Mapping):
        return False
    for key in ("unified_content_id", "content_id", "image_url", "track_id"):
        if str(result.get(key) or "").strip():
            return True
    return False


def _suggestion_from_turn_plan(plan: Mapping[str, Any]) -> ProactiveSuggestionV1 | None:
    steps = plan.get("steps")
    if not isinstance(steps, list) or not steps:
        return None
    first = steps[0] if isinstance(steps[0], Mapping) else {}
    tool = str(first.get("tool") or first.get("name") or "next step").strip()
    sid = _suggestion_id("turn_plan", tool)
    return ProactiveSuggestionV1(
        suggestion_id=sid,
        kind="next_step",
        question_ru=f"В очереди шаг «{tool}» — продолжить сейчас?",
        question_en=f"Step «{tool}» is queued — continue now?",
        quick_replies=["продолжай", "отмена", "покажи статус"],
        source="turn_plan",
        confidence=0.85,
        refs={"turn_plan_next_tool": tool},
    )


def _suggestion_from_completed_run(run: Mapping[str, Any]) -> ProactiveSuggestionV1 | None:
    intent = str(run.get("intent_kind") or "").strip().lower()
    run_id = str(run.get("id") or "")
    status = str(run.get("status") or "").strip().lower()

    if status == "failed":
        sid = _suggestion_id("subtask_failed", run_id)
        return ProactiveSuggestionV1(
            suggestion_id=sid,
            kind="risk",
            question_ru="Последняя операция не удалась — повторить или изменить запрос?",
            question_en="Last operation failed — retry or change the request?",
            quick_replies=["повтори", "покажи статус", "отмена"],
            source="subtask_failed",
            confidence=0.9,
            refs={"run_id": run_id, "intent_kind": intent},
        )

    if status in ("completed", "done", "success"):
        if "music" in intent and _run_has_artifact(run):
            sid = _suggestion_id("run_complete", run_id)
            return ProactiveSuggestionV1(
                suggestion_id=sid,
                kind="run_complete_followup",
                question_ru="Трек готов — включить сейчас или отложить?",
                question_en="Track is ready — play now or save for later?",
                quick_replies=["включи", "покажи статус"],
                source="subtask_complete",
                confidence=0.88,
                refs={"run_id": run_id},
            )
        if not _run_has_artifact(run):
            sid = _suggestion_id("gap", run_id)
            return ProactiveSuggestionV1(
                suggestion_id=sid,
                kind="gap",
                question_ru="Операция отмечена завершённой, но артефакт не найден — проверить статус?",
                question_en="Operation marked complete but no artifact found — check status?",
                quick_replies=["покажи статус", "повтори"],
                source="subtask_complete",
                confidence=0.75,
                refs={"run_id": run_id},
            )
    return None


def _suggestion_from_stale_run(run: Mapping[str, Any]) -> ProactiveSuggestionV1 | None:
    status = str(run.get("status") or "").strip().lower()
    if status not in ("running", "in_progress", "accepted", "pending"):
        return None
    updated = _parse_iso(str(run.get("updated_at") or run.get("created_at") or ""))
    if updated is None:
        return None
    if datetime.now(UTC) - updated < timedelta(minutes=STALE_RUN_MINUTES):
        return None
    run_id = str(run.get("id") or "")
    sid = _suggestion_id("stale", run_id)
    return ProactiveSuggestionV1(
        suggestion_id=sid,
        kind="risk",
        question_ru="Задача долго в статусе «выполняется» — обновить статус?",
        question_en="Task has been running for a while — refresh status?",
        quick_replies=["покажи статус", "отмена"],
        source="active_run",
        confidence=0.7,
        refs={"run_id": run_id},
    )


def _suggestion_from_shell_context(shell: Mapping[str, Any] | None) -> ProactiveSuggestionV1 | None:
    if not shell:
        return None
    windows = shell.get("windows")
    if not isinstance(windows, list):
        return None
    for win in windows:
        if not isinstance(win, Mapping):
            continue
        app = str(win.get("app_component") or "").strip()
        title = str(win.get("title") or "").strip()
        excerpt = str(win.get("surface_excerpt") or "").strip()
        if app == "DocEditor" and title and not excerpt:
            sid = _suggestion_id("context_gap", title)
            return ProactiveSuggestionV1(
                suggestion_id=sid,
                kind="gap",
                question_ru=f"Открыт «{title}», но текст не подгружен — подтянуть из каталога?",
                question_en=f"«{title}» is open but body is empty — load from catalog?",
                quick_replies=["прочитай файл", "покажи файлы"],
                source="context_gap",
                confidence=0.65,
                refs={"window_title": title, "app_component": app},
            )
    return None


def _pick_best(candidates: list[ProactiveSuggestionV1]) -> ProactiveSuggestionV1 | None:
    if not candidates:
        return None
    priority = {
        "subtask_failed": 0,
        "active_run": 1,
        "subtask_complete": 2,
        "turn_plan": 3,
        "context_gap": 4,
        "turn_counter": 5,
        "observation": 6,
    }

    def sort_key(s: ProactiveSuggestionV1) -> tuple[int, float]:
        return (priority.get(s.source, 99), -s.confidence)

    return sorted(candidates, key=sort_key)[0]


def build_proactive_suggestion(
    *,
    profile: Mapping[str, Any],
    active_runs: list[Mapping[str, Any]] | None = None,
    recent_completed: list[Mapping[str, Any]] | None = None,
    shell_context: Mapping[str, Any] | None = None,
    trigger: str = "turn",
    subtask_event: str | None = None,
) -> ProactiveSuggestionV1 | None:
    """Build at most one proactive suggestion for this tick/turn."""

    if not companion_proactive_review_enabled():
        return None

    state = _get_proactive_state(profile)
    candidates: list[ProactiveSuggestionV1] = []

    plan = _get_turn_plan(profile)
    if plan:
        s = _suggestion_from_turn_plan(plan)
        if s:
            candidates.append(s)

    for run in active_runs or []:
        if isinstance(run, Mapping):
            s = _suggestion_from_stale_run(run)
            if s:
                candidates.append(s)

    if companion_proactive_review_on_subtask() and subtask_event:
        for run in (recent_completed or [])[:3]:
            if isinstance(run, Mapping):
                s = _suggestion_from_completed_run(run)
                if s:
                    candidates.append(s)

    shell_s = _suggestion_from_shell_context(shell_context)
    if shell_s:
        candidates.append(shell_s)

    every_n = companion_proactive_review_every_n_turns()
    turn_count = int(state.get("turn_counter") or 0)
    if trigger == "turn" and every_n > 0 and turn_count > 0 and turn_count % every_n == 0:
        if plan and isinstance(plan.get("steps"), list) and plan["steps"]:
            pass  # turn_plan suggestion already added
        elif not candidates:
            sid = _suggestion_id("turn_counter", str(turn_count))
            candidates.append(
                ProactiveSuggestionV1(
                    suggestion_id=sid,
                    kind="next_step",
                    question_ru="Чем заняться дальше на столе?",
                    question_en="What should we tackle next on the desk?",
                    quick_replies=["покажи файлы", "как дела с задачами"],
                    source="turn_counter",
                    confidence=0.5,
                    refs={"turn_counter": turn_count},
                )
            )

    best = _pick_best(candidates)
    if best is None:
        return None

    if _is_dismissed(state, best.suggestion_id) or _recently_shown(state, best.suggestion_id):
        return None

    logger.info(
        "[STEP] companion_proactive_suggestion_emitted kind=%s source=%s id=%s",
        best.kind,
        best.source,
        best.suggestion_id,
    )
    return best


def proactive_suggestion_to_hint(suggestion: ProactiveSuggestionV1) -> CompanionHintOut:
    return CompanionHintOut(
        kind="proactive_review",
        hint_text=suggestion.question_ru or suggestion.question_en,
        related_episodes=[],
        suggested_action={
            "kind": "proactive_review",
            "quick_replies": suggestion.quick_replies,
            "suggestion_id": suggestion.suggestion_id,
            "refs": suggestion.refs,
        },
    )


def merge_observation_hints(
    anticipation: CompanionHintOut | None,
    proactive: ProactiveSuggestionV1 | None,
) -> CompanionHintOut | None:
    """Priority: proactive (failed/stale/turn_plan) over idle anticipation."""

    if proactive is not None:
        return proactive_suggestion_to_hint(proactive)
    return anticipation


__all__ = (
    "PROACTIVE_STATE_KEY",
    "build_proactive_suggestion",
    "bump_turn_counter",
    "dismiss_suggestion",
    "load_proactive_state",
    "merge_observation_hints",
    "profile_from_learned",
    "proactive_state_key",
    "proactive_suggestion_to_hint",
    "record_suggestion_shown",
)
