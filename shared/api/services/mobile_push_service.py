#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Send FCM data pushes to Android when the mobile app is not actively receiving realtime in-app.
# Invariants:
# - Never log raw FCM device tokens; no-op when FCM credentials are not configured.
# - Push is skipped only when foreground and mobile heartbeat are both fresh (avoids ghost online).
# - Permanent FCM failures (UNREGISTERED / NOT_FOUND) prune the token row.
# Related:
# - api.routers.socketio_handler, user_mobile_push_tokens, MobileFirebaseMessagingService.kt
# ---

from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Any
from uuid import UUID

import httpx

from api.core.database_manager import get_asyncpg_pool
from api.core.unified_config import unified_settings
from api.services.mobile_app_realtime_state_service import user_has_mobile_app_foreground_fresh
from api.services.presence_service import (
    get_active_sid_details_for_presence_user,
    is_browser_presence_session,
    mobile_socket_heartbeat_fresh,
)

logger = logging.getLogger(__name__)

_FCM_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token"
_FCM_OAUTH_SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
_FCM_V1_SEND_URL_TEMPLATE = "https://fcm.googleapis.com/v1/projects/{project_id}/messages:send"
_FCM_LEGACY_SEND_URL = "https://fcm.googleapis.com/fcm/send"

_OAUTH_TOKEN_CACHE: dict[str, Any] = {"access_token": None, "expires_at": 0.0}

_MOBILE_REALTIME_FOREGROUND_FRESH_SEC = 60
_MOBILE_REALTIME_HEARTBEAT_FRESH_SEC = 90

_GAF_EVENT_SYNC_SCOPE: dict[str, str] = {
    "gaf_chat.message_new": "chat",
    "gaf_chat.message_edited": "chat",
    "gaf_chat.message_deleted": "chat",
    "gaf_chat.chat_created": "chat",
}


def _load_service_account_info() -> dict[str, Any] | None:
    """Parse Firebase service account JSON from env path or inline JSON string."""

    raw = (unified_settings.mobile_fcm_service_account_json or "").strip()
    if not raw:
        return None
    try:
        if raw.startswith("{"):
            payload = json.loads(raw)
        else:
            payload = json.loads(Path(raw).expanduser().read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):  # fmt: skip
        logger.warning("mobile_fcm: service account JSON unreadable", exc_info=True)
        return None
    if not isinstance(payload, dict):
        return None
    if not str(payload.get("project_id") or "").strip():
        return None
    if not str(payload.get("client_email") or "").strip() or not str(payload.get("private_key") or "").strip():
        return None
    return payload


def _fcm_configured() -> bool:
    if not unified_settings.mobile_fcm_enabled:
        return False
    if (unified_settings.mobile_fcm_server_key or "").strip():
        return True
    return _load_service_account_info() is not None


