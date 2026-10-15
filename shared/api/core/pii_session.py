# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Ensure Postgres has encryption.pii_key before reads/writes on PII-protected rows.
# Invariants:
# - Prefer SET SESSION once per physical SQLAlchemy connection (pool connect event).
# - QueuePool / SET failure is fail-closed (raise; never soft-skip yield without key).
# - AsyncSession may switch pooled connections after commit; re-SET via ensure_* before
#   users-touching ops when the write path does not rely solely on connect.
# Related:
# - api/core/database_manager.py
# - documentation/database/DB_PITFALLS_AND_QUIRKS.md §3
# - documentation/platform/API-AUTH-SESSION-POOL-AND-CONTENT-BLOB-PERF-PLAN.md Wave 2
# ---

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from api.core.unified_config import unified_settings

logger = logging.getLogger(__name__)


class EncryptionPiiKeyError(RuntimeError):
    """Fail-closed: cannot apply encryption.pii_key when encryption is required."""


def _session_pii_key_sql() -> str | None:
    """Return SET SESSION SQL when encryption is on; None when encryption is disabled."""
    if not getattr(unified_settings, "encryption_enabled", False):
        return None
    key = getattr(unified_settings, "encryption_master_key", None)
    if not key:
        raise EncryptionPiiKeyError("encryption_enabled but encryption_master_key is missing")
    safe_key = str(key).replace("'", "''")
    return f"SET SESSION encryption.pii_key = '{safe_key}'"


def apply_encryption_pii_key_on_dbapi_connection(dbapi_connection: Any) -> bool:
    """
    Sync SET SESSION on a DBAPI connection (SQLAlchemy pool connect).

    Returns True when SET ran; False when encryption is disabled.
    Raises EncryptionPiiKeyError when encryption is on but key cannot be applied.
    """
    sql = _session_pii_key_sql()
    if sql is None:
        return False
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute(sql)
    except Exception as exc:
        logger.error(
            "[STEP] %s err=%s",
            "encryption_pii_key_set_fail",
            exc,
        )
        raise EncryptionPiiKeyError(f"Failed to set encryption.pii_key on connect: {exc}") from exc
    finally:
        cursor.close()
    return True


def register_sqlalchemy_encryption_pii_key(engine: AsyncEngine) -> None:
    """Register once-per-physical-connection SET SESSION encryption.pii_key on pool connect."""

    def _on_connect(dbapi_connection: Any, connection_record: Any) -> None:
        applied = apply_encryption_pii_key_on_dbapi_connection(dbapi_connection)
        if applied:
            connection_record.info["encryption_pii_key_set"] = True

    event.listens_for(engine.sync_engine, "connect")(_on_connect)


async def ensure_encryption_pii_key(session: AsyncSession) -> bool:
    """
    SET SESSION encryption.pii_key for the current connection.

    Returns True when the key was applied; False when encryption is disabled.
    Raises EncryptionPiiKeyError when encryption is on but key is missing or SET fails.
    """
    sql = _session_pii_key_sql()
    if sql is None:
        return False
    try:
        await session.execute(text(sql))
    except Exception as exc:
        logger.error("[STEP] encryption_pii_key_set_fail err=%s", exc)
        raise EncryptionPiiKeyError(f"Failed to set encryption.pii_key for session: {exc}") from exc
    return True
