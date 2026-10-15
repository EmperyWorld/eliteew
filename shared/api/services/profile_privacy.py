# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `services/profile_privacy.py`; preserves its existing EliteEW API/service responsibilities.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

"""
Central profile privacy evaluation (discoverability + per-field visibility with friend circles).

Used by friends search, GAF user search, and get_friend_profile — keep SQL fragments and rules here.
"""

from __future__ import annotations

from typing import Literal
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]

Discoverability = Literal["public", "hidden"]

# Unauthenticated GAF user search: viewer must not equal any real subject id.
GAF_ANONYMOUS_VIEWER_ID = UUID("00000000-0000-0000-0000-000000000001")
FieldVisibility = Literal["everyone", "friends_only", "none", "circle"]
PrivacyField = Literal["avatar", "full_name", "bio"]

DISCOVERABILITY_PUBLIC: Discoverability = "public"
DISCOVERABILITY_HIDDEN: Discoverability = "hidden"


def search_discoverability_predicate(viewer_sql_param: str) -> str:
    """
    SQL fragment: subject u is visible in user search to viewer identified by asyncpg placeholder
    (e.g. '$1' for friends search, '$3' for GAF search where $1/$2 are pattern/limit).
    Requires LEFT JOIN user_profile_privacy upp ON upp.user_id = u.id.
    """
    return f"""(
  COALESCE(upp.discoverability, 'public') = 'public'
  OR EXISTS (
    SELECT 1 FROM friendships fdf
    WHERE fdf.user_id = {viewer_sql_param}::uuid AND fdf.friend_id = u.id
  )
)"""


# Viewer is $1 (friends search).
SEARCH_DISCOVERABILITY_WHERE = search_discoverability_predicate("$1")


def _default_visibility(value: object | None) -> FieldVisibility:
    raw = (value or "everyone") if value is not None else "everyone"
    s = str(raw).strip().lower()
    if s in ("everyone", "friends_only", "none", "circle"):
        return s  # type: ignore[return-value]
    return "everyone"


def field_visible_for_viewer(
    *,
    field: PrivacyField,
    visibility: object | None,
    circle_id: UUID | None,
    viewer_id: UUID,
    subject_id: UUID,
    is_friend: bool,
    viewer_in_circle: bool | None,
) -> bool:
    """
    Whether subject may expose `field` to viewer.

    viewer_in_circle: required when visibility == 'circle'; True if viewer is in subject's circle for this field.
    """
    if viewer_id == subject_id:
        return True
    vis = _default_visibility(visibility)
    if vis == "none":
        return False
    if vis == "everyone":
        return True
    if vis == "friends_only":
        return is_friend
    if vis == "circle":
        if circle_id is None:
            return False
        return bool(viewer_in_circle)
    return False


async def viewer_in_friend_circle(
    conn: asyncpg.Connection,
    *,
    owner_user_id: UUID,
    viewer_user_id: UUID,
    circle_id: UUID | None,
) -> bool:
    if circle_id is None:
        return False
    row = await conn.fetchrow(
        """
        SELECT 1
        FROM friend_circle_memberships m
        WHERE m.circle_id = $1
          AND m.owner_user_id = $2
          AND m.friend_user_id = $3
        LIMIT 1
        """,
        circle_id,
        owner_user_id,
        viewer_user_id,
    )
    return row is not None


async def batch_viewer_circle_hits(
    conn: asyncpg.Connection,
    *,
    viewer_user_id: UUID,
    pairs: list[tuple[UUID, UUID]],
) -> set[tuple[UUID, UUID]]:
    """
    pairs: (circle_id, owner_user_id) to test for membership.
    Returns set of (owner_user_id, circle_id) where viewer is in that circle.
    """
    if not pairs:
        return set()
    circle_ids = [p[0] for p in pairs]
    owner_ids = [p[1] for p in pairs]
    rows = await conn.fetch(
        """
        SELECT m.circle_id, m.owner_user_id
        FROM friend_circle_memberships m
        INNER JOIN UNNEST($1::uuid[], $2::uuid[]) AS t(circle_id, owner_user_id)
          ON m.circle_id = t.circle_id AND m.owner_user_id = t.owner_user_id
        WHERE m.friend_user_id = $3::uuid
        """,
        circle_ids,
        owner_ids,
        viewer_user_id,
    )
    return {(r["owner_user_id"], r["circle_id"]) for r in rows}


