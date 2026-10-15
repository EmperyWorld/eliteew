# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
#   Unit tests for survey audience eligibility resolution (pure logic).
# Related:
#   - api/services/surveys/survey_audience_service.py
# ---

from __future__ import annotations

from uuid import UUID

from api.models.surveys import SurveyAudienceMode
from api.services.surveys.survey_audience_service import (
    audience_lists_empty,
    is_user_eligible,
)

GROUP_A = UUID("11111111-1111-1111-1111-111111111111")
USER_1 = UUID("22222222-2222-2222-2222-222222222222")
USER_2 = UUID("33333333-3333-3333-3333-333333333333")


def test_audience_lists_empty() -> None:
    assert audience_lists_empty(set(), set()) is True
    assert audience_lists_empty({GROUP_A}, set()) is False
    assert audience_lists_empty(set(), {USER_1}) is False


def test_groups_only_mode() -> None:
    assert (
        is_user_eligible(
            audience_mode=SurveyAudienceMode.GROUPS_ONLY.value,
            user_id=USER_1,
            user_group_id=GROUP_A,
            group_ids={GROUP_A},
            allowlist=set(),
        )
        is True
    )
    assert (
        is_user_eligible(
            audience_mode=SurveyAudienceMode.GROUPS_ONLY.value,
            user_id=USER_1,
            user_group_id=GROUP_A,
            group_ids={UUID("99999999-9999-9999-9999-999999999999")},
            allowlist={USER_1},
        )
        is False
    )


def test_users_only_mode() -> None:
    assert (
        is_user_eligible(
            audience_mode=SurveyAudienceMode.USERS_ONLY.value,
            user_id=USER_1,
            user_group_id=GROUP_A,
            group_ids={GROUP_A},
            allowlist={USER_2},
        )
        is False
    )
    assert (
        is_user_eligible(
            audience_mode=SurveyAudienceMode.USERS_ONLY.value,
            user_id=USER_1,
            user_group_id=GROUP_A,
            group_ids=set(),
            allowlist={USER_1},
        )
        is True
    )


def test_groups_or_users_mode() -> None:
    assert (
        is_user_eligible(
            audience_mode=SurveyAudienceMode.GROUPS_OR_USERS.value,
            user_id=USER_2,
            user_group_id=GROUP_A,
            group_ids={GROUP_A},
            allowlist=set(),
        )
        is True
    )
    assert (
        is_user_eligible(
            audience_mode=SurveyAudienceMode.GROUPS_OR_USERS.value,
            user_id=USER_2,
            user_group_id=None,
            group_ids=set(),
            allowlist={USER_2},
        )
        is True
    )


def test_groups_and_users_mode_requires_both() -> None:
    assert (
        is_user_eligible(
            audience_mode=SurveyAudienceMode.GROUPS_AND_USERS.value,
            user_id=USER_1,
            user_group_id=GROUP_A,
            group_ids={GROUP_A},
            allowlist={USER_1},
        )
        is True
    )
    assert (
        is_user_eligible(
            audience_mode=SurveyAudienceMode.GROUPS_AND_USERS.value,
            user_id=USER_1,
            user_group_id=GROUP_A,
            group_ids={GROUP_A},
            allowlist={USER_2},
        )
        is False
    )
