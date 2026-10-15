# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Bootstrap a new agentic session from user goal text and enqueue first loop tick.
# Invariants:
# - Respects EWA_AGENTIC_SUBSTRATE_ENABLED; one active session per principal (DB partial unique index).
# Related:
# - api/ewa_platform/agentic/jobs/enqueue.py
# ---

from __future__ import annotations

import logging
import re
from collections.abc import Mapping
from typing import Any

import asyncpg

from api.ewa_platform.agentic.adapters.task_run_events import sync_and_publish_task_run_from_session
from api.ewa_platform.agentic.adapters.task_run_mirror import create_task_run_mirror
from api.ewa_platform.agentic.budget import merge_default_budget
from api.ewa_platform.agentic.config import agentic_async_jobs_enabled, agentic_substrate_enabled
from api.ewa_platform.agentic.goal_json import build_goal_json_v2
from api.ewa_platform.agentic.jobs.enqueue import enqueue_agentic_loop_tick
from api.ewa_platform.agentic.kernel import state_machine as fsm
from api.ewa_platform.agentic.kernel.loop import run_agentic_loop_tick
from api.ewa_platform.persistence_pg import agentic_asyncpg as agentic_pg

logger = logging.getLogger(__name__)

_AGENTIC_START_PREFIX = "/agent "
_AUTO_START_MIN_CHARS = 900
_AUTO_START_MARKERS: tuple[str, ...] = (
    "результат",
    "план",
    "задач",
    "документ",
    "дорожн",
    "презентац",
    "исслед",
    "рынок",
    "аудит",
    "пошагово",
    "соглас",
    "смотри в папке",
    "изучи",
    "задай вопросы",
    "work plan",
    "roadmap",
    "research",
    "document",
    "tasks",
)
_AUTO_START_STRUCTURE_RE = re.compile(r"(?im)(?:^|\n)\s*(?:\d+[\).]|[АБВГДЕРСТABCD][\).])\s+")


def user_line_requests_agentic_start(user_line: str) -> bool:
    line = str(user_line or "").strip()
    if line.lower().startswith(_AGENTIC_START_PREFIX):
        return True
    return line.lower().startswith("agentic:")


def user_line_requests_agentic_work_session(user_line: str) -> bool:
    """Detect a long multi-step work-session prompt that should enter agentic mode.

    This is an intake gate only. The Think engine still owns decomposition and execution.
    """

    line = str(user_line or "").strip()
    if user_line_requests_agentic_start(line):
        return True
    if len(line) < _AUTO_START_MIN_CHARS:
        return False

    lower = line.lower()
    marker_hits = sum(1 for marker in _AUTO_START_MARKERS if marker in lower)
    structure_hits = len(_AUTO_START_STRUCTURE_RE.findall(line))
    has_artifact_request = any(token in lower for token in ("документ", "презентац", "roadmap", "дорожн"))
    has_research_request = any(token in lower for token in ("исслед", "рынок", "research", "аудит"))

    return marker_hits >= 5 and structure_hits >= 2 and has_artifact_request and has_research_request


def strip_agentic_prefix(user_line: str) -> str:
    line = str(user_line or "").strip()
    if line.lower().startswith(_AGENTIC_START_PREFIX):
        return line[len(_AGENTIC_START_PREFIX) :].strip()
    if line.lower().startswith("agentic:"):
        return line[8:].strip()
    return line


