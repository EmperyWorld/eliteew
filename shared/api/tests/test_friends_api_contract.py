# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Route-level contract tests for the Friends API used by Social Hub and MobileAndroid.
# Invariants:
# - Tests stay database-free: FastAPI dependency overrides provide a deterministic fake service.
# - Public route paths must match desktop frontend, generated OpenAPI pilot, and Android Retrofit contracts.
# Related:
# - api/routers/friends.py
# - api/services/friends_service.py
# ---

from __future__ import annotations

from copy import deepcopy
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.dependencies.user_context import get_current_user_db_id
from api.routers import friends as friends_router
from api.services.friends_service import FriendsService

CURRENT_USER_ID = str(uuid4())
OTHER_USER_ID = str(uuid4())
REQUEST_ID = uuid4()
REPORTER_ID = UUID("11111111-1111-4111-8111-111111111111")
REPORTED_ID = UUID("22222222-2222-4222-8222-222222222222")


class FakeNotificationService:
    def __init__(self) -> None:
        self.sent: list[dict] = []

    async def send_to_user(self, user_id: str, data: object) -> None:
        self.sent.append(
            {
                "user_id": user_id,
                "source": getattr(data, "source", None),
                "metadata": getattr(data, "metadata", {}),
            }
        )


class FakeFriendsService:
    def __init__(self) -> None:
        self.accepted = False
        self.rejected = False
        self.cancelled = False
        self.removed = False
        self.reports: list[dict] = []
        self.circles: list[dict] = []
        self.relationship: dict = {
            "is_favorite": False,
            "is_muted": False,
            "is_blocked": False,
            "share_activity_with_friend": True,
            "circle_ids": [],
            "private_note": None,
        }

    async def list_friends(self, user_id: str) -> list[dict]:
        return self._friends() if self.accepted and not self.removed else []

    async def get_overview(self, user_id: str) -> dict:
        friends = await self.list_friends(user_id)
        incoming = [] if self.accepted or self.rejected else [self._incoming_request()]
        sent = [] if self.accepted or self.cancelled else [self._sent_request()]
        return {
            "friends": friends,
            "incoming_requests": incoming,
            "sent_requests": sent,
            "circles": deepcopy(self.circles),
            "stats": {
                "friends_count": len(friends),
                "incoming_requests_count": len(incoming),
                "sent_requests_count": len(sent),
            },
        }

    async def search_users(self, user_id: str, query: str, limit: int = 8) -> list[dict]:
        status = "friend" if self.accepted and not self.removed else "can_send"
        return [
            {
                "id": OTHER_USER_ID,
                "username": "friend",
                "avatar_url": None,
                "full_name": "Friend User",
                "relationship_status": status,
                "request_id": None,
                "is_muted": self.relationship["is_muted"],
                "is_blocked": self.relationship["is_blocked"],
                "share_activity_with_friend": self.relationship["share_activity_with_friend"],
                "activity_visible_to_current_user": True,
                "last_activity_at": None,
                "last_interaction_at": None,
            }
        ][:limit]

    async def send_request(self, from_user_id: str, to_username: str) -> dict:
        return await self.send_request_to_user(from_user_id, OTHER_USER_ID)

    async def send_request_to_user(self, from_user_id: str, user_id: str) -> dict:
        return {
            "request_id": str(REQUEST_ID),
            "status": "pending",
            "from_user_id": from_user_id,
            "to_user_id": user_id,
        }

    async def list_incoming_requests(self, user_id: str) -> list[dict]:
        return (await self.get_overview(user_id))["incoming_requests"]

    async def list_sent_requests(self, user_id: str) -> list[dict]:
        return (await self.get_overview(user_id))["sent_requests"]

    async def accept_request(self, request_id: UUID, current_user_id: str) -> dict:
        self.accepted = True
        return {
            "status": "accepted",
            "from_user_id": OTHER_USER_ID,
            "to_user_id": current_user_id,
        }

    async def reject_request(self, request_id: UUID, current_user_id: str) -> dict:
        self.rejected = True
        return {
            "status": "rejected",
            "from_user_id": OTHER_USER_ID,
            "to_user_id": current_user_id,
        }

    async def cancel_request(self, request_id: UUID, current_user_id: str) -> dict:
        self.cancelled = True
        return {
            "status": "cancelled",
            "from_user_id": current_user_id,
            "to_user_id": OTHER_USER_ID,
        }

    async def remove_friend(self, current_user_id: str, friend_user_id: str) -> dict:
        self.removed = True
        return {
            "status": "removed",
            "current_user_id": current_user_id,
            "friend_user_id": friend_user_id,
        }

    async def report_user(
        self,
        reporter_user_id: str,
        reported_user_id: str,
        *,
        reason: str,
        details: str | None = None,
    ) -> dict:
        report = {
            "id": str(uuid4()),
            "status": "received",
            "reporter_user_id": reporter_user_id,
            "reported_user_id": reported_user_id,
            "reason": reason,
            "details": details,
        }
        self.reports.append(report)
        return {"id": report["id"], "status": report["status"]}

    async def list_circles(self, user_id: str) -> list[dict]:
        return deepcopy(self.circles)

    async def create_circle(self, user_id: str, name: str) -> dict:
        circle = {
            "id": str(uuid4()),
            "name": name.strip(),
            "members_count": 0,
            "sort_order": len(self.circles),
            "color": None,
            "icon": None,
        }
        self.circles.append(circle)
        return deepcopy(circle)

    async def update_circle(
        self,
        user_id: str,
        circle_id: str,
        *,
        name: str | None = None,
        sort_order: int | None = None,
        color: str | None = None,
        icon: str | None = None,
    ) -> dict:
        circle = next((item for item in self.circles if item["id"] == circle_id), None)
        if circle is None:
            raise ValueError("Круг не найден")
        if name is not None:
            circle["name"] = name
        if sort_order is not None:
            circle["sort_order"] = sort_order
        if color is not None:
            circle["color"] = color
        if icon is not None:
            circle["icon"] = icon
        return deepcopy(circle)

    async def delete_circle(self, user_id: str, circle_id: str) -> None:
        self.circles = [circle for circle in self.circles if circle["id"] != circle_id]

    async def get_friend_profile(self, current_user_id: str, friend_user_id: str) -> dict:
        circles = [circle for circle in self.circles if circle["id"] in self.relationship["circle_ids"]]
        return {
            "id": friend_user_id,
            "username": "friend",
            "avatar_url": None,
            "full_name": "Friend User",
            "is_favorite": self.relationship["is_favorite"],
            "is_muted": self.relationship["is_muted"],
            "is_blocked": self.relationship["is_blocked"],
            "share_activity_with_friend": self.relationship["share_activity_with_friend"],
            "activity_visible_to_current_user": True,
            "last_activity_at": None,
            "last_interaction_at": None,
            "circles": circles,
            "private_note": self.relationship["private_note"],
            "note_updated_at": None,
            "friendship_created_at": None,
        }

    async def update_friend_relationship(
        self,
        current_user_id: str,
        friend_user_id: str,
        *,
        is_favorite: bool | None = None,
        is_muted: bool | None = None,
        is_blocked: bool | None = None,
        share_activity_with_friend: bool | None = None,
        circle_ids: list[str] | None = None,
        private_note: str | None = None,
    ) -> dict:
        for key, value in {
            "is_favorite": is_favorite,
            "is_muted": is_muted,
            "is_blocked": is_blocked,
            "share_activity_with_friend": share_activity_with_friend,
            "private_note": private_note,
        }.items():
            if value is not None:
                self.relationship[key] = value
        if circle_ids is not None:
            self.relationship["circle_ids"] = list(circle_ids)
        return await self.get_friend_profile(current_user_id, friend_user_id)

    async def find_user_by_id(self, user_id: str) -> dict | None:
        return {
            "id": user_id,
            "username": "friend" if user_id == OTHER_USER_ID else "current",
            "avatar_url": None,
            "full_name": "Friend User" if user_id == OTHER_USER_ID else "Current User",
        }

    def _friends(self) -> list[dict]:
        return [
            {
                "id": OTHER_USER_ID,
                "username": "friend",
                "avatar_url": None,
                "full_name": "Friend User",
                "is_favorite": self.relationship["is_favorite"],
                "is_muted": self.relationship["is_muted"],
                "is_blocked": self.relationship["is_blocked"],
                "share_activity_with_friend": self.relationship["share_activity_with_friend"],
                "activity_visible_to_current_user": True,
                "last_activity_at": None,
                "last_interaction_at": None,
                "circles": [],
            }
        ]

    @staticmethod
    def _incoming_request() -> dict:
        return {
            "id": str(REQUEST_ID),
            "from_user_id": OTHER_USER_ID,
            "created_at": None,
            "username": "friend",
            "avatar_url": None,
            "full_name": "Friend User",
        }

    @staticmethod
    def _sent_request() -> dict:
        return {
            "id": str(REQUEST_ID),
            "to_user_id": OTHER_USER_ID,
            "created_at": None,
            "username": "friend",
            "avatar_url": None,
            "full_name": "Friend User",
        }


