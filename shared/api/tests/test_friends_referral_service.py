# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for referral code helpers and FriendsReferralService DB boundaries.
# Invariants:
# - Tests stay database-free via fake asyncpg connections.
# - Invite URLs always use MOBILE_APP_DOWNLOAD_PAGE_URL with ?ref= query param.
# Related:
# - api/services/friends_referral_service.py
# ---

from __future__ import annotations

from uuid import UUID, uuid4

import pytest

from api.services.friends_referral_service import (
    FriendsReferralService,
    build_referral_invite_url,
    build_referral_share_message,
)


class _ReferralConn:
    def __init__(
        self,
        *,
        user_row: dict | None,
        existing_code: str | None = None,
        preview_row: dict | None = None,
    ) -> None:
        self.user_row = user_row
        self.existing_code = existing_code
        self.preview_row = preview_row
        self.execute_calls: list[tuple[str, tuple]] = []

    async def fetchrow(self, query: str, *args: object) -> dict | None:
        if "FROM users" in query and "WHERE id = $1" in query:
            return self.user_row
        if "FROM user_referral_codes" in query and "WHERE user_id = $1" in query:
            if self.existing_code is None:
                return None
            return {"referral_code": self.existing_code}
        if "JOIN users u ON u.id = c.user_id" in query:
            return self.preview_row
        return None

    async def execute(self, query: str, *args: object) -> None:
        self.execute_calls.append((query, args))


class _ReferralPool:
    def __init__(self, conn: _ReferralConn) -> None:
        self._conn = conn

    def acquire(self) -> _ReferralAcquire:
        return _ReferralAcquire(self._conn)


class _ReferralAcquire:
    def __init__(self, conn: _ReferralConn) -> None:
        self._conn = conn

    async def __aenter__(self) -> _ReferralConn:
        return self._conn

    async def __aexit__(self, *_exc: object) -> None:
        return None


def test_build_referral_invite_url_appends_ref_query(monkeypatch) -> None:
    monkeypatch.setattr(
        "api.services.friends_referral_service.unified_settings.mobile_app_download_page_url",
        "https://app.eliteew.ru/mobile-app/",
    )
    url = build_referral_invite_url("ABCD234567")
    assert url == "https://app.eliteew.ru/mobile-app/?ref=ABCD234567"


def test_build_referral_share_message_includes_display_name_and_url() -> None:
    message = build_referral_share_message(
        inviter_display_name="Anna",
        invite_url="https://app.eliteew.ru/mobile-app/?ref=ABCD234567",
    )
    assert "Anna" in message
    assert "https://app.eliteew.ru/mobile-app/?ref=ABCD234567" in message


@pytest.mark.asyncio
async def test_get_referral_invite_reuses_existing_code() -> None:
    user_id = str(uuid4())
    conn = _ReferralConn(
        user_row={"id": UUID(user_id), "username": "anna", "full_name": "Anna Test"},
        existing_code="ZXCV234567",
    )
    service = FriendsReferralService(_ReferralPool(conn))  # type: ignore[arg-type]

    payload = await service.get_referral_invite(user_id)

    assert payload["referral_code"] == "ZXCV234567"
    assert payload["inviter_display_name"] == "Anna Test"
    assert "ref=ZXCV234567" in payload["invite_url"]
    assert conn.execute_calls == []


@pytest.mark.asyncio
async def test_preview_referral_code_rejects_invalid_format() -> None:
    service = FriendsReferralService(_ReferralPool(_ReferralConn(user_row=None)))  # type: ignore[arg-type]

    with pytest.raises(ValueError, match="Некорректный реферальный код"):
        await service.preview_referral_code("bad-code")


@pytest.mark.asyncio
async def test_preview_referral_code_returns_bounded_public_fields() -> None:
    conn = _ReferralConn(
        user_row=None,
        preview_row={
            "id": uuid4(),
            "username": "anna",
            "full_name": "Anna Test",
            "referral_code": "ABCD234567",
        },
    )
    service = FriendsReferralService(_ReferralPool(conn))  # type: ignore[arg-type]

    payload = await service.preview_referral_code("abcd234567")

    assert payload["valid"] is True
    assert payload["referral_code"] == "ABCD234567"
    assert payload["inviter_display_name"] == "Anna Test"
    assert "ref=ABCD234567" in payload["invite_url"]
