# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for Social Hub feed/inbox validation and privacy-safe read-model serialization.
# Invariants:
# - Invalid cursors and circle identifiers never reach SQL execution.
# - The feed service stays importable as part of social domain registration.
# Related:
# - api/services/social_hub_feed_service.py
# - api/routers/social_hub.py
# ---

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

import pytest

from api.services.social_hub_feed_service import SocialHubFeedService

VIEWER_ID = UUID("11111111-1111-1111-1111-111111111111")
SUBJECT_ID = UUID("22222222-2222-2222-2222-222222222222")
CIRCLE_ID = UUID("33333333-3333-3333-3333-333333333333")


class _ExplodingPool:
    def acquire(self) -> object:
        raise AssertionError("database must not be acquired for invalid input")


class _FakeAcquire:
    def __init__(self, conn: _FakeFeedConn) -> None:
        self.conn = conn

    async def __aenter__(self) -> _FakeFeedConn:
        return self.conn

    async def __aexit__(self, *_exc: object) -> None:
        return None


class _FakePool:
    def __init__(self, conn: _FakeFeedConn) -> None:
        self.conn = conn

    def acquire(self) -> _FakeAcquire:
        return _FakeAcquire(self.conn)


class _FakeFeedConn:
    def __init__(self) -> None:
        self.fetch_calls: list[tuple[str, tuple[object, ...]]] = []

    async def fetch(self, query: str, *args: object) -> list[dict]:
        self.fetch_calls.append((query, args))
        if len(self.fetch_calls) == 1:
            return [
                {
                    "id": "friendship:viewer:subject",
                    "type": "friendship_created",
                    "created_at": datetime(2026, 5, 29, 1, 0, tzinfo=UTC),
                    "actor_user_id": SUBJECT_ID,
                    "target_user_id": VIEWER_ID,
                    "subject_user_id": SUBJECT_ID,
                    "is_friend": True,
                    "username": "visible_username",
                    "full_name": "Circle Visible Name",
                    "avatar_url": "https://cdn.example/avatar.png",
                    "privacy_join_present": True,
                    "discoverability": "public",
                    "avatar_visibility": "none",
                    "avatar_circle_id": None,
                    "full_name_visibility": "circle",
                    "full_name_circle_id": CIRCLE_ID,
                    "bio_visibility": "none",
                    "bio_circle_id": None,
                    "summary": "Friendship established",
                }
            ]
        return [{"owner_user_id": SUBJECT_ID, "circle_id": CIRCLE_ID}]


class _FakeSharedContentConn:
    def __init__(self) -> None:
        self.fetch_calls: list[tuple[str, tuple[object, ...]]] = []

    async def fetch(self, query: str, *args: object) -> list[dict]:
        self.fetch_calls.append((query, args))
        return [
            {
                "id": UUID("44444444-4444-4444-4444-444444444444"),
                "name": "Shared plan.md",
                "title": None,
                "content_type": "document",
                "mime_type": "text/markdown",
                "file_size": 512,
                "visibility": "friends",
                "direction": "from_friend",
                "shared_reason": "friends_visibility",
                "created_at": datetime(2026, 5, 29, 1, 0, tzinfo=UTC),
                "updated_at": datetime(2026, 5, 29, 2, 0, tzinfo=UTC),
                "thumbnail_path": "/thumbs/shared.png",
            }
        ]


class _FakeInboxConn:
    def __init__(self) -> None:
        self.fetch_calls: list[tuple[str, tuple[object, ...]]] = []

    async def fetch(self, query: str, *args: object) -> list[dict]:
        self.fetch_calls.append((query, args))
        return [
            {
                "id": "incoming_requests",
                "type": "incoming_requests",
                "severity": "high",
                "title": "Incoming friend requests",
                "summary": "Review pending requests from people who want to connect.",
                "count": 2,
                "target_tab": "inbox",
                "target_id": "incoming",
                "created_at": datetime(2026, 5, 29, 1, 0, tzinfo=UTC),
            }
        ]


class _FakePrivacyPreviewConn:
    def __init__(self) -> None:
        self.fetch_calls: list[tuple[str, tuple[object, ...]]] = []
        self.fetchrow_calls: list[tuple[str, tuple[object, ...]]] = []

    async def fetchrow(self, query: str, *args: object) -> dict:
        self.fetchrow_calls.append((query, args))
        return {
            "discoverability": "hidden",
            "avatar_visibility": "everyone",
            "avatar_circle_id": None,
            "full_name_visibility": "circle",
            "full_name_circle_id": CIRCLE_ID,
            "bio_visibility": "none",
            "bio_circle_id": None,
        }

    async def fetch(self, query: str, *args: object) -> list[dict]:
        self.fetch_calls.append((query, args))
        return [
            {
                "id": CIRCLE_ID,
                "name": "Close friends",
                "members_count": 2,
            }
        ]


@pytest.mark.asyncio
async def test_feed_rejects_invalid_cursor_before_database() -> None:
    service = SocialHubFeedService(_ExplodingPool())  # type: ignore[arg-type]

    with pytest.raises(ValueError, match="cursor"):
        await service.list_feed(
            "11111111-1111-1111-1111-111111111111",
            cursor="not-a-date",
        )


@pytest.mark.asyncio
async def test_feed_rejects_invalid_circle_id_before_database() -> None:
    service = SocialHubFeedService(_ExplodingPool())  # type: ignore[arg-type]

    with pytest.raises(ValueError, match="круга"):
        await service.list_feed(
            "11111111-1111-1111-1111-111111111111",
            circle_id="bad-circle",
        )


