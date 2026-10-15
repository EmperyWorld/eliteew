# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Survey Hub admin CRUD/publish/results routes.
# Related:
# - documentation/product/SURVEY-HUB.md
# ---

from __future__ import annotations

import logging
from datetime import UTC, date, datetime
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.core.auth import User as AuthUser
from api.core.database_manager import get_postgres_session
from api.models.surveys import Survey, SurveyStatus
from api.routers.admin_auth import require_admin_user
from api.services.surveys.survey_ai_draft_service import generate_survey_ai_draft, normalize_survey_ai_draft
from api.services.surveys.survey_analytics_service import build_results_summary, list_response_rows
from api.services.surveys.survey_api_schemas import (
    AudiencePreviewOut,
    SurveyAdminOut,
    SurveyAiDraftOut,
    SurveyAiDraftRequest,
    SurveyAudienceBody,
    SurveyCreateBody,
    SurveyGafNotifyQueuedOut,
    SurveyListAdminOut,
    SurveyPatchBody,
    SurveyQuestionIn,
    SurveyResponseAdminListOut,
    SurveyResponseAdminOut,
    SurveyResultsSummaryOut,
    published_survey_patch_allowed,
)
from api.services.surveys.survey_audience_service import (
    audience_lists_empty,
    count_eligible_users,
    load_survey_audience_sets,
)
from api.services.surveys.survey_router_helpers import (
    json_dict,
    load_survey,
    replace_audience,
    replace_questions,
    serialize_admin,
)

logger = logging.getLogger(__name__)

surveys_admin_router = APIRouter(tags=["product-desktop"])