def privacy_row_dict(row: asyncpg.Record | None) -> dict[str, object | None]:
    if row is None:
        return {
            "discoverability": DISCOVERABILITY_PUBLIC,
            "avatar_visibility": "everyone",
            "avatar_circle_id": None,
            "full_name_visibility": "everyone",
            "full_name_circle_id": None,
            "bio_visibility": "everyone",
            "bio_circle_id": None,
        }
    return {
        "discoverability": row.get("discoverability") or DISCOVERABILITY_PUBLIC,
        "avatar_visibility": row.get("avatar_visibility"),
        "avatar_circle_id": row.get("avatar_circle_id"),
        "full_name_visibility": row.get("full_name_visibility"),
        "full_name_circle_id": row.get("full_name_circle_id"),
        "bio_visibility": row.get("bio_visibility"),
        "bio_circle_id": row.get("bio_circle_id"),
    }


def privacy_from_joined_row(row: asyncpg.Record) -> dict[str, object | None]:
    """Build privacy dict from SQL with LEFT JOIN user_profile_privacy (add `privacy_join_present` in SELECT)."""
    if not row.get("privacy_join_present"):
        return privacy_row_dict(None)
    return {
        "discoverability": row.get("discoverability") or DISCOVERABILITY_PUBLIC,
        "avatar_visibility": row.get("avatar_visibility"),
        "avatar_circle_id": row.get("avatar_circle_id"),
        "full_name_visibility": row.get("full_name_visibility"),
        "full_name_circle_id": row.get("full_name_circle_id"),
        "bio_visibility": row.get("bio_visibility"),
        "bio_circle_id": row.get("bio_circle_id"),
    }


async def fetch_privacy_map(conn: asyncpg.Connection, user_ids: list[UUID]) -> dict[UUID, dict[str, object | None]]:
    if not user_ids:
        return {}
    rows = await conn.fetch(
        """
        SELECT user_id, discoverability,
               avatar_visibility, avatar_circle_id,
               full_name_visibility, full_name_circle_id,
               bio_visibility, bio_circle_id
        FROM user_profile_privacy
        WHERE user_id = ANY($1::uuid[])
        """,
        user_ids,
    )
    out: dict[UUID, dict[str, object | None]] = {}
    for r in rows:
        uid = r["user_id"]
        out[uid] = privacy_row_dict(r)
    for uid in user_ids:
        if uid not in out:
            out[uid] = privacy_row_dict(None)
    return out


def redact_profile_fields(
    *,
    subject_id: UUID,
    viewer_id: UUID,
    is_friend: bool,
    privacy: dict[str, object | None],
    avatar_url: str | None,
    full_name: str | None,
    bio: str | None,
    circle_hits: set[tuple[UUID, UUID]],
) -> tuple[str | None, str | None, str | None]:
    """Return possibly redacted (avatar_url, full_name, bio)."""

    def _circle_ok(circle_id: object | None, field: PrivacyField) -> bool:
        if circle_id is None:
            return False
        try:
            cid = circle_id if isinstance(circle_id, UUID) else UUID(str(circle_id))
        except (ValueError, TypeError):  # fmt: skip
            return False
        return (subject_id, cid) in circle_hits

    av_vis = privacy.get("avatar_visibility")
    av_c = privacy.get("avatar_circle_id")
    fn_vis = privacy.get("full_name_visibility")
    fn_c = privacy.get("full_name_circle_id")
    bio_vis = privacy.get("bio_visibility")
    bio_c = privacy.get("bio_circle_id")

    out_avatar = avatar_url
    if not field_visible_for_viewer(
        field="avatar",
        visibility=av_vis,
        circle_id=av_c if isinstance(av_c, UUID) else None,
        viewer_id=viewer_id,
        subject_id=subject_id,
        is_friend=is_friend,
        viewer_in_circle=_circle_ok(av_c, "avatar"),
    ):
        out_avatar = None

    out_fn = full_name
    if not field_visible_for_viewer(
        field="full_name",
        visibility=fn_vis,
        circle_id=fn_c if isinstance(fn_c, UUID) else None,
        viewer_id=viewer_id,
        subject_id=subject_id,
        is_friend=is_friend,
        viewer_in_circle=_circle_ok(fn_c, "full_name"),
    ):
        out_fn = None

    out_bio = bio
    if not field_visible_for_viewer(
        field="bio",
        visibility=bio_vis,
        circle_id=bio_c if isinstance(bio_c, UUID) else None,
        viewer_id=viewer_id,
        subject_id=subject_id,
        is_friend=is_friend,
        viewer_in_circle=_circle_ok(bio_c, "bio"),
    ):
        out_bio = None

    return out_avatar, out_fn, out_bio
