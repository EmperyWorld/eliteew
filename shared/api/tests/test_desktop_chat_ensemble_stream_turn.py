# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Cover critical ensemble routing branches in stream_turn: forced path, semi confirm, auto fallback.
# Invariants:
# - Semi mode emits `ensemble_document_confirm` before `done` when document confirmation is required.
# - Branch routing delegates to exactly one downstream stream generator.
# Related:
# - api/services/desktop_chat_ensemble/stream_turn.py
# ---
"""Unit tests for ensemble stream route branching."""

from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

pytest.importorskip("sqlalchemy")

from api.services.desktop_chat_ensemble import stream_turn as stream_turn_mod
from api.services.desktop_chat_ensemble.settings import (
    ENSEMBLE_DOC_CONFIRM_ACCEPTED,
    ENSEMBLE_DOC_CONFIRM_ASKED,
    ENSEMBLE_DOC_CONFIRM_DECLINED,
    ENSEMBLE_ROUTING_AUTO,
    ENSEMBLE_ROUTING_SEMI,
)


async def _collect(gen: object) -> list[str]:
    assert hasattr(gen, "__aiter__")
    out: list[str] = []
    async for line in gen:  # type: ignore[assignment]
        out.append(line)
    return out


def _events(lines: list[str]) -> list[dict[str, object]]:
    out: list[dict[str, object]] = []
    for line in lines:
        if not line.startswith("data: "):
            continue
        payload = line[len("data: ") :].strip()
        if not payload:
            continue
        out.append(json.loads(payload))
    return out


def test_forced_blueprint_routes_to_blueprint_stream() -> None:
    calls = {"bp": 0, "legacy": 0}

    async def _bp(*args: object, **kwargs: object):
        calls["bp"] += 1
        yield 'data: {"event":"token","delta":"bp"}\n\n'

    async def _legacy(*args: object, **kwargs: object):
        calls["legacy"] += 1
        yield 'data: {"event":"token","delta":"legacy"}\n\n'

    async def _run() -> None:
        chat = SimpleNamespace(id=uuid4(), updated_at=None, settings={})
        with (
            patch.object(stream_turn_mod, "stream_blueprint_turn", _bp),
            patch.object(stream_turn_mod, "stream_legacy_freeform_turn", _legacy),
        ):
            lines = await _collect(
                stream_turn_mod._stream_ensemble_turn_impl(
                    AsyncMock(),
                    chat=chat,
                    user_id=uuid4(),
                    history=[],
                    user_text="Сделай план",
                    defaults={},
                    enriched_user_content="",
                    rag_context_summary={},
                    forced_ensemble_path="blueprint",
                    rag_ctx={},
                    routing_mode=ENSEMBLE_ROUTING_AUTO,
                    model="model",
                )
            )
        ev = _events(lines)
        assert ev and ev[0].get("event") == "token"
        assert calls["bp"] == 1
        assert calls["legacy"] == 0

    asyncio.run(_run())


def test_semi_confirm_accepted_routes_to_blueprint_stream() -> None:
    calls = {"bp": 0, "legacy": 0}

    async def _bp(*args: object, **kwargs: object):
        calls["bp"] += 1
        yield 'data: {"event":"token","delta":"bp"}\n\n'

    async def _legacy(*args: object, **kwargs: object):
        calls["legacy"] += 1
        yield 'data: {"event":"token","delta":"legacy"}\n\n'

    async def _run() -> None:
        user_msg = SimpleNamespace(
            id=uuid4(),
            role="user",
            content="Сделай документ",
            message_metadata={"ensemble_doc_confirm": ENSEMBLE_DOC_CONFIRM_ACCEPTED},
        )
        chat = SimpleNamespace(id=uuid4(), updated_at=None, settings={})
        with (
            patch.object(stream_turn_mod, "stream_blueprint_turn", _bp),
            patch.object(stream_turn_mod, "stream_legacy_freeform_turn", _legacy),
        ):
            await _collect(
                stream_turn_mod._stream_ensemble_turn_impl(
                    AsyncMock(),
                    chat=chat,
                    user_id=uuid4(),
                    history=[user_msg],
                    user_text="Сделай документ",
                    defaults={},
                    enriched_user_content="",
                    rag_context_summary={},
                    forced_ensemble_path=None,
                    rag_ctx={},
                    routing_mode=ENSEMBLE_ROUTING_SEMI,
                    model="model",
                )
            )
        assert calls["bp"] == 1
        assert calls["legacy"] == 0

    asyncio.run(_run())


