# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `ewa_platform/companion/persona/anticipation.py`; preserves its existing EliteEW API/service responsibilities.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Build a **proactive anticipation hint** for the EWA companion (HCM Module B, project "Mela's
# Ascension" PR-3). When the desktop SPA ticks an observation (file opened, focus changed, workspace
# switched), this module composes a short hint by reusing HCM memory recall against the new context
# **without** triggering an HTTP LLM turn. Goal: cheap "Mela noticed X" bubble that may help the
# user before they ask.
# Invariants:
# - **No HTTP LLM calls** in this module. Cheap recall + templated copy only.
# - Hint text never exceeds ~400 chars; bullets are truncated to 240 chars each.
# - Never raises into the HTTP path — any failure returns ``None`` (router renders no hint).
# - Each observation is **best-effort persisted** as an ``ewa_companion_episodes`` row of
#   ``kind=observation`` so HCM retrieval can later find proactive moments.
# - Returns shape compatible with ``CompanionHintOut``.
# Related:
# - api/ewa_platform/companion/memory/retrieval.py (semantic recall reused)
# - api/ewa_platform/companion/episodic/writer.py (writer for ``kind=observation``)
# - api/ewa_platform/companion/sidecar/shell_context.py
# - documentation/product/ewa/EWA-COMPANION-PROACTIVE-OBSERVER.md
# **Canonical path:** ``api.ewa_platform.companion.persona.anticipation``; shim ``companion.anticipation``.
# ---
"""Anticipation hint composer for proactive desktop observations (HCM Module B)."""

from __future__ import annotations

import logging
import re
from collections.abc import Mapping
from datetime import date
from typing import Any
from uuid import uuid4

import asyncpg

from api.ewa_platform.companion.memory.hcm_store import get_memory
from api.ewa_platform.companion.memory.retrieval import compose_memory_window
from api.ewa_platform.companion.observability.degrade_log import companion_degrade_debug
from api.ewa_platform.companion.plans.config import companion_plan_enabled
from api.ewa_platform.companion.sidecar.shell_context import normalize_shell_context_payload
from api.ewa_platform.persistence_pg import companion_plans_asyncpg as plans_pg
from api.ewa_platform.persistence_pg.episodes_asyncpg import episode_insert

logger = logging.getLogger(__name__)

_MAX_HINT_TEXT = 400
_MAX_BULLET = 240
_SIDEBAR_EPISODE_SKIP_SUBSTRINGS: tuple[str, ...] = (
    "два режима присутствия",
    "подвале радуги",
    "когда будет включено",
    "arlika_v2_dual_mode",
    "arlika_idle_amnesia",
    "— related episodes —",
    "related episodes",
)

_HCM_BULLET_PREFIX_RE = re.compile(
    r"^\[?(identity|fact|preference|relationship|story|correction|task_preference|catalog_preference)\]?\s*",
    re.IGNORECASE,
)

_KNOWN_TRIGGERS: frozenset[str] = frozenset(
    {
        "focus_change",
        "window_opened",
        "window_closed",
        "workspace_switched",
        "active_app_changed",
        "idle",
        "manual_tick",
    }
)


def _truncate(text: str, limit: int) -> str:
    t = (text or "").strip()
    if len(t) <= limit:
        return t
    return t[: limit - 1].rstrip() + "…"


def _extract_active_app(
    observation: Mapping[str, Any],
    shell_norm: Mapping[str, Any] | None,
) -> tuple[str | None, str | None, str | None]:
    """Return ``(app_component, window_id, title)`` from observation + optional shell snapshot."""

    app = str(observation.get("app_component") or "").strip() or None
    window_id = str(observation.get("window_id") or "").strip() or None
    title = str(observation.get("title") or "").strip() or None

    if (app is None or title is None) and isinstance(shell_norm, Mapping):
        active_wid = window_id or shell_norm.get("active_window_id")
        if active_wid:
            for win in shell_norm.get("windows", []) or []:
                if isinstance(win, Mapping) and str(win.get("window_id") or "") == str(active_wid):
                    if app is None:
                        app = (str(win.get("app_component") or "").strip()) or None
                    if title is None:
                        title = (str(win.get("title") or "").strip()) or None
                    if window_id is None:
                        window_id = str(active_wid)
                    break
    return app, window_id, title


