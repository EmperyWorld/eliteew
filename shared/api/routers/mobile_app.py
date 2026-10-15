#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Authenticated distribution of the production Android APK, mobile SSO visibility, and support diagnostics upload.
# Invariants:
# - APK bytes are never exposed via a static public nginx path (Bearer or short-lived download ticket only).
# - Ticket links allow at most one extra replay within a strict grace window and same client fingerprint.
# - SSO data is scoped to the current user (keycloak sub = users.id).
# Related:
# - documentation/platform/docker-re_doc/KEYCLOAK-ELITEEW.md
# - shared/web/frontend/src/features/friends/components/MobileAppHubPanel.tsx
# ---

from __future__ import annotations

import json
import logging
import secrets
import time
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status  # type: ignore[import-untyped]
from fastapi.responses import FileResponse  # type: ignore[import-untyped]
from sqlalchemy import select  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User as AuthUser
from api.core.database_manager import get_asyncpg_pool, get_database_manager, get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.core.unified_config import unified_settings
from api.core.user_identity import resolve_db_user_uuid_with_session
from api.models.database_models import User as DBUser
from api.schemas.mobile_app import (
    MobileAppDownloadTicketResponse,
    MobileAppLoginHistoryItem,
    MobileAppOverviewResponse,
    MobileAppRealtimeStateResponse,
    MobileAppRealtimeStateUpdate,
    MobileAppSsoSnapshot,
    MobileProfileResponse,
    MobileProfileUpdate,
    MobileReleaseNotesHistoryItem,
    MobileSupportReportCreateBody,
    MobileSupportReportResponse,
)
from api.services.mobile_apk_release_notes import aggregate_ota_release_notes
from api.services.mobile_app_realtime_state_service import set_mobile_app_foreground
from api.services.mobile_profile_service import get_mobile_profile, update_mobile_profile
from api.services.mobile_release_manifest import resolve_mobile_apk_release_state
from api.services.mobile_support_report_service import (
    create_mobile_support_report,
    normalize_support_category,
)
from api.services.sso_session_registry import batch_sso_sessions_for_user_ids, list_sso_login_history_for_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mobile-app", tags=["Mobile App"])
_DOWNLOAD_TICKET_PREFIX = "mobile_apk_download_ticket:v1:"
_DOWNLOAD_TICKET_TTL_SECONDS = 120
_DOWNLOAD_TICKET_REUSE_GRACE_SECONDS = 20
_DOWNLOAD_TICKET_REUSE_LIMIT = 1


def _resolve_apk_path() -> Path:
    raw = (unified_settings.mobile_apk_path or "").strip()
    if raw:
        return Path(raw).expanduser()
    return Path("/app/mobile-release/empery-mobile.apk")


def _candidate_apk_paths() -> tuple[Path, ...]:
    primary = _resolve_apk_path()
    fallbacks = (
        Path("/app/mobile-release/empery-mobile.apk"),
        Path("/app/mobile-release/app-prod-release.apk"),
    )
    out: list[Path] = []
    for candidate in (primary, *fallbacks):
        if candidate not in out:
            out.append(candidate)
    return tuple(out)


def _apk_stat(path: Path) -> tuple[bool, int | None]:
    try:
        if path.is_file():
            size = path.stat().st_size
            return size > 0, size
    except OSError:
        pass
    return False, None


def _first_available_apk() -> tuple[Path | None, bool, int | None]:
    for candidate in _candidate_apk_paths():
        ok, size = _apk_stat(candidate)
        if ok:
            return candidate, ok, size
    return None, False, None


def _download_ticket_key(ticket: str) -> str:
    return f"{_DOWNLOAD_TICKET_PREFIX}{ticket}"


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


async def _issue_download_ticket(user_id: str) -> tuple[str, int]:
    ticket = secrets.token_urlsafe(24)
    payload = json.dumps({"user_id": user_id}, ensure_ascii=False)
    try:
        manager = await get_database_manager()
        redis = await manager.get_redis_client()
        if redis is None:
            raise RuntimeError("Redis is not available for mobile APK download ticket flow.")
        await redis.setex(_download_ticket_key(ticket), _DOWNLOAD_TICKET_TTL_SECONDS, payload)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Download ticket service is temporarily unavailable.",
        ) from exc
    return ticket, _DOWNLOAD_TICKET_TTL_SECONDS