async def _list_android_tokens(user_id: str) -> list[str]:
    uid = str(user_id or "").strip()
    if not uid:
        return []
    try:
        UUID(uid)
    except ValueError:
        return []
    pool = await get_asyncpg_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT token
            FROM user_mobile_push_tokens
            WHERE user_id = $1::uuid AND platform = 'android' AND length(trim(token)) > 0
            ORDER BY updated_at DESC
            """,
            uid,
        )
    out: list[str] = []
    seen: set[str] = set()
    for row in rows:
        token = str(row["token"] or "").strip()
        if not token or token in seen:
            continue
        seen.add(token)
        out.append(token)
    return out


async def _delete_android_token(token: str) -> None:
    normalized = str(token or "").strip()
    if not normalized:
        return
    try:
        pool = await get_asyncpg_pool()
        async with pool.acquire() as conn:
            deleted = await conn.execute(
                """
                DELETE FROM user_mobile_push_tokens
                WHERE platform = 'android' AND token = $1
                """,
                normalized,
            )
        logger.info("mobile_fcm: pruned stale android token rows=%s", deleted)
    except Exception:
        logger.warning("mobile_fcm: stale token prune failed", exc_info=True)


def _fcm_v1_response_is_permanent_token_error(status_code: int, body_text: str) -> bool:
    """True when FCM HTTP v1 says the registration token must be dropped."""
    if status_code == 404:
        return True
    blob = (body_text or "").upper()
    if "UNREGISTERED" in blob or "NOT_FOUND" in blob:
        return status_code in {400, 403, 404}
    return False


async def user_has_live_mobile_socket(user_id: str) -> bool:
    """True when Redis presence shows at least one live non-browser Socket.IO session."""

    details = await get_active_sid_details_for_presence_user(str(user_id))
    return any(not is_browser_presence_session(detail) for detail in details)


async def mobile_user_receives_realtime_in_app(user_id: str) -> bool:
    """True when mobile Socket.IO heartbeat and foreground report are both fresh."""

    uid = str(user_id or "").strip()
    if not uid:
        return False
    return await user_has_mobile_app_foreground_fresh(
        uid,
        max_age_sec=_MOBILE_REALTIME_FOREGROUND_FRESH_SEC,
    ) and await mobile_socket_heartbeat_fresh(
        uid,
        max_age_sec=_MOBILE_REALTIME_HEARTBEAT_FRESH_SEC,
    )


async def _resolve_user_push_label(user_id: str) -> str:
    label, _avatar = await _resolve_user_push_profile(user_id)
    return label


async def _resolve_user_push_profile(user_id: str) -> tuple[str, str]:
    uid = str(user_id or "").strip()
    if not uid:
        return "EliteEW", ""
    try:
        UUID(uid)
    except ValueError:
        return "EliteEW", ""
    try:
        pool = await get_asyncpg_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT full_name, username, avatar_url
                FROM users
                WHERE id = $1::uuid
                """,
                uid,
            )
    except Exception:
        logger.debug("mobile_fcm: sender profile lookup failed user=%s", uid[:8], exc_info=True)
        return "EliteEW", ""
    if row is None:
        return "EliteEW", ""
    full_name = str(row["full_name"] or "").strip()
    username = str(row["username"] or "").strip()
    label = full_name[:120] if full_name else (username[:120] if username else "EliteEW")
    avatar_url = str(row["avatar_url"] or "").strip()
    return label, avatar_url


def _gaf_message_push_body(payload: dict[str, Any]) -> str:
    if str(payload.get("body_ciphertext") or "").strip():
        return "Новое сообщение"
    algorithm = str(payload.get("algorithm") or "").strip()
    if algorithm and algorithm.lower() not in {"none", "plain", "plaintext"}:
        return "Новое сообщение"
    body = str(payload.get("body") or "").strip()
    if body:
        return body[:200]
    if str(payload.get("attachment_content_id") or "").strip():
        return "Вложение"
    return "Новое сообщение"


async def _get_fcm_access_token(sa_info: dict[str, Any]) -> str | None:
    import jwt

    now = time.time()
    cached = _OAUTH_TOKEN_CACHE.get("access_token")
    expires_at = float(_OAUTH_TOKEN_CACHE.get("expires_at") or 0.0)
    if isinstance(cached, str) and cached and expires_at > now + 30:
        return cached

    issued_at = int(now)
    assertion = jwt.encode(
        {
            "iss": sa_info["client_email"],
            "sub": sa_info["client_email"],
            "aud": _FCM_OAUTH_TOKEN_URL,
            "iat": issued_at,
            "exp": issued_at + 3600,
            "scope": _FCM_OAUTH_SCOPE,
        },
        sa_info["private_key"],
        algorithm="RS256",
    )
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                _FCM_OAUTH_TOKEN_URL,
                data={
                    "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                    "assertion": assertion,
                },
            )
            response.raise_for_status()
            body = response.json()
    except httpx.HTTPError:
        logger.warning("mobile_fcm: OAuth token exchange failed", exc_info=True)
        return None
    token = str(body.get("access_token") or "").strip()
    if not token:
        return None
    ttl = int(body.get("expires_in") or 3600)
    _OAUTH_TOKEN_CACHE["access_token"] = token
    _OAUTH_TOKEN_CACHE["expires_at"] = now + max(60, ttl - 60)
    return token


