# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Layer E import-chain lock after Desktop AI Chat router atomization (Wave 3).
# Invariants:
# - Parent re-exports helpers for tests; children mount without extra prefix.
# Related:
# - api/routers/desktop_ai_chat.py
# - documentation/product/desktop/DESKTOP-AI-CHAT-ROUTER-SPLIT-2026-08-06.md
# ---

from __future__ import annotations

from fastapi import APIRouter

from api.routers import (
    desktop_ai_chat_attachments_routes,
    desktop_ai_chat_chats_routes,
    desktop_ai_chat_collaboration_routes,
    desktop_ai_chat_config_routes,
    desktop_ai_chat_memory_routes,
    desktop_ai_chat_messages_routes,
    desktop_ai_chat_solo_slot_routes,
    desktop_ai_chat_stream_routes,
)
from api.routers.desktop_ai_chat import (
    _desktop_ai_chat_invite_notification_id,
    _dismiss_desktop_ai_chat_invite_notification,
    _merge_patched_chat_settings,
    _notify_desktop_ai_chat_invite,
    router,
)


def test_parent_reexports_helpers() -> None:
    assert callable(_merge_patched_chat_settings)
    assert callable(_desktop_ai_chat_invite_notification_id)
    assert callable(_notify_desktop_ai_chat_invite)
    assert callable(_dismiss_desktop_ai_chat_invite_notification)
    assert isinstance(router, APIRouter)
    assert router.prefix == "/desktop/ai-chat"


def test_child_routers_have_routes_without_extra_prefix() -> None:
    children: list[APIRouter] = [
        desktop_ai_chat_config_routes.router,
        desktop_ai_chat_memory_routes.router,
        desktop_ai_chat_solo_slot_routes.router,
        desktop_ai_chat_solo_slot_routes.per_chat_router,
        desktop_ai_chat_messages_routes.me_router,
        desktop_ai_chat_messages_routes.router,
        desktop_ai_chat_collaboration_routes.router,
        desktop_ai_chat_collaboration_routes.per_chat_router,
        desktop_ai_chat_chats_routes.router,
        desktop_ai_chat_stream_routes.router,
        desktop_ai_chat_attachments_routes.router,
    ]
    for child in children:
        assert isinstance(child, APIRouter)
        assert not child.prefix, f"child must not set prefix, got {child.prefix!r}"
        assert len(child.routes) > 0


def test_parent_includes_child_routes() -> None:
    path_methods = {
        (getattr(r, "path", ""), tuple(sorted(getattr(r, "methods", set()) or set()))) for r in router.routes
    }
    # After include_router, parent route paths include the parent prefix.
    pfx = "/desktop/ai-chat"
    expected = {
        (f"{pfx}/effective-settings", ("GET",)),
        (f"{pfx}/memory-cells", ("GET",)),
        (f"{pfx}/solo-slot-tariffs", ("GET",)),
        (f"{pfx}/me", ("GET",)),
        (f"{pfx}/invites/pending", ("GET",)),
        (f"{pfx}/chats", ("GET",)),
        (f"{pfx}/chats/{{chat_id}}/stream", ("POST",)),
        (f"{pfx}/chats/{{chat_id}}/attachments", ("GET",)),
        (f"{pfx}/chats/{{chat_id}}/solo-slot", ("POST",)),
        (f"{pfx}/chats/{{chat_id}}/members", ("GET",)),
    }
    for item in expected:
        assert item in path_methods, f"missing mounted route {item}"
