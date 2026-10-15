#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# User profile API: profile CRUD, privacy, notification center, and mobile push token lifecycle.
# Invariants:
# - All routes are scoped to the authenticated current user; raw push tokens are not logged.
# Related:
# - api.services.user_profile_service, api.schemas.user_profile
# ---
"""
User Profile API Router
Complete user profile management endpoints
"""

import hashlib
import logging
from datetime import datetime
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]
from fastapi import (  # type: ignore[import-untyped]
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from starlette.responses import Response

from api.core.auth import User
from api.core.database_manager import get_asyncpg_pool
from api.core.oauth2_auth import require_oauth2_user
from api.core.user_identity import resolve_db_user_uuid_with_pool
from api.schemas.notification_center import (
    NotificationCenterDeltaResponse,
    NotificationCenterGetResponse,
    NotificationCenterItemSerialized,
    NotificationCenterPutBody,
)
from api.schemas.user_profile import (
    ActivityLogResponse,
    AvatarHistoryItem,
    AvatarUploadResponse,
    ChangePasswordRequest,
    DataExportResponse,
    LanguageUpdateRequest,
    MobilePushTokenBody,
    ProfilePrivacyResponse,
    ProfilePrivacyUpdate,
    SecuritySettings,
    UserPreferences,
    UserPreferencesUpdate,
    UserProfileResponse,
    UserProfileUpdate,
    UserSessionInfo,
    UserStatistics,
)
from api.services.unified_content.audit_logger import AuditLogger
from api.services.unified_content.content_storage_service import (
    ContentStorageService,
)
from api.services.unified_content.storage_backends.factory import (
    get_storage_factory,
)
from api.services.user_profile_service import UserProfileService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["User Profile"])


class _ServiceState:
    """State holder for service instances."""

    profile_service: UserProfileService | None = None


_service_state = _ServiceState()


async def get_profile_service(db_pool: asyncpg.Pool = Depends(get_asyncpg_pool)) -> UserProfileService:
    """Get UserProfileService instance"""
    if _service_state.profile_service is None:
        # Initialize ContentStorageService for avatar uploads
        content_service = None
        try:
            storage_factory = get_storage_factory(db_pool)
            audit_logger = AuditLogger(db_pool)
            content_service = ContentStorageService(
                db_pool=db_pool, storage_factory=storage_factory, audit_logger=audit_logger
            )
        except (ImportError, ValueError, RuntimeError) as e:
            logger.warning("Failed to initialize ContentStorageService: %s", e)
        except Exception:
            logger.exception("Unexpected error initializing ContentStorageService")

        _service_state.profile_service = UserProfileService(db_pool=db_pool, content_service=content_service)

    return _service_state.profile_service


def get_client_ip(request: Request) -> str | None:
    """Extract client IP address from request"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def get_current_token_hash(request: Request) -> str | None:
    """Extract SHA256 hash of the current bearer token for session detection."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header[7:].strip()
    if not token:
        return None

    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def get_user_id_from_current_user(current_user: User, db_pool: asyncpg.Pool) -> UUID:
    """
    Helper: resolve canonical ``users.id`` (UUID) for profile routes.

    Uses the same UUID-first, case-insensitive-email rules as the rest of the API
    (see ``api.core.user_identity``).
    """
    return await resolve_db_user_uuid_with_pool(current_user, db_pool)


async def get_current_profile_user_id(
    current_user: User = Depends(require_oauth2_user),  # noqa: B008
    service: UserProfileService = Depends(get_profile_service),  # noqa: B008
) -> UUID:
    """
    Resolve current user's database UUID once per request.
    Use this dependency in all profile endpoints to avoid repeated SELECT by email.
    """
    return await get_user_id_from_current_user(current_user, service.db_pool)


# ========================================
# PROFILE MANAGEMENT
# ========================================


@router.get("/me", response_model=UserProfileResponse)
async def get_current_user_profile(
    current_user: User = Depends(require_oauth2_user),  # noqa: B008
    user_id: UUID = Depends(get_current_profile_user_id),  # noqa: B008
    service: UserProfileService = Depends(get_profile_service),  # noqa: B008
) -> UserProfileResponse:
    """
    Get current user's complete profile

    Returns:
    - User profile with preferences, statistics, etc.
    """
    return await service.get_user_profile(user_id, effective_role=current_user.role)


