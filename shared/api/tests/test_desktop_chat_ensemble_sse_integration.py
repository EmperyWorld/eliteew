# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Integration-style SSE contract tests for ensemble routing matrix and stream lock abort.
# Invariants:
# - Semi confirm emits confirm + pending done before downstream engines run.
# - Stream lock wrapper releases idempotency when the generator aborts mid-flight.
# Related:
# - api/services/desktop_chat_ensemble/stream_turn.py
# - api/services/desktop_chat/stream_lock.py
# ---
"""Desktop AI Chat ensemble SSE integration tests."""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

pytest.importorskip("sqlalchemy")

from api.services.desktop_chat import stream_lock as stream_lock_mod
from api.services.desktop_chat.service import stream_chat_turn
from api.services.desktop_chat_ensemble import stream_turn as stream_turn_mod
from api.services.desktop_chat_ensemble.settings import (
    ENSEMBLE_DOC_CONFIRM_ACCEPTED,
    ENSEMBLE_DOC_CONFIRM_ASKED,
    ENSEMBLE_DOC_CONFIRM_DECLINED,
    ENSEMBLE_ROUTING_AUTO,
    ENSEMBLE_ROUTING_SEMI,
)
from api.tests.desktop_chat_sse_test_helpers import parse_sse_data_events, sse_event_names


async def _collect(gen: object) -> list[str]:
    assert hasattr(gen, "__aiter__")
    out: list[str] = []
    async for line in gen:  # type: ignore[assignment]
        out.append(line)
    return out


def test_forced_decline_legacy_sse_emits_token_done() -> None:
    async def _legacy(*args: object, **kwargs: object):
        yield 'data: {"event":"token","delta":"legacy"}\n\n'
        yield 'data: {"event":"done","ensemble":true}\n\n'

    async def _run() -> None:
        user_msg = SimpleNamespace(
            id=uuid4(),
            role="user",
            content="Сделай техплан",
            message_metadata={"ensemble_doc_confirm": ENSEMBLE_DOC_CONFIRM_DECLINED},
        )
        chat = SimpleNamespace(id=uuid4(), updated_at=None, settings={"desktop_chat_mode": "ensemble"})
        with patch.object(stream_turn_mod, "stream_legacy_freeform_turn", _legacy):
            lines = await _collect(
                stream_turn_mod._stream_ensemble_turn_impl(
                    AsyncMock(),
                    chat=chat,
                    user_id=uuid4(),
                    history=[user_msg],
                    user_text="Сделай техплан",
                    defaults={},
                    enriched_user_content="",
                    rag_context_summary={},
                    forced_ensemble_path="legacy",
                    rag_ctx={},
                    routing_mode=ENSEMBLE_ROUTING_SEMI,
                    model="model",
                )
            )
        events = parse_sse_data_events(lines)
        assert sse_event_names(events) == ["token", "done"]

    asyncio.run(_run())


def test_forced_accept_blueprint_sse_emits_token_done() -> None:
    async def _bp(*args: object, **kwargs: object):
        yield 'data: {"event":"token","delta":"bp"}\n\n'
        yield 'data: {"event":"done","ensemble":true,"pending_document_confirm":false}\n\n'

    async def _run() -> None:
        user_msg = SimpleNamespace(
            id=uuid4(),
            role="user",
            content="Сделай техплан",
            message_metadata={"ensemble_doc_confirm": ENSEMBLE_DOC_CONFIRM_ACCEPTED},
        )
        chat = SimpleNamespace(id=uuid4(), updated_at=None, settings={})
        with patch.object(stream_turn_mod, "stream_blueprint_turn", _bp):
            lines = await _collect(
                stream_turn_mod._stream_ensemble_turn_impl(
                    AsyncMock(),
                    chat=chat,
                    user_id=uuid4(),
                    history=[user_msg],
                    user_text="Сделай техплан",
                    defaults={},
                    enriched_user_content="",
                    rag_context_summary={},
                    forced_ensemble_path="blueprint",
                    rag_ctx={},
                    routing_mode=ENSEMBLE_ROUTING_SEMI,
                    model="model",
                )
            )
        events = parse_sse_data_events(lines)
        assert sse_event_names(events) == ["token", "done"]
        assert events[-1].get("pending_document_confirm") is False

    asyncio.run(_run())


def test_auto_legacy_sse_skips_confirm_events() -> None:
    async def _legacy(*args: object, **kwargs: object):
        yield 'data: {"event":"token","delta":"chat"}\n\n'
        yield 'data: {"event":"done","ensemble":true}\n\n'

    async def _run() -> None:
        chat = SimpleNamespace(id=uuid4(), updated_at=None, settings={})
        with (
            patch.object(stream_turn_mod, "stream_legacy_freeform_turn", _legacy),
            patch.object(
                stream_turn_mod,
                "resolve_auto_blueprint_vs_legacy",
                AsyncMock(return_value=(False, "heuristic_legacy")),
            ),
            patch.object(
                stream_turn_mod,
                "resolve_ensemble_engine",
                lambda *_args, **_kwargs: "blueprint",
            ),
        ):
            lines = await _collect(
                stream_turn_mod._stream_ensemble_turn_impl(
                    AsyncMock(),
                    chat=chat,
                    user_id=uuid4(),
                    history=[],
                    user_text="Привет, как дела?",
                    defaults={},
                    enriched_user_content="",
                    rag_context_summary={},
                    forced_ensemble_path=None,
                    rag_ctx={},
                    routing_mode=ENSEMBLE_ROUTING_AUTO,
                    model="model",
                )
            )
        events = parse_sse_data_events(lines)
        assert "ensemble_document_confirm" not in sse_event_names(events)
        assert sse_event_names(events) == ["token", "done"]

    asyncio.run(_run())


