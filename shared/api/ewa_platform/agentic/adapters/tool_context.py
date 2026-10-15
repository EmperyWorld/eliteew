# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Build companion ToolContext for agentic Act phase — same catalogue scope as companion chat.
# Invariants:
# - content_catalog_user_id resolves to PostgreSQL users.id, not raw Keycloak sub when they differ.
# Related:
# - api/ewa_platform/agentic/kernel/loop.py
# - api/ewa_platform/gateways/routers/companion_chat.py
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from uuid import UUID

import asyncpg
from api.ewa_platform.companion.orchestration.tool_registry import ToolContext
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg


def _policy_str(session: Mapping[str, Any], key: str) -> str:
    policy = session.get("policy_json")
    if not isinstance(policy, Mapping):
        return ""
    return str(policy.get(key) or "").strip()


async def resolve_content_catalog_user_id(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    oauth2_sub: str | None = None,
    policy_catalog_user_id: str | None = None,
) -> str:
    """Resolve EwaFile catalogue owner id (users.id) for tool handlers."""

    stored = str(policy_catalog_user_id or "").strip()
    if stored:
        return stored

    candidates: list[str] = []
    for value in (principal_id, oauth2_sub):
        text = str(value or "").strip()
        if text and text not in candidates:
            candidates.append(text)

    async with pool.acquire() as conn:
        for candidate in candidates:
            try:
                UUID(candidate)
            except ValueError:
                continue
            row = await conn.fetchval("SELECT id FROM users WHERE id = $1::uuid", candidate)
            if row is not None:
                return str(row)

    return str(principal_id or "").strip()


async def build_agentic_tool_context(
    pool: asyncpg.Pool,
    *,
    session: Mapping[str, Any],
    principal_id: str,
) -> ToolContext:
    oauth2_sub = _policy_str(session, "oauth2_sub") or None
    policy_catalog = _policy_str(session, "content_catalog_user_id") or None
    content_catalog_user_id = await resolve_content_catalog_user_id(
        pool,
        principal_id=principal_id,
        oauth2_sub=oauth2_sub,
        policy_catalog_user_id=policy_catalog,
    )

    goal = session.get("goal_json")
    goal_text = ""
    if isinstance(goal, Mapping):
        goal_text = str(goal.get("text") or goal.get("user_message") or "").strip()

    profile = await companion_pg.companion_profile_fetch(pool, principal_id=principal_id)

    return ToolContext(
        principal_id=principal_id,
        user_line=goal_text,
        content_catalog_user_id=content_catalog_user_id,
        oauth2_sub_for_content_alternate=oauth2_sub,
        main_pool=None,
        companion_pool=pool,
        shell_norm=None,
        bearer_token=None,
        auth_user=None,
        profile=profile if isinstance(profile, Mapping) else None,
    )


__all__ = ("build_agentic_tool_context", "resolve_content_catalog_user_id")
