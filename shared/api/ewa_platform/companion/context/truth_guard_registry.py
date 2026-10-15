# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pluggable truth guards for companion visible replies — strip false completion claims per orchestration branch.
# Invariants:
# - Pure string transforms; never raises.
# - ``companion_truth_guard_strict()`` appends explicit correction tails when guards fire.
# Related:
# - api/ewa_platform/companion/context/noise.py
# - documentation/product/ewa/EWA-COMPANION-PROACTIVE-PROTOCOL.md
# ---

from __future__ import annotations

import logging
import re
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any

from api.ewa_platform.companion.protocol.config import companion_truth_guard_strict

logger = logging.getLogger(__name__)

_DEFERRED_MUSIC_STARTED_CLAIM_LINE_RE = re.compile(
    r"(?im)^.*(?:"
    r"(?:генерац\w*|песн\w*|тр[еэ]к\w*|музык\w*|music|song|track).{0,80}"
    r"(?:уже|запущен\w*|запустил\w*|в\s+процессе|already|started|running|in\s+progress|готов\w*)"
    r"|"
    r"(?:уже|запущен\w*|запустил\w*|в\s+процессе|already|started|running|in\s+progress|готов\w*).{0,80}"
    r"(?:генерац\w*|песн\w*|тр[еэ]к\w*|музык\w*|music|song|track)"
    r").*$"
)

_ASYNC_READY_CLAIM_RE = re.compile(
    r"(?im)(?:уже\s+готов\w*|already\s+(?:done|ready|complete)|готово|всё\s+готово|track\s+is\s+ready)",
)

_TURN_PLAN_STARTED_CLAIM_RE = re.compile(
    r"(?im)(?:следующ\w+\s+шаг\s+уже\s+запущ|next\s+step\s+already\s+started|уже\s+запустил\w*\s+следующ)",
)

_OPEN_APP_CLAIM_RE = re.compile(
    r"(?im)(?:уже\s+открыл\w*|already\s+open(?:ed)?|открыла\s+(?:редактор|doc|app))",
)


@dataclass(frozen=True)
class TruthGuardContext:
    user_line: str
    effective_branch: str
    deferred_music_generation: bool = False
    orchestration_outcome: str | None = None
    actions: list[dict[str, Any]] | None = None
    task_run_status: str | None = None
    turn_plan_next_tool: str | None = None
    has_recent_server_action: bool = False


TruthGuardFn = Callable[[str, TruthGuardContext], tuple[str, bool]]


def _append_tail_once(reply: str, tail: str) -> str:
    body = (reply or "").strip()
    if not tail or tail in body:
        return body
    return f"{body}\n\n{tail}".strip() if body else tail


def _looks_cyrillic(text: str) -> bool:
    return bool(re.search(r"[А-Яа-яЁё]", text or ""))


def _guard_file_study_music(reply: str, ctx: TruthGuardContext) -> tuple[str, bool]:
    if (
        ctx.effective_branch != "file_study_compose"
        and not ctx.deferred_music_generation
        and not _DEFERRED_MUSIC_STARTED_CLAIM_LINE_RE.search(reply)
    ):
        return reply, False
    cleaned = _DEFERRED_MUSIC_STARTED_CLAIM_LINE_RE.sub("", reply or "").strip()
    looks_ru = _looks_cyrillic(ctx.user_line)
    triggered = cleaned != (reply or "").strip() or ctx.deferred_music_generation
    if ctx.deferred_music_generation:
        tail = (
            "Важно: генерация песни ещё не запущена — она в очереди следующего шага. Напиши «продолжай/запускай»."
            if looks_ru
            else "Important: song generation has not started yet — queued as next step. Say 'continue'."
        )
        return _append_tail_once(cleaned, tail), triggered
    if _DEFERRED_MUSIC_STARTED_CLAIM_LINE_RE.search(reply or ""):
        tail = (
            "Важно: генерация песни ещё не запущена. В этом шаге я делаю анализ и текст; для запуска генерации напиши отдельной командой."
            if looks_ru
            else "Important: song generation has not started yet. This step only handles analysis and lyrics; send a separate command to start generation."
        )
        return _append_tail_once(cleaned, tail), True
    return reply, False


def _guard_async_accepted(reply: str, ctx: TruthGuardContext) -> tuple[str, bool]:
    status = (ctx.task_run_status or "").strip().lower()
    if status in ("completed", "done", "success"):
        return reply, False
    if (
        status in ("running", "accepted", "pending", "in_progress", "queued")
        or ctx.effective_branch.endswith(("music_generation", "image_generation"))
    ) and _ASYNC_READY_CLAIM_RE.search(reply or ""):
        looks_ru = _looks_cyrillic(ctx.user_line)
        cleaned = _ASYNC_READY_CLAIM_RE.sub("", reply or "").strip()
        tail = (
            "Операция ещё выполняется — статус смотри в «Текущих операциях»."
            if looks_ru
            else "Operation still in progress — check Current operations."
        )
        return _append_tail_once(cleaned, tail), True
    return reply, False