def test_semi_blueprint_detected_sse_confirm_then_pending_done() -> None:
    async def _should_not_run(*args: object, **kwargs: object):
        raise AssertionError("engine stream must not run before confirm")
        yield ""

    async def _run() -> None:
        user_msg = SimpleNamespace(
            id=uuid4(),
            role="user",
            content="Нужен единый техплан",
            message_metadata={},
        )
        chat = SimpleNamespace(id=uuid4(), updated_at=None, settings={})
        with (
            patch.object(stream_turn_mod, "stream_blueprint_turn", _should_not_run),
            patch.object(stream_turn_mod, "stream_legacy_freeform_turn", _should_not_run),
            patch.object(
                stream_turn_mod,
                "resolve_auto_blueprint_vs_legacy",
                AsyncMock(return_value=(True, "heuristic_blueprint")),
            ),
            patch.object(
                stream_turn_mod,
                "persist_message_metadata_isolated",
                AsyncMock(),
            ),
        ):
            lines = await _collect(
                stream_turn_mod._stream_ensemble_turn_impl(
                    AsyncMock(),
                    chat=chat,
                    user_id=uuid4(),
                    history=[user_msg],
                    user_text="Собери единый техплан",
                    defaults={},
                    enriched_user_content="",
                    rag_context_summary={},
                    forced_ensemble_path=None,
                    rag_ctx={},
                    routing_mode=ENSEMBLE_ROUTING_SEMI,
                    model="model",
                )
            )
        events = parse_sse_data_events(lines)
        assert sse_event_names(events) == ["ensemble_document_confirm", "done"]
        assert events[-1].get("pending_document_confirm") is True
        assert user_msg.message_metadata.get("ensemble_doc_confirm") == ENSEMBLE_DOC_CONFIRM_ASKED

    asyncio.run(_run())


def test_stream_lock_wrapper_releases_idempotency_on_abort() -> None:
    async def _failing_gen():
        yield 'data: {"event":"token","delta":"x"}\n\n'
        raise RuntimeError("client disconnected")

    async def _run() -> None:
        chat_id = uuid4()
        user_id = uuid4()
        client_request_id = uuid4()
        release_idem = AsyncMock()
        release_lock = AsyncMock()

        with (
            patch.object(stream_lock_mod, "release_idempotency", release_idem),
            patch.object(stream_lock_mod, "release_stream_lock", release_lock),
            patch.object(stream_lock_mod, "_refresh_stream_lock_loop", AsyncMock()),
        ):
            wrapped = stream_lock_mod.wrap_stream_with_lock_and_idem(
                _failing_gen(),
                chat_id=chat_id,
                user_id=user_id,
                client_request_id=client_request_id,
            )
            with pytest.raises(RuntimeError, match="client disconnected"):
                async for _chunk in wrapped:
                    pass

        release_idem.assert_awaited_once_with(user_id, client_request_id)
        release_lock.assert_awaited_once_with(chat_id)

    asyncio.run(_run())


def test_ensemble_stream_chat_turn_propagates_cancel_without_request_session() -> None:
    async def _aborting_ensemble(*args: object, **kwargs: object):
        yield 'data: {"event":"planning","detail":"orchestrator"}\n\n'
        raise asyncio.CancelledError

    async def _run() -> None:
        from contextlib import asynccontextmanager

        chat_id = uuid4()
        user_id = uuid4()
        chat = SimpleNamespace(
            id=chat_id,
            user_id=user_id,
            project_id=None,
            company_id=None,
            use_project_rag=False,
            system_prompt_override=None,
            settings={"desktop_chat_mode": "ensemble"},
            llama_model=None,
        )
        prep_db = AsyncMock()
        hist_result = MagicMock()
        hist_result.scalars.return_value.all.return_value = []
        prep_db.execute = AsyncMock(return_value=hist_result)
        prep_db.expunge = MagicMock()

        @asynccontextmanager
        async def _fake_session():
            yield prep_db

        with (
            patch(
                "api.services.desktop_chat.db_session.desktop_ai_chat_session",
                _fake_session,
            ),
            patch(
                "api.services.desktop_chat.service_stream.load_chat_for_user",
                AsyncMock(return_value=chat),
            ),
            patch(
                "api.services.desktop_chat.service_stream.verify_project_for_chat",
                AsyncMock(),
            ),
            patch(
                "api.services.desktop_chat.service_stream.build_rag_prefix",
                AsyncMock(return_value=("user text", {"chat_rag_chunks": 0})),
            ),
            patch(
                "api.services.desktop_chat.service_stream.persist_user_message_isolated",
                AsyncMock(),
            ),
            patch(
                "api.services.desktop_chat_ensemble.stream_turn.stream_ensemble_turn",
                _aborting_ensemble,
            ),
        ):
            gen = stream_chat_turn(
                AsyncMock(),
                chat_id=chat_id,
                user_id=user_id,
                user_text="Привет команда",
                defaults={"feature_enabled": True},
                use_tools_flag=False,
            )
            with pytest.raises(asyncio.CancelledError):
                async for _line in gen:
                    pass

        prep_db.rollback.assert_not_called()

    asyncio.run(_run())
