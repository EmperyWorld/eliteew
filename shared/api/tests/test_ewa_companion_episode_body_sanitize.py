# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for ``sanitize_companion_episode_body_for_storage`` and episodic **intent reorder** helpers so
# llama-server telemetry never reaches Qdrant/PG prompts while intent-tagged rows surface first when configured.
# Invariants:
# - No network / DB; env toggles for intent prioritization are set per test case.
# Related:
# - api/ewa_platform/companion/episodic/body_sanitize.py
# - documentation/platform/AGENT-CODE-VERIFICATION-WORKFLOW.md
# ---
"""Tests: companion episodic body sanitizer (llama-server log hygiene)."""

from __future__ import annotations

from api.ewa_platform.companion.episodic.body_sanitize import (
    sanitize_companion_episode_body_for_storage,
)


def test_sanitize_drops_llama_server_telemetry_lines() -> None:
    raw = (
        "User asked about wallpaper.\n"
        "srv  update: prompt_save: n_ctx_slot = 8192, n_ctx = 262144\n"
        "slot 3: KV cache RAM … 1200 MiB\n"
        "Thanks, switching theme now."
    )
    out = sanitize_companion_episode_body_for_storage(raw)
    assert "prompt_save" not in out.lower()
    assert "User asked" in out
    assert "Thanks" in out


def test_sanitize_empty_when_only_logs() -> None:
    raw = "srv  slot 1: lost a slot\nGGML_ASSERT(false)\n"
    assert sanitize_companion_episode_body_for_storage(raw) == ""
