#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Sanitize, rate-limit, and persist mobile support diagnostic bundles (Keycloak-authenticated).
# Invariants:
# - Raw OAuth/JWT/Bearer values are stripped before persistence.
# - Max bundle size and hourly per-user quota enforced via Redis when available.
# Related:
# - api.routers.mobile_app, MobileAndroid ProfileSupportBundleCard
# ---

from __future__ import annotations

import json
import logging
import re
import uuid
from typing import Any

from fastapi import HTTPException, Request, status  # type: ignore[import-untyped]

from api.core.database_manager import get_asyncpg_pool, get_database_manager

logger = logging.getLogger(__name__)

MAX_BUNDLE_BYTES = 256 * 1024
MAX_BUNDLE_CHARS = 120_000
RATE_LIMIT_PER_HOUR = 3
RATE_WINDOW_SECONDS = 3600
_RATE_KEY_PREFIX = "mobile_support_report_rate:v1:"

_ALLOWED_CATEGORIES = frozenset({"general", "ota", "chat", "auth", "network"})

_BEARER_RE = re.compile(r"(?i)(Bearer\s+)[A-Za-z0-9._~+/=-]+")
_JWT_RE = re.compile(r"^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$")
_TOKEN_KV_RE = re.compile(
    r"(?i)(access_token|refresh_token|id_token|authorization)\s*[:=]\s*[^\s,&\"']+",
)


def normalize_support_category(raw: str | None) -> str:
    category = str(raw or "general").strip().lower()
    if category not in _ALLOWED_CATEGORIES:
        return "general"
    return category


def sanitize_support_bundle_text(raw: str) -> str:
    text = str(raw or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    if not text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Support bundle text must not be empty.",
        )
    if len(text.encode("utf-8")) > MAX_BUNDLE_BYTES or len(text) > MAX_BUNDLE_CHARS:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Support bundle is too large.",
        )
    out = _BEARER_RE.sub(r"\1<redacted>", text)
    out = _TOKEN_KV_RE.sub(
        lambda m: f"{m.group(1)}=<redacted>" if "=" in m.group(0) else f"{m.group(1)}: <redacted>",
        out,
    )
    lines = []
    for line in out.split("\n"):
        stripped = line.strip()
        if _JWT_RE.fullmatch(stripped):
            lines.append("<redacted_jwt>")
        else:
            lines.append(line)
    return "\n".join(lines).strip()


def _request_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip() or None
    return request.client.host if request.client else None


def _request_user_agent(request: Request | None) -> str | None:
    if request is None:
        return None
    user_agent = request.headers.get("user-agent")
    return user_agent[:1024] if user_agent else None


async def _enforce_hourly_rate_limit(user_id: str) -> None:
    key = f"{_RATE_KEY_PREFIX}{user_id}"
    try:
        manager = await get_database_manager()
        redis = await manager.get_redis_client()
        if redis is None:
            return
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, RATE_WINDOW_SECONDS)
        if int(count) > RATE_LIMIT_PER_HOUR:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many support reports. Try again later.",
            )
    except HTTPException:
        raise
    except Exception:
        logger.warning("mobile_support_report rate limit skipped for user=%s", user_id[:8], exc_info=True)


async def create_mobile_support_report(
    *,
    user_id: uuid.UUID,
    category: str,
    bundle_text: str,
    app_version_name: str | None,
    app_version_code: int | None,
    device_model: str | None,
    request: Request | None,
) -> dict[str, Any]:
    uid = str(user_id)
    await _enforce_hourly_rate_limit(uid)
    sanitized = sanitize_support_bundle_text(bundle_text)
    report_id = uuid.uuid4()
    version_name = (app_version_name or "").strip()[:64] or None
    version_code = int(app_version_code) if app_version_code is not None else None
    device = (device_model or "").strip()[:128] or None
    client_ip = _request_ip(request)
    user_agent = _request_user_agent(request)

    pool = await get_asyncpg_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO public.mobile_support_reports (
                id, user_id, category, app_version_name, app_version_code,
                device_model, bundle_text, client_ip, user_agent
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """,
            report_id,
            user_id,
            category,
            version_name,
            version_code,
            device,
            sanitized,
            client_ip,
            user_agent,
        )

    try:
        audit_pool = pool
        async with audit_pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO public.sso_session_audit_events (
                    event_type, keycloak_sub, client_class, ip_address, user_agent, details
                )
                VALUES ($1, $2, $3, $4, $5, $6::jsonb)
                """,
                "mobile_support_report_submitted",
                uid,
                "mobile",
                client_ip,
                user_agent,
                json.dumps(
                    {
                        "report_id": str(report_id),
                        "category": category,
                        "app_version_name": version_name,
                        "app_version_code": version_code,
                        "device_model": device,
                        "bundle_bytes": len(sanitized.encode("utf-8")),
                    },
                    ensure_ascii=False,
                ),
            )
    except Exception:
        logger.warning("mobile_support_report audit insert failed user=%s", uid[:8], exc_info=True)

    logger.info(
        "mobile_support_report stored id=%s user=%s category=%s bytes=%s",
        report_id,
        uid[:8],
        category,
        len(sanitized.encode("utf-8")),
    )
    return {"report_id": str(report_id), "category": category}
