# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# HTTP contract tests for Desktop AI Chat stream router (403 solo slot, 409 conflicts, 204 release, SSE success).
# Invariants:
# - Stubs DB/stream generator boundaries; no Redis or live LLM.
# Related:
# - api/routers/desktop_ai_chat.py
# - api/routers/desktop_ai_chat_stream_routes.py
# - api/services/desktop_chat/stream_lock.py
# ---
"""Router contract: stream lock conflicts, release, and SSE success without Redis."""

from __future__ import annotations

import json
import sys
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from types import ModuleType, SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from api.core.database_manager import get_asyncpg_pool, get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.services.desktop_chat.collaboration_access import ChatAccess


def _ensure_tenacity_stub() -> None:
    if "tenacity" in sys.modules:
        return
    stub = ModuleType("tenacity")

    def _passthrough_decorator(*_args: object, **_kwargs: object):
        def _wrap(fn: object) -> object:
            return fn

        return _wrap

    setattr(stub, "RetryError", Exception)
    setattr(stub, "retry", _passthrough_decorator)
    setattr(stub, "retry_if_exception_type", lambda *_a, **_k: None)
    setattr(stub, "stop_after_attempt", lambda *_a, **_k: None)
    setattr(stub, "wait_exponential", lambda *_a, **_k: None)
    sys.modules["tenacity"] = stub


async def _empty_sse_gen() -> AsyncIterator[str]:
    if False:  # pragma: no cover — unreachable async generator stub
        yield ""
    return


async def _done_sse_gen() -> AsyncIterator[str]:
    yield f"data: {json.dumps({'event': 'done'})}\n\n"


def _owner_access(chat: SimpleNamespace) -> ChatAccess:
    return ChatAccess(chat=chat, viewer_role="owner", member=None)


def _session_without_active_discussion(*, db_now: datetime | None = None) -> AsyncMock:
    """ORM session for stream prep: no Discussion row; optional clock for solo-slot."""
    session = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    result.first.return_value = None
    if db_now is not None:
        result.scalar_one.return_value = db_now
    session.execute = AsyncMock(return_value=result)
    return session


def _session_with_db_now(now: datetime) -> AsyncMock:
    return _session_without_active_discussion(db_now=now)


def _wire_real_solo_slot_assert(monkeypatch: pytest.MonkeyPatch) -> None:
    import api.routers.desktop_ai_chat_stream_routes as router_mod
    from api.services.desktop_chat import solo_slot as solo_slot_mod

    monkeypatch.setattr(
        router_mod,
        "assert_solo_slot_allows_stream",
        solo_slot_mod.assert_solo_slot_allows_stream,
    )


@pytest.fixture
def desktop_chat_router_app(monkeypatch: pytest.MonkeyPatch) -> tuple[FastAPI, UUID, SimpleNamespace]:
    _ensure_tenacity_stub()
    import api.routers.desktop_ai_chat as parent_mod
    import api.routers.desktop_ai_chat_stream_routes as router_mod

    user_id = uuid4()
    chat_id = uuid4()
    fake_user = SimpleNamespace(id=str(user_id))
    chat = SimpleNamespace(
        id=chat_id,
        user_id=user_id,
        project_id=None,
        settings={},
    )

    monkeypatch.setattr(router_mod, "require_chat_access", AsyncMock(return_value=_owner_access(chat)))
    monkeypatch.setattr(
        router_mod,
        "fetch_config_defaults",
        AsyncMock(return_value={"feature_enabled": True}),
    )
    monkeypatch.setattr(router_mod, "assert_solo_slot_allows_stream", AsyncMock())
    monkeypatch.setattr(
        router_mod,
        "stream_chat_turn",
        MagicMock(return_value=_empty_sse_gen()),
    )
    monkeypatch.setattr(router_mod, "wrap_stream_with_lock_and_idem", lambda gen, **_kw: gen)

    @asynccontextmanager
    async def _fake_prep_session():
        yield _session_without_active_discussion()

    monkeypatch.setattr(router_mod, "desktop_ai_chat_session", _fake_prep_session)

    app = FastAPI()
    app.include_router(parent_mod.router, prefix="/api/v1")
    app.dependency_overrides[require_oauth2_user] = lambda: fake_user
    app.dependency_overrides[get_postgres_session] = lambda: AsyncMock()
    app.dependency_overrides[get_asyncpg_pool] = lambda: AsyncMock()
    return app, chat_id, fake_user


