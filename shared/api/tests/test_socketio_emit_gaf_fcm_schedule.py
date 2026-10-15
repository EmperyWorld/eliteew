#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Lock: GAF Socket.IO emit must not await FCM (HTTP send path stays fast).
# Related:
# - api.routers.socketio_emit_gaf
# ---

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from api.routers import socketio_emit_gaf as emit_gaf


@pytest.mark.unit
@pytest.mark.anyio
async def test_emit_gaf_message_new_schedules_fcm_without_awaiting() -> None:
    sio = MagicMock()
    sio.emit = AsyncMock()
    fcm_started = asyncio.Event()
    fcm_release = asyncio.Event()

    async def _slow_fcm(*_args: object, **_kwargs: object) -> None:
        fcm_started.set()
        await fcm_release.wait()

    def _track(coro: object, **_kwargs: object) -> str:
        asyncio.get_running_loop().create_task(coro)  # type: ignore[arg-type]
        return "task-test"

    with (
        patch.object(emit_gaf, "_sio", return_value=sio),
        patch(
            "api.services.mobile_push_service.maybe_notify_mobile_after_gaf_emit",
            new=_slow_fcm,
        ),
        patch(
            "api.core.async_utils.track_background_task",
            side_effect=_track,
        ),
    ):
        await emit_gaf.emit_gaf_message_new(
            "f1b654a6-56a7-4718-ae95-3c7534a3982e",
            {
                "chat_id": "220c6689-b274-4afb-ba99-00de05d8a108",
                "message_id": "8d263ee0-7a0a-4274-9786-29a0410cf4f2",
                "sender_id": "3b22cefa-8d9e-44f0-aec0-fa76b15bd4ef",
                "body": "ping",
            },
        )
        await asyncio.wait_for(fcm_started.wait(), timeout=1.0)
        sio.emit.assert_awaited()
        fcm_release.set()
        await asyncio.sleep(0)
