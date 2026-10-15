# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Survey Hub user-facing product-desktop routes.
# Related:
# - documentation/product/SURVEY-HUB.md
# ---

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.core.database_manager import get_asyncpg_pool, get_postgres_session
from api.models.surveys import Survey, SurveyResponse, SurveyStatus
from api.routers.desktop import get_desktop_user_id
from api.services.surveys.survey_api_schemas import (
    SurveyResponseUserOut,
    SurveyRewardSpec,
    SurveySubmitBody,
    SurveySubmitOut,
    SurveySummaryOut,
    SurveyUserDetailOut,
    SurveyUserListItem,
    SurveyUserListOut,
    sort_completed_survey_items,
)
from api.services.surveys.survey_audience_service import is_user_eligible_for_survey
from api.services.surveys.survey_reward_service import grant_completion_rewards, normalize_reward_spec
from api.services.surveys.survey_router_helpers import (
    get_db_user,
    json_dict,
    load_survey,
    question_to_out,
    survey_closed,
)
from api.services.surveys.survey_validation import SurveyValidationError, validate_answers_for_questions

surveys_user_router = APIRouter(tags=["product-desktop"])


@surveys_user_router.get("/surveys/summary", response_model=SurveySummaryOut)
async def get_survey_summary(
    user_id: UUID = Depends(get_desktop_user_id),
    db: AsyncSession = Depends(get_postgres_session),
) -> SurveySummaryOut:
    user = await get_db_user(db, user_id)
    published = (await db.execute(select(Survey).where(Survey.status == SurveyStatus.PUBLISHED.value))).scalars().all()
    available = 0
    completed = 0
    total_ugs = 0.0
    total_ew = 0
    total_coins = 0
    for survey in published:
        if survey_closed(survey):
            continue
        if not await is_user_eligible_for_survey(db, survey, user):
            continue
        resp = (
            await db.execute(
                select(SurveyResponse).where(
                    SurveyResponse.survey_id == survey.id,
                    SurveyResponse.user_id == user_id,
                )
            )
        ).scalar_one_or_none()
        if resp:
            completed += 1
            granted = normalize_reward_spec(resp.reward_granted_json)
            total_ugs += granted["ugs_credits"]
            total_ew += granted["ew_balance"]
            total_coins += granted["web_search_coins"]
        else:
            available += 1
    return SurveySummaryOut(
        available_count=available,
        completed_count=completed,
        total_reward_ugs=total_ugs,
        total_reward_ew=total_ew,
        total_reward_coins=total_coins,
    )


@surveys_user_router.get("/surveys", response_model=SurveyUserListOut)
async def list_user_surveys(
    filter: str = Query(default="all", pattern="^(all|available|completed)$"),
    user_id: UUID = Depends(get_desktop_user_id),
    db: AsyncSession = Depends(get_postgres_session),
) -> SurveyUserListOut:
    user = await get_db_user(db, user_id)
    published = (
        (
            await db.execute(
                select(Survey)
                .where(Survey.status == SurveyStatus.PUBLISHED.value)
                .options(selectinload(Survey.questions))
                .order_by(Survey.sort_order, Survey.published_at.desc())
            )
        )
        .scalars()
        .all()
    )
    items: list[SurveyUserListItem] = []
    for survey in published:
        if survey_closed(survey) and filter == "available":
            continue
        eligible = await is_user_eligible_for_survey(db, survey, user)
        if not eligible:
            continue
        resp = (
            await db.execute(
                select(SurveyResponse).where(
                    SurveyResponse.survey_id == survey.id,
                    SurveyResponse.user_id == user_id,
                )
            )
        ).scalar_one_or_none()
        is_completed = resp is not None
        if filter == "available" and is_completed:
            continue
        if filter == "completed" and not is_completed:
            continue
        items.append(
            SurveyUserListItem(
                id=survey.id,
                title=survey.title,
                description_user=survey.description_user or "",
                status=str(survey.status),
                reward=SurveyRewardSpec(**normalize_reward_spec(survey.reward_json)),
                closes_at=survey.closes_at,
                published_at=survey.published_at,
                question_count=len(survey.questions or []),
                completed=is_completed,
                completed_at=resp.submitted_at if resp else None,
                reward_granted=SurveyRewardSpec(**normalize_reward_spec(resp.reward_granted_json))
                if resp and resp.reward_granted_json
                else None,
            )
        )
    if filter == "completed":
        items = sort_completed_survey_items(items)
    return SurveyUserListOut(items=items, total=len(items))


