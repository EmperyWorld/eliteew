#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Manages profile, preferences, privacy, avatar, sessions, and mobile push token persistence.
# Invariants:
# - Owner-scoped profile changes only; no raw push tokens are logged.
# - Push upsert supersedes orphan android rows (cleared install / revoked device_id).
# Related:
# - api.routers.user_profile, user_mobile_push_tokens, mobile_trusted_devices
# ---

"""
User Profile Service
Complete user profile management with security, statistics, and avatar handling
"""

import base64
import json
import logging
from datetime import UTC, datetime
from io import BytesIO
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]
from fastapi import HTTPException, UploadFile, status  # type: ignore[import-untyped]
from PIL import Image  # type: ignore[import-untyped]

from api.core.unified_config import unified_settings
from api.schemas.unified_content import ContentCreate, ContentType, Visibility
from api.schemas.user_profile import (
    ActivityLogEntry,
    AvatarHistoryItem,
    AvatarUploadResponse,
    NotificationPreferences,
    ProfileDiscoverability,
    ProfileFieldVisibility,
    ProfilePrivacyResponse,
    ProfilePrivacyUpdate,
    SecuritySettings,
    UserPreferences,
    UserPreferencesUpdate,
    UserProfileResponse,
    UserProfileUpdate,
    UserSessionInfo,
    UserStatistics,
    VideoCallsPreferences,
)
from api.services.unified_content.content_storage_service import (
    ContentStorageService,
)
from api.services.user_password import PasswordManager

logger = logging.getLogger(__name__)


