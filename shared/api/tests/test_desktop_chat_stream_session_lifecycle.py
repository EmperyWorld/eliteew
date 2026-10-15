# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Prove Desktop AI Chat stream Wave A: prep/stream session split and cancel without PendingRollbackError.
# Invariants:
# - Cancel mid-stream uses isolated assistant persist; request-scoped Depends(db) is not held across SSE.
# Related:
# - api/services/desktop_chat/service.py
# - api/core/database_manager.py
# ---
"""Session lifecycle: cancel mid-stream must not raise PendingRollbackError."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy.exc import PendingRollbackError


@pytest.mark.asyncio
async def test_solo_stream_cancel_uses_isolated_persist_not_pending_rollback() -> None:
    chat_id = uuid4()
    user_id = uuid4()
    chat = SimpleNamespace(
        id=chat_id,
        user_id=user_id,
        project_id=None,
        company_id=None,
        use_project_rag=False,
        system_prompt_override=None,
        settings={},
        llama_model=None,
    )
    prep_db = AsyncMock()
    hist_result = MagicMock()
    hist_result.scalars.return_value.all.return_value = []
    prep_db.execute = AsyncMock(return_value=hist_result)
    prep_db.expunge = MagicMock()
    isolated = AsyncMock(return_value=SimpleNamespace(id=uuid4()))

    @asynccontextmanager
    async def _fake_session():
        yield prep_db

    async def _token_then_cancel(*_a: object, **_k: object):
        full_text = _k.get("full_text")
        if isinstance(full_text, list):
            full_text.append("Hi")
        yield 'data: {"event":"token","delta":"Hi"}\n\n'
        raise asyncio.CancelledError

    from api.services.desktop_chat.service import stream_chat_turn

    llama_inst = MagicMock()
    llama_inst.__aenter__ = AsyncMock(return_value=llama_inst)
    llama_inst.__aexit__ = AsyncMock(return_value=False)

    with (
        patch("api.services.desktop_chat.db_session.desktop_ai_chat_session", _fake_session),
        patch(
            "api.services.desktop_chat.service_stream.load_chat_for_user",
            AsyncMock(return_value=chat),
        ),
        patch("api.services.desktop_chat.service_stream.verify_project_for_chat", AsyncMock()),
        patch(
            "api.services.desktop_chat.service_stream.build_rag_prefix",
            AsyncMock(return_value=("", {"chat_rag_chunks": 0, "project_vault_chunks": 0})),
        ),
        patch(
            "api.services.desktop_chat.service_stream._maybe_temporal_short_circuit_reply",
            return_value=None,
        ),
        patch("api.services.desktop_chat.service_stream.persist_user_message_isolated", AsyncMock()),
        patch("api.services.desktop_chat.service_stream.persist_assistant_message_isolated", isolated),
        patch(
            "api.services.desktop_chat.service_stream._stream_desktop_chat_llm_tokens",
            _token_then_cancel,
        ),
        patch("api.services.desktop_chat.service_stream.LlamaService", return_value=llama_inst),
        patch(
            "api.services.desktop_chat.service_stream.desktop_tool_router_enabled",
            return_value=False,
        ),
    ):
        gen = stream_chat_turn(
            AsyncMock(),
            chat_id=chat_id,
            user_id=user_id,
            user_text="hello lifecycle cancel",
            defaults={"feature_enabled": True, "tools_web_search_enabled": False},
            use_tools_flag=False,
        )
        with pytest.raises(asyncio.CancelledError):
            async for _line in gen:
                pass

    isolated.assert_awaited()
    # Cancel must not attempt commit/rollback on the closed prep session.
    prep_db.commit.assert_not_called()
    prep_db.rollback.assert_not_called()


@pytest.mark.asyncio
async def test_get_postgres_session_cancel_on_commit_rolls_back_quietly() -> None:
    """Defense-in-depth: CancelledError during commit must not surface PendingRollbackError."""
    from api.core.database_manager import DatabaseManager

    mgr = DatabaseManager()
    session = AsyncMock()
    session.commit = AsyncMock(side_effect=asyncio.CancelledError())
    session.rollback = AsyncMock()
    session.execute = AsyncMock()

    @asynccontextmanager
    async def _factory():
        yield session

    mgr.postgres_session_factory = _factory  # type: ignore[assignment]
    mgr.is_initialized = True

    with patch("api.core.database_manager.unified_settings") as settings:
        settings.encryption_enabled = False
        with pytest.raises(asyncio.CancelledError):
            async with mgr.get_postgres_session() as _s:
                pass

    session.rollback.assert_awaited()
    assert not isinstance(asyncio.CancelledError(), PendingRollbackError)
