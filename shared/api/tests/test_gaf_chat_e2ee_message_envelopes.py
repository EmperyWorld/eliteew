#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for per-message E2EE session key envelopes in list_messages.
# Invariants:
# - E2EE rows include e2ee_session_key_envelope for the current viewer when stored.
# Related:
# - api.gaf_chat.service
# - documentation/product/GAF-CHAT-BACKEND.md
# ---

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

import pytest

from api.gaf_chat.service import GafChatService

_CHAT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
_VIEWER_ID = "11111111-1111-1111-1111-111111111111"
_PARTNER_ID = "22222222-2222-2222-2222-222222222222"
_MSG_ID = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
_ENVELOPE = "per-message-envelope-b64"


class _FakeAcquire:
    def __init__(self, conn: _FakeConn) -> None:
        self.conn = conn

    async def __aenter__(self) -> _FakeConn:
        return self.conn

    async def __aexit__(self, *_args: object) -> None:
        return None


class _FakePool:
    def __init__(self, conn: _FakeConn) -> None:
        self.conn = conn

    def acquire(self) -> _FakeAcquire:
        return _FakeAcquire(self.conn)


class _FakeConn:
    def __init__(self) -> None:
        self.chat_row = {
            "id": UUID(_CHAT_ID),
            "user_id_1": UUID(_VIEWER_ID),
            "user_id_2": UUID(_PARTNER_ID),
            "e2ee_status": "active",
        }

    async def fetch(self, query: str, *args: object) -> list[dict[str, object]]:
        if "FROM gaf_messages" in query and "ORDER BY created_at DESC" in query:
            return [
                {
                    "id": _MSG_ID,
                    "chat_id": UUID(_CHAT_ID),
                    "sender_id": UUID(_PARTNER_ID),
                    "body_ciphertext": "cipher",
                    "nonce": b"\x01\x02\x03",
                    "algorithm": "e2e_aes_gcm",
                    "created_at": datetime.now(tz=UTC),
                    "edited_at": None,
                    "deleted_at": None,
                    "deleted_for_sender": False,
                    "deleted_for_recipient": False,
                    "encryption_version": "e2e_v1",
                    "attachment_content_id": None,
                    "attachment_mime_type": None,
                    "attachment_name": None,
                    "attachment_size": None,
                    "attachment_recipient_saved_id": None,
                    "metadata": None,
                    "reply_to_message_id": None,
                }
            ]
        if "FROM gaf_message_keys" in query and "message_id = ANY" in query:
            assert args[0] == UUID(_CHAT_ID)
            assert args[1] == UUID(_VIEWER_ID)
            return [{"message_id": str(_MSG_ID), "encrypted_key_payload": _ENVELOPE}]
        raise AssertionError(f"unexpected fetch query: {query}")


class _ServiceForListTest(GafChatService):
    async def get_chat_or_403(self, chat_id: str, current_user_id: str) -> dict:
        return {
            "id": chat_id,
            "user_id_1": _VIEWER_ID,
            "user_id_2": _PARTNER_ID,
            "e2ee_status": "active",
        }


@pytest.mark.anyio
async def test_list_messages_includes_per_message_e2ee_envelope() -> None:
    service = _ServiceForListTest(_FakePool(_FakeConn()))  # type: ignore[arg-type]

    rows = await service.list_messages(_CHAT_ID, _VIEWER_ID, limit=20)

    assert len(rows) == 1
    assert rows[0]["id"] == str(_MSG_ID)
    assert rows[0]["body"] == "[encrypted]"
    assert rows[0]["e2ee_session_key_envelope"] == _ENVELOPE
