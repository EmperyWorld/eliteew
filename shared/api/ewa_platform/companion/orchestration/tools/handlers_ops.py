# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Operations and planning tools: task status, operations, plans, recall memory, cancel.
# Invariants:
# - Handler module for EWA companion tool registry; behavior matches pre-split ``tool_registry.py``.
# Related:
# - api/ewa_platform/companion/orchestration/tools/registry_core.py
# - api/ewa_platform/companion/orchestration/tool_registry.py
# ---
"""EWA companion tool registry handlers — ops."""

from __future__ import annotations

import contextlib
import logging
import re
from collections.abc import Mapping
from typing import Any, Final

import asyncpg

from api.ewa_platform.companion.orchestration.tool_result_utils import as_mapping_dict
from api.ewa_platform.companion.orchestration.tools.registry_helpers import (
    _tool_router_bypass_line_match,
    companion_pg,
)
from api.ewa_platform.companion.orchestration.tools.registry_types import (
    ToolContext,
    ToolHandler,
    ToolResult,
)

logger = logging.getLogger(__name__)


_OPERATION_CANCEL_USER_LINE_RE: Final[re.Pattern[str]] = re.compile(
    r"(?ix)(?:"
    r"operation_cancel\b|"
    r"(?:отмен(?:и|ить)|останов(?:и|ить)|прекрат(?:и|ить))\s+"
    r"(?:текущ\w*\s+)?(?:операц\w*|задач\w*|генерац\w*|run|таск|трек\w*|песн\w*|картин\w*|презентац\w*)|"
    r"(?:cancel|stop|abort)\s+(?:the\s+)?(?:current\s+)?(?:operation|task|run|generation)"
    r")",
)


def _user_line_requests_operation_cancel(user_line: str) -> bool:
    return bool(_OPERATION_CANCEL_USER_LINE_RE.search(str(user_line or "")))