def _guard_turn_plan(reply: str, ctx: TruthGuardContext) -> tuple[str, bool]:
    if ctx.turn_plan_next_tool and _TURN_PLAN_STARTED_CLAIM_RE.search(reply or ""):
        looks_ru = _looks_cyrillic(ctx.user_line)
        cleaned = _TURN_PLAN_STARTED_CLAIM_RE.sub("", reply or "").strip()
        tail = (
            f"Следующий шаг «{ctx.turn_plan_next_tool}» ещё не запущен — напиши «продолжай»."
            if looks_ru
            else f"Next step «{ctx.turn_plan_next_tool}» not started yet — say 'continue'."
        )
        return _append_tail_once(cleaned, tail), True
    if not ctx.turn_plan_next_tool and _TURN_PLAN_STARTED_CLAIM_RE.search(reply or ""):
        looks_ru = _looks_cyrillic(ctx.user_line)
        cleaned = _TURN_PLAN_STARTED_CLAIM_RE.sub("", reply or "").strip()
        tail = (
            "Следующий шаг не в очереди — уточни команду."
            if looks_ru
            else "No next step queued — clarify your command."
        )
        return _append_tail_once(cleaned, tail), True
    return reply, False


def _guard_action_claim_without_actions(reply: str, ctx: TruthGuardContext) -> tuple[str, bool]:
    actions = ctx.actions or []
    if actions:
        return reply, False
    if _OPEN_APP_CLAIM_RE.search(reply or "") and not ctx.has_recent_server_action:
        looks_ru = _looks_cyrillic(ctx.user_line)
        cleaned = _OPEN_APP_CLAIM_RE.sub("", reply or "").strip()
        tail = (
            "Действие на столе ещё не выполнено — повтори команду явнее."
            if looks_ru
            else "Desktop action not executed yet — rephrase the command."
        )
        return _append_tail_once(cleaned, tail), True
    return reply, False


def _guard_fell_through_llm(reply: str, ctx: TruthGuardContext) -> tuple[str, bool]:
    if ctx.orchestration_outcome != "fell_through":
        return reply, False
    if ctx.has_recent_server_action:
        return reply, False
    if _OPEN_APP_CLAIM_RE.search(reply or "") or _DEFERRED_MUSIC_STARTED_CLAIM_LINE_RE.search(reply or ""):
        looks_ru = _looks_cyrillic(ctx.user_line)
        cleaned = _OPEN_APP_CLAIM_RE.sub("", reply or "")
        cleaned = _DEFERRED_MUSIC_STARTED_CLAIM_LINE_RE.sub("", cleaned).strip()
        tail = (
            "В этом ответе я не запускала инструменты — это только диалог."
            if looks_ru
            else "No server tools ran this turn — chat reply only."
        )
        return _append_tail_once(cleaned, tail), True
    return reply, False


_GUARDS: list[TruthGuardFn] = [
    _guard_file_study_music,
    _guard_async_accepted,
    _guard_turn_plan,
    _guard_action_claim_without_actions,
    _guard_fell_through_llm,
]


def apply_truth_guards(reply: str, ctx: TruthGuardContext) -> tuple[str, bool]:
    """Run all registered guards; return (reply, any_guard_triggered)."""

    current = reply
    any_triggered = False
    for guard in _GUARDS:
        current, triggered = guard(current, ctx)
        if triggered:
            any_triggered = True
            logger.info(
                "[STEP] companion_false_completion_guard_triggered branch=%s guard=%s",
                ctx.effective_branch or "-",
                guard.__name__,
            )
    if any_triggered and companion_truth_guard_strict():
        looks_ru = _looks_cyrillic(ctx.user_line)
        strict_tail = (
            "Уточнение: статус выше приведён по фактическому состоянию системы."
            if looks_ru
            else "Clarification: status above reflects actual system state."
        )
        current = _append_tail_once(current, strict_tail)
    return current, any_triggered


def task_run_status_from_mapping(task_run: Mapping[str, Any] | None) -> str | None:
    if not isinstance(task_run, Mapping):
        return None
    return str(task_run.get("status") or "").strip() or None


__all__ = (
    "TruthGuardContext",
    "apply_truth_guards",
    "task_run_status_from_mapping",
)