def test_semi_mode_asks_document_confirmation_when_blueprint_detected() -> None:
    async def _should_not_stream(*args: object, **kwargs: object):
        raise AssertionError("downstream stream should not run before confirmation")
        yield ""  # pragma: no cover

    async def _run() -> None:
        user_msg = SimpleNamespace(
            id=uuid4(),
            role="user",
            content="Нужен структурированный документ",
            message_metadata={},
        )
        persist = AsyncMock()
        chat = SimpleNamespace(id=uuid4(), updated_at=None, settings={})
        with (
            patch.object(stream_turn_mod, "stream_blueprint_turn", _should_not_stream),
            patch.object(stream_turn_mod, "stream_legacy_freeform_turn", _should_not_stream),
            patch.object(
                stream_turn_mod,
                "resolve_auto_blueprint_vs_legacy",
                AsyncMock(return_value=(True, "heuristic_blueprint")),
            ),
            patch.object(stream_turn_mod, "persist_message_metadata_isolated", persist),
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
                    rag_ctx={"chat_rag_chunks": 1},
                    routing_mode=ENSEMBLE_ROUTING_SEMI,
                    model="model",
                )
            )
        ev = _events(lines)
        assert len(ev) == 2
        assert ev[0].get("event") == "ensemble_document_confirm"
        assert ev[0].get("user_message_id") == str(user_msg.id)
        assert ev[1].get("event") == "done"
        assert ev[1].get("pending_document_confirm") is True
        assert user_msg.message_metadata.get("ensemble_doc_confirm") == ENSEMBLE_DOC_CONFIRM_ASKED
        assert user_msg.message_metadata.get("ensemble_doc_confirm_asked_at")
        persist.assert_awaited()

    asyncio.run(_run())


def test_semi_expired_confirm_routes_to_legacy() -> None:
    calls = {"bp": 0, "legacy": 0}

    async def _bp(*args: object, **kwargs: object):
        calls["bp"] += 1
        yield 'data: {"event":"token","delta":"bp"}\n\n'

    async def _legacy(*args: object, **kwargs: object):
        calls["legacy"] += 1
        yield 'data: {"event":"token","delta":"legacy"}\n\n'

    async def _run() -> None:
        from datetime import timedelta

        from api.services.desktop_chat_ensemble.doc_confirm_policy import (
            ENSEMBLE_DOC_CONFIRM_ASKED_AT_KEY,
        )
        from api.utils.datetime_helpers import utc_now_naive

        asked_at = (utc_now_naive() - timedelta(hours=2)).isoformat(timespec="seconds")
        user_msg = SimpleNamespace(
            id=uuid4(),
            role="user",
            content="Нужен структурированный документ",
            message_metadata={
                "ensemble_doc_confirm": ENSEMBLE_DOC_CONFIRM_ASKED,
                ENSEMBLE_DOC_CONFIRM_ASKED_AT_KEY: asked_at,
            },
        )
        persist = AsyncMock()
        chat = SimpleNamespace(id=uuid4(), updated_at=None, settings={})
        with (
            patch.object(stream_turn_mod, "stream_blueprint_turn", _bp),
            patch.object(stream_turn_mod, "stream_legacy_freeform_turn", _legacy),
            patch.object(
                stream_turn_mod,
                "resolve_auto_blueprint_vs_legacy",
                AsyncMock(return_value=(True, "heuristic_blueprint")),
            ),
            patch.object(stream_turn_mod, "persist_message_metadata_isolated", persist),
        ):
            await _collect(
                stream_turn_mod._stream_ensemble_turn_impl(
                    AsyncMock(),
                    chat=chat,
                    user_id=uuid4(),
                    history=[user_msg],
                    user_text="Нужен структурированный документ",
                    defaults={},
                    enriched_user_content="",
                    rag_context_summary={},
                    forced_ensemble_path=None,
                    rag_ctx={},
                    routing_mode=ENSEMBLE_ROUTING_SEMI,
                    model="model",
                )
            )
        assert calls["bp"] == 0
        assert calls["legacy"] == 1
        assert user_msg.message_metadata.get("ensemble_doc_confirm") == ENSEMBLE_DOC_CONFIRM_DECLINED
        assert user_msg.message_metadata.get("ensemble_doc_confirm_expired") is True
        persist.assert_awaited()

    asyncio.run(_run())


def test_auto_mode_routes_to_legacy_when_blueprint_not_selected() -> None:
    calls = {"bp": 0, "legacy": 0}

    async def _bp(*args: object, **kwargs: object):
        calls["bp"] += 1
        yield 'data: {"event":"token","delta":"bp"}\n\n'

    async def _legacy(*args: object, **kwargs: object):
        calls["legacy"] += 1
        yield 'data: {"event":"token","delta":"legacy"}\n\n'

    async def _run() -> None:
        chat = SimpleNamespace(id=uuid4(), updated_at=None, settings={})
        with (
            patch.object(stream_turn_mod, "stream_blueprint_turn", _bp),
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
            await _collect(
                stream_turn_mod._stream_ensemble_turn_impl(
                    AsyncMock(),
                    chat=chat,
                    user_id=uuid4(),
                    history=[],
                    user_text="Просто обсудим идею",
                    defaults={},
                    enriched_user_content="",
                    rag_context_summary={},
                    forced_ensemble_path=None,
                    rag_ctx={},
                    routing_mode=ENSEMBLE_ROUTING_AUTO,
                    model="model",
                )
            )
        assert calls["bp"] == 0
        assert calls["legacy"] == 1

    asyncio.run(_run())
