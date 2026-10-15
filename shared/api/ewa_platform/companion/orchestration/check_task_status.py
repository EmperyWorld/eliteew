# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Server tool ``check_task_status(task_id)`` — ground-truth status for one durable companion task run
# (music/image generation, action workflows, confirm-gated file ops).
# Invariants:
# - Reads only ``ewa_companion_task_runs`` + steps scoped to ``principal_id``; never invent progress.
# - Normalized status vocabulary: PENDING, RUNNING, COMPLETED, FAILED (+ AWAITING_CONFIRMATION, CANCELLED).
# Related:
# - api/ewa_platform/companion/orchestration/active_task_runs_prompt.py
# - api/ewa_platform/gateways/routers/companion_chat.py (GET task-runs/{run_id})
# - documentation/product/ewa/EWA-COMPANION-TASK-STATUS-TOOL.md
# ---

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any, Final

from api.ewa_platform.companion.orchestration.tool_result_utils import as_mapping_dict

# Keep in sync with ``companion.jobs.music_pipeline_progress.MUSIC_PIPELINE_STAGE_COUNT``.
_MUSIC_PIPELINE_STAGE_COUNT: Final[int] = 4

_UUID_RE: Final = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
    re.IGNORECASE,
)

_CHECK_TASK_STATUS_INTENT_RE: Final = re.compile(
    r"(?ix)(?:"
    r"check_task_status\b|"
    r"статус\s+(?:задачи|операции|run|task|фоновой|запис|генерац)?|"
    r"(?:провер(?:ь|ить)|узнай|скажи)\s+(?:статус|состояние|как\s+(?:идёт|идет|дела))\s*(?:задачи|операции|run|запис|песн)?|"
    r"как\s+(?:идёт|идет|дела\s+у|там\s+с)\s+(?:задач|операц|run|фонов|запис|песн|трек|генерац)|"
    r"что\s+(?:там\s+с|с)\s+(?:задач|операц|run|фонов|запис|песн|трек|генерац)|"
    r"(?:заверш(?:ена|ился|илась)|готов[аы]?)\s+(?:ли\s+)?(?:задач|операц|run|генерац|запис|песн|трек)|"
    r"task\s+status|"
    r"status\s+of\s+(?:task|run|operation|background|song|track|recording)|"
    r"how\s+(?:is|'s)\s+(?:the\s+)?(?:song|track|recording)\s+(?:going|doing)|"
    r"(?:run_id|task_id)\s*[=:]"
    r")",
)

_MUSIC_INTENT_KINDS: Final = frozenset(
    {
        "music_generation_background",
        "music_generation_xl_base_background",
    }
)

_IMAGE_INTENT_KINDS: Final = frozenset({"image_generation_background", "image_edit_background"})

_STAGE_TITLE_RU: Final = {
    "lyrics": "Текст",
    "generate audio": "Запись",
    "generate style": "Стиль",
    "suggest production params": "Звук",
    "suggest-production-params": "Звук",
    "generate-style": "Стиль",
    "generate": "Запись",
}


def _looks_cyrillic(text: str) -> bool:
    return bool(re.search(r"[\u0400-\u04FF]", str(text or "")))


def _user_line_mentions_music(user_line: str) -> bool:
    return bool(
        re.search(
            r"(?ix)(?:песн|трек|запис|song|track|music|recording|генерац)",
            str(user_line or ""),
        )
    )


def _intent_user_label(intent: str, *, ru: bool) -> str:
    ik = str(intent or "").strip().lower()
    if ik in _MUSIC_INTENT_KINDS:
        return "Запись песни" if ru else "Song recording"
    if ik in _IMAGE_INTENT_KINDS:
        return "Картинка" if ru else "Image"
    if ik == "action_workflow":
        return "Фоновая задача" if ru else "Background task"
    return "Операция" if ru else "Operation"


