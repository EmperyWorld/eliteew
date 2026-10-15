# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Tests for companion music run reconcile helpers (UGS correlation keys, intent allowlist).
# Invariants:
# - Stale reaper only targets async music intent kinds.
# Related:
# - api/ewa_platform/companion/jobs/music_run_reconcile.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.jobs.music_run_reconcile import (
    MUSIC_ASYNC_INTENT_KINDS,
    companion_ugs_correlation_payload,
)


def test_companion_ugs_correlation_payload() -> None:
    payload = companion_ugs_correlation_payload(
        run_id="run-1",
        step_id="step-1",
        principal_id="principal-1",
    )
    assert payload == {
        "ewa_companion_run_id": "run-1",
        "ewa_companion_step_id": "step-1",
        "ewa_companion_principal_id": "principal-1",
    }


def test_music_async_intent_kinds_include_xl_base() -> None:
    assert "music_generation_background" in MUSIC_ASYNC_INTENT_KINDS
    assert "music_generation_xl_base_background" in MUSIC_ASYNC_INTENT_KINDS
