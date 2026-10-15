"""EWRP content-quality detection for degraded template fallback."""

from __future__ import annotations

from api.services.ewrp_content_quality import (
    EWRP_CONTENT_QUALITY_DEGRADED,
    EWRP_CONTENT_QUALITY_FULL,
    EWRP_CONTENT_SOURCE_TEMPLATE_FALLBACK,
    ewrp_content_quality_from_slides,
    is_ewrp_template_fallback_slide,
)


def test_template_fallback_slide_detected_by_bullets() -> None:
    topic = "Lexus ES300h"
    slide = {
        "title": "Слайд 3: Lexus ES300h",
        "content": [
            "Ключевые идеи по теме «Lexus ES300h».",
            "Детализация на последующих слайдах.",
        ],
    }
    assert is_ewrp_template_fallback_slide(slide, topic) is True


def test_content_quality_degraded_when_all_template_slides() -> None:
    topic = "Lexus ES300h"
    slides = [
        {
            "title": f"Слайд {i}: {topic}",
            "content": [
                f"Ключевые идеи по теме «{topic}».",
                "Детализация на последующих слайдах.",
            ],
        }
        for i in range(1, 6)
    ]
    quality, warning = ewrp_content_quality_from_slides(slides, topic=topic)
    assert quality == EWRP_CONTENT_QUALITY_DEGRADED
    assert warning


def test_content_quality_full_for_real_slides() -> None:
    slides = [
        {
            "title": "Гибридная система Lexus",
            "content": ["Двигатель 2.5 л", "Электромотор высокой мощности"],
        }
    ]
    quality, warning = ewrp_content_quality_from_slides(slides, topic="Lexus ES300h")
    assert quality == EWRP_CONTENT_QUALITY_FULL
    assert warning is None


def test_content_quality_from_recorded_source() -> None:
    quality, warning = ewrp_content_quality_from_slides(
        None,
        recorded_source=EWRP_CONTENT_SOURCE_TEMPLATE_FALLBACK,
    )
    assert quality == EWRP_CONTENT_QUALITY_DEGRADED
    assert warning
