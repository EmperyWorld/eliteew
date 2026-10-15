# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Owner-scoped friend circles CRUD and membership sync.
# Invariants:
# - Part of FriendsService package; do not import friends_service facade from here.
# Related:
# - api/services/friends_service.py
# ---

from __future__ import annotations

from uuid import UUID, uuid4

import asyncpg  # type: ignore[import-not-found,import-untyped]

from api.services.friends.base import FriendsServiceBase


class FriendsCirclesMixin(FriendsServiceBase):
    async def _fetch_circles(self, conn: asyncpg.Connection, owner_user_id: UUID) -> list[dict]:
        rows = await conn.fetch(
            """
            SELECT
                c.id,
                c.name,
                c.sort_order,
                c.color,
                c.icon,
                COALESCE(member_counts.members_count, 0) AS members_count
            FROM friend_circles c
            LEFT JOIN (
                SELECT circle_id, COUNT(*)::int AS members_count
                FROM friend_circle_memberships
                WHERE owner_user_id = $1
                GROUP BY circle_id
            ) AS member_counts ON member_counts.circle_id = c.id
            WHERE c.owner_user_id = $1
            ORDER BY c.sort_order ASC, LOWER(BTRIM(c.name)) ASC, c.created_at ASC
            """,
            owner_user_id,
        )
        return [self._serialize_circle_row(row) for row in rows]

    async def _fetch_circle_rows_for_friend_ids(
        self,
        conn: asyncpg.Connection,
        owner_user_id: UUID,
        friend_ids: list[UUID],
    ) -> dict[str, list[dict]]:
        if not friend_ids:
            return {}
        rows = await conn.fetch(
            """
            SELECT
                m.friend_user_id,
                c.id,
                c.name,
                c.sort_order,
                c.color,
                c.icon
            FROM friend_circle_memberships m
            JOIN friend_circles c ON c.id = m.circle_id
            WHERE m.owner_user_id = $1
              AND m.friend_user_id = ANY($2::uuid[])
            ORDER BY c.sort_order ASC, LOWER(BTRIM(c.name)) ASC, c.created_at ASC
            """,
            owner_user_id,
            friend_ids,
        )
        circle_map: dict[str, list[dict]] = {}
        for row in rows:
            friend_id = str(row["friend_user_id"])
            circle_map.setdefault(friend_id, []).append(
                {
                    "id": str(row["id"]),
                    "name": row["name"],
                    "members_count": 0,
                    "sort_order": int(row.get("sort_order", 0)),
                    "color": row.get("color"),
                    "icon": row.get("icon"),
                }
            )
        return circle_map

    async def _fetch_friend_circles(
        self,
        conn: asyncpg.Connection,
        owner_user_id: UUID,
        friend_user_id: UUID,
    ) -> list[dict]:
        circle_map = await self._fetch_circle_rows_for_friend_ids(conn, owner_user_id, [friend_user_id])
        return circle_map.get(str(friend_user_id), [])

    async def _sync_friend_circles(
        self,
        conn: asyncpg.Connection,
        owner_user_id: UUID,
        friend_user_id: UUID,
        circle_ids: list[str],
    ) -> None:
        normalized_ids: list[UUID] = []
        seen_ids: set[UUID] = set()
        for raw_circle_id in circle_ids:
            circle_uuid = self._parse_user_uuid(raw_circle_id)
            if circle_uuid is None:
                raise ValueError("Некорректный идентификатор круга")
            if circle_uuid not in seen_ids:
                seen_ids.add(circle_uuid)
                normalized_ids.append(circle_uuid)

        if normalized_ids:
            owned_rows = await conn.fetch(
                """
                SELECT id
                FROM friend_circles
                WHERE owner_user_id = $1 AND id = ANY($2::uuid[])
                """,
                owner_user_id,
                normalized_ids,
            )
            owned_ids = {row["id"] for row in owned_rows}
            if len(owned_ids) != len(normalized_ids):
                raise ValueError("Один или несколько кругов не найдены")

        await conn.execute(
            """
            DELETE FROM friend_circle_memberships
            WHERE owner_user_id = $1 AND friend_user_id = $2
            """,
            owner_user_id,
            friend_user_id,
        )

        for circle_uuid in normalized_ids:
            await conn.execute(
                """
                INSERT INTO friend_circle_memberships (circle_id, owner_user_id, friend_user_id)
                VALUES ($1, $2, $3)
                ON CONFLICT (circle_id, friend_user_id) DO NOTHING
                """,
                circle_uuid,
                owner_user_id,
                friend_user_id,
            )

    async def list_circles(self, user_id: str) -> list[dict]:
        owner_uuid = self._parse_user_uuid(user_id)
        if owner_uuid is None:
            return []
        async with self.db_pool.acquire() as conn:
            return await self._fetch_circles(conn, owner_uuid)

    async def create_circle(self, user_id: str, name: str) -> dict:
        owner_uuid = self._parse_user_uuid(user_id)
        if owner_uuid is None:
            raise ValueError("Некорректный идентификатор пользователя")
        normalized_name = self._normalize_circle_name(name)

        async with self.db_pool.acquire() as conn:
            existing = await conn.fetchrow(
                """
                SELECT id
                FROM friend_circles
                WHERE owner_user_id = $1 AND LOWER(BTRIM(name)) = LOWER(BTRIM($2))
                LIMIT 1
                """,
                owner_uuid,
                normalized_name,
            )
            if existing:
                raise ValueError("Круг с таким названием уже существует")

            circle_id = uuid4()
            sort_order = await conn.fetchval(
                "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM friend_circles WHERE owner_user_id = $1",
                owner_uuid,
            )
            await conn.execute(
                """
                INSERT INTO friend_circles (id, owner_user_id, name, sort_order)
                VALUES ($1, $2, $3, $4)
                """,
                circle_id,
                owner_uuid,
                normalized_name,
                int(sort_order or 0),
            )
            row = await conn.fetchrow(
                """
                SELECT id, name, sort_order, color, icon, 0::int AS members_count
                FROM friend_circles
                WHERE id = $1 AND owner_user_id = $2
                """,
                circle_id,
                owner_uuid,
            )
        if row is None:
            raise ValueError("Не удалось создать круг")
        return self._serialize_circle_row(row)

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
        owner_uuid = self._parse_user_uuid(user_id)
        circle_uuid = self._parse_user_uuid(circle_id)
        if owner_uuid is None or circle_uuid is None:
            raise ValueError("Некорректный идентификатор круга")

        update_parts: list[str] = []
        params: list[object] = [owner_uuid, circle_uuid]
        param_index = 3

        if name is not None:
            normalized_name = self._normalize_circle_name(name)
            update_parts.append(f"name = ${param_index}")
            params.append(normalized_name)
            param_index += 1
        if sort_order is not None:
            update_parts.append(f"sort_order = ${param_index}")
            params.append(int(sort_order))
            param_index += 1
        if color is not None:
            normalized_color = color.strip() or None
            update_parts.append(f"color = ${param_index}")
            params.append(normalized_color)
            param_index += 1
        if icon is not None:
            normalized_icon = icon.strip() or None
            update_parts.append(f"icon = ${param_index}")
            params.append(normalized_icon)
            param_index += 1

        if not update_parts:
            raise ValueError("Нет данных для обновления круга")

        update_parts.append("updated_at = NOW()")
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                f"""
                UPDATE friend_circles
                SET {", ".join(update_parts)}
                WHERE owner_user_id = $1 AND id = $2
                RETURNING id, name, sort_order, color, icon, 0::int AS members_count
                """,
                *params,
            )
        if row is None:
            raise ValueError("Круг не найден")
        return self._serialize_circle_row(row)

    async def delete_circle(self, user_id: str, circle_id: str) -> None:
        owner_uuid = self._parse_user_uuid(user_id)
        circle_uuid = self._parse_user_uuid(circle_id)
        if owner_uuid is None or circle_uuid is None:
            raise ValueError("Некорректный идентификатор круга")

        async with self.db_pool.acquire() as conn:
            deleted = await conn.fetchrow(
                """
                DELETE FROM friend_circles
                WHERE id = $1 AND owner_user_id = $2
                RETURNING id
                """,
                circle_uuid,
                owner_uuid,
            )
        if deleted is None:
            raise ValueError("Круг не найден")
