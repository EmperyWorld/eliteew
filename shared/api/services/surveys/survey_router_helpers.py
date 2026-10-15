# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Survey Hub router persistence helpers shared by user/admin routes.
# Related:
# - api/routers/product_desktop_surveys*.py
# ---

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, cast
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.models.database_models import User as DBUser
from api.models.surveys import (
    Survey,
    SurveyAudienceUser,
    SurveyQuestion,
    SurveyResponse,
    SurveyStatus,
    survey_audience_groups,
)
from api.services.surveys.survey_api_schemas import (
    SurveyAdminOut,
    SurveyAudienceBody,
    SurveyQuestionIn,
    SurveyQuestionOut,
    SurveyRewardSpec,
)
from api.services.surveys.survey_audience_service import (
    audience_lists_empty,
    count_eligible_users,
    load_survey_audience_sets,
)
from api.services.surveys.survey_reward_service import normalize_reward_spec


def json_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return dict(value)
    return {}


def question_to_out(q: SurveyQuestion) -> SurveyQuestionOut:
    return SurveyQuestionOut(
        id=q.id,
        question_key=q.question_key,
        question_type=q.question_type,
        prompt=q.prompt,
        help_text=q.help_text,
        required=bool(q.required),
        sort_order=int(q.sort_order or 0),
        options_json=json_dict(q.options_json),
        validation_json=json_dict(q.validation_json),
    )


async def load_survey(db: AsyncSession, survey_id: UUID) -> Survey | None:
    return (
        await db.execute(select(Survey).where(Survey.id == survey_id).options(selectinload(Survey.questions)))
    ).scalar_one_or_none()


async def serialize_admin(
    db: AsyncSession,
    survey: Survey,
    *,
    include_questions: bool = True,
) -> SurveyAdminOut:
    group_ids, user_ids = await load_survey_audience_sets(db, survey.id)
    completed = (
        await db.execute(select(func.count()).select_from(SurveyResponse).where(SurveyResponse.survey_id == survey.id))
    ).scalar_one()
    eligible = await count_eligible_users(db, survey) if survey.status == SurveyStatus.PUBLISHED.value else None
    questions = sorted(survey.questions or [], key=lambda q: (q.sort_order, q.question_key))
    return SurveyAdminOut(
        id=survey.id,
        title=survey.title,
        description_user=survey.description_user or "",
        description_admin=survey.description_admin,
        status=str(survey.status),
        audience_mode=str(survey.audience_mode),
        reward=SurveyRewardSpec(**normalize_reward_spec(survey.reward_json)),
        gaf_notify_body_template=survey.gaf_notify_body_template,
        closes_at=survey.closes_at,
        published_at=survey.published_at,
        sort_order=int(survey.sort_order or 0),
        created_at=survey.created_at,
        updated_at=survey.updated_at,
        access_group_ids=sorted(group_ids),
        user_ids=sorted(user_ids),
        questions=[question_to_out(q) for q in questions] if include_questions else [],
        question_count=len(questions),
        eligible_count=eligible,
        completed_count=int(completed or 0),
    )


async def get_db_user(db: AsyncSession, user_id: UUID) -> DBUser:
    user = (await db.execute(select(DBUser).where(DBUser.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


async def replace_audience(
    db: AsyncSession,
    survey: Survey,
    body: SurveyAudienceBody,
) -> None:
    if audience_lists_empty(set(body.access_group_ids), set(body.user_ids)):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one access group or user must be assigned",
        )
    survey.audience_mode = body.audience_mode  # type: ignore[assignment]
    await db.execute(delete(survey_audience_groups).where(survey_audience_groups.c.survey_id == survey.id))
    await db.execute(delete(SurveyAudienceUser).where(SurveyAudienceUser.survey_id == survey.id))
    for gid in body.access_group_ids:
        await db.execute(insert(survey_audience_groups).values(survey_id=survey.id, app_access_group_id=gid))
    for uid in body.user_ids:
        db.add(SurveyAudienceUser(survey_id=survey.id, user_id=uid))
    survey.updated_at = datetime.now(UTC).replace(tzinfo=None)  # type: ignore[assignment]


async def replace_questions(db: AsyncSession, survey: Survey, questions: list[SurveyQuestionIn]) -> None:
    await db.execute(delete(SurveyQuestion).where(SurveyQuestion.survey_id == survey.id))
    for q in questions:
        db.add(
            SurveyQuestion(
                survey_id=survey.id,
                question_key=q.question_key,
                question_type=q.question_type,
                prompt=q.prompt,
                help_text=q.help_text,
                required=q.required,
                sort_order=q.sort_order,
                options_json=q.options_json,
                validation_json=q.validation_json,
            )
        )
    survey.updated_at = datetime.now(UTC).replace(tzinfo=None)  # type: ignore[assignment]


def survey_closed(survey: Survey) -> bool:
    closes = cast(datetime | None, survey.closes_at)
    if closes is None:
        return False
    now = datetime.now(UTC).replace(tzinfo=None)
    closes_naive = closes.replace(tzinfo=None) if closes.tzinfo is not None else closes
    return now > closes_naive
