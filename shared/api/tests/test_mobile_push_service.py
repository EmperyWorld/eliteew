#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for mobile FCM fallback dispatch when Android Socket.IO is offline.
# Related:
# - api.services.mobile_push_service
# ---

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from api.services import mobile_push_service as mps


@pytest.fixture(autouse=True)
def reset_oauth_cache() -> None:
    mps.reset_fcm_oauth_cache_for_tests()


@pytest.mark.anyio
async def test_maybe_notify_skips_when_mobile_socket_online_and_foreground(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mps.unified_settings, "mobile_fcm_server_key", "legacy-key")
    monkeypatch.setattr(mps, "mobile_user_receives_realtime_in_app", AsyncMock(return_value=True))
    send = AsyncMock(return_value=1)
    monkeypatch.setattr(mps, "send_data_push_to_user", send)

    await mps.maybe_notify_mobile_after_gaf_emit(
        "gaf_chat.message_new",
        "11111111-1111-1111-1111-111111111111",
        {"message_id": "m1"},
    )

    send.assert_not_called()


@pytest.mark.anyio
async def test_maybe_notify_skips_video_call_event_chat_message(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mps.unified_settings, "mobile_fcm_server_key", "legacy-key")
    monkeypatch.setattr(mps, "mobile_user_receives_realtime_in_app", AsyncMock(return_value=False))
    send = AsyncMock(return_value=1)
    monkeypatch.setattr(mps, "send_data_push_to_user", send)

    await mps.maybe_notify_mobile_after_gaf_emit(
        "gaf_chat.message_new",
        "11111111-1111-1111-1111-111111111111",
        {
            "chat_id": "c1",
            "message_id": "m1",
            "sender_id": "22222222-2222-2222-2222-222222222222",
            "body": "Видеозвонок начат",
            "metadata": {"kind": "video_call_event", "event": "ringing", "call_id": "call-1"},
        },
    )

    send.assert_not_called()


@pytest.mark.anyio
async def test_maybe_notify_chat_when_mobile_background(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mps.unified_settings, "mobile_fcm_server_key", "legacy-key")
    monkeypatch.setattr(mps, "mobile_user_receives_realtime_in_app", AsyncMock(return_value=False))
    monkeypatch.setattr(mps, "_resolve_user_push_label", AsyncMock(return_value="Alice"))
    send = AsyncMock(return_value=1)
    monkeypatch.setattr(mps, "send_data_push_to_user", send)

    await mps.maybe_notify_mobile_after_gaf_emit(
        "gaf_chat.message_new",
        "11111111-1111-1111-1111-111111111111",
        {
            "message_id": "m1",
            "chat_id": "chat-1",
            "sender_id": "22222222-2222-2222-2222-222222222222",
            "body": "Привет",
        },
    )

    send.assert_awaited_once()
    args, kwargs = send.await_args
    assert args[0] == "11111111-1111-1111-1111-111111111111"
    assert args[1]["sync"] == "chat"
    assert args[1]["tab"] == "chat"
    assert args[1]["title"] == "Alice"
    assert args[1]["body"] == "Привет"
    assert kwargs["high_priority"] is True
    assert kwargs["collapse_key"] == "gaf_chat_chat-1"


@pytest.mark.anyio
async def test_maybe_notify_video_call_high_priority(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mps.unified_settings, "mobile_fcm_server_key", "legacy-key")
    monkeypatch.setattr(mps, "mobile_user_receives_realtime_in_app", AsyncMock(return_value=False))
    monkeypatch.setattr(mps, "_resolve_user_push_profile", AsyncMock(return_value=("Bob", "/media/avatars/bob.png")))
    send = AsyncMock(return_value=1)
    monkeypatch.setattr(mps, "send_data_push_to_user", send)

    await mps.maybe_notify_mobile_after_gaf_emit(
        "video_call.incoming",
        "22222222-2222-2222-2222-222222222222",
        {"call_id": "call-1", "chat_id": "chat-9", "caller_user_id": "33333333-3333-3333-3333-333333333333"},
    )

    send.assert_awaited_once()
    args, kwargs = send.await_args
    assert args[0] == "22222222-2222-2222-2222-222222222222"
    assert args[1]["type"] == "video_call_incoming"
    assert args[1]["call_id"] == "call-1"
    assert args[1]["chat_id"] == "chat-9"
    assert args[1]["title"] == "Bob"
    assert args[1]["caller_avatar_url"] == "/media/avatars/bob.png"
    assert kwargs["high_priority"] is True


@pytest.mark.anyio
async def test_send_data_push_legacy_success(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mps.unified_settings, "mobile_fcm_enabled", True)
    monkeypatch.setattr(mps.unified_settings, "mobile_fcm_server_key", "legacy-key")
    monkeypatch.setattr(mps.unified_settings, "mobile_fcm_service_account_json", None)
    monkeypatch.setattr(mps, "_list_android_tokens", AsyncMock(return_value=["tok-a"]))

    response = MagicMock()
    response.raise_for_status = MagicMock()
    response.json.return_value = {"success": 1, "failure": 0}

    async def _fake_post(*_args, **_kwargs) -> MagicMock:
        return response

    client = MagicMock()
    client.post = AsyncMock(side_effect=_fake_post)
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)

    with patch("api.services.mobile_push_service.httpx.AsyncClient", return_value=client):
        sent = await mps.send_data_push_to_user("11111111-1111-1111-1111-111111111111", {"sync": "chat"})

    assert sent == 1


