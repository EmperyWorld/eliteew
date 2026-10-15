# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for GET `/gaf-chat/chats/lite` partner payload (system account flag).
# Invariants:
# - `ChatPartnerLite` accepts `is_system_account` for mobile system chat styling.
# - `_chat_row_to_lite` preserves E2EE consent fields for mobile send gate.
# Related:
# - gaf_chat/router.py `_chat_row_to_lite`, gaf_chat/schemas.py
# ---

from api.gaf_chat.router import _chat_row_to_lite
from api.gaf_chat.schemas import ChatListItemLite, ChatPartnerLite


def test_chat_partner_lite_accepts_system_account_and_avatar() -> None:
    partner = ChatPartnerLite.model_validate(
        {
            "id": "22222222-2222-2222-2222-222222222222",
            "username": "elite_system",
            "avatar_url": "https://cdn.example/avatar.png",
            "full_name": "Elite Система",
            "is_system_account": True,
            "is_muted": False,
            "is_blocked": False,
            "blocked_by_partner": False,
        }
    )
    assert partner.is_system_account is True
    assert partner.avatar_url == "https://cdn.example/avatar.png"


def test_chat_row_to_lite_preserves_e2ee_fields() -> None:
    row = {
        "chat_id": "11111111-1111-1111-1111-111111111111",
        "partner": {
            "id": "22222222-2222-2222-2222-222222222222",
            "username": "poet",
            "avatar_url": None,
            "full_name": "Poet",
            "is_system_account": False,
            "is_muted": False,
            "is_blocked": False,
            "blocked_by_partner": False,
        },
        "last_message_at": "2026-06-19T12:00:00+00:00",
        "last_message_preview": "hi",
        "unread_count": 0,
        "partner_last_read_message_id": None,
        "e2ee_status": "active",
        "e2ee_requested_by_user_id": "22222222-2222-2222-2222-222222222222",
        "e2ee_ready": True,
    }
    lite = ChatListItemLite.model_validate(_chat_row_to_lite(row))
    assert lite.e2ee_status == "active"
    assert lite.e2ee_requested_by_user_id == "22222222-2222-2222-2222-222222222222"
    assert lite.e2ee_ready is True