def _coerce_non_negative_int(value: object, *, fallback: int = 0) -> int:
    try:
        out = int(value)
    except TypeError, ValueError:
        return fallback
    return out if out >= 0 else fallback


def _ticket_request_matches_fingerprint(payload: dict[str, Any], request: Request | None) -> bool:
    locked_ip = str(payload.get("first_consume_ip") or "").strip()
    locked_ua = str(payload.get("first_consume_user_agent") or "").strip()
    request_ip = (_request_ip(request) or "").strip()
    request_ua = (_request_user_agent(request) or "").strip()
    if locked_ip and request_ip and locked_ip != request_ip:
        return False
    return not (locked_ua and request_ua and locked_ua != request_ua)


async def _consume_download_ticket(ticket: str, *, request: Request | None = None) -> str | None:
    normalized = str(ticket or "").strip()
    if not normalized:
        return None
    try:
        manager = await get_database_manager()
        redis = await manager.get_redis_client()
        if redis is None:
            return None
        key = _download_ticket_key(normalized)
        raw = await redis.get(key)
        if not raw:
            return None
        text = raw.decode("utf-8") if isinstance(raw, (bytes, bytearray)) else str(raw)
        payload = json.loads(text)
        if not isinstance(payload, dict):
            await redis.delete(key)
            return None
        user_id = str(payload.get("user_id") or "").strip()
        if not user_id:
            await redis.delete(key)
            return None

        now_ts = int(time.time())
        first_consume_at = _coerce_non_negative_int(payload.get("first_consume_at"), fallback=0)

        if first_consume_at <= 0:
            if _DOWNLOAD_TICKET_REUSE_LIMIT <= 0:
                await redis.delete(key)
                return user_id
            payload["first_consume_at"] = now_ts
            payload["first_consume_ip"] = _request_ip(request)
            payload["first_consume_user_agent"] = _request_user_agent(request)
            payload["reuse_remaining"] = _DOWNLOAD_TICKET_REUSE_LIMIT
            await redis.setex(
                key,
                _DOWNLOAD_TICKET_REUSE_GRACE_SECONDS,
                json.dumps(payload, ensure_ascii=False),
            )
            return user_id

        elapsed_seconds = max(0, now_ts - first_consume_at)
        reuse_remaining = _coerce_non_negative_int(payload.get("reuse_remaining"), fallback=0)
        if (
            elapsed_seconds > _DOWNLOAD_TICKET_REUSE_GRACE_SECONDS
            or reuse_remaining <= 0
            or not _ticket_request_matches_fingerprint(payload, request)
        ):
            await redis.delete(key)
            return None

        reuse_remaining -= 1
        if reuse_remaining <= 0:
            await redis.delete(key)
        else:
            payload["reuse_remaining"] = reuse_remaining
            ttl = max(1, _DOWNLOAD_TICKET_REUSE_GRACE_SECONDS - elapsed_seconds)
            await redis.setex(
                key,
                ttl,
                json.dumps(payload, ensure_ascii=False),
            )
        return user_id
    except Exception:
        logger.warning("mobile_app ticket consume failed for ticket=%s", normalized[:12], exc_info=True)
        return None


