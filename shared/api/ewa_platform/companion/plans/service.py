# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Build a persisted companion plan from a user line (rule-based default, optional LLM JSON).
# Invariants:
# - Requires ``companion_pool`` (EWA Postgres); never writes to main DB.
# Related:
# - api/ewa_platform/persistence_pg/companion_plans_asyncpg.py
# ---

from __future__ import annotations

import json
import logging
import os
import re
from datetime import date, timedelta
from typing import Any

import asyncpg

from api.ewa_platform.companion.plans.config import companion_plan_llm_enabled
from api.ewa_platform.companion.plans.schedule import (
    line_has_schedule_signal,
    try_daily_sprint_schedule_structure,
)
from api.ewa_platform.companion.plans.topic import extract_plan_topic_from_user_line
from api.ewa_platform.persistence_pg import companion_plans_asyncpg as plans_pg

logger = logging.getLogger(__name__)

_BULLET_RE = re.compile(r"(?m)^\s*[-*•]\s+(.+)$")


def plan_request_needs_clarification(user_line: str) -> bool:
    """True when the user asks for a plan but gives almost no topic (avoid invented goals)."""

    from api.ewa_platform.companion.plans.intent import user_line_requests_plan

    if not user_line_requests_plan(user_line):
        return False
    if line_has_schedule_signal(user_line):
        return False
    return len(extract_plan_topic_from_user_line(user_line)) < 12


def clarification_reply(user_line: str) -> str:
    ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
    if ru:
        return (
            "Могу составить план и сохранить его на сервере. Уточни, пожалуйста: **на что именно** "
            "план (проект, срок, 2–3 цели)? Например: «план на 2 недели: запуск фичи companion plans»."
        )
    return (
        "I can build and save a plan on the server. What should it focus on "
        "(project, deadline, 2–3 goals)? Example: “2-week plan: ship companion plans feature.”"
    )


_DAILY_DOC_STUDY_RE = re.compile(
    r"(?is)(?:\d+|один|one|1)\s*(?:-\s*)?(?:документ\w*|doc\w*).{0,40}(?:в\s+день|/день|per\s+day|each\s+day|a\s+day)"
    r"|(?:в\s+день|per\s+day).{0,40}(?:\d+|один|one|1)\s*(?:-\s*)?(?:документ\w*|doc\w*)"
)
_DOC_COUNT_RE = re.compile(r"(?is)(?:всего|итого)?\s*(?:будет\s*)?(\d+)\s*(?:-\s*)?(?:док\w*|doc\w*)")
_DOC_COUNT_WORDS: dict[str, int] = {
    "два": 2,
    "две": 2,
    "три": 3,
    "четыре": 4,
    "пять": 5,
    "шесть": 6,
    "семь": 7,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
}


def _extract_daily_doc_study_count(user_line: str) -> int | None:
    """Return N when the user asks to study N documents one per day."""

    line = user_line or ""
    if not _DAILY_DOC_STUDY_RE.search(line):
        return None
    total_m = re.search(
        r"(?is)(?:всего|итого).{0,24}(?:будет\s*)?(\d+)\s*(?:-\s*)?(?:док\w*|doc\w*)",
        line,
    )
    if total_m:
        count = int(total_m.group(1))
        return count if 2 <= count <= 31 else None
    m = _DOC_COUNT_RE.search(line)
    if m:
        count = int(m.group(1))
        return count if 2 <= count <= 31 else None
    m = re.search(r"(?is)(\d+)\s*(?:-\s*)?(?:док\w*|doc\w*)", line)
    if m:
        count = int(m.group(1))
        return count if 2 <= count <= 31 else None
    lower = line.lower()
    for word, count in _DOC_COUNT_WORDS.items():
        if re.search(rf"(?is)\b{re.escape(word)}\s*(?:-\s*)?(?:док\w*|doc\w*)", lower):
            return count
    return None


def _study_topic_label(user_line: str, *, topic: str) -> str:
    lower = (user_line or "").lower()
    if "бассейн" in lower:
        return "документы бассейна"
    cleaned = topic.strip()
    return cleaned[:120] if cleaned else "материалы"


def _try_study_schedule_structure(
    user_line: str,
) -> tuple[str, list[dict[str, Any]], list[dict[str, Any]]] | None:
    count = _extract_daily_doc_study_count(user_line)
    if count is None:
        return None
    topic = extract_plan_topic_from_user_line(user_line)
    label = _study_topic_label(user_line, topic=topic)
    title = f"Изучение: {label} ({count} дней)"
    goals = [
        {
            "title": f"Изучить {label} — {count} документов по одному в день",
            "category": "learning",
            "sort_order": 0,
        }
    ]
    start = date.today()
    tasks: list[dict[str, Any]] = []
    for i in range(count):
        tasks.append(
            {
                "title": f"День {i + 1}: изучить документ {i + 1} из {count}",
                "description": label,
                "goal_index": 0,
                "sort_order": i,
                "due_date": (start + timedelta(days=i)).isoformat(),
            }
        )
    return title, goals, tasks


