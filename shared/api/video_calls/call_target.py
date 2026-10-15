#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Resolve users.preferences.video_calls.call_target for incoming video-call routing.
# Invariants:
# - Default is both (legacy fan-out to desktop Socket.IO + mobile FCM).
# - desktop_only / mobile_only must filter Socket.IO SIDs by presence client_class (not room-wide emit).
# - desktop_only includes Tauri shells (empery-desktop / empery-fofline), not only empery-web browser.
# - Never log preference values with PII; user_id only in structured logs.
# Related:
# - api.schemas.user_profile.VideoCallsPreferences, emit_video_call_incoming, INTERNAL-VIDEO-CALLS.md
# ---

from __future__ import annotations

import json
import logging
from typing import Any, Literal
from uuid import UUID

logger = logging.getLogger(__name__)

CallTarget = Literal["both", "desktop_only", "mobile_only"]
CALL_TARGETS: frozenset[str] = frozenset({"both", "desktop_only", "mobile_only"})
DEFAULT_CALL_TARGET: CallTarget = "both"


def normalize_call_target(raw: Any) -> CallTarget:
    value = str(raw or "").strip().lower()
    if value in CALL_TARGETS:
        return value  # type: ignore[return-value]
    return DEFAULT_CALL_TARGET


def call_target_from_preferences_blob(prefs: Any) -> CallTarget:
    """Extract call_target from a users.preferences dict/JSON."""
    if isinstance(prefs, str):
        try:
            prefs = json.loads(prefs) if prefs else {}
        except json.JSONDecodeError:
            return DEFAULT_CALL_TARGET
    if not isinstance(prefs, dict):
        return DEFAULT_CALL_TARGET
    video_calls = prefs.get("video_calls")
    if not isinstance(video_calls, dict):
        return DEFAULT_CALL_TARGET
    return normalize_call_target(video_calls.get("call_target"))


async def get_user_call_target(user_id: str) -> CallTarget:
    """Load call_target for a user; default both on any failure."""
    uid = str(user_id or "").strip()
    if not uid:
        return DEFAULT_CALL_TARGET
    try:
        UUID(uid)
    except ValueError:
        return DEFAULT_CALL_TARGET
    try:
        from api.core.database_manager import get_asyncpg_pool

        pool = await get_asyncpg_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow("SELECT preferences FROM users WHERE id = $1::uuid", uid)
        if not row:
            return DEFAULT_CALL_TARGET
        return call_target_from_preferences_blob(row["preferences"])
    except Exception:
        logger.debug("[STEP] call_target_load_skip user_id=%s", uid, exc_info=True)
        return DEFAULT_CALL_TARGET


def should_send_mobile_call_push(call_target: CallTarget) -> bool:
    return call_target in {"both", "mobile_only"}


def should_show_desktop_incoming_ui(call_target: CallTarget) -> bool:
    return call_target in {"both", "desktop_only"}


def missed_reason_for_unreachable(call_target: CallTarget) -> str:
    if call_target == "mobile_only":
        return "callee_mobile_unreachable"
    return "callee_unreachable"


def is_desktop_audience_presence_session(detail: dict[str, Any]) -> bool:
    """True for browser SPA and Tauri shells (desktop / fofline) — not native mobile GAF."""
    from api.services.presence_service import is_browser_presence_session

    if is_browser_presence_session(detail):
        return True
    cc = str(detail.get("client_class") or "").strip().lower()
    cid = str(detail.get("client_id") or "").strip().lower()
    if cc in {"desktop", "fofline"}:
        return True
    return cid in {"empery-desktop", "empery-fofline"}


def presence_detail_matches_call_target(detail: dict[str, Any], call_target: CallTarget) -> bool:
    """Whether a presence SID detail should receive video_call.incoming for this preference."""
    is_desktop = is_desktop_audience_presence_session(detail)
    if call_target == "desktop_only":
        return is_desktop
    if call_target == "mobile_only":
        return not is_desktop
    return True


async def list_socket_sids_for_call_target(user_id: str, call_target: CallTarget) -> list[str] | None:
    """
    SID fan-out for incoming call emit.

    Returns:
    - None → emit to full gaf_user_* room (call_target=both)
    - list (possibly empty) → emit only to those SIDs
    """
    if call_target == "both":
        return None
    uid = str(user_id or "").strip()
    if not uid:
        return []
    try:
        from api.services.presence_service import get_active_sid_details_for_presence_user

        details = await get_active_sid_details_for_presence_user(uid)
    except Exception:
        logger.debug("[STEP] call_target_sid_list_skip user_id=%s", uid, exc_info=True)
        return []
    out: list[str] = []
    for detail in details:
        sid = str(detail.get("sid") or "").strip()
        if not sid:
            continue
        if presence_detail_matches_call_target(detail, call_target):
            out.append(sid)
    return out


async def callee_has_call_target_socket(user_id: str, call_target: CallTarget) -> bool:
    """True when a live Socket.IO session matches the call_target audience."""
    if call_target == "both":
        from api.video_calls.delivery import gaf_user_room_has_socket_subscribers

        return gaf_user_room_has_socket_subscribers(user_id)
    sids = await list_socket_sids_for_call_target(user_id, call_target)
    return bool(sids)
