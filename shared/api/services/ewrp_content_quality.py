# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Detect EWRP template-fallback slide content and derive public content-quality flags for status API.
# Invariants:
# - Template fallback markers must stay in sync with ``PresentationContentGeneratorService._fallback_slides``.
# Related:
# - api/services/presentation_content_generator_service.py
# - api/services/ewrp_status_service.py
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

EWRP_CONTENT_SOURCE_TEMPLATE_FALLBACK = "template_fallback"
EWRP_CONTENT_SOURCE_TWO_PHASE = "two_phase"
EWRP_CONTENT_SOURCE_MONOLITHIC = "monolithic"

EWRP_CONTENT_QUALITY_FULL = "full"
EWRP_CONTENT_QUALITY_DEGRADED = "degraded"

EWRP_CONTENT_WARNING_DEGRADED_RU = (
    "Текст слайдов подставлен шаблоном: модель вернула неполный или битый JSON. "
    "Отредактируйте слайды вручную или запустите повтор генерации."
)


def ewrp_template_fallback_bullets(topic: str) -> tuple[str, str]:
    topic_clean = (topic or "").strip() or "тема"
    return (
        f"Ключевые идеи по теме «{topic_clean}».",
        "Детализация на последующих слайдах.",
    )


def is_ewrp_template_fallback_slide(slide: Mapping[str, Any], topic: str) -> bool:
    """True when slide content matches last-resort template fallback bullets."""
    if slide.get("content_source") == EWRP_CONTENT_SOURCE_TEMPLATE_FALLBACK:
        return True
    title = str(slide.get("title") or "")
    topic_clean = (topic or "").strip()
    if topic_clean and title.startswith("Слайд ") and title.endswith(f": {topic_clean}"):
        bullets: list[str] = []
        for key in ("content", "bullets"):
            raw = slide.get(key)
            if isinstance(raw, list):
                bullets = [str(b).strip() for b in raw if str(b).strip()]
                break
        expected = list(ewrp_template_fallback_bullets(topic_clean))
        return bullets == expected
    return False


def ewrp_content_quality_from_slides(
    slides_json: list[dict[str, Any]] | None,
    *,
    topic: str | None = None,
    recorded_source: str | None = None,
) -> tuple[str, str | None]:
    """Return ``(content_quality, content_warning)`` for status DTO."""
    if recorded_source == EWRP_CONTENT_SOURCE_TEMPLATE_FALLBACK:
        return EWRP_CONTENT_QUALITY_DEGRADED, EWRP_CONTENT_WARNING_DEGRADED_RU
    if not slides_json:
        return EWRP_CONTENT_QUALITY_FULL, None
    topic_clean = (topic or "").strip()
    fallback_hits = sum(
        1 for s in slides_json if isinstance(s, dict) and is_ewrp_template_fallback_slide(s, topic_clean)
    )
    if fallback_hits == 0:
        return EWRP_CONTENT_QUALITY_FULL, None
    if fallback_hits >= max(1, len(slides_json) // 2):
        return EWRP_CONTENT_QUALITY_DEGRADED, EWRP_CONTENT_WARNING_DEGRADED_RU
    return EWRP_CONTENT_QUALITY_FULL, None
