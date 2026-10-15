# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Desktop AI Chat parent facade: mounts child routers under ``/desktop/ai-chat``; re-exports for tests.
# Invariants:
# - Parent keeps ``APIRouter(prefix="/desktop/ai-chat", tags=["Desktop - AI Chat"])``.
# - Children mount without extra prefix; public URLs stay ``/api/v1/desktop/ai-chat/...``.
# - Mount order: static paths before parameterized (config → memory → tariffs → me → invites →
#   discussion → chats → messages → stream → attachments → solo per-chat → collab per-chat).
# - POST …/stream session invariant lives in ``desktop_ai_chat_stream_routes`` (prep session only).
# Related:
# - api/domains/desktop.py
# - documentation/platform/ATOMIC-ROUTER-DECOMPOSITION-CANON.md
# - documentation/product/desktop/DESKTOP-AI-CHAT-ROUTER-SPLIT-2026-08-06.md
# ---
"""Desktop AI Chat aggregator — mounts domain child routers under /desktop/ai-chat."""

from fastapi import APIRouter

router = APIRouter(prefix="/desktop/ai-chat", tags=["Desktop - AI Chat"])

from api.routers import desktop_ai_chat_attachments_routes as _attachments
from api.routers import desktop_ai_chat_chats_routes as _chats
from api.routers import desktop_ai_chat_collaboration_routes as _collab
from api.routers import desktop_ai_chat_config_routes as _config
from api.routers import desktop_ai_chat_discussion_routes as _discussion
from api.routers import desktop_ai_chat_memory_routes as _memory
from api.routers import desktop_ai_chat_messages_routes as _messages
from api.routers import desktop_ai_chat_solo_slot_routes as _solo
from api.routers import desktop_ai_chat_stream_routes as _stream

# Mount order: static before parameterized (canon + dual-flag matrix).
router.include_router(_config.router)
router.include_router(_memory.router)
router.include_router(_solo.router)
router.include_router(_messages.me_router)
router.include_router(_collab.router)
router.include_router(_discussion.router)
router.include_router(_chats.router)
router.include_router(_messages.router)
router.include_router(_stream.router)
router.include_router(_attachments.router)
router.include_router(_solo.per_chat_router)
router.include_router(_collab.per_chat_router)

# ruff: noqa: I001 — intentional late re-exports after child router mounts
from api.routers.desktop_ai_chat_shared import (  # noqa: E402, F401
    _desktop_ai_chat_invite_notification_id,
    _dismiss_desktop_ai_chat_invite_notification,
    _merge_patched_chat_settings,
    _notify_desktop_ai_chat_invite,
)

__all__ = [
    "_desktop_ai_chat_invite_notification_id",
    "_dismiss_desktop_ai_chat_invite_notification",
    "_merge_patched_chat_settings",
    "_notify_desktop_ai_chat_invite",
    "router",
]