def _extract_json_object(text: str) -> dict[str, Any] | None:
    raw = (text or "").strip()
    if not raw:
        return None
    if raw.startswith("```"):
        raw = re.sub(r"(?is)^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```\s*$", "", raw)
    start = raw.find("{")
    if start < 0:
        return None
    depth = 0
    for idx in range(start, len(raw)):
        ch = raw[idx]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    data = json.loads(raw[start : idx + 1])
                except json.JSONDecodeError:
                    return None
                return data if isinstance(data, dict) else None
    return None


def _normalize_task_due_dates(
    tasks: list[dict[str, Any]],
    *,
    reference_today: date | None = None,
) -> list[dict[str, Any]]:
    ref = reference_today or date.today()
    for task in tasks:
        due = task.get("due_date")
        if not isinstance(due, str) or not due.strip():
            continue
        try:
            parsed = date.fromisoformat(due.strip()[:10])
        except ValueError:
            continue
        if parsed.year < ref.year - 1 or parsed.year > ref.year + 1:
            try:
                parsed = parsed.replace(year=ref.year)
            except ValueError:
                parsed = date(ref.year, parsed.month, min(parsed.day, 28))
            task["due_date"] = parsed.isoformat()
    return tasks


def _structure_plan_from_user_line(user_line: str) -> tuple[str, list[dict[str, Any]], list[dict[str, Any]]]:
    daily = try_daily_sprint_schedule_structure(user_line)
    if daily is not None:
        return daily
    return _rule_based_structure(user_line)


def _rule_based_structure(user_line: str) -> tuple[str, list[dict[str, Any]], list[dict[str, Any]]]:
    study = _try_study_schedule_structure(user_line)
    if study is not None:
        return study
    daily = try_daily_sprint_schedule_structure(user_line)
    if daily is not None:
        return daily
    topic = extract_plan_topic_from_user_line(user_line)
    title = (topic[:120] if len(topic) >= 12 else user_line.strip()[:120]) or "План"
    bullets = [m.group(1).strip() for m in _BULLET_RE.finditer(user_line) if m.group(1).strip()]
    goals: list[dict[str, Any]] = []
    tasks: list[dict[str, Any]] = []
    if bullets:
        for i, b in enumerate(bullets[:6]):
            goals.append({"title": b[:200], "category": "general", "sort_order": i})
            tasks.append({"title": f"Сделать: {b[:180]}", "goal_index": i, "sort_order": i})
    elif len(topic) >= 12:
        goals = [
            {"title": topic[:200], "category": "general", "sort_order": 0},
            {"title": "Подготовка и первые шаги", "category": "operations", "sort_order": 1},
        ]
        tasks = [
            {
                "title": f"Уточнить критерии успеха: {topic[:100]}",
                "goal_index": 0,
                "sort_order": 0,
            },
            {"title": "Выполнить первый ощутимый шаг", "goal_index": 0, "sort_order": 1},
            {
                "title": "Зафиксировать результат и следующий шаг",
                "goal_index": 1,
                "sort_order": 2,
            },
        ]
    else:
        goals = [
            {"title": "Главная цель", "category": "general", "sort_order": 0},
            {"title": "Подготовка и уточнение", "category": "operations", "sort_order": 1},
        ]
        tasks = [
            {"title": "Уточнить критерии успеха", "goal_index": 0, "sort_order": 0},
            {"title": "Выполнить первый ощутимый шаг", "goal_index": 0, "sort_order": 1},
            {"title": "Зафиксировать результат и следующий шаг", "goal_index": 1, "sort_order": 2},
        ]
    return title, goals, tasks


