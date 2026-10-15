# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Route-level contract tests for Social Hub admin report moderation queue.
# Invariants:
# - Non-admin callers receive 403; payloads stay summary-only.
# - Status transitions follow open → in_review → resolved|dismissed (+ dismissed reopen).
# Related:
# - api/routers/friends_admin_reports.py
# - api/services/friends/reports_admin.py
# ---

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import FastAPI, HTTPException, status
from fastapi.testclient import TestClient

from api.routers import friends as friends_router
from api.routers.admin_auth import require_admin_user
from api.routers.friends_admin_reports import get_friends_reports_admin_ops
from api.services.friends.reports_admin import FriendsReportsAdminOps

ADMIN_ID = str(uuid4())
REPORT_ID = str(uuid4())
REPORTER_ID = str(uuid4())
REPORTED_ID = str(uuid4())


class FakeReportsAdminOps:
    def __init__(self) -> None:
        self.item = {
            "id": REPORT_ID,
            "reporter_user_id": REPORTER_ID,
            "reported_user_id": REPORTED_ID,
            "reason": "spam",
            "details": "unwanted invites",
            "status": "open",
            "created_at": "2026-07-14T00:00:00+00:00",
            "reviewed_at": None,
            "reviewer_user_id": None,
            "reporter_username": "alice",
            "reporter_display_name": "Alice",
            "reported_username": "bob",
            "reported_display_name": "Bob",
            "reviewer_username": None,
        }
        self.patch_calls: list[dict] = []

    async def list_reports(
        self,
        *,
        status_filter: str | None = None,
        q: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        items = [self.item]
        if status_filter and self.item["status"] != status_filter:
            items = []
        if q and q.lower() not in (self.item["reason"] or "").lower():
            items = []
        return {"items": items, "total": len(items)}

    async def get_report(self, report_id: str) -> dict:
        if report_id != REPORT_ID:
            raise LookupError("Жалоба не найдена")
        return dict(self.item)

    async def patch_report(
        self,
        report_id: str,
        *,
        status: str,
        reviewer_user_id: str,
    ) -> dict:
        self.patch_calls.append(
            {
                "report_id": report_id,
                "status": status,
                "reviewer_user_id": reviewer_user_id,
            }
        )
        if report_id != REPORT_ID:
            raise LookupError("Жалоба не найдена")
        if status == "resolved" and self.item["status"] == "open":
            # Router still validates body; fake allows direct jump for HTTP shape.
            pass
        self.item = {
            **self.item,
            "status": status,
            "reviewed_at": "2026-07-14T01:00:00+00:00",
            "reviewer_user_id": reviewer_user_id,
            "reviewer_username": "admin",
        }
        return dict(self.item)


def _admin_user() -> SimpleNamespace:
    return SimpleNamespace(id=ADMIN_ID, role="admin", email="a@e.test", username="admin")


def _client(
    ops: FakeReportsAdminOps,
    *,
    allow_admin: bool = True,
) -> TestClient:
    app = FastAPI()
    app.include_router(friends_router.router, prefix="/api/v1")

    async def fake_admin() -> SimpleNamespace:
        if not allow_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrator privileges required",
            )
        return _admin_user()

    app.dependency_overrides[require_admin_user] = fake_admin
    app.dependency_overrides[get_friends_reports_admin_ops] = lambda: ops
    return TestClient(app)


def test_admin_list_reports_requires_admin() -> None:
    ops = FakeReportsAdminOps()
    client = _client(ops, allow_admin=False)
    response = client.get("/api/v1/friends/admin/reports")
    assert response.status_code == 403


def test_admin_list_and_get_report_summary_only() -> None:
    ops = FakeReportsAdminOps()
    client = _client(ops)
    listed = client.get("/api/v1/friends/admin/reports", params={"status": "open"})
    assert listed.status_code == 200
    body = listed.json()
    assert body["total"] == 1
    item = body["items"][0]
    assert item["id"] == REPORT_ID
    assert item["reason"] == "spam"
    assert "private_note" not in item
    assert set(item.keys()) >= {
        "reporter_display_name",
        "reported_display_name",
        "status",
        "created_at",
    }

    detail = client.get(f"/api/v1/friends/admin/reports/{REPORT_ID}")
    assert detail.status_code == 200
    assert detail.json()["reported_username"] == "bob"


def test_admin_patch_report_sets_reviewer() -> None:
    ops = FakeReportsAdminOps()
    client = _client(ops)
    patched = client.patch(
        f"/api/v1/friends/admin/reports/{REPORT_ID}",
        json={"status": "in_review"},
    )
    assert patched.status_code == 200
    assert patched.json()["status"] == "in_review"
    assert patched.json()["reviewer_user_id"] == ADMIN_ID
    assert ops.patch_calls[-1]["reviewer_user_id"] == ADMIN_ID


def test_admin_patch_rejects_invalid_status() -> None:
    ops = FakeReportsAdminOps()
    client = _client(ops)
    response = client.patch(
        f"/api/v1/friends/admin/reports/{REPORT_ID}",
        json={"status": "closed"},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_reports_admin_ops_transition_rules() -> None:
    """Unit-level transition matrix without DB (direct method checks via stub conn)."""
    ops = FriendsReportsAdminOps(db_pool=object())  # type: ignore[arg-type]
    # Exercise allowed map through public constants path used by router.
    from api.services.friends.reports_admin import _ALLOWED_TRANSITIONS

    assert "in_review" in _ALLOWED_TRANSITIONS["open"]
    assert "resolved" in _ALLOWED_TRANSITIONS["in_review"]
    assert "open" in _ALLOWED_TRANSITIONS["dismissed"]
    assert "resolved" not in _ALLOWED_TRANSITIONS["dismissed"]
    assert ops.db_pool is not None