def _seed_query_from_context(
    *,
    trigger: str,
    app_component: str | None,
    title: str | None,
    shell_norm: Mapping[str, Any] | None,
) -> str:
    """Compose a small text query for semantic recall (no LLM)."""

    parts: list[str] = [trigger]
    if app_component:
        parts.append(app_component)
    if title:
        parts.append(title)
    if isinstance(shell_norm, Mapping):
        active_desk = shell_norm.get("active_desktop_id")
        if active_desk:
            parts.append(f"desktop:{active_desk}")
            # MRU-lite nudge without extra cosine math: repeats desktop label for tf-idf-ish recall overlaps.
            parts.append(f"workspace_context:{active_desk}")
    return " ".join(parts).strip()


async def _plan_tasks_hint_suffix(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
) -> str | None:
    """Short plan-task nudge from PG (no LLM)."""

    if not companion_plan_enabled():
        return None
    try:
        tasks = await plans_pg.plan_list_open_tasks(pool, principal_id=principal_id, limit=3)
    except Exception as exc:  # noqa: BLE001
        companion_degrade_debug(
            logger,
            "anticipation_plan_tasks_hint",
            "plan open tasks load failed for hint suffix",
            exc=exc,
            principal_id=principal_id,
        )
        return None
    if not tasks:
        return None
    today = date.today()
    overdue: list[str] = []
    open_titles: list[str] = []
    for t in tasks:
        title = str(t.get("title") or "").strip()
        if not title:
            continue
        due = t.get("due_date")
        if isinstance(due, date) and due < today:
            overdue.append(title)
        else:
            open_titles.append(title)
    if overdue:
        sample = overdue[0]
        extra = f" ещё {len(overdue) - 1}" if len(overdue) > 1 else ""
        return _truncate(
            f" По активному плану просрочен шаг «{sample}»{extra} — напомни, если хочешь отметить готовым.",
            _MAX_HINT_TEXT,
        )
    if open_titles:
        return _truncate(
            f" В плане открыт шаг «{open_titles[0]}» — могу напомнить детали в чате.",
            _MAX_HINT_TEXT,
        )
    return None


def _filter_sidebar_episode_bullets(lines: list[str]) -> list[str]:
    """Drop meta/lore lines that duplicate «Помнит о вас» or read as nursery copy."""

    out: list[str] = []
    for line in lines:
        low = line.lower()
        if any(skip in low for skip in _SIDEBAR_EPISODE_SKIP_SUBSTRINGS):
            continue
        if low.startswith("[relationship]") or low.startswith("[preference]"):
            continue
        if low.startswith("[identity]") or low.startswith("[fact]"):
            continue
        if "режим" in low and "арлик" in low:
            continue
        humanized = _humanize_sidebar_bullet(line)
        if humanized:
            out.append(humanized)
    return out


def _humanize_sidebar_bullet(line: str) -> str:
    """Turn prompt-style ``- [kind] …`` bullets into short UI copy without bracket tags."""

    t = (line or "").strip().lstrip("- ").strip()
    if not t:
        return ""
    m = _HCM_BULLET_PREFIX_RE.match(t)
    if m:
        kind = m.group(1).lower()
        body = t[m.end() :].strip()
        if not body:
            return ""
        if kind in ("identity", "fact"):
            return ""
        if kind == "story":
            return _truncate(body, _MAX_BULLET)
        return _truncate(body, _MAX_BULLET)
    return _truncate(t, _MAX_BULLET)


