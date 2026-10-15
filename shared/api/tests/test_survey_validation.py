# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
#   Survey answer validation contract tests.
# Related:
#   - api/services/surveys/survey_validation.py
# ---

from __future__ import annotations

import pytest

from api.services.surveys.survey_validation import (
    SurveyValidationError,
    validate_answers_for_questions,
)


def test_validate_required_missing_raises() -> None:
    questions = [
        {
            "question_key": "q1",
            "question_type": "text_short",
            "required": True,
            "options_json": {},
            "validation_json": {},
        }
    ]
    with pytest.raises(SurveyValidationError, match="Missing required"):
        validate_answers_for_questions(questions, {})


def test_validate_single_choice_and_nps() -> None:
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


def test_validate_invalid_choice_raises() -> None:
    questions = [
        {
            "question_key": "color",
            "question_type": "single_choice",
            "required": True,
            "options_json": {"choices": ["red"]},
            "validation_json": {},
        }
    ]
    with pytest.raises(SurveyValidationError, match="Invalid choice"):
        validate_answers_for_questions(questions, {"color": "green"})
