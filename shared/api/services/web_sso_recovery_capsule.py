#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Continuity W3: encrypt / store / single-use consume principal-bound browser
# SSO recovery capsules (shell/draft envelope). Never stores bearer tokens.
# Invariants:
# - One active capsule per keycloak_sub (UPSERT replace).
# - Consume deletes or marks consumed; expired rows are not returned.
# - Ciphertext via Fernet (ENCRYPTION_MASTER_KEY or derived from SECRET_KEY).
# Related:
# - documentation/platform/WEB-SSO-SESSION-CONTINUITY-PLAN.md §W3
# - documentation/platform/WEB-SSO-SESSION-CONTINUITY-CONTRACT.md §Terminal
# ---

from __future__ import annotations

import base64
import hashlib
import json
import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from api.core.database_manager import get_asyncpg_pool
from api.core.unified_config import unified_settings

logger = logging.getLogger(__name__)

CAPSULE_TTL = timedelta(days=7)
MAX_PAYLOAD_BYTES = 256_000
SCHEMA_VERSION = 1
_PURPOSE = b"eliteew-web-sso-recovery-capsule-v1"


class RecoveryCapsuleError(Exception):
    """Domain error for recovery capsule operations."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _derive_fernet() -> Fernet:
    master = (unified_settings.encryption_master_key or "").strip()
    if master:
        try:
            return Fernet(master.encode("utf-8") if isinstance(master, str) else master)
        except Exception:
            logger.warning("[STEP] recovery_capsule_fernet_master_invalid — falling back to SECRET_KEY derive")
    secret = (unified_settings.secret_key or unified_settings.jwt_secret_key or "").strip()
    if not secret:
        raise RecoveryCapsuleError(
            "encryption_unavailable",
            "Neither ENCRYPTION_MASTER_KEY nor SECRET_KEY is configured",
        )
    digest = hashlib.sha256(_PURPOSE + secret.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def _encrypt_payload(payload: dict[str, Any]) -> bytes:
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if len(raw) > MAX_PAYLOAD_BYTES:
        raise RecoveryCapsuleError(
            "payload_too_large",
            f"Recovery capsule payload exceeds {MAX_PAYLOAD_BYTES} bytes",
        )
    return _derive_fernet().encrypt(raw)


def _decrypt_payload(ciphertext: bytes) -> dict[str, Any]:
    try:
        raw = _derive_fernet().decrypt(ciphertext)
    except InvalidToken as exc:
        raise RecoveryCapsuleError(
            "decrypt_failed",
            "Recovery capsule ciphertext could not be decrypted",
        ) from exc
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RecoveryCapsuleError(
            "payload_corrupt",
            "Recovery capsule payload is not valid JSON",
        ) from exc
    if not isinstance(data, dict):
        raise RecoveryCapsuleError("payload_corrupt", "Recovery capsule payload must be an object")
    return data


async def upsert_recovery_capsule(
    *,
    keycloak_sub: str,
    terminal_reason: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    sub = (keycloak_sub or "").strip()
    reason = (terminal_reason or "").strip() or "unspecified"
    if not sub:
        raise RecoveryCapsuleError("invalid_principal", "keycloak_sub is required")
    ciphertext = _encrypt_payload(payload)
    now = _utc_now()
    expires = now + CAPSULE_TTL
    pool = await get_asyncpg_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO public.web_sso_recovery_capsules (
                keycloak_sub, terminal_reason, ciphertext, schema_version,
                created_at, expires_at, consumed_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NULL)
            ON CONFLICT (keycloak_sub) DO UPDATE SET
                terminal_reason = EXCLUDED.terminal_reason,
                ciphertext = EXCLUDED.ciphertext,
                schema_version = EXCLUDED.schema_version,
                created_at = EXCLUDED.created_at,
                expires_at = EXCLUDED.expires_at,
                consumed_at = NULL
            """,
            sub,
            reason[:120],
            ciphertext,
            SCHEMA_VERSION,
            now,
            expires,
        )
    logger.info(
        "[STEP] recovery_capsule_upsert ok sub_hash=%s reason=%s bytes=%s",
        hashlib.sha256(sub.encode()).hexdigest()[:12],
        reason[:40],
        len(ciphertext),
    )
    return {
        "stored": True,
        "expires_at": expires.isoformat().replace("+00:00", "Z"),
        "schema_version": SCHEMA_VERSION,
    }


async def consume_recovery_capsule(*, keycloak_sub: str) -> dict[str, Any] | None:
    """Return decrypted payload once and delete the row (single-use)."""

    sub = (keycloak_sub or "").strip()
    if not sub:
        raise RecoveryCapsuleError("invalid_principal", "keycloak_sub is required")
    pool = await get_asyncpg_pool()
    now = _utc_now()
    async with pool.acquire() as conn, conn.transaction():
        row = await conn.fetchrow(
            """
            SELECT terminal_reason, ciphertext, schema_version, expires_at, consumed_at
            FROM public.web_sso_recovery_capsules
            WHERE keycloak_sub = $1
            FOR UPDATE
            """,
            sub,
        )
        if row is None:
            return None
        if row["consumed_at"] is not None:
            await conn.execute(
                "DELETE FROM public.web_sso_recovery_capsules WHERE keycloak_sub = $1",
                sub,
            )
            return None
        expires_at = row["expires_at"]
        if expires_at is not None and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        if expires_at is not None and expires_at <= now:
            await conn.execute(
                "DELETE FROM public.web_sso_recovery_capsules WHERE keycloak_sub = $1",
                sub,
            )
            logger.info("[STEP] recovery_capsule_expired_deleted")
            return None
        payload = _decrypt_payload(bytes(row["ciphertext"]))
        await conn.execute(
            "DELETE FROM public.web_sso_recovery_capsules WHERE keycloak_sub = $1",
            sub,
        )
    logger.info("[STEP] recovery_capsule_consumed")
    return {
        "terminal_reason": row["terminal_reason"],
        "schema_version": int(row["schema_version"] or SCHEMA_VERSION),
        "payload": payload,
        "expires_at": expires_at.isoformat().replace("+00:00", "Z") if expires_at else None,
    }


async def discard_recovery_capsule(*, keycloak_sub: str) -> bool:
    sub = (keycloak_sub or "").strip()
    if not sub:
        raise RecoveryCapsuleError("invalid_principal", "keycloak_sub is required")
    pool = await get_asyncpg_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM public.web_sso_recovery_capsules WHERE keycloak_sub = $1",
            sub,
        )
    deleted = result.endswith("1") if isinstance(result, str) else False
    logger.info("[STEP] recovery_capsule_discard deleted=%s", deleted)
    return deleted