def _status_user_label(normalized: str, *, ru: bool) -> str:
    st = str(normalized or "").strip().upper()
    if ru:
        return {
            "RUNNING": "идёт",
            "PENDING": "готовится",
            "COMPLETED": "готово",
            "FAILED": "не удалось",
            "AWAITING_CONFIRMATION": "ждёт подтверждения",
            "CANCELLED": "отменено",
        }.get(st, st.lower())
    return {
        "RUNNING": "in progress",
        "PENDING": "preparing",
        "COMPLETED": "done",
        "FAILED": "could not finish",
        "AWAITING_CONFIRMATION": "awaiting confirmation",
        "CANCELLED": "cancelled",
    }.get(st, st.lower())


def _human_stage_title(title: str, *, ru: bool) -> str:
    raw = str(title or "").strip()
    if not raw:
        return ""
    if not ru:
        return raw
    key = raw.lower()
    return _STAGE_TITLE_RU.get(key, raw)


def _music_theme_from_run(run: Mapping[str, Any]) -> str:
    plan = as_mapping_dict(run.get("plan_payload"))
    return str(plan.get("theme_preview") or "").strip()


def _music_progress_from_run(run: Mapping[str, Any]) -> tuple[int, int, str]:
    total = _MUSIC_PIPELINE_STAGE_COUNT
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


def extract_task_run_id(text: str) -> str:
    """Return the first UUID in ``text``, or ``""``."""

    match = _UUID_RE.search(str(text or ""))
    return match.group(0).lower() if match else ""


def resolve_task_id_from_args(args: Mapping[str, Any], user_line: str) -> str:
    """Resolve ``task_id`` / ``run_id`` from tool args or the user line."""

    for key in ("task_id", "run_id", "id"):
        raw = str(args.get(key) or "").strip()
        if raw:
            found = extract_task_run_id(raw) or raw
            if _UUID_RE.fullmatch(found):
                return found.lower()
    return extract_task_run_id(user_line)


def user_line_requests_check_task_status(user_line: str, *, task_id: str = "") -> bool:
    """True when this turn should run ``check_task_status`` (by id or explicit tool name)."""

    line = str(user_line or "").strip()
    if not line:
        return False
    if "check_task_status" in line.lower():
        return True
    if _CHECK_TASK_STATUS_INTENT_RE.search(line):
        return True
    tid = str(task_id or "").strip() or extract_task_run_id(line)
    return bool(tid and _CHECK_TASK_STATUS_INTENT_RE.search(line))


def normalize_task_run_status(raw_status: str) -> str:
    """Map PG ``ewa_companion_task_runs.status`` to companion-facing enum."""

    s = str(raw_status or "").strip().lower()
    if s == "pending":
        return "PENDING"
    if s in {"running", "in_progress"}:
        return "RUNNING"
    if s == "awaiting_confirmation":
        return "AWAITING_CONFIRMATION"
    if s == "completed":
        return "COMPLETED"
    if s in {"failed", "error"}:
        return "FAILED"
    if s == "cancelled":
        return "CANCELLED"
    return s.upper() if s else "UNKNOWN"


def _error_summary_from_run(run: Mapping[str, Any]) -> str:
    err = run.get("error_payload")
    if isinstance(err, Mapping):
        for key in ("message", "detail", "error", "reason"):
            msg = str(err.get(key) or "").strip()
            if msg:
                return msg[:400]
    steps = run.get("steps")
    if isinstance(steps, list):
        for step in reversed(steps):
            if not isinstance(step, Mapping):
                continue
            if str(step.get("status") or "").strip().lower() != "failed":
                continue
            step_err = step.get("error_payload")
            if isinstance(step_err, Mapping):
                msg = str(step_err.get("message") or step_err.get("detail") or "").strip()
                if msg:
                    return msg[:400]
            title = str(step.get("title") or "").strip()
            if title:
                return title[:400]
    return ""


