# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   Admin-only GAF chat helpers: list desktop apps visible to the chat partner and
#   build validated desktop_app_link message payloads (no /desktop/admin routes).
# Invariants:
#   - Caller must be admin/emperyworld_admin; partner app visibility mirrors desktop store rules.
#   - open_app_component must be a known desktop component (catalog CRUD gate); legacy hidden apps excluded.
# Related:
#   - api/gaf_chat/router.py; api/routers/desktop.py (_user_can_see_app semantics)
# ---

from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found,import-untyped]

from api.core.auth import User as AuthUser
from api.routers.desktop import (
    DEFAULT_ACCESS_GROUP_ID,
    KNOWN_DESKTOP_APP_COMPONENTS,
    LEGACY_HIDDEN_DESKTOP_APP_COMPONENTS,
    LEGACY_HIDDEN_DESKTOP_APP_IDS,
)

GAF_ADMIN_ROLES: frozenset[str] = frozenset({"admin", "emperyworld_admin"})
DESKTOP_APP_LINK_KIND = "desktop_app_link"
_MAX_NOTE_LEN = 500


def is_gaf_admin_auth_user(user: AuthUser) -> bool:
    """True when OAuth user has EliteEW application admin role."""
    role = (user.role or "").strip().lower()
    return role in GAF_ADMIN_ROLES


def partner_can_see_catalog_row(
    *,
    is_system: bool,
    partner_role: str,
    partner_group_id: UUID,
    access_group_ids: list[UUID],
) -> bool:
    """Mirror ``_user_can_see_app`` from desktop router for a catalog row."""
    if is_system:
        return partner_role.strip().lower() in GAF_ADMIN_ROLES
    if not access_group_ids:
        return True
    allowed = set(access_group_ids)
    return partner_group_id in allowed


def _is_legacy_hidden(app_id: str | None, app_component: str | None) -> bool:
    if app_id and app_id in LEGACY_HIDDEN_DESKTOP_APP_IDS:
        return True
    return bool(app_component) and app_component in LEGACY_HIDDEN_DESKTOP_APP_COMPONENTS


def build_desktop_app_link_metadata(
    *,
    app_id: str,
    app_name: str,
    app_component: str,
    button_label: str | None = None,
) -> dict[str, Any]:
    """Structured metadata stored on gaf_messages for a single app open button."""
    comp = app_component.strip()
    if comp not in KNOWN_DESKTOP_APP_COMPONENTS:
        msg = f"Invalid open_app_component: {comp!r}"
        raise ValueError(msg)
    label = (button_label or app_name or comp).strip() or comp
    return {
        "kind": DESKTOP_APP_LINK_KIND,
        "app_id": app_id.strip(),
        "app_name": app_name.strip(),
        "open_app_component": comp,
        "button_label": label[:120],
    }


def build_desktop_app_link_body(
    *,
    app_name: str,
    note: str | None = None,
) -> str:
    """Plaintext body shown above the open-app button in the chat bubble."""
    name = app_name.strip()
    base = f"Приложение: {name}"
    extra = (note or "").strip()
    if not extra:
        return base
    if len(extra) > _MAX_NOTE_LEN:
        extra = extra[:_MAX_NOTE_LEN]
    return f"{base}\n{extra}"


async def is_gaf_admin_for_user_id(pool: asyncpg.Pool, auth_user: AuthUser) -> bool:
    """JWT role first; fallback to PostgreSQL ``users.role`` (operator-granted admin)."""
    if is_gaf_admin_auth_user(auth_user):
        return True
    try:
        uid = UUID(str(auth_user.id))
    except (ValueError, TypeError):  # fmt: skip
        return False
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT role FROM users WHERE id = $1::uuid",
            uid,
        )
    if row is None:
        return False
    db_role = str(row["role"] or "").strip().lower()
    return db_role in GAF_ADMIN_ROLES


