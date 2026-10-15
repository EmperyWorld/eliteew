#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for the GAF E2EE trusted-device send gate.
# Invariants:
# - E2EE messages must not send plaintext body to the server.
# - E2EE send requires both chat participants to have active trusted devices with GAF public keys.
# Related:
# - api.gaf_chat.service
# - documentation/product/mobile/MOBILE-TRUSTED-DEVICE-BINDING.md
# ---

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

import pytest

from api.gaf_chat.service import GAF_E2EE_GENERIC_PREVIEW, GafChatService

_CHAT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
_SENDER_ID = "11111111-1111-1111-1111-111111111111"
_RECIPIENT_ID = "22222222-2222-2222-2222-222222222222"


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
    def __init__(self, gaf_key_user_ids: set[str], *, e2ee_status: str = "active") -> None:
        self.gaf_key_user_ids = gaf_key_user_ids
        self.insert_args: tuple[object, ...] | None = None
        self.message_key_payload: str | None = None
        self.chat_row: dict[str, object] = {
            "id": UUID(_CHAT_ID),
            "user_id_1": UUID(_SENDER_ID),
            "user_id_2": UUID(_RECIPIENT_ID),
            "e2ee_status": e2ee_status,
            "e2ee_requested_by_user_id": None,
            "e2ee_user_1_consented_at": datetime.now(tz=UTC) if e2ee_status == "active" else None,
            "e2ee_user_2_consented_at": datetime.now(tz=UTC) if e2ee_status == "active" else None,
            "e2ee_activated_at": datetime.now(tz=UTC) if e2ee_status == "active" else None,
            "e2ee_declined_at": None,
            "e2ee_disabled_at": None,
            "e2ee_updated_at": datetime.now(tz=UTC) if e2ee_status != "off" else None,
        }

    async def fetch(self, query: str, *args: object) -> list[dict[str, object]]:
        if "FROM public.mobile_trusted_devices" in query:
            return [{"user_id": UUID(uid)} for uid in self.gaf_key_user_ids]
        raise AssertionError(f"unexpected fetch query: {query}")

    async def fetchrow(self, query: str, *args: object) -> dict[str, object] | None:
        if "FROM gaf_chats" in query and "FOR UPDATE" in query:
            return dict(self.chat_row)
        if "INSERT INTO gaf_messages" in query:
            self.insert_args = args
            return {"id": args[0], "created_at": datetime.now(tz=UTC)}
        if "FROM gaf_message_keys" in query:
            return {"encrypted_key_payload": self.message_key_payload} if self.message_key_payload else None
        raise AssertionError(f"unexpected fetchrow query: {query}")

    async def execute(self, query: str, *args: object) -> str:
        if "e2ee_status = 'pending'" in query:
            self.chat_row["e2ee_status"] = "pending"
            self.chat_row["e2ee_requested_by_user_id"] = args[1]
            if "e2ee_user_1_consented_at = NOW()" in query:
                self.chat_row["e2ee_user_1_consented_at"] = datetime.now(tz=UTC)
                self.chat_row["e2ee_user_2_consented_at"] = None
            else:
                self.chat_row["e2ee_user_2_consented_at"] = datetime.now(tz=UTC)
                self.chat_row["e2ee_user_1_consented_at"] = None
            self.chat_row["e2ee_activated_at"] = None
            return "UPDATE 1"
        if "SET e2ee_user_1_consented_at = NOW()" in query:
            self.chat_row["e2ee_user_1_consented_at"] = datetime.now(tz=UTC)
            return "UPDATE 1"
        if "SET e2ee_user_2_consented_at = NOW()" in query:
            self.chat_row["e2ee_user_2_consented_at"] = datetime.now(tz=UTC)
            return "UPDATE 1"
        if "e2ee_status = 'active'" in query:
            self.chat_row["e2ee_status"] = "active"
            self.chat_row["e2ee_activated_at"] = datetime.now(tz=UTC)
            return "UPDATE 1"
        if "e2ee_status = 'declined'" in query:
            self.chat_row["e2ee_status"] = "declined"
            self.chat_row["e2ee_declined_at"] = datetime.now(tz=UTC)
            return "UPDATE 1"
        if "e2ee_status = 'off'" in query:
            self.chat_row["e2ee_status"] = "off"
            self.chat_row["e2ee_requested_by_user_id"] = None
            self.chat_row["e2ee_user_1_consented_at"] = None
            self.chat_row["e2ee_user_2_consented_at"] = None
            self.chat_row["e2ee_activated_at"] = None
            self.chat_row["e2ee_disabled_at"] = datetime.now(tz=UTC)
            return "UPDATE 1"
        if "UPDATE gaf_chats" in query:
            return "UPDATE 1"
        if "INSERT INTO gaf_message_keys" in query:
            self.message_key_payload = str(args[3])
            return "INSERT 0 1"
        raise AssertionError(f"unexpected execute query: {query}")


