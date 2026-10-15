# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
#   Published survey PATCH guard: only closes_at may change.
# Related:
#   - api/services/surveys/survey_api_schemas.py
# ---

from __future__ import annotations

from api.services.surveys.survey_api_schemas import SurveyPatchBody, published_survey_patch_allowed


def test_published_patch_allows_closes_at_only() -> None:
    body = SurveyPatchBody.model_validate({"closes_at": "2026-08-01T12:00:00Z"})
    assert published_survey_patch_allowed(body) is True


def test_published_patch_allows_clear_closes_at() -> None:
    body = SurveyPatchBody(closes_at=None)
    assert published_survey_patch_allowed(body) is True


def test_published_patch_rejects_empty_body() -> None:
    body = SurveyPatchBody()
    assert published_survey_patch_allowed(body) is False


def test_published_patch_rejects_title_change() -> None:
    body = SurveyPatchBody.model_validate({"title": "New title"})
    assert published_survey_patch_allowed(body) is False


def test_published_patch_rejects_mixed_fields() -> None:
    body = SurveyPatchBody.model_validate({"closes_at": "2026-08-01T12:00:00Z", "title": "x"})
    assert published_survey_patch_allowed(body) is False
