# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Resolve survey audience eligibility (access groups + user allowlist).
# Invariants:
# - Publish blocked when both group and user lists empty.
# Related:
# - api/models/surveys.py
# ---

from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.database_models import User
from api.models.surveys import Survey, SurveyAudienceMode, SurveyAudienceUser, survey_audience_groups

# Keep in sync with api/routers/desktop.py DEFAULT_ACCESS_GROUP_ID (seed migration).
DEFAULT_ACCESS_GROUP_ID = UUID("a0000000-0000-4000-8000-000000000001")


def audience_lists_empty(group_ids: set[UUID], allowlist: set[UUID]) -> bool:
    return len(group_ids) == 0 and len(allowlist) == 0


def is_user_eligible(
    *,
    audience_mode: str,
    user_id: UUID,
    user_group_id: UUID | None,
    group_ids: set[UUID],
    allowlist: set[UUID],
) -> bool:
    gid = user_group_id or DEFAULT_ACCESS_GROUP_ID
    in_groups = gid in group_ids if group_ids else False
    in_list = user_id in allowlist if allowlist else False
    mode = audience_mode or SurveyAudienceMode.GROUPS_OR_USERS.value
    if mode == SurveyAudienceMode.GROUPS_ONLY.value:
        return in_groups
    if mode == SurveyAudienceMode.USERS_ONLY.value:
        return in_list
    if mode == SurveyAudienceMode.GROUPS_AND_USERS.value:
        return in_groups and in_list
    return in_groups or in_list


async def load_survey_audience_sets(db: AsyncSession, survey_id: UUID) -> tuple[set[UUID], set[UUID]]:
    group_rows = (
        (
            await db.execute(
                select(survey_audience_groups.c.app_access_group_id).where(
                    survey_audience_groups.c.survey_id == survey_id
                )
            )
        )
        .scalars()
        .all()
    )
    user_rows = (
        (await db.execute(select(SurveyAudienceUser.user_id).where(SurveyAudienceUser.survey_id == survey_id)))
        .scalars()
        .all()
    )
    return set(group_rows), set(user_rows)


def _eligible_users_stmt(
    *,
    audience_mode: str,
    group_ids: set[UUID],
    allowlist: set[UUID],
):
    base = select(User.id).where(User.is_system_account.is_not(True))
    mode = audience_mode or SurveyAudienceMode.GROUPS_OR_USERS.value
    group_expr = func.coalesce(User.app_access_group_id, DEFAULT_ACCESS_GROUP_ID).in_(group_ids)
    user_expr = User.id.in_(allowlist)
    if mode == SurveyAudienceMode.GROUPS_ONLY.value:
        return base.where(group_expr)
    if mode == SurveyAudienceMode.USERS_ONLY.value:
        return base.where(user_expr)
    if mode == SurveyAudienceMode.GROUPS_AND_USERS.value:
        return base.where(group_expr, user_expr)
    return base.where(or_(group_expr, user_expr))


async def is_user_eligible_for_survey(
    db: AsyncSession,
    survey: Survey,
    user: User,
) -> bool:
    if str(survey.status) != "published":
        return False
    group_ids, allowlist = await load_survey_audience_sets(db, survey.id)
    if audience_lists_empty(group_ids, allowlist):
        return False
    return is_user_eligible(
        audience_mode=str(survey.audience_mode),
        user_id=user.id,
        user_group_id=getattr(user, "app_access_group_id", None),
        group_ids=group_ids,
        allowlist=allowlist,
    )


async def count_eligible_users(db: AsyncSession, survey: Survey) -> int:
    group_ids, allowlist = await load_survey_audience_sets(db, survey.id)
    if audience_lists_empty(group_ids, allowlist):
        return 0
    stmt = _eligible_users_stmt(
        audience_mode=str(survey.audience_mode),
        group_ids=group_ids,
        allowlist=allowlist,
    )
    count_stmt = select(func.count()).select_from(stmt.subquery())
    row = (await db.execute(count_stmt)).scalar_one()
    return int(row or 0)


async def iter_eligible_user_ids(db: AsyncSession, survey: Survey):
    group_ids, allowlist = await load_survey_audience_sets(db, survey.id)
    if audience_lists_empty(group_ids, allowlist):
        return
    stmt = _eligible_users_stmt(
        audience_mode=str(survey.audience_mode),
        group_ids=group_ids,
        allowlist=allowlist,
    )
    result = await db.stream(stmt)
    async for row in result:
        yield row[0]
