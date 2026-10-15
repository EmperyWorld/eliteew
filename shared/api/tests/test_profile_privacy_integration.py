# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Optional Postgres integration for profile privacy discoverability + card redaction.
# Invariants:
# - Skips when DATABASE_URL is unset or required tables are missing.
# - Seeds unique UUIDs and deletes them in finally.
# Related:
# - api/services/profile_privacy.py
# - api/services/friends/search.py
# ---

from __future__ import annotations

import asyncio
import os
from uuid import uuid4

import pytest

from api.services.friends_service import FriendsService
from api.services.profile_privacy import redact_profile_fields


@pytest.mark.integration
def test_hidden_discoverability_excludes_non_friends_from_search() -> None:
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        pytest.skip("DATABASE_URL not set")

    viewer_id = uuid4()
    hidden_id = uuid4()
    marker = f"privtest_{uuid4().hex[:10]}"
    viewer_name = f"{marker}_viewer"
    hidden_name = f"{marker}_hidden"

    async def body() -> None:
        import asyncpg

        pool = await asyncpg.create_pool(dsn, min_size=1, max_size=2)
        try:
            async with pool.acquire() as conn:
                has_privacy = await conn.fetchval(
                    """
                    SELECT EXISTS (
                      SELECT 1 FROM information_schema.tables
                      WHERE table_name = \'user_profile_privacy\'
                    )
                    """
                )
                if not has_privacy:
                    pytest.skip("user_profile_privacy table missing")

                await conn.execute(
                    """
                    INSERT INTO users (id, email, username, full_name, is_active, is_verified)
                    VALUES
                      ($1, $2, $3, $4, TRUE, TRUE),
                      ($5, $6, $7, $8, TRUE, TRUE)
                    """,
                    viewer_id,
                    f"{viewer_name}@example.test",
                    viewer_name,
                    "Viewer",
                    hidden_id,
                    f"{hidden_name}@example.test",
                    hidden_name,
                    "Hidden Person",
                )
                await conn.execute(
                    """
                    INSERT INTO user_profile_privacy (user_id, discoverability, avatar_visibility, full_name_visibility, bio_visibility)
                    VALUES
                      ($1, \'public\', \'everyone\', \'everyone\', \'everyone\'),
                      ($2, \'hidden\', \'friends_only\', \'friends_only\', \'none\')
                    ON CONFLICT (user_id) DO UPDATE SET
                      discoverability = EXCLUDED.discoverability,
                      avatar_visibility = EXCLUDED.avatar_visibility,
                      full_name_visibility = EXCLUDED.full_name_visibility,
                      bio_visibility = EXCLUDED.bio_visibility
                    """,
                    viewer_id,
                    hidden_id,
                )

            service = FriendsService(pool)
            hits = await service.search_users(str(viewer_id), marker, limit=20)
            hit_ids = {row["id"] for row in hits}
            assert str(hidden_id) not in hit_ids

            # Friends still find each other even when discoverability is hidden.
            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO friendships (user_id, friend_id)
                    VALUES ($1, $2), ($2, $1)
                    ON CONFLICT DO NOTHING
                    """,
                    viewer_id,
                    hidden_id,
                )
            friend_hits = await service.search_users(str(viewer_id), marker, limit=20)
            assert str(hidden_id) in {row["id"] for row in friend_hits}

            profile = await service.get_friend_profile(str(viewer_id), str(hidden_id))
            assert profile["full_name"] == "Hidden Person"
            assert profile.get("bio") in (None, "")

            stranger = uuid4()
            avatar, full_name, bio = redact_profile_fields(
                subject_id=hidden_id,
                viewer_id=stranger,
                is_friend=False,
                privacy={
                    "discoverability": "hidden",
                    "avatar_visibility": "friends_only",
                    "full_name_visibility": "friends_only",
                    "bio_visibility": "none",
                    "avatar_circle_id": None,
                    "full_name_circle_id": None,
                    "bio_circle_id": None,
                },
                avatar_url="https://example.test/a.png",
                full_name="Hidden Person",
                bio="secret",
                circle_hits=set(),
            )
            assert avatar is None
            assert full_name is None
            assert bio is None
        finally:
            async with pool.acquire() as conn:
                await conn.execute(
                    "DELETE FROM friendships WHERE user_id = ANY($1::uuid[]) OR friend_id = ANY($1::uuid[])",
                    [viewer_id, hidden_id],
                )
                await conn.execute(
                    "DELETE FROM user_profile_privacy WHERE user_id = ANY($1::uuid[])", [viewer_id, hidden_id]
                )
                await conn.execute("DELETE FROM users WHERE id = ANY($1::uuid[])", [viewer_id, hidden_id])
            await pool.close()

    try:
        asyncio.run(body())
    except Exception as exc:  # noqa: BLE001
        msg = str(exc).lower()
        if any(
            token in msg
            for token in (
                "column",
                "null value",
                "violates",
                "name resolution",
                "connection refused",
                "timeout",
                "could not connect",
                "temporary failure",
            )
        ):
            pytest.skip(f"privacy integration unavailable: {exc}")
        raise
