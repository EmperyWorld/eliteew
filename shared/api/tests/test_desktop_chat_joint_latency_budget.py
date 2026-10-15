#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock Wave B joint latency: document speaker cap, polish skip-compression, parallel flag.
# Invariants:
# - Document-heavy joint trims to min(global, document_cap); chatty joint unchanged.
# - Pre-polish duplicate drops skip compression retries.
# - Wave F0: parallel defaults off (opt-in only).
# Related:
# - archive/legacy_freeform/orchestrator.py
# - archive/legacy_freeform/joint_polish.py
# - archive/legacy_freeform/joint_parallel.py
# ---
"""Wave B: joint latency budget helpers (+ F0 parallel default-off)."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from api.services.desktop_chat_ensemble.archive.legacy_freeform.joint_parallel import (
    gather_ordered,
    joint_parallel_sections_enabled,
)
from api.services.desktop_chat_ensemble.archive.legacy_freeform.joint_polish import (
    _pre_polish_has_dropped_duplicates,
    polish_joint_concat,
)
from api.services.desktop_chat_ensemble.archive.legacy_freeform.orchestrator import (
    EnsembleTaskBlock,
    EnsembleTurnPlan,
    apply_joint_latency_speaker_cap,
    resolve_joint_document_max_speakers,
    user_document_heavy_request,
)


def _plan(speakers: list[str], *, delivery: str = "joint") -> EnsembleTurnPlan:
    blocks = tuple(
        EnsembleTaskBlock(
            block_id=f"b{i + 1}",
            hero_id=hid,
            title=f"Block {hid}",
            objective=f"Cover {hid}",
            phase="body",
        )
        for i, hid in enumerate(speakers)
    )
    return EnsembleTurnPlan(
        speakers=list(speakers),
        delivery_mode=delivery,
        reason="test",
        focus_by_id={h: f"focus {h}" for h in speakers},
        huddle_lines=["ok"],
        task_blocks=blocks,
        max_speakers_this_turn=len(speakers),
        roster_size=len(speakers),
    )


def test_user_document_heavy_request_detects_registry() -> None:
    assert user_document_heavy_request("Составьте реестр из 60 уникальных приложений по пунктам для MVP backlog")
    assert not user_document_heavy_request("привет всем")
    assert not user_document_heavy_request("что скажете о проекте?")


def test_apply_joint_latency_speaker_cap_trims_document_heavy() -> None:
    plan = _plan(["a", "b", "c", "d", "e", "f"])
    capped = apply_joint_latency_speaker_cap(
        plan,
        defaults={"ensemble_joint_document_max_speakers": 4},
        user_excerpt="Нужен реестр модулей по пунктам для MVP",
    )
    assert capped.speakers == ["a", "b", "c", "d"]
    assert len(capped.task_blocks) == 4
    assert capped.max_speakers_this_turn == 4


def test_apply_joint_latency_speaker_cap_respects_global_min() -> None:
    plan = _plan(["a", "b", "c", "d", "e"])
    plan = EnsembleTurnPlan(
        speakers=plan.speakers,
        delivery_mode=plan.delivery_mode,
        reason=plan.reason,
        focus_by_id=plan.focus_by_id,
        huddle_lines=plan.huddle_lines,
        task_blocks=plan.task_blocks,
        max_speakers_this_turn=3,
        roster_size=5,
    )
    capped = apply_joint_latency_speaker_cap(
        plan,
        defaults={"ensemble_joint_document_max_speakers": 4},
        user_excerpt="Сделайте единый документ roadmap",
    )
    assert capped.speakers == ["a", "b", "c"]


def test_apply_joint_latency_speaker_cap_skips_chatty() -> None:
    plan = _plan(["a", "b", "c", "d", "e"])
    same = apply_joint_latency_speaker_cap(
        plan,
        defaults={},
        user_excerpt="Как вам настроение сегодня?",
    )
    assert same.speakers == plan.speakers


def test_resolve_joint_document_max_speakers_default() -> None:
    assert resolve_joint_document_max_speakers({}) == 4
    assert resolve_joint_document_max_speakers({"ensemble_joint_document_max_speakers": 2}) == 2


def test_pre_polish_has_dropped_duplicates() -> None:
    assert _pre_polish_has_dropped_duplicates(["dropped_duplicate_section:Alpha"])
    assert not _pre_polish_has_dropped_duplicates(["stripped_joint_preamble"])
    assert not _pre_polish_has_dropped_duplicates(None)


def test_joint_parallel_flag_default_off() -> None:
    """Wave F0: parallel is opt-in; empty defaults → sequential council."""
    assert joint_parallel_sections_enabled({}, speaker_count=3) is False
    assert joint_parallel_sections_enabled({"ensemble_joint_parallel_sections": True}, speaker_count=3) is True
    assert joint_parallel_sections_enabled({"ensemble_joint_parallel_sections": False}, speaker_count=3) is False
    assert joint_parallel_sections_enabled({}, speaker_count=1) is False


@pytest.mark.asyncio
async def test_gather_ordered_preserves_order() -> None:
    async def slow(n: int) -> int:
        return n

    out = await gather_ordered([slow(2), slow(0), slow(1)])
    assert out == [2, 0, 1]


@pytest.mark.asyncio
async def test_polish_skips_compression_when_pre_dedupe_notes() -> None:
    long_raw = ("## A\n\n" + ("word " * 800)).strip()
    short_polished = "## A\n\nshort"
    stats: dict[str, object] = {}

    async def fake_completion(**_kwargs):  # type: ignore[no-untyped-def]
        return {
            "response": short_polished,
            "prompt_eval_count": 1,
            "eval_count": 10,
            "finish_reason": "stop",
        }

    with (
        patch(
            "api.services.desktop_chat_ensemble.archive.legacy_freeform.joint_polish.desktop_chat_completion",
            new=AsyncMock(side_effect=fake_completion),
        ),
        patch(
            "api.services.desktop_chat_ensemble.archive.legacy_freeform.joint_polish.ensemble_audit_log.log_llm_chat",
            new=AsyncMock(),
        ),
    ):
        out = await polish_joint_concat(
            model="test",
            stitched=long_raw,
            user_excerpt="list apps",
            defaults={
                "ensemble_joint_polish_enabled": True,
                "ensemble_joint_polish_compression_retry": True,
                "ensemble_joint_polish_min_post_ratio_short": 0.99,
            },
            pre_polish_dedupe_notes=["dropped_duplicate_section:Beta"],
            out_stats=stats,
        )
    assert stats.get("compression_skipped") is True
    # Short polish + skip compression → revert to dedupe fallback (not endless compression)
    assert stats.get("polish_reverted") is True
    assert "word" in out or out.startswith("##")
