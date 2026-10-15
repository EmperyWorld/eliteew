# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---

from __future__ import annotations

import pytest

from api.ewa_platform.companion.ux.reactive_chrome import companion_reactive_chrome_enabled


def test_companion_reactive_chrome_default_on_when_unset(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("EWA_COMPANION_REACTIVE_CHROME_ENABLED", raising=False)
    assert companion_reactive_chrome_enabled() is True


def test_companion_reactive_chrome_disabled_when_env_off(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("EWA_COMPANION_REACTIVE_CHROME_ENABLED", "0")
    assert companion_reactive_chrome_enabled() is False


def test_companion_reactive_chrome_enabled_when_env_on(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("EWA_COMPANION_REACTIVE_CHROME_ENABLED", "1")
    assert companion_reactive_chrome_enabled() is True
