# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock: GAF event failure log must not use structlog kwarg ``event=`` (clashes with event name).
# Invariants:
# - warning call uses ``call_event=`` for the video-call event label.
# Related:
# - api/video_calls/service.py _append_gaf_call_event
# ---

"""Regression: video_call_gaf_event_failed must not raise TypeError on log."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from api.video_calls.service import VideoCallService


@pytest.mark.asyncio
async def test_append_gaf_call_event_logs_without_event_kwarg_clash() -> None:
    service = VideoCallService(db_pool=MagicMock())
    call_id = str(uuid4())
    chat_id = str(uuid4())
    actor = str(uuid4())

    with (
        patch(
            "api.video_calls.service.GafChatService",
            return_value=MagicMock(
                send_video_call_event_message=AsyncMock(side_effect=RuntimeError("Not a participant"))
            ),
        ),
        patch("api.video_calls.service.logger") as mock_logger,
    ):
        await service._append_gaf_call_event(
            chat_id=chat_id,
            actor_user_id=actor,
            call_id=call_id,
            event="accepted",
            status="active",
        )
        mock_logger.warning.assert_called_once()
        _args, kwargs = mock_logger.warning.call_args
        assert "event" not in kwargs
        assert kwargs.get("call_event") == "accepted"
        assert kwargs.get("call_id") == call_id
