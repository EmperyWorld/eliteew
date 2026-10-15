# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Decide when to enqueue Celery ``companion_evolution_tick`` (``tick_reason=llm_summary``) after a companion chat
# persist, and build per-epoch idempotency keys. Updates ``learned_preferences.companion_evolution_chat_v1`` in-place.
# Invariants:
# - Never calls the evolution LLM synchronously; scheduling is fire-and-forget via Celery only.
# - Each enqueue uses a unique explicit ``idempotency_key`` (epoch-based) so Redis dedupe does not block the next cycle.
# - Scheduling failures are logged and never propagate to the chat HTTP handler.
# Related:
# - api/ewa_platform/companion/persona/evolution_schedule.py
# - api/ewa_platform/companion/persona/evolution_summary.py
# - api/ewa_platform/workers/evolution_tick_task.py
# - api/ewa_platform/companion/turn/chat_turn.py
# ---
"""Chat-triggered scheduling for companion LLM evolution summary ticks."""

from __future__ import annotations

import logging
import os
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

logger = logging.getLogger(__name__)

CHAT_NS_FOR_TRIGGER = "desktop_friend_chat_v1"
EVOLUTION_CHAT_NS = "companion_evolution_chat_v1"

_DEFAULT_EVERY_N = 10
_DEFAULT_COOLDOWN_SEC = 1200
_DEFAULT_MIN_USER_TURNS = 6


def _env_truthy(raw: str | None) -> bool:
    if raw is None:
        return False
    return str(raw).strip().lower() in ("1", "true", "yes", "on")


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name, str(default)).strip()
    try:
        return max(0, int(raw or default))
    except ValueError:
        return default


@dataclass(frozen=True)
class EvolutionEnqueueDecision:
    """Outcome of ``evaluate_evolution_llm_enqueue`` for one chat persist."""

    schedule: bool
    reason: str
    idempotency_key: str = ""
    next_state: dict[str, Any] = field(default_factory=dict)


def count_user_turns_in_transcript(lp: Mapping[str, Any]) -> int:
    """Count ``role=user`` rows in ``desktop_friend_chat_v1``."""

    blob = lp.get(CHAT_NS_FOR_TRIGGER)
    if not isinstance(blob, Mapping):
        return 0
    messages = blob.get("messages")
    if not isinstance(messages, list):
        return 0
    count = 0
    for row in messages:
        if not isinstance(row, Mapping):
            continue
        if str(row.get("role", "")).strip().lower() == "user":
            count += 1
    return count


def get_evolution_chat_state(lp: Mapping[str, Any]) -> dict[str, Any]:
    raw = lp.get(EVOLUTION_CHAT_NS)
    if not isinstance(raw, Mapping):
        return {}
    return dict(raw)


def apply_evolution_chat_state(lp: dict[str, Any], state: Mapping[str, Any]) -> dict[str, Any]:
    lp[EVOLUTION_CHAT_NS] = dict(state)
    return lp


def _parse_iso_utc(value: str) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = f"{text[:-1]}+00:00"
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def build_evolution_idempotency_key(*, principal_id: str, epoch: int) -> str:
    pid = principal_id.strip()
    return f"llm_summary:chat:v1:{pid}:{epoch}"[:128]


def _log_enqueue_skip(*, principal_id: str, reason: str, user_turns: int) -> None:
    """Log skips that are useful for operators (not disabled-by-default flags)."""

    if reason in ("auto_from_chat_disabled", "llm_summary_disabled"):
        return
    logger.info(
        "[STEP] companion_evolution_enqueue_skipped principal=%s reason=%s user_turns=%s",
        principal_id,
        reason,
        user_turns,
    )


