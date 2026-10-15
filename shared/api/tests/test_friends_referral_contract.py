# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Route-level contract tests for Friends referral invite endpoints (DEBT-X-06).
# Invariants:
# - Tests stay database-free via dependency overrides.
# - Public preview path must stay JWT-exempt at middleware layer.
# Related:
# - api/routers/friends.py
# - documentation/api/ANDROID-API-CONTRACTS.md
# ---

from __future__ import annotations

from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.dependencies.user_context import get_current_user_db_id
from api.routers import friends as friends_router

CURRENT_USER_ID = str(uuid4())


class FakeFriendsReferralService:
    async def get_referral_invite(self, user_id: str) -> dict:
        assert user_id == CURRENT_USER_ID
        return {
            "referral_code": "ABCD234567",
            "invite_url": "https://app.eliteew.ru/mobile-app/?ref=ABCD234567",
            "inviter_display_name": "Anna Test",
            "share_message": "Anna Test приглашает вас в EliteEW.",
        }

    async def preview_referral_code(self, raw_code: str) -> dict:
        if raw_code != "ABCD234567":
            raise ValueError("Реферальный код не найден")
        return {
            "valid": True,
            "referral_code": "ABCD234567",
            "inviter_display_name": "Anna Test",
            "invite_url": "https://app.eliteew.ru/mobile-app/?ref=ABCD234567",
        }


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(friends_router.router, prefix="/api/v1")
    app.dependency_overrides[get_current_user_db_id] = lambda: CURRENT_USER_ID
    app.dependency_overrides[friends_router.get_friends_referral_service] = lambda: FakeFriendsReferralService()
    return TestClient(app)


def test_get_friends_referral_invite_contract() -> None:
    client = _client()
    response = client.get("/api/v1/friends/referral")
    assert response.status_code == 200
    body = response.json()
    assert body["referral_code"] == "ABCD234567"
    assert body["invite_url"].endswith("?ref=ABCD234567")
    assert body["inviter_display_name"] == "Anna Test"
    assert "share_message" in body


def test_preview_friends_referral_code_contract() -> None:
    client = _client()
    ok = client.get("/api/v1/friends/referral/preview", params={"code": "ABCD234567"})
    assert ok.status_code == 200
    assert ok.json()["valid"] is True
    assert ok.json()["inviter_display_name"] == "Anna Test"

    missing = client.get("/api/v1/friends/referral/preview", params={"code": "ZZZZ234567"})
    assert missing.status_code == 404
