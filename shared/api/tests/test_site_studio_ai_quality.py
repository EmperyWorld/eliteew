# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression tests for Site Studio AI quality checks that gate generated content before runtime apply.
# Invariants:
# - Empty, placeholder, demo drift, and maxLength overflow are hard failures.
# - Soft findings do not hide hard findings for the same validation run.
# Related:
# - api/services/site_studio_ai_quality.py
# - api/services/imperorg_service.py
# ---
from __future__ import annotations

import pytest

from api.services.site_studio_ai_quality import (
    has_hard_quality_findings,
    validate_site_studio_content_blocks,
)


@pytest.mark.unit
def test_quality_validator_rejects_empty_and_ellipsis_placeholders() -> None:
    findings = validate_site_studio_content_blocks(
        [
            {"page": "home", "section": "hero", "key": "headline", "value": ""},
            {"page": "home", "section": "hero", "key": "lead", "value": "..."},
        ],
        site_title="Lexus ES300h",
        site_topic="premium auto",
    )

    assert {finding["code"] for finding in findings} >= {"empty_value", "placeholder_ellipsis"}
    assert has_hard_quality_findings(findings)


@pytest.mark.unit
def test_quality_validator_rejects_template_demo_brand_drift() -> None:
    findings = validate_site_studio_content_blocks(
        [
            {
                "page": "home",
                "section": "hero",
                "key": "lead",
                "value": "Ollenti и ароматы Ольги Бутенко для вашего премиального автомобиля.",
                "maxLength": 200,
            }
        ],
        site_title="Lexus ES300h",
        site_topic="premium auto",
    )

    assert any(finding["code"] == "template_demo_drift" for finding in findings)
    assert has_hard_quality_findings(findings)


@pytest.mark.unit
def test_quality_validator_rejects_max_length_overflow() -> None:
    findings = validate_site_studio_content_blocks(
        [
            {
                "page": "home",
                "section": "hero",
                "key": "badge",
                "value": "Очень длинный бейдж для главного экрана",
                "maxLength": 10,
            }
        ],
        site_title="Brand",
        site_topic="services",
    )

    assert any(finding["code"] == "max_length_overflow" for finding in findings)
    assert has_hard_quality_findings(findings)
