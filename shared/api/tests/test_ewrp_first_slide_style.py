# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract locks for EWRP first-slide cover modes (standard vs title_only).
# Invariants:
# - title_only renders only the title heading over a full-bleed image; no bullets/chrome.
# - Unknown style values normalize to standard.
# Related:
# - api/services/ewrp_templates.py
# - documentation/product/EWRP-REVOLUTIONARY-PRESENTATIONS.md
# ---

from __future__ import annotations

from api.services.ewrp_templates import build_ewrp_html, normalize_first_slide_style


def test_normalize_first_slide_style_defaults_and_aliases() -> None:
    assert normalize_first_slide_style(None) == "standard"
    assert normalize_first_slide_style("") == "standard"
    assert normalize_first_slide_style("standard") == "standard"
    assert normalize_first_slide_style("title_only") == "title_only"
    assert normalize_first_slide_style("title-only") == "title_only"
    assert normalize_first_slide_style("cover") == "title_only"
    assert normalize_first_slide_style("nope") == "standard"


def test_build_ewrp_html_title_only_omits_bullets_and_chrome() -> None:
    html = build_ewrp_html(
        "Deck Title",
        [
            {
                "title": "Cover Headline",
                "bullets": ["should not appear", "nor this"],
                "image_filename": "slide_1.png",
            },
            {
                "title": "Content",
                "bullets": ["Point A"],
                "image_filename": None,
            },
        ],
        first_slide_style="title_only",
    )
    assert 'data-layout="title_only"' in html
    assert 'data-slide="1"' in html
    assert "ewrp-slide-title-only-heading" in html
    assert "Cover Headline" in html
    assert "should not appear" not in html
    assert "nor this" not in html
    # First section markup: no brand/progress/header elements (CSS rules may still mention classes).
    first_section = html.split("<section", 1)[1].split("</section>", 1)[0]
    assert "ewrp-slide-brand" not in first_section
    assert "ewrp-slide-progress" not in first_section
    assert "ewrp-slide-header" not in first_section
    # Content slide still has brand chrome
    second_section = html.split('data-slide="2"', 1)[1].split("</section>", 1)[0]
    assert "ewrp-slide-brand" in second_section
    assert "Point A" in html


def test_build_ewrp_html_standard_keeps_first_slide_bullets() -> None:
    html = build_ewrp_html(
        "Deck Title",
        [
            {
                "title": "Cover Headline",
                "bullets": ["Lead line", "Second point"],
                "image_filename": "slide_1.png",
            }
        ],
        first_slide_style="standard",
    )
    first_section = html.split("<section", 1)[1].split("</section>", 1)[0]
    assert 'data-layout="default"' in first_section
    assert "Lead line" in first_section or "Second point" in first_section
    assert "ewrp-slide-title-only-heading" not in first_section
    assert 'data-layout="title_only"' not in first_section