async def _send_fcm_v1(
    token: str,
    data: dict[str, str],
    *,
    high_priority: bool,
    collapse_key: str | None = None,
) -> bool:
    sa_info = _load_service_account_info()
    if sa_info is None:
        return False
    project_id = (unified_settings.mobile_fcm_project_id or sa_info.get("project_id") or "").strip()
    if not project_id:
        return False
    access_token = await _get_fcm_access_token(sa_info)
    if not access_token:
        return False

    message: dict[str, Any] = {
        "token": token,
        "data": data,
    }
    if high_priority or collapse_key:
        android_block: dict[str, Any] = {}
        if high_priority:
            android_block["priority"] = "HIGH"
        if collapse_key:
            android_block["collapse_key"] = collapse_key[:64]
        message["android"] = android_block

    url = _FCM_V1_SEND_URL_TEMPLATE.format(project_id=project_id)
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json; charset=UTF-8",
                },
                json={"message": message},
            )
            if response.is_success:
                return True
            body_text = ""
            try:
                body_text = response.text or ""
            except Exception:
                # httpx may raise if the stream was already consumed; treat as empty body.
                body_text = ""
            if _fcm_v1_response_is_permanent_token_error(response.status_code, body_text):
                logger.info(
                    "mobile_fcm: permanent token error status=%s — pruning",
                    response.status_code,
                )
                await _delete_android_token(token)
                return False
            response.raise_for_status()
            return False
    except httpx.HTTPError:
        logger.warning("mobile_fcm: v1 send failed", exc_info=True)
        return False


async def _send_fcm_legacy(
    token: str,
    data: dict[str, str],
    *,
    high_priority: bool,
    collapse_key: str | None = None,
) -> bool:
    server_key = (unified_settings.mobile_fcm_server_key or "").strip()
    if not server_key:
        return False
    payload: dict[str, Any] = {
        "to": token,
        "data": data,
        "priority": "high" if high_priority else "normal",
    }
    if collapse_key:
        payload["collapse_key"] = collapse_key[:64]
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                _FCM_LEGACY_SEND_URL,
                headers={
                    "Authorization": f"key={server_key}",
                    "Content-Type": "application/json; charset=UTF-8",
                },
                json=payload,
            )
            response.raise_for_status()
            body = response.json()
            if isinstance(body, dict) and body.get("failure", 0):
                results = body.get("results")
                if isinstance(results, list):
                    permanent_errors = {"NotRegistered", "InvalidRegistration"}
                    if any(isinstance(item, dict) and item.get("error") in permanent_errors for item in results):
                        await _delete_android_token(token)
                logger.info("mobile_fcm: legacy send reported failure=%s", body.get("failure"))
                return False
            return True
    except httpx.HTTPError:
        logger.warning("mobile_fcm: legacy send failed", exc_info=True)
        return False


async def send_data_push_to_user(
    user_id: str,
    data: dict[str, str],
    *,
    high_priority: bool = False,
    collapse_key: str | None = None,
) -> int:
    """Deliver a data-only FCM message to all registered Android tokens for the user."""

    if not _fcm_configured():
        return 0
    normalized = {str(k): str(v) for k, v in data.items() if str(k).strip() and str(v).strip()}
    if not normalized:
        return 0

    tokens = await _list_android_tokens(user_id)
    if not tokens:
        logger.debug("mobile_fcm: no android tokens for user=%s", user_id)
        return 0

    sent = 0
    use_legacy = bool((unified_settings.mobile_fcm_server_key or "").strip()) and _load_service_account_info() is None
    for token in tokens:
        ok = (
            await _send_fcm_legacy(token, normalized, high_priority=high_priority, collapse_key=collapse_key)
            if use_legacy
            else await _send_fcm_v1(token, normalized, high_priority=high_priority, collapse_key=collapse_key)
        )
        if ok:
            sent += 1
    if sent:
        logger.info(
            "mobile_fcm: sent data push user=%s keys=%s count=%s",
            user_id,
            sorted(normalized.keys()),
            sent,
        )
    return sent