def build_task_status_snapshot(run: Mapping[str, Any]) -> dict[str, Any]:
    """Structured payload returned in ``ToolResult.data``."""

    raw_status = str(run.get("status") or "").strip()
    normalized = normalize_task_run_status(raw_status)
    intent = str(run.get("intent_kind") or "").strip()
    progress: dict[str, Any] = {}
    if intent in {"music_generation_background", "music_generation_xl_base_background"}:
        current, total, title = _music_progress_from_run(run)
        theme = _music_theme_from_run(run)
        progress = {
            "kind": "music_pipeline",
            "current_stage": current,
            "total_stages": total,
            "stage_title": title,
            "theme_preview": theme,
        }
    elif isinstance(run.get("steps"), list):
        steps = [s for s in run["steps"] if isinstance(s, Mapping)]
        done = sum(1 for s in steps if str(s.get("status") or "").strip().lower() in {"completed", "failed"})
        progress = {"kind": "steps", "completed_steps": done, "total_steps": len(steps)}

    snapshot: dict[str, Any] = {
        "task_id": str(run.get("id") or "").strip(),
        "normalized_status": normalized,
        "raw_status": raw_status,
        "intent_kind": intent,
        "execution_mode": str(run.get("execution_mode") or "").strip(),
        "progress": progress,
        "created_at": run.get("created_at"),
        "updated_at": run.get("updated_at"),
        "completed_at": run.get("completed_at"),
    }
    err = _error_summary_from_run(run)
    if err:
        snapshot["error_summary"] = err
    theme = _music_theme_from_run(run)
    if theme:
        snapshot["theme_preview"] = theme
    result = run.get("result_payload")
    if isinstance(result, Mapping) and result:
        snapshot["has_result_payload"] = True
    return snapshot


def format_task_status_reply(
    snapshot: Mapping[str, Any],
    *,
    user_line: str,
    not_found: bool = False,
) -> str:
    """User-visible answer for one task status lookup (no raw ids or tool names)."""

    ru = _looks_cyrillic(user_line)
    if not_found:
        if ru:
            return "Не нашла такую операцию среди твоих. Загляни в «Текущие операции» справа — там актуальный список."
        return (
            "I could not find that operation on your account. "
            "Check Current operations on the right for the latest list."
        )

    status = str(snapshot.get("normalized_status") or "UNKNOWN")
    intent = str(snapshot.get("intent_kind") or "").strip()
    progress = as_mapping_dict(snapshot.get("progress"))
    err = str(snapshot.get("error_summary") or "").strip()
    label = _intent_user_label(intent, ru=ru)
    status_text = _status_user_label(status, ru=ru)

    if intent in _MUSIC_INTENT_KINDS and str(progress.get("kind") or "") == "music_pipeline":
        theme = str(progress.get("theme_preview") or snapshot.get("theme_preview") or "").strip()
        cur = progress.get("current_stage")
        tot = progress.get("total_stages")
        title = _human_stage_title(str(progress.get("stage_title") or ""), ru=ru)
        if ru:
            line = label
            if theme:
                line += f" «{theme}»"
            line += f" — {status_text}"
            if cur is not None and tot is not None:
                line += f", этап {cur} из {tot}"
            if title:
                line += f" ({title})"
            line += "."
        else:
            line = label
            if theme:
                line += f' "{theme}"'
            line += f" — {status_text}"
            if cur is not None and tot is not None:
                line += f", step {cur} of {tot}"
            if title:
                line += f" ({title})"
            line += "."
        lines = [line]
    else:
        lines = [f"{label} — {status_text}."]

    kind = str(progress.get("kind") or "")
    if kind == "steps" and intent not in _MUSIC_INTENT_KINDS:
        done = progress.get("completed_steps", 0)
        total = progress.get("total_steps", 0)
        if ru:
            lines.append(f"Шаги: {done} из {total} завершено.")
        else:
            lines.append(f"Steps: {done} of {total} done.")

    if status == "AWAITING_CONFIRMATION":
        if ru:
            lines.append("Нужно подтвердить — кнопка в «Текущих операциях» или ответ в чате.")
        else:
            lines.append("Needs confirmation — use the button in Current operations or reply in chat.")
    if err and status in {"FAILED", "RUNNING", "PENDING"}:
        if ru:
            lines.append(f"Примечание: {err}")
        else:
            lines.append(f"Note: {err}")
    if status == "COMPLETED":
        if ru:
            lines.append("Готово — подробности в «Текущих операциях».")
        else:
            lines.append("Done — see Current operations for details.")
    elif status in {"RUNNING", "PENDING"}:
        if ru:
            lines.append("Ход работы — в «Текущих операциях» справа.")
        else:
            lines.append("Progress is shown in Current operations on the right.")
    return "\n".join(lines)


