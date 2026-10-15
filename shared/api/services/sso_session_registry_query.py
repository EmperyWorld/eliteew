#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Admin/read-path SSO registry queries (batch sessions + login history).
# Invariants:
# - No raw tokens in returned payloads.
# Related:
# - api.services.sso_session_claims; documentation/platform/SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md
# ---
"""SSO session registry read/query helpers for admin directory."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

from api.core.database_manager import get_asyncpg_pool
from api.services.sso_session_claims import (
    SSO_SESSION_ACTIVE_WINDOW,
    SSO_SESSION_LIVE_WINDOW,
)


def _dt_to_iso_z(value: datetime | None) -> str | None:
    if value is None:
        return None
    aware = value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
    return aware.isoformat().replace("+00:00", "Z")


def _session_row_is_live(last_seen_at: datetime | None) -> bool:
    if last_seen_at is None:
        return False
    aware = last_seen_at.replace(tzinfo=UTC) if last_seen_at.tzinfo is None else last_seen_at.astimezone(UTC)
    return datetime.now(UTC) - aware <= SSO_SESSION_LIVE_WINDOW


def _session_row_is_active(last_seen_at: datetime | None) -> bool:
    if last_seen_at is None:
        return False
    aware = last_seen_at.replace(tzinfo=UTC) if last_seen_at.tzinfo is None else last_seen_at.astimezone(UTC)
    return datetime.now(UTC) - aware <= SSO_SESSION_ACTIVE_WINDOW


def _normalize_session_row(row: Any) -> dict[str, Any]:  # noqa: ANN401
    last_seen_at = row["last_seen_at"]
    first_seen_at = row["first_seen_at"]
    replaced_at = row.get("replaced_at")
    return {
        "client_class": str(row["client_class"]),
        "client_id": str(row["client_id"]),
        "session_id": str(row["current_session_id"]),
        "active": _session_row_is_active(last_seen_at),
        "live": _session_row_is_live(last_seen_at),
        "first_seen_at": _dt_to_iso_z(first_seen_at),
        "last_seen_at": _dt_to_iso_z(last_seen_at),
        "ip_address": row.get("ip_address"),
        "user_agent": row.get("user_agent"),
        "replaced_at": _dt_to_iso_z(replaced_at),
        "previous_session_id": row.get("previous_session_id"),
    }


async def batch_sso_sessions_for_user_ids(user_ids: list[str]) -> dict[str, dict[str, dict[str, Any] | None]]:
    """Return current SSO registry rows keyed by user id, then client_class (browser/mobile/desktop/fofline)."""

    cleaned = [str(x).strip() for x in user_ids if str(x).strip()]
    if not cleaned:
        return {}

    empty_bucket: dict[str, dict[str, Any] | None] = {
        "browser": None,
        "mobile": None,
        "desktop": None,
        "fofline": None,
    }
    pool = await get_asyncpg_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT keycloak_sub, client_class, current_session_id, client_id,
                   first_seen_at, last_seen_at, ip_address, user_agent,
                   replaced_at, previous_session_id
            FROM public.sso_user_sessions
            WHERE keycloak_sub = ANY($1::text[])
            """,
            cleaned,
        )

    out: dict[str, dict[str, dict[str, Any] | None]] = {uid: dict(empty_bucket) for uid in cleaned}
    for row in rows:
        sub = str(row["keycloak_sub"])
        bucket = out.setdefault(sub, dict(empty_bucket))
        client_class = str(row["client_class"])
        if client_class in ("browser", "mobile", "desktop", "fofline"):
            bucket[client_class] = _normalize_session_row(row)
    return out


async def list_sso_login_history_for_user(
    user_id: str,
    *,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Return recent SSO audit events for admin login history (no raw tokens)."""

    sub = str(user_id).strip()
    if not sub:
        return []

    safe_limit = max(1, min(int(limit), 200))
    pool = await get_asyncpg_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT event_type, client_class, client_id, session_id, replaced_session_id,
                   ip_address, user_agent, details, created_at
            FROM public.sso_session_audit_events
            WHERE keycloak_sub = $1
            ORDER BY created_at DESC
            LIMIT $2
            """,
            sub,
            safe_limit,
        )

    history: list[dict[str, Any]] = []
    for row in rows:
        details_raw = row["details"]
        if isinstance(details_raw, str):
            try:
                details = json.loads(details_raw)
            except json.JSONDecodeError:
                details = {}
        elif isinstance(details_raw, dict):
            details = details_raw
        else:
            details = {}
        history.append(
            {
                "event_type": str(row["event_type"]),
                "client_class": row["client_class"],
                "client_id": row["client_id"],
                "session_id": row["session_id"],
                "replaced_session_id": row["replaced_session_id"],
                "ip_address": row["ip_address"],
                "user_agent": row["user_agent"],
                "details": details,
                "created_at": _dt_to_iso_z(row["created_at"]),
            }
        )
    return history
