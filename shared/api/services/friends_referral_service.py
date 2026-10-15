# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Stable per-user referral codes and invite URLs for Social Hub / MobileAndroid share flows.
# Invariants:
# - Referral codes are opaque, uppercase, and never embed raw user ids.
# - Preview responses expose display names only; no email or private profile fields.
# Related:
# - api/routers/friends.py
# - documentation/api/ANDROID-API-CONTRACTS.md
# ---

from __future__ import annotations

import logging
import secrets
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from uuid import UUID

import asyncpg  # type: ignore[import-not-found,import-untyped]

from api.core.unified_config import unified_settings

logger = logging.getLogger(__name__)

_REFERRAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
_REFERRAL_CODE_LENGTH = 10
_REFERRAL_QUERY_PARAM = "ref"


def _normalize_referral_code(raw: str) -> str:
    normalized = (raw or "").strip().upper()
    if len(normalized) != _REFERRAL_CODE_LENGTH:
        raise ValueError("Некорректный реферальный код")
    if any(ch not in _REFERRAL_ALPHABET for ch in normalized):
        raise ValueError("Некорректный реферальный код")
    return normalized


def _generate_referral_code() -> str:
    return "".join(secrets.choice(_REFERRAL_ALPHABET) for _ in range(_REFERRAL_CODE_LENGTH))


def _display_name_from_row(row: asyncpg.Record | dict | None) -> str:
    if not row:
        return "Пользователь EliteEW"
    full_name = (row.get("full_name") or "").strip()
    if full_name:
        return full_name
    username = (row.get("username") or "").strip()
    if username:
        return username
    return "Пользователь EliteEW"


def build_referral_invite_url(referral_code: str) -> str:
    base = (unified_settings.mobile_app_download_page_url or "https://app.eliteew.ru/mobile-app/").strip()
    if not base:
        base = "https://app.eliteew.ru/mobile-app/"
    parsed = urlparse(base)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query[_REFERRAL_QUERY_PARAM] = referral_code
    return urlunparse(parsed._replace(query=urlencode(query)))


def build_referral_share_message(*, inviter_display_name: str, invite_url: str) -> str:
    return (
        f"{inviter_display_name} приглашает вас в EliteEW. "
        f"Установите приложение и зарегистрируйтесь по ссылке: {invite_url}"
    )


class FriendsReferralService:
    def __init__(self, db_pool: asyncpg.Pool) -> None:
        self.db_pool = db_pool

    @staticmethod
    def _parse_user_uuid(user_id: str) -> UUID:
        try:
            return UUID(str(user_id).strip())
        except (ValueError, TypeError) as exc:
            raise ValueError("Некорректный пользователь") from exc

    async def _fetch_user_display_row(
        self,
        conn: asyncpg.Connection,
        user_id: UUID,
    ) -> asyncpg.Record | None:
        return await conn.fetchrow(
            """
            SELECT id, username, full_name
            FROM users
            WHERE id = $1
            """,
            user_id,
        )

    async def _insert_referral_code(
        self,
        conn: asyncpg.Connection,
        user_id: UUID,
    ) -> str:
        for _attempt in range(8):
            code = _generate_referral_code()
            try:
                await conn.execute(
                    """
                    INSERT INTO user_referral_codes (user_id, referral_code)
                    VALUES ($1, $2)
                    ON CONFLICT (user_id) DO NOTHING
                    """,
                    user_id,
                    code,
                )
            except asyncpg.UniqueViolationError:
                logger.debug("[STEP] friends_referral_code_collision code=%s attempt=%s", code, _attempt + 1)
                continue
            row = await conn.fetchrow(
                """
                SELECT referral_code
                FROM user_referral_codes
                WHERE user_id = $1
                """,
                user_id,
            )
            if row is not None:
                return str(row["referral_code"])
        raise RuntimeError("Не удалось выделить реферальный код")

    async def _get_or_create_referral_code_conn(
        self,
        conn: asyncpg.Connection,
        user_uuid: UUID,
    ) -> str:
        row = await conn.fetchrow(
            """
            SELECT referral_code
            FROM user_referral_codes
            WHERE user_id = $1
            """,
            user_uuid,
        )
        if row is not None:
            return str(row["referral_code"])
        return await self._insert_referral_code(conn, user_uuid)

    async def get_or_create_referral_code(self, user_id: str) -> str:
        user_uuid = self._parse_user_uuid(user_id)
        async with self.db_pool.acquire() as conn:
            return await self._get_or_create_referral_code_conn(conn, user_uuid)

    async def get_referral_invite(self, user_id: str) -> dict:
        user_uuid = self._parse_user_uuid(user_id)
        async with self.db_pool.acquire() as conn:
            user_row = await self._fetch_user_display_row(conn, user_uuid)
            if user_row is None:
                raise ValueError("Пользователь не найден")
            referral_code = await self._get_or_create_referral_code_conn(conn, user_uuid)
            inviter_display_name = _display_name_from_row(user_row)
            invite_url = build_referral_invite_url(referral_code)
            return {
                "referral_code": referral_code,
                "invite_url": invite_url,
                "inviter_display_name": inviter_display_name,
                "share_message": build_referral_share_message(
                    inviter_display_name=inviter_display_name,
                    invite_url=invite_url,
                ),
            }

    async def preview_referral_code(self, raw_code: str) -> dict:
        referral_code = _normalize_referral_code(raw_code)
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT u.id, u.username, u.full_name, c.referral_code
                FROM user_referral_codes c
                JOIN users u ON u.id = c.user_id
                WHERE c.referral_code = $1
                """,
                referral_code,
            )
            if row is None:
                raise ValueError("Реферальный код не найден")
            inviter_display_name = _display_name_from_row(row)
            invite_url = build_referral_invite_url(referral_code)
            return {
                "valid": True,
                "referral_code": referral_code,
                "inviter_display_name": inviter_display_name,
                "invite_url": invite_url,
            }