class _ReportAcquire:
    def __init__(self, conn: _ReportConn) -> None:
        self.conn = conn

    async def __aenter__(self) -> _ReportConn:
        return self.conn

    async def __aexit__(self, *_exc: object) -> None:
        return None


class _ReportPool:
    def __init__(self, conn: _ReportConn) -> None:
        self.conn = conn

    def acquire(self) -> _ReportAcquire:
        return _ReportAcquire(self.conn)


class _ReportConn:
    def __init__(self, *, duplicate: bool = False) -> None:
        self.duplicate = duplicate
        self.fetchrow_calls: list[tuple[str, tuple[object, ...]]] = []
        self.execute_calls: list[tuple[str, tuple[object, ...]]] = []

    async def fetchrow(self, query: str, *args: object) -> dict | None:
        self.fetchrow_calls.append((query, args))
        return {"id": uuid4()} if self.duplicate else None

    async def execute(self, query: str, *args: object) -> str:
        self.execute_calls.append((query, args))
        return "INSERT 0 1"


def _client(
    service: FakeFriendsService,
    notification_service: FakeNotificationService,
    emitted: list[dict],
    monkeypatch,
) -> TestClient:
    app = FastAPI()
    app.include_router(friends_router.router, prefix="/api/v1")
    app.dependency_overrides[get_current_user_db_id] = lambda: CURRENT_USER_ID
    app.dependency_overrides[friends_router.get_friends_service] = lambda: service
    app.dependency_overrides[friends_router.get_notification_sender] = lambda: notification_service

    async def fake_emit(user_id: str, payload: dict) -> None:
        emitted.append({"user_id": user_id, "payload": payload})

    monkeypatch.setattr(friends_router, "emit_friends_updated", fake_emit)
    return TestClient(app)


