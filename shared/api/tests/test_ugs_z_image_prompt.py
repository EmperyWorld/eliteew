# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# z-image-turbo prompt hygiene: no quote-bait, no Cyrillic paint, native 1024 latent.
# Related:
# - api/services/ugs/z_image_prompt.py
# ---
from __future__ import annotations

from api.services.ugs.z_image_prompt import (
    SITE_STUDIO_IMAGE_NO_TEXT_POSITIVE,
    _finalize_z_image_user_prompt,
    extract_english_wordmarks,
    is_english_wordmark,
    sanitize_z_image_visual_prompt,
    snap_z_image_turbo_latent,
    strip_invalid_quoted_labels,
)


def test_snap_z_image_turbo_latent_is_always_native() -> None:
    assert snap_z_image_turbo_latent(1600, 900) == (1024, 1024)
    assert snap_z_image_turbo_latent(1200, 1600) == (1024, 1024)


def test_no_text_clause_has_no_example_quotes() -> None:
    assert '"' not in SITE_STUDIO_IMAGE_NO_TEXT_POSITIVE
    assert "Brand Name" not in SITE_STUDIO_IMAGE_NO_TEXT_POSITIVE
    assert "render zero text" in SITE_STUDIO_IMAGE_NO_TEXT_POSITIVE.lower()


def test_strip_invalid_quotes_drops_cyrillic_and_examples() -> None:
    cleaned = strip_invalid_quoted_labels('atelier interior, "Бренд", "Brand Name", extra')
    assert "Бренд" not in cleaned
    assert "Brand Name" not in cleaned
    assert '"' not in cleaned


def test_english_wordmark_kept() -> None:
    assert is_english_wordmark("Plasma Studio")
    assert not is_english_wordmark("Плазма")
    assert not is_english_wordmark("Brand Name")
    kept = strip_invalid_quoted_labels('wide plaza, "Plasma Studio"')
    assert extract_english_wordmarks(kept) == ["Plasma Studio"]


def test_sanitize_strips_cyrillic_and_text_bait() -> None:
    out = sanitize_z_image_visual_prompt("фитнес клуб neon sign and fitness interior")
    assert "фитнес" not in out
    assert "sign" not in out.lower() or "light" in out.lower()
    assert "fitness interior" in out.lower()


def test_finalize_default_blocks_all_lettering() -> None:
    finalized = _finalize_z_image_user_prompt("Premium fitness club hero background")
    assert "no readable text" in finalized.lower()
    assert "no cyrillic" in finalized.lower()
    assert "unless the prompt contains" not in finalized.lower()
    assert "Brand Name" not in finalized


def test_finalize_keeps_english_wordmark_only() -> None:
    finalized = _finalize_z_image_user_prompt('dusk plaza, "Plasma Studio"')
    assert "Plasma Studio" in finalized
    assert "english wordmark already named" in finalized.lower()
    assert "no latin characters" not in finalized.lower()
