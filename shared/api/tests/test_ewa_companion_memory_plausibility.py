# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Behavioral tests for companion memory plausibility filter (post-reset / LLM mis-memory boundary).
# Related:
# - api/ewa_platform/companion/memory/hcm_store.py
# ---

from __future__ import annotations

import sys
import types

sys.modules.setdefault("asyncpg", types.ModuleType("asyncpg"))

import pytest

from api.ewa_platform.companion.memory.hcm_store import (
    is_plausible_companion_memory,
    merge_memory_entries,
)


@pytest.mark.unit
def test_rejects_question_to_companion_as_user_identity() -> None:
    user = "Привет, я po&T. А тебя как величать?"
    bad = "Имя пользователя: а тебя как величать"
    assert not is_plausible_companion_memory(bad, user_line=user, kind="identity")
    merged, added = merge_memory_entries([], [{"kind": "identity", "content": bad}], user_line=user)
    assert added == 0
    assert merged == []


@pytest.mark.unit
def test_accepts_explicit_user_intro() -> None:
    user = "Меня зовут po&T"
    good = "Имя пользователя: po&T"
    assert is_plausible_companion_memory(good, user_line=user, kind="identity")
    merged, added = merge_memory_entries([], [{"kind": "identity", "content": good}], user_line=user)
    assert added == 1
    assert merged[0]["content"] == good


@pytest.mark.unit
def test_rejects_llm_intro_claim_without_user_intro() -> None:
    user = "Расскажи анекдот"
    bad = "Пользователь представился как po&T"
    assert not is_plausible_companion_memory(bad, user_line=user, kind="fact")
    merged, added = merge_memory_entries([], [{"kind": "fact", "content": bad}], user_line=user)
    assert merged == []
    assert added == 0