def test_stream_returns_503_when_coordination_unavailable(
    desktop_chat_router_app: tuple[FastAPI, UUID, SimpleNamespace],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import api.routers.desktop_ai_chat_stream_routes as router_mod
    from api.services.desktop_chat.stream_coordination import StreamCoordinationUnavailable

    app, chat_id, _user = desktop_chat_router_app
    monkeypatch.setattr(
        router_mod,
        "acquire_stream_lock",
        AsyncMock(side_effect=StreamCoordinationUnavailable("redis down")),
    )

    with TestClient(app, raise_server_exceptions=False) as client:
        res = client.post(
            f"/api/v1/desktop/ai-chat/chats/{chat_id}/stream",
            json={"content": "hello"},
        )

    assert res.status_code == 503
    assert res.json()["detail"] == "stream_coordination_unavailable"


def test_stream_returns_409_discussion_active_when_session_running(
    desktop_chat_router_app: tuple[FastAPI, UUID, SimpleNamespace],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Active Discussion isolates normal /stream (desktop-ai-chat-025)."""
    import api.routers.desktop_ai_chat_stream_routes as router_mod

    app, chat_id, _user = desktop_chat_router_app
    session_id = uuid4()
    monkeypatch.setattr(
        router_mod,
        "active_discussion_blocks_stream",
        AsyncMock(return_value=session_id),
    )

    with TestClient(app, raise_server_exceptions=False) as client:
        res = client.post(
            f"/api/v1/desktop/ai-chat/chats/{chat_id}/stream",
            json={"content": "hello"},
        )

    assert res.status_code == 409
    assert res.json()["detail"] == "discussion_active"
    assert res.headers.get("x-discussion-session-id") == str(session_id)


def test_stream_returns_409_turn_in_progress_when_lock_held(
    desktop_chat_router_app: tuple[FastAPI, UUID, SimpleNamespace],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import api.routers.desktop_ai_chat_stream_routes as router_mod

    app, chat_id, _user = desktop_chat_router_app
    monkeypatch.setattr(router_mod, "acquire_stream_lock", AsyncMock(return_value=False))

    with TestClient(app, raise_server_exceptions=False) as client:
        res = client.post(
            f"/api/v1/desktop/ai-chat/chats/{chat_id}/stream",
            json={"content": "hello"},
        )

    assert res.status_code == 409
    assert res.json()["detail"] == "turn_in_progress"


def test_stream_returns_409_duplicate_client_request_and_releases_lock(
    desktop_chat_router_app: tuple[FastAPI, UUID, SimpleNamespace],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import api.routers.desktop_ai_chat_stream_routes as router_mod

    app, chat_id, _user = desktop_chat_router_app
    release_lock = AsyncMock()
    monkeypatch.setattr(router_mod, "acquire_stream_lock", AsyncMock(return_value=True))
    monkeypatch.setattr(router_mod, "try_register_idempotency", AsyncMock(return_value=False))
    monkeypatch.setattr(router_mod, "release_stream_lock", release_lock)

    client_request_id = str(uuid4())
    with TestClient(app, raise_server_exceptions=False) as client:
        res = client.post(
            f"/api/v1/desktop/ai-chat/chats/{chat_id}/stream",
            json={"content": "hello", "client_request_id": client_request_id},
        )

    assert res.status_code == 409
    assert res.json()["detail"] == "duplicate_client_request"
    release_lock.assert_awaited_once_with(chat_id)


def test_delete_stream_lock_returns_404_when_chat_missing(
    desktop_chat_router_app: tuple[FastAPI, UUID, SimpleNamespace],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import api.routers.desktop_ai_chat_stream_routes as router_mod

    app, chat_id, _user = desktop_chat_router_app
    monkeypatch.setattr(
        router_mod,
        "require_chat_access",
        AsyncMock(side_effect=HTTPException(status_code=404, detail="Chat not found")),
    )

    with TestClient(app, raise_server_exceptions=False) as client:
        res = client.delete(f"/api/v1/desktop/ai-chat/chats/{chat_id}/stream-lock")

    assert res.status_code == 404
    assert res.json()["detail"] == "Chat not found"


def test_delete_stream_lock_returns_204_and_releases(
    desktop_chat_router_app: tuple[FastAPI, UUID, SimpleNamespace],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import api.routers.desktop_ai_chat_stream_routes as router_mod

    app, chat_id, _user = desktop_chat_router_app
    release_lock = AsyncMock()
    monkeypatch.setattr(router_mod, "release_stream_lock", release_lock)

    with TestClient(app, raise_server_exceptions=False) as client:
        res = client.delete(f"/api/v1/desktop/ai-chat/chats/{chat_id}/stream-lock")

    assert res.status_code == 204
    assert res.content == b""
    release_lock.assert_awaited_once_with(chat_id)


def test_post_stream_lock_release_returns_204_and_releases(
    desktop_chat_router_app: tuple[FastAPI, UUID, SimpleNamespace],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import api.routers.desktop_ai_chat_stream_routes as router_mod

    app, chat_id, _user = desktop_chat_router_app
    release_lock = AsyncMock()
    monkeypatch.setattr(router_mod, "release_stream_lock", release_lock)

    with TestClient(app, raise_server_exceptions=False) as client:
        res = client.post(f"/api/v1/desktop/ai-chat/chats/{chat_id}/stream-lock/release")

    assert res.status_code == 204
    assert res.content == b""
    release_lock.assert_awaited_once_with(chat_id)


def test_stream_returns_sse_when_lock_acquired(
    desktop_chat_router_app: tuple[FastAPI, UUID, SimpleNamespace],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import api.routers.desktop_ai_chat_stream_routes as router_mod

    app, chat_id, _user = desktop_chat_router_app
    acquire_lock = AsyncMock(return_value=True)
    wrapped: dict[str, object] = {}

    def _wrap_stream(gen: object, **kwargs: object) -> object:
        wrapped["gen"] = gen
        wrapped.update(kwargs)
        return gen

    monkeypatch.setattr(router_mod, "acquire_stream_lock", acquire_lock)
    monkeypatch.setattr(
        router_mod,
        "stream_chat_turn",
        MagicMock(return_value=_done_sse_gen()),
    )
    monkeypatch.setattr(router_mod, "wrap_stream_with_lock_and_idem", _wrap_stream)

    with TestClient(app, raise_server_exceptions=False) as client:
        res = client.post(
            f"/api/v1/desktop/ai-chat/chats/{chat_id}/stream",
            json={"content": "hello"},
        )

    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/event-stream")
    assert '"event": "done"' in res.text or '"event":"done"' in res.text
    acquire_lock.assert_awaited_once()
    assert acquire_lock.await_args is not None
    assert acquire_lock.await_args.args[:2] == (chat_id, UUID(_user.id))
    assert wrapped.get("chat_id") == chat_id
    assert wrapped.get("user_id") == UUID(_user.id)
    assert wrapped.get("client_request_id") is None


def test_stream_registers_idempotency_when_client_request_id_present(
    desktop_chat_router_app: tuple[FastAPI, UUID, SimpleNamespace],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import api.routers.desktop_ai_chat_stream_routes as router_mod

    app, chat_id, user = desktop_chat_router_app
    client_request_id = uuid4()
    register_idem = AsyncMock(return_value=True)

    monkeypatch.setattr(router_mod, "acquire_stream_lock", AsyncMock(return_value=True))
    monkeypatch.setattr(router_mod, "try_register_idempotency", register_idem)
    monkeypatch.setattr(
        router_mod,
        "stream_chat_turn",
        MagicMock(return_value=_done_sse_gen()),
    )
    monkeypatch.setattr(router_mod, "wrap_stream_with_lock_and_idem", lambda gen, **_kw: gen)

    with TestClient(app, raise_server_exceptions=False) as client:
        res = client.post(
            f"/api/v1/desktop/ai-chat/chats/{chat_id}/stream",
            json={"content": "hello", "client_request_id": str(client_request_id)},
        )

    assert res.status_code == 200
    register_idem.assert_awaited_once()
    assert register_idem.await_args is not None
    assert register_idem.await_args.args[:2] == (UUID(user.id), client_request_id)


def test_stream_returns_400_when_content_empty(
    desktop_chat_router_app: tuple[FastAPI, UUID, SimpleNamespace],
) -> None:
    app, chat_id, _user = desktop_chat_router_app

    with TestClient(app, raise_server_exceptions=False) as client:
        res = client.post(
            f"/api/v1/desktop/ai-chat/chats/{chat_id}/stream",
            json={"content": "   "},
        )

    assert res.status_code == 400
    assert res.json()["detail"] == "content required"


def test_stream_returns_404_when_chat_missing(
    desktop_chat_router_app: tuple[FastAPI, UUID, SimpleNamespace],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import api.routers.desktop_ai_chat_stream_routes as router_mod

    app, chat_id, _user = desktop_chat_router_app
    monkeypatch.setattr(
        router_mod,
        "require_chat_access",
        AsyncMock(side_effect=HTTPException(status_code=404, detail="Chat not found")),
    )

    with TestClient(app, raise_server_exceptions=False) as client:
        res = client.post(
            f"/api/v1/desktop/ai-chat/chats/{chat_id}/stream",
            json={"content": "hello"},
        )

    assert res.status_code == 404
    assert res.json()["detail"] == "Chat not found"


def test_stream_returns_403_when_feature_disabled(
    desktop_chat_router_app: tuple[FastAPI, UUID, SimpleNamespace],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import api.routers.desktop_ai_chat_stream_routes as router_mod

    app, chat_id, _user = desktop_chat_router_app
    monkeypatch.setattr(
        router_mod,
        "fetch_config_defaults",
        AsyncMock(return_value={"feature_enabled": False}),
    )

    with TestClient(app, raise_server_exceptions=False) as client:
        res = client.post(
            f"/api/v1/desktop/ai-chat/chats/{chat_id}/stream",
            json={"content": "hello"},
        )

    assert res.status_code == 403
    assert res.json()["detail"] == "Experts disabled"


def test_stream_returns_409_nothing_to_regenerate(
    desktop_chat_router_app: tuple[FastAPI, UUID, SimpleNamespace],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import api.routers.desktop_ai_chat_stream_routes as router_mod

    app, chat_id, _user = desktop_chat_router_app
    last_role_result = MagicMock()
    last_role_result.scalar_one_or_none.return_value = None
    last_role_result.first.return_value = ("user",)
    session = AsyncMock()
    session.execute = AsyncMock(return_value=last_role_result)

    @asynccontextmanager
    async def _prep_session():
        yield session

    monkeypatch.setattr(router_mod, "desktop_ai_chat_session", _prep_session)

    with TestClient(app, raise_server_exceptions=False) as client:
        res = client.post(
            f"/api/v1/desktop/ai-chat/chats/{chat_id}/stream",
            json={"content": "", "regenerate": True},
        )

    assert res.status_code == 409
    assert res.json()["detail"] == "nothing_to_regenerate"


def _ensemble_chat(chat_id: UUID, user_id: UUID) -> SimpleNamespace:
    return SimpleNamespace(
        id=chat_id,
        user_id=user_id,
        project_id=None,
        settings={"desktop_chat_mode": "ensemble", "desktop_ensemble_ids": ["arlyqueen"]},
    )


def test_stream_returns_400_ref_user_message_id_required_for_ensemble_confirm(
    desktop_chat_router_app: tuple[FastAPI, UUID, SimpleNamespace],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import api.routers.desktop_ai_chat_stream_routes as router_mod

    app, chat_id, user = desktop_chat_router_app
    monkeypatch.setattr(
        router_mod,
        "require_chat_access",
        AsyncMock(return_value=_owner_access(_ensemble_chat(chat_id, UUID(user.id)))),
    )

    with TestClient(app, raise_server_exceptions=False) as client:
        res = client.post(
            f"/api/v1/desktop/ai-chat/chats/{chat_id}/stream",
            json={"content": "", "ensemble_document_confirm": "accept"},
        )

    assert res.status_code == 400
    assert res.json()["detail"] == "ref_user_message_id_required"


def test_stream_returns_400_confirm_with_content_forbidden(
    desktop_chat_router_app: tuple[FastAPI, UUID, SimpleNamespace],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import api.routers.desktop_ai_chat_stream_routes as router_mod

    app, chat_id, user = desktop_chat_router_app
    ref_id = uuid4()
    monkeypatch.setattr(
        router_mod,
        "require_chat_access",
        AsyncMock(return_value=_owner_access(_ensemble_chat(chat_id, UUID(user.id)))),
    )

    with TestClient(app, raise_server_exceptions=False) as client:
        res = client.post(
            f"/api/v1/desktop/ai-chat/chats/{chat_id}/stream",
            json={
                "content": "extra text",
                "ensemble_document_confirm": "accept",
                "ref_user_message_id": str(ref_id),
            },
        )

    assert res.status_code == 400
    assert res.json()["detail"] == "confirm_with_content_forbidden"


def test_stream_returns_400_ensemble_confirm_only_for_group_chat(
    desktop_chat_router_app: tuple[FastAPI, UUID, SimpleNamespace],
) -> None:
    app, chat_id, _user = desktop_chat_router_app

    with TestClient(app, raise_server_exceptions=False) as client:
        res = client.post(
            f"/api/v1/desktop/ai-chat/chats/{chat_id}/stream",
            json={
                "content": "",
                "ensemble_document_confirm": "decline",
                "ref_user_message_id": str(uuid4()),
            },
        )

    assert res.status_code == 400
    assert res.json()["detail"] == "ensemble_confirm_only_for_group_chat"


def test_stream_returns_400_confirm_with_regenerate_forbidden(
    desktop_chat_router_app: tuple[FastAPI, UUID, SimpleNamespace],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import api.routers.desktop_ai_chat_stream_routes as router_mod

    app, chat_id, user = desktop_chat_router_app
    monkeypatch.setattr(
        router_mod,
        "require_chat_access",
        AsyncMock(return_value=_owner_access(_ensemble_chat(chat_id, UUID(user.id)))),
    )

    with TestClient(app, raise_server_exceptions=False) as client:
        res = client.post(
            f"/api/v1/desktop/ai-chat/chats/{chat_id}/stream",
            json={
                "content": "",
                "regenerate": True,
                "ensemble_document_confirm": "accept",
                "ref_user_message_id": str(uuid4()),
            },
        )

    assert res.status_code == 400
    assert res.json()["detail"] == "confirm_with_regenerate_forbidden"


def test_stream_returns_sse_on_ensemble_document_confirm_accept(
    desktop_chat_router_app: tuple[FastAPI, UUID, SimpleNamespace],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import api.routers.desktop_ai_chat_stream_routes as router_mod

    app, chat_id, user = desktop_chat_router_app
    ref_id = uuid4()
    apply_confirm = AsyncMock(return_value="confirmed user text")
    stream_turn = MagicMock(return_value=_done_sse_gen())
    monkeypatch.setattr(
        router_mod,
        "require_chat_access",
        AsyncMock(return_value=_owner_access(_ensemble_chat(chat_id, UUID(user.id)))),
    )
    monkeypatch.setattr(router_mod, "apply_ensemble_document_confirm", apply_confirm)
    monkeypatch.setattr(router_mod, "stream_chat_turn", stream_turn)
    monkeypatch.setattr(router_mod, "acquire_stream_lock", AsyncMock(return_value=True))
    monkeypatch.setattr(router_mod, "wrap_stream_with_lock_and_idem", lambda gen, **_kw: gen)

    with TestClient(app, raise_server_exceptions=False) as client:
        res = client.post(
            f"/api/v1/desktop/ai-chat/chats/{chat_id}/stream",
            json={
                "content": "",
                "ensemble_document_confirm": "accept",
                "ref_user_message_id": str(ref_id),
            },
        )

    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/event-stream")
    assert '"event": "done"' in res.text or '"event":"done"' in res.text
    apply_confirm.assert_awaited_once()
    _args, kwargs = stream_turn.call_args
    assert kwargs["user_text"] == "confirmed user text"
    assert kwargs["ensemble_forced_path"] == "blueprint"
    assert kwargs["ensemble_skip_user_persist"] is True


def test_stream_returns_sse_on_ensemble_document_confirm_decline(
    desktop_chat_router_app: tuple[FastAPI, UUID, SimpleNamespace],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import api.routers.desktop_ai_chat_stream_routes as router_mod

    app, chat_id, user = desktop_chat_router_app
    ref_id = uuid4()
    apply_confirm = AsyncMock(return_value="declined user text")
    stream_turn = MagicMock(return_value=_done_sse_gen())
    monkeypatch.setattr(
        router_mod,
        "require_chat_access",
        AsyncMock(return_value=_owner_access(_ensemble_chat(chat_id, UUID(user.id)))),
    )
    monkeypatch.setattr(router_mod, "apply_ensemble_document_confirm", apply_confirm)
    monkeypatch.setattr(router_mod, "stream_chat_turn", stream_turn)
    monkeypatch.setattr(router_mod, "acquire_stream_lock", AsyncMock(return_value=True))
    monkeypatch.setattr(router_mod, "wrap_stream_with_lock_and_idem", lambda gen, **_kw: gen)

    with TestClient(app, raise_server_exceptions=False) as client:
        res = client.post(
            f"/api/v1/desktop/ai-chat/chats/{chat_id}/stream",
            json={
                "content": "",
                "ensemble_document_confirm": "decline",
                "ref_user_message_id": str(ref_id),
            },
        )

    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/event-stream")
    apply_confirm.assert_awaited_once()
    _args, kwargs = stream_turn.call_args
    assert kwargs["user_text"] == "declined user text"
    assert kwargs["ensemble_forced_path"] == "legacy"
    assert kwargs["ensemble_skip_user_persist"] is True


def test_stream_returns_403_solo_slot_required(
    desktop_chat_router_app: tuple[FastAPI, UUID, SimpleNamespace],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import api.routers.desktop_ai_chat_stream_routes as router_mod

    app, chat_id, user = desktop_chat_router_app
    now = datetime(2026, 6, 17, 12, 0, tzinfo=UTC)
    solo_chat = SimpleNamespace(
        id=chat_id,
        user_id=UUID(user.id),
        project_id=None,
        settings={},
        solo_slot_ends_at=None,
    )
    monkeypatch.setattr(router_mod, "require_chat_access", AsyncMock(return_value=_owner_access(solo_chat)))
    _wire_real_solo_slot_assert(monkeypatch)

    @asynccontextmanager
    async def _prep_session():
        yield _session_with_db_now(now)

    monkeypatch.setattr(router_mod, "desktop_ai_chat_session", _prep_session)

    with TestClient(app, raise_server_exceptions=False) as client:
        res = client.post(
            f"/api/v1/desktop/ai-chat/chats/{chat_id}/stream",
            json={"content": "hello"},
        )

    assert res.status_code == 403
    assert res.json()["detail"] == "solo_slot_required"


def test_stream_returns_403_solo_slot_expired(
    desktop_chat_router_app: tuple[FastAPI, UUID, SimpleNamespace],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import api.routers.desktop_ai_chat_stream_routes as router_mod

    app, chat_id, user = desktop_chat_router_app
    now = datetime(2026, 6, 17, 12, 0, tzinfo=UTC)
    solo_chat = SimpleNamespace(
        id=chat_id,
        user_id=UUID(user.id),
        project_id=None,
        settings={},
        solo_slot_ends_at=now - timedelta(minutes=5),
    )
    monkeypatch.setattr(router_mod, "require_chat_access", AsyncMock(return_value=_owner_access(solo_chat)))
    _wire_real_solo_slot_assert(monkeypatch)

    @asynccontextmanager
    async def _prep_session():
        yield _session_with_db_now(now)

    monkeypatch.setattr(router_mod, "desktop_ai_chat_session", _prep_session)

    with TestClient(app, raise_server_exceptions=False) as client:
        res = client.post(
            f"/api/v1/desktop/ai-chat/chats/{chat_id}/stream",
            json={"content": "hello"},
        )

    assert res.status_code == 403
    assert res.json()["detail"] == "solo_slot_expired"


def test_stream_allows_ensemble_without_solo_slot(
    desktop_chat_router_app: tuple[FastAPI, UUID, SimpleNamespace],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import api.routers.desktop_ai_chat_stream_routes as router_mod

    app, chat_id, user = desktop_chat_router_app
    now = datetime(2026, 6, 17, 12, 0, tzinfo=UTC)
    monkeypatch.setattr(
        router_mod,
        "require_chat_access",
        AsyncMock(return_value=_owner_access(_ensemble_chat(chat_id, UUID(user.id)))),
    )
    _wire_real_solo_slot_assert(monkeypatch)
    monkeypatch.setattr(router_mod, "acquire_stream_lock", AsyncMock(return_value=True))
    monkeypatch.setattr(
        router_mod,
        "stream_chat_turn",
        MagicMock(return_value=_done_sse_gen()),
    )
    monkeypatch.setattr(router_mod, "wrap_stream_with_lock_and_idem", lambda gen, **_kw: gen)

    @asynccontextmanager
    async def _prep_session():
        yield _session_with_db_now(now)

    monkeypatch.setattr(router_mod, "desktop_ai_chat_session", _prep_session)

    with TestClient(app, raise_server_exceptions=False) as client:
        res = client.post(
            f"/api/v1/desktop/ai-chat/chats/{chat_id}/stream",
            json={"content": "hello"},
        )

    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/event-stream")


def test_stream_allows_solo_with_active_solo_slot(
    desktop_chat_router_app: tuple[FastAPI, UUID, SimpleNamespace],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import api.routers.desktop_ai_chat_stream_routes as router_mod

    app, chat_id, user = desktop_chat_router_app
    now = datetime(2026, 6, 17, 12, 0, tzinfo=UTC)
    solo_chat = SimpleNamespace(
        id=chat_id,
        user_id=UUID(user.id),
        project_id=None,
        settings={},
        solo_slot_ends_at=now + timedelta(hours=1),
    )
    monkeypatch.setattr(router_mod, "require_chat_access", AsyncMock(return_value=_owner_access(solo_chat)))
    _wire_real_solo_slot_assert(monkeypatch)
    monkeypatch.setattr(router_mod, "acquire_stream_lock", AsyncMock(return_value=True))
    monkeypatch.setattr(
        router_mod,
        "stream_chat_turn",
        MagicMock(return_value=_done_sse_gen()),
    )
    monkeypatch.setattr(router_mod, "wrap_stream_with_lock_and_idem", lambda gen, **_kw: gen)

    @asynccontextmanager
    async def _prep_session():
        yield _session_with_db_now(now)

    monkeypatch.setattr(router_mod, "desktop_ai_chat_session", _prep_session)

    with TestClient(app, raise_server_exceptions=False) as client:
        res = client.post(
            f"/api/v1/desktop/ai-chat/chats/{chat_id}/stream",
            json={"content": "hello"},
        )

    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/event-stream")


def test_stream_skips_solo_slot_check_when_ensemble_confirm_present(
    desktop_chat_router_app: tuple[FastAPI, UUID, SimpleNamespace],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Confirm path runs before solo slot; solo chat gets ensemble 400, not solo_slot 403."""
    import api.routers.desktop_ai_chat_stream_routes as router_mod

    app, chat_id, user = desktop_chat_router_app
    now = datetime(2026, 6, 17, 12, 0, tzinfo=UTC)
    solo_chat = SimpleNamespace(
        id=chat_id,
        user_id=UUID(user.id),
        project_id=None,
        settings={},
        solo_slot_ends_at=None,
    )
    monkeypatch.setattr(router_mod, "require_chat_access", AsyncMock(return_value=_owner_access(solo_chat)))
    _wire_real_solo_slot_assert(monkeypatch)

    @asynccontextmanager
    async def _prep_session():
        yield _session_with_db_now(now)

    monkeypatch.setattr(router_mod, "desktop_ai_chat_session", _prep_session)

    with TestClient(app, raise_server_exceptions=False) as client:
        res = client.post(
            f"/api/v1/desktop/ai-chat/chats/{chat_id}/stream",
            json={
                "content": "",
                "ensemble_document_confirm": "accept",
                "ref_user_message_id": str(uuid4()),
            },
        )

    assert res.status_code == 400
    assert res.json()["detail"] == "ensemble_confirm_only_for_group_chat"