@pytest.mark.asyncio
async def test_feed_applies_query_filters_and_profile_redaction() -> None:
    conn = _FakeFeedConn()
    service = SocialHubFeedService(_FakePool(conn))  # type: ignore[arg-type]

    result = await service.list_feed(
        str(VIEWER_ID),
        limit=1,
        cursor="2026-05-29T02:00:00+00:00",
        circle_id=str(CIRCLE_ID),
        types=["friendship_created"],
    )

    assert result["items"] == [
        {
            "id": "friendship:viewer:subject",
            "type": "friendship_created",
            "created_at": "2026-05-29T01:00:00+00:00",
            "actor_user_id": str(SUBJECT_ID),
            "target_user_id": str(VIEWER_ID),
            "username": "visible_username",
            "full_name": "Circle Visible Name",
            "avatar_url": None,
            "summary": "Friendship established",
        }
    ]
    feed_query, feed_args = conn.fetch_calls[0]
    assert "blocked_f" in feed_query
    assert "shared_content_events" in feed_query
    assert feed_query.count("fcm.owner_user_id = $1") == 3
    assert feed_args[0] == VIEWER_ID
    assert feed_args[2] == ["friendship_created"]
    assert feed_args[3] == CIRCLE_ID
    assert feed_args[4] == 2
    assert feed_args[5] == "gaf_chat_voice"


@pytest.mark.asyncio
async def test_feed_hides_circle_visible_name_without_membership() -> None:
    class _NoCircleConn(_FakeFeedConn):
        async def fetch(self, query: str, *args: object) -> list[dict]:
            rows = await super().fetch(query, *args)
            return rows if len(self.fetch_calls) == 1 else []

    conn = _NoCircleConn()
    service = SocialHubFeedService(_FakePool(conn))  # type: ignore[arg-type]

    result = await service.list_feed(str(VIEWER_ID))

    assert result["items"][0]["full_name"] is None
    assert result["items"][0]["avatar_url"] is None


@pytest.mark.asyncio
async def test_shared_content_requires_valid_friend_before_database() -> None:
    service = SocialHubFeedService(_ExplodingPool())  # type: ignore[arg-type]

    with pytest.raises(ValueError, match="друга"):
        await service.list_shared_content(str(VIEWER_ID), "bad-friend")


@pytest.mark.asyncio
async def test_shared_content_uses_mutual_friendship_and_share_guards() -> None:
    conn = _FakeSharedContentConn()
    service = SocialHubFeedService(_FakePool(conn))  # type: ignore[arg-type]

    result = await service.list_shared_content(str(VIEWER_ID), str(SUBJECT_ID), limit=2)

    assert result["items"] == [
        {
            "id": "44444444-4444-4444-4444-444444444444",
            "name": "Shared plan.md",
            "title": None,
            "content_type": "document",
            "mime_type": "text/markdown",
            "file_size": 512,
            "visibility": "friends",
            "direction": "from_friend",
            "shared_reason": "friends_visibility",
            "created_at": "2026-05-29T01:00:00+00:00",
            "updated_at": "2026-05-29T02:00:00+00:00",
            "thumbnail_url": "/api/v1/content/44444444-4444-4444-4444-444444444444/thumbnail",
        }
    ]
    query, args = conn.fetch_calls[0]
    assert "JOIN friendships fv" in query
    assert "COALESCE(vf.is_blocked, false) = false" in query
    assert "content_user_library_removals" in query
    assert "content_shares" in query
    assert args[:3] == (VIEWER_ID, SUBJECT_ID, 2)


@pytest.mark.asyncio
async def test_action_inbox_returns_bounded_privacy_safe_cards() -> None:
    conn = _FakeInboxConn()
    service = SocialHubFeedService(_FakePool(conn))  # type: ignore[arg-type]

    result = await service.get_action_inbox(str(VIEWER_ID), limit=99)

    assert result["items"] == [
        {
            "id": "incoming_requests",
            "type": "incoming_requests",
            "severity": "high",
            "title": "Incoming friend requests",
            "summary": "Review pending requests from people who want to connect.",
            "count": 2,
            "target_tab": "inbox",
            "target_id": "incoming",
            "created_at": "2026-05-29T01:00:00+00:00",
        }
    ]
    query, args = conn.fetch_calls[0]
    assert "private_note" not in query
    assert "LIMIT $2" in query
    assert args == (VIEWER_ID, 24)


@pytest.mark.asyncio
async def test_action_inbox_rejects_invalid_user_before_database() -> None:
    service = SocialHubFeedService(_ExplodingPool())  # type: ignore[arg-type]

    with pytest.raises(ValueError, match="пользователя"):
        await service.get_action_inbox("bad-user")


@pytest.mark.asyncio
async def test_privacy_preview_builds_audience_matrix_without_friend_rows() -> None:
    conn = _FakePrivacyPreviewConn()
    service = SocialHubFeedService(_FakePool(conn))  # type: ignore[arg-type]

    result = await service.get_privacy_preview(str(VIEWER_ID))

    assert result["discoverability"] == "hidden"
    assert result["fields"]["full_name"]["circle_id"] == str(CIRCLE_ID)
    assert result["audiences"] == [
        {
            "id": "everyone",
            "label": "Everyone",
            "visible_fields": ["avatar"],
            "people_count": None,
        },
        {
            "id": "friends",
            "label": "Friends",
            "visible_fields": ["avatar"],
            "people_count": None,
        },
        {
            "id": "blocked",
            "label": "Blocked contacts",
            "visible_fields": [],
            "people_count": None,
        },
        {
            "id": f"circle:{CIRCLE_ID}",
            "label": "Close friends",
            "visible_fields": ["avatar", "full_name"],
            "people_count": 2,
        },
    ]
    assert result["warnings"] == ["discoverability_hidden", "bio_hidden"]