@router.patch("/me", response_model=UserProfileResponse)
async def update_current_user_profile(
    update_data: UserProfileUpdate,
    request: Request,
    current_user: User = Depends(require_oauth2_user),  # noqa: B008
    user_id: UUID = Depends(get_current_profile_user_id),  # noqa: B008
    service: UserProfileService = Depends(get_profile_service),  # noqa: B008
) -> UserProfileResponse:
    """
    Update current user's profile (full_name, bio)

    Body:
    - full_name: Optional[str] (1-24 chars)
    - bio: Optional[str] (max 1000 chars)

    Returns:
    - Updated user profile
    """
    ip_address = get_client_ip(request)
    return await service.update_profile(
        user_id,
        update_data,
        ip_address,
        effective_role=current_user.role,
    )


@router.get("/me/privacy", response_model=ProfilePrivacyResponse)
async def get_profile_privacy_settings(
    user_id: UUID = Depends(get_current_profile_user_id),  # noqa: B008
    service: UserProfileService = Depends(get_profile_service),  # noqa: B008
) -> ProfilePrivacyResponse:
    """Server-side privacy (discoverability + field visibility); owner-only."""
    return await service.get_profile_privacy(user_id)


@router.patch("/me/privacy", response_model=ProfilePrivacyResponse)
async def update_profile_privacy_settings(
    body: ProfilePrivacyUpdate,
    user_id: UUID = Depends(get_current_profile_user_id),  # noqa: B008
    service: UserProfileService = Depends(get_profile_service),  # noqa: B008
) -> ProfilePrivacyResponse:
    """Update privacy flags; owner-only."""
    return await service.update_profile_privacy(user_id, body)


# ========================================
# AVATAR MANAGEMENT
# ========================================


@router.post("/avatar", response_model=AvatarUploadResponse)
async def upload_avatar(
    file: UploadFile = File(...),  # noqa: B008
    current_user: User = Depends(require_oauth2_user),  # noqa: B008
    user_id: UUID = Depends(get_current_profile_user_id),  # noqa: B008
    service: UserProfileService = Depends(get_profile_service),  # noqa: B008
) -> AvatarUploadResponse:
    """
    Upload user avatar

    Requirements:
    - Format: JPEG, PNG, or WEBP
    - Max size: 5MB
    - Max dimensions: 2048x2048

    Returns:
    - Avatar URL and metadata
    """
    # Check file size early (before reading entire file)
    if file.size and file.size > UserProfileService.MAX_AVATAR_SIZE_BYTES:
        file_size_mb = file.size / 1024 / 1024
        detail_msg = (
            f"File too large. Maximum size: {UserProfileService.MAX_AVATAR_SIZE_MB}MB. "
            f"Your file: {file_size_mb:.2f}MB. "
            "If you see this error when uploading a file <1MB, check Nginx Proxy Manager settings: "
            "client_max_body_size must be >= 10M"
        )
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=detail_msg,
        )

    try:
        return await service.upload_avatar(user_id, file, current_user.email)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID format") from e


