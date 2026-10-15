# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# GAF Chat service: 1:1 chat/message persistence, server-side encryption, E2EE gates, and consent state.
# Invariants:
# - Ordinary chat stays default; E2EE sends require active mutual consent and trusted-device GAF keys.
# Related:
# - documentation/product/GAF-CHAT-BACKEND.md
# ---

"""
GAF Chat service: 1:1 chats and messages.
Uses only gaf_chats, gaf_messages, gaf_message_keys (and users for lookups).
Structured [GAF_CHAT] logs via structlog when available.
"""

from __future__ import annotations

import base64
import json
import logging
from typing import Any
from uuid import UUID, uuid4

import asyncpg  # type: ignore[import-not-found,import-untyped]

from api.gaf_chat.constants import (
    CONTENT_SUBTYPE_GAF_CHAT_VOICE,
    is_gaf_system_user_id,
    is_gaf_voice_upload_filename,
)
from api.gaf_chat.crypto import decrypt_body, encrypt_body
from api.gaf_chat.message_metadata import message_metadata_dict_from_db
from api.gaf_chat.schemas import GAF_DEFAULT_PAGE_LIMIT, GAF_MAX_PAGE_LIMIT
from api.schemas.unified_content import ContentCreate, ContentType, Visibility
from api.services.profile_privacy import (
    GAF_ANONYMOUS_VIEWER_ID,
    batch_viewer_circle_hits,
    privacy_from_joined_row,
    redact_profile_fields,
    search_discoverability_predicate,
)
from api.services.unified_content.audit_logger import AuditLogger
from api.services.unified_content.content_storage_service import ContentStorageService
from api.services.unified_content.share_service import ShareService

logger = logging.getLogger(__name__)
GAF_E2EE_GENERIC_PREVIEW = "Сообщение зашифровано (E2E)"
GAF_E2EE_STATUSES = {"off", "pending", "active", "declined"}

try:
    import structlog  # type: ignore[import-not-found]

    _gaf_structlog = structlog.get_logger(__name__)
except ImportError:
    _gaf_structlog = None


def _gaf_info(event: str, **kwargs: object) -> None:
    if _gaf_structlog is not None:
        _gaf_structlog.info(event, **kwargs)
    else:
        extra = " ".join(f"{k}={v!r}" for k, v in kwargs.items())
        logger.info("%s %s", event, extra.strip())


def _gaf_warning(event: str, **kwargs: object) -> None:
    if _gaf_structlog is not None:
        _gaf_structlog.warning(event, **kwargs)
    else:
        extra = " ".join(f"{k}={v!r}" for k, v in kwargs.items())
        logger.warning("%s %s", event, extra.strip())


def _gaf_error(event: str, **kwargs: object) -> None:
    if _gaf_structlog is not None:
        _gaf_structlog.error(event, **kwargs)
    else:
        extra = " ".join(f"{k}={v!r}" for k, v in kwargs.items())
        logger.error("%s %s", event, extra.strip())


# Subclass ValueError so FastAPI routers keep working with `except ValueError`.
class GafChatNotFoundError(ValueError):
    """Raised when chat row is missing (maps to 404 in router)."""


class GafChatForbiddenError(ValueError):
    """Raised when user is not a participant (maps to 403 in router)."""


class GafMessageNotFoundError(ValueError):
    """Raised when message row is missing or not in chat (maps to 404 in router)."""


class GafMessageAuthorError(ValueError):
    """Raised when only the author may perform the action (maps to 409 in router)."""


def _norm_uid(v: str) -> UUID:
    return UUID(str(v).strip())


