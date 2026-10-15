# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Friend request lifecycle: send, accept, reject, cancel, remove.
# Invariants:
# - Part of FriendsService package; do not import friends_service facade from here.
# Related:
# - api/services/friends_service.py
# ---

from __future__ import annotations

import logging
from uuid import UUID, uuid4

import asyncpg  # type: ignore[import-not-found,import-untyped]

from api.monitoring.metrics import observe_social_hub_friend_request
from api.services.friends.search import FriendsSearchMixin

logger = logging.getLogger(__name__)


class FriendsRequestsMixin(FriendsSearchMixin):
    async def _create_request(self, conn: asyncpg.Connection, from_user_id: UUID, to_user_id: UUID) -> dict:
        if from_user_id == to_user_id:
            raise ValueError("Нельзя отправить запрос самому себе")

        already_friends = await conn.fetchval(
            """
            SELECT 1
            FROM friendships
            WHERE user_id = $1 AND friend_id = $2
            LIMIT 1
            """,
            from_user_id,
            to_user_id,
        )
        if already_friends:
            raise ValueError("Пользователь уже в списке друзей")

        incoming_existing = await conn.fetchrow(
            """
            SELECT id
            FROM friend_requests
            WHERE from_user_id = $1 AND to_user_id = $2 AND status = 'pending'
            ORDER BY created_at DESC
            LIMIT 1
            """,
            to_user_id,
            from_user_id,
        )
        if incoming_existing:
            raise ValueError("У вас уже есть входящий запрос от этого пользователя")

        outgoing_existing = await conn.fetchrow(
            """
            SELECT id
            FROM friend_requests
            WHERE from_user_id = $1 AND to_user_id = $2 AND status = 'pending'
            ORDER BY created_at DESC
            LIMIT 1
            """,
            from_user_id,
            to_user_id,
        )
        if outgoing_existing:
            raise ValueError("Запрос уже отправлен")

        request_id = uuid4()
        await conn.execute(
            """
            INSERT INTO friend_requests (id, from_user_id, to_user_id, status)
            VALUES ($1, $2, $3, 'pending')
            """,
            request_id,
            from_user_id,
            to_user_id,
        )
        await conn.execute(
            """
            INSERT INTO friend_request_history (request_id, event, actor_user_id)
            VALUES ($1, 'sent', $2)
            """,
            request_id,
            from_user_id,
        )
        return {"request_id": str(request_id), "status": "pending"}

    async def send_request(self, from_user_id: str, to_username: str) -> dict:
        """
        Send friend request to user identified by username.
        Returns { "request_id": str, "status": "pending" } or raises ValueError.

        Product: exact username still resolves even when discoverability is hidden (user is omitted
        from search for non-friends); only directory search is filtered server-side.
        """
        to_user = await self.find_user_by_username(to_username)
        if not to_user:
            raise ValueError("Пользователь с таким ником не найден")
        return await self.send_request_to_user(from_user_id, to_user["id"])

    async def send_request_to_user(self, from_user_id: str, to_user_id: str) -> dict:
        """Send friend request directly to a target user id."""
        from_uuid = self._parse_user_uuid(from_user_id)
        to_uuid = self._parse_user_uuid(to_user_id)
        if from_uuid is None or to_uuid is None:
            raise ValueError("Некорректный идентификатор пользователя")

        async with self.db_pool.acquire() as conn, conn.transaction():
            sys_acc = await conn.fetchval(
                "SELECT COALESCE(is_system_account, FALSE) FROM users WHERE id = $1 LIMIT 1",
                to_uuid,
            )
            if sys_acc is None:
                raise ValueError("Пользователь не найден")
            if bool(sys_acc):
                raise ValueError("Нельзя отправить запрос системному пользователю")
            if await conn.fetchval(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM friendships
                    WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))
                      AND COALESCE(is_blocked, false) = true
                )
                """,
                from_uuid,
                to_uuid,
            ):
                observe_social_hub_friend_request(outcome="blocked")
                raise ValueError("Нельзя отправить запрос заблокированному пользователю")
            sent_today = await conn.fetchval(
                """
                SELECT COUNT(*)
                FROM friend_requests
                WHERE from_user_id = $1
                  AND created_at >= NOW() - INTERVAL '24 hours'
                """,
                from_uuid,
            )
            if int(sent_today or 0) >= 30:
                observe_social_hub_friend_request(outcome="rate_limited")
                raise ValueError("Достигнут лимит заявок за 24 часа")
            result = await self._create_request(conn, from_uuid, to_uuid)

        logger.info("Friend request sent from %s to %s", from_uuid, to_uuid)
        observe_social_hub_friend_request(outcome="sent")
        return {
            **result,
            "from_user_id": str(from_uuid),
            "to_user_id": str(to_uuid),
        }

    async def accept_request(self, request_id: UUID, current_user_id: str) -> dict:
        """Accept a friend request (must be to_user_id = current_user_id)."""
        try:
            current_uuid = UUID(str(current_user_id).strip())
        except (ValueError, TypeError) as exc:
            raise ValueError("Некорректный идентификатор пользователя") from exc
        async with self.db_pool.acquire() as conn, conn.transaction():
            row = await conn.fetchrow(
                "SELECT from_user_id, to_user_id, status FROM friend_requests WHERE id = $1",
                request_id,
            )
            if not row:
                raise ValueError("Запрос не найден")
            to_uuid = row["to_user_id"]
            from_uuid = row["from_user_id"]
            if to_uuid != current_uuid:
                raise ValueError("Нельзя принять чужой запрос")
            if row["status"] != "pending":
                raise ValueError("Запрос уже обработан")

            await conn.execute(
                """
                UPDATE friend_requests SET status = 'accepted', responded_at = NOW(), responded_by = $1
                WHERE id = $2
                """,
                current_uuid,
                request_id,
            )
            await conn.execute(
                """
                INSERT INTO friend_request_history (request_id, event, actor_user_id)
                VALUES ($1, 'accepted', $2)
                """,
                request_id,
                current_uuid,
            )
            await conn.execute(
                "INSERT INTO friendships (user_id, friend_id) VALUES ($1, $2) ON CONFLICT (user_id, friend_id) DO NOTHING",
                from_uuid,
                to_uuid,
            )
            await conn.execute(
                "INSERT INTO friendships (user_id, friend_id) VALUES ($1, $2) ON CONFLICT (user_id, friend_id) DO NOTHING",
                to_uuid,
                from_uuid,
            )
        logger.info("Friend request %s accepted; %s and %s are now friends", request_id, from_uuid, to_uuid)
        return {
            "status": "accepted",
            "from_user_id": str(from_uuid),
            "to_user_id": str(to_uuid),
        }

    async def reject_request(self, request_id: UUID, current_user_id: str) -> dict:
        """Reject a friend request (must be to_user_id = current_user_id)."""
        uid = str(current_user_id).strip()
        async with self.db_pool.acquire() as conn, conn.transaction():
            row = await conn.fetchrow(
                "SELECT from_user_id, to_user_id, status FROM friend_requests WHERE id = $1",
                request_id,
            )
            if not row:
                raise ValueError("Запрос не найден")
            if str(row["to_user_id"]) != uid:
                raise ValueError("Нельзя отклонить чужой запрос")
            if row["status"] != "pending":
                raise ValueError("Запрос уже обработан")

            await conn.execute(
                """
                    UPDATE friend_requests SET status = 'rejected', responded_at = NOW(), responded_by = $1
                    WHERE id = $2
                    """,
                uid,
                request_id,
            )
            await conn.execute(
                """
                    INSERT INTO friend_request_history (request_id, event, actor_user_id)
                    VALUES ($1, 'rejected', $2)
                    """,
                request_id,
                uid,
            )
        logger.info("Friend request %s rejected", request_id)
        return {
            "status": "rejected",
            "from_user_id": str(row["from_user_id"]),
            "to_user_id": str(row["to_user_id"]),
        }

    async def cancel_request(self, request_id: UUID, current_user_id: str) -> dict:
        """Cancel a sent friend request (must be from_user_id = current_user_id)."""
        try:
            current_uuid = UUID(str(current_user_id).strip())
        except (ValueError, TypeError) as exc:
            raise ValueError("Некорректный идентификатор пользователя") from exc
        async with self.db_pool.acquire() as conn, conn.transaction():
            row = await conn.fetchrow(
                "SELECT from_user_id, to_user_id, status FROM friend_requests WHERE id = $1",
                request_id,
            )
            if not row:
                raise ValueError("Запрос не найден")
            if row["from_user_id"] != current_uuid:
                raise ValueError("Нельзя отменить чужой запрос")
            if row["status"] != "pending":
                raise ValueError("Запрос уже обработан")

            await conn.execute(
                """
                    UPDATE friend_requests SET status = 'cancelled', responded_at = NOW(), responded_by = $1
                    WHERE id = $2
                    """,
                current_uuid,
                request_id,
            )
            await conn.execute(
                """
                    INSERT INTO friend_request_history (request_id, event, actor_user_id)
                    VALUES ($1, 'cancelled', $2)
                    """,
                request_id,
                current_uuid,
            )
        logger.info("Friend request %s cancelled", request_id)
        return {
            "status": "cancelled",
            "from_user_id": str(row["from_user_id"]),
            "to_user_id": str(row["to_user_id"]),
        }

    async def remove_friend(self, current_user_id: str, friend_user_id: str) -> dict:
        """Remove friendship between current user and friend_user_id (mutual)."""
        uid = str(current_user_id).strip()
        fid = str(friend_user_id).strip()
        async with self.db_pool.acquire() as conn, conn.transaction():
            deleted = await conn.execute(
                """
                    DELETE FROM friendships
                    WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)
                    """,
                uid,
                fid,
            )
            if deleted == "DELETE 0":
                raise ValueError("Пользователь не в списке друзей")
            await conn.execute(
                """
                    DELETE FROM friend_circle_memberships
                    WHERE (owner_user_id = $1 AND friend_user_id = $2)
                       OR (owner_user_id = $2 AND friend_user_id = $1)
                    """,
                uid,
                fid,
            )
        logger.info("Friendship removed between %s and %s", uid, fid)
        return {
            "status": "removed",
            "current_user_id": uid,
            "friend_user_id": fid,
        }
