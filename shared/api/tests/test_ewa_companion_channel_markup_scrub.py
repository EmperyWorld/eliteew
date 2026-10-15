# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression lock: Gemma 4 ``<|channel>thought`` / ``<channel|>`` must not reach companion UI.
# Invariants:
# - ``strip_internal_companion_markup`` and stream scrub share ``strip_llm_channel_markup``.
# Related:
# - api/ewa_platform/companion/context/noise.py
# - documentation/product/ewa/EWA-COMPANION-VISIBLE-REPLY-FORMATTING.md
# ---

from __future__ import annotations

import pytest

from api.ewa_platform.companion.context.noise import (
    apply_companion_visible_reply_guards,
    strip_internal_companion_markup,
)
from api.utils.llm_json_extract import strip_llm_channel_markup


@pytest.mark.unit
def test_strip_llm_channel_markup_matches_live_gemma_prefill_leak() -> None:
    """Exact shape seen in prod chat after Gemma 4 Canonical ``enable_thinking=false`` prefill."""

    raw = (
        "<|channel>thought\n"
        "<channel|>Да по-разному: то в потоке, то в раздумьях. "
        "А вообще — в режиме ожидания твоих гениальных идей."
    )
    cleaned = strip_llm_channel_markup(raw)
    assert "<|channel" not in cleaned
    assert "<channel|" not in cleaned
    assert cleaned.startswith("Да по-разному")


@pytest.mark.unit
def test_strip_internal_companion_markup_removes_channel_prefix() -> None:
    raw = "<|channel>thought\n<channel|>Привет, я рядом."
    assert strip_internal_companion_markup(raw) == "Привет, я рядом."


@pytest.mark.unit
def test_apply_companion_visible_reply_guards_strips_channel_markup() -> None:
    raw = "<|channel>thought\n<channel|>Ок, слушаю."
    out = apply_companion_visible_reply_guards(
        raw,
        user_line="привет",
        intent_plan=None,
        actions=None,
        trivial_user_message=True,
    )
    assert out == "Ок, слушаю."
    assert "channel" not in out.lower()
