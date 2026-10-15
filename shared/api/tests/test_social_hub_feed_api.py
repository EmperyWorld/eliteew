# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for the Social Hub privacy-safe read-model API.
# Invariants:
# - Tests use dependency overrides and never require live Postgres.
# - Feed responses remain bounded summaries without private message or note fields.
# Related:
# - api/routers/social_hub.py
# - api/services/social_hub_feed_service.py
# ---

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.dependencies.user_context import get_current_user_db_id
from api.routers import social_hub


class FakeSocialHubFeedService:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    async def list_feed(
        self,
        user_id: str,
        *,
        limit: int = 30,
        cursor: str | None = None,
        circle_id: str | None = None,
        types: list[str] | None = None,
    ) -> dict:
        self.calls.append(
            {
                "user_id": user_id,
                "limit": limit,
                "cursor": cursor,
                "circle_id": circle_id,
                "types": types,
            }
        )
        return {
            "items": [
                {
                    "id": "friendship:1",
                    "type": "friendship_created",
                    "created_at": "2026-05-29T00:00:00+00:00",
                    "actor_user_id": "friend-user",
                    "target_user_id": "current-user",
                    "username": "friend",
                    "full_name": "Friend User",
                    "avatar_url": None,
                    "summary": "Friendship established",
                }
            ],
            "next_cursor": None,
        }

    async def list_shared_content(
        self,
        user_id: str,
        friend_user_id: str,
        *,
        limit: int = 12,
    ) -> dict:
        self.calls.append(
            {
                "user_id": user_id,
                "friend_user_id": friend_user_id,
                "limit": limit,
            }
        )
        return {
            "items": [
                {
                    "id": "content-1",
                    "name": "Shared brief.pdf",
                    "title": None,
                    "content_type": "document",
                    "mime_type": "application/pdf",
                    "file_size": 1024,
                    "visibility": "friends",
                    "direction": "from_friend",
                    "shared_reason": "friends_visibility",
                    "created_at": "2026-05-29T00:00:00+00:00",
                    "updated_at": "2026-05-29T01:00:00+00:00",
                    "thumbnail_url": None,
                }
            ],
        }

    async def get_action_inbox(
        self,
        user_id: str,
        *,
        limit: int = 12,
    ) -> dict:
        self.calls.append(
            {
                "user_id": user_id,
                "limit": limit,
            }
        )
        return {
            "items": [
                {
                    "id": "incoming_requests",
                    "type": "incoming_requests",
                    "severity": "high",
                    "title": "Incoming friend requests",
                    "summary": "Review pending requests from people who want to connect.",
                    "count": 2,
                    "target_tab": "inbox",
                    "target_id": "incoming",
                    "created_at": "2026-05-29T00:00:00+00:00",
                }
            ]
        }

    async def get_privacy_preview(self, user_id: str) -> dict:
        self.calls.append({"user_id": user_id, "method": "get_privacy_preview"})
        return {
            "discoverability": "hidden",
            "fields": {
                "avatar": {"visibility": "everyone", "circle_id": None},
                "full_name": {"visibility": "friends_only", "circle_id": None},
                "bio": {"visibility": "none", "circle_id": None},
            },
            "audiences": [
                {
                    "id": "everyone",
                    "label": "Everyone",
                    "visible_fields": ["avatar"],
                    "people_count": None,
                }
            ],
            "warnings": ["discoverability_hidden", "bio_hidden"],
        }


class FailingSocialHubFeedService:
    async def list_feed(
        self,
        user_id: str,
        *,
        limit: int = 30,
        cursor: str | None = None,
        circle_id: str | None = None,
        types: list[str] | None = None,
    ) -> dict:
        raise ValueError("Некорректный cursor ленты")


def test_social_hub_feed_forwards_filters_and_returns_summaries() -> None:
    service = FakeSocialHubFeedService()
    app = FastAPI()
    app.include_router(social_hub.router, prefix="/api/v1")
    app.dependency_overrides[get_current_user_db_id] = lambda: "current-user"
    app.dependency_overrides[social_hub.get_social_hub_feed_service] = lambda: service

    response = TestClient(app).get(
        "/api/v1/social-hub/feed",
        params={
            "limit": 5,
            "cursor": "2026-05-29T00:00:00+00:00",
            "circle_id": "circle-1",
            "types": ["friendship_created"],
        },
    )

    assert response.status_code == 200
    assert response.json()["items"][0]["type"] == "friendship_created"
    assert "private_note" not in response.text
    assert service.calls == [
        {
            "user_id": "current-user",
            "limit": 5,
            "cursor": "2026-05-29T00:00:00+00:00",
            "circle_id": "circle-1",
            "types": ["friendship_created"],
        }
    ]


def test_social_hub_shared_content_forwards_friend_scope() -> None:
    service = FakeSocialHubFeedService()
    app = FastAPI()
    app.include_router(social_hub.router, prefix="/api/v1")
    app.dependency_overrides[get_current_user_db_id] = lambda: "current-user"
    app.dependency_overrides[social_hub.get_social_hub_feed_service] = lambda: service

    response = TestClient(app).get(
        "/api/v1/social-hub/friends/friend-user/shared-content",
        params={"limit": 3},
    )

    assert response.status_code == 200
    assert response.json()["items"][0]["direction"] == "from_friend"
    assert "private_note" not in response.text
    assert service.calls == [
        {
            "user_id": "current-user",
            "friend_user_id": "friend-user",
            "limit": 3,
        }
    ]


def test_social_hub_action_inbox_forwards_limit_and_returns_summaries() -> None:
    service = FakeSocialHubFeedService()
    app = FastAPI()
    app.include_router(social_hub.router, prefix="/api/v1")
    app.dependency_overrides[get_current_user_db_id] = lambda: "current-user"
    app.dependency_overrides[social_hub.get_social_hub_feed_service] = lambda: service

    response = TestClient(app).get("/api/v1/social-hub/inbox", params={"limit": 4})

    assert response.status_code == 200
    body = response.json()
    assert body["items"][0]["target_tab"] == "inbox"
    assert "private_note" not in response.text
    assert service.calls == [
        {
            "user_id": "current-user",
            "limit": 4,
        }
    ]


def test_social_hub_privacy_preview_returns_audience_matrix() -> None:
    service = FakeSocialHubFeedService()
    app = FastAPI()
    app.include_router(social_hub.router, prefix="/api/v1")
    app.dependency_overrides[get_current_user_db_id] = lambda: "current-user"
    app.dependency_overrides[social_hub.get_social_hub_feed_service] = lambda: service

    response = TestClient(app).get("/api/v1/social-hub/profile/privacy-preview")

    assert response.status_code == 200
    body = response.json()
    assert body["discoverability"] == "hidden"
    assert body["audiences"][0]["visible_fields"] == ["avatar"]
    assert "private_note" not in response.text
    assert service.calls == [{"user_id": "current-user", "method": "get_privacy_preview"}]


def test_social_hub_feed_returns_400_for_service_validation_errors() -> None:
    app = FastAPI()
    app.include_router(social_hub.router, prefix="/api/v1")
    app.dependency_overrides[get_current_user_db_id] = lambda: "current-user"
    app.dependency_overrides[social_hub.get_social_hub_feed_service] = lambda: FailingSocialHubFeedService()

    response = TestClient(app).get("/api/v1/social-hub/feed", params={"cursor": "bad"})

    assert response.status_code == 400
    assert response.json()["detail"] == "Некорректный cursor ленты"