class GafChatService:
    def __init__(self, db_pool: asyncpg.Pool) -> None:
        self.db_pool = db_pool

    @staticmethod
    def _attachment_fields_from_row(r: asyncpg.Record) -> dict:
        ac = r.get("attachment_content_id")
        ar = r.get("attachment_recipient_saved_id")
        sz = r.get("attachment_size")
        return {
            "attachment_content_id": str(ac) if ac else None,
            "attachment_mime_type": r.get("attachment_mime_type"),
            "attachment_name": r.get("attachment_name"),
            "attachment_size": int(sz) if sz is not None else None,
            "attachment_recipient_saved_id": str(ar) if ar else None,
        }

    async def _assert_chat_interaction_allowed(
        self,
        current_user_id: str,
        other_user_id: str,
        *,
        action_label: str,
    ) -> None:
        if is_gaf_system_user_id(current_user_id) or is_gaf_system_user_id(other_user_id):
            return
        from api.services.friends_service import FriendsService

        await FriendsService(self.db_pool).assert_can_interact(
            current_user_id,
            other_user_id,
            action_label=action_label,
        )

    async def _finalize_existing_chat_row(
        self, conn: asyncpg.Connection, row: asyncpg.Record, initiating_user_id: str
    ) -> dict:
        """Normalize archive flag for the initiating user and return list/get_or_create-shaped dict."""
        rd = dict(row)
        archived_col = self._archive_column(rd, initiating_user_id)
        if rd.get(archived_col):
            await conn.execute(
                f"UPDATE gaf_chats SET {archived_col} = NULL, updated_at = NOW() WHERE id = $1",
                rd["id"],
            )
        _gaf_info("[GAF_CHAT] get_or_create_chat found", chat_id=str(rd["id"]))
        out = dict(rd)
        out["created"] = False
        return out

    async def get_or_create_chat(self, user_id_1: str, user_id_2: str) -> dict:
        """Get existing 1:1 chat or create. Returns chat row with id, user_id_1, user_id_2, created_at, etc."""
        u1, u2 = _norm_uid(user_id_1), _norm_uid(user_id_2)
        if u1 == u2:
            raise ValueError("Cannot create chat with yourself")
        await self._assert_chat_interaction_allowed(user_id_1, user_id_2, action_label="начать чат")
        low, high = (u1, u2) if u1 < u2 else (u2, u1)
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                -- Pair lookup: canonical order via LEAST/GREATEST matches unique index idx_gaf_chats_unique_pair.
                SELECT id, user_id_1, user_id_2, created_at, updated_at, last_message_at,
                       archived_at_user_1, archived_at_user_2,
                       e2ee_status, e2ee_requested_by_user_id,
                       e2ee_user_1_consented_at, e2ee_user_2_consented_at,
                       e2ee_activated_at, e2ee_declined_at, e2ee_disabled_at, e2ee_updated_at
                FROM gaf_chats
                WHERE LEAST(user_id_1, user_id_2) = $1 AND GREATEST(user_id_1, user_id_2) = $2
                """,
                low,
                high,
            )
            if row:
                return await self._finalize_existing_chat_row(conn, row, user_id_1)
            chat_id = uuid4()
            try:
                await conn.execute(
                    """
                    INSERT INTO gaf_chats (id, user_id_1, user_id_2, created_at, updated_at)
                    VALUES ($1, $2, $3, NOW(), NOW())
                    """,
                    chat_id,
                    u1,
                    u2,
                )
            except asyncpg.exceptions.UniqueViolationError:
                # Concurrent get_or_create: unique index on (LEAST, GREATEST) — re-read winner row.
                _gaf_warning(
                    "[GAF_CHAT] get_or_create_chat unique_race_retry",
                    low=str(low),
                    high=str(high),
                )
                row = await conn.fetchrow(
                    """
                    SELECT id, user_id_1, user_id_2, created_at, updated_at, last_message_at,
                           archived_at_user_1, archived_at_user_2,
                           e2ee_status, e2ee_requested_by_user_id,
                           e2ee_user_1_consented_at, e2ee_user_2_consented_at,
                           e2ee_activated_at, e2ee_declined_at, e2ee_disabled_at, e2ee_updated_at
                    FROM gaf_chats
                    WHERE LEAST(user_id_1, user_id_2) = $1 AND GREATEST(user_id_1, user_id_2) = $2
                    """,
                    low,
                    high,
                )
                if row:
                    return await self._finalize_existing_chat_row(conn, row, user_id_1)
                _gaf_error("[GAF_CHAT] get_or_create_chat race_retry_missing_row", low=str(low), high=str(high))
                raise GafChatNotFoundError("Chat not found") from None

            _gaf_info(
                "[GAF_CHAT] get_or_create_chat created", chat_id=str(chat_id), user_id_1=str(u1), user_id_2=str(u2)
            )
            return {
                "id": chat_id,
                "user_id_1": u1,
                "user_id_2": u2,
                "created_at": None,
                "updated_at": None,
                "last_message_at": None,
                "created": True,
                "e2ee_status": "off",
                "e2ee_requested_by_user_id": None,
                "e2ee_user_1_consented_at": None,
                "e2ee_user_2_consented_at": None,
                "e2ee_activated_at": None,
                "e2ee_declined_at": None,
                "e2ee_disabled_at": None,
                "e2ee_updated_at": None,
            }

    def _is_participant(self, chat: dict, user_id: str) -> bool:
        u = str(user_id).strip()
        return str(chat.get("user_id_1")) == u or str(chat.get("user_id_2")) == u

    def _other_user_id(self, chat: dict, current_user_id: str) -> str:
        u = str(current_user_id).strip()
        u1, u2 = str(chat["user_id_1"]), str(chat["user_id_2"])
        return u2 if u == u1 else u1

    def _last_read_column(self, chat: dict, current_user_id: str) -> str:
        u = str(current_user_id).strip()
        return "last_read_message_id_user_1" if str(chat["user_id_1"]) == u else "last_read_message_id_user_2"

    def _archive_column(self, chat: dict, current_user_id: str) -> str:
        u = str(current_user_id).strip()
        return "archived_at_user_1" if str(chat["user_id_1"]) == u else "archived_at_user_2"

    def _message_position_key(self, row: asyncpg.Record | dict) -> tuple:
        return (row["created_at"], str(row["id"]))

    def _message_hidden_for_user(self, row: asyncpg.Record | dict, current_user_id: str) -> bool:
        current = str(current_user_id).strip()
        is_sender = str(row["sender_id"]) == current
        return bool(row["deleted_for_sender"] if is_sender else row["deleted_for_recipient"])

    def _message_deleted_for_everyone(self, row: asyncpg.Record | dict) -> bool:
        return bool(row.get("deleted_at")) and bool(row["deleted_for_sender"]) and bool(row["deleted_for_recipient"])

    async def get_chat_or_403(self, chat_id: str, current_user_id: str) -> dict:
        """Return chat row or raise (caller maps to 403/404)."""
        cid = _norm_uid(chat_id)
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, user_id_1, user_id_2, created_at, updated_at, last_message_at,
                       last_read_message_id_user_1, last_read_message_id_user_2,
                       archived_at_user_1, archived_at_user_2,
                       e2ee_status, e2ee_requested_by_user_id,
                       e2ee_user_1_consented_at, e2ee_user_2_consented_at,
                       e2ee_activated_at, e2ee_declined_at, e2ee_disabled_at, e2ee_updated_at
                FROM gaf_chats
                WHERE id = $1
                """,
                cid,
            )
        if not row:
            raise GafChatNotFoundError("Chat not found")
        chat = dict(row)
        if not self._is_participant(chat, current_user_id):
            _gaf_warning(
                "[GAF_CHAT] access_denied_not_participant",
                chat_id=str(cid),
                user_id=str(current_user_id).strip(),
            )
            raise GafChatForbiddenError("Not a participant")
        return chat

    async def list_chats(self, current_user_id: str) -> list[dict]:
        """List chats: one query for chats+preview, batched last_read + partner rows, then per-chat unread count."""
        uid = _norm_uid(current_user_id)
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                -- One row per chat for this user; subquery picks last visible message for preview.
                -- Prefer index on gaf_messages (chat_id, created_at DESC) for the correlated subquery.
                SELECT c.id AS chat_id,
                       c.user_id_1,
                       c.user_id_2,
                       c.last_message_at,
                       c.last_read_message_id_user_1,
                       c.last_read_message_id_user_2,
                       c.archived_at_user_1,
                       c.archived_at_user_2,
                       c.e2ee_status,
                       c.e2ee_requested_by_user_id,
                       (SELECT CASE
                                   WHEN m.deleted_at IS NOT NULL
                                        AND m.deleted_for_sender = TRUE
                                        AND m.deleted_for_recipient = TRUE
                                   THEN 'Сообщение удалено'
                                   ELSE m.body_plain_preview
                               END
                        FROM gaf_messages m
                        WHERE m.chat_id = c.id
                          AND (
                              (m.deleted_at IS NOT NULL AND m.deleted_for_sender = TRUE AND m.deleted_for_recipient = TRUE)
                              OR (m.sender_id = $1 AND m.deleted_for_sender = FALSE)
                              OR (m.sender_id <> $1 AND m.deleted_for_recipient = FALSE)
                          )
                        ORDER BY m.created_at DESC LIMIT 1) AS last_message_preview
                FROM gaf_chats c
                -- Filter matches btree on (user_id_1) / (user_id_2) or composite covering participant rows.
                WHERE c.user_id_1 = $1 OR c.user_id_2 = $1
                ORDER BY c.last_message_at DESC NULLS LAST
                """,
                uid,
            )
            if not rows:
                return []

            visible: list[dict] = []
            for r in rows:
                chat_id = str(r["chat_id"])
                is_user_1 = str(r["user_id_1"]) == str(uid)
                archived_col = "archived_at_user_1" if is_user_1 else "archived_at_user_2"
                if r.get(archived_col):
                    continue
                partner_id = str(r["user_id_2"]) if is_user_1 else str(r["user_id_1"])
                last_read = r["last_read_message_id_user_1"] if is_user_1 else r["last_read_message_id_user_2"]
                visible.append(
                    {
                        "row": r,
                        "chat_id": chat_id,
                        "chat_uuid": r["chat_id"],
                        "partner_id": partner_id,
                        "last_read": last_read,
                    }
                )

            if not visible:
                return []

            msg_ids: list[UUID] = []
            chat_uuids: list[UUID] = []
            for item in visible:
                lr = item["last_read"]
                if lr:
                    msg_ids.append(_norm_uid(str(lr)))
                    chat_uuids.append(item["chat_uuid"])

            last_read_by_pair: dict[tuple[UUID, UUID], asyncpg.Record] = {}
            if msg_ids:
                lr_rows = await conn.fetch(
                    """
                    -- Batch resolve watermarks; same semantics as per-row id+chat_id lookup.
                    SELECT m.id, m.chat_id, m.created_at
                    FROM gaf_messages m
                    INNER JOIN unnest($1::uuid[], $2::uuid[]) AS x(message_id, chat_uuid)
                      ON m.id = x.message_id AND m.chat_id = x.chat_uuid
                    """,
                    msg_ids,
                    chat_uuids,
                )
                last_read_by_pair = {(row["id"], row["chat_id"]): row for row in lr_rows}

            partner_ids = list({_norm_uid(item["partner_id"]) for item in visible})
            partner_rows = await conn.fetch(
                """
                SELECT
                    u.id,
                    u.username,
                    u.avatar_url,
                    u.full_name,
                    u.bio,
                    (upp.user_id IS NOT NULL) AS privacy_join_present,
                    upp.discoverability,
                    upp.avatar_visibility,
                    upp.avatar_circle_id,
                    upp.full_name_visibility,
                    upp.full_name_circle_id,
                    upp.bio_visibility,
                    upp.bio_circle_id,
                    COALESCE(u.is_trusted, FALSE) AS is_trusted,
                    NULLIF(BTRIM(COALESCE(u.admin_badge_label, '')), '') AS admin_badge_label,
                    NULLIF(BTRIM(COALESCE(u.admin_badge_hint, '')), '') AS admin_badge_hint,
                    COALESCE(u.is_system_account, FALSE) AS is_system_account,
                    (current_f.user_id IS NOT NULL) AS is_friend,
                    COALESCE(current_f.is_muted, FALSE) AS is_muted,
                    COALESCE(current_f.is_blocked, FALSE) AS is_blocked,
                    COALESCE(reverse_f.is_blocked, FALSE) AS blocked_by_partner
                FROM users u
                LEFT JOIN user_profile_privacy upp ON upp.user_id = u.id
                LEFT JOIN friendships current_f
                  ON current_f.user_id = $1
                 AND current_f.friend_id = u.id
                LEFT JOIN friendships reverse_f
                  ON reverse_f.user_id = u.id
                 AND reverse_f.friend_id = $1
                WHERE u.id = ANY($2::uuid[])
                """,
                uid,
                partner_ids,
            )
            partner_by_id = {row["id"]: row for row in partner_rows}

            circle_pairs: list[tuple[UUID, UUID]] = []
            for prow in partner_rows:
                priv = privacy_from_joined_row(prow)
                sid = prow["id"]
                for key_vis, key_c in (
                    ("avatar_visibility", "avatar_circle_id"),
                    ("full_name_visibility", "full_name_circle_id"),
                    ("bio_visibility", "bio_circle_id"),
                ):
                    if str(priv.get(key_vis) or "").lower() == "circle":
                        cid = priv.get(key_c)
                        if cid is not None:
                            circle_pairs.append((UUID(str(cid)), sid))
            circle_hits = await batch_viewer_circle_hits(conn, viewer_user_id=uid, pairs=circle_pairs)
            partner_redacted: dict[UUID, tuple[str | None, str | None, str | None]] = {}
            for prow in partner_rows:
                sid = prow["id"]
                priv = privacy_from_joined_row(prow)
                is_friend = bool(prow["is_friend"])
                av, fn, bio = redact_profile_fields(
                    subject_id=sid,
                    viewer_id=uid,
                    is_friend=is_friend,
                    privacy=priv,
                    avatar_url=prow["avatar_url"],
                    full_name=prow["full_name"],
                    bio=prow["bio"],
                    circle_hits=circle_hits,
                )
                partner_redacted[sid] = (av, fn, bio)

            unread_chat_ids: list[UUID] = []
            unread_wm_ts: list[object] = []
            unread_wm_id: list[str] = []
            stale_last_reads: list[tuple[str, str]] = []
            for item in visible:
                last_read = item["last_read"]
                last_read_row = None
                if last_read:
                    lr_uuid = _norm_uid(str(last_read))
                    last_read_row = last_read_by_pair.get((lr_uuid, item["chat_uuid"]))
                    if last_read_row is None:
                        stale_last_reads.append((item["chat_id"], str(last_read)))
                unread_chat_ids.append(item["chat_uuid"])
                if last_read_row is not None:
                    unread_wm_ts.append(last_read_row["created_at"])
                    unread_wm_id.append(str(last_read_row["id"]))
                else:
                    unread_wm_ts.append(None)
                    unread_wm_id.append("")

            for chat_id_str, lr_id_str in stale_last_reads:
                _gaf_warning(
                    "[GAF_CHAT] list_chats stale_last_read_ignored",
                    chat_id=chat_id_str,
                    user_id=str(uid),
                    last_read_id=lr_id_str,
                )

            unread_rows = await conn.fetch(
                """
                -- One round-trip: unread per chat (same predicate as former per-chat fetchrow).
                SELECT x.chat_id AS chat_id, COALESCE(u.cnt, 0)::bigint AS cnt
                FROM unnest($1::uuid[], $2::timestamptz[], $3::text[]) AS x(chat_id, wm_ts, wm_id)
                LEFT JOIN LATERAL (
                    SELECT COUNT(*)::bigint AS cnt
                    FROM gaf_messages m
                    WHERE m.chat_id = x.chat_id
                      AND m.sender_id <> $4
                      AND m.deleted_for_recipient = FALSE
                      AND (
                          x.wm_ts IS NULL
                          OR m.created_at > x.wm_ts
                          OR (m.created_at = x.wm_ts AND m.id::text > x.wm_id)
                      )
                ) u ON TRUE
                """,
                unread_chat_ids,
                unread_wm_ts,
                unread_wm_id,
                uid,
            )
            unread_by_chat: dict[UUID, int] = {row["chat_id"]: int(row["cnt"]) for row in unread_rows}

            result = []
            for item in visible:
                r = item["row"]
                chat_id = item["chat_id"]
                partner_id = item["partner_id"]
                is_user_1 = str(r["user_id_1"]) == str(uid)
                unread = unread_by_chat.get(item["chat_uuid"], 0)
                partner_uuid = _norm_uid(partner_id)
                partner_row = partner_by_id.get(partner_uuid)
                if partner_row:
                    pr = partner_row
                    sid_key = pr["id"]
                    av_fn_bio = partner_redacted.get(
                        sid_key,
                        (pr["avatar_url"], pr["full_name"], pr["bio"]),
                    )
                    partner = {
                        "id": str(pr["id"]),
                        "username": pr["username"],
                        "avatar_url": av_fn_bio[0],
                        "full_name": av_fn_bio[1],
                        "bio": av_fn_bio[2],
                        "is_trusted": bool(pr.get("is_trusted")),
                        "admin_badge_label": pr.get("admin_badge_label"),
                        "admin_badge_hint": pr.get("admin_badge_hint"),
                        "is_system_account": bool(pr.get("is_system_account")),
                        "is_muted": bool(pr["is_muted"]),
                        "is_blocked": bool(pr["is_blocked"]),
                        "blocked_by_partner": bool(pr["blocked_by_partner"]),
                    }
                else:
                    partner = {
                        "id": partner_id,
                        "username": None,
                        "avatar_url": None,
                        "full_name": None,
                        "bio": None,
                        "is_trusted": False,
                        "admin_badge_label": None,
                        "admin_badge_hint": None,
                        "is_system_account": False,
                        "is_muted": False,
                        "is_blocked": False,
                        "blocked_by_partner": False,
                    }
                partner_last_read = r["last_read_message_id_user_2"] if is_user_1 else r["last_read_message_id_user_1"]
                result.append(
                    {
                        "chat_id": chat_id,
                        "partner": partner,
                        "last_message_at": r["last_message_at"].isoformat() if r["last_message_at"] else None,
                        "last_message_preview": r["last_message_preview"],
                        "unread_count": unread,
                        "partner_last_read_message_id": str(partner_last_read) if partner_last_read else None,
                        "e2ee_status": r.get("e2ee_status") or "off",
                        "e2ee_requested_by_user_id": (
                            str(r["e2ee_requested_by_user_id"]) if r.get("e2ee_requested_by_user_id") else None
                        ),
                        "e2ee_ready": await self._chat_participants_have_active_gaf_keys(conn, dict(r)),
                    }
                )
            return result

    async def partner_chat_card_for_viewer(self, viewer_id: str, partner_user_id: str) -> dict:
        """ChatPartner-shaped dict with privacy-redacted avatar, full_name, bio (for by-username response)."""
        uid = _norm_uid(viewer_id)
        pid = _norm_uid(partner_user_id)
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT
                    u.id,
                    u.username,
                    u.avatar_url,
                    u.full_name,
                    u.bio,
                    (upp.user_id IS NOT NULL) AS privacy_join_present,
                    upp.discoverability,
                    upp.avatar_visibility,
                    upp.avatar_circle_id,
                    upp.full_name_visibility,
                    upp.full_name_circle_id,
                    upp.bio_visibility,
                    upp.bio_circle_id,
                    COALESCE(u.is_trusted, FALSE) AS is_trusted,
                    NULLIF(BTRIM(COALESCE(u.admin_badge_label, '')), '') AS admin_badge_label,
                    NULLIF(BTRIM(COALESCE(u.admin_badge_hint, '')), '') AS admin_badge_hint,
                    COALESCE(u.is_system_account, FALSE) AS is_system_account,
                    (current_f.user_id IS NOT NULL) AS is_friend,
                    COALESCE(current_f.is_muted, FALSE) AS is_muted,
                    COALESCE(current_f.is_blocked, FALSE) AS is_blocked,
                    COALESCE(reverse_f.is_blocked, FALSE) AS blocked_by_partner
                FROM users u
                LEFT JOIN user_profile_privacy upp ON upp.user_id = u.id
                LEFT JOIN friendships current_f
                  ON current_f.user_id = $1
                 AND current_f.friend_id = u.id
                LEFT JOIN friendships reverse_f
                  ON reverse_f.user_id = u.id
                 AND reverse_f.friend_id = $1
                WHERE u.id = $2
                """,
                uid,
                pid,
            )
            if row is None:
                raise ValueError("User not found")
            priv = privacy_from_joined_row(row)
            sid = row["id"]
            circle_pairs: list[tuple[UUID, UUID]] = []
            for key_vis, key_c in (
                ("avatar_visibility", "avatar_circle_id"),
                ("full_name_visibility", "full_name_circle_id"),
                ("bio_visibility", "bio_circle_id"),
            ):
                if str(priv.get(key_vis) or "").lower() == "circle":
                    cid = priv.get(key_c)
                    if cid is not None:
                        circle_pairs.append((UUID(str(cid)), sid))
            circle_hits = await batch_viewer_circle_hits(conn, viewer_user_id=uid, pairs=circle_pairs)
            av, fn, bio = redact_profile_fields(
                subject_id=sid,
                viewer_id=uid,
                is_friend=bool(row["is_friend"]),
                privacy=priv,
                avatar_url=row["avatar_url"],
                full_name=row["full_name"],
                bio=row["bio"],
                circle_hits=circle_hits,
            )
        return {
            "id": str(row["id"]),
            "username": row["username"],
            "avatar_url": av,
            "full_name": fn,
            "bio": bio,
            "is_trusted": bool(row.get("is_trusted")),
            "admin_badge_label": row.get("admin_badge_label"),
            "admin_badge_hint": row.get("admin_badge_hint"),
            "is_system_account": bool(row.get("is_system_account")),
            "is_muted": bool(row["is_muted"]),
            "is_blocked": bool(row["is_blocked"]),
            "blocked_by_partner": bool(row["blocked_by_partner"]),
        }

    async def list_messages(
        self,
        chat_id: str,
        current_user_id: str,
        limit: int = GAF_DEFAULT_PAGE_LIMIT,
        before: str | None = None,
        after: str | None = None,
    ) -> list[dict]:
        """Cursor-based list; before/after are message id; returns messages (body decrypted/plain for participant)."""
        await self.get_chat_or_403(chat_id, current_user_id)
        cid = _norm_uid(chat_id)
        _norm_uid(current_user_id)
        limit = min(max(1, limit), GAF_MAX_PAGE_LIMIT)
        async with self.db_pool.acquire() as conn:
            if after:
                rows = await conn.fetch(
                    """
                    -- Anchor scoped to chat_id so a foreign message id cannot leak another chat's cursor.
                    SELECT id, chat_id, sender_id, body_ciphertext, nonce, algorithm, created_at, edited_at,
                           deleted_at, deleted_for_sender, deleted_for_recipient, encryption_version,
                           attachment_content_id, attachment_mime_type, attachment_name, attachment_size,
                           attachment_recipient_saved_id, metadata, reply_to_message_id
                    FROM gaf_messages
                    WHERE chat_id = $1
                      AND created_at > (SELECT m.created_at FROM gaf_messages m WHERE m.id = $2 AND m.chat_id = $1)
                    ORDER BY created_at ASC LIMIT $3
                    """,
                    cid,
                    _norm_uid(after),
                    limit,
                )
            elif before:
                rows = await conn.fetch(
                    """
                    SELECT id, chat_id, sender_id, body_ciphertext, nonce, algorithm, created_at, edited_at,
                           deleted_at, deleted_for_sender, deleted_for_recipient, encryption_version,
                           attachment_content_id, attachment_mime_type, attachment_name, attachment_size,
                           attachment_recipient_saved_id, metadata, reply_to_message_id
                    FROM gaf_messages
                    WHERE chat_id = $1
                      AND created_at < (SELECT m.created_at FROM gaf_messages m WHERE m.id = $2 AND m.chat_id = $1)
                    ORDER BY created_at DESC LIMIT $3
                    """,
                    cid,
                    _norm_uid(before),
                    limit,
                )
            else:
                rows = await conn.fetch(
                    """
                    SELECT id, chat_id, sender_id, body_ciphertext, nonce, algorithm, created_at, edited_at,
                           deleted_at, deleted_for_sender, deleted_for_recipient, encryption_version,
                           attachment_content_id, attachment_mime_type, attachment_name, attachment_size,
                           attachment_recipient_saved_id, metadata, reply_to_message_id
                    FROM gaf_messages
                    WHERE chat_id = $1
                    ORDER BY created_at DESC LIMIT $2
                    """,
                    cid,
                    limit,
                )
            uid_viewer = _norm_uid(current_user_id)
            e2e_message_ids = [r["id"] for r in rows if (r.get("algorithm") or "").startswith("e2e_")]
            key_by_message: dict[str, str] = {}
            if e2e_message_ids:
                key_rows = await conn.fetch(
                    """
                    SELECT message_id::text AS message_id, encrypted_key_payload
                    FROM gaf_message_keys
                    WHERE chat_id = $1 AND user_id = $2 AND message_id = ANY($3::uuid[])
                    """,
                    cid,
                    uid_viewer,
                    e2e_message_ids,
                )
                key_by_message = {str(row["message_id"]): row["encrypted_key_payload"] for row in key_rows}
        out = []
        for r in rows:
            if self._message_deleted_for_everyone(r):
                body = "[deleted]"
            elif self._message_hidden_for_user(r, current_user_id):
                continue
            else:
                # Для E2E сообщений сервер не умеет расшифровывать тело — клиент
                # сам выполняет расшифровку по ciphertext/nonce/algorithm.
                if (r["algorithm"] or "").startswith("e2e_"):
                    body = "[encrypted]"
                else:
                    body = decrypt_body(
                        r["body_ciphertext"] or "",
                        r.get("nonce") or b"",
                        r["algorithm"] or "plain",
                    )
            meta_raw = r.get("metadata")
            meta_out = message_metadata_dict_from_db(meta_raw)
            rid = r.get("reply_to_message_id")
            out.append(
                {
                    "id": str(r["id"]),
                    "chat_id": str(r["chat_id"]),
                    "sender_id": str(r["sender_id"]),
                    "body": body,
                    "created_at": r["created_at"].isoformat() if r["created_at"] else "",
                    "edited_at": r["edited_at"].isoformat() if r["edited_at"] else None,
                    "deleted_for_sender": r["deleted_for_sender"],
                    "deleted_for_recipient": r["deleted_for_recipient"],
                    "algorithm": r.get("algorithm"),
                    "encryption_version": r.get("encryption_version"),
                    "body_ciphertext": r.get("body_ciphertext"),
                    "nonce": base64.b64encode(r["nonce"]).decode("ascii") if r.get("nonce") else None,
                    **GafChatService._attachment_fields_from_row(r),
                    "metadata": meta_out,
                    "reply_to_message_id": str(rid) if rid is not None else None,
                    "e2ee_session_key_envelope": key_by_message.get(str(r["id"])),
                }
            )
        if before:
            out.reverse()
        return out

    async def get_message_key_envelope_for_viewer(
        self,
        chat_id: str,
        message_id: str,
        viewer_user_id: str,
    ) -> str | None:
        """Return RSA-wrapped session key for one viewer and message, if stored."""
        cid = _norm_uid(chat_id)
        mid = _norm_uid(message_id)
        uid = _norm_uid(viewer_user_id)
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT encrypted_key_payload
                FROM gaf_message_keys
                WHERE chat_id = $1 AND message_id = $2 AND user_id = $3
                ORDER BY created_at DESC
                LIMIT 1
                """,
                cid,
                mid,
                uid,
            )
        if not row:
            return None
        payload = row.get("encrypted_key_payload")
        return str(payload) if payload else None

    async def _share_gaf_attachment_with_recipient(
        self,
        content_id: UUID,
        sender_id: str,
        recipient_id: str,
    ) -> None:
        """Grant recipient VIEW on sender's unified_content so preview/download/thumbnail work."""
        if is_gaf_system_user_id(sender_id) or is_gaf_system_user_id(recipient_id):
            return
        # ShareService requires AuditLogger; create_share() also blocks project-scoped files
        # when the partner is not a project member — use ensure_gaf_partner_view_share instead.
        share_service = ShareService(self.db_pool, AuditLogger(self.db_pool))
        await share_service.ensure_gaf_partner_view_share(
            content_id,
            str(sender_id),
            str(recipient_id),
        )

    async def _load_sender_attachment_meta(
        self, sender_id: str, content_id: str
    ) -> tuple[UUID, str, str | None, int | None]:
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, user_id, name, mime_type, original_filename, file_size
                FROM unified_content
                WHERE id = $1 AND deleted_at IS NULL
                """,
                _norm_uid(content_id),
            )
        if not row:
            raise ValueError("Файл не найден")
        if str(row["user_id"]) != str(_norm_uid(sender_id)):
            raise ValueError("Файл не принадлежит отправителю")
        display_name = (row["original_filename"] or row["name"] or "file").strip() or "file"
        fs = row["file_size"]
        return row["id"], display_name, row["mime_type"], int(fs) if fs is not None else None

    async def send_message(
        self,
        chat_id: str,
        sender_id: str,
        body: str | None,
        *,
        e2e_ciphertext: str | None = None,
        e2e_nonce: str | None = None,
        e2e_algorithm: str | None = None,
        e2e_encryption_version: str | None = None,
        e2e_session_key_for_recipient: str | None = None,
        e2e_session_key_for_self: str | None = None,
        attachment_content_id: str | None = None,
        metadata: dict[str, Any] | None = None,
        reply_to_message_id: str | None = None,
        allow_admin_desktop_app_link_metadata: bool = False,
    ) -> dict:
        """
        Append message.

        - Обычный режим (фаза 1): body передаётся в открытом виде, шифруется на сервере и хранится в body_ciphertext.
        - E2E‑режим: сервер получает уже зашифрованное тело (e2e_ciphertext, e2e_nonce, e2e_*) и НЕ умеет его расшифровать.
          В БД пишется только ciphertext; тело для ответа клиенту строится на стороне клиента.
        - Опционально: ``attachment_content_id`` — unified_content отправителя (файл из контент-менеджера или после upload).
        """
        chat = await self.get_chat_or_403(chat_id, sender_id)
        await self._assert_chat_interaction_allowed(
            sender_id,
            self._other_user_id(chat, sender_id),
            action_label="отправить сообщение",
        )
        cid = _norm_uid(chat_id)
        uid = _norm_uid(sender_id)

        body_plain = (body or "").strip() if body is not None else ""
        is_e2e = bool(e2e_ciphertext)
        e2ee_status = str(chat.get("e2ee_status") or "off")
        att_uuid: UUID | None = None
        att_name: str | None = None
        att_mime: str | None = None
        att_size: int | None = None

        if attachment_content_id and str(attachment_content_id).strip():
            att_uuid, att_name, att_mime, att_size = await self._load_sender_attachment_meta(
                sender_id, attachment_content_id.strip()
            )

        if not is_e2e and not body_plain and not att_uuid:
            raise ValueError("Body is required")
        if is_e2e and body_plain:
            raise ValueError("Plaintext body is not allowed for E2E messages")

        if metadata is not None:
            if is_e2e:
                raise ValueError("metadata is not supported for E2E messages")
            if att_uuid:
                raise ValueError("metadata is not supported with attachments")
            if not is_gaf_system_user_id(sender_id):
                admin_link_ok = allow_admin_desktop_app_link_metadata and metadata.get("kind") == "desktop_app_link"
                if not admin_link_ok:
                    raise ValueError("metadata is only allowed for system GAF messages")

        if is_e2e:
            # E2E: preview is user-visible metadata only (no plaintext); avoid emoji in stored fields.
            preview = GAF_E2EE_GENERIC_PREVIEW
            body_cipher = e2e_ciphertext or ""
            algo = e2e_algorithm or "e2e_v1"
            ver = e2e_encryption_version or "e2e_v1"
            nonce_bytes = base64.b64decode(e2e_nonce) if e2e_nonce else None
        else:
            if body_plain:
                preview = body_plain[:200] if len(body_plain) > 200 else body_plain
            elif att_name:
                preview = f"Файл: {att_name}"
                if len(preview) > 200:
                    preview = preview[:200]
            else:
                preview = ""
            body_cipher, nonce_b64, algo, ver = encrypt_body(body_plain)
            nonce_bytes = base64.b64decode(nonce_b64) if nonce_b64 else None

        msg_id = uuid4()
        # asyncpg + ::jsonb: bind JSON as string (dict must not be passed raw; see companies._pg_jsonb_str).
        metadata_for_pg: str | None = (
            None if metadata is None else json.dumps(metadata, ensure_ascii=False, default=str)
        )

        reply_to_uuid: UUID | None = None
        if reply_to_message_id and str(reply_to_message_id).strip():
            if metadata is not None:
                raise ValueError("Ответ на сообщение недоступен для служебных сообщений с metadata")
            reply_to_uuid = _norm_uid(str(reply_to_message_id).strip())

        async with self.db_pool.acquire() as conn:
            e2ee_auto_suspended = False
            if e2ee_status == "active" and not await self._chat_participants_have_active_gaf_keys(conn, chat):
                await self._disable_e2ee_in_conn(conn, cid)
                e2ee_status = "off"
                chat["e2ee_status"] = "off"
                e2ee_auto_suspended = True
                _gaf_info(
                    "[GAF_CHAT] e2ee_auto_suspended",
                    chat_id=chat_id,
                    reason="trusted_device_lost",
                    user_id=sender_id,
                )
                await self._emit_e2ee_consent_changed_for_chat(
                    conn,
                    chat_id,
                    chat,
                    actor_user_id=sender_id,
                    suspend_reason="trusted_device_lost",
                )

            if is_e2e and e2ee_status != "active":
                if e2ee_auto_suspended:
                    raise ValueError(
                        "E2EE was suspended because trusted device binding is unavailable. "
                        "Send again as a normal message."
                    )
                raise ValueError("E2EE is not active for this chat")
            if not is_e2e and e2ee_status == "active":
                raise ValueError("Plain messages are disabled while E2EE is active")

            if reply_to_uuid is not None:
                rx = await conn.fetchrow(
                    """
                    SELECT id FROM gaf_messages
                    WHERE id = $1 AND chat_id = $2
                    """,
                    reply_to_uuid,
                    cid,
                )
                if not rx:
                    raise ValueError("Сообщение для ответа не найдено в этом чате")

            row = await conn.fetchrow(
                """
                INSERT INTO gaf_messages (
                    id, chat_id, sender_id, body_ciphertext, body_plain_preview, nonce, algorithm, encryption_version, created_at,
                    attachment_content_id, attachment_mime_type, attachment_name, attachment_size,
                    reply_to_message_id,
                    metadata
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10, $11, $12, $13, $14::jsonb)
                RETURNING id, created_at
                """,
                msg_id,
                cid,
                uid,
                body_cipher,
                preview,
                nonce_bytes,
                algo,
                ver,
                att_uuid,
                att_mime,
                att_name,
                att_size,
                reply_to_uuid,
                metadata_for_pg,
            )
            if row is None:
                _gaf_error(
                    "[GAF_CHAT] send_message insert_returning_empty",
                    chat_id=chat_id,
                    message_id=str(msg_id),
                    user_id=sender_id,
                )
                raise ValueError("Failed to save message")

            await conn.execute(
                """
                UPDATE gaf_chats
                SET updated_at = NOW(),
                    last_message_at = NOW(),
                    archived_at_user_1 = NULL,
                    archived_at_user_2 = NULL
                WHERE id = $1
                """,
                cid,
            )

            # Если клиент прислал зашифрованный сессионный ключ для получателя — сохраним его
            if is_e2e and e2e_session_key_for_recipient:
                other_id = UUID(self._other_user_id(chat, sender_id))
                await conn.execute(
                    """
                    INSERT INTO gaf_message_keys (chat_id, message_id, user_id, encrypted_key_payload)
                    VALUES ($1, $2, $3, $4)
                    """,
                    cid,
                    msg_id,
                    other_id,
                    e2e_session_key_for_recipient,
                )
            if is_e2e and e2e_session_key_for_self:
                await conn.execute(
                    """
                    INSERT INTO gaf_message_keys (chat_id, message_id, user_id, encrypted_key_payload)
                    VALUES ($1, $2, $3, $4)
                    """,
                    cid,
                    msg_id,
                    uid,
                    e2e_session_key_for_self,
                )

        if att_uuid:
            try:
                other_uid = str(self._other_user_id(chat, sender_id))
                await self._share_gaf_attachment_with_recipient(att_uuid, str(uid), other_uid)
            except Exception as exc:  # noqa: BLE001
                _gaf_error(
                    "[GAF_CHAT] share_attachment_unexpected",
                    content_id=str(att_uuid),
                    chat_id=chat_id,
                    error=str(exc),
                )

        _gaf_info(
            "[GAF_CHAT] send_message",
            chat_id=chat_id,
            message_id=str(msg_id),
            user_id=sender_id,
            e2e=is_e2e,
        )
        created_at = row["created_at"].isoformat() if row and row.get("created_at") else ""
        # В E2E режиме сервер не знает plaintext; клиент сам подставит body.
        response_body = body_plain if not is_e2e else "[encrypted]"
        sender_envelope: str | None = None
        if is_e2e:
            sender_envelope = await self.get_message_key_envelope_for_viewer(
                chat_id,
                str(msg_id),
                sender_id,
            )
        return {
            "id": str(msg_id),
            "chat_id": chat_id,
            "sender_id": sender_id,
            "body": response_body,
            "created_at": created_at,
            "edited_at": None,
            "deleted_for_sender": False,
            "deleted_for_recipient": False,
            "algorithm": algo,
            "encryption_version": ver,
            "body_ciphertext": body_cipher,
            "nonce": e2e_nonce if is_e2e else (base64.b64encode(nonce_bytes).decode("ascii") if nonce_bytes else None),
            "attachment_content_id": str(att_uuid) if att_uuid else None,
            "attachment_mime_type": att_mime,
            "attachment_name": att_name,
            "attachment_size": att_size,
            "attachment_recipient_saved_id": None,
            "metadata": metadata,
            "reply_to_message_id": str(reply_to_uuid) if reply_to_uuid is not None else None,
            "e2ee_session_key_envelope": sender_envelope,
        }

    async def _chat_participants_have_active_gaf_keys(self, conn: asyncpg.Connection, chat: dict) -> bool:
        participant_ids = [_norm_uid(str(chat["user_id_1"])), _norm_uid(str(chat["user_id_2"]))]
        rows = await conn.fetch(
            """
            SELECT user_id
            FROM public.mobile_trusted_devices
            WHERE user_id = ANY($1::uuid[])
              AND status = 'active'
              AND NULLIF(BTRIM(COALESCE(gaf_public_key, '')), '') IS NOT NULL
            GROUP BY user_id
            """,
            participant_ids,
        )
        return {str(row["user_id"]) for row in rows} == {str(uid) for uid in participant_ids}

    def _e2ee_consent_column(self, chat: dict, user_id: str) -> str:
        if str(chat["user_id_1"]) == str(user_id).strip():
            return "e2ee_user_1_consented_at"
        if str(chat["user_id_2"]) == str(user_id).strip():
            return "e2ee_user_2_consented_at"
        raise GafChatForbiddenError("Not a participant")

    @staticmethod
    def _iso_or_none(value: object) -> str | None:
        if value is None:
            return None
        iso = getattr(value, "isoformat", None)
        return str(iso()) if callable(iso) else None

    async def _e2ee_status_from_chat(
        self,
        conn: asyncpg.Connection,
        chat: dict,
        current_user_id: str,
    ) -> dict:
        current_col = self._e2ee_consent_column(chat, current_user_id)
        partner_id = self._other_user_id(chat, current_user_id)
        partner_col = self._e2ee_consent_column(chat, partner_id)
        return {
            "chat_id": str(chat["id"]),
            "status": str(chat.get("e2ee_status") or "off"),
            "requested_by_user_id": (
                str(chat["e2ee_requested_by_user_id"]) if chat.get("e2ee_requested_by_user_id") else None
            ),
            "user_1_consented_at": self._iso_or_none(chat.get("e2ee_user_1_consented_at")),
            "user_2_consented_at": self._iso_or_none(chat.get("e2ee_user_2_consented_at")),
            "activated_at": self._iso_or_none(chat.get("e2ee_activated_at")),
            "declined_at": self._iso_or_none(chat.get("e2ee_declined_at")),
            "disabled_at": self._iso_or_none(chat.get("e2ee_disabled_at")),
            "updated_at": self._iso_or_none(chat.get("e2ee_updated_at")),
            "ready": await self._chat_participants_have_active_gaf_keys(conn, chat),
            "current_user_consented": chat.get(current_col) is not None,
            "partner_consented": chat.get(partner_col) is not None,
            "partner_user_id": partner_id,
        }

    async def get_e2ee_status(self, chat_id: str, current_user_id: str) -> dict:
        chat = await self.get_chat_or_403(chat_id, current_user_id)
        async with self.db_pool.acquire() as conn:
            return await self._e2ee_status_from_chat(conn, chat, current_user_id)

    async def _locked_e2ee_chat(self, conn: asyncpg.Connection, chat_id: str) -> dict:
        row = await conn.fetchrow(
            """
            SELECT id, user_id_1, user_id_2,
                   e2ee_status, e2ee_requested_by_user_id,
                   e2ee_user_1_consented_at, e2ee_user_2_consented_at,
                   e2ee_activated_at, e2ee_declined_at, e2ee_disabled_at, e2ee_updated_at
            FROM gaf_chats
            WHERE id = $1
            FOR UPDATE
            """,
            _norm_uid(chat_id),
        )
        if row is None:
            raise GafChatNotFoundError("Chat not found")
        return dict(row)

    async def propose_e2ee(self, chat_id: str, current_user_id: str) -> dict:
        chat = await self.get_chat_or_403(chat_id, current_user_id)
        consent_col = self._e2ee_consent_column(chat, current_user_id)
        async with self.db_pool.acquire() as conn:
            locked = await self._locked_e2ee_chat(conn, chat_id)
            if not await self._chat_participants_have_active_gaf_keys(conn, locked):
                raise ValueError("E2EE requires active trusted devices with GAF keys for both participants")
            if str(locked.get("e2ee_status") or "off") == "active":
                return await self._e2ee_status_from_chat(conn, locked, current_user_id)
            other_col = (
                "e2ee_user_2_consented_at" if consent_col == "e2ee_user_1_consented_at" else "e2ee_user_1_consented_at"
            )
            await conn.execute(
                f"""
                UPDATE gaf_chats
                SET e2ee_status = 'pending',
                    e2ee_requested_by_user_id = $2,
                    {consent_col} = NOW(),
                    {other_col} = NULL,
                    e2ee_activated_at = NULL,
                    e2ee_declined_at = NULL,
                    e2ee_disabled_at = NULL,
                    e2ee_updated_at = NOW(),
                    updated_at = NOW()
                WHERE id = $1
                """,
                _norm_uid(chat_id),
                _norm_uid(current_user_id),
            )
            updated = await self._locked_e2ee_chat(conn, chat_id)
            return await self._e2ee_status_from_chat(conn, updated, current_user_id)

    async def accept_e2ee(self, chat_id: str, current_user_id: str) -> dict:
        chat = await self.get_chat_or_403(chat_id, current_user_id)
        consent_col = self._e2ee_consent_column(chat, current_user_id)
        async with self.db_pool.acquire() as conn:
            locked = await self._locked_e2ee_chat(conn, chat_id)
            if not await self._chat_participants_have_active_gaf_keys(conn, locked):
                raise ValueError("E2EE requires active trusted devices with GAF keys for both participants")
            status = str(locked.get("e2ee_status") or "off")
            if status == "active":
                return await self._e2ee_status_from_chat(conn, locked, current_user_id)
            if status != "pending":
                raise ValueError("E2EE request is not pending")
            await conn.execute(
                f"""
                UPDATE gaf_chats
                SET {consent_col} = NOW(),
                    e2ee_declined_at = NULL,
                    e2ee_disabled_at = NULL,
                    e2ee_updated_at = NOW(),
                    updated_at = NOW()
                WHERE id = $1
                """,
                _norm_uid(chat_id),
            )
            updated = await self._locked_e2ee_chat(conn, chat_id)
            if (
                updated.get("e2ee_user_1_consented_at") is not None
                and updated.get("e2ee_user_2_consented_at") is not None
            ):
                await conn.execute(
                    """
                    UPDATE gaf_chats
                    SET e2ee_status = 'active',
                        e2ee_activated_at = COALESCE(e2ee_activated_at, NOW()),
                        e2ee_updated_at = NOW(),
                        updated_at = NOW()
                    WHERE id = $1
                    """,
                    _norm_uid(chat_id),
                )
                updated = await self._locked_e2ee_chat(conn, chat_id)
            return await self._e2ee_status_from_chat(conn, updated, current_user_id)

    async def decline_e2ee(self, chat_id: str, current_user_id: str) -> dict:
        await self.get_chat_or_403(chat_id, current_user_id)
        async with self.db_pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE gaf_chats
                SET e2ee_status = 'declined',
                    e2ee_declined_at = NOW(),
                    e2ee_activated_at = NULL,
                    e2ee_updated_at = NOW(),
                    updated_at = NOW()
                WHERE id = $1
                """,
                _norm_uid(chat_id),
            )
            updated = await self._locked_e2ee_chat(conn, chat_id)
            return await self._e2ee_status_from_chat(conn, updated, current_user_id)

    async def disable_e2ee(self, chat_id: str, current_user_id: str) -> dict:
        await self.get_chat_or_403(chat_id, current_user_id)
        async with self.db_pool.acquire() as conn:
            await self._disable_e2ee_in_conn(conn, _norm_uid(chat_id))
            updated = await self._locked_e2ee_chat(conn, chat_id)
            return await self._e2ee_status_from_chat(conn, updated, current_user_id)

    async def suspend_active_e2ee_for_user(
        self,
        user_id: str,
    ) -> list[dict]:
        """
        Disable E2EE on active chats where trusted-device GAF keys are no longer present.

        Returns status rows for chats that were suspended (for socket refresh).
        """
        uid = _norm_uid(user_id)
        suspended: list[dict] = []
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, user_id_1, user_id_2,
                       e2ee_status, e2ee_requested_by_user_id,
                       e2ee_user_1_consented_at, e2ee_user_2_consented_at,
                       e2ee_activated_at, e2ee_declined_at, e2ee_disabled_at, e2ee_updated_at
                FROM gaf_chats
                WHERE e2ee_status = 'active'
                  AND ($1 = user_id_1 OR $1 = user_id_2)
                """,
                uid,
            )
            for row in rows:
                chat = dict(row)
                if await self._chat_participants_have_active_gaf_keys(conn, chat):
                    continue
                chat_id = str(chat["id"])
                await self._disable_e2ee_in_conn(conn, chat["id"])
                updated = await self._locked_e2ee_chat(conn, chat_id)
                status = await self._e2ee_status_from_chat(conn, updated, user_id)
                status["suspend_reason"] = "trusted_device_lost"
                suspended.append(status)
                _gaf_info(
                    "[GAF_CHAT] e2ee_auto_suspended",
                    chat_id=chat_id,
                    reason="trusted_device_lost",
                    user_id=user_id,
                )
        return suspended

    @staticmethod
    async def _disable_e2ee_in_conn(conn: asyncpg.Connection, chat_id: UUID) -> None:
        await conn.execute(
            """
            UPDATE gaf_chats
            SET e2ee_status = 'off',
                e2ee_requested_by_user_id = NULL,
                e2ee_user_1_consented_at = NULL,
                e2ee_user_2_consented_at = NULL,
                e2ee_activated_at = NULL,
                e2ee_declined_at = NULL,
                e2ee_disabled_at = NOW(),
                e2ee_updated_at = NOW(),
                updated_at = NOW()
            WHERE id = $1
            """,
            chat_id,
        )

    async def _emit_e2ee_consent_changed_for_chat(
        self,
        conn: asyncpg.Connection,
        chat_id: str,
        chat: dict,
        *,
        actor_user_id: str,
        suspend_reason: str | None = None,
    ) -> None:
        from api.routers.socketio_handler import emit_gaf_e2ee_consent_changed

        updated = await self._locked_e2ee_chat(conn, chat_id)
        for participant_id in (str(chat["user_id_1"]), str(chat["user_id_2"])):
            status = await self._e2ee_status_from_chat(conn, updated, participant_id)
            payload: dict[str, object] = {
                "chat_id": chat_id,
                "status": status.get("status") or "off",
                "requested_by_user_id": status.get("requested_by_user_id"),
                "actor_user_id": actor_user_id,
                "ready": bool(status.get("ready")),
                "activated_at": status.get("activated_at"),
                "disabled_at": status.get("disabled_at"),
                "declined_at": status.get("declined_at"),
            }
            if suspend_reason:
                payload["suspend_reason"] = suspend_reason
            try:
                await emit_gaf_e2ee_consent_changed(participant_id, payload)  # type: ignore[arg-type]
            except Exception as emit_exc:
                _gaf_info(
                    "[GAF_CHAT] e2ee_consent_changed_emit_skip",
                    chat_id=chat_id,
                    participant_id=participant_id,
                    error=str(emit_exc),
                )

    async def send_video_call_event_message(
        self,
        chat_id: str,
        actor_user_id: str,
        body: str,
        *,
        metadata: dict[str, Any],
    ) -> dict:
        """Append an internal video-call event to an existing 1:1 GAF chat and refresh both clients."""

        chat = await self.get_chat_or_403(chat_id, actor_user_id)
        cid = _norm_uid(chat_id)
        actor_uuid = _norm_uid(actor_user_id)
        body_plain = (body or "").strip()
        if not body_plain:
            raise ValueError("Body is required")
        if metadata.get("kind") != "video_call_event":
            raise ValueError("Invalid video call event metadata")
        body_cipher, nonce_b64, algo, ver = encrypt_body(body_plain)
        nonce_bytes = base64.b64decode(nonce_b64) if nonce_b64 else None
        msg_id = uuid4()
        metadata_for_pg = json.dumps(metadata, ensure_ascii=False, default=str)
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO gaf_messages (
                    id, chat_id, sender_id, body_ciphertext, body_plain_preview,
                    nonce, algorithm, encryption_version, created_at, metadata
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9::jsonb)
                RETURNING id, created_at
                """,
                msg_id,
                cid,
                actor_uuid,
                body_cipher,
                body_plain[:200],
                nonce_bytes,
                algo,
                ver,
                metadata_for_pg,
            )
            await conn.execute(
                """
                UPDATE gaf_chats
                SET updated_at = NOW(),
                    last_message_at = NOW(),
                    archived_at_user_1 = NULL,
                    archived_at_user_2 = NULL
                WHERE id = $1
                """,
                cid,
            )

        msg = {
            "id": str(msg_id),
            "chat_id": chat_id,
            "sender_id": actor_user_id,
            "body": body_plain,
            "created_at": row["created_at"].isoformat() if row and row.get("created_at") else "",
            "edited_at": None,
            "deleted_for_sender": False,
            "deleted_for_recipient": False,
            "algorithm": algo,
            "encryption_version": ver,
            "body_ciphertext": body_cipher,
            "nonce": base64.b64encode(nonce_bytes).decode("ascii") if nonce_bytes else None,
            "attachment_content_id": None,
            "attachment_mime_type": None,
            "attachment_name": None,
            "attachment_size": None,
            "attachment_recipient_saved_id": None,
            "metadata": metadata,
            "reply_to_message_id": None,
        }
        await self._emit_video_call_event_message(chat, msg)
        return msg

    async def _emit_video_call_event_message(self, chat: dict, msg: dict) -> None:
        from api.routers.socketio_handler import emit_gaf_message_new

        payload = {
            "chat_id": msg["chat_id"],
            "message_id": msg["id"],
            "sender_id": msg["sender_id"],
            "body": msg.get("body", ""),
            "created_at": msg.get("created_at") or "",
            # Video calls have dedicated realtime notifications; this event only refreshes chat history.
            "recipient_is_muted": True,
            "algorithm": msg.get("algorithm"),
            "encryption_version": msg.get("encryption_version"),
            "metadata": msg.get("metadata"),
        }
        for participant_id in (str(chat["user_id_1"]), str(chat["user_id_2"])):
            try:
                await emit_gaf_message_new(participant_id, payload)
            except Exception as emit_exc:  # noqa: BLE001
                _gaf_warning(
                    "[GAF_CHAT] emit video_call_event message_new skip",
                    chat_id=msg["chat_id"],
                    user_id=participant_id,
                    error=str(emit_exc),
                )

    async def _fetch_user_display_label(self, user_id: str) -> str:
        try:
            uid = UUID(str(user_id).strip())
        except (ValueError, AttributeError):  # fmt: skip
            return str(user_id)
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT username, full_name FROM users WHERE id = $1::uuid",
                str(uid),
            )
        if not row:
            return str(user_id)
        un = row["username"]
        if un and str(un).strip():
            return f"@{un}"
        fn = row.get("full_name")
        if fn and str(fn).strip():
            return str(fn).strip()
        return str(user_id)

    async def accept_attachment(
        self,
        chat_id: str,
        message_id: str,
        recipient_id: str,
        content_service: ContentStorageService,
    ) -> dict:
        """Copy sender's attachment into recipient's Content Manager (unfiled)."""
        chat = await self.get_chat_or_403(chat_id, recipient_id)
        other = self._other_user_id(chat, recipient_id)
        cid = _norm_uid(chat_id)
        mid = _norm_uid(message_id)
        rid = _norm_uid(recipient_id)
        async with self.db_pool.acquire() as conn:
            mrow = await conn.fetchrow(
                """
                SELECT id, chat_id, sender_id, attachment_content_id, attachment_recipient_saved_id,
                       attachment_name, attachment_mime_type
                FROM gaf_messages
                WHERE id = $1 AND chat_id = $2
                """,
                mid,
                cid,
            )
        if not mrow:
            raise GafMessageNotFoundError("Сообщение не найдено")
        if str(mrow["sender_id"]) == str(rid):
            raise GafMessageAuthorError("Только получатель может сохранить файл")
        if not mrow.get("attachment_content_id"):
            raise ValueError("У сообщения нет вложения")
        saved = mrow.get("attachment_recipient_saved_id")
        if saved:
            return {"content_id": str(saved), "already_saved": True}
        sender_id = str(mrow["sender_id"])
        if sender_id != str(other):
            raise GafChatForbiddenError("Нет доступа к сообщению")
        att_id = mrow["attachment_content_id"]
        file_data, meta = await content_service.read_file_bytes_for_owner(att_id, sender_id)
        sender_label = await self._fetch_user_display_label(sender_id)
        description = f"Получено из GAF Chat от {sender_label}"
        tags = ["gaf-chat", f"from:{sender_label}"]
        ct_raw = (meta.get("content_type") or "").strip().lower()
        try:
            ct = ContentType(ct_raw) if ct_raw else ContentType.OTHER
        except ValueError:
            ct = ContentType.OTHER
        orig_name = meta.get("original_filename") or meta.get("name") or mrow.get("attachment_name") or "file"
        name_str = str(orig_name)[:500]
        content_data = ContentCreate(
            user_id=str(rid),
            name=name_str,
            description=description,
            tags=tags,
            content_type=ct,
            mime_type=meta.get("mime_type") or mrow.get("attachment_mime_type"),
            visibility=Visibility.PRIVATE,
            original_filename=str(orig_name)[:255],
            folder_item_id=None,
            source_service="gaf_chat",
            sub_type=CONTENT_SUBTYPE_GAF_CHAT_VOICE if is_gaf_voice_upload_filename(name_str) else None,
            company_id=None,
            project_id=None,
            title=None,
            word_count=None,
            character_count=None,
            access_level=None,
            is_public=None,
            source_id=None,
            apply_project_desktop_folder=True,
        )
        created = await content_service.create_content(
            content_data=content_data,
            file_data=file_data,
            user_id=str(rid),
            ip_address=None,
            user_agent=None,
        )
        new_id = created.id
        async with self.db_pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE gaf_messages
                SET attachment_recipient_saved_id = $1
                WHERE id = $2 AND chat_id = $3
                """,
                _norm_uid(str(new_id)),
                mid,
                cid,
            )
        return {"content_id": str(new_id), "already_saved": False}

    async def get_message_attachment_for_participant(
        self,
        chat_id: str,
        message_id: str,
        viewer_user_id: str,
        content_service: ContentStorageService,
    ) -> tuple[bytes, str, str]:
        """
        Байты вложения для участника чата (отправитель или получатель).

        Не зависит от content_shares: файл читается как контент отправителя после
        проверки участия в чате и видимости сообщения.
        """
        await self.get_chat_or_403(chat_id, viewer_user_id)
        cid = _norm_uid(chat_id)
        mid = _norm_uid(message_id)
        async with self.db_pool.acquire() as conn:
            mrow = await conn.fetchrow(
                """
                SELECT id, sender_id, attachment_content_id,
                       deleted_for_sender, deleted_for_recipient, deleted_at
                FROM gaf_messages
                WHERE id = $1 AND chat_id = $2
                """,
                mid,
                cid,
            )
        if not mrow:
            raise GafMessageNotFoundError("Сообщение не найдено")
        if self._message_deleted_for_everyone(mrow):
            raise GafChatForbiddenError("Сообщение недоступно")
        if self._message_hidden_for_user(mrow, viewer_user_id):
            raise GafChatForbiddenError("Сообщение недоступно")
        att_id = mrow.get("attachment_content_id")
        if not att_id:
            raise ValueError("У сообщения нет вложения")
        sender_id = str(mrow["sender_id"])
        file_data, meta = await content_service.read_file_bytes_for_owner(att_id, sender_id)
        mime = (meta.get("mime_type") or "application/octet-stream") or "application/octet-stream"
        raw_name = meta.get("original_filename") or meta.get("name") or "attachment"
        return file_data, mime, str(raw_name)

    async def send_admin_desktop_app_link_message(
        self,
        chat_id: str,
        sender_id: str,
        *,
        body: str,
        metadata: dict[str, Any],
    ) -> dict:
        """Send a validated desktop app link from an admin participant (structured metadata)."""
        return await self.send_message(
            chat_id,
            sender_id,
            body,
            metadata=metadata,
            allow_admin_desktop_app_link_metadata=True,
        )

    async def send_service_message_to_user(
        self,
        recipient_user_id: str,
        body: str,
        *,
        metadata: dict[str, Any] | None = None,
    ) -> dict | None:
        """Send plaintext from the GAF system account (server-side only; not exposed as user login)."""
        from api.gaf_chat.constants import get_gaf_system_user_id
        from api.routers.socketio_handler import emit_gaf_chat_created, emit_gaf_message_new

        sid = str(get_gaf_system_user_id())
        plain = (body or "").strip()
        if not plain:
            return None
        created_row = await self.get_or_create_chat(sid, recipient_user_id)
        chat_id = str(created_row["id"])
        if created_row.get("created"):
            try:
                await emit_gaf_chat_created(
                    recipient_user_id,
                    {"chat_id": chat_id, "initiator_id": sid},
                )
            except Exception as emit_exc:  # noqa: BLE001
                _gaf_warning("[GAF_CHAT] emit chat_created skip", error=str(emit_exc))
        msg = await self.send_message(chat_id, sid, plain, metadata=metadata)
        try:
            from api.services.friends_service import FriendsService

            friends_svc = FriendsService(self.db_pool)
            recipient_controls = await friends_svc.get_relationship_controls(
                recipient_user_id,
                sid,
            )
            payload: dict[str, Any] = {
                "chat_id": chat_id,
                "message_id": msg["id"],
                "sender_id": msg["sender_id"],
                "body": msg.get("body", ""),
                "created_at": msg.get("created_at") or "",
                "recipient_is_muted": bool(recipient_controls.get("is_muted")),
                "algorithm": msg.get("algorithm"),
                "encryption_version": msg.get("encryption_version"),
            }
            if metadata is not None:
                payload["metadata"] = metadata
            await emit_gaf_message_new(
                recipient_user_id,
                payload,
            )
        except Exception as emit_exc:  # noqa: BLE001
            _gaf_warning("[GAF_CHAT] emit message_new skip", error=str(emit_exc))
        return msg

    async def mark_read(self, chat_id: str, current_user_id: str, up_to_message_id: str | None = None) -> str | None:
        """Set last_read for current user to up_to_message_id (or latest in chat).

        Returns the message id that was actually used for last_read (or None if there are no messages).
        This is used by the API layer to emit accurate read receipts over Socket.IO.
        """
        chat = await self.get_chat_or_403(chat_id, current_user_id)
        cid = _norm_uid(chat_id)
        col = self._last_read_column(chat, current_user_id)
        async with self.db_pool.acquire() as conn:
            current_row = None
            current_last_read_id = chat.get(col)
            if current_last_read_id:
                current_row = await conn.fetchrow(
                    """
                    SELECT id, created_at
                    FROM gaf_messages
                    WHERE id = $1 AND chat_id = $2
                    """,
                    current_last_read_id,
                    cid,
                )
                if current_row is None:
                    _gaf_warning(
                        "[GAF_CHAT] mark_read stale_last_read_cleared",
                        chat_id=chat_id,
                        user_id=current_user_id,
                        last_read_id=str(current_last_read_id),
                    )

            if up_to_message_id:
                mid = _norm_uid(up_to_message_id)
                target_row = await conn.fetchrow(
                    """
                    SELECT id, created_at
                    FROM gaf_messages
                    WHERE id = $1 AND chat_id = $2
                    """,
                    mid,
                    cid,
                )
                if not target_row:
                    raise GafMessageNotFoundError("Message not found")
            else:
                target_row = await conn.fetchrow(
                    """
                    SELECT id, created_at
                    FROM gaf_messages
                    WHERE chat_id = $1
                    ORDER BY created_at DESC, id::text DESC
                    LIMIT 1
                    """,
                    cid,
                )
            if not target_row:
                return None

            if current_row and self._message_position_key(target_row) < self._message_position_key(current_row):
                return str(current_row["id"])

            await conn.execute(
                f"UPDATE gaf_chats SET {col} = $1, updated_at = NOW() WHERE id = $2",
                target_row["id"],
                cid,
            )
            return str(target_row["id"])

    async def edit_message(self, chat_id: str, message_id: str, sender_id: str, new_body: str) -> dict:
        """Edit only if author; update edited_at."""
        await self.get_chat_or_403(chat_id, sender_id)
        cid = _norm_uid(chat_id)
        mid = _norm_uid(message_id)
        _norm_uid(sender_id)
        body_plain = (new_body or "").strip()
        if not body_plain:
            raise ValueError("Body is required")
        preview = body_plain[:200] if len(body_plain) > 200 else body_plain
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT id, sender_id, created_at, algorithm FROM gaf_messages WHERE id = $1 AND chat_id = $2",
                mid,
                cid,
            )
            if not row:
                raise GafMessageNotFoundError("Message not found")
            if str(row["sender_id"]) != str(sender_id):
                raise GafMessageAuthorError("Not the author")
            if str(row.get("algorithm") or "").startswith("e2e_"):
                raise ValueError("E2EE messages cannot be edited with the plaintext edit path")
            body_cipher, nonce_b64, algo, ver = encrypt_body(body_plain)
            nonce_bytes = base64.b64decode(nonce_b64) if nonce_b64 else None
            await conn.execute(
                "UPDATE gaf_messages SET body_ciphertext = $1, body_plain_preview = $2, nonce = $3, algorithm = $4, encryption_version = $5, edited_at = NOW() WHERE id = $6",
                body_cipher,
                preview,
                nonce_bytes,
                algo,
                ver,
                mid,
            )
        _gaf_info("[GAF_CHAT] edit_message", chat_id=chat_id, message_id=message_id, user_id=sender_id)
        return await self._get_message(mid)

    async def _get_message(self, message_id: UUID) -> dict:
        async with self.db_pool.acquire() as conn:
            r = await conn.fetchrow(
                "SELECT id, chat_id, sender_id, body_ciphertext, nonce, algorithm, encryption_version, created_at, edited_at, deleted_for_sender, deleted_for_recipient FROM gaf_messages WHERE id = $1",
                message_id,
            )
        if not r:
            raise GafMessageNotFoundError("Message not found")
        algo = r["algorithm"] or "plain"
        if algo.startswith("e2e_"):
            body = "[encrypted]"
        else:
            body = decrypt_body(r["body_ciphertext"] or "", r.get("nonce") or b"", algo)
        return {
            "id": str(r["id"]),
            "chat_id": str(r["chat_id"]),
            "sender_id": str(r["sender_id"]),
            "body": body,
            "created_at": r["created_at"].isoformat() if r["created_at"] else "",
            "edited_at": r["edited_at"].isoformat() if r["edited_at"] else None,
            "deleted_for_sender": r["deleted_for_sender"],
            "deleted_for_recipient": r["deleted_for_recipient"],
            "algorithm": algo,
            "encryption_version": r.get("encryption_version"),
            "body_ciphertext": r.get("body_ciphertext"),
            "nonce": base64.b64encode(r["nonce"]).decode("ascii") if r.get("nonce") else None,
        }

    async def upsert_user_public_key(self, user_id: str, public_key_pem: str, algorithm: str) -> None:
        """Создать или обновить публичный ключ пользователя для E2E."""
        uid = _norm_uid(user_id)
        async with self.db_pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO gaf_user_public_keys (user_id, public_key_pem, algorithm, created_at, updated_at)
                VALUES ($1, $2, $3, NOW(), NOW())
                ON CONFLICT (user_id)
                DO UPDATE SET public_key_pem = EXCLUDED.public_key_pem,
                              algorithm = EXCLUDED.algorithm,
                              updated_at = NOW()
                """,
                uid,
                public_key_pem,
                algorithm,
            )
        _gaf_info("[GAF_CHAT] upsert_user_public_key", user_id=user_id, algorithm=algorithm)

    async def get_user_public_key(self, user_id: str) -> dict | None:
        """Получить публичный ключ пользователя (для handshake)."""
        uid = _norm_uid(user_id)
        async with self.db_pool.acquire() as conn:
            wire_row = await conn.fetchrow(
                """
                SELECT user_id, public_key_pem, algorithm, created_at, updated_at
                FROM gaf_user_public_keys
                WHERE user_id = $1
                  AND algorithm = 'rsa_oaep_sha256'
                  AND NULLIF(BTRIM(COALESCE(public_key_pem, '')), '') IS NOT NULL
                """,
                uid,
            )
            if wire_row:
                return dict(wire_row)
            trusted_row = await conn.fetchrow(
                """
                SELECT
                    user_id,
                    gaf_public_key AS public_key_pem,
                    gaf_public_key_algorithm AS algorithm,
                    created_at,
                    updated_at
                FROM public.mobile_trusted_devices
                WHERE user_id = $1
                  AND status = 'active'
                  AND NULLIF(BTRIM(COALESCE(gaf_public_key, '')), '') IS NOT NULL
                ORDER BY updated_at DESC, created_at DESC
                LIMIT 1
                """,
                uid,
            )
            if trusted_row:
                return dict(trusted_row)
            row = await conn.fetchrow(
                "SELECT user_id, public_key_pem, algorithm, created_at, updated_at FROM gaf_user_public_keys WHERE user_id = $1",
                uid,
            )
        return dict(row) if row else None

    async def get_session_key_envelope_for_user(self, chat_id: str, user_id: str) -> dict | None:
        """
        Вернуть последний зашифрованный сессионный ключ для пользователя в рамках чата.

        Сервер не расшифровывает payload, только отдаёт как есть.
        """
        cid = _norm_uid(chat_id)
        uid = _norm_uid(user_id)
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT encrypted_key_payload
                FROM gaf_message_keys
                WHERE chat_id = $1 AND user_id = $2
                ORDER BY created_at DESC
                LIMIT 1
                """,
                cid,
                uid,
            )
        if not row:
            return None
        return {"chat_id": str(cid), "encrypted_key_payload": row["encrypted_key_payload"]}

    async def delete_message(
        self,
        chat_id: str,
        message_id: str,
        current_user_id: str,
        for_me_only: bool = False,
    ) -> None:
        """Soft delete: for_me_only -> set deleted_for_sender or deleted_for_recipient; else both."""
        await self.get_chat_or_403(chat_id, current_user_id)
        cid = _norm_uid(chat_id)
        mid = _norm_uid(message_id)
        _norm_uid(current_user_id)
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT id, sender_id FROM gaf_messages WHERE id = $1 AND chat_id = $2",
                mid,
                cid,
            )
            if not row:
                raise GafMessageNotFoundError("Message not found")
            is_author = str(row["sender_id"]) == str(current_user_id)
            if for_me_only:
                if is_author:
                    await conn.execute("UPDATE gaf_messages SET deleted_for_sender = TRUE WHERE id = $1", mid)
                else:
                    await conn.execute("UPDATE gaf_messages SET deleted_for_recipient = TRUE WHERE id = $1", mid)
            else:
                if not is_author:
                    raise GafMessageAuthorError("Only the author can delete for everyone")
                await conn.execute(
                    """
                    UPDATE gaf_messages
                    SET deleted_at = NOW(),
                        deleted_for_sender = TRUE,
                        deleted_for_recipient = TRUE,
                        body_plain_preview = 'Сообщение удалено'
                    WHERE id = $1
                    """,
                    mid,
                )
        _gaf_info(
            "[GAF_CHAT] delete_message",
            chat_id=chat_id,
            message_id=message_id,
            user_id=current_user_id,
            for_me_only=for_me_only,
        )

    async def clear_history_for_user(self, chat_id: str, current_user_id: str) -> None:
        """
        Пометить все сообщения в чате удалёнными для текущего пользователя.

        - Для своих сообщений: deleted_for_sender = TRUE.
        - Для сообщений собеседника: deleted_for_recipient = TRUE.
        """
        await self.get_chat_or_403(chat_id, current_user_id)
        cid = _norm_uid(chat_id)
        uid = _norm_uid(current_user_id)
        async with self.db_pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE gaf_messages
                SET deleted_for_sender = CASE WHEN sender_id = $1 THEN TRUE ELSE deleted_for_sender END,
                    deleted_for_recipient = CASE WHEN sender_id <> $1 THEN TRUE ELSE deleted_for_recipient END
                WHERE chat_id = $2
                """,
                uid,
                cid,
            )
        _gaf_info("[GAF_CHAT] clear_history_for_user", chat_id=chat_id, user_id=current_user_id)

    async def archive_chat_for_user(self, chat_id: str, current_user_id: str) -> None:
        """
        Архивировать чат для текущего пользователя:

        - Пометить все сообщения удалёнными для него.
        - Установить archived_at_user_1/2 для скрытия чата из списка.
        """
        chat = await self.get_chat_or_403(chat_id, current_user_id)
        cid = _norm_uid(chat_id)
        col = self._archive_column(chat, current_user_id)
        await self.clear_history_for_user(chat_id, current_user_id)
        async with self.db_pool.acquire() as conn:
            await conn.execute(
                f"UPDATE gaf_chats SET {col} = NOW(), updated_at = NOW() WHERE id = $1",
                cid,
            )
        _gaf_info("[GAF_CHAT] archive_chat_for_user", chat_id=chat_id, user_id=current_user_id)

    async def hard_delete_chat(self, chat_id: str, current_user_id: str) -> None:
        """
        Полностью удалить чат и его историю для обоих участников.

        Используется, когда нужно начать переписку «с нуля»:
        - удаляются все сообщения и ключи;
        - удаляется сама запись чата;
        - при следующем старте чат будет создан заново.
        """
        chat = await self.get_chat_or_403(chat_id, current_user_id)
        cid = _norm_uid(chat_id)
        async with self.db_pool.acquire() as conn:
            # Удаляем ключи и сообщения, затем сам чат
            await conn.execute("DELETE FROM gaf_message_keys WHERE chat_id = $1", cid)
            await conn.execute("DELETE FROM gaf_messages WHERE chat_id = $1", cid)
            del_chat = await conn.execute("DELETE FROM gaf_chats WHERE id = $1", cid)
            if str(del_chat) == "DELETE 0":
                _gaf_warning(
                    "[GAF_CHAT] hard_delete_chat no_row_deleted",
                    chat_id=chat_id,
                    user_id=current_user_id,
                )
        _gaf_info(
            "[GAF_CHAT] hard_delete_chat",
            chat_id=chat_id,
            user_id=current_user_id,
            other_user_id=self._other_user_id(chat, current_user_id),
        )

    async def search_users(self, q: str, limit: int = 20, current_user_id: str | None = None) -> list[dict]:
        """Search users by username/full_name; return id, username, full_name, avatar_url only."""
        q = (q or "").strip()
        if len(q) < 1:
            return []
        limit = min(max(1, limit), 50)
        pattern = f"%{q}%"
        current_user_uuid = _norm_uid(current_user_id) if current_user_id else None
        disc_gaf = search_discoverability_predicate("$3")
        async with self.db_pool.acquire() as conn:
            if current_user_uuid is None:
                rows = await conn.fetch(
                    """
                    SELECT
                        u.id,
                        u.username,
                        u.full_name,
                        u.avatar_url,
                        (upp.user_id IS NOT NULL) AS privacy_join_present,
                        upp.discoverability,
                        upp.avatar_visibility,
                        upp.avatar_circle_id,
                        upp.full_name_visibility,
                        upp.full_name_circle_id,
                        upp.bio_visibility,
                        upp.bio_circle_id
                    FROM users u
                    LEFT JOIN user_profile_privacy upp ON upp.user_id = u.id
                    WHERE (
                        LOWER(u.username) LIKE LOWER($1)
                        OR (u.full_name IS NOT NULL AND LOWER(u.full_name) LIKE LOWER($1))
                    )
                    ORDER BY u.username
                    LIMIT $2
                    """,
                    pattern,
                    limit,
                )
                out: list[dict] = []
                for r in rows:
                    priv = privacy_from_joined_row(r)
                    sid = r["id"]
                    avatar_url, full_name, _b = redact_profile_fields(
                        subject_id=sid,
                        viewer_id=GAF_ANONYMOUS_VIEWER_ID,
                        is_friend=False,
                        privacy=priv,
                        avatar_url=r["avatar_url"],
                        full_name=r["full_name"],
                        bio=None,
                        circle_hits=set(),
                    )
                    out.append(
                        {
                            "id": str(r["id"]),
                            "username": r["username"],
                            "display_name": full_name,
                            "full_name": full_name,
                            "avatar_url": avatar_url,
                        }
                    )
                return out

            rows = await conn.fetch(
                f"""
                SELECT
                    u.id,
                    u.username,
                    u.full_name,
                    u.avatar_url,
                    (upp.user_id IS NOT NULL) AS privacy_join_present,
                    upp.discoverability,
                    upp.avatar_visibility,
                    upp.avatar_circle_id,
                    upp.full_name_visibility,
                    upp.full_name_circle_id,
                    upp.bio_visibility,
                    upp.bio_circle_id,
                    EXISTS (
                        SELECT 1 FROM friendships f
                        WHERE f.user_id = $3::uuid AND f.friend_id = u.id
                    ) AS is_friend
                FROM users u
                LEFT JOIN user_profile_privacy upp ON upp.user_id = u.id
                WHERE u.id != $3::uuid
                  AND (
                      LOWER(u.username) LIKE LOWER($1)
                      OR (u.full_name IS NOT NULL AND LOWER(u.full_name) LIKE LOWER($1))
                  )
                  AND ({disc_gaf.strip()})
                ORDER BY u.username
                LIMIT $2
                """,
                pattern,
                limit,
                current_user_uuid,
            )

            pairs: list[tuple[UUID, UUID]] = []
            for row in rows:
                priv = privacy_from_joined_row(row)
                sid = row["id"]
                for key_vis, key_c in (
                    ("avatar_visibility", "avatar_circle_id"),
                    ("full_name_visibility", "full_name_circle_id"),
                ):
                    if str(priv.get(key_vis) or "").lower() == "circle":
                        cid = priv.get(key_c)
                        if cid is not None:
                            pairs.append((UUID(str(cid)), sid))

            circle_hits = await batch_viewer_circle_hits(conn, viewer_user_id=current_user_uuid, pairs=pairs)

            result: list[dict] = []
            for row in rows:
                priv = privacy_from_joined_row(row)
                sid = row["id"]
                is_friend = bool(row["is_friend"])
                avatar_url, full_name, _bio = redact_profile_fields(
                    subject_id=sid,
                    viewer_id=current_user_uuid,
                    is_friend=is_friend,
                    privacy=priv,
                    avatar_url=row["avatar_url"],
                    full_name=row["full_name"],
                    bio=None,
                    circle_hits=circle_hits,
                )
                result.append(
                    {
                        "id": str(row["id"]),
                        "username": row["username"],
                        "display_name": full_name,
                        "full_name": full_name,
                        "avatar_url": avatar_url,
                    }
                )
            return result
