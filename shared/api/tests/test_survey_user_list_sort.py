# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
#   Completed survey list ordering by submitted_at (newest first).
# Related:
#   - api/services/surveys/survey_api_schemas.py
# ---

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from api.services.surveys.survey_api_schemas import (
    SurveyRewardSpec,
    SurveyUserListItem,
    sort_completed_survey_items,
)


def _item(*, title: str, completed_at: datetime | None) -> SurveyUserListItem:
    return SurveyUserListItem(
        id=uuid4(),
        title=title,
        description_user="",
        status="published",
        reward=SurveyRewardSpec(),
        closes_at=None,
        published_at=None,
        question_count=1,
        completed=True,
        completed_at=completed_at,
    )


def test_sort_completed_survey_items_newest_first() -> None:
    older = datetime(2026, 6, 1, 12, 0, 0, tzinfo=UTC)
    newer = datetime(2026, 7, 1, 12, 0, 0, tzinfo=UTC)
    items = [
        _item(title="old", completed_at=older),
        _item(title="new", completed_at=newer),
    ]
    sorted_items = sort_completed_survey_items(items)
    assert [i.title for i in sorted_items] == ["new", "old"]
