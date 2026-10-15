#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Celery task: notify eligible users about a published survey via GAF system account.
# Invariants:
# - survey_gaf_deliveries prevents duplicate notifications per user/survey.
# Related:
# - api/routers/product_desktop_surveys.py (publish)
# ---

from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from api.core.celery_async import run_celery_async
from api.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)

_SEND_INTERVAL_SEC = 0.05
SURVEY_ANNOUNCEMENT_KIND = "survey_announcement"


async def _run_survey_gaf_notify(survey_id: str) -> dict[str, int]:
    from sqlalchemy import select

    from api.core.database_manager import get_asyncpg_pool, get_database_manager
    from api.gaf_chat.service import GafChatService
    from api.models.surveys import Survey, SurveyGafDelivery
    from api.services.surveys.survey_audience_service import iter_eligible_user_ids

    sid = UUID(survey_id)
    manager = await get_database_manager()
    pool = await get_asyncpg_pool()
    sent = 0
    failed = 0
    skipped = 0

    async with manager.get_postgres_session() as db:
        survey = (await db.execute(select(Survey).where(Survey.id == sid))).scalar_one_or_none()
        if survey is None or str(survey.status) != "published":
            return {"sent": 0, "failed": 0, "skipped": 1}

        template = (survey.gaf_notify_body_template or "").strip()
        default_body = (
            f"Доступен новый опрос «{survey.title}». Откройте приложение «Опросы» на рабочем столе, чтобы пройти его."
        )
        body = template if template else default_body
        metadata = {
            "kind": SURVEY_ANNOUNCEMENT_KIND,
            "survey_id": str(survey.id),
            "title": survey.title,
            "open_app_component": "SurveyHubApp",
            "deep_link": {"surveyId": str(survey.id)},
        }

        gaf = GafChatService(pool)
        async for uid in iter_eligible_user_ids(db, survey):
            existing = (
                await db.execute(
                    select(SurveyGafDelivery).where(
                        SurveyGafDelivery.survey_id == sid,
                        SurveyGafDelivery.user_id == uid,
                    )
                )
            ).scalar_one_or_none()
            if existing is not None:
                skipped += 1
                continue
            try:
                msg = await gaf.send_service_message_to_user(str(uid), body, metadata=metadata)
                msg_id = msg.get("id") if msg else None
                db.add(
                    SurveyGafDelivery(
                        survey_id=sid,
                        user_id=uid,
                        message_id=UUID(msg_id) if msg_id else None,
                    )
                )
                await db.commit()
                sent += 1
            except Exception as exc:  # noqa: BLE001
                await db.rollback()
                failed += 1
                logger.warning(
                    "[SURVEY_GAF] send failed survey=%s user=%s err=%s",
                    survey_id,
                    uid,
                    exc,
                )
            await asyncio.sleep(_SEND_INTERVAL_SEC)

    logger.info("[SURVEY_GAF] done survey=%s sent=%s failed=%s skipped=%s", survey_id, sent, failed, skipped)
    return {"sent": sent, "failed": failed, "skipped": skipped}


async def _run_survey_gaf_remind_incomplete(survey_id: str) -> dict[str, int]:
    from sqlalchemy import select

    from api.core.database_manager import get_asyncpg_pool, get_database_manager
    from api.gaf_chat.service import GafChatService
    from api.models.surveys import Survey, SurveyResponse
    from api.services.surveys.survey_audience_service import iter_eligible_user_ids

    sid = UUID(survey_id)
    manager = await get_database_manager()
    pool = await get_asyncpg_pool()
    sent = 0
    failed = 0
    skipped = 0

    async with manager.get_postgres_session() as db:
        survey = (await db.execute(select(Survey).where(Survey.id == sid))).scalar_one_or_none()
        if survey is None or str(survey.status) != "published":
            return {"sent": 0, "failed": 0, "skipped": 1}

        template = (survey.gaf_notify_body_template or "").strip()
        default_body = (
            f"Напоминание: опрос «{survey.title}» ещё доступен. Откройте приложение «Опросы» на рабочем столе."
        )
        body = template if template else default_body
        metadata = {
            "kind": SURVEY_ANNOUNCEMENT_KIND,
            "survey_id": str(survey.id),
            "title": survey.title,
            "open_app_component": "SurveyHubApp",
            "deep_link": {"surveyId": str(survey.id)},
        }

        gaf = GafChatService(pool)
        async for uid in iter_eligible_user_ids(db, survey):
            completed = (
                await db.execute(
                    select(SurveyResponse.id).where(
                        SurveyResponse.survey_id == sid,
                        SurveyResponse.user_id == uid,
                    )
                )
            ).scalar_one_or_none()
            if completed is not None:
                skipped += 1
                continue
            try:
                await gaf.send_service_message_to_user(str(uid), body, metadata=metadata)
                sent += 1
            except Exception as exc:  # noqa: BLE001
                failed += 1
                logger.warning(
                    "[SURVEY_GAF] remind failed survey=%s user=%s err=%s",
                    survey_id,
                    uid,
                    exc,
                )
            await asyncio.sleep(_SEND_INTERVAL_SEC)

    logger.info(
        "[SURVEY_GAF] remind done survey=%s sent=%s failed=%s skipped=%s",
        survey_id,
        sent,
        failed,
        skipped,
    )
    return {"sent": sent, "failed": failed, "skipped": skipped}


@celery_app.task(name="survey_gaf_notify_for_survey")
def survey_gaf_notify_for_survey(survey_id: str) -> dict[str, int]:
    return run_celery_async(_run_survey_gaf_notify(survey_id=survey_id))


@celery_app.task(name="survey_gaf_remind_incomplete_for_survey")
def survey_gaf_remind_incomplete_for_survey(survey_id: str) -> dict[str, int]:
    return run_celery_async(_run_survey_gaf_remind_incomplete(survey_id=survey_id))


def schedule_survey_gaf_notify(survey_id: str) -> None:
    survey_gaf_notify_for_survey.delay(survey_id)


def schedule_survey_gaf_remind_incomplete(survey_id: str) -> None:
    survey_gaf_remind_incomplete_for_survey.delay(survey_id)
