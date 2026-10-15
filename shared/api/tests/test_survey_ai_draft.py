# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
#   Lock survey AI draft JSON normalization (no live LLM in unit tests).
# Related:
#   - api/services/surveys/survey_ai_draft_service.py
# ---

from __future__ import annotations

import pytest

from api.services.surveys.survey_ai_draft_service import (
    _extract_json_object,
    normalize_survey_ai_draft,
)


def test_extract_json_object_strips_markdown_fence() -> None:
    raw = '```json\n{"title": "T", "questions": [{"prompt": "Q?", "question_type": "yes_no"}]}\n```'
    parsed = _extract_json_object(raw)
    assert parsed["title"] == "T"


def test_normalize_survey_ai_draft_maps_choice_types() -> None:
    out = normalize_survey_ai_draft(
        {
            "title": "Pulse check",
            "description_user": "Help us improve",
            "questions": [
                {
                    "question_key": "satisfaction",
                    "question_type": "scale",
                    "prompt": "Rate overall experience",
                    "required": True,
                },
                {
                    "question_key": "channel",
                    "question_type": "single_choice",
                    "prompt": "Preferred channel",
                    "choices": ["Email", "Chat"],
                },
            ],
        }
    )
    assert out["title"] == "Pulse check"
    assert len(out["questions"]) == 2
    assert out["questions"][0]["options_json"] == {"min": 1, "max": 5}
    assert out["questions"][1]["options_json"]["choices"] == ["Email", "Chat"]


def test_normalize_requires_title_and_questions() -> None:
    with pytest.raises(ValueError, match="title"):
        normalize_survey_ai_draft({"questions": [{"prompt": "x", "question_type": "text_short"}]})