def test_friend_request_lifecycle_emits_notifications_and_changes_overview(monkeypatch) -> None:
    service = FakeFriendsService()
    notifications = FakeNotificationService()
    emitted: list[dict] = []
    client = _client(service, notifications, emitted, monkeypatch)

    search = client.get("/api/v1/friends/users/search", params={"q": "friend"})
    assert search.status_code == 200
    assert search.json()[0]["relationship_status"] == "can_send"

    sent = client.post(f"/api/v1/friends/request/by-user/{OTHER_USER_ID}")
    assert sent.status_code == 200
    assert sent.json() == {"request_id": str(REQUEST_ID), "status": "pending"}
    assert notifications.sent[-1]["source"] == "friends"
    received_metadata = notifications.sent[-1]["metadata"]
    assert received_metadata["open_app"] == {"appComponent": "SocialHubApp"}
    assert received_metadata["kind"] == "friend_request_received"
    assert received_metadata["tab"] == "inbox"
    assert received_metadata["focus"] == "incoming"
    assert received_metadata["social_hub_section"] == "inbox"
    assert received_metadata["sync"] == "friends"
    assert received_metadata["request_id"] == str(REQUEST_ID)
    assert received_metadata["friend_user_id"] == CURRENT_USER_ID
    assert emitted[-1]["payload"]["event"] == "request_sent"

    incoming = client.get("/api/v1/friends/requests")
    assert incoming.status_code == 200
    assert incoming.json()[0]["from_user_id"] == OTHER_USER_ID

    accepted = client.post(f"/api/v1/friends/requests/{REQUEST_ID}/accept")
    assert accepted.status_code == 200
    assert accepted.json() == {"status": "accepted"}
    accepted_metadata = notifications.sent[-1]["metadata"]
    assert accepted_metadata["kind"] == "friend_request_accepted"
    assert accepted_metadata["tab"] == "friends"
    assert accepted_metadata["focus"] == "friend_detail"
    assert accepted_metadata["social_hub_section"] == "friends"
    assert accepted_metadata["sync"] == "friends"
    assert accepted_metadata["request_id"] == str(REQUEST_ID)
    assert accepted_metadata["friend_user_id"] == CURRENT_USER_ID
    assert emitted[-1]["payload"]["event"] == "request_accepted"

    overview = client.get("/api/v1/friends/overview").json()
    assert overview["stats"]["friends_count"] == 1
    assert overview["stats"]["incoming_requests_count"] == 0
    assert overview["friends"][0]["id"] == OTHER_USER_ID