async def _record_instant_completed_task_run(
    *,
    ctx: ToolContext,
    intent_kind: str,
    user_message: str,
    plan_payload: Mapping[str, Any] | None = None,
    result_payload: Mapping[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Persist an immediate side-effect as a completed task-run for the operations panel.

    These tools execute inside a single chat turn (no waiting/confirmation), but we still want durable visibility in
    ``/companion-chat/task-runs`` so the UI can show non-music operations in one list together with background jobs.
    DB failures are intentionally non-fatal: primary side effect must still succeed.
    """

    pool = ctx.companion_pool
    if pool is None or not isinstance(pool, asyncpg.Pool):
        return None
    safe_user_message = str(user_message or ctx.user_line or "").strip()
    safe_plan = dict(plan_payload or {})
    safe_result = dict(result_payload or {})
    run_id = ""
    try:
        run_row = await companion_pg.companion_task_run_create(
            pool,
            principal_id=ctx.principal_id,
            intent_kind=intent_kind[:80],
            user_message=safe_user_message,
            plan_payload=safe_plan,
            status="running",
        )
        run_id = str(run_row.get("id") or "")
        done_row = await companion_pg.companion_task_run_update(
            pool,
            run_id=run_id,
            principal_id=ctx.principal_id,
            status="completed",
            result_payload=safe_result,
        )
        return done_row or run_row
    except Exception as exc:  # noqa: BLE001 - operational visibility must not break the primary tool effect
        if run_id:
            with contextlib.suppress(Exception):
                await companion_pg.companion_task_run_update(
                    pool,
                    run_id=run_id,
                    principal_id=ctx.principal_id,
                    status="failed",
                    error_payload={"message": "instant_task_run_update_failed"},
                )
        logger.info(
            "[STEP] companion_tool_instant_task_run_skip intent=%s reason=%s",
            intent_kind,
            type(exc).__name__,
        )
        return None


async def _handle_plan_v1(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    """Create a durable user plan (goals + tasks) in EWA Postgres when the line requests planning."""

    from api.ewa_platform.companion.plans.config import companion_plan_enabled
    from api.ewa_platform.companion.plans.intent import user_line_requests_plan
    from api.ewa_platform.companion.plans.refine_intent import user_line_requests_plan_refine
    from api.ewa_platform.companion.plans.schedule import line_has_schedule_signal
    from api.ewa_platform.companion.plans.service import (
        apply_plan_time_adjustment_from_user_line,
        build_plan_from_user_line,
        clarification_reply,
        plan_request_needs_clarification,
        refine_active_plan_from_user_line,
    )
    from api.ewa_platform.companion.plans.time import user_line_requests_plan_time_adjustment
    from api.ewa_platform.persistence_pg import companion_plans_asyncpg as plans_pg

    if not companion_plan_enabled():
        logger.info("[STEP] companion_tool_plan_v1_skip reason=disabled")
        return None
    user_line = str(args.get("user_line") or ctx.user_line or "").strip()
    router_bypass = _tool_router_bypass_line_match(args)
    plan_focus = str(args.get("plan_focus") or "").strip()
    horizon = str(args.get("horizon") or "").strip()
    if router_bypass and plan_focus:
        ru = any("\u0400" <= ch <= "\u04ff" for ch in plan_focus)
        if horizon:
            user_line = (
                f"Составь план на {horizon}: {plan_focus}" if ru else f"Create a plan for {horizon}: {plan_focus}"
            )
        else:
            user_line = f"Составь план: {plan_focus}" if ru else f"Create a plan: {plan_focus}"
    pool = ctx.companion_pool
    active_bundle = None
    if pool is not None:
        active_bundle = await plans_pg.plan_get_active(pool, principal_id=ctx.principal_id)
    has_active = bool(active_bundle and active_bundle.get("plan"))
    refine_line = has_active and user_line_requests_plan_refine(user_line)
    time_adjust_line = has_active and user_line_requests_plan_time_adjustment(user_line)
    create_line = user_line_requests_plan(user_line)
    if not create_line and not refine_line and not time_adjust_line and not (router_bypass and plan_focus):
        logger.info(
            "[STEP] companion_tool_plan_v1_skip reason=line_no_match line_chars=%d",
            len(user_line),
        )
        return None
    needs_clarification = plan_request_needs_clarification(user_line) and not line_has_schedule_signal(user_line)
    if router_bypass and plan_focus:
        needs_clarification = len(plan_focus) < 12
    if needs_clarification:
        return ToolResult(
            tool="plan_v1",
            status="ok",
            reply=clarification_reply(user_line),
            actions=[],
            data={"needs_clarification": True},
        )
    if pool is None:
        logger.info("[STEP] companion_tool_plan_v1_unavailable reason=no_companion_pool")
        return ToolResult(
            tool="plan_v1",
            status="unavailable",
            reply="Сейчас не могу сохранить план — база Ассистента недоступна. Попробуй чуть позже.",
            actions=[],
        )
    ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
    try:
        if time_adjust_line and has_active and not create_line:
            bundle = await apply_plan_time_adjustment_from_user_line(
                pool,
                principal_id=ctx.principal_id,
                user_line=user_line,
                active_bundle=active_bundle or {},
            )
            if bundle is None:
                return ToolResult(
                    tool="plan_v1",
                    status="ok",
                    reply=(
                        "Не нашёл время в сообщении или нет шагов для обновления. "
                        "Напиши, например: «исправь время на 10:00» или «с 9:00 до 11:00»."
                        if ru
                        else "Could not parse a time or no dated steps to update. "
                        "Try: «fix time to 10:00» or «from 9:00 to 11:00»."
                    ),
                    actions=[],
                    data={"needs_clarification": True},
                )
        elif refine_line and has_active and not create_line:
            bundle = await refine_active_plan_from_user_line(
                pool,
                principal_id=ctx.principal_id,
                user_line=user_line,
                active_bundle=active_bundle or {},
            )
        else:
            bundle = await build_plan_from_user_line(
                pool,
                principal_id=ctx.principal_id,
                user_line=user_line,
            )
        if bundle is None:
            return ToolResult(
                tool="plan_v1",
                status="ok",
                reply=clarification_reply(user_line),
                actions=[],
                data={"needs_clarification": True},
            )
    except Exception as exc:
        logger.warning("[STEP] companion_tool_plan_v1_error err=%s", type(exc).__name__)
        ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
        return ToolResult(
            tool="plan_v1",
            status="error",
            reply=(
                "Не получилось сохранить план — попробуй переформулировать короче."
                if ru
                else "Could not save the plan — try a shorter request."
            ),
            actions=[],
        )
    ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
    reply = plans_pg.format_plan_markdown_reply(bundle, ru=ru)
    plan = as_mapping_dict(bundle.get("plan"))
    plan_id = str(plan.get("id") or "").strip()
    if plan_id:
        from api.ewa_platform.companion.plans.meta_schedule import schedule_companion_meta_from_plan

        schedule_companion_meta_from_plan(principal_id=ctx.principal_id, plan_id=plan_id)
    return ToolResult(
        tool="plan_v1",
        status="ok",
        reply=reply,
        actions=[],
        data={"plan_id": plan_id},
    )


async def _handle_calendar_v1(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    """List or create personal CalendarApp events (main Postgres), never assistant-plan rows."""

    from api.ewa_platform.companion.calendar.intent import (
        user_line_requests_calendar_create,
        user_line_requests_calendar_list,
    )
    from api.ewa_platform.companion.calendar.prompt import format_user_calendar_prompt_block
    from api.ewa_platform.companion.calendar.service import (
        CalendarPolicyError,
        create_personal_calendar_event,
        list_upcoming_personal_calendar_events,
        parse_calendar_create_draft,
        principal_to_desktop_user_id,
    )
    from api.ewa_platform.companion.orchestration.tools.registry_helpers import _resolve_main_pool

    user_line = str(args.get("user_line") or ctx.user_line or "").strip()
    title_override = str(args.get("title") or "").strip()
    list_line = user_line_requests_calendar_list(user_line)
    create_line = user_line_requests_calendar_create(user_line)
    if list_line:
        create_line = False
    if not create_line and not list_line:
        logger.info(
            "[STEP] companion_tool_calendar_v1_skip reason=line_no_match line_chars=%d",
            len(user_line),
        )
        return None
    ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
    user_id = principal_to_desktop_user_id(ctx.principal_id)
    if user_id is None:
        logger.info("[STEP] companion_tool_calendar_v1_skip reason=principal_not_uuid")
        return ToolResult(
            tool="calendar_v1",
            status="unavailable",
            reply=(
                "Сейчас не могу открыть календарь — не совпал аккаунт. Открой Календарь на столе."
                if ru
                else "I cannot open the calendar for this account. Open Calendar on the desk."
            ),
            actions=[],
        )
    try:
        pool = await _resolve_main_pool(ctx)
    except Exception as exc:  # noqa: BLE001 — tool must not crash the turn
        logger.warning("[STEP] companion_tool_calendar_v1_error err=%s", type(exc).__name__)
        return ToolResult(
            tool="calendar_v1",
            status="unavailable",
            reply=(
                "Календарь сейчас недоступен. Попробуй чуть позже или открой Календарь на столе."
                if ru
                else "The calendar is unavailable right now. Try again shortly, or open Calendar on the desk."
            ),
            actions=[],
        )
    if create_line:
        draft = parse_calendar_create_draft(user_line, title_override=title_override or None)
        if draft is None:
            return ToolResult(
                tool="calendar_v1",
                status="ok",
                reply=(
                    "Напиши название и время — например: «добавь в календарь встречу завтра в 12:00»."
                    if ru
                    else "Send a title and time — for example: «add a meeting to the calendar tomorrow at 12:00»."
                ),
                actions=[],
                data={"needs_clarification": True},
            )
        try:
            created = await create_personal_calendar_event(
                pool,
                user_id=user_id,
                title=str(draft["title"]),
                notes=str(draft.get("notes") or ""),
                starts_at=draft["starts_at"],
                ends_at=draft["ends_at"],
                all_day=bool(draft.get("all_day")),
            )
        except CalendarPolicyError:
            return ToolResult(
                tool="calendar_v1",
                status="ok",
                reply=(
                    "Не получилось сохранить событие — проверь название и интервал времени."
                    if ru
                    else "Could not save the event — check the title and time range."
                ),
                actions=[],
                data={"needs_clarification": True},
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("[STEP] companion_tool_calendar_v1_create_error err=%s", type(exc).__name__)
            return ToolResult(
                tool="calendar_v1",
                status="error",
                reply=(
                    "Не получилось записать событие в календарь. Попробуй ещё раз или добавь его в Календаре."
                    if ru
                    else "Could not save the event. Try again, or add it in Calendar."
                ),
                actions=[],
            )
        local_label = str(draft.get("local_label") or created.get("title") or "")
        return ToolResult(
            tool="calendar_v1",
            status="ok",
            reply=(
                f"Записала в календарь: {created.get('title')} ({local_label}). Могу помочь подготовиться."
                if ru
                else f"Saved to your calendar: {created.get('title')} ({local_label}). I can help you prepare."
            ),
            actions=[],
            data={"event_id": created.get("id"), "created": True},
        )
    try:
        events = await list_upcoming_personal_calendar_events(pool, user_id=user_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] companion_tool_calendar_v1_list_error err=%s", type(exc).__name__)
        return ToolResult(
            tool="calendar_v1",
            status="error",
            reply=(
                "Не получилось прочитать календарь. Открой Календарь на столе — события там."
                if ru
                else "Could not read the calendar. Open Calendar on the desk to see your events."
            ),
            actions=[],
        )
    if not events:
        return ToolResult(
            tool="calendar_v1",
            status="ok",
            reply=(
                "В ближайшие дни личных событий в календаре нет. Могу добавить встречу или помочь с шагами плана."
                if ru
                else "No personal events in the next few days. I can add one, or help with your assistant plan."
            ),
            actions=[],
            data={"events": []},
        )
    digest = format_user_calendar_prompt_block(events)
    visible = [line[2:] for line in digest.splitlines() if line.startswith("- ")]
    header = "В календаре:" if ru else "On your calendar:"
    offer = (
        "Могу помочь подготовиться к ближайшему событию — скажи, с чего начать."
        if ru
        else "I can help you prepare for the next one — tell me where to start."
    )
    return ToolResult(
        tool="calendar_v1",
        status="ok",
        reply="\n".join([header, *visible, offer]),
        actions=[],
        data={"events": [{"id": row.get("id"), "title": row.get("title")} for row in events]},
    )


async def _handle_plan_task_complete_v1(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    """Mark an active-plan task completed when the user confirms in chat."""

    from api.ewa_platform.companion.plans.config import companion_plan_enabled
    from api.ewa_platform.companion.plans.task_complete_intent import (
        match_open_plan_task,
        user_line_requests_plan_task_complete,
    )
    from api.ewa_platform.persistence_pg import companion_plans_asyncpg as plans_pg

    if not companion_plan_enabled():
        return None
    user_line = str(args.get("user_line") or ctx.user_line or "").strip()
    router_bypass = _tool_router_bypass_line_match(args)
    task_hint = str(args.get("task_hint") or "").strip()
    if router_bypass and task_hint:
        user_line = f"отметь выполненным: {task_hint}"
    elif not user_line_requests_plan_task_complete(user_line):
        return None
    pool = ctx.companion_pool
    if pool is None:
        return ToolResult(
            tool="plan_task_complete_v1",
            status="unavailable",
            reply="Сейчас не могу обновить план — база Ассистента недоступна.",
            actions=[],
        )
    bundle = await plans_pg.plan_get_active(pool, principal_id=ctx.principal_id)
    if not bundle:
        ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
        return ToolResult(
            tool="plan_task_complete_v1",
            status="error",
            reply=("Нет активного плана — сначала попроси составить план." if ru else "No active plan."),
            actions=[],
        )
    tasks = [t for t in (bundle.get("tasks") or []) if isinstance(t, Mapping)]
    open_tasks = [t for t in tasks if str(t.get("status")) not in ("completed", "cancelled")]
    if not open_tasks:
        ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
        return ToolResult(
            tool="plan_task_complete_v1",
            status="ok",
            reply=("Все шаги уже отмечены." if ru else "All steps are already done."),
            actions=[],
        )
    matched = match_open_plan_task(open_tasks, user_line)
    if matched is None:
        ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
        return ToolResult(
            tool="plan_task_complete_v1",
            status="error",
            reply=(
                "Не нашла такой шаг в активном плане — назови точнее название шага."
                if ru
                else "Could not match that step in the active plan."
            ),
            actions=[],
        )
    task_id = str(matched.get("id") or "")
    updated = await plans_pg.plan_task_complete(pool, principal_id=ctx.principal_id, task_id=task_id)
    if not updated:
        return ToolResult(
            tool="plan_task_complete_v1",
            status="error",
            reply="Не удалось обновить шаг.",
            actions=[],
        )
    ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
    reply = plans_pg.format_plan_markdown_reply(updated, ru=ru)
    return ToolResult(
        tool="plan_task_complete_v1",
        status="ok",
        reply=reply,
        actions=[],
        data={"task_id": task_id},
    )


async def _handle_recall_memory(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    """Truthful memory/capability answer when the user asks what the companion remembers."""

    from api.ewa_platform.companion.episodic.task_outcome import TASK_OUTCOME_KIND
    from api.ewa_platform.companion.memory.hcm_store import (
        COMPANION_MEMORY_DISPLAY_MAX_LINES,
        companion_memory_display_lines,
    )
    from api.ewa_platform.companion.orchestration.tool_result_utils import as_mapping_dict
    from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg
    from api.ewa_platform.persistence_pg.episodes_asyncpg import episodes_recent_for_principal

    _MEMORY_QUESTION_RE = re.compile(
        r"(?is)(?:что\s+(?:ты\s+)?(?:помнишь|знаешь)|что\s+у\s+тебя\s+(?:есть\s+)?в\s+базе|"
        r"что\s+мы\s+(?:делали|сделали)|какие\s+задач|"
        r"what\s+do\s+you\s+remember|what\s+(?:did|have)\s+we\s+(?:do|done)|past\s+tasks?)"
    )

    user_line = str(args.get("user_line") or ctx.user_line or "").strip()
    if not user_line:
        return None
    bypass = bool(args.get("_intent_planner_bypass_line_match")) or _tool_router_bypass_line_match(args)
    if not bypass and not _MEMORY_QUESTION_RE.search(user_line):
        return None

    pool = ctx.companion_pool
    if pool is None:
        return None

    profile = await companion_pg.companion_profile_fetch(pool, principal_id=ctx.principal_id)
    if profile is None:
        return None

    learned = as_mapping_dict(profile.get("learned_preferences"))
    lines = companion_memory_display_lines(learned, max_lines=COMPANION_MEMORY_DISPLAY_MAX_LINES)
    task_rows: list[dict[str, Any]] = []
    try:
        task_rows = await episodes_recent_for_principal(
            pool,
            principal_id=ctx.principal_id,
            limit=5,
            kinds=[TASK_OUTCOME_KIND],
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[STEP] recall_memory_task_outcome_failed principal=%s err=%s",
            ctx.principal_id,
            exc,
        )

    ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
    if ru:
        body = "В моей EWA-памяти сейчас есть:\n"
        body += "\n".join(f"- {line}" for line in lines) if lines else "- Пока нет устойчивых фактов или предпочтений."
        body += "\n\nНедавние задачи:\n"
        if task_rows:
            for row in task_rows:
                first = str(row.get("body") or "").strip().split("\n", 1)[0].strip()
                if first:
                    body += f"- {first[:400]}\n"
        else:
            body += "- Пока нет записанных завершённых задач в эпизодической памяти.\n"
        body += (
            "\nЯ могу работать с файлами через безопасный Runtime Gateway: показывать каталог, искать по названию и "
            "содержимому, открывать файловый менеджер/DocEditor и выполнять подтверждённые правки. Если текст файла не "
            "извлечён или действие требует подтверждения, я должна сказать это прямо."
        )
    else:
        body = "In my EWA memory right now:\n"
        body += "\n".join(f"- {line}" for line in lines) if lines else "- No durable facts or preferences yet."
        body += "\n\nRecent tasks:\n"
        if task_rows:
            for row in task_rows:
                first = str(row.get("body") or "").strip().split("\n", 1)[0].strip()
                if first:
                    body += f"- {first[:400]}\n"
        else:
            body += "- No completed tasks recorded in episodic memory yet.\n"
        body += (
            "\nI can use the safe Runtime Gateway for file lists, metadata/body search, File manager/DocEditor "
            "opens, and confirmed edits. If text is not extracted or an action needs confirmation, I should say so."
        )
    return ToolResult(
        tool="recall_memory", status="ok", reply=body, actions=[], data={"task_outcome_count": len(task_rows)}
    )


async def _handle_check_task_status(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    """Return ground-truth status for one durable companion task run (``check_task_status``)."""

    from api.ewa_platform.companion.orchestration.check_task_status import (
        answer_check_task_status,
        resolve_task_id_from_args,
        user_line_requests_check_task_status,
    )

    user_line = str(args.get("user_line") or ctx.user_line or "")
    task_id = resolve_task_id_from_args(args, user_line)
    router_bypass = _tool_router_bypass_line_match(args)
    if router_bypass and task_id and not user_line_requests_check_task_status(user_line, task_id=task_id):
        user_line = f"check_task_status run_id={task_id}"
    if not user_line_requests_check_task_status(user_line, task_id=task_id) and not (router_bypass and task_id):
        return None

    pool = ctx.companion_pool
    if pool is None:
        ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
        return ToolResult(
            tool="check_task_status",
            status="unavailable",
            reply=(
                "Не могу проверить статус задачи — нет доступа к базе операций. Попробуй через «Текущие операции»."
                if ru
                else "I cannot check task status — companion database is unavailable. Use Current operations."
            ),
            actions=[],
            data={},
            task_run=None,
        )

    outcome = await answer_check_task_status(
        pool,
        principal_id=ctx.principal_id,
        user_line=user_line,
        args=args,
    )
    if outcome is None:
        return None

    payload = outcome.get("check_task_status")
    data = dict(payload) if isinstance(payload, Mapping) else {}
    task_run = outcome.get("task_run")
    return ToolResult(
        tool="check_task_status",
        status="ok",
        reply=str(outcome.get("reply") or ""),
        actions=list(outcome.get("actions") or []),
        data=data,
        task_run=dict(task_run) if isinstance(task_run, Mapping) else None,
    )


async def _handle_operations_status(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    """Return active companion operations summary from durable runs."""

    from api.ewa_platform.companion.orchestration.active_task_runs_prompt import (
        answer_active_operations_status,
        format_active_operations_status_reply,
        load_active_task_runs_with_steps,
        user_line_asks_active_operations_status,
    )

    user_line = str(args.get("user_line") or ctx.user_line or "")
    router_bypass = _tool_router_bypass_line_match(args)
    if not user_line_asks_active_operations_status(user_line) and not router_bypass:
        return None

    pool = ctx.companion_pool
    if pool is None:
        ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
        return ToolResult(
            tool="operations_status",
            status="unavailable",
            reply=(
                "Не могу проверить текущие операции — база Ассистента сейчас недоступна."
                if ru
                else "I cannot check current operations because the companion database is unavailable."
            ),
            actions=[],
            data={},
            task_run=None,
        )

    if router_bypass:
        runs = await load_active_task_runs_with_steps(pool, principal_id=ctx.principal_id)
        return ToolResult(
            tool="operations_status",
            status="ok",
            reply=format_active_operations_status_reply(runs, user_line=user_line),
            actions=[],
            data={"active_count": len(runs)},
            task_run=dict(runs[0]) if runs else None,
        )

    outcome = await answer_active_operations_status(
        pool,
        principal_id=ctx.principal_id,
        user_line=user_line,
    )
    if outcome is None:
        return None
    task_run = outcome.get("task_run")
    data: dict[str, Any] = {}
    if isinstance(task_run, Mapping):
        data["active_count"] = 1
    return ToolResult(
        tool="operations_status",
        status="ok",
        reply=str(outcome.get("reply") or ""),
        actions=list(outcome.get("actions") or []),
        data=data,
        task_run=dict(task_run) if isinstance(task_run, Mapping) else None,
    )


async def _handle_operation_cancel(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    """Cancel the latest (or explicit) cancellable companion run for this principal."""

    from api.ewa_platform.companion.orchestration.check_task_status import resolve_task_id_from_args

    def _is_companion_task_run_cancellable(run_row: Mapping[str, Any]) -> bool:
        status = str(run_row.get("status") or "").strip().lower()
        return status in {"pending", "running", "awaiting_confirmation"}

    user_line = str(args.get("user_line") or ctx.user_line or "")
    router_bypass = _tool_router_bypass_line_match(args)
    cancel_intent = _user_line_requests_operation_cancel(user_line)
    explicit_run_id = resolve_task_id_from_args(args, "")
    if not cancel_intent and not router_bypass:
        return None
    run_id = explicit_run_id or (resolve_task_id_from_args({}, user_line) if cancel_intent else "")

    pool = ctx.companion_pool
    if pool is None:
        ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
        return ToolResult(
            tool="operation_cancel",
            status="unavailable",
            reply=(
                "Не могу отменить операцию — база Ассистента сейчас недоступна."
                if ru
                else "I cannot cancel the operation because the companion database is unavailable."
            ),
            actions=[],
            data={},
            task_run=None,
        )

    run: Mapping[str, Any] | None = None
    if run_id:
        run = await companion_pg.companion_task_run_fetch_for_principal(
            pool,
            run_id=run_id,
            principal_id=ctx.principal_id,
        )
    else:
        rows = await companion_pg.companion_task_runs_list(pool, principal_id=ctx.principal_id, limit=20)
        run = next((row for row in rows if _is_companion_task_run_cancellable(row)), None)

    ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
    if run is None:
        return ToolResult(
            tool="operation_cancel",
            status="ok",
            reply=(
                "Сейчас нет активной операции, которую можно отменить."
                if ru
                else "There is no active operation to cancel right now."
            ),
            actions=[],
            data={"cancelled": False, "reason": "no_active_run"},
            task_run=None,
        )

    run_status = str(run.get("status") or "").strip().lower()
    if not _is_companion_task_run_cancellable(run):
        if run_status == "cancelled":
            reply = "Эта операция уже отменена." if ru else "This operation is already cancelled."
        elif run_status in {"completed", "failed"}:
            reply = (
                "Эта операция уже завершилась — просто обновила статус."
                if ru
                else "This operation already finished — I only refreshed the status."
            )
        else:
            reply = "Эту операцию нельзя отменить через чат." if ru else "This operation cannot be cancelled from chat."
        return ToolResult(
            tool="operation_cancel",
            status="ok",
            reply=reply,
            actions=[],
            data={"cancelled": False, "reason": "not_cancellable", "run_status": run_status},
            task_run=dict(run),
        )

    try:
        from api.ewa_platform.companion.orchestration.task_run_cancel import (
            cancel_companion_task_run_for_user,
        )
    except ModuleNotFoundError:
        return ToolResult(
            tool="operation_cancel",
            status="unavailable",
            reply=(
                "Не могу отменить операцию: модуль отмены недоступен в текущем рантайме."
                if ru
                else "I cannot cancel the operation because the cancellation module is unavailable in this runtime."
            ),
            actions=[],
            data={"cancelled": False, "reason": "cancel_module_unavailable"},
            task_run=dict(run),
        )

    from api.core.database_manager import DatabaseConnectionError, get_database_manager

    try:
        manager = await get_database_manager()
    except DatabaseConnectionError:
        return ToolResult(
            tool="operation_cancel",
            status="unavailable",
            reply=(
                "Не получилось отменить операцию: основная база сейчас недоступна."
                if ru
                else "I could not cancel the operation because the main database is unavailable."
            ),
            actions=[],
            data={"cancelled": False, "reason": "database_unavailable"},
            task_run=dict(run),
        )

    oauth_user_id = str(getattr(ctx.auth_user, "id", "") or "").strip() or None
    async with manager.get_postgres_session() as db:
        outcome = await cancel_companion_task_run_for_user(
            pool,
            db,
            run=run,
            oauth_user_id=oauth_user_id,
        )

    run_id = str(run.get("id") or "").strip()
    refreshed = await companion_pg.companion_task_run_fetch_for_principal(
        pool,
        run_id=run_id,
        principal_id=ctx.principal_id,
    )
    task_run: dict[str, Any] | None = None
    if isinstance(refreshed, Mapping):
        task_run = dict(refreshed)
        task_run["steps"] = await companion_pg.companion_task_steps_list(pool, run_id=run_id)
    else:
        task_run = dict(run)

    status_now = str((task_run or {}).get("status") or "").strip().lower()
    if status_now == "cancelled":
        reply = "Отменила операцию." if ru else "Cancelled the operation."
    elif status_now in {"completed", "failed"}:
        reply = "Задача уже завершилась — статус обновлён." if ru else "The task already finished — status refreshed."
    else:
        reply = "Не удалось отменить задачу." if ru else "Could not cancel the task."

    cancelled = status_now == "cancelled"
    return ToolResult(
        tool="operation_cancel",
        status="ok" if cancelled or bool(outcome.get("ok")) else "error",
        reply=reply,
        actions=[],
        data={
            "cancelled": cancelled,
            "run_id": run_id,
            "ugs_requests_cancelled": int(outcome.get("ugs_requests_cancelled") or 0),
        },
        task_run=task_run,
    )


HANDLERS: Final[dict[str, ToolHandler]] = {
    "plan_v1": _handle_plan_v1,
    "plan_task_complete_v1": _handle_plan_task_complete_v1,
    "calendar_v1": _handle_calendar_v1,
    "recall_memory": _handle_recall_memory,
    "check_task_status": _handle_check_task_status,
    "operations_status": _handle_operations_status,
    "operation_cancel": _handle_operation_cancel,
}

# Re-exported via ``tool_registry`` shim (``handlers_desktop`` lazy import).
_SHIM_EXPORTS = (_record_instant_completed_task_run,)