@surveys_user_router.get("/surveys/{survey_id}", response_model=SurveyUserDetailOut)
async def get_user_survey(
    survey_id: UUID,
    user_id: UUID = Depends(get_desktop_user_id),
    db: AsyncSession = Depends(get_postgres_session),
) -> SurveyUserDetailOut:
    survey = await load_survey(db, survey_id)
    if survey is None or survey.status != SurveyStatus.PUBLISHED.value:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    user = await get_db_user(db, user_id)
    if not await is_user_eligible_for_survey(db, survey, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Survey not available")
    resp = (
        await db.execute(
            select(SurveyResponse).where(
                SurveyResponse.survey_id == survey_id,
                SurveyResponse.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    questions = sorted(survey.questions or [], key=lambda q: (q.sort_order, q.question_key))
    return SurveyUserDetailOut(
        id=survey.id,
        title=survey.title,
        description_user=survey.description_user or "",
        reward=SurveyRewardSpec(**normalize_reward_spec(survey.reward_json)),
        closes_at=survey.closes_at,
        questions=[question_to_out(q) for q in questions],
        completed=resp is not None,
        completed_at=resp.submitted_at if resp else None,
    )


@surveys_user_router.post("/surveys/{survey_id}/responses", response_model=SurveySubmitOut, status_code=201)
async def submit_survey_response(
    survey_id: UUID,
    body: SurveySubmitBody,
    user_id: UUID = Depends(get_desktop_user_id),
    db: AsyncSession = Depends(get_postgres_session),
) -> SurveySubmitOut:
    survey = await load_survey(db, survey_id)
    if survey is None or survey.status != SurveyStatus.PUBLISHED.value:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    if survey_closed(survey):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Survey closed")
    user = await get_db_user(db, user_id)
    if not await is_user_eligible_for_survey(db, survey, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Survey not available")
    existing = (
        await db.execute(
            select(SurveyResponse).where(
                SurveyResponse.survey_id == survey_id,
                SurveyResponse.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Survey already completed")

    q_rows = [
        {
            "question_key": q.question_key,
            "question_type": q.question_type,
            "required": q.required,
            "options_json": q.options_json or {},
            "validation_json": q.validation_json or {},
        }
        for q in sorted(survey.questions or [], key=lambda x: (x.sort_order, x.question_key))
    ]
    try:
        normalized = validate_answers_for_questions(q_rows, body.answers)
    except SurveyValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    response = SurveyResponse(
        survey_id=survey_id,
        user_id=user_id,
        answers_json=normalized,
        client_meta=body.client_meta,
    )
    db.add(response)
    await db.flush()

    pool = await get_asyncpg_pool()
    granted = await grant_completion_rewards(
        db,
        user_id=user_id,
        survey_id=survey_id,
        response=response,
        reward_spec=survey.reward_json,
        survey_title=survey.title,
        db_pool=pool,
    )
    return SurveySubmitOut(
        response_id=response.id,
        submitted_at=response.submitted_at,
        reward_granted=SurveyRewardSpec(**granted),
    )


@surveys_user_router.get("/surveys/{survey_id}/responses/me", response_model=SurveyResponseUserOut)
async def get_my_survey_response(
    survey_id: UUID,
    user_id: UUID = Depends(get_desktop_user_id),
    db: AsyncSession = Depends(get_postgres_session),
) -> SurveyResponseUserOut:
    resp = (
        await db.execute(
            select(SurveyResponse).where(
                SurveyResponse.survey_id == survey_id,
                SurveyResponse.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if resp is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Response not found")
    return SurveyResponseUserOut(
        survey_id=survey_id,
        answers=json_dict(resp.answers_json),
        submitted_at=resp.submitted_at,
        reward_granted=SurveyRewardSpec(**normalize_reward_spec(resp.reward_granted_json))
        if resp.reward_granted_json
        else None,
    )
