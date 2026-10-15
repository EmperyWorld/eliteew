# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---

from __future__ import annotations

import pytest

from api.ewa_platform.companion.voice.config import companion_voice_enabled


@pytest.mark.unit
def test_companion_voice_disabled_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_VOICE_ENABLED", raising=False)
    assert companion_voice_enabled() is False


@pytest.mark.unit
def test_companion_voice_enabled_when_env_on(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_VOICE_ENABLED", "1")
    assert companion_voice_enabled() is True
