# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Контрактное извлечение текста из OpenAI-style ``message`` (string / list parts / reasoning).
# Invariants:
# - Синхронные unit-тесты без HTTP.
# Related:
# - api/services/llama_service.py (`_openai_assistant_text`)
# ---

from __future__ import annotations

import pytest

from api.services.llama_service import _openai_assistant_text


@pytest.mark.unit
def test_openai_assistant_text_plain_string() -> None:
    assert _openai_assistant_text({"role": "assistant", "content": "  hi  "}) == "hi"


@pytest.mark.unit
def test_openai_assistant_text_list_parts() -> None:
    msg = {
        "role": "assistant",
        "content": [
            {"type": "text", "text": "Hello"},
            {"type": "text", "text": " world"},
        ],
    }
    assert _openai_assistant_text(msg) == "Hello world"


@pytest.mark.unit
def test_openai_assistant_text_reasoning_fallback() -> None:
    assert _openai_assistant_text({"role": "assistant", "content": "", "reasoning": "  x  "}) == "x"
