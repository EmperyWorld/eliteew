# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Aggregate survey results for admin analytics.
# Related:
# - api/routers/product_desktop_surveys.py
# ---

from __future__ import annotations

from collections import Counter
from datetime import date, datetime, time
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.surveys import Survey, SurveyQuestion, SurveyResponse
from api.services.surveys.survey_api_schemas import (
    SurveyResultsQuestionSummaryOut,
    SurveyResultsSummaryOut,
)
from api.services.surveys.survey_audience_service import count_eligible_users


async def build_results_summary(db: AsyncSession, survey: Survey) -> SurveyResultsSummaryOut:
    eligible = await count_eligible_users(db, survey)
    completed = (
        await db.execute(select(func.count()).select_from(SurveyResponse).where(SurveyResponse.survey_id == survey.id))
    ).scalar_one()
    questions = (
        (
            await db.execute(
                select(SurveyQuestion)
                .where(SurveyQuestion.survey_id == survey.id)
                .order_by(SurveyQuestion.sort_order, SurveyQuestion.question_key)
            )
        )
        .scalars()
        .all()
    )
    responses = (await db.execute(select(SurveyResponse).where(SurveyResponse.survey_id == survey.id))).scalars().all()

    per_question: list[SurveyResultsQuestionSummaryOut] = []
    for q in questions:
        key = q.question_key
        values: list[Any] = []
        for resp in responses:
            ans = (resp.answers_json or {}).get(key)
            if ans is not None and ans != "":
                if isinstance(ans, list):
                    values.extend(ans)
                else:
                    values.append(ans)
        qtype = q.question_type
        distribution: dict[str, int] | None = None
        average: float | None = None
        samples: list[str] | None = None
        if qtype in ("single_choice", "multi_choice", "yes_no"):
            distribution = dict(Counter(str(v) for v in values))
        elif qtype in ("scale", "nps"):
            nums = [int(v) for v in values if isinstance(v, (int, float)) or str(v).isdigit()]
            average = round(sum(nums) / len(nums), 2) if nums else None
            distribution = dict(Counter(str(v) for v in nums))
        else:
            samples = [str(v)[:200] for v in values[:5]]
        per_question.append(
            SurveyResultsQuestionSummaryOut(
                question_key=key,
                question_type=qtype,
                prompt=q.prompt,
                response_count=len(values),
                distribution=distribution,
                average=average,
                samples=samples,
            )
        )

    return SurveyResultsSummaryOut(
        survey_id=str(survey.id),
        title=survey.title,
        status=survey.status,
        eligible_users=eligible,
        completed_count=int(completed or 0),
        completion_rate=round(int(completed or 0) / eligible, 4) if eligible else 0.0,
        questions=per_question,
    )


def _response_row_filters(
    survey_id: UUID,
    *,
    submitted_from: date | None = None,
    submitted_to: date | None = None,
) -> list[Any]:
    conditions: list[Any] = [SurveyResponse.survey_id == survey_id]
    if submitted_from is not None:
        conditions.append(SurveyResponse.submitted_at >= datetime.combine(submitted_from, time.min))
    if submitted_to is not None:
        conditions.append(SurveyResponse.submitted_at <= datetime.combine(submitted_to, time.max))
    return conditions


async def list_response_rows(
    db: AsyncSession,
    survey_id: UUID,
    *,
    limit: int = 50,
    offset: int = 0,
    submitted_from: date | None = None,
    submitted_to: date | None = None,
    submitted_sort: str = "desc",
) -> tuple[list[SurveyResponse], int]:
    conditions = _response_row_filters(
        survey_id,
        submitted_from=submitted_from,
        submitted_to=submitted_to,
    )
    order = SurveyResponse.submitted_at.asc() if submitted_sort == "asc" else SurveyResponse.submitted_at.desc()
    total = (await db.execute(select(func.count()).select_from(SurveyResponse).where(*conditions))).scalar_one()
    rows = (
        (await db.execute(select(SurveyResponse).where(*conditions).order_by(order).limit(limit).offset(offset)))
        .scalars()
        .all()
    )
    return list(rows), int(total or 0)
