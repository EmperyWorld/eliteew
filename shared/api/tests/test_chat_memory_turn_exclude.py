# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression: episodic turn memory must survive exclude_ids from inline chat history.
# Related:
# - api/services/chat_memory_service.py
# - api/services/desktop_chat/service.py
# ---

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest


def test_turn_memory_not_excluded_by_message_id() -> None:
    from api.services.chat_memory_service import (
        MEMORY_KIND_TURN,
        MEMORY_KIND_USER_INPUT,
        _memory_hit_excluded_by_message_id,
    )

    turn_payload = {"memory_kind": MEMORY_KIND_TURN, "message_id": "asst-1"}
    assert _memory_hit_excluded_by_message_id(turn_payload, {"asst-1"}) is False

    user_payload = {"memory_kind": MEMORY_KIND_USER_INPUT, "message_id": "user-1"}
    assert _memory_hit_excluded_by_message_id(user_payload, {"user-1"}) is True

    legacy_payload = {"message_id": "legacy-1"}
    assert _memory_hit_excluded_by_message_id(legacy_payload, {"legacy-1"}) is True


def test_prepare_turn_record_has_no_inline_message_id() -> None:
    from api.services.chat_memory_service import MEMORY_KIND_TURN, prepare_memory_record

    stored, extras = prepare_memory_record(
        user_text="What is the capital of France?",
        assistant_text="Paris is the capital of France.",
        chat_profile="desktop_ai_chat",
    )
    assert "Paris" in stored
    assert extras["memory_kind"] == MEMORY_KIND_TURN


@pytest.mark.asyncio
async def test_search_memory_keeps_turn_hits_when_exclude_ids_match(monkeypatch: pytest.MonkeyPatch) -> None:
    import api.services.chat_memory_service as cms

    turn_text = "User: hello\nAssistant: world"
    user_text = "inline duplicate"

    async def _fake_embedding(_text: str) -> list[float]:
        return [0.1] * cms._embedding_dim()

    mock_client = MagicMock()
    mock_client.query_points = AsyncMock(
        return_value=SimpleNamespace(
            points=[
                SimpleNamespace(
                    payload={
                        "text": turn_text,
                        "session_id": "chat-1",
                        "chat_profile": "desktop_ai_chat",
                        "memory_kind": cms.MEMORY_KIND_TURN,
                        "message_id": "asst-old",
                    }
                ),
                SimpleNamespace(
                    payload={
                        "text": user_text,
                        "session_id": "chat-1",
                        "chat_profile": "desktop_ai_chat",
                        "memory_kind": cms.MEMORY_KIND_USER_INPUT,
                        "message_id": "user-old",
                    }
                ),
            ]
        )
    )

    monkeypatch.setattr(cms, "_get_embedding", _fake_embedding)
    monkeypatch.setattr(cms, "_get_qdrant_client", AsyncMock(return_value=mock_client))
    monkeypatch.setattr(cms, "_ensure_collection", AsyncMock(return_value=True))

    hits = await cms.search_memory(
        "hello",
        session_id="chat-1",
        exclude_ids=["asst-old", "user-old"],
        chat_profile="desktop_ai_chat",
    )

    # search_memory returns `_normalize_memory_text` (whitespace collapsed).
    assert hits == [cms._normalize_memory_text(turn_text)]


@pytest.mark.asyncio
async def test_upsert_turn_uses_idempotency_key_not_message_id(monkeypatch: pytest.MonkeyPatch) -> None:
    import api.services.chat_memory_service as cms

    captured: dict[str, Any] = {}

    async def _fake_embedding(_text: str) -> list[float]:
        return [0.2] * cms._embedding_dim()

    mock_client = MagicMock()
    mock_client.upsert = AsyncMock()

    async def _capture_upsert(**kwargs: object) -> None:
        captured.update(kwargs)

    mock_client.upsert = AsyncMock(side_effect=_capture_upsert)

    monkeypatch.setattr(cms, "_get_embedding", _fake_embedding)
    monkeypatch.setattr(cms, "_get_qdrant_client", AsyncMock(return_value=mock_client))
    monkeypatch.setattr(cms, "_ensure_collection", AsyncMock(return_value=True))

    await cms.upsert_memory(
        "What is the capital of France and why is it historically important?",
        session_id="chat-99",
        assistant_text="Paris is the capital of France and has been the political center for centuries.",
        chat_profile="desktop_ai_chat",
        source_message_id="msg-42",
        idempotency_key="msg-42",
    )

    points = captured.get("points")
    assert points is not None
    point = points[0]
    assert point.payload.get("memory_kind") == cms.MEMORY_KIND_TURN
    assert "message_id" not in point.payload
    assert point.payload.get("source_message_id") == "msg-42"