def evaluate_evolution_llm_enqueue(
    lp: Mapping[str, Any],
    *,
    principal_id: str,
    persona_seed: str = "",
    user_line: str = "",
    skip_heavy_steps: bool = False,
    now_utc: datetime | None = None,
) -> EvolutionEnqueueDecision:
    """Return whether to enqueue ``llm_summary`` after the upcoming profile patch."""

    pid = principal_id.strip()
    if not pid:
        return EvolutionEnqueueDecision(schedule=False, reason="empty_principal_id")

    if not _env_truthy(os.getenv("EWA_COMPANION_EVOLUTION_AUTO_FROM_CHAT", "0")):
        return EvolutionEnqueueDecision(schedule=False, reason="auto_from_chat_disabled")

    if not _env_truthy(os.getenv("EWA_COMPANION_EVOLUTION_USE_LLM", "1")):
        return EvolutionEnqueueDecision(schedule=False, reason="llm_summary_disabled")

    if skip_heavy_steps:
        return EvolutionEnqueueDecision(schedule=False, reason="arlika_lightweight")

    every_n = _env_int("EWA_COMPANION_EVOLUTION_AUTO_EVERY_N_USER_TURNS", _DEFAULT_EVERY_N)
    cooldown_sec = _env_int("EWA_COMPANION_EVOLUTION_AUTO_COOLDOWN_SEC", _DEFAULT_COOLDOWN_SEC)
    min_user_turns = _env_int("EWA_COMPANION_EVOLUTION_AUTO_MIN_USER_TURNS", _DEFAULT_MIN_USER_TURNS)

    if every_n <= 0:
        return EvolutionEnqueueDecision(schedule=False, reason="every_n_disabled")

    user_turns = count_user_turns_in_transcript(lp)
    if user_turns < min_user_turns:
        _log_enqueue_skip(principal_id=pid, reason="min_user_turns", user_turns=user_turns)
        return EvolutionEnqueueDecision(schedule=False, reason="min_user_turns")

    state = get_evolution_chat_state(lp)
    try:
        prev_at_enqueue = int(state.get("user_turns_at_last_enqueue") or 0)
    except (TypeError, ValueError):  # fmt: skip
        prev_at_enqueue = 0
    try:
        epoch = int(state.get("epoch") or 0)
    except (TypeError, ValueError):  # fmt: skip
        epoch = 0

    delta = user_turns - prev_at_enqueue
    if delta < every_n:
        _log_enqueue_skip(principal_id=pid, reason="turn_threshold", user_turns=user_turns)
        return EvolutionEnqueueDecision(schedule=False, reason="turn_threshold")

    now = now_utc or datetime.now(UTC)
    last_iso = str(state.get("last_enqueue_at_iso") or "").strip()
    if last_iso and cooldown_sec > 0:
        last_dt = _parse_iso_utc(last_iso)
        if last_dt is not None:
            elapsed = (now - last_dt).total_seconds()
            if elapsed < float(cooldown_sec):
                _log_enqueue_skip(principal_id=pid, reason="cooldown", user_turns=user_turns)
                return EvolutionEnqueueDecision(schedule=False, reason="cooldown")

    next_epoch = epoch + 1
    idem = build_evolution_idempotency_key(principal_id=pid, epoch=next_epoch)
    try:
        last_completed = int(state.get("last_completed_epoch") or 0)
    except (TypeError, ValueError):  # fmt: skip
        last_completed = 0
    next_state = {
        "epoch": next_epoch,
        "user_turns_at_last_enqueue": user_turns,
        "last_enqueue_at_iso": now.isoformat().replace("+00:00", "Z"),
        "last_completed_epoch": last_completed,
    }
    _ = persona_seed, user_line  # reserved for future persona-specific gates
    decision = EvolutionEnqueueDecision(
        schedule=True,
        reason="ok",
        idempotency_key=idem,
        next_state=next_state,
    )
    logger.info(
        "[STEP] companion_evolution_enqueue_scheduled principal=%s epoch=%s user_turns=%s",
        pid,
        next_epoch,
        user_turns,
    )
    return decision


def schedule_companion_evolution_llm_summary(*, principal_id: str, idempotency_key: str) -> None:
    """Enqueue Celery evolution tick; never raises to the chat handler."""

    from api.ewa_platform.companion.persona.evolution_schedule import schedule_companion_evolution_tick

    schedule_companion_evolution_tick(
        principal_id=principal_id,
        tick_reason="llm_summary",
        idempotency_key=idempotency_key,
        log_step="companion_evolution_llm_summary_scheduled",
    )


__all__ = (
    "CHAT_NS_FOR_TRIGGER",
    "EVOLUTION_CHAT_NS",
    "EvolutionEnqueueDecision",
    "apply_evolution_chat_state",
    "build_evolution_idempotency_key",
    "count_user_turns_in_transcript",
    "evaluate_evolution_llm_enqueue",
    "get_evolution_chat_state",
    "schedule_companion_evolution_llm_summary",
)