@pytest.mark.anyio
async def test_maybe_notify_in_app_notification_uses_mobile_metadata(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mps.unified_settings, "mobile_fcm_server_key", "legacy-key")
    monkeypatch.setattr(mps, "mobile_user_receives_realtime_in_app", AsyncMock(return_value=False))
    send = AsyncMock(return_value=1)
    monkeypatch.setattr(mps, "send_data_push_to_user", send)

    await mps.maybe_notify_mobile_after_in_app_notification(
        "33333333-3333-3333-3333-333333333333",
        {
            "kind": "friend_request_received",
            "tab": "inbox",
            "focus": "incoming",
            "sync": "friends",
            "request_id": "req-1",
            "open_app": {"appComponent": "SocialHubApp"},
        },
        high_priority=True,
    )

    send.assert_awaited_once_with(
        "33333333-3333-3333-3333-333333333333",
        {
            "source": "eliteew_api",
            "event": "notification.mobile_fallback",
            "focus": "incoming",
            "kind": "friend_request_received",
            "request_id": "req-1",
            "sync": "friends",
            "tab": "inbox",
        },
        high_priority=True,
    )


@pytest.mark.anyio
async def test_maybe_notify_in_app_notification_skips_live_mobile(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mps.unified_settings, "mobile_fcm_server_key", "legacy-key")
    monkeypatch.setattr(mps, "mobile_user_receives_realtime_in_app", AsyncMock(return_value=True))
    send = AsyncMock(return_value=1)
    monkeypatch.setattr(mps, "send_data_push_to_user", send)

    await mps.maybe_notify_mobile_after_in_app_notification(
        "33333333-3333-3333-3333-333333333333",
        {"sync": "friends"},
    )

    send.assert_not_called()


@pytest.mark.anyio
async def test_send_data_push_prunes_v1_404(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mps.unified_settings, "mobile_fcm_enabled", True)
    monkeypatch.setattr(mps.unified_settings, "mobile_fcm_server_key", None)
    monkeypatch.setattr(mps.unified_settings, "mobile_fcm_project_id", "proj")
    monkeypatch.setattr(mps, "_load_service_account_info", MagicMock(return_value={"project_id": "proj"}))
    monkeypatch.setattr(mps, "_get_fcm_access_token", AsyncMock(return_value="access-token"))
    monkeypatch.setattr(mps, "_list_android_tokens", AsyncMock(return_value=["tok-stale"]))
    prune = AsyncMock()
    monkeypatch.setattr(mps, "_delete_android_token", prune)

    response = MagicMock()
    response.status_code = 404
    response.is_success = False
    response.text = '{"error":{"status":"NOT_FOUND"}}'
    response.raise_for_status = MagicMock()

    client = MagicMock()
    client.post = AsyncMock(return_value=response)
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)

    with patch("api.services.mobile_push_service.httpx.AsyncClient", return_value=client):
        sent = await mps.send_data_push_to_user("11111111-1111-1111-1111-111111111111", {"sync": "friends"})

    assert sent == 0
    prune.assert_awaited_once_with("tok-stale")


@pytest.mark.anyio
async def test_send_data_push_prunes_v1_unregistered_400(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mps.unified_settings, "mobile_fcm_enabled", True)
    monkeypatch.setattr(mps.unified_settings, "mobile_fcm_server_key", None)
    monkeypatch.setattr(mps.unified_settings, "mobile_fcm_project_id", "proj")
    monkeypatch.setattr(mps, "_load_service_account_info", MagicMock(return_value={"project_id": "proj"}))
    monkeypatch.setattr(mps, "_get_fcm_access_token", AsyncMock(return_value="access-token"))
    monkeypatch.setattr(mps, "_list_android_tokens", AsyncMock(return_value=["tok-dead"]))
    prune = AsyncMock()
    monkeypatch.setattr(mps, "_delete_android_token", prune)

    response = MagicMock()
    response.status_code = 400
    response.is_success = False
    response.text = '{"error":{"details":[{"errorCode":"UNREGISTERED"}]}}'
    response.raise_for_status = MagicMock(side_effect=AssertionError("must prune before raise"))

    client = MagicMock()
    client.post = AsyncMock(return_value=response)
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)

    with patch("api.services.mobile_push_service.httpx.AsyncClient", return_value=client):
        sent = await mps.send_data_push_to_user("11111111-1111-1111-1111-111111111111", {"sync": "chat"})

    assert sent == 0
    prune.assert_awaited_once_with("tok-dead")


def test_fcm_v1_permanent_token_error_helper() -> None:
    assert mps._fcm_v1_response_is_permanent_token_error(404, "") is True
    assert mps._fcm_v1_response_is_permanent_token_error(400, "UNREGISTERED") is True
    assert mps._fcm_v1_response_is_permanent_token_error(500, "UNREGISTERED") is False
    assert mps._fcm_v1_response_is_permanent_token_error(403, "quota") is False


@pytest.mark.anyio
async def test_send_data_push_no_credentials_is_noop(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mps.unified_settings, "mobile_fcm_enabled", True)
    monkeypatch.setattr(mps.unified_settings, "mobile_fcm_server_key", None)
    monkeypatch.setattr(mps.unified_settings, "mobile_fcm_service_account_json", None)

    sent = await mps.send_data_push_to_user("11111111-1111-1111-1111-111111111111", {"sync": "light"})
    assert sent == 0


@pytest.mark.anyio
async def test_user_has_live_mobile_socket_uses_presence(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        mps,
        "get_active_sid_details_for_presence_user",
        AsyncMock(
            return_value=[
                {"client_class": "browser", "client_id": "empery-web"},
                {"client_class": "mobile", "client_id": "empery-mobile"},
            ]
        ),
    )
    assert await mps.user_has_live_mobile_socket("user-1") is True

    monkeypatch.setattr(
        mps,
        "get_active_sid_details_for_presence_user",
        AsyncMock(return_value=[{"client_class": "browser", "client_id": "empery-web"}]),
    )
    assert await mps.user_has_live_mobile_socket("user-1") is False