async def maybe_notify_mobile_after_gaf_emit(
    event_name: str,
    recipient_db_user_id: str,
    payload: dict[str, Any],
) -> None:
    """After Socket.IO emit, wake the Android app via FCM when mobile realtime is offline."""

    if not _fcm_configured():
        return
    if await mobile_user_receives_realtime_in_app(recipient_db_user_id):
        return

    if event_name == "video_call.incoming":
        call_id = str(payload.get("call_id") or "").strip()
        if not call_id:
            return
        caller_user_id = str(payload.get("caller_user_id") or "").strip()
        caller_label, caller_avatar_url = (
            await _resolve_user_push_profile(caller_user_id) if caller_user_id else ("Видеозвонок", "")
        )
        data = {
            "type": "video_call_incoming",
            "event": "video_call.incoming",
            "call_id": call_id,
            "source": "eliteew_api",
            "title": caller_label,
            "tab": "chat",
        }
        chat_id = str(payload.get("chat_id") or "").strip()
        if chat_id:
            data["chat_id"] = chat_id
        if caller_user_id:
            data["caller_user_id"] = caller_user_id
        if caller_avatar_url:
            data["caller_avatar_url"] = caller_avatar_url[:500]
        await send_data_push_to_user(recipient_db_user_id, data, high_priority=True)
        return

    sync_scope = _GAF_EVENT_SYNC_SCOPE.get(event_name)
    if not sync_scope:
        return
    data = {
        "sync": sync_scope,
        "source": "eliteew_api",
        "tab": "chat",
        "type": "gaf_chat_message",
        "event": event_name,
    }
    for key in ("chat_id", "message_id"):
        value = str(payload.get(key) or "").strip()
        if value:
            data[key] = value
    if event_name == "gaf_chat.message_new":
        metadata = payload.get("metadata")
        if isinstance(metadata, dict) and str(metadata.get("kind") or "").strip() == "video_call_event":
            return
        sender_id = str(payload.get("sender_id") or "").strip()
        if sender_id:
            data["title"] = await _resolve_user_push_label(sender_id)
        else:
            data["title"] = "Сообщение"
        data["body"] = _gaf_message_push_body(payload)
        chat_id = str(payload.get("chat_id") or "").strip()
        collapse_key = f"gaf_chat_{chat_id[:48]}" if chat_id else None
        await send_data_push_to_user(
            recipient_db_user_id,
            data,
            high_priority=True,
            collapse_key=collapse_key,
        )
        return
    await send_data_push_to_user(
        recipient_db_user_id,
        data,
        high_priority=False,
    )


def _mobile_notification_data(metadata: dict[str, Any]) -> dict[str, str]:
    allowed_keys = {
        "kind",
        "tab",
        "focus",
        "social_hub_section",
        "sync",
        "request_id",
        "from_user_id",
        "to_user_id",
        "friend_user_id",
        "inbox_item_id",
        "social_hub_item_id",
        "chat_id",
        "message_id",
    }
    data = {"source": "eliteew_api", "event": "notification.mobile_fallback"}
    for key in sorted(allowed_keys):
        value = metadata.get(key)
        if isinstance(value, (str, int, float, bool)):
            text = str(value).strip()
            if text:
                data[key] = text
    return data


async def maybe_notify_mobile_after_in_app_notification(
    recipient_db_user_id: str,
    metadata: dict[str, Any],
    *,
    high_priority: bool = False,
) -> None:
    """Wake Android when an in-app notification has mobile deeplink metadata and no live mobile socket."""

    if not _fcm_configured():
        return
    if await mobile_user_receives_realtime_in_app(recipient_db_user_id):
        return
    data = _mobile_notification_data(metadata)
    if "sync" not in data and "tab" not in data:
        return
    await send_data_push_to_user(recipient_db_user_id, data, high_priority=high_priority)


def reset_fcm_oauth_cache_for_tests() -> None:
    """Clear cached OAuth token (unit tests only)."""

    _OAUTH_TOKEN_CACHE["access_token"] = None
    _OAUTH_TOKEN_CACHE["expires_at"] = 0.0