def test_friends_overview_etag_returns_304_until_payload_changes(monkeypatch) -> None:
    service = FakeFriendsService()
    notifications = FakeNotificationService()
    client = _client(service, notifications, [], monkeypatch)

    first = client.get("/api/v1/friends/overview")
    assert first.status_code == 200
    etag = first.headers["etag"]

    cached = client.get("/api/v1/friends/overview", headers={"If-None-Match": etag})
    assert cached.status_code == 304
    assert cached.headers["etag"] == etag
    assert not cached.content

    client.post(f"/api/v1/friends/requests/{REQUEST_ID}/accept")
    changed = client.get("/api/v1/friends/overview", headers={"If-None-Match": etag})
    assert changed.status_code == 200
    assert changed.headers["etag"] != etag
    assert changed.json()["stats"]["friends_count"] == 1


def test_circle_and_relationship_controls_contract(monkeypatch) -> None:
    service = FakeFriendsService()
    service.accepted = True
    notifications = FakeNotificationService()
    client = _client(service, notifications, [], monkeypatch)

    created = client.post("/api/v1/friends/circles", json={"name": "Close"})
    assert created.status_code == 200
    circle_id = created.json()["id"]

    patched = client.patch(
        f"/api/v1/friends/{OTHER_USER_ID}/relationship",
        json={
            "is_favorite": True,
            "is_muted": True,
            "is_blocked": True,
            "share_activity_with_friend": False,
            "circle_ids": [circle_id],
            "private_note": "follow up",
        },
    )
    assert patched.status_code == 200
    body = patched.json()
    assert body["is_favorite"] is True
    assert body["is_muted"] is True
    assert body["is_blocked"] is True
    assert body["share_activity_with_friend"] is False
    assert body["private_note"] == "follow up"
    renamed = client.patch(
        f"/api/v1/friends/circles/{circle_id}",
        json={"name": "Core", "sort_order": 3, "color": "cyan", "icon": "users"},
    )
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Core"
    assert renamed.json()["sort_order"] == 3
    assert renamed.json()["color"] == "cyan"

    assert body["circles"] == [
        {
            "id": circle_id,
            "name": "Close",
            "members_count": 0,
            "sort_order": 0,
            "color": None,
            "icon": None,
        }
    ]

    profile = client.get(f"/api/v1/friends/{OTHER_USER_ID}/profile")
    assert profile.status_code == 200
    assert profile.json()["is_blocked"] is True

    deleted = client.delete(f"/api/v1/friends/circles/{circle_id}")
    assert deleted.status_code == 200
    assert deleted.json() == {"status": "deleted"}


def test_report_user_contract_is_owner_scoped_and_summary_only(monkeypatch) -> None:
    service = FakeFriendsService()
    notifications = FakeNotificationService()
    client = _client(service, notifications, [], monkeypatch)

    reported = client.post(
        f"/api/v1/friends/{OTHER_USER_ID}/report",
        json={"reason": "spam", "details": "Repeated requests"},
    )

    assert reported.status_code == 200
    assert reported.json()["status"] == "received"
    assert service.reports == [
        {
            "id": reported.json()["id"],
            "status": "received",
            "reporter_user_id": CURRENT_USER_ID,
            "reported_user_id": OTHER_USER_ID,
            "reason": "spam",
            "details": "Repeated requests",
        }
    ]


@pytest.mark.asyncio
async def test_report_user_rejects_recent_duplicate_before_insert() -> None:
    conn = _ReportConn(duplicate=True)
    service = FriendsService(_ReportPool(conn))  # type: ignore[arg-type]

    with pytest.raises(ValueError, match="уже отправлена"):
        await service.report_user(
            str(REPORTER_ID),
            str(REPORTED_ID),
            reason="spam_or_scam",
            details="same issue",
        )

    assert len(conn.fetchrow_calls) == 1
    query, args = conn.fetchrow_calls[0]
    assert "social_user_reports" in query
    assert "created_at >= NOW()" in query
    assert args[0] == REPORTER_ID
    assert args[1] == REPORTED_ID
    assert conn.execute_calls == []


@pytest.mark.asyncio
async def test_report_user_inserts_when_no_recent_duplicate() -> None:
    conn = _ReportConn(duplicate=False)
    service = FriendsService(_ReportPool(conn))  # type: ignore[arg-type]

    result = await service.report_user(
        str(REPORTER_ID),
        str(REPORTED_ID),
        reason=" spam_or_scam ",
        details=" Repeated requests ",
    )

    assert result["status"] == "received"
    assert len(conn.fetchrow_calls) == 1
    assert len(conn.execute_calls) == 1
    _query, args = conn.execute_calls[0]
    assert args[1] == REPORTER_ID
    assert args[2] == REPORTED_ID
    assert args[3] == "spam_or_scam"
    assert args[4] == "Repeated requests"
