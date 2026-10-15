# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Ground-truth active companion task runs for system prompt and status Q&A (music generation progress).
# Invariants:
# - Data comes from EWA Postgres task runs + steps only; never invent progress.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# - api/ewa_platform/companion/orchestration/task_orchestrator.py
# ---

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

import asyncpg

from api.ewa_platform.companion.jobs.music_pipeline_progress import MUSIC_PIPELINE_STAGE_COUNT
from api.ewa_platform.companion.orchestration.tool_result_utils import as_mapping_dict
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

_ACTIVE_RUN_STATUSES = frozenset({"pending", "running", "awaiting_confirmation"})

_OPERATION_STATUS_RE = re.compile(
    r"(?:"
    r"на\s+каком\s+этапе|"
    r"что\s+(?:там\s+с|с)\s+(?:генера|песн|запис|трек|картин)|"
    r"как\s+(?:там\s+с|идёт|идет)\s+(?:генера|песн|запис|трек|картин)|"
    r"статус\s+(?:генера|запис|песн|трек)|"
    r"где\s+(?:моя\s+)?(?:песн|трек)|"
    r"what\s+stage|"
    r"generation\s+status|"
    r"how\s+(?:is|'s)\s+(?:the\s+)?(?:song|track|music|recording|image)\s+(?:going|generat|doing)|"
    r"status\s+of\s+(?:the\s+)?(?:song|track|music|recording|image)\s+generat"
    r")",
    re.IGNORECASE,
)


def _looks_cyrillic(text: str) -> bool:
    return bool(re.search(r"[\u0400-\u04FF]", str(text or "")))


def user_line_asks_active_operations_status(user_line: str) -> bool:
    return bool(_OPERATION_STATUS_RE.search(str(user_line or "")))