async def start_agentic_session(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    user_line: str,
    policy_json: Mapping[str, Any] | None = None,
    worker_id: str = "http-bootstrap",
    content_catalog_user_id: str | None = None,
    oauth2_sub: str | None = None,
) -> dict[str, Any]:
    if not agentic_substrate_enabled():
        return {"ok": False, "reason": "agentic_substrate_disabled"}

    existing = await agentic_pg.agentic_session_fetch_active_for_principal(pool, principal_id=principal_id)
    if existing is not None:
        return {"ok": False, "reason": "active_session_exists", "session": existing}

    goal_text = strip_agentic_prefix(user_line)
    merged_policy = merge_default_budget(policy_json)
    policy_out = dict(merged_policy)
    catalog_uid = str(content_catalog_user_id or "").strip()
    oauth_sub = str(oauth2_sub or "").strip()
    if catalog_uid:
        policy_out["content_catalog_user_id"] = catalog_uid
    if oauth_sub:
        policy_out["oauth2_sub"] = oauth_sub
    # Merge live companion tumbler (left-rail auto-accept) into session policy.
    profile: Mapping[str, Any] | None = None
    try:
        from api.ewa_platform.agentic.auto_accept_hitl import (
            merge_auto_accept_into_policy,
            read_auto_accept_tasks_pref,
        )
        from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

        profile = await companion_pg.companion_profile_fetch(pool, principal_id=principal_id)
        learned = profile.get("learned_preferences") if isinstance(profile, Mapping) else None
        policy_out = merge_auto_accept_into_policy(
            policy_out,
            auto_accept=read_auto_accept_tasks_pref(learned if isinstance(learned, Mapping) else None),
        )
    except Exception as exc:  # noqa: BLE001 — session start must not fail on pref read
        logger.debug("[STEP] agentic_auto_accept_merge_skip principal_id=%s err=%s", principal_id, exc)
        profile = None
    goal_json = build_goal_json_v2(user_line)
    session = await agentic_pg.agentic_session_create(
        pool,
        principal_id=principal_id,
        goal_json=goal_json,
        policy_json=policy_out,
        status=fsm.STATUS_INIT,
    )
    if isinstance(profile, Mapping):
        from api.ewa_platform.agentic.companion_grounding import (
            WM_COMPANION_GROUNDING_KEY,
            working_memory_with_companion_grounding,
        )

        wm = working_memory_with_companion_grounding({}, profile)
        if str(wm.get(WM_COMPANION_GROUNDING_KEY) or "").strip():
            patched_wm = await agentic_pg.agentic_session_update(
                pool,
                session_id=str(session["id"]),
                principal_id=principal_id,
                working_memory_json=wm,
            )
            if patched_wm is not None:
                session = patched_wm
    run = await create_task_run_mirror(
        pool,
        principal_id=principal_id,
        session=session,
        user_message=goal_text,
    )
    session = await agentic_pg.agentic_session_fetch(pool, session_id=str(session["id"])) or session

    if agentic_async_jobs_enabled():
        enqueue_agentic_loop_tick(
            session_id=str(session["id"]),
            principal_id=principal_id,
            expected_revision=int(session["session_revision"]),
        )
    else:
        await run_agentic_loop_tick(
            pool,
            session_id=str(session["id"]),
            principal_id=principal_id,
            worker_id=worker_id,
        )
        session = await agentic_pg.agentic_session_fetch(pool, session_id=str(session["id"])) or session
        await sync_and_publish_task_run_from_session(pool, session=session)

    logger.info(
        "[STEP] agentic_session_started session_id=%s task_run_id=%s principal_id=%s anchor_name=%s objectives=%s time_box=%s",
        session.get("id"),
        run.get("id"),
        principal_id,
        (goal_json.get("anchor") or {}).get("display_name") or "-",
        len((goal_json.get("anchor") or {}).get("objectives") or []),
        (goal_json.get("anchor") or {}).get("time_box") or "-",
    )
    return {
        "ok": True,
        "session": session,
        "task_run": run,
        "reply": (
            "Вижу большую рабочую сессию с несколькими задачами. Запускаю автономный разбор: "
            "сначала выделю структуру задач, затем начну первый безопасный шаг. Прогресс — в панели операций."
            if user_line_requests_agentic_work_session(user_line) and not user_line_requests_agentic_start(user_line)
            else "Запускаю автономную задачу. Прогресс — в панели операций."
        ),
    }
