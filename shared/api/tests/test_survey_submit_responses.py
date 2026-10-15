# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
#   Survey response submit validation contract (422 vs normalized 201 payload path).
# Related:
#   - api/routers/product_desktop_surveys.py
#   - api/services/surveys/survey_validation.py
# ---

from __future__ import annotations

import pytest

from api.services.surveys.survey_validation import (
    SurveyValidationError,
    validate_answers_for_questions,
)


def _questions() -> list[dict[str, object]]:
    return [
        {
            "question_key": "agree",
            "question_type": "yes_no",
            "required": True,
            "options_json": {},
            "validation_json": {},
        },
        {
            "question_key": "bio",
            "question_type": "text_short",
            "required": True,
            "options_json": {},
            "validation_json": {"max_length": 500},
        },
    ]


def test_submit_validation_accepts_yes_no_false() -> None:
    out = validate_answers_for_questions(_questions(), {"agree": False, "bio": "ok"})
    assert out == {"agree": False, "bio": "ok"}


def test_submit_validation_missing_required_raises_422_detail() -> None:
    with pytest.raises(SurveyValidationError, match="Missing required answer: bio"):
        validate_answers_for_questions(_questions(), {"agree": True})


def test_submit_validation_text_too_long_raises_422_detail() -> None:
    with pytest.raises(SurveyValidationError, match="Text too long for bio"):
        validate_answers_for_questions(
            _questions(),
            {"agree": True, "bio": "x" * 501},
        )


def test_submit_validation_normalized_success_payload() -> None:
    questions = [
        {
            "question_key": "color",
            "question_type": "single_choice",
            "required": True,
            "options_json": {"choices": ["red", "blue"]},
            "validation_json": {},
        },
        {
            "question_key": "score",
            "question_type": "nps",
            "required": True,
            "options_json": {},
            "validation_json": {},
        },
    ]
    out = validate_answers_for_questions(questions, {"color": "blue", "score": 9})
    assert out == {"color": "blue", "score": 9}