async def load_task_run_with_steps_for_principal(
    pool: Any,
    *,
    principal_id: str,
    task_id: str,
) -> dict[str, Any] | None:
    """Fetch one run + steps when it belongs to ``principal_id``."""

    from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

    run = await companion_pg.companion_task_run_fetch_for_principal(
        pool,
        run_id=task_id,
        principal_id=principal_id,
    )
    if run is None:
        return None
    steps = await companion_pg.companion_task_steps_list(pool, run_id=task_id)
    run = dict(run)
    run["steps"] = steps
    return run


async def resolve_default_task_id(
    pool: Any,
    *,
    principal_id: str,
    user_line: str,
) -> str:
    """Pick the most relevant run when the user did not supply an id."""

    from api.ewa_platform.companion.orchestration.active_task_runs_prompt import (
        load_active_task_runs_with_steps,
    )
    from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

    active = await load_active_task_runs_with_steps(pool, principal_id=principal_id)
    if active:
        if _user_line_mentions_music(user_line):
            for run in active:
                intent = str(run.get("intent_kind") or "").strip()
                if intent in _MUSIC_INTENT_KINDS:
                    return str(run.get("id") or "").strip().lower()
        return str(active[0].get("id") or "").strip().lower()

    rows = await companion_pg.companion_task_runs_list(pool, principal_id=principal_id, limit=8)
    if not rows:
        return ""
    if _user_line_mentions_music(user_line):
        for row in rows:
            intent = str(row.get("intent_kind") or "").strip()
            if intent in _MUSIC_INTENT_KINDS:
                return str(row.get("id") or "").strip().lower()
    return str(rows[0].get("id") or "").strip().lower()


async def answer_check_task_status(
    pool: Any,
    *,
    principal_id: str,
    user_line: str,
    args: Mapping[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Orchestrator entry: return a terminal reply dict or ``None`` to fall through."""

    arg_map = dict(args) if isinstance(args, Mapping) else {}
    task_id = resolve_task_id_from_args(arg_map, user_line)
    if not user_line_requests_check_task_status(user_line, task_id=task_id):
        return None
    if not task_id:
        task_id = await resolve_default_task_id(
            pool,
            principal_id=principal_id,
            user_line=user_line,
        )
    if not task_id:
        ru = _looks_cyrillic(user_line)
        reply = (
            "Сейчас ничего не выполняется — загляни в «Текущие операции» справа."
            if ru
            else "Nothing is running right now — check Current operations on the right."
        )
        return {
            "reply": reply,
            "actions": [],
            "task_run": None,
            "orchestration_branch": "check_task_status",
            "check_task_status": {"error": "no_runs"},
        }

    run = await load_task_run_with_steps_for_principal(pool, principal_id=principal_id, task_id=task_id)
    if run is None:
        snapshot = {"task_id": task_id}
        return {
            "reply": format_task_status_reply(snapshot, user_line=user_line, not_found=True),
            "actions": [],
            "task_run": None,
            "orchestration_branch": "check_task_status",
            "check_task_status": {"task_id": task_id, "normalized_status": "NOT_FOUND"},
        }

    snapshot = build_task_status_snapshot(run)
    return {
        "reply": format_task_status_reply(snapshot, user_line=user_line),
        "actions": [],
        "task_run": run,
        "orchestration_branch": "check_task_status",
        "check_task_status": dict(snapshot),
    }


__all__ = (
    "answer_check_task_status",
    "build_task_status_snapshot",
    "extract_task_run_id",
    "format_task_status_reply",
    "load_task_run_with_steps_for_principal",
    "normalize_task_run_status",
    "resolve_default_task_id",
    "resolve_task_id_from_args",
    "user_line_requests_check_task_status",
)