def _deep_merge_preferences_dict(base: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    """Merge partial preference updates without dropping sibling keys (e.g. notifications.ugs)."""
    out = dict(base)
    for k, v in incoming.items():
        if k in out and isinstance(out[k], dict) and isinstance(v, dict):
            out[k] = _deep_merge_preferences_dict(out[k], v)
        else:
            out[k] = v
    return out


class UserProfileService:
    """
    User Profile Service

    Features:
    - Profile CRUD operations
    - Preferences management
    - Avatar upload with image processing (PIL)
    - Security (password change, session management)
    - Statistics calculation with caching
    - Activity audit logging
    """

    # Image constraints
    MAX_AVATAR_SIZE_MB = 5
    MAX_AVATAR_SIZE_BYTES = MAX_AVATAR_SIZE_MB * 1024 * 1024
    ALLOWED_IMAGE_FORMATS = {"image/jpeg", "image/png", "image/webp"}
    MAX_IMAGE_DIMENSION = 2048
    THUMBNAIL_SIZES = {"256": (256, 256), "64": (64, 64)}

    def __init__(self, db_pool: asyncpg.Pool, content_service: ContentStorageService | None = None):
        self.db_pool = db_pool
        self.content_service = content_service
        self.password_manager = PasswordManager()

    async def _set_encryption_key(self, conn: asyncpg.Connection) -> None:
        """Set session PII key for reads/updates touching encrypted users columns.

        Use SET SESSION (not SET LOCAL): asyncpg acquire() often has no open
        transaction yet; SET LOCAL only works inside a transaction (25P01).
        """
        try:
            key = getattr(unified_settings, "encryption_master_key", None)
            if getattr(unified_settings, "encryption_enabled", False) and key:
                safe_key = str(key).replace("'", "''")
                await conn.execute(f"SET SESSION encryption.pii_key = '{safe_key}'")
        except Exception as e:  # noqa: BLE001
            logger.error("Failed to set encryption.pii_key for user profile transaction: %s", e)

    # ========================================
    # PROFILE MANAGEMENT
    # ========================================

    async def get_user_profile(self, user_id: UUID, effective_role: str | None = None) -> UserProfileResponse:
        """Get complete user profile"""
        async with self.db_pool.acquire() as conn:
            # Same as UPDATE paths: PII columns may decrypt only when encryption.pii_key is set for the session.
            await self._set_encryption_key(conn)
            row = await conn.fetchrow(
                """
                SELECT id, username, email, full_name, bio, avatar_url, role,
                       is_active, is_verified, COALESCE(is_trusted, FALSE) AS is_trusted,
                       NULLIF(BTRIM(COALESCE(admin_badge_label, '')), '') AS admin_badge_label,
                       NULLIF(BTRIM(COALESCE(admin_badge_hint, '')), '') AS admin_badge_hint,
                       preferences, created_at,
                       last_login_at, login_count
                FROM users
                WHERE id = $1
                """,
                user_id,
            )

            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

            # Handle JSONB preferences
            prefs = row["preferences"]
            prefs_dict = (json.loads(prefs) if prefs else {}) if isinstance(prefs, str) else prefs or {}

            return UserProfileResponse(
                id=str(row["id"]),
                username=row["username"],
                email=row["email"],
                full_name=row["full_name"],
                bio=row["bio"],
                avatar_url=row["avatar_url"],
                role=effective_role or row["role"],
                is_active=row["is_active"],
                is_verified=row["is_verified"],
                is_trusted=bool(row.get("is_trusted")),
                admin_badge_label=row.get("admin_badge_label"),
                admin_badge_hint=row.get("admin_badge_hint"),
                preferences=prefs_dict,
                created_at=row["created_at"],
                last_login_at=row["last_login_at"],
                login_count=row["login_count"],
            )

    async def update_profile(
        self,
        user_id: UUID,
        update_data: UserProfileUpdate,
        ip_address: str | None = None,
        effective_role: str | None = None,
    ) -> UserProfileResponse:
        """Update user profile (full_name, bio)"""
        async with self.db_pool.acquire() as conn, conn.transaction():
            await self._set_encryption_key(conn)
            # Build update query dynamically
            updates = []
            values: list[Any] = [user_id]
            param_idx = 2

            if update_data.full_name is not None:
                updates.append(f"full_name = ${param_idx}")
                values.append(update_data.full_name)
                param_idx += 1

            if update_data.bio is not None:
                updates.append(f"bio = ${param_idx}")
                values.append(update_data.bio)
                param_idx += 1

            if not updates:
                # No changes, return current profile
                return await self.get_user_profile(user_id, effective_role=effective_role)

            updates.append("updated_at = NOW()")
            update_clause = ", ".join(updates)

            # Note: update_clause is built from hardcoded field names, params are passed separately
            await conn.execute(
                f"""
                    UPDATE users
                    SET {update_clause}
                    WHERE id = $1
                    """,  # noqa: S608
                *values,
            )

            # Log activity
            await self._log_activity(conn, user_id, "profile_updated", "User updated profile information", ip_address)

            # 🔥 Event-based cache invalidation
            try:
                from api.services.cache_event_invalidator import (
                    get_event_invalidator,
                )

                invalidator = await get_event_invalidator()
                await invalidator.invalidate_on_user_update(str(user_id))
            except (ImportError, RuntimeError, ConnectionError):  # fmt: skip
                logger.debug("Event invalidator error (non-critical)")
            except (ValueError, TypeError):  # fmt: skip
                logger.debug("Unexpected event invalidator error (non-critical)")

            return await self.get_user_profile(user_id, effective_role=effective_role)

    # ========================================
    # PROFILE PRIVACY (server-side)
    # ========================================

    async def _ensure_privacy_row(self, conn: asyncpg.Connection, user_id: UUID) -> None:
        await conn.execute(
            "INSERT INTO user_profile_privacy (user_id) VALUES ($1) ON CONFLICT DO NOTHING",
            user_id,
        )

    @staticmethod
    def _privacy_response_from_row(row: asyncpg.Record) -> ProfilePrivacyResponse:
        return ProfilePrivacyResponse(
            discoverability=ProfileDiscoverability(str(row["discoverability"])),
            avatar_visibility=ProfileFieldVisibility(str(row["avatar_visibility"])),
            avatar_circle_id=str(row["avatar_circle_id"]) if row["avatar_circle_id"] else None,
            full_name_visibility=ProfileFieldVisibility(str(row["full_name_visibility"])),
            full_name_circle_id=str(row["full_name_circle_id"]) if row["full_name_circle_id"] else None,
            bio_visibility=ProfileFieldVisibility(str(row["bio_visibility"])),
            bio_circle_id=str(row["bio_circle_id"]) if row["bio_circle_id"] else None,
            updated_at=row["updated_at"],
        )

    async def _validate_circle_owned(
        self, conn: asyncpg.Connection, owner_user_id: UUID, circle_id: UUID | None
    ) -> None:
        if circle_id is None:
            return
        ok = await conn.fetchval(
            "SELECT 1 FROM friend_circles WHERE id = $1 AND owner_user_id = $2",
            circle_id,
            owner_user_id,
        )
        if not ok:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Круг не найден или не принадлежит вам",
            )

    async def get_profile_privacy(self, user_id: UUID) -> ProfilePrivacyResponse:
        async with self.db_pool.acquire() as conn:
            await self._ensure_privacy_row(conn, user_id)
            row = await conn.fetchrow(
                """
                SELECT user_id, discoverability,
                       avatar_visibility, avatar_circle_id,
                       full_name_visibility, full_name_circle_id,
                       bio_visibility, bio_circle_id, updated_at
                FROM user_profile_privacy
                WHERE user_id = $1
                """,
                user_id,
            )
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return self._privacy_response_from_row(row)

    async def update_profile_privacy(self, user_id: UUID, data: ProfilePrivacyUpdate) -> ProfilePrivacyResponse:
        async with self.db_pool.acquire() as conn, conn.transaction():
            await self._ensure_privacy_row(conn, user_id)
            row = await conn.fetchrow(
                "SELECT * FROM user_profile_privacy WHERE user_id = $1 FOR UPDATE",
                user_id,
            )
            if row is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

            disc = ProfileDiscoverability(str(row["discoverability"]))
            av_v = ProfileFieldVisibility(str(row["avatar_visibility"]))
            fn_v = ProfileFieldVisibility(str(row["full_name_visibility"]))
            bio_v = ProfileFieldVisibility(str(row["bio_visibility"]))
            av_c = row["avatar_circle_id"]
            fn_c = row["full_name_circle_id"]
            bio_c = row["bio_circle_id"]

            if data.discoverability is not None:
                disc = data.discoverability
            if data.avatar_visibility is not None:
                av_v = data.avatar_visibility
            if data.full_name_visibility is not None:
                fn_v = data.full_name_visibility
            if data.bio_visibility is not None:
                bio_v = data.bio_visibility

            if data.avatar_circle_id is not None:
                av_c = UUID(data.avatar_circle_id) if str(data.avatar_circle_id).strip() else None
            if data.full_name_circle_id is not None:
                fn_c = UUID(data.full_name_circle_id) if str(data.full_name_circle_id).strip() else None
            if data.bio_circle_id is not None:
                bio_c = UUID(data.bio_circle_id) if str(data.bio_circle_id).strip() else None

            if av_v != ProfileFieldVisibility.CIRCLE:
                av_c = None
            if fn_v != ProfileFieldVisibility.CIRCLE:
                fn_c = None
            if bio_v != ProfileFieldVisibility.CIRCLE:
                bio_c = None

            for vis, cid in (
                (av_v, av_c),
                (fn_v, fn_c),
                (bio_v, bio_c),
            ):
                if vis == ProfileFieldVisibility.CIRCLE and cid is None:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Для видимости «круг» укажите circle_id",
                    )
                if cid is not None:
                    await self._validate_circle_owned(conn, user_id, cid)

            await conn.execute(
                """
                UPDATE user_profile_privacy
                SET discoverability = $2,
                    avatar_visibility = $3,
                    avatar_circle_id = $4,
                    full_name_visibility = $5,
                    full_name_circle_id = $6,
                    bio_visibility = $7,
                    bio_circle_id = $8,
                    updated_at = NOW()
                WHERE user_id = $1
                """,
                user_id,
                disc.value,
                av_v.value,
                av_c,
                fn_v.value,
                fn_c,
                bio_v.value,
                bio_c,
            )

            out = await conn.fetchrow(
                """
                SELECT user_id, discoverability,
                       avatar_visibility, avatar_circle_id,
                       full_name_visibility, full_name_circle_id,
                       bio_visibility, bio_circle_id, updated_at
                FROM user_profile_privacy
                WHERE user_id = $1
                """,
                user_id,
            )
        if out is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return self._privacy_response_from_row(out)

    # ========================================
    # PREFERENCES MANAGEMENT
    # ========================================

    async def get_preferences(self, user_id: UUID) -> UserPreferences:
        """Get user preferences"""
        try:
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow("SELECT preferences FROM users WHERE id = $1", user_id)

                if not row:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

                prefs = row["preferences"]

                # Handle JSONB: asyncpg may return string or dict
                prefs_dict = (json.loads(prefs) if prefs else {}) if isinstance(prefs, str) else prefs or {}

                return UserPreferences(**prefs_dict)
        except HTTPException:
            raise
        except asyncpg.PostgresError as e:
            logger.exception("Database error in get_preferences: %s", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database error loading preferences",
            ) from e

    async def update_preferences(self, user_id: UUID, update_data: UserPreferencesUpdate) -> UserPreferences:
        """Update user preferences (partial update)"""
        try:
            async with self.db_pool.acquire() as conn, conn.transaction():
                await self._set_encryption_key(conn)
                # Get current preferences
                current_prefs = await conn.fetchval("SELECT preferences FROM users WHERE id = $1", user_id)

                if current_prefs is None:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

                # Merge with updates
                # Handle JSONB: asyncpg may return string or dict
                if isinstance(current_prefs, str):
                    updated_prefs = json.loads(current_prefs) if current_prefs else {}
                else:
                    updated_prefs = dict(current_prefs) if current_prefs else {}

                if update_data.language is not None:
                    updated_prefs["language"] = update_data.language.value

                if update_data.theme is not None:
                    updated_prefs["theme"] = update_data.theme.value

                if update_data.timezone is not None:
                    updated_prefs["timezone"] = update_data.timezone

                if update_data.notifications is not None:
                    try:
                        current_model = UserPreferences.model_validate(updated_prefs)
                    except Exception:
                        current_model = UserPreferences()
                    base_notif = current_model.notifications.model_dump()
                    incoming_notif = update_data.notifications.model_dump(exclude_unset=True)
                    merged_notif = _deep_merge_preferences_dict(base_notif, incoming_notif)
                    updated_prefs["notifications"] = NotificationPreferences.model_validate(merged_notif).model_dump()

                if update_data.privacy is not None:
                    updated_prefs["privacy"] = update_data.privacy.model_dump()

                if update_data.ui is not None:
                    updated_prefs["ui"] = update_data.ui.model_dump()

                if update_data.accessibility is not None:
                    updated_prefs["accessibility"] = update_data.accessibility.model_dump()

                if update_data.video_calls is not None:
                    try:
                        current_model = UserPreferences.model_validate(updated_prefs)
                    except Exception:
                        current_model = UserPreferences()
                    base_vc = current_model.video_calls.model_dump()
                    incoming_vc = update_data.video_calls.model_dump(exclude_unset=True)
                    merged_vc = _deep_merge_preferences_dict(base_vc, incoming_vc)
                    updated_prefs["video_calls"] = VideoCallsPreferences.model_validate(merged_vc).model_dump()

                # Ensure JSON-serializable for JSONB (avoid trigger/serialization issues)
                prefs_for_db = json.loads(json.dumps(updated_prefs))
                # asyncpg expects JSONB as JSON string when passed as query argument
                prefs_json_str = json.dumps(prefs_for_db)

                # Save to database
                await conn.execute(
                    """
                    UPDATE users
                    SET preferences = $2::jsonb, updated_at = NOW()
                    WHERE id = $1
                    """,
                    user_id,
                    prefs_json_str,
                )

                # Build response; tolerate invalid/legacy values from DB (e.g. unknown theme)
                try:
                    return UserPreferences.model_validate(updated_prefs)
                except Exception as val_err:  # noqa: BLE001
                    logger.warning(
                        "Preferences validation failed after save: %s",
                        val_err,
                        extra={"updated_prefs_keys": list(updated_prefs.keys())},
                    )
                    return UserPreferences()
        except HTTPException:
            raise
        except asyncpg.PostgresError as e:
            logger.exception("Database error in update_preferences: %s", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error updating preferences: {e!s}",
            ) from e

    # ========================================
    # NOTIFICATION CENTER (cross-device snapshot)
    # ========================================

    async def get_notification_center_snapshot(
        self, user_id: UUID
    ) -> tuple[list[dict[str, Any]], list[str], datetime | None]:
        """Return visible inbox items, tombstone ids, and row updated_at."""
        try:
            from api.services.notification_center_inbox import load_visible_inbox

            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT items, dismissed_ids, updated_at
                    FROM user_notification_center
                    WHERE user_id = $1
                    """,
                    user_id,
                )
                if not row:
                    return [], [], None
                items, dismissed = load_visible_inbox(row["items"], row["dismissed_ids"])
                return items, dismissed, row["updated_at"]
        except asyncpg.PostgresError as e:
            logger.exception("Database error in get_notification_center_snapshot: %s", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database error loading notification center",
            ) from e

    async def put_notification_center_snapshot(
        self,
        user_id: UUID,
        items: list[dict[str, Any]],
        dismissed_ids: list[str] | None = None,
    ) -> tuple[list[dict[str, Any]], list[str], datetime]:
        """Merge client snapshot into inbox (union + tombstones). Returns stored items, dismissed ids, updated_at."""
        if len(items) > 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Too many items (max 200)",
            )
        from api.services.notification_center_inbox import apply_notification_center_put

        try:
            return await apply_notification_center_put(
                self.db_pool,
                user_id,
                items,
                dismissed_ids or [],
            )
        except asyncpg.PostgresError as e:
            logger.exception("Database error in put_notification_center_snapshot: %s", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database error saving notification center",
            ) from e

    # ========================================
    # MOBILE PUSH (FCM / device token)
    # ========================================

    async def upsert_mobile_push_token(
        self,
        user_id: UUID,
        *,
        token: str,
        platform: str = "android",
        device_id: str | None = None,
    ) -> None:
        """Insert or update push token for (user, platform, device_id).

        After clear-data / reinstall the phone gets a new ``device_id`` while the old
        FCM row remains. Send-to-all then wastes deliveries on a dead token. Supersede:
        drop same-token rows under other device_ids, and drop android rows whose
        ``device_id`` is not among this user's active trusted devices (when any exist).
        """
        plat = (platform or "android").strip()[:32] or "android"
        did = (device_id or "").strip()[:256]
        tok = (token or "").strip()
        if not tok:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Push token must not be blank",
            )
        try:
            async with self.db_pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO user_mobile_push_tokens (user_id, platform, device_id, token, updated_at)
                    VALUES ($1, $2, $3, $4, NOW())
                    ON CONFLICT (user_id, platform, device_id) DO UPDATE SET
                        token = EXCLUDED.token,
                        updated_at = NOW()
                    """,
                    user_id,
                    plat,
                    did,
                    tok,
                )
                # Same FCM token re-registered under a new device_id (prefs wipe).
                await conn.execute(
                    """
                    DELETE FROM user_mobile_push_tokens
                    WHERE user_id = $1
                      AND platform = $2
                      AND token = $3
                      AND device_id IS DISTINCT FROM $4
                    """,
                    user_id,
                    plat,
                    tok,
                    did,
                )
                # Orphans after reinstall: old device_id no longer an active trusted phone.
                # Skip when the user has zero active trusted devices (login before bind).
                if plat == "android" and did:
                    await conn.execute(
                        """
                        DELETE FROM user_mobile_push_tokens t
                        WHERE t.user_id = $1
                          AND t.platform = $2
                          AND t.device_id IS DISTINCT FROM $3
                          AND EXISTS (
                              SELECT 1
                              FROM public.mobile_trusted_devices d
                              WHERE d.user_id = $1
                                AND d.status = 'active'
                          )
                          AND NOT EXISTS (
                              SELECT 1
                              FROM public.mobile_trusted_devices d
                              WHERE d.user_id = $1
                                AND d.status = 'active'
                                AND d.stable_device_id = t.device_id
                          )
                        """,
                        user_id,
                        plat,
                        did,
                    )
        except asyncpg.PostgresError as e:
            logger.exception("Database error in upsert_mobile_push_token: %s", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save mobile push token",
            ) from e

    async def delete_mobile_push_token(
        self,
        user_id: UUID,
        *,
        token: str,
        platform: str = "android",
        device_id: str | None = None,
    ) -> int:
        """Delete a registered push token for the current user."""

        plat = (platform or "android").strip()[:32] or "android"
        did = (device_id or "").strip()[:256]
        try:
            async with self.db_pool.acquire() as conn:
                result = await conn.execute(
                    """
                    DELETE FROM user_mobile_push_tokens
                    WHERE user_id = $1 AND platform = $2 AND device_id = $3 AND token = $4
                    """,
                    user_id,
                    plat,
                    did,
                    token,
                )
        except asyncpg.PostgresError as e:
            logger.exception("Database error in delete_mobile_push_token: %s", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete mobile push token",
            ) from e
        try:
            return int(result.rsplit(" ", 1)[-1])
        except ValueError, AttributeError:
            return 0

    # ========================================
    # AVATAR MANAGEMENT
    # ========================================

    async def upload_avatar(self, user_id: UUID, file: UploadFile, current_user_email: str) -> AvatarUploadResponse:
        """
        Upload and process user avatar
        1. Validate image format and size
        2. Process image (resize if needed)
        3. Generate thumbnails (256x256, 64x64)
        4. Upload to unified_content
        5. Update user.avatar_url
        6. Save to user_avatar_history
        """
        # Read file
        file_data = await file.read()

        # Validate size
        if len(file_data) > self.MAX_AVATAR_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File too large. Maximum size is {self.MAX_AVATAR_SIZE_MB}MB",
            )

        # Validate and process image
        try:
            processed_images = await self._validate_and_process_image(file_data, file.filename or "avatar.jpg")
        except (ValueError, OSError) as e:
            logger.exception("Image processing failed")
            detail_msg = f"Invalid image: {e!s}"
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail_msg) from e

        # Upload to unified_content if service available
        content_id = None
        avatar_url = None

        if self.content_service:
            try:
                # Upload original
                original_filename = (
                    file.filename or f"avatar_{user_id}_{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}.jpg"
                )
                content_data = ContentCreate(
                    user_id=str(user_id),
                    name=f"avatar_{user_id}_{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}",
                    original_filename=original_filename,
                    description=None,
                    sub_type=None,
                    company_id=None,
                    project_id=None,
                    title=None,
                    word_count=None,
                    character_count=None,
                    access_level=None,
                    is_public=None,
                    tags=["avatar", "profile"],
                    content_type=ContentType.IMAGE,
                    mime_type=processed_images["mime_type"],
                    visibility=Visibility.PUBLIC,
                    source_service="user_profile",
                    source_id=None,
                    folder_item_id=None,
                    apply_project_desktop_folder=True,
                    metadata={"type": "avatar", "user_id": str(user_id)},
                )

                content = await self.content_service.create_content(
                    content_data, processed_images["original"], str(user_id)
                )

                content_id = str(content.id)
                # Canonical unified-content download URL (v1 API)
                avatar_url = f"/api/v1/content/{content_id}/download"

            except (RuntimeError, ConnectionError):  # fmt: skip
                logger.exception("Failed to upload avatar to unified_content")
                # Fallback: use data URL (not recommended for production)
                avatar_url = (
                    f"data:{processed_images['mime_type']};base64,"
                    f"{base64.b64encode(processed_images['original']).decode()}"
                )

        # Save to database
        async with self.db_pool.acquire() as conn, conn.transaction():
            await self._set_encryption_key(conn)
            # Update user.avatar_url
            await conn.execute(
                """
                    UPDATE users
                    SET avatar_url = $2, updated_at = NOW()
                    WHERE id = $1
                    """,
                user_id,
                avatar_url,
            )

            # Deactivate previous avatars
            await conn.execute(
                """
                    UPDATE user_avatar_history
                    SET is_active = false
                    WHERE user_id = $1 AND is_active = true
                    """,
                user_id,
            )

            # Insert new avatar history
            await conn.fetchval(
                """
                    INSERT INTO user_avatar_history (
                        user_id, content_id, avatar_url,
                        thumbnail_256_url, thumbnail_64_url,
                        is_active, file_size, mime_type
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    RETURNING id
                    """,
                user_id,
                UUID(content_id) if content_id else None,
                avatar_url,
                None,  # thumbnail URLs (can be implemented later)
                None,
                True,  # is_active  # noqa: FBT003
                len(file_data),
                processed_images["mime_type"],
            )

            # Log activity
            await self._log_activity(
                conn,
                user_id,
                "avatar_uploaded",
                f"User uploaded new avatar (size: {len(file_data)} bytes)",
                None,
            )

        return AvatarUploadResponse(
            avatar_url=avatar_url or "",
            thumbnail_256_url=None,
            thumbnail_64_url=None,
            content_id=content_id,
            file_size=len(file_data),
            mime_type=processed_images["mime_type"],
            created_at=datetime.now(UTC),
        )

    async def delete_avatar(self, user_id: UUID) -> bool:
        """Delete user avatar"""
        async with self.db_pool.acquire() as conn, conn.transaction():
            await self._set_encryption_key(conn)
            await conn.execute(
                """
                    UPDATE users
                    SET avatar_url = NULL, updated_at = NOW()
                    WHERE id = $1
                    """,
                user_id,
            )

            await conn.execute(
                """
                    UPDATE user_avatar_history
                    SET is_active = false
                    WHERE user_id = $1 AND is_active = true
                    """,
                user_id,
            )

            await self._log_activity(conn, user_id, "avatar_deleted", "User deleted avatar", None)

        return True

    async def get_avatar_history(self, user_id: UUID) -> list[AvatarHistoryItem]:
        """Get avatar history"""
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, avatar_url, thumbnail_256_url, thumbnail_64_url,
                       is_active, file_size, mime_type, created_at
                FROM user_avatar_history
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT 50
                """,
                user_id,
            )

            return [
                AvatarHistoryItem(
                    id=str(row["id"]),
                    avatar_url=row["avatar_url"],
                    thumbnail_256_url=row["thumbnail_256_url"],
                    thumbnail_64_url=row["thumbnail_64_url"],
                    is_active=row["is_active"],
                    file_size=row["file_size"],
                    mime_type=row["mime_type"],
                    created_at=row["created_at"],
                )
                for row in rows
            ]

    # ========================================
    # SECURITY
    # ========================================

    async def change_password(
        self, user_id: UUID, current_password: str, new_password: str, ip_address: str | None = None
    ) -> bool:
        """
        Change user password
        1. Verify current password
        2. Validate new password strength
        3. Hash new password
        4. Update database
        5. Invalidate ALL sessions except current
        6. Log activity
        """
        async with self.db_pool.acquire() as conn, conn.transaction():
            await self._set_encryption_key(conn)
            # Get current password hash
            row = await conn.fetchrow("SELECT password_hash FROM users WHERE id = $1", user_id)

            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

            # Verify current password
            if not self.password_manager.verify_password(current_password, row["password_hash"]):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

            # Hash new password
            new_password_hash = self.password_manager.hash_password(new_password)

            # Update password
            await conn.execute(
                """
                    UPDATE users
                    SET password_hash = $2, updated_at = NOW()
                    WHERE id = $1
                    """,
                user_id,
                new_password_hash,
            )

            # Invalidate ALL sessions (security best practice)
            await conn.execute(
                """
                    UPDATE user_sessions
                    SET is_active = false
                    WHERE user_id = $1
                    """,
                user_id,
            )

            # Log activity
            await self._log_activity(
                conn,
                user_id,
                "password_changed",
                "User changed password (all sessions invalidated)",
                ip_address,
            )

        logger.info("Password changed successfully for user %s", user_id)
        return True

    async def get_security_settings(self, user_id: UUID) -> SecuritySettings:
        """Get security settings"""
        async with self.db_pool.acquire() as conn:
            user_row = await conn.fetchrow(
                """
                SELECT failed_login_attempts, locked_until, updated_at
                FROM users
                WHERE id = $1
                """,
                user_id,
            )

            if not user_row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

            # Count active sessions
            active_sessions = await conn.fetchval(
                """
                SELECT COUNT(*)
                FROM user_sessions
                WHERE user_id = $1 AND is_active = true
                      AND expires_at > NOW()
                """,
                user_id,
            )

            return SecuritySettings(
                two_factor_enabled=False,  # Not implemented yet
                last_password_change=user_row["updated_at"],
                active_sessions_count=active_sessions or 0,
                failed_login_attempts=user_row["failed_login_attempts"] or 0,
                locked_until=user_row["locked_until"],
            )

    async def get_active_sessions(self, user_id: UUID, current_token_hash: str | None = None) -> list[UserSessionInfo]:
        """Get all active sessions for user"""
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, ip_address, user_agent, device_info,
                       last_used_at, created_at, token_hash
                FROM user_sessions
                WHERE user_id = $1
                  AND is_active = true
                  AND expires_at > NOW()
                ORDER BY last_used_at DESC
                """,
                user_id,
            )

            return [
                UserSessionInfo(
                    id=str(row["id"]),
                    ip_address=str(row["ip_address"]) if row["ip_address"] else None,
                    user_agent=row["user_agent"],
                    device_info=row["device_info"] or {},
                    last_used_at=row["last_used_at"],
                    created_at=row["created_at"],
                    is_current=(row["token_hash"] == current_token_hash) if current_token_hash else False,
                )
                for row in rows
            ]

    async def get_session_id_by_token_hash(self, user_id: UUID, token_hash: str | None) -> UUID | None:
        """Resolve the current session ID from the token hash stored in user_sessions."""
        if not token_hash:
            return None

        async with self.db_pool.acquire() as conn:
            session_id = await conn.fetchval(
                """
                SELECT id
                FROM user_sessions
                WHERE user_id = $1
                  AND token_hash = $2
                  AND is_active = true
                  AND expires_at > NOW()
                ORDER BY last_used_at DESC NULLS LAST, created_at DESC
                LIMIT 1
                """,
                user_id,
                token_hash,
            )

        return session_id

    async def revoke_session(self, user_id: UUID, session_id: UUID, current_session_id: UUID | None) -> bool:
        """Revoke a specific session"""
        if current_session_id is not None and session_id == current_session_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot revoke current session")

        async with self.db_pool.acquire() as conn:
            result = await conn.execute(
                """
                UPDATE user_sessions
                SET is_active = false
                WHERE id = $1 AND user_id = $2
                """,
                session_id,
                user_id,
            )

            if result == "UPDATE 0":
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

            await self._log_activity(conn, user_id, "session_revoked", f"User revoked session {session_id}", None)

        return True

    async def revoke_all_sessions(self, user_id: UUID, current_session_id: UUID | None) -> int:
        """Revoke all sessions except current"""
        async with self.db_pool.acquire() as conn:
            if current_session_id is not None:
                rows = await conn.fetch(
                    """
                    UPDATE user_sessions
                    SET is_active = false
                    WHERE user_id = $1
                      AND id != $2
                      AND is_active = true
                    RETURNING id
                    """,
                    user_id,
                    current_session_id,
                )
            else:
                rows = await conn.fetch(
                    """
                    UPDATE user_sessions
                    SET is_active = false
                    WHERE user_id = $1
                      AND is_active = true
                    RETURNING id
                    """,
                    user_id,
                )

            count = len(rows)

            await self._log_activity(conn, user_id, "all_sessions_revoked", f"User revoked {count} sessions", None)

        return count

    # ========================================
    # STATISTICS
    # ========================================

    async def get_statistics(self, user_id: UUID, oauth2_sub: str | None = None) -> UserStatistics:
        """Get user statistics from direct queries (no view).

        - Account age: full calendar days (not EXTRACT(DAY FROM interval), which is wrong for multi-month ages).
        - Chat messages/tokens: COUNT/SUM from ``chat_messages`` joined to sessions (authoritative).
        - AI: ``ai_generations`` plus UGS ``generation_requests`` (non-deleted). Success rate = completed /
          (completed + failed) among terminal outcomes (excludes pending/processing/cancelled from denominator).
        - Content: ``unified_content`` with ``(user_id)::text`` match like ``/content/statistics``;
          only ``deleted_at IS NULL``.
        oauth2_sub: Keycloak ``sub`` when it may differ from ``users.id`` in legacy rows.
        """
        async with self.db_pool.acquire() as conn:
            # Calendar days since registration (EXTRACT(DAY FROM ts1 - ts2) is NOT total days for long spans).
            user_chat = await conn.fetchrow(
                """
                SELECT
                    GREATEST(
                        0,
                        (
                            (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
                            - (u.created_at AT TIME ZONE 'UTC')::date
                        )
                    )::int AS account_age_days,
                    COALESCE(u.login_count, 0)::int AS total_logins,
                    u.last_login_at AS last_login,
                    COUNT(cs.id)::int AS total_chat_sessions,
                    COUNT(cs.id) FILTER (WHERE cs.status = 'active')::int AS active_chat_sessions
                FROM users u
                LEFT JOIN chat_sessions cs ON cs.user_id = u.id
                WHERE u.id = $1
                GROUP BY u.id, u.created_at, u.login_count, u.last_login_at
                """,
                user_id,
            )

            if not user_chat:
                return UserStatistics(
                    account_age_days=0,
                    total_logins=0,
                    last_login=None,
                    total_chat_sessions=0,
                    active_chat_sessions=0,
                    total_chat_messages=0,
                    total_chat_tokens=0,
                    total_ai_generations=0,
                    completed_ai_generations=0,
                    failed_ai_generations=0,
                    ai_success_rate=0.0,
                    total_content_items=0,
                    storage_used_bytes=0,
                    storage_used_mb=0.0,
                    storage_quota_mb=10240.0,
                )

            total_chat_messages = 0
            total_chat_tokens = 0
            try:
                msg_row = await conn.fetchrow(
                    """
                    SELECT
                        COUNT(cm.id)::bigint AS total_chat_messages,
                        COALESCE(SUM(COALESCE(cm.token_count, 0)), 0)::bigint AS total_chat_tokens
                    FROM chat_messages cm
                    INNER JOIN chat_sessions cs ON cm.session_id = cs.id
                    WHERE cs.user_id = $1
                    """,
                    user_id,
                )
                if msg_row:
                    total_chat_messages = int(msg_row["total_chat_messages"] or 0)
                    total_chat_tokens = int(msg_row["total_chat_tokens"] or 0)
            except asyncpg.exceptions.UndefinedTableError:
                logger.debug("chat_messages stats skipped (table missing)")
            except Exception as e:
                logger.debug("chat_messages stats skipped: %s", e)

            # Legacy ai_generations + UGS generation_requests (same user_id = users.id)
            total_ai = completed_ai = failed_ai = 0
            try:
                ai_row = await conn.fetchrow(
                    """
                    SELECT
                        COUNT(*)::int AS total_ai_generations,
                        COUNT(*) FILTER (WHERE status IN ('completed', 'success'))::int AS completed_ai_generations,
                        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_ai_generations
                    FROM (
                        SELECT status FROM ai_generations WHERE user_id = $1
                        UNION ALL
                        SELECT status FROM generation_requests
                        WHERE user_id = $1 AND deleted_at IS NULL
                    ) AS combined
                    """,
                    user_id,
                )
                if ai_row:
                    total_ai = ai_row["total_ai_generations"] or 0
                    completed_ai = ai_row["completed_ai_generations"] or 0
                    failed_ai = ai_row["failed_ai_generations"] or 0
            except asyncpg.exceptions.UndefinedTableError:
                ai_row = await conn.fetchrow(
                    """
                    SELECT
                        COUNT(*)::int AS total_ai_generations,
                        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_ai_generations,
                        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_ai_generations
                    FROM ai_generations
                    WHERE user_id = $1
                    """,
                    user_id,
                )
                if ai_row:
                    total_ai = ai_row["total_ai_generations"] or 0
                    completed_ai = ai_row["completed_ai_generations"] or 0
                    failed_ai = ai_row["failed_ai_generations"] or 0
            except Exception as e:
                logger.warning("AI generation stats query failed: %s", e)

            terminal = completed_ai + failed_ai
            ai_success_rate = (completed_ai / terminal * 100.0) if terminal else 0.0

            # Align with GET /unified_content/content/statistics: text match + only non-deleted rows
            total_content_items = 0
            storage_used_bytes = 0
            try:
                user_id_str = str(user_id)
                oauth2_sub_clean = (oauth2_sub or "").strip()
                params: list[str] = [user_id_str]
                if oauth2_sub_clean and oauth2_sub_clean != user_id_str:
                    uid_sql = "((user_id)::text = $1 OR (user_id)::text = $2)"
                    params.append(oauth2_sub_clean)
                else:
                    uid_sql = "(user_id)::text = $1"

                content_row = await conn.fetchrow(
                    f"""
                    SELECT
                        COUNT(*)::int AS total_content_items,
                        COALESCE(SUM(COALESCE(file_size, 0)), 0)::bigint AS storage_used_bytes
                    FROM unified_content
                    WHERE {uid_sql}
                      AND deleted_at IS NULL
                    """,
                    *params,
                )
                if content_row:
                    total_content_items = content_row["total_content_items"] or 0
                    storage_used_bytes = content_row["storage_used_bytes"] or 0
            except asyncpg.exceptions.UndefinedTableError:
                pass
            except Exception as e:
                logger.debug("unified_content stats skipped: %s", e)

            storage_mb = storage_used_bytes / (1024 * 1024)

            return UserStatistics(
                account_age_days=user_chat["account_age_days"] or 0,
                total_logins=user_chat["total_logins"] or 0,
                last_login=user_chat["last_login"],
                total_chat_sessions=user_chat["total_chat_sessions"] or 0,
                active_chat_sessions=user_chat["active_chat_sessions"] or 0,
                total_chat_messages=total_chat_messages,
                total_chat_tokens=total_chat_tokens,
                total_ai_generations=total_ai,
                completed_ai_generations=completed_ai,
                failed_ai_generations=failed_ai,
                ai_success_rate=round(ai_success_rate, 2),
                total_content_items=total_content_items,
                storage_used_bytes=storage_used_bytes,
                storage_used_mb=round(storage_mb, 2),
                storage_quota_mb=10240.0,
            )

    @staticmethod
    def _coerce_activity_metadata(raw: Any) -> dict[str, Any]:
        """Normalize JSONB / legacy string metadata for ActivityLogEntry."""
        if raw is None:
            return {}
        if isinstance(raw, dict):
            return raw
        if isinstance(raw, str):
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                return {}
            return parsed if isinstance(parsed, dict) else {}
        return {}

    async def get_activity_log(self, user_id: UUID, page: int = 1, per_page: int = 50) -> dict[str, Any]:
        """Get paginated activity log. Returns empty result if table missing."""
        offset = (page - 1) * per_page
        empty = {
            "activities": [],
            "total": 0,
            "page": page,
            "per_page": per_page,
            "total_pages": 0,
        }

        try:
            async with self.db_pool.acquire() as conn:
                total_val = await conn.fetchval("SELECT COUNT(*) FROM user_activity_log WHERE user_id = $1", user_id)
                total = int(total_val) if total_val is not None else 0

                rows = await conn.fetch(
                    """
                    SELECT id, action, description, ip_address,
                           user_agent, metadata, created_at
                    FROM user_activity_log
                    WHERE user_id = $1
                    ORDER BY created_at DESC
                    LIMIT $2 OFFSET $3
                    """,
                    user_id,
                    per_page,
                    offset,
                )

                activities: list[ActivityLogEntry] = []
                for row in rows:
                    try:
                        activities.append(
                            ActivityLogEntry(
                                id=str(row["id"]),
                                action=row["action"],
                                description=row["description"],
                                ip_address=str(row["ip_address"]) if row["ip_address"] else None,
                                user_agent=row["user_agent"],
                                metadata=self._coerce_activity_metadata(row["metadata"]),
                                created_at=row["created_at"],
                            )
                        )
                    except Exception as row_err:
                        logger.warning(
                            "get_activity_log: skip malformed row id=%s: %s",
                            row.get("id"),
                            row_err,
                        )

                total_pages = (total + per_page - 1) // per_page if per_page > 0 else 0

                return {
                    "activities": activities,
                    "total": total,
                    "page": page,
                    "per_page": per_page,
                    "total_pages": total_pages,
                }
        except asyncpg.exceptions.UndefinedTableError:
            logger.warning("user_activity_log table missing, returning empty activity log")
            return empty
        except Exception:
            logger.exception("get_activity_log failed, returning empty activity log")
            return empty

    # ========================================
    # HELPER METHODS
    # ========================================

    async def _log_activity(
        self,
        conn: asyncpg.Connection | asyncpg.pool.PoolConnectionProxy,
        user_id: UUID,
        action: str,
        description: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Log user activity (internal method)"""
        payload_meta = metadata if metadata else {}
        # asyncpg + ::jsonb: bind JSON as string (dict must not be passed raw; see preferences update).
        metadata_json = json.dumps(payload_meta, default=str)

        try:
            await conn.execute(
                """
                INSERT INTO user_activity_log (
                    user_id, action, description, ip_address, user_agent, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
                """,
                user_id,
                action,
                description,
                ip_address,
                user_agent,
                metadata_json,
            )
        except asyncpg.exceptions.UndefinedTableError:
            logger.warning(
                "user_activity_log missing; skip log action=%s user_id=%s",
                action,
                user_id,
            )

    async def _validate_and_process_image(self, file_data: bytes, filename: str) -> dict[str, Any]:
        """
        Validate and process image
        1. Validate format (JPEG, PNG, WEBP)
        2. Validate dimensions
        3. Resize if needed
        4. Generate thumbnails (256x256, 64x64)
        5. Optimize file size
        """
        try:
            # Open image
            image: Image.Image = Image.open(BytesIO(file_data))

            # Validate format
            if not image.format:
                msg = "Image format could not be determined"
                raise ValueError(msg)
            mime_type = f"image/{image.format.lower()}"
            if mime_type not in self.ALLOWED_IMAGE_FORMATS:
                msg = "Unsupported format. Allowed: JPEG, PNG, WEBP"
                raise ValueError(msg)

            # Validate dimensions
            width, height = image.size
            if width > self.MAX_IMAGE_DIMENSION or height > self.MAX_IMAGE_DIMENSION:
                # Resize to max dimension while preserving aspect ratio
                image.thumbnail((self.MAX_IMAGE_DIMENSION, self.MAX_IMAGE_DIMENSION), Image.Resampling.LANCZOS)

            # Convert to RGB if needed (for JPEG)
            if image.mode in ("RGBA", "LA", "P"):
                # Create white background
                background = Image.new("RGB", image.size, (255, 255, 255))
                if image.mode == "P":
                    converted_image: Image.Image = image.convert("RGBA")
                    background.paste(
                        converted_image,
                        mask=converted_image.split()[-1] if converted_image.mode == "RGBA" else None,
                    )
                else:
                    background.paste(image, mask=image.split()[-1] if image.mode == "RGBA" else None)
                image = background

            # Save optimized original
            output = BytesIO()
            image.save(output, format="JPEG", quality=85, optimize=True)
            original_bytes = output.getvalue()

            # Generate thumbnails
            thumbnails = {}
            for size_name, dimensions in self.THUMBNAIL_SIZES.items():
                thumb = image.copy()
                thumb.thumbnail(dimensions, Image.Resampling.LANCZOS)

                thumb_output = BytesIO()
                thumb.save(thumb_output, format="JPEG", quality=85, optimize=True)
                thumbnails[size_name] = thumb_output.getvalue()

            return {
                "original": original_bytes,
                "thumbnails": thumbnails,
                "mime_type": "image/jpeg",  # Always save as JPEG
            }

        except (OSError, ValueError) as e:
            logger.exception("Image processing failed")
            msg = f"Invalid image file: {e!s}"
            raise ValueError(msg) from e