async def load_active_task_runs_with_steps(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Return in-flight runs with step rows attached (newest first)."""

    rows = await companion_pg.companion_task_runs_list(pool, principal_id=principal_id, limit=limit)
    active = [dict(r) for r in rows if str(r.get("status") or "").strip() in _ACTIVE_RUN_STATUSES]
    out: list[dict[str, Any]] = []
    for run in active[:5]:
        run_id = str(run.get("id") or "").strip()
        if not run_id:
            continue
        steps = await companion_pg.companion_task_steps_list(pool, run_id=run_id)
        run["steps"] = steps
        out.append(run)
    return out


def _music_progress_from_run(run: Mapping[str, Any]) -> tuple[int, int, str]:
    """Return (current_stage, total_stages, stage_title) for music background runs."""

    total = MUSIC_PIPELINE_STAGE_COUNT
    steps = run.get("steps")
    current = 0
    title = ""
    if isinstance(steps, list):
        for step in steps:
            if not isinstance(step, Mapping):
                continue
            st = str(step.get("status") or "").strip().lower()
            idx_raw = step.get("step_index")
            try:
                idx = int(idx_raw) if idx_raw is not None else 0
            except (TypeError, ValueError):  # fmt: skip
                idx = 0
            step_title = str(step.get("title") or "").strip()
            if st in {"completed", "failed"} and idx > current:
                current = idx
            elif st in {"running", "in_progress", "pending"} and idx >= current:
                current = max(current, idx)
                if step_title:
                    title = step_title
        if not title:
            for step in reversed(steps):
                if isinstance(step, Mapping):
                    step_title = str(step.get("title") or "").strip()
                    if step_title:
                        title = step_title
                        break
    plan = as_mapping_dict(run.get("plan_payload"))
    if not title:
        theme = str(plan.get("theme_preview") or "").strip()
        if theme:
            title = theme
    return max(0, min(current, total)), total, title


def _run_summary_line(run: Mapping[str, Any], *, ru: bool) -> str:
    run_id = str(run.get("id") or "").strip()
    intent = str(run.get("intent_kind") or "").strip()
    status = str(run.get("status") or "").strip()
    if intent == "music_generation_background":
        current, total, title = _music_progress_from_run(run)
        stage_part = (
            f"этап {current}/{total}" + (f" «{title}»" if title else "")
            if ru
            else f"stage {current}/{total}" + (f' "{title}"' if title else "")
        )
        plan = as_mapping_dict(run.get("plan_payload"))
        theme = str(plan.get("theme_preview") or "").strip()
        theme_part = f" theme={theme[:120]}" if theme else ""
        return f"- run_id={run_id} intent=music_generation_background status={status} {stage_part}{theme_part}"
    if intent == "music_generation_xl_base_background":
        current, total, title = _music_progress_from_run(run)
        stage_part = (
            f"этап {current}/{total}" + (f" «{title}»" if title else "")
            if ru
            else f"stage {current}/{total}" + (f' "{title}"' if title else "")
        )
        plan = as_mapping_dict(run.get("plan_payload"))
        theme = str(plan.get("theme_preview") or "").strip()
        theme_part = f" theme={theme[:120]}" if theme else ""
        return (
            f"- run_id={run_id} intent=music_generation_xl_base_background status={status} "
            f"XL Base {stage_part}{theme_part}"
        )
    user_msg = str(run.get("user_message") or "").strip()
    preview = user_msg[:120] + ("…" if len(user_msg) > 120 else "")
    return f"- run_id={run_id} intent={intent} status={status} user_line={preview!r}"


def format_active_task_runs_prompt_block(runs: list[Mapping[str, Any]]) -> str:
    if not runs:
        return ""
    lines = [
        "Active_task_runs (authoritative — durable companion operations in progress on this desk; "
        "when the user asks about song/track/image status, answer ONLY from this block; "
        "use server tool check_task_status(task_id) with run_id below internally — never ask the user to copy UUIDs):"
    ]
    for run in runs:
        lines.append(_run_summary_line(run, ru=True))
    return "\n".join(lines) + "\n"


async def load_active_task_runs_prompt_block(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
) -> str:
    runs = await load_active_task_runs_with_steps(pool, principal_id=principal_id)
    return format_active_task_runs_prompt_block(runs)


def format_active_operations_status_reply(
    runs: list[Mapping[str, Any]],
    *,
    user_line: str,
) -> str:
    """Build a user-facing status answer from active runs."""

    ru = _looks_cyrillic(user_line)
    if not runs:
        return (
            "Сейчас ничего не выполняется — если ждёшь результат, загляни в «Текущие операции» справа."
            if ru
            else "Nothing is running right now — if you're waiting for a result, check Current operations on the right."
        )
    parts: list[str] = []
    if ru:
        parts.append("Сейчас в работе:")
    else:
        parts.append("In progress:")
    for run in runs:
        intent = str(run.get("intent_kind") or "").strip()
        if intent in {"music_generation_background", "music_generation_xl_base_background"}:
            current, total, title = _music_progress_from_run(run)
            plan = as_mapping_dict(run.get("plan_payload"))
            theme = str(plan.get("theme_preview") or "").strip()
            if ru:
                line = "Запись песни"
                if theme:
                    line += f" «{theme}»"
                line += f": этап {current} из {total}"
                if title and title != theme:
                    line += f" — {title}"
                line += "."
            else:
                line = "Song recording"
                if theme:
                    line += f' "{theme}"'
                line += f": step {current} of {total}"
                if title and title != theme:
                    line += f" — {title}"
                line += "."
            parts.append(line)
            continue
        if intent in {"image_generation_background", "image_edit_background"}:
            status = str(run.get("status") or "").strip()
            if ru:
                label = "Редактирование картинки" if intent == "image_edit_background" else "Картинка"
                parts.append(f"{label} — {status}.")
            else:
                label = "Image edit" if intent == "image_edit_background" else "Image"
                parts.append(f"{label} — {status}.")
            continue
        status = str(run.get("status") or "").strip()
        preview = str(run.get("user_message") or "").strip()[:100]
        if ru:
            parts.append(f"Фоновая задача ({status}){': ' + preview if preview else ''}.")
        else:
            parts.append(f"Background task ({status}){': ' + preview if preview else ''}.")
    if ru:
        parts.append("Подробности и шаги — в блоке «Текущие операции» справа.")
    else:
        parts.append("See the Current operations panel on the right for details.")
    return "\n\n".join(parts)


async def answer_active_operations_status(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    user_line: str,
) -> dict[str, Any] | None:
    if not user_line_asks_active_operations_status(user_line):
        return None
    runs = await load_active_task_runs_with_steps(pool, principal_id=principal_id)
    reply = format_active_operations_status_reply(runs, user_line=user_line)
    task_run = dict(runs[0]) if runs else None
    return {"reply": reply, "actions": [], "task_run": task_run}


__all__ = (
    "answer_active_operations_status",
    "format_active_task_runs_prompt_block",
    "load_active_task_runs_prompt_block",
    "load_active_task_runs_with_steps",
    "user_line_asks_active_operations_status",
)