def _idle_hint_for_persona(persona: str, character: Mapping[str, Any]) -> str:
    """Idle copy from seed + persisted mood — not a fixed «няня» string."""

    from api.ewa_platform.companion.persona.character import normalize_character_block

    seed = (persona or "parent").strip().lower()
    mood = normalize_character_block(character).get("mood") or {}
    try:
        valence = float(mood.get("valence", 0.0) or 0.0)
    except (TypeError, ValueError):  # fmt: skip
        valence = 0.0
    try:
        tension = float(mood.get("tension", 0.1) or 0.1)
    except (TypeError, ValueError):  # fmt: skip
        tension = 0.1

    if seed == "arlika":
        return "Пауза. Когда вернёшься — формулируй задачу, без лирики."
    if seed == "arlika_v2":
        return "Окей, пауза. Скажешь, что делать на столе — подхвачу."
    if valence <= -0.12 or tension >= 0.4:
        return "Похоже, нагрузка высокая. Можно паузу или одну конкретную задачу — как удобнее."
    if valence >= 0.15:
        return "На связи. Напиши, если нужна помощь по открытому на столе."
    return "Напиши задачу или открой файл на столе — подскажу по контексту, когда понадобится."


def _templated_hint(
    *,
    trigger: str,
    app_component: str | None,
    title: str | None,
    persona: str,
    character: Mapping[str, Any] | None = None,
) -> str:
    """Short Russian hint copy — persona + persisted mood, not generic reassurance."""

    is_hostile = persona.strip().lower() == "arlika"
    char_block = character if isinstance(character, Mapping) else {}
    if app_component == "DocEditor" and title:
        if is_hostile:
            return _truncate(
                f"Так-так, открыл «{title}» в редакторе? Хочешь — поверю, что ты собрался работать.", _MAX_HINT_TEXT
            )
        return _truncate(
            f"Открыт «{title}» в DocEditor — могу подтянуть связанный контекст из истории, если попросишь в чате.",
            _MAX_HINT_TEXT,
        )
    if trigger == "workspace_switched":
        return _truncate(
            "Другое пространство на столе — если нужно, вспомню, чем занимались здесь раньше.",
            _MAX_HINT_TEXT,
        )
    if trigger == "idle":
        return _truncate(_idle_hint_for_persona(persona, char_block), _MAX_HINT_TEXT)
    if app_component:
        return _truncate(
            f"В фокусе {app_component}. Контекст по приложению — по запросу в чате.",
            _MAX_HINT_TEXT,
        )
    return _truncate(
        "Слежу за снимком стола. Задача в чате — разберём по шагам.",
        _MAX_HINT_TEXT,
    )


def _bullets_from_window(window: Any, *, limit: int) -> list[str]:
    """Pull short body lines from a ``MemoryWindow.prompt_section`` (already formatted)."""

    section = getattr(window, "prompt_section", None) or ""
    out: list[str] = []
    for raw in section.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("- "):
            out.append(_truncate(line[2:].strip(), _MAX_BULLET))
        if len(out) >= max(1, int(limit)):
            break
    return out


