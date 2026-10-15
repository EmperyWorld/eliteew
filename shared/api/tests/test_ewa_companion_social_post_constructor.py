# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for multi-pass social post constructor (outline parse + pipeline gates).
# Related:
# - api/ewa_platform/companion/orchestration/companion_social_post_constructor.py
# ---

from __future__ import annotations

import pytest

from api.ewa_platform.companion.orchestration.companion_social_post_constructor import (
    parse_post_outline,
    social_post_pipeline_mode,
    uses_constructor_pipeline,
)


@pytest.mark.unit
def test_parse_post_outline_sections() -> None:
    raw = (
        "## HOOK\n"
        "Почему Владивосток не Москва\n"
        "## SECTION: Рынок сейчас\n"
        "- дефицит центра\n"
        "- развязки\n"
        "## SECTION: Ошибки покупателей\n"
        "- покупка «на эмоциях»\n"
        "## CTA\n"
        "Что бы вы выбрали?\n"
        "## HASHTAGS\n"
        "#vl #realty"
    )
    hook, sections, cta, tags = parse_post_outline(raw)
    assert "Владивосток" in hook
    assert len(sections) == 2
    assert sections[0].title == "Рынок сейчас"
    assert "дефицит" in sections[0].brief
    assert "выбрали" in cta
    assert tags.startswith("#")


@pytest.mark.unit
def test_uses_constructor_for_vk_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_SOCIAL_POST_PIPELINE", raising=False)
    assert social_post_pipeline_mode() == "constructor"
    assert uses_constructor_pipeline(channel="vk", short_mode=False) is True
    assert uses_constructor_pipeline(channel="twitter", short_mode=False) is False
    assert uses_constructor_pipeline(channel="vk", short_mode=True) is False


@pytest.mark.unit
def test_long_form_forces_constructor_when_pipeline_single(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_SOCIAL_POST_PIPELINE", "single")
    assert uses_constructor_pipeline(channel="vk", short_mode=False, long_form=True) is True
    assert uses_constructor_pipeline(channel="vk", short_mode=False, long_form=False) is False


@pytest.mark.unit
def test_single_pipeline_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_SOCIAL_POST_PIPELINE", "single")
    assert social_post_pipeline_mode() == "single"
    assert uses_constructor_pipeline(channel="vk", short_mode=False) is False
