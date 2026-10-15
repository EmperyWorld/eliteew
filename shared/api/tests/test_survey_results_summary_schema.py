# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for Survey Hub results summary OpenAPI schema.
# Related:
# - api/services/surveys/survey_api_schemas.py
# ---

from __future__ import annotations

from api.services.surveys.survey_api_schemas import (
    SurveyResultsQuestionSummaryOut,
    SurveyResultsSummaryOut,
)


def test_survey_results_summary_out_roundtrip() -> None:
    payload = SurveyResultsSummaryOut(
        survey_id="00000000-0000-0000-0000-000000000001",
        title="Pulse check",
        status="published",
        eligible_users=10,
        completed_count=4,
        completion_rate=0.4,
        questions=[
            SurveyResultsQuestionSummaryOut(
                question_key="nps",
                question_type="nps",
                prompt="Recommend?",
                response_count=4,
                distribution={"9": 2, "10": 2},
                average=9.5,
            ),
            SurveyResultsQuestionSummaryOut(
                question_key="comment",
                question_type="text",
                prompt="Comment",
                response_count=2,
                samples=["Great", "Needs work"],
            ),
        ],
    )
    restored = SurveyResultsSummaryOut.model_validate(payload.model_dump())
    assert restored.survey_id == payload.survey_id
    assert restored.questions[0].average == 9.5
    assert restored.questions[1].samples == ["Great", "Needs work"]
