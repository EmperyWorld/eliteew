# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Service layer for internal GAF video calls: persistence, friendship safety, JWT for Jitsi, GAF chat events.
# Invariants:
# - Only chat participants who can currently interact may create/join calls.
# - Ended/missed calls are idempotent on /end.
# - At most one ringing/active call per GAF chat; create reuses the open room instead of spawning another.
# - Callee create on an existing ringing 1:1 accepts (same as /join) — reverse-dial must not open blank Meet.
# Related:
# - api/video_calls/router.py
# - api/services/friends_service.py
# - documentation/product/INTERNAL-VIDEO-CALLS.md
# ---
"""Service layer for internal video calls.

The app owns authorization, call records and short-lived JWTs; stack11 only hosts
the media room for already-authorized EliteEW users.
"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import quote, urljoin
from uuid import UUID, uuid4

import asyncpg  # type: ignore[import-not-found,import-untyped]
import jwt  # type: ignore[import-untyped]
import structlog  # type: ignore[import-not-found]

from api.core.unified_config import unified_settings
from api.gaf_chat.service import GafChatService
from api.services.friends_service import FriendsService
from api.video_calls.schemas import (
    VideoCallCreateResponse,
    VideoCallJoinResponse,
    VideoCallPendingIncomingItem,
)

logger = structlog.get_logger("api.video_calls.service")

# Fragment overrides for iframe embeds: skip prejoin/welcome and Jitsi "return to recent meeting" UX.
_MEET_EMBED_HASH = (
    "config.prejoinPageEnabled=false"
    "&config.prejoinConfig.enabled=false"
    "&config.enableWelcomePage=false"
    "&config.disableDeepLinking=true"
    "&interfaceConfig.SHOW_PROMOTIONAL_CLOSE_PAGE=false"
)


class VideoCallConfigError(RuntimeError):
    """Raised when stack11/Jitsi signing is not configured."""


class VideoCallNotFoundError(ValueError):
    """Raised when a call does not exist or is not visible to the caller."""


class VideoCallEndedError(ValueError):
    """Raised when a user attempts to join a finished call."""


class VideoCallAwaitingAcceptError(ValueError):
    """Raised when the caller attempts to join before the callee accepted a 1:1 call."""


MISSED_REASON_LABELS: dict[str, str] = {
    "declined": "Видеозвонок отклонён",
    "caller_cancelled": "Видеозвонок отменён",
    "no_answer": "Видеозвонок пропущен — нет ответа",
    "callee_unreachable": "Видеозвонок не доставлен — абонент недоступен",
    "callee_mobile_unreachable": "Видеозвонок не доставлен — абонент вне зоны действия",
}


@dataclass(frozen=True)
class JoinCallResult:
    response: VideoCallJoinResponse
    accepted_now: bool
    caller_user_id: str
    callee_user_id: str | None
    chat_id: str | None
    call_kind: str


@dataclass(frozen=True)
class CreateGafCallResult:
    """Result of create_gaf_call including reuse-as-callee accept."""

    response: VideoCallCreateResponse
    peer_user_id: str
    created: bool
    accepted_now: bool
    caller_user_id: str | None = None
    callee_user_id: str | None = None
    chat_id: str | None = None
    call_kind: str = "direct"


@dataclass(frozen=True)
class RingingCallRow:
    """Minimal row for ringing 1:1 reconcile and delivery re-emit."""

    id: str
    status: str
    created_at: datetime
    ringing_delivered_at: datetime | None
    caller_user_id: str
    callee_user_id: str
    gaf_chat_id: str | None

    def incoming_payload(self) -> dict[str, object]:
        created = self.created_at if self.created_at.tzinfo else self.created_at.replace(tzinfo=UTC)
        return {
            "call_id": self.id,
            "chat_id": self.gaf_chat_id,
            "caller_user_id": self.caller_user_id,
            "created_at": created.isoformat(),
            "participant_user_ids": [self.caller_user_id, self.callee_user_id],
        }


def _as_uuid(value: str) -> UUID:
    return UUID(str(value).strip())


def _display_name(profile: dict[str, Any] | None, user_id: str) -> str:
    """Human-readable Jitsi display name (UTF-8 safe, no mojibake in JWT)."""

    if not profile:
        return user_id
    for key in ("full_name", "username", "email"):
        raw = str(profile.get(key) or "").strip()
        if not raw:
            continue
        normalized = unicodedata.normalize("NFC", raw)
        try:
            normalized.encode("utf-8")
        except UnicodeEncodeError:
            continue
        return normalized[:128]
    return user_id


def _absolute_app_url(value: str) -> str:
    raw = value.strip()
    if raw.startswith(("https://", "http://", "data:", "blob:")):
        return raw
    if raw.startswith("/"):
        return urljoin("https://app.eliteew.ru", raw)
    return raw


def _meet_safe_avatar_url(avatar_url: str) -> str:
    """Omit app API avatar URLs from Jitsi JWT — Meet iframe cannot fetch OAuth-protected content."""
    absolute = _absolute_app_url(avatar_url)
    if "/api/v1/content/" in absolute and "/download" in absolute:
        return ""
    return absolute


def _duration_seconds(started_at: datetime | None, ended_at: datetime | None) -> int | None:
    if started_at is None or ended_at is None:
        return None
    return max(0, int((ended_at - started_at).total_seconds()))


def _notify_participant_user_ids(participant_ids: list[str], *, ending_user_id: str) -> list[str]:
    """Return unique DB user ids to notify about call end, excluding the user who ended the call."""

    ordered: list[str] = []
    seen: set[str] = set()
    for raw in participant_ids:
        user_id = str(raw or "").strip()
        if not user_id or user_id == ending_user_id or user_id in seen:
            continue
        try:
            UUID(user_id)
        except ValueError:
            continue
        seen.add(user_id)
        ordered.append(user_id)
    return ordered


class VideoCallService:
    """Create and authorize app-internal video calls."""

    def __init__(self, db_pool: asyncpg.Pool) -> None:
        self.db_pool = db_pool

    @property
    def _meet_base_url(self) -> str:
        return unified_settings.jitsi_public_url.rstrip("/")

    @property
    def _jitsi_domain(self) -> str:
        return unified_settings.jitsi_xmpp_domain.strip() or "meet.eliteew.ru"

    @property
    def _jitsi_app_id(self) -> str:
        return unified_settings.jitsi_app_id.strip() or "jitsi"

    @property
    def _jitsi_secret(self) -> str:
        secret = (unified_settings.jitsi_app_secret or unified_settings.jitsi_jwt_secret or "").strip()
        if not secret:
            raise VideoCallConfigError("Jitsi JWT secret is not configured")
        return secret

    def _make_room_name(self) -> str:
        return f"ew-gaf-{uuid4().hex}"

    async def _assert_can_call(self, user_id: str, other_user_id: str, *, action_label: str) -> None:
        """Reuse the GAF interaction guard so blocks suppress media calls too."""
        await FriendsService(self.db_pool).assert_can_interact(
            user_id,
            other_user_id,
            action_label=action_label,
        )

    def _normalize_participant_ids(
        self,
        *,
        host_user_id: str,
        participant_user_ids: list[str],
    ) -> list[str]:
        seen: set[str] = set()
        ordered: list[str] = []
        for raw in participant_user_ids:
            user_id = str(raw).strip()
            if not user_id or user_id == host_user_id or user_id in seen:
                continue
            seen.add(user_id)
            ordered.append(user_id)
        return ordered

    async def _assert_can_call_many(
        self,
        user_id: str,
        other_user_ids: list[str],
        *,
        action_label: str,
    ) -> None:
        for other_user_id in other_user_ids:
            await self._assert_can_call(user_id, other_user_id, action_label=action_label)

    async def _participant_user_ids(self, conn: asyncpg.Connection, call_id: UUID) -> list[str]:
        rows = await conn.fetch(
            """
            SELECT user_id::text
            FROM video_call_participants
            WHERE call_id = $1
            ORDER BY created_at ASC
            """,
            call_id,
        )
        if rows:
            return [str(row["user_id"]) for row in rows]
        row = await conn.fetchrow(
            """
            SELECT caller_user_id::text, callee_user_id::text
            FROM video_calls
            WHERE id = $1
            """,
            call_id,
        )
        if not row:
            return []
        participants = [str(row["caller_user_id"])]
        if row["callee_user_id"]:
            participants.append(str(row["callee_user_id"]))
        return participants

    async def _insert_participants(
        self,
        conn: asyncpg.Connection,
        *,
        call_id: UUID,
        host_user_id: str,
        invitee_user_ids: list[str],
        invited_by_user_id: str,
    ) -> None:
        await conn.execute(
            """
            INSERT INTO video_call_participants (call_id, user_id, role, invited_by_user_id)
            VALUES ($1, $2, 'host', NULL)
            ON CONFLICT (call_id, user_id) DO NOTHING
            """,
            call_id,
            _as_uuid(host_user_id),
        )
        for invitee_id in invitee_user_ids:
            await conn.execute(
                """
                INSERT INTO video_call_participants (call_id, user_id, role, invited_by_user_id)
                VALUES ($1, $2, 'participant', $3)
                ON CONFLICT (call_id, user_id) DO NOTHING
                """,
                call_id,
                _as_uuid(invitee_id),
                _as_uuid(invited_by_user_id),
            )

    async def _user_profile(self, conn: asyncpg.Connection, user_id: str) -> dict[str, Any] | None:
        row = await conn.fetchrow(
            """
            SELECT id::text, email, username, full_name, avatar_url
            FROM users
            WHERE id = $1
            """,
            _as_uuid(user_id),
        )
        return dict(row) if row else None

    def _build_jwt(self, *, room_name: str, user_id: str, profile: dict[str, Any] | None) -> tuple[str, datetime]:
        now = datetime.now(UTC)
        exp = now + timedelta(seconds=unified_settings.jitsi_token_ttl_seconds)
        user_context: dict[str, Any] = {
            "id": user_id,
            "name": _display_name(profile, user_id),
            "moderator": True,
        }
        email = str(profile.get("email") or "").strip() if profile else ""
        if email:
            user_context["email"] = email
        avatar_url = str(profile.get("avatar_url") or "").strip() if profile else ""
        if avatar_url:
            safe_avatar = _meet_safe_avatar_url(avatar_url)
            if safe_avatar:
                user_context["avatar"] = safe_avatar
        payload = {
            "aud": self._jitsi_app_id,
            "iss": self._jitsi_app_id,
            "sub": self._jitsi_domain,
            "room": room_name,
            "nbf": int(now.timestamp()) - 5,
            "exp": int(exp.timestamp()),
            "context": {"user": user_context},
        }
        token = jwt.encode(payload, self._jitsi_secret, algorithm="HS256")
        return token, exp

    def _join_payload(
        self,
        row: asyncpg.Record | dict[str, Any],
        *,
        token: str,
        expires_at: datetime,
    ) -> VideoCallJoinResponse:
        data = dict(row)
        call_id = str(data["id"])
        chat_id = data.get("gaf_chat_id")
        room_name = str(data["room_name"])
        join_url = f"{self._meet_base_url}/{quote(room_name)}?jwt={quote(token)}#{_MEET_EMBED_HASH}"
        return VideoCallJoinResponse(
            call_id=call_id,
            chat_id=str(chat_id) if chat_id else None,
            room_name=room_name,
            status=str(data["status"]),
            call_kind=str(data.get("call_kind") or "direct"),
            meet_base_url=self._meet_base_url,
            jwt=token,
            join_url=join_url,
            expires_at=expires_at,
        )

    async def _append_gaf_call_event(
        self,
        *,
        chat_id: str | None,
        actor_user_id: str,
        call_id: str,
        event: str,
        status: str,
        duration_seconds: int | None = None,
        missed_reason: str | None = None,
    ) -> None:
        if not chat_id:
            return
        labels = {
            "ringing": "Видеозвонок начат",
            "accepted": "Видеозвонок принят",
            "ended": "Видеозвонок завершён",
            "missed": MISSED_REASON_LABELS.get(missed_reason or "", "Видеозвонок пропущен"),
        }
        metadata: dict[str, Any] = {
            "kind": "video_call_event",
            "event": event,
            "call_id": call_id,
            "status": status,
            "actor_user_id": actor_user_id,
        }
        if duration_seconds is not None:
            metadata["duration_seconds"] = duration_seconds
        if missed_reason:
            metadata["missed_reason"] = missed_reason
        try:
            await GafChatService(self.db_pool).send_video_call_event_message(
                chat_id,
                actor_user_id,
                labels.get(event, "Видеозвонок"),
                metadata=metadata,
            )
        except Exception as exc:  # noqa: BLE001
            # structlog: first positional is `event`; never pass kwarg event=.
            logger.warning(
                "video_call_gaf_event_failed",
                call_id=call_id,
                chat_id=chat_id,
                call_event=event,
                error=str(exc),
            )

    def _ringing_create_response(
        self,
        row: asyncpg.Record | dict[str, Any],
        *,
        callee_user_id: str,
        reused_existing: bool = False,
    ) -> VideoCallCreateResponse:
        data = dict(row)
        return VideoCallCreateResponse(
            call_id=str(data["id"]),
            chat_id=str(data["gaf_chat_id"]) if data.get("gaf_chat_id") else None,
            room_name=str(data["room_name"]),
            status=str(data["status"]),
            call_kind=str(data.get("call_kind") or "direct"),
            provider=str(data.get("provider") or "jitsi"),
            meet_base_url=None,
            jwt=None,
            join_url=None,
            expires_at=None,
            awaiting_accept=True,
            callee_user_id=callee_user_id,
            reused_existing=reused_existing,
        )

    async def create_gaf_call(self, *, chat_id: str, caller_user_id: str) -> CreateGafCallResult:
        """Create a 1:1 call for a GAF chat and return caller join data plus peer id.

        When an existing ringing call is reused and the requester is the **callee**,
        this accepts the call (same as ``/join``) so reverse-dial does not open a
        blank outgoing Meet window.
        """

        gaf_service = GafChatService(self.db_pool)
        chat = await gaf_service.get_chat_or_403(chat_id, caller_user_id)
        peer_user_id = gaf_service._other_user_id(chat, caller_user_id)
        await self._assert_can_call(
            caller_user_id,
            peer_user_id,
            action_label="начать видеозвонок",
        )
        _ = self._jitsi_secret  # Fail before persisting the call if stack11 signing is not configured.
        accept_existing_call_id: str | None = None
        accept_existing_callee = peer_user_id
        async with self.db_pool.acquire() as conn:
            existing = await conn.fetchrow(
                """
                SELECT id, provider, room_name, status, gaf_chat_id, caller_user_id, callee_user_id
                FROM video_calls
                WHERE gaf_chat_id = $1
                  AND status IN ('ringing', 'active')
                ORDER BY created_at DESC
                LIMIT 1
                """,
                _as_uuid(chat_id),
            )
            caller_profile = await self._user_profile(conn, caller_user_id)
            if existing:
                existing_caller = str(existing["caller_user_id"])
                existing_callee = str(existing["callee_user_id"]) if existing.get("callee_user_id") else peer_user_id
                if str(existing["status"]) == "active":
                    token, expires_at = self._build_jwt(
                        room_name=str(existing["room_name"]),
                        user_id=caller_user_id,
                        profile=caller_profile,
                    )
                    join = self._join_payload(existing, token=token, expires_at=expires_at)
                    payload = join.model_dump()
                    payload.update(
                        {
                            "callee_user_id": existing_callee,
                            "reused_existing": True,
                            "awaiting_accept": False,
                        }
                    )
                    response = VideoCallCreateResponse(**payload)
                    logger.info(
                        "video_call_reused",
                        call_id=response.call_id,
                        chat_id=chat_id,
                        room_name=response.room_name,
                        status="active",
                    )
                    return CreateGafCallResult(
                        response=response,
                        peer_user_id=peer_user_id,
                        created=False,
                        accepted_now=False,
                        caller_user_id=existing_caller,
                        callee_user_id=existing_callee,
                        chat_id=chat_id,
                    )
                # Ringing reuse: callee create → accept after releasing the pool conn.
                if caller_user_id == existing_callee:
                    accept_existing_call_id = str(existing["id"])
                    accept_existing_callee = existing_callee
                else:
                    response = self._ringing_create_response(
                        existing,
                        callee_user_id=existing_callee,
                        reused_existing=True,
                    )
                    logger.info(
                        "video_call_reused",
                        call_id=response.call_id,
                        chat_id=chat_id,
                        room_name=response.room_name,
                        status="ringing",
                    )
                    return CreateGafCallResult(
                        response=response,
                        peer_user_id=existing_callee,
                        created=False,
                        accepted_now=False,
                        caller_user_id=existing_caller,
                        callee_user_id=existing_callee,
                        chat_id=chat_id,
                    )

            if accept_existing_call_id is None:
                room_name = self._make_room_name()
                async with conn.transaction():
                    row = await conn.fetchrow(
                        """
                        INSERT INTO video_calls (
                            id, provider, room_name, status, created_by_user_id,
                            gaf_chat_id, caller_user_id, callee_user_id,
                            created_at, updated_at
                        )
                        VALUES ($1, 'jitsi', $2, 'ringing', $3, $4, $3, $5, NOW(), NOW())
                        RETURNING id, provider, room_name, status, gaf_chat_id, caller_user_id, callee_user_id
                        """,
                        uuid4(),
                        room_name,
                        _as_uuid(caller_user_id),
                        _as_uuid(chat_id),
                        _as_uuid(peer_user_id),
                    )
                response = self._ringing_create_response(row, callee_user_id=peer_user_id)
                await self._append_gaf_call_event(
                    chat_id=chat_id,
                    actor_user_id=caller_user_id,
                    call_id=response.call_id,
                    event="ringing",
                    status="ringing",
                )
                logger.info("video_call_created", call_id=response.call_id, chat_id=chat_id)
                return CreateGafCallResult(
                    response=response,
                    peer_user_id=peer_user_id,
                    created=True,
                    accepted_now=False,
                    caller_user_id=caller_user_id,
                    callee_user_id=peer_user_id,
                    chat_id=chat_id,
                )

        join_result = await self.join_call(
            call_id=accept_existing_call_id,
            user_id=caller_user_id,
        )
        response = VideoCallCreateResponse(
            **join_result.response.model_dump(),
            callee_user_id=join_result.callee_user_id or accept_existing_callee,
            reused_existing=True,
        )
        logger.info(
            "video_call_reused_as_callee_accept",
            call_id=response.call_id,
            chat_id=chat_id,
            room_name=response.room_name,
        )
        return CreateGafCallResult(
            response=response,
            peer_user_id=str(join_result.caller_user_id),
            created=False,
            accepted_now=bool(join_result.accepted_now),
            caller_user_id=join_result.caller_user_id,
            callee_user_id=join_result.callee_user_id,
            chat_id=join_result.chat_id or chat_id,
            call_kind=join_result.call_kind,
        )

    async def create_gaf_group_call(
        self,
        *,
        chat_id: str,
        host_user_id: str,
        additional_participant_ids: list[str],
    ) -> tuple[VideoCallCreateResponse, list[str], bool]:
        """Start a group call for a GAF chat: chat partner plus extra friends."""

        gaf_service = GafChatService(self.db_pool)
        chat = await gaf_service.get_chat_or_403(chat_id, host_user_id)
        partner_user_id = gaf_service._other_user_id(chat, host_user_id)
        invitee_ids = self._normalize_participant_ids(
            host_user_id=host_user_id,
            participant_user_ids=[partner_user_id, *additional_participant_ids],
        )
        if len(invitee_ids) < 2:
            raise ValueError("Group call requires the chat partner and at least one more participant")
        await self._assert_can_call_many(
            host_user_id,
            invitee_ids,
            action_label="начать групповой видеозвонок",
        )
        _ = self._jitsi_secret
        async with self.db_pool.acquire() as conn:
            existing = await conn.fetchrow(
                """
                SELECT id, provider, room_name, status, gaf_chat_id, caller_user_id, callee_user_id, call_kind
                FROM video_calls
                WHERE gaf_chat_id = $1
                  AND call_kind = 'group'
                  AND status IN ('ringing', 'active')
                ORDER BY created_at DESC
                LIMIT 1
                """,
                _as_uuid(chat_id),
            )
            host_profile = await self._user_profile(conn, host_user_id)
            if existing:
                token, expires_at = self._build_jwt(
                    room_name=str(existing["room_name"]),
                    user_id=host_user_id,
                    profile=host_profile,
                )
                join = self._join_payload(existing, token=token, expires_at=expires_at)
                response = VideoCallCreateResponse(
                    **join.model_dump(),
                    callee_user_id=partner_user_id,
                    invited_user_ids=[],
                    reused_existing=True,
                )
                logger.info(
                    "video_call_group_reused",
                    call_id=response.call_id,
                    chat_id=chat_id,
                    room_name=response.room_name,
                )
                return response, [], False

            room_name = self._make_room_name()
            call_id = uuid4()
            async with conn.transaction():
                row = await conn.fetchrow(
                    """
                    INSERT INTO video_calls (
                        id, provider, room_name, status, created_by_user_id,
                        gaf_chat_id, caller_user_id, callee_user_id, call_kind,
                        created_at, updated_at
                    )
                    VALUES ($1, 'jitsi', $2, 'ringing', $3, $4, $3, NULL, 'group', NOW(), NOW())
                    RETURNING id, provider, room_name, status, gaf_chat_id, caller_user_id, callee_user_id, call_kind
                    """,
                    call_id,
                    room_name,
                    _as_uuid(host_user_id),
                    _as_uuid(chat_id),
                )
                await self._insert_participants(
                    conn,
                    call_id=call_id,
                    host_user_id=host_user_id,
                    invitee_user_ids=invitee_ids,
                    invited_by_user_id=host_user_id,
                )
        token, expires_at = self._build_jwt(room_name=room_name, user_id=host_user_id, profile=host_profile)
        join = self._join_payload(row, token=token, expires_at=expires_at)
        response = VideoCallCreateResponse(
            **join.model_dump(),
            callee_user_id=partner_user_id,
            invited_user_ids=invitee_ids,
        )
        await self._append_gaf_call_event(
            chat_id=chat_id,
            actor_user_id=host_user_id,
            call_id=response.call_id,
            event="ringing",
            status="ringing",
        )
        logger.info("video_call_group_created", call_id=response.call_id, chat_id=chat_id, invitees=len(invitee_ids))
        return response, invitee_ids, True

    async def invite_to_call(
        self,
        *,
        call_id: str,
        inviter_user_id: str,
        participant_user_ids: list[str],
    ) -> list[str]:
        """Invite more friends into an active group call."""

        invitee_ids = self._normalize_participant_ids(
            host_user_id=inviter_user_id,
            participant_user_ids=participant_user_ids,
        )
        if not invitee_ids:
            raise ValueError("No new participants to invite")
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, status, call_kind, caller_user_id::text
                FROM video_calls
                WHERE id = $1
                """,
                _as_uuid(call_id),
            )
            if not row:
                raise VideoCallNotFoundError("Video call not found")
            if str(row["status"]) in {"ended", "missed"}:
                raise VideoCallEndedError("Video call has ended")
            if str(row["call_kind"]) != "group":
                raise ValueError("Only group calls support inviting additional participants")
            existing_ids = set(await self._participant_user_ids(conn, row["id"]))
            if inviter_user_id not in existing_ids and str(row["caller_user_id"]) != inviter_user_id:
                raise VideoCallNotFoundError("Video call not found")
            new_invitee_ids = [user_id for user_id in invitee_ids if user_id not in existing_ids]
            if not new_invitee_ids:
                return []
            await self._assert_can_call_many(
                inviter_user_id,
                new_invitee_ids,
                action_label="пригласить в видеозвонок",
            )
            async with conn.transaction():
                await self._insert_participants(
                    conn,
                    call_id=row["id"],
                    host_user_id=str(row["caller_user_id"]),
                    invitee_user_ids=new_invitee_ids,
                    invited_by_user_id=inviter_user_id,
                )
        logger.info(
            "video_call_invited",
            call_id=call_id,
            inviter_user_id=inviter_user_id,
            invited=len(new_invitee_ids),
        )
        return new_invitee_ids

    async def join_call(self, *, call_id: str, user_id: str) -> JoinCallResult:
        """Return a fresh meeting token if the user is one of the call participants."""

        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT vc.id, vc.provider, vc.room_name, vc.status, vc.gaf_chat_id,
                       vc.caller_user_id, vc.callee_user_id, vc.started_at, vc.call_kind
                FROM video_calls vc
                WHERE vc.id = $1
                  AND (
                    vc.caller_user_id = $2
                    OR vc.callee_user_id = $2
                    OR EXISTS (
                        SELECT 1
                        FROM video_call_participants vcp
                        WHERE vcp.call_id = vc.id
                          AND vcp.user_id = $2
                    )
                  )
                """,
                _as_uuid(call_id),
                _as_uuid(user_id),
            )
            if not row:
                raise VideoCallNotFoundError("Video call not found")
            if str(row["status"]) in {"ended", "missed"}:
                raise VideoCallEndedError("Video call has ended")
            caller_id = str(row["caller_user_id"])
            callee_id = str(row["callee_user_id"]) if row["callee_user_id"] else None
            call_kind = str(row.get("call_kind") or "direct")
            if call_kind == "group":
                await self._assert_can_call(
                    user_id,
                    caller_id,
                    action_label="присоединиться к видеозвонку",
                )
            else:
                if not callee_id:
                    raise VideoCallNotFoundError("Video call not found")
                other_user_id = callee_id if caller_id == user_id else caller_id
                await self._assert_can_call(
                    user_id,
                    other_user_id,
                    action_label="присоединиться к видеозвонку",
                )
            if call_kind == "direct" and str(row["status"]) == "ringing" and user_id == caller_id:
                raise VideoCallAwaitingAcceptError("awaiting_callee_accept")
            _ = self._jitsi_secret
            accepted_now = False
            if str(row["status"]) == "ringing":
                accepted_now = user_id != caller_id if call_kind == "group" else callee_id == user_id
            if accepted_now:
                updated = await conn.fetchrow(
                    """
                    UPDATE video_calls
                    SET status = 'active',
                        started_at = COALESCE(started_at, NOW()),
                        updated_at = NOW()
                    WHERE id = $1
                    RETURNING id, provider, room_name, status, gaf_chat_id, caller_user_id, callee_user_id, started_at, call_kind
                    """,
                    row["id"],
                )
                if updated:
                    row = updated
            profile = await self._user_profile(conn, user_id)
        token, expires_at = self._build_jwt(room_name=str(row["room_name"]), user_id=user_id, profile=profile)
        if accepted_now:
            await self._append_gaf_call_event(
                chat_id=str(row["gaf_chat_id"]) if row["gaf_chat_id"] else None,
                actor_user_id=user_id,
                call_id=str(row["id"]),
                event="accepted",
                status="active",
            )
        response = self._join_payload(row, token=token, expires_at=expires_at)
        return JoinCallResult(
            response=response,
            accepted_now=accepted_now,
            caller_user_id=caller_id,
            callee_user_id=callee_id,
            chat_id=str(row["gaf_chat_id"]) if row["gaf_chat_id"] else None,
            call_kind=call_kind,
        )

    async def list_pending_incoming_for_user(self, *, user_id: str) -> list[VideoCallPendingIncomingItem]:
        """Ringing 1:1 calls where ``user_id`` is the callee (desktop incoming recovery)."""

        from api.video_calls.call_target import (
            get_user_call_target,
            should_show_desktop_incoming_ui,
        )

        uid = str(user_id or "").strip()
        if not uid:
            return []
        call_target = await get_user_call_target(uid)
        if not should_show_desktop_incoming_ui(call_target):
            return []
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, gaf_chat_id, caller_user_id, created_at
                FROM video_calls
                WHERE status = 'ringing'
                  AND callee_user_id = $1::uuid
                  AND COALESCE(call_kind, 'direct') = 'direct'
                ORDER BY created_at ASC
                LIMIT 20
                """,
                _as_uuid(uid),
            )
        out: list[VideoCallPendingIncomingItem] = []
        for row in rows:
            created_at = row["created_at"]
            if not isinstance(created_at, datetime):
                continue
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=UTC)
            chat_raw = row["gaf_chat_id"]
            out.append(
                VideoCallPendingIncomingItem(
                    call_id=str(row["id"]),
                    chat_id=str(chat_raw) if chat_raw else None,
                    caller_user_id=str(row["caller_user_id"]),
                    created_at=created_at,
                    call_target=call_target,
                )
            )
        return out

    async def list_ringing_calls(self, *, limit: int = 50) -> list[RingingCallRow]:
        """Return direct 1:1 calls still in ringing for periodic reconcile."""

        capped = max(1, min(int(limit), 200))
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, status, created_at, ringing_delivered_at,
                       caller_user_id::text, callee_user_id::text, gaf_chat_id::text
                FROM video_calls
                WHERE status = 'ringing'
                  AND callee_user_id IS NOT NULL
                  AND COALESCE(call_kind, 'direct') = 'direct'
                ORDER BY created_at ASC
                LIMIT $1
                """,
                capped,
            )
        result: list[RingingCallRow] = []
        for row in rows:
            created_at = row["created_at"]
            if not isinstance(created_at, datetime):
                continue
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=UTC)
            delivered_at = row["ringing_delivered_at"]
            if delivered_at is not None and not isinstance(delivered_at, datetime):
                delivered_at = None
            elif isinstance(delivered_at, datetime) and delivered_at.tzinfo is None:
                delivered_at = delivered_at.replace(tzinfo=UTC)
            callee_raw = row["callee_user_id"]
            callee_user_id = str(callee_raw).strip() if callee_raw else ""
            if not callee_user_id:
                continue
            chat_raw = row["gaf_chat_id"]
            result.append(
                RingingCallRow(
                    id=str(row["id"]),
                    status=str(row["status"]),
                    created_at=created_at,
                    ringing_delivered_at=delivered_at,
                    caller_user_id=str(row["caller_user_id"]),
                    callee_user_id=callee_user_id,
                    gaf_chat_id=str(chat_raw) if chat_raw else None,
                )
            )
        return result

    async def mark_ringing_delivered(self, *, call_id: str) -> datetime | None:
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                UPDATE video_calls
                SET ringing_delivered_at = COALESCE(ringing_delivered_at, NOW()),
                    updated_at = NOW()
                WHERE id = $1
                  AND status = 'ringing'
                RETURNING ringing_delivered_at
                """,
                _as_uuid(call_id),
            )
        if not row:
            return None
        delivered_at = row["ringing_delivered_at"]
        return delivered_at if isinstance(delivered_at, datetime) else None

    async def end_call(
        self,
        *,
        call_id: str,
        user_id: str,
        missed_reason: str | None = None,
    ) -> tuple[list[str], bool, str | None, str]:
        """End a call if the user is a participant.

        Returns ``(other_participant_ids, already_ended, missed_reason, final_status)``.
        """

        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                WITH before AS (
                    SELECT id, status AS previous_status, gaf_chat_id, caller_user_id, callee_user_id, started_at
                    FROM video_calls
                    WHERE id = $1
                      AND (
                        caller_user_id = $2
                        OR callee_user_id = $2
                        OR EXISTS (
                            SELECT 1
                            FROM video_call_participants vcp
                            WHERE vcp.call_id = video_calls.id
                              AND vcp.user_id = $2
                        )
                      )
                    FOR UPDATE
                )
                UPDATE video_calls vc
                SET status = CASE
                        WHEN before.previous_status = 'ringing' THEN 'missed'
                        WHEN before.previous_status IN ('ended', 'missed') THEN before.previous_status
                        ELSE 'ended'
                    END,
                    missed_reason = CASE
                        WHEN before.previous_status = 'ringing' THEN COALESCE($3, vc.missed_reason)
                        WHEN before.previous_status IN ('ended', 'missed') THEN vc.missed_reason
                        ELSE NULL
                    END,
                    ended_at = COALESCE(vc.ended_at, NOW()),
                    updated_at = NOW()
                FROM before
                WHERE vc.id = before.id
                RETURNING vc.id, vc.gaf_chat_id, vc.status, before.previous_status,
                          vc.caller_user_id::text, vc.callee_user_id::text,
                          vc.started_at, vc.ended_at, vc.missed_reason
                """,
                _as_uuid(call_id),
                _as_uuid(user_id),
                missed_reason,
            )
        if not row:
            raise VideoCallNotFoundError("Video call not found")
        previous_status = str(row["previous_status"])
        status = str(row["status"])
        already_ended = previous_status in {"ended", "missed"}
        resolved_missed_reason = str(row["missed_reason"]).strip() if row["missed_reason"] else None
        if not already_ended and status == "missed" and not resolved_missed_reason:
            caller_id = str(row["caller_user_id"])
            callee_raw = row["callee_user_id"]
            callee_id = str(callee_raw).strip() if callee_raw else ""
            if user_id == caller_id:
                resolved_missed_reason = "caller_cancelled"
            elif callee_id and user_id == callee_id:
                resolved_missed_reason = "declined"
            else:
                resolved_missed_reason = "caller_cancelled"
            async with self.db_pool.acquire() as conn:
                await conn.execute(
                    """
                    UPDATE video_calls
                    SET missed_reason = $2, updated_at = NOW()
                    WHERE id = $1
                    """,
                    row["id"],
                    resolved_missed_reason,
                )
        if not already_ended:
            duration = _duration_seconds(row["started_at"], row["ended_at"])
            await self._append_gaf_call_event(
                chat_id=str(row["gaf_chat_id"]) if row["gaf_chat_id"] else None,
                actor_user_id=user_id,
                call_id=str(row["id"]),
                event="missed" if status == "missed" else "ended",
                status=status,
                duration_seconds=duration if status == "ended" else None,
                missed_reason=resolved_missed_reason if status == "missed" else None,
            )
        async with self.db_pool.acquire() as conn:
            participant_ids = await self._participant_user_ids(conn, row["id"])
        if participant_ids:
            other_user_ids = _notify_participant_user_ids(participant_ids, ending_user_id=user_id)
        else:
            caller_id = str(row["caller_user_id"])
            callee_raw = row["callee_user_id"]
            callee_id = str(callee_raw).strip() if callee_raw else ""
            fallback = callee_id if caller_id == user_id else caller_id
            other_user_ids = _notify_participant_user_ids([fallback], ending_user_id=user_id)
        return other_user_ids, already_ended, resolved_missed_reason if status == "missed" else None, status

    async def expire_ringing_call(self, *, call_id: str, missed_reason: str) -> tuple[list[str], bool]:
        """System-initiated end for ringing 1:1 calls (watchdog). Uses caller as actor."""
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, status, caller_user_id::text, callee_user_id::text, gaf_chat_id
                FROM video_calls
                WHERE id = $1
                """,
                _as_uuid(call_id),
            )
        if not row or str(row["status"]) != "ringing":
            return [], True
        caller_id = str(row["caller_user_id"])
        others, already_ended, _, _ = await self.end_call(
            call_id=call_id,
            user_id=caller_id,
            missed_reason=missed_reason,
        )
        return others, already_ended
