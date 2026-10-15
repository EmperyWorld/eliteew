# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for env-gated companion degrade debug logging.
# Invariants:
# - ``EWA_COMPANION_DEGRADE_DEBUG=0`` silences degrade logs without changing caller fallbacks.
# Related:
# - api/ewa_platform/companion/observability/degrade_log.py
# ---

from __future__ import annotations

import logging

import pytest

from api.ewa_platform.companion.observability.degrade_log import (
    companion_degrade_debug,
    companion_degrade_debug_enabled,
)


def test_companion_degrade_debug_enabled_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_DEGRADE_DEBUG", raising=False)
    assert companion_degrade_debug_enabled() is True


@pytest.mark.parametrize("value", ("0", "false", "off", "no"))
def test_companion_degrade_debug_disabled_via_env(
    monkeypatch: pytest.MonkeyPatch,
    value: str,
) -> None:
    monkeypatch.setenv("EWA_COMPANION_DEGRADE_DEBUG", value)
    assert companion_degrade_debug_enabled() is False


def test_companion_degrade_debug_emits_when_enabled(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    monkeypatch.delenv("EWA_COMPANION_DEGRADE_DEBUG", raising=False)
    logger = logging.getLogger("test.companion_degrade")
    with caplog.at_level(logging.DEBUG, logger="test.companion_degrade"):
        companion_degrade_debug(logger, "unit", "probe", run_id="r1")
    assert any("companion_degrade context=unit probe run_id=r1" in rec.message for rec in caplog.records)


def test_companion_degrade_debug_silent_when_disabled(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    monkeypatch.setenv("EWA_COMPANION_DEGRADE_DEBUG", "0")
    logger = logging.getLogger("test.companion_degrade_off")
    with caplog.at_level(logging.DEBUG, logger="test.companion_degrade_off"):
        companion_degrade_debug(logger, "unit", "probe")
    assert not caplog.records
