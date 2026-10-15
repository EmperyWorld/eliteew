# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Регрессия: обрезка огромных ``data:`` URL и метаданные до PG без SQLAlchemy-сессии.
# Invariants:
# - (нет)
# Related:
# - api/services/live_voice/conversation_storage.py
# ---

from __future__ import annotations

import pytest

from api.services.live_voice.conversation_storage import (
    _MAX_STORED_AUDIO_DATA_URL_CHARS,
    _clip_audio_url_for_db,
)


@pytest.mark.unit
def test_clip_drops_huge_data_audio_ai_url() -> None:
    huge = "data:audio/wav;base64," + "x" * (_MAX_STORED_AUDIO_DATA_URL_CHARS + 50)
    u, a, m = _clip_audio_url_for_db(None, huge, {})
    assert u is None
    assert a is None
    assert m.get("audio_ai_url_omitted") is True
    assert m.get("audio_ai_url_omitted_chars") == len(huge)


@pytest.mark.unit
def test_clip_keeps_short_https_url() -> None:
    url = "https://cdn.example/a.wav"
    _u, a, m = _clip_audio_url_for_db(None, url, {"k": 1})
    assert a == url
    assert "audio_ai_url_omitted" not in m
