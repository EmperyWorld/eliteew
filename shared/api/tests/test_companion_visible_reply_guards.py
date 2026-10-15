# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Focused unit tests for companion visible-reply truth guards on deferred file-study music chains.
# Invariants:
# - Keeps tests independent from optional DB/http deps by stubbing ``asyncpg`` import at module load.
# Related:
# - api/ewa_platform/companion/context/noise.py
# - tests/test_ewa_companion_orchestration_effective_branch.py
# ---

from __future__ import annotations

import sys
import types

sys.modules.setdefault("asyncpg", types.ModuleType("asyncpg"))

from api.ewa_platform.companion.context.noise import (
    apply_companion_visible_reply_guards,
    strip_internal_companion_markup,
)


def test_strip_internal_companion_markup_removes_hcm_tags() -> None:
    raw = "[identity] foo\n\n**Hello**"
    assert strip_internal_companion_markup(raw) == "**Hello**"


def test_strip_internal_companion_markup_unwraps_json_envelope() -> None:
    raw = '{"visible_reply":"Привет!","memory":[]}'
    assert strip_internal_companion_markup(raw) == "Привет!"


def test_strip_internal_companion_markup_removes_malformed_memory_tail() -> None:
    raw = 'Hello. <>[{"type":"fact","content":"User likes tea","importance":0.5}]<'
    assert strip_internal_companion_markup(raw) == "Hello."


def test_apply_guards_strips_internal_markup_before_meta() -> None:
    raw = "[identity] secret\n\n**Hello**"
    guarded = apply_companion_visible_reply_guards(
        raw,
        user_line="hi",
        intent_plan=None,
        actions=[],
    )
    assert "[identity]" not in guarded
    assert "**Hello**" in guarded


def test_file_study_guard_strips_false_started_claim_when_deferred() -> None:
    raw = "Я выполнила анализ и уже запустила генерацию песни.\nГенерация в процессе — скоро будет готово."
    guarded = apply_companion_visible_reply_guards(
        raw,
        user_line="проанализируй документ и потом сгенерируй песню",
        intent_plan=None,
        actions=[],
        effective_branch="file_study_compose",
        deferred_music_generation=True,
    )
    lowered = guarded.lower()
    assert "уже запустила" not in lowered
    assert "генерация в процессе" not in lowered
    assert "ещё не запущена" in lowered
    assert "в очереди следующего шага" in lowered


def test_file_study_guard_strips_false_started_claim_when_not_queued() -> None:
    raw = "Готово: анализ и текст песни написаны. Генерацию я уже запустила.\nМузыка в процессе."
    guarded = apply_companion_visible_reply_guards(
        raw,
        user_line="проанализируй документ и напиши текст песни",
        intent_plan=None,
        actions=[],
        effective_branch="file_study_compose",
        deferred_music_generation=False,
    )
    lowered = guarded.lower()
    assert "уже запустила" not in lowered
    assert "музыка в процессе" not in lowered
    assert "ещё не запущена" in lowered
    assert "отдельной командой" in lowered


def test_file_study_guard_keeps_regular_analysis_without_music_claim() -> None:
    raw = "Вот анализ документа и текст песни без запуска генерации."
    guarded = apply_companion_visible_reply_guards(
        raw,
        user_line="проанализируй документ и напиши текст песни",
        intent_plan=None,
        actions=[],
        effective_branch="file_study_compose",
        deferred_music_generation=False,
    )
    assert guarded == raw
