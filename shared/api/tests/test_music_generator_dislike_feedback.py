"""Unit tests: дизлайк генератора песен — валидация и снимок рецепта."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from api.schemas.unified_content import Content, ContentType
from api.services.music_generator_dislike_feedback import (
    build_dislike_recipe_snapshot,
    content_eligible_for_dislike_feedback,
    validate_dislike_reason,
)


def _audio_mg(
    *,
    sub_type: str | None = "music_generator",
    tags: list[str] | None = None,
) -> Content:
    now = datetime.now(UTC)
    return Content(
        id=uuid4(),
        user_id="u-1",
        name="T",
        content_type=ContentType.AUDIO,
        sub_type=sub_type,
        tags=tags or [],
        metadata={"music_generator_style": "trap", "music_generator_bpm": 140},
        created_at=now,
        updated_at=now,
    )


def test_eligible_mg() -> None:
    assert content_eligible_for_dislike_feedback(_audio_mg()) is True


def test_eligible_by_tag() -> None:
    assert content_eligible_for_dislike_feedback(_audio_mg(sub_type="x", tags=["music_generator"])) is True


def test_not_eligible() -> None:
    assert content_eligible_for_dislike_feedback(_audio_mg(sub_type="x", tags=[])) is False


def test_validate_reason_other_requires_text() -> None:
    with pytest.raises(ValueError, match="reason_custom"):
        validate_dislike_reason(code="other", custom="  ")


def test_validate_reason_other_ok() -> None:
    t = validate_dislike_reason(code="other", custom="  плохой вокал  ")
    assert t == "плохой вокал"


def test_validate_non_other_strips_empty_custom() -> None:
    assert validate_dislike_reason(code="vocal", custom="  ") is None


def test_snapshot_shape() -> None:
    c = _audio_mg()
    s = build_dislike_recipe_snapshot(user_id="u-1", content=c)
    assert s["content_id"] == str(c.id)
    assert s["user_id"] == "u-1"
    assert s["metadata"]["music_generator_style"] == "trap"
    assert "captured_at" in s