async def _load_user_access_row(conn: asyncpg.Connection, user_id: str) -> tuple[str, UUID]:
    row = await conn.fetchrow(
        """
        SELECT role, app_access_group_id
        FROM users
        WHERE id = $1::uuid
        """,
        user_id,
    )
    if row is None:
        msg = "User not found"
        raise ValueError(msg)
    role = str(row["role"] or "").strip().lower()
    group_raw = row["app_access_group_id"]
    group_id = DEFAULT_ACCESS_GROUP_ID if group_raw is None else UUID(str(group_raw))
    return role, group_id


async def list_partner_desktop_apps_for_admin_link(
    pool: asyncpg.Pool,
    *,
    partner_user_id: str,
) -> list[dict[str, str]]:
    """Catalog apps the partner may install/open (for admin link picker)."""
    async with pool.acquire() as conn:
        partner_role, partner_group_id = await _load_user_access_row(conn, partner_user_id)
        catalog_rows = await conn.fetch(
            """
            SELECT c.id, c.app_id, c.name, c.app_component, c.category, c.is_system, c.sort_order
            FROM desktop_app_catalog c
            ORDER BY c.sort_order ASC NULLS LAST, c.name ASC
            """
        )
        if not catalog_rows:
            return []
        catalog_ids = [r["id"] for r in catalog_rows]
        group_rows = await conn.fetch(
            """
            SELECT catalog_id, access_group_id
            FROM desktop_app_catalog_access_groups
            WHERE catalog_id = ANY($1::uuid[])
            """,
            catalog_ids,
        )
    groups_by_catalog: dict[UUID, list[UUID]] = {}
    for gr in group_rows:
        cid = UUID(str(gr["catalog_id"]))
        groups_by_catalog.setdefault(cid, []).append(UUID(str(gr["access_group_id"])))

    out: list[dict[str, str]] = []
    for row in catalog_rows:
        app_id = str(row["app_id"] or "").strip()
        app_component = str(row["app_component"] or "").strip()
        if not app_id or not app_component:
            continue
        if _is_legacy_hidden(app_id, app_component):
            continue
        if app_component not in KNOWN_DESKTOP_APP_COMPONENTS:
            continue
        catalog_uuid = UUID(str(row["id"]))
        access_ids = groups_by_catalog.get(catalog_uuid, [])
        if not partner_can_see_catalog_row(
            is_system=bool(row["is_system"]),
            partner_role=partner_role,
            partner_group_id=partner_group_id,
            access_group_ids=access_ids,
        ):
            continue
        out.append(
            {
                "app_id": app_id,
                "name": str(row["name"] or app_id).strip(),
                "app_component": app_component,
                "category": str(row["category"] or "").strip(),
            }
        )
    return out


async def resolve_partner_desktop_app_for_link(
    pool: asyncpg.Pool,
    *,
    partner_user_id: str,
    app_id: str,
) -> dict[str, str]:
    """Validate app_id is visible to partner; return catalog fields for message build."""
    target = app_id.strip()
    if not target:
        msg = "app_id is required"
        raise ValueError(msg)
    apps = await list_partner_desktop_apps_for_admin_link(pool, partner_user_id=partner_user_id)
    for app in apps:
        if app["app_id"] == target:
            return app
    msg = "App is not available for this chat partner"
    raise ValueError(msg)


async def build_admin_desktop_app_link_message(
    pool: asyncpg.Pool,
    *,
    partner_user_id: str,
    app_id: str,
    note: str | None = None,
) -> tuple[str, dict[str, Any]]:
    """Return (body, metadata) for an admin-sent desktop app link message."""
    app = await resolve_partner_desktop_app_for_link(
        pool,
        partner_user_id=partner_user_id,
        app_id=app_id,
    )
    metadata = build_desktop_app_link_metadata(
        app_id=app["app_id"],
        app_name=app["name"],
        app_component=app["app_component"],
        button_label=app["name"],
    )
    body = build_desktop_app_link_body(app_name=app["name"], note=note)
    return body, metadata