async def _record_mobile_apk_download_event(
    *,
    user_id: str,
    request: Request | None,
    apk_path: Path,
    apk_size_bytes: int | None,
    source: str,
) -> None:
    try:
        sso_map = await batch_sso_sessions_for_user_ids([user_id])
        bucket = sso_map.get(user_id) or {}
        mobile_row = bucket.get("mobile")
        browser_row = bucket.get("browser")
        chosen_row = mobile_row or browser_row or {}
        if mobile_row:
            client_class = "mobile"
        elif browser_row:
            client_class = "browser"
        else:
            client_class = None
        details: dict[str, Any] = {
            "apk_name": apk_path.name,
            "apk_size_bytes": int(apk_size_bytes or 0),
            "source": source,
        }
        pool = await get_asyncpg_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO public.sso_session_audit_events (
                    event_type, keycloak_sub, client_class, client_id, session_id,
                    ip_address, user_agent, details
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
                """,
                "mobile_apk_downloaded",
                user_id,
                client_class,
                chosen_row.get("client_id"),
                chosen_row.get("session_id"),
                chosen_row.get("ip_address") or _request_ip(request),
                chosen_row.get("user_agent") or _request_user_agent(request),
                json.dumps(details, ensure_ascii=False),
            )
    except Exception:
        logger.warning("mobile_app audit insert failed for user=%s", user_id, exc_info=True)


async def _build_download_response(
    *,
    user_id: str,
    request: Request | None,
    source: str,
) -> FileResponse:
    apk_path, ok, apk_size = _first_available_apk()
    if not ok or apk_path is None:
        logger.warning("mobile_app download: APK missing (checked %s)", _candidate_apk_paths())
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Mobile APK is not published on the server.",
        )

    await _record_mobile_apk_download_event(
        user_id=user_id,
        request=request,
        apk_path=apk_path,
        apk_size_bytes=apk_size,
        source=source,
    )
    filename = apk_path.name if apk_path.name.lower().endswith(".apk") else "Empery-Mobile.apk"
    return FileResponse(
        apk_path,
        media_type="application/vnd.android.package-archive",
        filename=filename,
        headers={
            "Cache-Control": "private, no-store",
            "Accept-Ranges": "bytes",
        },
    )


@router.get("/overview", response_model=MobileAppOverviewResponse)
async def mobile_app_overview(
    response: Response,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    history_limit: int = Query(20, ge=1, le=100),
    installed_version_code: int | None = Query(
        default=None,
        ge=1,
        le=1_000_000,
        description="Client versionCode; enables skipped-step release-notes aggregation.",
    ),
) -> MobileAppOverviewResponse:
    """Mobile SSO snapshot, login history, and fixed download URLs for the current user."""

    response.headers["Cache-Control"] = "private, no-store"

    user_id = await resolve_db_user_uuid_with_session(current_user, db)
    uid = str(user_id)

    result = await db.execute(
        select(DBUser.last_login_at, DBUser.login_count).where(DBUser.id == user_id),
    )
    row = result.one_or_none()
    last_login_at = None
    login_count = None
    if row is not None:
        lt = row[0]
        last_login_at = lt.isoformat() if lt is not None else None
        login_count = int(row[1] or 0)

    sso_map = await batch_sso_sessions_for_user_ids([uid])
    mobile_raw = (sso_map.get(uid) or {}).get("mobile")
    mobile_session = MobileAppSsoSnapshot(**mobile_raw) if mobile_raw else None

    raw_history = await list_sso_login_history_for_user(uid, limit=history_limit)
    history = [
        MobileAppLoginHistoryItem(
            event_type=str(item.get("event_type") or ""),
            created_at=str(item.get("created_at") or ""),
            ip_address=item.get("ip_address"),
            user_agent=item.get("user_agent"),
            client_id=item.get("client_id"),
        )
        for item in raw_history
        if str(item.get("client_class") or "") == "mobile"
    ]

    apk_path, apk_ok, apk_size = _first_available_apk()
    if apk_path is None:
        apk_path = _resolve_apk_path()
    apk_ok, apk_size, apk_meta = await resolve_mobile_apk_release_state(
        apk_path,
        apk_ok=apk_ok,
        apk_size=apk_size,
    )

    history_entries = apk_meta.release_notes_history if apk_meta is not None else ()
    release_notes = aggregate_ota_release_notes(
        installed_version_code=installed_version_code,
        server_version_code=apk_meta.version_code if apk_meta is not None else None,
        server_version_name=apk_meta.version_name if apk_meta is not None else None,
        current_release_notes=apk_meta.release_notes if apk_meta is not None else None,
        history=history_entries,
    )

    return MobileAppOverviewResponse(
        download_page_url=unified_settings.mobile_app_download_page_url,
        apk_available=apk_ok,
        apk_size_bytes=apk_size,
        version_code=apk_meta.version_code if apk_meta is not None else None,
        version_name=apk_meta.version_name if apk_meta is not None else None,
        apk_sha256=apk_meta.apk_sha256 if apk_meta is not None else None,
        published_at=apk_meta.published_at if apk_meta is not None else None,
        release_notes=release_notes,
        release_notes_history=[
            MobileReleaseNotesHistoryItem(
                version_code=entry.version_code,
                version_name=entry.version_name,
                release_notes=entry.release_notes,
            )
            for entry in (apk_meta.release_notes_history if apk_meta is not None else ())
        ],
        min_supported_version_code=apk_meta.min_supported_version_code if apk_meta is not None else None,
        last_login_at=last_login_at,
        login_count=login_count,
        mobile_session=mobile_session,
        login_history=history,
    )


@router.get("/download")
async def download_mobile_apk(
    request: Request,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> FileResponse:
    """Stream the production APK after Keycloak login (Bearer or session cookie via API client)."""

    user_id = str(await resolve_db_user_uuid_with_session(current_user, db))
    return await _build_download_response(
        user_id=user_id,
        request=request,
        source="oauth_bearer",
    )


@router.post("/download-ticket", response_model=MobileAppDownloadTicketResponse)
async def create_mobile_apk_download_ticket(
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> MobileAppDownloadTicketResponse:
    """Return a short-lived ticket URL for direct browser APK download (without exposing JWT in URL)."""

    user_id = str(await resolve_db_user_uuid_with_session(current_user, db))
    ticket, ttl = await _issue_download_ticket(user_id)
    return MobileAppDownloadTicketResponse(
        download_url=f"/api/v1/mobile-app/download-by-ticket?ticket={ticket}",
        expires_in_seconds=ttl,
    )


@router.post("/support-reports", response_model=MobileSupportReportResponse)
async def submit_mobile_support_report(
    body: MobileSupportReportCreateBody,
    request: Request,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> MobileSupportReportResponse:
    """Accept a redacted diagnostics bundle from the authenticated mobile app (Keycloak Bearer)."""

    user_id = await resolve_db_user_uuid_with_session(current_user, db)
    category = normalize_support_category(body.category)
    result = await create_mobile_support_report(
        user_id=user_id,
        category=category,
        bundle_text=body.bundle_text,
        app_version_name=body.app_version_name,
        app_version_code=body.app_version_code,
        device_model=body.device_model,
        request=request,
    )
    return MobileSupportReportResponse(
        report_id=str(result["report_id"]),
        category=str(result["category"]),
    )


@router.put("/realtime-state", response_model=MobileAppRealtimeStateResponse)
async def put_mobile_realtime_state(
    body: MobileAppRealtimeStateUpdate,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> MobileAppRealtimeStateResponse:
    """Report whether the native Android shell is foreground (gates FCM vs Socket.IO delivery)."""

    user_id = await resolve_db_user_uuid_with_session(current_user, db)
    await set_mobile_app_foreground(str(user_id), foreground=body.foreground)
    return MobileAppRealtimeStateResponse(accepted=True, foreground=body.foreground)


@router.get("/profile", response_model=MobileProfileResponse)
async def read_mobile_profile(
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> MobileProfileResponse:
    """Mobile-only profile blob (appearance, a11y, notification prefs) under users.preferences.mobile."""

    user_id = await resolve_db_user_uuid_with_session(current_user, db)
    pool = await get_asyncpg_pool()
    return await get_mobile_profile(pool, user_id)


@router.patch("/profile", response_model=MobileProfileResponse)
async def patch_mobile_profile(
    body: MobileProfileUpdate,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> MobileProfileResponse:
    """Partial update of mobile profile; deep-merges notifications and sets updated_at."""

    user_id = await resolve_db_user_uuid_with_session(current_user, db)
    pool = await get_asyncpg_pool()
    return await update_mobile_profile(pool, user_id, body)


@router.get("/download-by-ticket")
async def download_mobile_apk_by_ticket(
    request: Request,
    ticket: str = Query(..., min_length=8, max_length=256),
) -> FileResponse:
    """Direct APK file response for short-lived ticket links used by browsers."""

    user_id = await _consume_download_ticket(ticket, request=request)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Download ticket is invalid or expired.",
        )
    return await _build_download_response(
        user_id=user_id,
        request=request,
        source="one_time_ticket",
    )
