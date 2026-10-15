#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock Wave F0 council turn-order brief and parallel-request detection.
# Invariants:
# - ensemble_joint_parallel_sections defaults false; stream_turn ignores a true request.
# - Peer context is owned by council_speech.py, never by this module.
# Related:
# - archive/legacy_freeform/council_brief.py
# - archive/legacy_freeform/joint_parallel.py
# ---
"""Wave F0: stop the parallel race — council brief helpers."""

from __future__ import annotations

from api.services.desktop_chat_ensemble.archive.legacy_freeform.council_brief import (
    council_speaker_brief_block,
    resolve_council_mode,
)
from api.services.desktop_chat_ensemble.archive.legacy_freeform.joint_parallel import (
    joint_parallel_sections_enabled,
)


def test_joint_parallel_flag_default_off_wave_f0() -> None:
    assert joint_parallel_sections_enabled({}, speaker_count=3) is False
    assert joint_parallel_sections_enabled({"ensemble_joint_parallel_sections": False}, speaker_count=3) is False
    assert joint_parallel_sections_enabled({"ensemble_joint_parallel_sections": True}, speaker_count=3) is True
    assert joint_parallel_sections_enabled({"ensemble_joint_parallel_sections": True}, speaker_count=1) is False


def test_resolve_council_mode() -> None:
    assert resolve_council_mode("joint") == "joint_document"
    assert resolve_council_mode("separate") == "discussion"


def test_council_speaker_brief_mentions_position_and_remaining() -> None:
    speakers = ["max_safin", "viktor_engineer", "elena_valeryevna"]
    first = council_speaker_brief_block(
        index=0,
        speakers=speakers,
        mode="joint_document",
        hero_id="max_safin",
    )
    assert "ход 1 из 3" in first
    assert "После тебя ещё выскажутся" in first

    mid = council_speaker_brief_block(
        index=1,
        speakers=speakers,
        mode="discussion",
        hero_id="viktor_engineer",
    )
    assert "ход 2 из 3" in mid
    assert "Учти уже сказанное" in mid
    assert "дискуссии" in mid.casefold()

    last = council_speaker_brief_block(
        index=2,
        speakers=speakers,
        mode="joint_document",
        hero_id="elena_valeryevna",
    )
    assert "последний" in last.casefold()
