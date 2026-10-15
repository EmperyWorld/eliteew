"""Unit tests: profile privacy evaluation (no database)."""

from __future__ import annotations

from uuid import uuid4

import pytest

from api.services.profile_privacy import (
    field_visible_for_viewer,
    privacy_from_joined_row,
    redact_profile_fields,
    search_discoverability_predicate,
)


@pytest.mark.unit
def test_search_discoverability_predicate_embeds_viewer_placeholder() -> None:
    sql = search_discoverability_predicate("$3")
    assert "$3::uuid" in sql
    assert "upp.discoverability" in sql


@pytest.mark.unit
def test_field_visible_owner_always_sees() -> None:
    uid = uuid4()
    assert field_visible_for_viewer(
        field="avatar",
        visibility="none",
        circle_id=None,
        viewer_id=uid,
        subject_id=uid,
        is_friend=False,
        viewer_in_circle=False,
    )


@pytest.mark.unit
def test_field_visible_none_hides_from_others() -> None:
    owner = uuid4()
    viewer = uuid4()
    assert not field_visible_for_viewer(
        field="avatar",
        visibility="none",
        circle_id=None,
        viewer_id=viewer,
        subject_id=owner,
        is_friend=True,
        viewer_in_circle=True,
    )


@pytest.mark.unit
def test_field_visible_circle_requires_membership() -> None:
    owner = uuid4()
    viewer = uuid4()
    cid = uuid4()
    assert not field_visible_for_viewer(
        field="avatar",
        visibility="circle",
        circle_id=cid,
        viewer_id=viewer,
        subject_id=owner,
        is_friend=True,
        viewer_in_circle=False,
    )
    assert field_visible_for_viewer(
        field="avatar",
        visibility="circle",
        circle_id=cid,
        viewer_id=viewer,
        subject_id=owner,
        is_friend=True,
        viewer_in_circle=True,
    )


@pytest.mark.unit
def test_redact_profile_fields_strips_avatar_when_none() -> None:
    owner = uuid4()
    viewer = uuid4()
    priv = {
        "discoverability": "public",
        "avatar_visibility": "none",
        "avatar_circle_id": None,
        "full_name_visibility": "everyone",
        "full_name_circle_id": None,
        "bio_visibility": "everyone",
        "bio_circle_id": None,
    }
    av, fn, bio = redact_profile_fields(
        subject_id=owner,
        viewer_id=viewer,
        is_friend=True,
        privacy=priv,
        avatar_url="https://example.com/a.png",
        full_name="Name",
        bio="Hello",
        circle_hits=set(),
    )
    assert av is None
    assert fn == "Name"
    assert bio == "Hello"


@pytest.mark.unit
def test_redact_friends_only_hides_avatar_from_non_friend() -> None:
    owner = uuid4()
    viewer = uuid4()
    priv = {
        "discoverability": "public",
        "avatar_visibility": "friends_only",
        "avatar_circle_id": None,
        "full_name_visibility": "everyone",
        "full_name_circle_id": None,
        "bio_visibility": "everyone",
        "bio_circle_id": None,
    }
    av, fn, bio = redact_profile_fields(
        subject_id=owner,
        viewer_id=viewer,
        is_friend=False,
        privacy=priv,
        avatar_url="https://x/a.png",
        full_name="N",
        bio="B",
        circle_hits=set(),
    )
    assert av is None
    assert fn == "N"
    assert bio == "B"


@pytest.mark.unit
def test_redact_friends_only_shows_avatar_to_friend() -> None:
    owner = uuid4()
    viewer = uuid4()
    priv = {
        "discoverability": "hidden",
        "avatar_visibility": "friends_only",
        "avatar_circle_id": None,
        "full_name_visibility": "friends_only",
        "full_name_circle_id": None,
        "bio_visibility": "none",
        "bio_circle_id": None,
    }
    av, fn, bio = redact_profile_fields(
        subject_id=owner,
        viewer_id=viewer,
        is_friend=True,
        privacy=priv,
        avatar_url="https://x/a.png",
        full_name="N",
        bio="Secret",
        circle_hits=set(),
    )
    assert av == "https://x/a.png"
    assert fn == "N"
    assert bio is None


@pytest.mark.unit
def test_privacy_from_joined_row_without_join_falls_back() -> None:
    class FakeRow(dict):
        def get(self, key, default=None):  # type: ignore[override]
            return super().get(key, default)

    r = FakeRow({"privacy_join_present": False})
    p = privacy_from_joined_row(r)  # type: ignore[arg-type]
    assert p["discoverability"] == "public"