class _FakeKeyDiscoveryConn:
    def __init__(self, *, trusted_key: dict[str, object] | None, legacy_key: dict[str, object] | None) -> None:
        self.trusted_key = trusted_key
        self.legacy_key = legacy_key
        self.queries: list[str] = []

    async def fetchrow(self, query: str, *args: object) -> dict[str, object] | None:
        self.queries.append(query)
        if "FROM gaf_user_public_keys" in query and "rsa_oaep_sha256" in query:
            if self.legacy_key and self.legacy_key.get("algorithm") == "rsa_oaep_sha256":
                return self.legacy_key
            return None
        if "FROM public.mobile_trusted_devices" in query:
            return self.trusted_key
        if "FROM gaf_user_public_keys" in query:
            return self.legacy_key
        raise AssertionError(f"unexpected fetchrow query: {query}")


class _ServiceForE2ETest(GafChatService):
    attachment_uuid = UUID("33333333-3333-3333-3333-333333333333")

    async def get_chat_or_403(self, chat_id: str, current_user_id: str) -> dict:
        conn = self.db_pool.conn  # type: ignore[attr-defined]
        return {
            "id": chat_id,
            "user_id_1": _SENDER_ID,
            "user_id_2": _RECIPIENT_ID,
            **conn.chat_row,
        }

    async def _assert_chat_interaction_allowed(
        self,
        current_user_id: str,
        other_user_id: str,
        *,
        action_label: str,
    ) -> None:
        return None

    async def _load_sender_attachment_meta(
        self,
        sender_id: str,
        attachment_content_id: str,
    ) -> tuple[UUID, str, str, int]:
        return (self.attachment_uuid, "photo.png", "image/png", 1024)

    async def _share_gaf_attachment_with_recipient(
        self,
        att_uuid: UUID,
        sender_id: str,
        recipient_id: str,
    ) -> None:
        return None


@pytest.mark.anyio
async def test_e2ee_send_rejects_plaintext_body() -> None:
    service = _ServiceForE2ETest(_FakePool(_FakeConn({_SENDER_ID, _RECIPIENT_ID})))  # type: ignore[arg-type]

    with pytest.raises(ValueError, match="Plaintext body is not allowed"):
        await service.send_message(
            _CHAT_ID,
            _SENDER_ID,
            "secret plaintext",
            e2e_ciphertext="ciphertext",
            e2e_nonce="QUJD",
            e2e_algorithm="e2e_aes_gcm",
            e2e_encryption_version="e2e_v1",
        )


@pytest.mark.anyio
async def test_plain_chat_remains_default_before_e2ee_consent() -> None:
    conn = _FakeConn({_SENDER_ID, _RECIPIENT_ID}, e2ee_status="off")
    service = _ServiceForE2ETest(_FakePool(conn))  # type: ignore[arg-type]

    result = await service.send_message(_CHAT_ID, _SENDER_ID, "ordinary hello")

    assert result["body"] == "ordinary hello"
    assert conn.insert_args is not None
    assert conn.insert_args[4] == "ordinary hello"


@pytest.mark.anyio
async def test_e2ee_send_requires_mutual_consent_state() -> None:
    service = _ServiceForE2ETest(
        _FakePool(_FakeConn({_SENDER_ID, _RECIPIENT_ID}, e2ee_status="pending"))  # type: ignore[arg-type]
    )

    with pytest.raises(ValueError, match="E2EE is not active"):
        await service.send_message(
            _CHAT_ID,
            _SENDER_ID,
            None,
            e2e_ciphertext="ciphertext",
            e2e_nonce="QUJD",
            e2e_algorithm="e2e_aes_gcm",
            e2e_encryption_version="e2e_v1",
        )


@pytest.mark.anyio
async def test_e2ee_send_auto_suspends_when_trusted_gaf_keys_missing() -> None:
    conn = _FakeConn({_SENDER_ID})
    service = _ServiceForE2ETest(_FakePool(conn))  # type: ignore[arg-type]

    with pytest.raises(ValueError, match="Send again as a normal message"):
        await service.send_message(
            _CHAT_ID,
            _SENDER_ID,
            None,
            e2e_ciphertext="ciphertext",
            e2e_nonce="QUJD",
            e2e_algorithm="e2e_aes_gcm",
            e2e_encryption_version="e2e_v1",
        )

    assert conn.chat_row["e2ee_status"] == "off"


@pytest.mark.anyio
async def test_plain_send_auto_suspends_e2ee_when_trusted_device_gate_lost() -> None:
    conn = _FakeConn({_SENDER_ID})
    service = _ServiceForE2ETest(_FakePool(conn))  # type: ignore[arg-type]

    result = await service.send_message(_CHAT_ID, _SENDER_ID, "hello after unbind")

    assert result["body"] == "hello after unbind"
    assert conn.chat_row["e2ee_status"] == "off"
    assert conn.insert_args is not None
    assert conn.insert_args[4] == "hello after unbind"


