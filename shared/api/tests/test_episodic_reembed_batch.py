# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract smoke for episodic vector **re-embed Celery shard** helpers (Wave 1 HCM housekeeping).
# Invariants:
# - No Postgres / Redis; toggles exercised via monkeypatch.
# Related:
# - api/ewa_platform/companion/episodic/reembed.py
# ---
"""Tests: companion episodic re-embed batch."""

from __future__ import annotations

import asyncio

import pytest

from api.ewa_platform.companion import episodic_reembed as rer


def test_reembed_returns_skip_when_hcm_writes_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_HCM_EPISODIC_ENABLED", "0")

    async def __run() -> dict:
        obj = object()
        return await rer.companion_reembed_pending_episodes_batch(obj)

    out = asyncio.run(__run())
    assert out["skipped"] is True
    assert out.get("indexed", 0) == 0
