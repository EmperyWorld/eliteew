# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for authoritative LLM wall-clock context blocks.
# Related:
# - api/utils/llm_wall_clock_context.py
# ---

from __future__ import annotations

from datetime import UTC, datetime
from zoneinfo import ZoneInfo

import pytest

from api.utils.llm_wall_clock_context import (
    anchor_web_search_query_to_wall_clock,
    append_llm_wall_clock_to_system_prompt,
    llm_wall_clock_system_section,
    resolve_wall_clock_timezone,
    wall_clock_snapshot,
    web_search_freshness_preamble,
)


def test_wall_clock_snapshot_fixed_instant() -> None:
    instant = datetime(2026, 7, 1, 8, 10, tzinfo=UTC)
    snap = wall_clock_snapshot(now=instant, tz=ZoneInfo("Asia/Vladivostok"))
    assert snap.year == 2026
    assert snap.month == 7
    assert snap.day == 1
    assert "2026" in snap.date_long_ru
    assert "июля" in snap.date_long_ru


def test_llm_wall_clock_system_section_mentions_relative_dates() -> None:
    instant = datetime(2026, 7, 1, 12, 0, tzinfo=UTC)
    section = llm_wall_clock_system_section(now=instant)
    assert "EliteEW_WALL_CLOCK" in section
    assert "2026" in section
    assert "сегодня" in section.casefold()
    assert "следующий месяц" in section.casefold()


def test_web_search_freshness_preamble_has_server_stamp() -> None:
    instant = datetime(2026, 7, 1, 12, 0, tzinfo=UTC)
    pre = web_search_freshness_preamble(now=instant)
    assert "2026" in pre
    assert "устаревшие" in pre.casefold()


def test_append_llm_wall_clock_idempotent() -> None:
    instant = datetime(2026, 7, 1, 12, 0, tzinfo=UTC)
    once = append_llm_wall_clock_to_system_prompt("Base prompt.", now=instant)
    twice = append_llm_wall_clock_to_system_prompt(once, now=instant)
    assert once == twice
    assert once.count("EliteEW_WALL_CLOCK") == 1


def test_format_search_results_includes_wall_clock_preamble() -> None:
    from api.services.search_service import format_search_results_for_prompt

    block = format_search_results_for_prompt(
        [{"title": "t", "content": "c", "url": "https://example.com"}],
        max_total_chars=2000,
    )
    assert "Контекст времени" in block
    assert "https://example.com" in block


def test_resolve_wall_clock_timezone_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ELITEEW_OPERATOR_TZ", "Europe/Moscow")
    tz = resolve_wall_clock_timezone()
    assert tz.key == "Europe/Moscow"


def test_anchor_web_search_query_appends_month_year() -> None:
    instant = datetime(2026, 7, 1, 12, 0, tzinfo=UTC)
    anchored = anchor_web_search_query_to_wall_clock(
        "концерты Fesco Hall Владивосток в этом месяце",
        now=instant,
    )
    assert "2026" in anchored
    assert "июль" in anchored.casefold()


def test_get_web_search_query_resolves_followup_from_history() -> None:
    from api.services.search_service import get_web_search_query

    history = [
        {"role": "user", "content": "концерты Fesco Hall во Владивostokе в июле"},
        {"role": "assistant", "content": "ответ"},
        {"role": "user", "content": "Поищи еще"},
    ]
    resolved = get_web_search_query("Поищи еще", history)
    assert "fesco" in resolved.casefold() or "концерт" in resolved.casefold()


def test_get_web_search_query_resolves_meta_clarification_from_history() -> None:
    from api.services.search_service import get_web_search_query, is_web_search_query_ambiguous

    history = [
        {
            "role": "user",
            "content": "мировые практики AI-оркестраторов и какие инструменты используют сильные игроки",
        },
        {"role": "assistant", "content": "черновик без источников"},
        {"role": "user", "content": "нужна точность и конкретика"},
    ]
    resolved = get_web_search_query("нужна точность и конкретика", history)
    assert "оркестратор" in resolved.casefold() or "практик" in resolved.casefold()
    assert "точность" not in resolved.casefold()
    assert not is_web_search_query_ambiguous(resolved)


def test_is_web_search_query_ambiguous_meta_only() -> None:
    from api.services.search_service import get_web_search_query, is_web_search_query_ambiguous

    assert is_web_search_query_ambiguous("нужна точность и конкретика")
    assert is_web_search_query_ambiguous("поищи")
    assert is_web_search_query_ambiguous("поищи ещё")
    assert not is_web_search_query_ambiguous("погода")
    assert not is_web_search_query_ambiguous("погода владивосток")
    assert not is_web_search_query_ambiguous("ставка ЦБ сегодня")
    assert not is_web_search_query_ambiguous("bitcoin")

    # Follow-up after a one-word topic must resolve to that topic.
    history = [
        {"role": "user", "content": "новости"},
        {"role": "assistant", "content": "ок"},
        {"role": "user", "content": "поищи ещё"},
    ]
    resolved = get_web_search_query("поищи ещё", history)
    assert resolved.casefold() == "новости"
    assert not is_web_search_query_ambiguous(resolved)
