"""Unit tests: eligibility and payload for music_generator record-like-recipe helpers."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from api.schemas.unified_content import Content, ContentType
from api.services.music_generator_liked_recipe import (
    build_liked_recipe_payload,
    content_eligible_for_liked_recipe,
)


def _minimal_audio_content(
    *,
    sub_type: str | None = None,
    tags: list[str] | None = None,
    metadata: dict | None = None,
) -> Content:
    now = datetime.now(UTC)
    return Content(
        id=uuid4(),
        user_id="user-1",
        name="Test track",
        content_type=ContentType.AUDIO,
        sub_type=sub_type,
        tags=tags or [],
        metadata=metadata or {"music_generator_bpm": 120},
        created_at=now,
        updated_at=now,
    )


def test_eligible_when_sub_type_music_generator() -> None:
    c = _minimal_audio_content(sub_type="music_generator")
    assert content_eligible_for_liked_recipe(c) is True


def test_eligible_when_tag_music_generator() -> None:
    c = _minimal_audio_content(tags=["Music_Generator", "foo"])
    assert content_eligible_for_liked_recipe(c) is True


def test_not_eligible_for_non_audio() -> None:
    now = datetime.now(UTC)
    c = Content(
        id=uuid4(),
        user_id="user-1",
        name="Doc",
        content_type=ContentType.DOCUMENT,
        sub_type="music_generator",
        created_at=now,
        updated_at=now,
    )
    assert content_eligible_for_liked_recipe(c) is False


def test_not_eligible_audio_without_marker() -> None:
    c = _minimal_audio_content(sub_type="other")
    assert content_eligible_for_liked_recipe(c) is False


def test_build_payload_includes_metadata_snapshot() -> None:
    cid = uuid4()
    now = datetime.now(UTC)
    c = Content(
        id=cid,
        user_id="owner-2",
        name="My song",
        content_type=ContentType.AUDIO,
        sub_type="music_generator",
        source_service="music_generator",
        metadata={"music_generator_bpm": 100, "music_generator_style": "pop"},
        created_at=now,
        updated_at=now,
    )
    payload = build_liked_recipe_payload(user_id="owner-2", content=c)
    assert payload["content_id"] == str(cid)
    assert payload["user_id"] == "owner-2"
    assert payload["name"] == "My song"
    assert payload["sub_type"] == "music_generator"
    assert payload["source_service"] == "music_generator"
    assert payload["metadata"]["music_generator_bpm"] == 100
    assert "liked_at" in payload