async def _llm_structure_plan(user_line: str) -> tuple[str, list[dict[str, Any]], list[dict[str, Any]]] | None:
    """Optional LLM JSON; returns None on failure (caller falls back to rules)."""

    if not companion_plan_llm_enabled():
        return None
    try:
        import httpx

        from api.core.unified_config import unified_settings
        from api.utils.llm_openai_compat_http import httpx_compat_chat_completion_json

        base_url = str(unified_settings.llama_url or "").strip()
        if not base_url:
            return None
        model = (
            os.getenv("EWA_COMPANION_PLAN_MODEL", "").strip()
            or os.getenv("EWA_COMPANION_CHAT_MODEL", "").strip()
            or "default"
        )
        prompt = (
            "Ответ — JSON-объект (сервер llama.cpp ограничивает синтаксис JSON):\n"
            '{"title":"...","goals":[{"title":"..."}],"tasks":[{"title":"...","goal_index":0,"due_date":"YYYY-MM-DD"}]}\n'
            "Правила: цели и шаги только из запроса пользователя; не выдумывай посторонние темы "
            "(фитнес, программирование), если пользователь их не просил. "
            "Каждый task обязан иметь goal_index (0-based). "
            "Если пользователь просит «N документов по одному в день» — создай N шагов с due_date по дням.\n"
            f"Запрос пользователя: {user_line[:2000]}"
        )
        timeout = httpx.Timeout(60.0, connect=10.0)
        async with httpx.AsyncClient() as client:
            out = await httpx_compat_chat_completion_json(
                client,
                base_url,
                model=model,
                messages=[{"role": "user", "content": prompt}],
                options={"temperature": 0.1, "num_predict": 1200},
                response_format={"type": "json_object"},
                chat_template_kwargs={"enable_thinking": False},
                timeout=timeout,
            )
        text = str(out.get("response") or "").strip()
        data = _extract_json_object(text)
        if data is None:
            raise json.JSONDecodeError("plan_structure_empty", text, 0)
        title = str(data.get("title") or "План")[:200]
        goals_list = data.get("goals")
        goals_raw: list[Any] = goals_list if isinstance(goals_list, list) else []
        tasks_list = data.get("tasks")
        tasks_raw: list[Any] = tasks_list if isinstance(tasks_list, list) else []
        goals = [g for g in goals_raw if isinstance(g, dict) and g.get("title")]
        tasks = [t for t in tasks_raw if isinstance(t, dict) and t.get("title")]
        if not goals:
            return None
        _normalize_task_due_dates(tasks)
        return title, goals, tasks
    except Exception as exc:
        logger.info("[STEP] companion_plan_llm_structure_failed err=%s", type(exc).__name__)
        return None


async def _resolve_plan_structure(
    user_line: str,
) -> tuple[str, list[dict[str, Any]], list[dict[str, Any]]]:
    structured = await _llm_structure_plan(user_line)
    if structured is not None:
        title, goals, tasks = structured
        if line_has_schedule_signal(user_line) and not any(t.get("due_date") for t in tasks):
            fallback = try_daily_sprint_schedule_structure(user_line)
            if fallback is not None:
                return fallback
        return title, goals, tasks
    return _structure_plan_from_user_line(user_line)


async def build_plan_from_user_line(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    user_line: str,
    source_turn_id: str | None = None,
) -> dict[str, Any] | None:
    if plan_request_needs_clarification(user_line) and not line_has_schedule_signal(user_line):
        return None
    title, goals, tasks = await _resolve_plan_structure(user_line)
    return await plans_pg.plan_create_full(
        pool,
        principal_id=principal_id,
        title=title,
        description=user_line[:4000],
        goals=goals,
        tasks=tasks,
        source_turn_id=source_turn_id,
        metadata={"source": "plan_v1"},
    )


async def apply_plan_time_adjustment_from_user_line(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    user_line: str,
    active_bundle: dict[str, Any],
) -> dict[str, Any] | None:
    from api.ewa_platform.companion.plans.time import parse_plan_time_adjustment

    plan = active_bundle.get("plan")
    if not isinstance(plan, dict):
        return None
    plan_id = str(plan.get("id") or "").strip()
    if not plan_id:
        return None
    adjustment = parse_plan_time_adjustment(user_line)
    if adjustment is None:
        return None
    try:
        return await plans_pg.plan_apply_time_adjustment(
            pool,
            plan_id=plan_id,
            principal_id=principal_id,
            due_time=adjustment.due_time,
            duration_minutes=adjustment.duration_minutes,
            scope=adjustment.scope,
        )
    except LookupError:
        return None


async def refine_active_plan_from_user_line(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    user_line: str,
    active_bundle: dict[str, Any],
    source_turn_id: str | None = None,
) -> dict[str, Any] | None:
    plan = active_bundle.get("plan")
    if not isinstance(plan, dict):
        return None
    plan_id = str(plan.get("id") or "").strip()
    if not plan_id:
        return None
    if plan_request_needs_clarification(user_line) and not line_has_schedule_signal(user_line):
        return None
    title, goals, tasks = await _resolve_plan_structure(user_line)
    return await plans_pg.plan_replace_content(
        pool,
        plan_id=plan_id,
        principal_id=principal_id,
        title=title,
        description=user_line[:4000],
        goals=goals,
        tasks=tasks,
        source_turn_id=source_turn_id,
        metadata={"source": "plan_v1_refine"},
    )


__all__ = (
    "apply_plan_time_adjustment_from_user_line",
    "build_plan_from_user_line",
    "clarification_reply",
    "extract_plan_topic_from_user_line",
    "plan_request_needs_clarification",
    "refine_active_plan_from_user_line",
)