@surveys_admin_router.get("/admin/surveys", response_model=SurveyListAdminOut)
async def admin_list_surveys(
    status_filter: str | None = Query(default=None, alias="status"),
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> SurveyListAdminOut:
    stmt = select(Survey).order_by(Survey.sort_order, Survey.updated_at.desc())
    if status_filter:
        stmt = stmt.where(Survey.status == status_filter)
    rows = (await db.execute(stmt.options(selectinload(Survey.questions)))).scalars().all()
    items = [await serialize_admin(db, s, include_questions=False) for s in rows]
    return SurveyListAdminOut(items=items, total=len(items))


@surveys_admin_router.post("/admin/surveys/ai/draft", response_model=SurveyAiDraftOut)
async def admin_survey_ai_draft(
    body: SurveyAiDraftRequest,
    _admin: AuthUser = Depends(require_admin_user),
) -> SurveyAiDraftOut:
    draft_payload: dict[str, Any] | None = None
    if body.draft is not None:
        draft_payload = normalize_survey_ai_draft(body.draft.model_dump())
    try:
        result = await generate_survey_ai_draft(
            brief=body.brief,
            mode=body.mode,
            draft=draft_payload,
            supplement=body.supplement,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return SurveyAiDraftOut(**result)


@surveys_admin_router.post("/admin/surveys", response_model=SurveyAdminOut, status_code=201)
async def admin_create_survey(
    body: SurveyCreateBody,
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> SurveyAdminOut:
    survey = Survey(
        title=body.title.strip(),
        description_user=body.description_user.strip(),
        description_admin=body.description_admin.strip() if body.description_admin else None,
        audience_mode=body.audience_mode,
        reward_json=body.reward.model_dump(),
        gaf_notify_body_template=body.gaf_notify_body_template,
        closes_at=body.closes_at,
        sort_order=body.sort_order,
        status=SurveyStatus.DRAFT.value,
    )
    db.add(survey)
    await db.commit()
    await db.refresh(survey)
    loaded = await load_survey(db, survey.id)
    assert loaded is not None
    return await serialize_admin(db, loaded)


@surveys_admin_router.get("/admin/surveys/{survey_id}", response_model=SurveyAdminOut)
async def admin_get_survey(
    survey_id: UUID,
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> SurveyAdminOut:
    survey = await load_survey(db, survey_id)
    if survey is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    return await serialize_admin(db, survey)


@surveys_admin_router.patch("/admin/surveys/{survey_id}", response_model=SurveyAdminOut)
async def admin_patch_survey(
    survey_id: UUID,
    body: SurveyPatchBody,
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> SurveyAdminOut:
    survey = await load_survey(db, survey_id)
    if survey is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    if survey.status == SurveyStatus.PUBLISHED.value:
        if not published_survey_patch_allowed(body):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Published surveys only allow closes_at updates",
            )
        if "closes_at" in body.model_fields_set:
            survey.closes_at = body.closes_at  # type: ignore[assignment]
        survey.updated_at = datetime.now(UTC).replace(tzinfo=None)  # type: ignore[assignment]
        await db.commit()
        loaded = await load_survey(db, survey_id)
        assert loaded is not None
        return await serialize_admin(db, loaded)
    if survey.status != SurveyStatus.DRAFT.value:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Archived surveys cannot be edited")
    if body.title is not None:
        survey.title = body.title.strip()  # type: ignore[assignment]
    if body.description_user is not None:
        survey.description_user = body.description_user.strip()  # type: ignore[assignment]
    if body.description_admin is not None:
        survey.description_admin = body.description_admin.strip() or None  # type: ignore[assignment]
    if body.audience_mode is not None:
        survey.audience_mode = body.audience_mode  # type: ignore[assignment]
    if body.reward is not None:
        survey.reward_json = body.reward.model_dump()  # type: ignore[assignment]
    if body.gaf_notify_body_template is not None:
        survey.gaf_notify_body_template = body.gaf_notify_body_template.strip() or None  # type: ignore[assignment]
    if "closes_at" in body.model_fields_set:
        survey.closes_at = body.closes_at  # type: ignore[assignment]
    if body.sort_order is not None:
        survey.sort_order = body.sort_order  # type: ignore[assignment]
    survey.updated_at = datetime.now(UTC).replace(tzinfo=None)  # type: ignore[assignment]
    await db.commit()
    loaded = await load_survey(db, survey_id)
    assert loaded is not None
    return await serialize_admin(db, loaded)


@surveys_admin_router.put("/admin/surveys/{survey_id}/questions", response_model=SurveyAdminOut)
async def admin_replace_questions(
    survey_id: UUID,
    questions: list[SurveyQuestionIn],
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> SurveyAdminOut:
    survey = await load_survey(db, survey_id)
    if survey is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    if survey.status != SurveyStatus.DRAFT.value:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only draft surveys can be edited")
    await replace_questions(db, survey, questions)
    await db.commit()
    loaded = await load_survey(db, survey_id)
    assert loaded is not None
    return await serialize_admin(db, loaded)


@surveys_admin_router.put("/admin/surveys/{survey_id}/audience", response_model=SurveyAdminOut)
async def admin_replace_audience(
    survey_id: UUID,
    body: SurveyAudienceBody,
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> SurveyAdminOut:
    survey = await load_survey(db, survey_id)
    if survey is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    if survey.status != SurveyStatus.DRAFT.value:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only draft surveys can be edited")
    await replace_audience(db, survey, body)
    await db.commit()
    loaded = await load_survey(db, survey_id)
    assert loaded is not None
    return await serialize_admin(db, loaded)


@surveys_admin_router.post("/admin/surveys/{survey_id}/preview-audience", response_model=AudiencePreviewOut)
async def admin_preview_audience(
    survey_id: UUID,
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> AudiencePreviewOut:
    survey = await load_survey(db, survey_id)
    if survey is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    group_ids, user_ids = await load_survey_audience_sets(db, survey_id)
    if audience_lists_empty(group_ids, user_ids):
        return AudiencePreviewOut(eligible_count=0)
    return AudiencePreviewOut(eligible_count=await count_eligible_users(db, survey))


@surveys_admin_router.post("/admin/surveys/{survey_id}/publish", response_model=SurveyAdminOut)
async def admin_publish_survey(
    survey_id: UUID,
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> SurveyAdminOut:
    survey = await load_survey(db, survey_id)
    if survey is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    if survey.status != SurveyStatus.DRAFT.value:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Survey is not a draft")
    if not survey.questions:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Survey has no questions")
    group_ids, user_ids = await load_survey_audience_sets(db, survey_id)
    if audience_lists_empty(group_ids, user_ids):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Assign at least one access group or user before publish",
        )
    survey.status = SurveyStatus.PUBLISHED.value  # type: ignore[assignment]
    survey.published_at = datetime.now(UTC).replace(tzinfo=None)  # type: ignore[assignment]
    survey.updated_at = survey.published_at  # type: ignore[assignment]
    await db.commit()

    try:
        from api.tasks.survey_gaf_notify import schedule_survey_gaf_notify

        schedule_survey_gaf_notify(str(survey_id))
    except Exception as exc:  # noqa: BLE001
        logger.warning("[SURVEY] gaf notify schedule failed survey=%s err=%s", survey_id, exc)

    loaded = await load_survey(db, survey_id)
    assert loaded is not None
    return await serialize_admin(db, loaded)


@surveys_admin_router.post("/admin/surveys/{survey_id}/archive", response_model=SurveyAdminOut)
async def admin_archive_survey(
    survey_id: UUID,
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> SurveyAdminOut:
    survey = await load_survey(db, survey_id)
    if survey is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    survey.status = SurveyStatus.ARCHIVED.value  # type: ignore[assignment]
    survey.updated_at = datetime.now(UTC).replace(tzinfo=None)  # type: ignore[assignment]
    await db.commit()
    loaded = await load_survey(db, survey_id)
    assert loaded is not None
    return await serialize_admin(db, loaded)


@surveys_admin_router.post(
    "/admin/surveys/{survey_id}/gaf-notify",
    response_model=SurveyGafNotifyQueuedOut,
)
async def admin_queue_survey_gaf_notify(
    survey_id: UUID,
    mode: str = Query(default="undelivered", pattern="^(undelivered|incomplete)$"),
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> SurveyGafNotifyQueuedOut:
    survey = await load_survey(db, survey_id)
    if survey is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    if survey.status != SurveyStatus.PUBLISHED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="GAF notify is only available for published surveys",
        )
    try:
        if mode == "undelivered":
            from api.tasks.survey_gaf_notify import schedule_survey_gaf_notify

            schedule_survey_gaf_notify(str(survey_id))
        else:
            from api.tasks.survey_gaf_notify import schedule_survey_gaf_remind_incomplete

            schedule_survey_gaf_remind_incomplete(str(survey_id))
    except Exception as exc:  # noqa: BLE001
        logger.warning("[SURVEY] gaf notify queue failed survey=%s mode=%s err=%s", survey_id, mode, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not queue GAF notification task",
        ) from exc
    return SurveyGafNotifyQueuedOut(queued=True, mode=mode)


@surveys_admin_router.get(
    "/admin/surveys/{survey_id}/results/summary",
    response_model=SurveyResultsSummaryOut,
)
async def admin_results_summary(
    survey_id: UUID,
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> SurveyResultsSummaryOut:
    survey = await load_survey(db, survey_id)
    if survey is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    return await build_results_summary(db, survey)


@surveys_admin_router.get("/admin/surveys/{survey_id}/results/responses", response_model=SurveyResponseAdminListOut)
async def admin_list_responses(
    survey_id: UUID,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    submitted_from: date | None = Query(default=None),
    submitted_to: date | None = Query(default=None),
    submitted_sort: Literal["asc", "desc"] = Query(default="desc"),
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> SurveyResponseAdminListOut:
    survey = await load_survey(db, survey_id)
    if survey is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    if submitted_from is not None and submitted_to is not None and submitted_from > submitted_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="submitted_from must be on or before submitted_to",
        )
    rows, total = await list_response_rows(
        db,
        survey_id,
        limit=limit,
        offset=offset,
        submitted_from=submitted_from,
        submitted_to=submitted_to,
        submitted_sort=submitted_sort,
    )
    return SurveyResponseAdminListOut(
        items=[
            SurveyResponseAdminOut(
                id=r.id,
                user_id=r.user_id,
                answers_json=json_dict(r.answers_json),
                reward_granted_json=json_dict(r.reward_granted_json) if r.reward_granted_json else None,
                submitted_at=r.submitted_at,
            )
            for r in rows
        ],
        total=total,
    )
