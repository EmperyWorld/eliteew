# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Authoritative wall-clock date/time for LLM system prompts and web-search result blocks.
# Invariants:
# - Single server snapshot per call site; never hardcode calendar years in product code.
# Related:
# - api/utils/datetime_helpers.py
# - api/services/search_service.py
# ---

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

_WALL_CLOCK_MARKER = "EliteEW_WALL_CLOCK"
_DEFAULT_TZ = "Asia/Vladivostok"
_ENV_TZ = "ELITEEW_OPERATOR_TZ"

_WEEKDAY_RU = (
    "понедельник",
    "вторник",
    "среда",
    "четверг",
    "пятница",
    "суббота",
    "воскресенье",
)

_MONTH_NOM_RU = (
    "",
    "январь",
    "февраль",
    "март",
    "апрель",
    "май",
    "июнь",
    "июль",
    "август",
    "сентябрь",
    "октябрь",
    "ноябрь",
    "декабрь",
)

_MONTH_RU = (
    "",
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
)


@dataclass(frozen=True, slots=True)
class WallClockSnapshot:
    tz_name: str
    tz_label: str
    local_dt: datetime
    iso_local: str
    iso_utc: str
    date_long_ru: str
    time_ru: str
    weekday_ru: str
    year: int
    month: int
    day: int


def resolve_wall_clock_timezone() -> ZoneInfo:
    raw = (os.getenv(_ENV_TZ) or os.getenv("TZ") or _DEFAULT_TZ).strip() or _DEFAULT_TZ
    try:
        return ZoneInfo(raw)
    except ZoneInfoNotFoundError:
        return ZoneInfo(_DEFAULT_TZ)


def wall_clock_snapshot(
    *,
    now: datetime | None = None,
    tz: ZoneInfo | None = None,
) -> WallClockSnapshot:
    tzinfo = tz or resolve_wall_clock_timezone()
    utc_now = now.astimezone(UTC) if now is not None and now.tzinfo is not None else datetime.now(UTC)
    local = utc_now.astimezone(tzinfo)
    weekday = _WEEKDAY_RU[local.weekday()]
    month_name = _MONTH_RU[local.month]
    date_long = f"{local.day} {month_name} {local.year} года"
    time_ru = local.strftime("%H:%M")
    tz_label = local.tzname() or tzinfo.key
    return WallClockSnapshot(
        tz_name=tzinfo.key,
        tz_label=str(tz_label),
        local_dt=local,
        iso_local=local.isoformat(timespec="minutes"),
        iso_utc=utc_now.isoformat(timespec="seconds"),
        date_long_ru=date_long,
        time_ru=time_ru,
        weekday_ru=weekday,
        year=local.year,
        month=local.month,
        day=local.day,
    )


def llm_wall_clock_system_section(*, now: datetime | None = None) -> str:
    """Russian block appended to LLM system prompts (Desktop, EWA, marketing, IMC, EWRP, …)."""
    snap = wall_clock_snapshot(now=now)
    return (
        f"[{_WALL_CLOCK_MARKER} — authoritative server time]\n"
        f"Сейчас: {snap.weekday_ru}, {snap.date_long_ru}, {snap.time_ru} ({snap.tz_label}, {snap.tz_name}).\n"
        f"ISO local: {snap.iso_local}; UTC: {snap.iso_utc}.\n"
        "Интерпретируй относительные формулировки пользователя («сегодня», «завтра», «послезавтра», "
        "«на следующий месяц», «в этом месяце», «на этой неделе», «в ближайшие дни», «сейчас») "
        "**строго от этой даты и времени**, а не от знаний модели или дат из старых сниппетов.\n"
        "При веб-поиске: если даты событий, новостей или прогнозов в срезе **раньше** текущей даты — "
        "это архив; не выдавай их как предстоящие или «на сегодня». Для актуальных фактов опирайся на "
        "свежие источники и эту метку времени.\n"
        "Не выдумывай другую «системную дату» или «программное ядро» с иным годом — используй только этот блок."
    )


def web_search_freshness_preamble(*, now: datetime | None = None) -> str:
    """Short header prepended to formatted web-search hit blocks."""
    snap = wall_clock_snapshot(now=now)
    return (
        f"Контекст времени (сервер EliteEW): {snap.weekday_ru}, {snap.date_long_ru}, {snap.time_ru} "
        f"({snap.tz_label}). "
        "События и прогнозы с датами **раньше** этой отметки — устаревшие; не считай их «ближайшими» или «сегодня». "
        "«Сегодня», «этот месяц», «на следующий месяц» в вопросе пользователя считай от этой даты.\n\n"
    )


def anchor_web_search_query_to_wall_clock(query: str, *, now: datetime | None = None) -> str:
    """Append month+year to time-sensitive search queries when the year is missing.

    Shopping-only «цена» without an explicit time cue is **not** anchored — otherwise
    product SERP is biased to the operator calendar month.
    """
    q = (query or "").strip()
    if not q or re.search(r"\b20[2-3]\d\b", q):
        return q
    lower = q.casefold()
    temporal_markers = (
        "сегодня",
        "сейчас",
        "этот месяц",
        "в этом месяце",
        "на этой неделе",
        "на следующ",
        "ближайш",
        "актуальн",
        "погод",
        "температур",
        "прогноз",
        "концерт",
        "афиш",
        "мероприят",
        "билет",
        "расписан",
        "новост",
        "курс",
        "феско",
        "холл",
    )
    # Note: bare «цена/стоимость» is shopping, not a time cue — do not auto-append month/year.
    if not any(marker in lower for marker in temporal_markers):
        return q
    snap = wall_clock_snapshot(now=now)
    month_nom = _MONTH_NOM_RU[snap.month]
    anchor = f"{month_nom} {snap.year}"
    if anchor.casefold() in lower or str(snap.year) in q:
        return q
    return f"{q} {anchor}"


def append_llm_wall_clock_to_system_prompt(prompt: str, *, now: datetime | None = None) -> str:
    """Append wall-clock section once (idempotent by marker)."""
    body = (prompt or "").strip()
    if _WALL_CLOCK_MARKER in body:
        return body
    section = llm_wall_clock_system_section(now=now)
    if not body:
        return section
    return f"{body}\n\n{section}"
