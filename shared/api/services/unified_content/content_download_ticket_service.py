# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Issue and consume short-lived opaque tickets for Unified Content direct browser downloads.
# Invariants:
# - Tickets never contain or expose JWT/Bearer credentials.
# - Router code must re-check resource ACLs after ticket consumption.
# Related:
# - api/routers/unified_content.py
# - api/routers/unified_content_versions.py
# - api/services/unified_content/performance_metrics.py
# ---
"""Short-lived download tickets for browser-native Unified Content downloads."""

from __future__ import annotations

import json
import logging
import secrets
import time
from typing import Any, Literal
from uuid import UUID

from fastapi import Request

from api.core.database_manager import get_database_manager
from api.services.unified_content.performance_metrics import get_metrics

logger = logging.getLogger(__name__)

ContentDownloadTicketKind = Literal["content", "version", "batch", "owned_archive"]

CONTENT_DOWNLOAD_TICKET_TTL_SECONDS = 120
CONTENT_DOWNLOAD_TICKET_REUSE_GRACE_SECONDS = 20
CONTENT_DOWNLOAD_TICKET_REUSE_LIMIT = 1

_TICKET_PREFIX = "unified_content_download_ticket:v1:"


class ContentDownloadTicketUnavailableError(RuntimeError):
    """Raised when the ticket backend cannot issue a ticket."""


def _ticket_key(ticket: str) -> str:
    return f"{_TICKET_PREFIX}{ticket}"


def _request_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()[:128]
    client = getattr(request, "client", None)
    host = getattr(client, "host", None)
    return str(host)[:128] if host else None


def _request_user_agent(request: Request | None) -> str | None:
    if request is None:
        return None
    user_agent = request.headers.get("user-agent")
    return user_agent[:1024] if user_agent else None


def _coerce_non_negative_int(value: object, *, fallback: int = 0) -> int:
    try:
        out = int(value)  # type: ignore[arg-type]
    except TypeError, ValueError:
        return fallback
    return out if out >= 0 else fallback


def _matches_fingerprint(payload: dict[str, Any], request: Request | None) -> bool:
    locked_ip = str(payload.get("first_consume_ip") or "").strip()
    locked_ua = str(payload.get("first_consume_user_agent") or "").strip()
    request_ip = (_request_ip(request) or "").strip()
    request_ua = (_request_user_agent(request) or "").strip()
    if locked_ip and request_ip and locked_ip != request_ip:
        return False
    return not (locked_ua and request_ua and locked_ua != request_ua)


class ContentDownloadTicketService:
    """Redis-backed opaque ticket service for Unified Content downloads."""

    async def issue(
        self,
        *,
        kind: ContentDownloadTicketKind,
        user_id: str,
        resource_id: UUID | None = None,
        disposition: Literal["attachment", "inline"] = "attachment",
        revision: str | None = None,
        archive_name: str | None = None,
        content_ids: list[UUID] | None = None,
        alternate_user_id: str | None = None,
    ) -> tuple[str, int]:
        ticket = secrets.token_urlsafe(32)
        payload: dict[str, Any] = {
            "kind": kind,
            "user_id": str(user_id),
            "issued_at": int(time.time()),
        }
        if resource_id is not None:
            payload["resource_id"] = str(resource_id)
        if kind in {"content", "version"}:
            payload["disposition"] = disposition
            if revision:
                payload["revision"] = revision
        if archive_name:
            payload["archive_name"] = archive_name
        if content_ids:
            payload["content_ids"] = [str(content_id) for content_id in content_ids]
        if alternate_user_id:
            payload["alternate_user_id"] = alternate_user_id

        try:
            manager = await get_database_manager()
            redis = await manager.get_redis_client()
            if redis is None:
                raise RuntimeError("Redis is not available for content download ticket flow.")
            await redis.setex(
                _ticket_key(ticket),
                CONTENT_DOWNLOAD_TICKET_TTL_SECONDS,
                json.dumps(payload, ensure_ascii=False),
            )
        except Exception as exc:
            get_metrics().record_download_ticket_issue(kind=kind, success=False)
            logger.warning("content download ticket issue failed kind=%s", kind, exc_info=True)
            raise ContentDownloadTicketUnavailableError(
                "Content download ticket service is temporarily unavailable."
            ) from exc
        get_metrics().record_download_ticket_issue(kind=kind, success=True)
        return ticket, CONTENT_DOWNLOAD_TICKET_TTL_SECONDS

    async def consume(
        self,
        ticket: str,
        *,
        expected_kind: ContentDownloadTicketKind,
        request: Request | None = None,
    ) -> dict[str, Any] | None:
        normalized = str(ticket or "").strip()
        metrics = get_metrics()

        def _record_consume(*, success: bool, reason: str | None = None) -> None:
            metrics.record_download_ticket_consume(
                kind=expected_kind,
                success=success,
                reason=reason,
            )

        if not normalized:
            _record_consume(success=False, reason="empty_ticket")
            return None
        try:
            manager = await get_database_manager()
            redis = await manager.get_redis_client()
            if redis is None:
                _record_consume(success=False, reason="redis_unavailable")
                return None
            key = _ticket_key(normalized)
            raw = await redis.get(key)
            if not raw:
                _record_consume(success=False, reason="not_found")
                return None
            text = raw.decode("utf-8") if isinstance(raw, (bytes, bytearray)) else str(raw)
            payload = json.loads(text)
            if not isinstance(payload, dict) or payload.get("kind") != expected_kind:
                await redis.delete(key)
                _record_consume(success=False, reason="wrong_kind")
                return None

            now_ts = int(time.time())
            first_consume_at = payload.get("first_consume_at")
            if first_consume_at is None:
                payload["first_consume_at"] = now_ts
                payload["first_consume_ip"] = _request_ip(request)
                payload["first_consume_user_agent"] = _request_user_agent(request)
                payload["reuse_remaining"] = CONTENT_DOWNLOAD_TICKET_REUSE_LIMIT
                await redis.setex(
                    key,
                    CONTENT_DOWNLOAD_TICKET_REUSE_GRACE_SECONDS,
                    json.dumps(payload, ensure_ascii=False),
                )
                _record_consume(success=True)
                return payload

            elapsed_seconds = max(0, now_ts - _coerce_non_negative_int(first_consume_at))
            reuse_remaining = _coerce_non_negative_int(payload.get("reuse_remaining"))
            if (
                elapsed_seconds > CONTENT_DOWNLOAD_TICKET_REUSE_GRACE_SECONDS
                or reuse_remaining <= 0
                or not _matches_fingerprint(payload, request)
            ):
                await redis.delete(key)
                _record_consume(success=False, reason="reuse_denied")
                return None

            payload["reuse_remaining"] = reuse_remaining - 1
            if payload["reuse_remaining"] <= 0:
                await redis.delete(key)
            else:
                ttl = max(1, CONTENT_DOWNLOAD_TICKET_REUSE_GRACE_SECONDS - elapsed_seconds)
                await redis.setex(key, ttl, json.dumps(payload, ensure_ascii=False))
            _record_consume(success=True)
            return payload
        except Exception:
            _record_consume(success=False, reason="exception")
            logger.warning("content download ticket consume failed ticket=%s", normalized[:12], exc_info=True)
            return None