@pytest.mark.anyio
async def test_e2ee_proposal_fails_when_partner_lacks_gaf_key() -> None:
    conn = _FakeConn({_SENDER_ID}, e2ee_status="off")
    service = _ServiceForE2ETest(_FakePool(conn))  # type: ignore[arg-type]

    with pytest.raises(ValueError, match="active trusted devices with GAF keys"):
        await service.propose_e2ee(_CHAT_ID, _SENDER_ID)

    assert conn.chat_row["e2ee_status"] == "off"


@pytest.mark.anyio
async def test_e2ee_send_stores_generic_preview_ciphertext_and_session_envelope() -> None:
    conn = _FakeConn({_SENDER_ID, _RECIPIENT_ID})
    service = _ServiceForE2ETest(_FakePool(conn))  # type: ignore[arg-type]

    result = await service.send_message(
        _CHAT_ID,
        _SENDER_ID,
        None,
        e2e_ciphertext="ciphertext",
        e2e_nonce="QUJD",
        e2e_algorithm="e2e_aes_gcm",
        e2e_encryption_version="e2e_v1",
        e2e_session_key_for_recipient="wrapped-session-key",
    )

    assert result["body"] == "[encrypted]"
    assert result["body_ciphertext"] == "ciphertext"
    assert conn.insert_args is not None
    assert conn.insert_args[4] == GAF_E2EE_GENERIC_PREVIEW
    assert conn.insert_args[3] == "ciphertext"
    assert conn.message_key_payload == "wrapped-session-key"


@pytest.mark.anyio
async def test_e2ee_send_allows_attachment_with_ciphertext() -> None:
    conn = _FakeConn({_SENDER_ID, _RECIPIENT_ID})
    service = _ServiceForE2ETest(_FakePool(conn))  # type: ignore[arg-type]

    result = await service.send_message(
        _CHAT_ID,
        _SENDER_ID,
        None,
        e2e_ciphertext="ciphertext",
        e2e_nonce="QUJD",
        e2e_algorithm="e2e_aes_gcm",
        e2e_encryption_version="e2e_v1",
        attachment_content_id=str(service.attachment_uuid),
    )

    assert result["attachment_content_id"] == str(service.attachment_uuid)
    assert result["attachment_name"] == "photo.png"
    assert result["attachment_mime_type"] == "image/png"
    assert result["body_ciphertext"] == "ciphertext"


@pytest.mark.anyio
async def test_mutual_acceptance_enables_e2ee_and_disable_returns_to_plain() -> None:
    conn = _FakeConn({_SENDER_ID, _RECIPIENT_ID}, e2ee_status="off")
    service = _ServiceForE2ETest(_FakePool(conn))  # type: ignore[arg-type]

    proposed = await service.propose_e2ee(_CHAT_ID, _SENDER_ID)
    assert proposed["status"] == "pending"
    assert proposed["current_user_consented"] is True
    assert proposed["partner_consented"] is False

    accepted = await service.accept_e2ee(_CHAT_ID, _RECIPIENT_ID)
    assert accepted["status"] == "active"

    with pytest.raises(ValueError, match="Plain messages are disabled"):
        await service.send_message(_CHAT_ID, _SENDER_ID, "ordinary hello")

    disabled = await service.disable_e2ee(_CHAT_ID, _RECIPIENT_ID)
    assert disabled["status"] == "off"

    result = await service.send_message(_CHAT_ID, _SENDER_ID, "ordinary again")
    assert result["body"] == "ordinary again"


@pytest.mark.anyio
async def test_public_key_discovery_prefers_rsa_wire_key_over_trusted_device() -> None:
    now = datetime.now(tz=UTC)
    trusted_key = {
        "user_id": UUID(_RECIPIENT_ID),
        "public_key_pem": "trusted-device-gaf-public-key",
        "algorithm": "p256-ecdh",
        "created_at": now,
        "updated_at": now,
    }
    legacy_key = {
        "user_id": UUID(_RECIPIENT_ID),
        "public_key_pem": "legacy-web-rsa-key",
        "algorithm": "rsa_oaep_sha256",
        "created_at": now,
        "updated_at": now,
    }
    conn = _FakeKeyDiscoveryConn(trusted_key=trusted_key, legacy_key=legacy_key)
    service = GafChatService(_FakePool(conn))  # type: ignore[arg-type]

    result = await service.get_user_public_key(_RECIPIENT_ID)

    assert result == legacy_key
    assert any("rsa_oaep_sha256" in query for query in conn.queries)


@pytest.mark.anyio
async def test_public_key_discovery_falls_back_to_trusted_device_without_rsa_wire_key() -> None:
    now = datetime.now(tz=UTC)
    trusted_key = {
        "user_id": UUID(_RECIPIENT_ID),
        "public_key_pem": "trusted-device-gaf-public-key",
        "algorithm": "p256-ecdh",
        "created_at": now,
        "updated_at": now,
    }
    conn = _FakeKeyDiscoveryConn(trusted_key=trusted_key, legacy_key=None)
    service = GafChatService(_FakePool(conn))  # type: ignore[arg-type]

    result = await service.get_user_public_key(_RECIPIENT_ID)

    assert result == trusted_key
    assert any("FROM public.mobile_trusted_devices" in query for query in conn.queries)
