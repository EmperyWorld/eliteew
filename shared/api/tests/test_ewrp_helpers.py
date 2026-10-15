"""Unit tests: EWRP prompt sanitization and idempotency helpers."""

from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest

from api.services.ewrp_billing import (
    EWRP_CREDITS_PER_SLIDE,
    ewrp_credits_per_slide,
    ewrp_presentation_credit_cost,
)
from api.services.ewrp_idempotency import (
    ewrp_create_idempotency_redis_key,
    normalize_ewrp_create_idempotency_key,
)
from api.services.ewrp_prompt_utils import (
    ensure_ewrp_slide_no_text_clause,
    ewrp_image_prompt_is_low_quality,
    sanitize_ewrp_raw_image_prompt,
    scrub_ewrp_text_bait_subjects,
)
from api.services.ewrp_service import _prompt_for_4k_workflow
from api.services.ewrp_slide_bullets import normalize_ewrp_slide_bullets


@pytest.mark.unit
def test_ewrp_presentation_credit_cost_uses_gen_type_per_slide() -> None:
    per, total = ewrp_presentation_credit_cost(5, SimpleNamespace(cost_credits=200.0))
    assert per == 200
    assert total == 1000


@pytest.mark.unit
def test_ewrp_presentation_credit_cost_falls_back() -> None:
    per, total = ewrp_presentation_credit_cost(5, None)
    assert per == EWRP_CREDITS_PER_SLIDE
    assert total == 5 * EWRP_CREDITS_PER_SLIDE
    assert ewrp_credits_per_slide(SimpleNamespace(cost_credits=0)) == EWRP_CREDITS_PER_SLIDE


@pytest.mark.unit
def test_sanitize_ewrp_raw_image_prompt_strips_quotes() -> None:
    raw = 'concept: "Foo Bar" something'
    out = sanitize_ewrp_raw_image_prompt(raw)
    assert "Foo Bar" not in out or len(out) < len(raw)


@pytest.mark.unit
def test_ewrp_image_prompt_is_low_quality_short() -> None:
    assert ewrp_image_prompt_is_low_quality("short") is True


@pytest.mark.unit
def test_ewrp_image_prompt_is_low_quality_cyrillic() -> None:
    assert ewrp_image_prompt_is_low_quality("красивый пейзаж с горами") is True


@pytest.mark.unit
def test_ewrp_image_prompt_is_low_quality_ok_english() -> None:
    s = (
        "wide angle modern office interior, soft daylight, minimalist furniture, "
        "depth of field, editorial photography, no text"
    )
    assert ewrp_image_prompt_is_low_quality(s) is False


@pytest.mark.unit
def test_scrub_ewrp_text_bait_subjects_rewrites_sign_and_blueprint() -> None:
    raw = (
        "Cinematic shot of a vintage roadside sign glowing in the desert sunset, "
        "and an architectural blueprint on a desk"
    )
    out = scrub_ewrp_text_bait_subjects(raw).lower()
    assert "sign" not in out
    assert "blueprint" not in out
    assert "landmark" in out or "sculpture" in out or "geometric" in out


@pytest.mark.unit
def test_prompt_for_4k_workflow_scrubs_bait_and_forces_no_text() -> None:
    out = _prompt_for_4k_workflow(
        "Close-up of a modern high-tech dashboard with glowing turquoise data charts and financial graphs"
    )
    low = out.lower()
    assert "dashboard" not in low
    assert "charts" not in low or "without labels" in low
    assert "text-free image" in low or "no readable text" in low


@pytest.mark.unit
def test_ensure_ewrp_slide_no_text_clause_idempotent() -> None:
    once = ensure_ewrp_slide_no_text_clause("soft cinematic mist over mountains")
    twice = ensure_ewrp_slide_no_text_clause(once)
    assert once == twice
    assert once.lower().count("text-free image") == 1


@pytest.mark.unit
def test_normalize_idempotency_key_bounds() -> None:
    assert normalize_ewrp_create_idempotency_key(None) is None
    assert normalize_ewrp_create_idempotency_key("  ") is None
    assert normalize_ewrp_create_idempotency_key("short") is None
    assert normalize_ewrp_create_idempotency_key("a" * 129) is None
    assert normalize_ewrp_create_idempotency_key("  " + "b" * 8 + "  ") == "b" * 8


@pytest.mark.unit
def test_normalize_ewrp_slide_bullets_prefers_bullets_list() -> None:
    slide = {"title": "T", "bullets": ["a", "b"], "content": ["x"]}
    assert normalize_ewrp_slide_bullets(slide) == ["a", "b"]


@pytest.mark.unit
def test_normalize_ewrp_slide_bullets_falls_back_to_content() -> None:
    slide = {"title": "T", "content": ["пункт 1", "пункт 2"]}
    assert normalize_ewrp_slide_bullets(slide) == ["пункт 1", "пункт 2"]


@pytest.mark.unit
def test_normalize_ewrp_slide_bullets_multiline_body() -> None:
    slide = {"body": "line one\nline two"}
    assert normalize_ewrp_slide_bullets(slide) == ["line one", "line two"]


@pytest.mark.unit
def test_idempotency_redis_key_stable_per_user() -> None:
    u = uuid.UUID("00000000-0000-0000-0000-0000000000aa")
    k = "key-12345678"
    a = ewrp_create_idempotency_redis_key(u, k)
    b = ewrp_create_idempotency_redis_key(u, k)
    assert a == b
    assert str(u) in a
    c = ewrp_create_idempotency_redis_key(u, "other-12345678")
    assert c != a