async def build_anticipation_hint(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    profile: Mapping[str, Any],
    trigger: str,
    observation: Mapping[str, Any],
    shell_context_payload: Mapping[str, Any] | None,
) -> tuple[dict[str, Any] | None, bool]:
    """Compose one hint dict ready for ``CompanionHintOut`` plus whether an episode was recorded.

    Returns ``(hint_or_none, episode_recorded)``.
    """

    trigger_clean = (trigger or "manual_tick").strip().lower()
    if trigger_clean not in _KNOWN_TRIGGERS:
        # Unknown trigger ⇒ accept tick but do not produce a hint.
        return (None, False)

    shell_norm: dict[str, Any] | None = None
    if shell_context_payload is not None:
        try:
            shell_norm = normalize_shell_context_payload(dict(shell_context_payload))
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "[STEP] companion_observation_shell_normalize_failed principal=%s err=%s",
                principal_id,
                exc,
            )
            shell_norm = None

    app, window_id, title = _extract_active_app(observation, shell_norm)
    persona = str(profile.get("seed_persona_id") or "parent")
    from api.ewa_platform.companion.persona.character import get_character

    character_block = get_character(profile)

    # Best-effort observation record. We do not embed observations into Qdrant on this path —
    # the body is intentionally short and category-like; episodic semantic value is low. The PG row
    # is still useful for audit and for future Module C4 (affective router).
    episode_recorded = False
    body_for_episode = _truncate(
        f"observation:{trigger_clean} app={app or '-'} title={title or '-'}",
        320,
    )
    try:
        row = await episode_insert(
            pool,
            principal_id=principal_id,
            body=body_for_episode,
            kind="observation",
            source="proactive_observer",
            persona=persona,
            importance=0.35,
            valence=0.55,
            turn_id=None,
            extra={"trigger": trigger_clean, "window_id": window_id, "app_component": app},
            episode_id=str(uuid4()),
        )
        episode_recorded = row is not None
        if episode_recorded and row is not None:
            from api.ewa_platform.companion.episodic.reembed import schedule_observation_episode_reembed

            schedule_observation_episode_reembed(pool, episode_id=str(row.get("id") or ""))
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] companion_observation_pg_insert_failed principal=%s err=%s", principal_id, exc)
        episode_recorded = False

    # Semantic recall from existing memory — never raises.
    seed_query = _seed_query_from_context(
        trigger=trigger_clean,
        app_component=app,
        title=title,
        shell_norm=shell_norm,
    )
    try:
        window = await compose_memory_window(
            profile=profile,
            principal_id=principal_id,
            current_user_text=seed_query,
            persona=persona,
            pool=pool,
            episodic_top_k=8,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] companion_observation_recall_failed principal=%s err=%s", principal_id, exc)
        window = None

    bullets = _bullets_from_window(window, limit=5) if window is not None else []
    bullets = _filter_sidebar_episode_bullets(bullets)[:3]

    if trigger_clean == "idle":
        open_count = 0
        if isinstance(shell_norm, Mapping):
            wins = shell_norm.get("windows")
            if isinstance(wins, list):
                open_count = len(wins)
        mem_empty = not get_memory(profile)
        try:
            rev = int(profile.get("companion_revision") or 0)
        except (TypeError, ValueError):  # fmt: skip
            rev = 0
        # Keep idle hints for established profiles even without an explicit shell snapshot.
        if open_count == 0 and mem_empty and rev <= 1:
            return (None, episode_recorded)

    hint_text = _templated_hint(
        trigger=trigger_clean,
        app_component=app,
        title=title,
        persona=persona,
        character=character_block,
    )
    plan_task_title: str | None = None
    plan_suffix = await _plan_tasks_hint_suffix(pool, principal_id=principal_id)
    if plan_suffix:
        hint_text = _truncate(f"{hint_text}{plan_suffix}", _MAX_HINT_TEXT)
        if companion_plan_enabled():
            try:
                open_tasks = await plans_pg.plan_list_open_tasks(pool, principal_id=principal_id, limit=3)
            except Exception as exc:  # noqa: BLE001
                from api.ewa_platform.companion.observability.degrade_log import companion_degrade_debug

                companion_degrade_debug(
                    logger,
                    "anticipation_plan_tasks",
                    "plan open tasks load failed",
                    exc=exc,
                    principal_id=principal_id,
                )
                open_tasks = []
            today = date.today()
            for t in open_tasks:
                title_raw = str(t.get("title") or "").strip()
                if not title_raw:
                    continue
                due = t.get("due_date")
                if isinstance(due, date) and due < today:
                    plan_task_title = title_raw
                    break
            if plan_task_title is None:
                for t in open_tasks:
                    title_raw = str(t.get("title") or "").strip()
                    if title_raw:
                        plan_task_title = title_raw
                        break

    suggested_action: dict[str, Any] | None = None
    if plan_task_title:
        suggested_action = {
            "type": "suggest_chat_prompt",
            "prompt_text": f"Отметь выполненным: {plan_task_title}",
        }
    elif app == "DocEditor" and title and len(bullets) > 0:
        # Light suggested action: offer to bring related memories into the next chat turn.
        suggested_action = {
            "type": "suggest_chat_prompt",
            "prompt_text": f"Покажи, что у нас связано с «{title}»",
        }

    return (
        {
            "kind": "anticipation",
            "hint_text": hint_text,
            "related_episodes": bullets,
            "suggested_action": suggested_action,
        },
        episode_recorded,
    )


__all__ = [
    "build_anticipation_hint",
]