@router.get("/avatar", response_model=AvatarUploadResponse)
async def get_current_avatar(
    user_id: UUID = Depends(get_current_profile_user_id),  # noqa: B008
    service: UserProfileService = Depends(get_profile_service),  # noqa: B008
) -> AvatarUploadResponse:
    """Get current user's active avatar.

    When no avatar is set, returns **200** with empty ``avatar_url`` (not 404), so clients and
    DevTools do not treat «no avatar» as an error response.
    """
    try:
        profile = await service.get_user_profile(user_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID format") from e

    if not profile.avatar_url:
        return AvatarUploadResponse(
            avatar_url="",
            thumbnail_256_url=None,
            thumbnail_64_url=None,
            content_id=None,
            file_size=0,
            mime_type="application/octet-stream",
            created_at=profile.created_at,
        )

    return AvatarUploadResponse(
        avatar_url=profile.avatar_url,
        thumbnail_256_url=None,
        thumbnail_64_url=None,
        content_id=None,
        file_size=0,
        mime_type="image/jpeg",
        created_at=profile.created_at,
    )


@router.delete("/avatar")
async def delete_avatar(
    user_id: UUID = Depends(get_current_profile_user_id),  # noqa: B008
    service: UserProfileService = Depends(get_profile_service),  # noqa: B008
) -> dict[str, Any]:
    """Delete current user's avatar"""
    try:
        success = await service.delete_avatar(user_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID format") from e
    else:
        return {"success": success, "message": "Avatar deleted successfully"}


@router.get("/avatar/history", response_model=list[AvatarHistoryItem])
async def get_avatar_history(
    user_id: UUID = Depends(get_current_profile_user_id),  # noqa: B008
    service: UserProfileService = Depends(get_profile_service),  # noqa: B008
) -> list[AvatarHistoryItem]:
    """Get avatar upload history (last 50)"""
    try:
        return await service.get_avatar_history(user_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID format") from ValueError


# ========================================
# PREFERENCES
# ========================================


@router.get("/preferences", response_model=UserPreferences)
async def get_user_preferences(
    user_id: UUID = Depends(get_current_profile_user_id),  # noqa: B008
    service: UserProfileService = Depends(get_profile_service),  # noqa: B008
) -> UserPreferences:
    """Get user preferences"""
    try:
        return await service.get_preferences(user_id)
    except HTTPException:
        raise
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID format") from ValueError
    except Exception as e:
        logger.exception("Unexpected error in get_user_preferences: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load preferences",
        ) from e


@router.patch("/preferences", response_model=UserPreferences)
async def update_user_preferences(
    update_data: UserPreferencesUpdate,
    user_id: UUID = Depends(get_current_profile_user_id),  # noqa: B008
    service: UserProfileService = Depends(get_profile_service),  # noqa: B008
) -> UserPreferences:
    """
    Update user preferences (partial update)

    Body: Any combination of:
    - language: LanguageCode
    - theme: ThemePreference
    - notifications: NotificationPreferences
    - privacy: PrivacySettings
    - ui: UIPreferences
    - accessibility: AccessibilitySettings
    """
    try:
        return await service.update_preferences(user_id, update_data)
    except HTTPException:
        raise
    except ValueError as e:
        logger.exception("ValueError in update_preferences")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid data format: {e!s}",
        ) from e
    except (RuntimeError, ConnectionError) as e:
        logger.exception("Unexpected error in update_preferences")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update preferences: {e!s}",
        ) from e
    except Exception as e:
        logger.exception("Unexpected error in update_preferences: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update preferences: {e!s}",
        ) from e


@router.get("/notification-center", response_model=NotificationCenterGetResponse)
async def get_notification_center(
    user_id: UUID = Depends(get_current_profile_user_id),  # noqa: B008
    service: UserProfileService = Depends(get_profile_service),  # noqa: B008
) -> NotificationCenterGetResponse:
    """Cross-device snapshot of the desktop notification center (merged on the client with local rows)."""
    try:
        raw, dismissed_ids, updated_at = await service.get_notification_center_snapshot(user_id)
        items = [NotificationCenterItemSerialized.model_validate(x) for x in raw]
        return NotificationCenterGetResponse(items=items, updated_at=updated_at, dismissed_ids=dismissed_ids)
    except HTTPException:
        raise
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID format") from ValueError
    except Exception as e:
        logger.exception("Unexpected error in get_notification_center: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load notification center",
        ) from e


@router.get("/notification-center/delta", response_model=NotificationCenterDeltaResponse)
async def get_notification_center_delta(
    since: datetime | None = Query(
        default=None,
        description="ISO-8601 server snapshot time the client already has; if still current, response is unchanged.",
    ),
    user_id: UUID = Depends(get_current_profile_user_id),  # noqa: B008
    service: UserProfileService = Depends(get_profile_service),  # noqa: B008
) -> NotificationCenterDeltaResponse:
    """Return full snapshot or `{ unchanged: true }` when `updated_at` is not after `since` (mobile sync)."""
    try:
        raw, dismissed_ids, updated_at = await service.get_notification_center_snapshot(user_id)
        if since is not None and updated_at is not None and updated_at <= since:
            return NotificationCenterDeltaResponse(
                items=[],
                updated_at=updated_at,
                dismissed_ids=[],
                unchanged=True,
            )
        items = [NotificationCenterItemSerialized.model_validate(x) for x in raw]
        return NotificationCenterDeltaResponse(
            items=items,
            updated_at=updated_at,
            dismissed_ids=dismissed_ids,
            unchanged=False,
        )
    except HTTPException:
        raise
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID format") from ValueError
    except Exception as e:
        logger.exception("Unexpected error in get_notification_center_delta: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load notification center",
        ) from e


@router.put("/notification-center", response_model=NotificationCenterGetResponse)
async def put_notification_center(
    body: NotificationCenterPutBody,
    user_id: UUID = Depends(get_current_profile_user_id),  # noqa: B008
    service: UserProfileService = Depends(get_profile_service),  # noqa: B008
) -> NotificationCenterGetResponse:
    """Merge client snapshot into the server inbox (union + dismiss tombstones; max 200 items)."""
    try:
        raw_items = [x.model_dump(mode="json") for x in body.items]
        stored_items, dismissed_ids, updated_at = await service.put_notification_center_snapshot(
            user_id,
            raw_items,
            body.dismissed_ids,
        )
        items = [NotificationCenterItemSerialized.model_validate(x) for x in stored_items]
        return NotificationCenterGetResponse(items=items, updated_at=updated_at, dismissed_ids=dismissed_ids)
    except HTTPException:
        raise
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID format") from ValueError
    except Exception as e:
        logger.exception("Unexpected error in put_notification_center: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save notification center",
        ) from e


@router.put("/mobile-push-token", status_code=status.HTTP_204_NO_CONTENT)
async def put_mobile_push_token(
    body: MobilePushTokenBody,
    user_id: UUID = Depends(get_current_profile_user_id),  # noqa: B008
    service: UserProfileService = Depends(get_profile_service),  # noqa: B008
) -> Response:
    """Register mobile push token (FCM). Persists per user/platform/device_id; 204 on success."""
    await service.upsert_mobile_push_token(
        user_id,
        token=body.token,
        platform=body.platform,
        device_id=body.device_id,
    )
    logger.info(
        "mobile_push_token_upsert user_id=%s platform=%s token_len=%s",
        user_id,
        body.platform,
        len(body.token),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/mobile-push-token", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mobile_push_token(
    body: MobilePushTokenBody,
    user_id: UUID = Depends(get_current_profile_user_id),  # noqa: B008
    service: UserProfileService = Depends(get_profile_service),  # noqa: B008
) -> Response:
    """Unregister a mobile push token. Idempotent 204 to support logout/reinstall cleanup."""

    deleted = await service.delete_mobile_push_token(
        user_id,
        token=body.token,
        platform=body.platform,
        device_id=body.device_id,
    )
    logger.info(
        "mobile_push_token_delete user_id=%s platform=%s token_len=%s deleted=%s",
        user_id,
        body.platform,
        len(body.token),
        deleted,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/preferences/language", response_model=UserPreferences)
async def update_language(
    data: LanguageUpdateRequest,
    user_id: UUID = Depends(get_current_profile_user_id),  # noqa: B008
    service: UserProfileService = Depends(get_profile_service),  # noqa: B008
) -> UserPreferences:
    """Quick language update"""
    try:
        update = UserPreferencesUpdate(language=data.language)
        return await service.update_preferences(user_id, update)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID format") from ValueError


# ========================================
# SECURITY
# ========================================


@router.get("/security", response_model=SecuritySettings)
async def get_security_settings(
    user_id: UUID = Depends(get_current_profile_user_id),  # noqa: B008
    service: UserProfileService = Depends(get_profile_service),  # noqa: B008
) -> SecuritySettings:
    """Get security settings"""
    try:
        return await service.get_security_settings(user_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID format") from ValueError


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    request: Request,
    user_id: UUID = Depends(get_current_profile_user_id),  # noqa: B008
    service: UserProfileService = Depends(get_profile_service),  # noqa: B008
) -> dict[str, Any]:
    """
    Change user password

    Body:
    - current_password: str
    - new_password: str (min 8 chars, must include uppercase, lowercase, number, special char)

    Note: All sessions will be invalidated after password change
    """
    try:
        ip_address = get_client_ip(request)
        success = await service.change_password(user_id, data.current_password, data.new_password, ip_address)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID format") from e
    else:
        return {
            "success": success,
            "message": "Password changed successfully. All sessions have been invalidated.",
        }


@router.get("/sessions", response_model=list[UserSessionInfo])
async def list_active_sessions(
    request: Request,
    user_id: UUID = Depends(get_current_profile_user_id),  # noqa: B008
    service: UserProfileService = Depends(get_profile_service),  # noqa: B008
) -> list[UserSessionInfo]:
    """List all active sessions"""
    try:
        return await service.get_active_sessions(user_id, get_current_token_hash(request))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID format") from ValueError


@router.delete("/sessions/{session_id}")
async def revoke_session(
    request: Request,
    session_id: str,
    user_id: UUID = Depends(get_current_profile_user_id),  # noqa: B008
    service: UserProfileService = Depends(get_profile_service),  # noqa: B008
) -> dict[str, Any]:
    """Revoke a specific session"""
    try:
        session_uuid = UUID(session_id)
        current_session_id = await service.get_session_id_by_token_hash(
            user_id,
            get_current_token_hash(request),
        )
        success = await service.revoke_session(user_id, session_uuid, current_session_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid session ID format") from e
    else:
        return {"success": success, "message": f"Session {session_id} revoked"}


@router.post("/sessions/revoke-all")
async def revoke_all_sessions(
    request: Request,
    user_id: UUID = Depends(get_current_profile_user_id),  # noqa: B008
    service: UserProfileService = Depends(get_profile_service),  # noqa: B008
) -> dict[str, Any]:
    """Revoke all sessions except current"""
    try:
        current_session_id = await service.get_session_id_by_token_hash(
            user_id,
            get_current_token_hash(request),
        )
        count = await service.revoke_all_sessions(user_id, current_session_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID format") from e
    else:
        return {"success": True, "message": f"Revoked {count} sessions", "revoked_count": count}


# ========================================
# STATISTICS & ACTIVITY
# ========================================


@router.get("/statistics", response_model=UserStatistics)
async def get_user_statistics(
    user_id: UUID = Depends(get_current_profile_user_id),  # noqa: B008
    current_user: User = Depends(require_oauth2_user),  # noqa: B008
    service: UserProfileService = Depends(get_profile_service),  # noqa: B008
) -> UserStatistics:
    """
    Get user statistics

    Returns comprehensive statistics including:
    - Account age and login count
    - Chat sessions and messages
    - AI generations
    - Content items and storage usage
    """
    try:
        oauth2_sub = getattr(current_user, "id", None)
        return await service.get_statistics(user_id, oauth2_sub=str(oauth2_sub) if oauth2_sub else None)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID format") from ValueError


@router.get("/activity", response_model=ActivityLogResponse)
async def get_activity_log(
    page: int = 1,
    per_page: int = 50,
    user_id: UUID = Depends(get_current_profile_user_id),  # noqa: B008
    service: UserProfileService = Depends(get_profile_service),  # noqa: B008
) -> ActivityLogResponse:
    """
    Get activity log (paginated)

    Query params:
    - page: int (default 1)
    - per_page: int (default 50, max 100)

    Returns paginated activity log. Empty if user not in DB or table missing.
    """
    per_page = min(max(1, per_page), 100)
    page = max(1, page)
    try:
        result = await service.get_activity_log(user_id, page, per_page)
        return ActivityLogResponse(**result)
    except HTTPException as e:
        if e.status_code == status.HTTP_404_NOT_FOUND:
            return ActivityLogResponse(
                activities=[],
                total=0,
                page=page,
                per_page=per_page,
                total_pages=0,
            )
        raise
    except (ValueError, TypeError) as e:
        logger.warning("get_activity_log validation error: %s", e)
        return ActivityLogResponse(
            activities=[],
            total=0,
            page=page,
            per_page=per_page,
            total_pages=0,
        )


# ========================================
# DATA EXPORT (stub: history returns empty until backend implemented)
# ========================================


@router.get("/export/history", response_model=list[DataExportResponse])
async def get_export_history(
    current_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[DataExportResponse]:
    """Get data export history. Returns empty list until export storage is implemented.
    Requires auth only; does not require user to exist in DB (avoids 404 for transient users).
    """
    return []


# ========================================
# HEALTH CHECK
# ========================================


@router.get("/health")
async def profile_health_check() -> dict[str, str]:
    """Health check endpoint"""
    return {"status": "healthy", "service": "user_profile", "version": "1.0.0"}
