# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Gated E2E seed/teardown helpers for Content Manager admin flows (test environments only).
# Invariants:
# - No-op unless CONTENT_E2E_SEED_ENABLED is truthy in process env.
# - Seeded rows are tagged in content_metadata for deterministic teardown.
# Related:
# - api/routers/desktop_admin_content_e2e_fixtures.py
# ---

from __future__ import annotations

import json
import logging
import os
import secrets
from typing import Any
from uuid import UUID, uuid4

import asyncpg  # type: ignore[import-not-found]

logger = logging.getLogger(__name__)

CONTENT_E2E_SEED_ENV = "CONTENT_E2E_SEED_ENABLED"
_E2E_MARKER_KEY = "content_e2e_fixture"
_E2E_MARKER_VALUE = "desktop_admin_v1"


def content_e2e_seed_enabled() -> bool:
    raw = str(os.getenv(CONTENT_E2E_SEED_ENV, "") or "").strip().lower()
    return raw in {"1", "true", "yes", "on"}


def assert_content_e2e_seed_enabled() -> None:
    if not content_e2e_seed_enabled():
        msg = f"{CONTENT_E2E_SEED_ENV} must be enabled for content E2E seed routes"
        raise PermissionError(msg)


async def seed_content_e2e_fixtures(
    pool: asyncpg.Pool,
    *,
    actor_user_id: UUID,
    count: int = 2,
) -> dict[str, Any]:
    """Insert tagged unified_content rows for E2E verification."""
    assert_content_e2e_seed_enabled()
    safe_count = max(1, min(int(count), 10))
    session_id = secrets.token_urlsafe(12)
    seeded_ids: list[str] = []

    metadata = {
        _E2E_MARKER_KEY: _E2E_MARKER_VALUE,
        "session_id": session_id,
        "seeded_by": str(actor_user_id),
    }

    async with pool.acquire() as conn:
        for index in range(safe_count):
            content_id = uuid4()
            name = f"content-e2e-{session_id}-{index + 1}.txt"
            file_bytes = f"content e2e fixture {session_id} #{index + 1}".encode()
            await conn.execute(
                """
                INSERT INTO unified_content (
                    id,
                    user_id,
                    content_type,
                    mime_type,
                    name,
                    title,
                    storage_backend,
                    file_data,
                    file_size,
                    processing_status,
                    content_metadata
                ) VALUES (
                    $1::uuid,
                    $2::uuid,
                    'document',
                    'text/plain',
                    $3,
                    $4,
                    'postgresql',
                    $5,
                    $6,
                    'completed',
                    $7::jsonb
                )
                """,
                content_id,
                actor_user_id,
                name,
                f"E2E fixture {index + 1}",
                file_bytes,
                len(file_bytes),
                json.dumps(metadata),
            )
            seeded_ids.append(str(content_id))

    logger.info(
        "[STEP] content_e2e_seed actor=%s session=%s count=%s",
        actor_user_id,
        session_id,
        len(seeded_ids),
    )
    return {
        "session_id": session_id,
        "seeded_content_ids": seeded_ids,
        "count": len(seeded_ids),
    }


async def teardown_content_e2e_fixtures(
    pool: asyncpg.Pool,
    *,
    session_id: str | None = None,
) -> dict[str, Any]:
    """Hard-delete E2E seeded unified_content rows."""
    assert_content_e2e_seed_enabled()
    normalized_session = str(session_id or "").strip()
    async with pool.acquire() as conn:
        if normalized_session:
            rows = await conn.fetch(
                """
                DELETE FROM unified_content
                WHERE content_metadata ->> $1 = $2
                  AND content_metadata ->> 'session_id' = $3
                RETURNING id
                """,
                _E2E_MARKER_KEY,
                _E2E_MARKER_VALUE,
                normalized_session,
            )
        else:
            rows = await conn.fetch(
                """
                DELETE FROM unified_content
                WHERE content_metadata ->> $1 = $2
                RETURNING id
                """,
                _E2E_MARKER_KEY,
                _E2E_MARKER_VALUE,
            )
    deleted_ids = [str(row["id"]) for row in rows]
    logger.info(
        "[STEP] content_e2e_teardown session=%s deleted=%s",
        normalized_session or "*",
        len(deleted_ids),
    )
    return {
        "session_id": normalized_session or None,
        "deleted_content_ids": deleted_ids,
        "count": len(deleted_ids),
    }
