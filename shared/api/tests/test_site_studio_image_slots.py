# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Site Studio ImperorG image slot registry stays aligned with neutral olenti baseline docs.
# Related:
# - api/services/site_studio_ai_service.py
# ---
from __future__ import annotations

from api.services.site_studio_ai_service import (
    _IMAGE_SLOTS,
    _SITE_STUDIO_IMAGE_NO_TEXT_POSITIVE,
    SiteStudioAIService,
    site_studio_image_negative_prompt,
)
from api.services.ugs.providers.comfyui_provider import _finalize_z_image_user_prompt


def test_site_studio_image_slots_include_neutral_about_extras() -> None:
    slot_ids = {slot["slotId"] for slot in _IMAGE_SLOTS}
    assert len(slot_ids) == 6
    assert "about.philosophy.ingredients" in slot_ids
    assert "about.process.crafting" in slot_ids


def test_site_studio_image_negative_prompt_blocks_cyrillic_gibberish() -> None:
    negative = site_studio_image_negative_prompt()
    assert "cyrillic" in negative.lower()
    assert "gibberish" in negative.lower()
    assert "pseudo-text" in negative.lower()


def test_site_studio_image_negative_prompt_merges_extra_once() -> None:
    merged = site_studio_image_negative_prompt("extra artifact")
    assert merged.startswith("text, letters")
    assert merged.endswith("extra artifact")
    assert site_studio_image_negative_prompt("cyrillic") == site_studio_image_negative_prompt()


def test_build_image_generation_input_appends_no_text_guard() -> None:
    service = SiteStudioAIService(db=None)  # type: ignore[arg-type]
    payload = service.build_image_generation_input(
        _FakeInstance(),
        slot_id="home.hero.background",
    )
    prompt = payload["input"]["prompt"]
    negative = payload["input"]["negative_prompt"]
    assert _SITE_STUDIO_IMAGE_NO_TEXT_POSITIVE in prompt
    assert "cyrillic" in negative.lower()
    assert "render zero text" in prompt.lower()
    assert "fitness club" in prompt
    assert '"' not in prompt
    assert "Brand Name" not in prompt
    assert payload["input"]["width"] == 1600
    assert payload["input"]["height"] == 896
    assert payload["input"]["workflow_key"] == "site_studio_photo"
    assert payload["input"]["workflow_template"] == "site_studio_photo"
    # Site/brand names must not be injected into default image prompts.
    assert "Плазма" not in prompt
    assert "brand or site" not in prompt.lower()


def test_build_image_generation_input_strips_cyrillic_topic() -> None:
    service = SiteStudioAIService(db=None)  # type: ignore[arg-type]
    instance = _FakeInstance()
    instance.site_topic = "фитнес клуб fitness loft"
    payload = service.build_image_generation_input(instance, slot_id="home.hero.background")
    prompt = payload["input"]["prompt"]
    assert "фитнес" not in prompt
    assert "fitness loft" in prompt


def test_build_image_generation_input_keeps_english_wordmark() -> None:
    service = SiteStudioAIService(db=None)  # type: ignore[arg-type]
    payload = service.build_image_generation_input(
        _FakeInstance(),
        slot_id="home.hero.background",
        prompt='dusk plaza, "Plasma Studio"',
    )
    prompt = payload["input"]["prompt"]
    assert "Plasma Studio" in prompt
    assert "render zero text" not in prompt.lower()


def test_build_image_generation_input_portrait_keeps_aspect() -> None:
    service = SiteStudioAIService(db=None)  # type: ignore[arg-type]
    payload = service.build_image_generation_input(
        _FakeInstance(),
        slot_id="home.about_preview.portrait",
    )
    assert payload["input"]["width"] == 1200
    assert payload["input"]["height"] == 1600
    assert payload["input"]["workflow_key"] == "site_studio_photo"


def test_image_slot_guidances_are_visually_distinct() -> None:
    leads = [str(slot["promptGuidance"])[:48] for slot in _IMAGE_SLOTS]
    assert len(set(leads)) == len(leads)


def test_build_image_generation_input_custom_prompt_gets_no_text_guard() -> None:
    service = SiteStudioAIService(db=None)  # type: ignore[arg-type]
    payload = service.build_image_generation_input(
        _FakeInstance(),
        slot_id="home.hero.background",
        prompt="Premium fitness club interior, warm daylight",
    )
    prompt = payload["input"]["prompt"]
    assert prompt.startswith("Premium fitness club interior")
    assert _SITE_STUDIO_IMAGE_NO_TEXT_POSITIVE in prompt


def test_comfyui_z_image_prompt_suffix_blocks_cyrillic_text() -> None:
    finalized = _finalize_z_image_user_prompt("Premium fitness club hero background")
    assert "cyrillic" in finalized.lower()
    assert "no readable text" in finalized.lower()
    assert "unless the prompt contains" not in finalized.lower()


class _FakeInstance:
    site_title = "Плазма"
    site_topic = "fitness club"
    brief_json: dict = {}
