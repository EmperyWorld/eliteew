# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# P2 behavioral tests for shell-state PATCH Idempotency-Key (optional) and FOR UPDATE lock path.
# Invariants:
# - No live Redis/Postgres; Redis helpers and row lock are mocked.
# Related:
# - api/routers/desktop_shell_config.py
# - api/services/desktop_shell_state_idempotency.py
# ---

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException, status

from api.monitoring import metrics
from api.routers import desktop_shell_config as shell_mod
from api.services import desktop_shell_state_idempotency as idem_mod


@pytest.mark.asyncio
async def test_patch_shell_state_idempotent_replay_skips_write(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    before = metrics.desktop_shell_state_patch_total.labels(result="idempotent_replay")._value.get()
    user_id = uuid4()
    cached_body = {"recent_app_ids": ["app-cached"], "virtual_desktops": None}

    monkeypatch.setattr(
        shell_mod,
        "get_shell_state_idempotent_response",
        AsyncMock(return_value=cached_body),
    )
    lock = AsyncMock()
    monkeypatch.setattr(shell_mod, "_lock_desktop_config_row_for_update", lock)

    request = MagicMock()
    request.headers = {}
    response = MagicMock()
    response.headers = {}

    out = await shell_mod.patch_shell_state(
        data=shell_mod.DesktopShellStatePatch(recent_app_ids=["app-new"]),
        request=request,
        response=response,
        current_user=MagicMock(),
        user_id=user_id,
        db=AsyncMock(),
        idempotency_key_header="shell-idem-replay-01",
    )

    assert out.recent_app_ids == ["app-cached"]
    lock.assert_not_awaited()
    after = metrics.desktop_shell_state_patch_total.labels(result="idempotent_replay")._value.get()
    assert after == before + 1.0


@pytest.mark.asyncio
async def test_patch_shell_state_redis_down_with_key_returns_503(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    before = metrics.desktop_shell_state_patch_total.labels(result="redis_unavailable")._value.get()

    async def _raise_redis(_user_id: object, _key: str) -> None:
        raise idem_mod.ShellStateRedisUnavailableError("down")

    monkeypatch.setattr(shell_mod, "get_shell_state_idempotent_response", _raise_redis)

    request = MagicMock()
    request.headers = {}
    response = MagicMock()
    response.headers = {}

    with pytest.raises(HTTPException) as exc_info:
        await shell_mod.patch_shell_state(
            data=shell_mod.DesktopShellStatePatch(quiet_mode=True),
            request=request,
            response=response,
            current_user=MagicMock(),
            user_id=uuid4(),
            db=AsyncMock(),
            idempotency_key_header="shell-idem-503-xx",
        )

    assert exc_info.value.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    after = metrics.desktop_shell_state_patch_total.labels(result="redis_unavailable")._value.get()
    assert after == before + 1.0


@pytest.mark.asyncio
async def test_patch_shell_state_uses_for_update_lock(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _Cfg:
        shell_state = {"recent_app_ids": ["app-a"]}

    cfg = _Cfg()
    lock = AsyncMock(return_value=cfg)
    monkeypatch.setattr(shell_mod, "_lock_desktop_config_row_for_update", lock)
    monkeypatch.setattr(shell_mod, "flag_modified", lambda *_a, **_k: None)

    db = AsyncMock()
    request = MagicMock()
    request.headers = {}
    response = MagicMock()
    response.headers = {}

    out = await shell_mod.patch_shell_state(
        data=shell_mod.DesktopShellStatePatch(recent_app_ids=["app-b"]),
        request=request,
        response=response,
        current_user=MagicMock(),
        user_id=uuid4(),
        db=db,
        idempotency_key_header=None,
    )

    lock.assert_awaited_once()
    db.commit.assert_awaited()
    assert out.recent_app_ids == ["app-b"]


@pytest.mark.asyncio
async def test_patch_shell_state_remembers_idempotent_response_after_ok(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _Cfg:
        shell_state = {"recent_app_ids": ["app-a"]}

    monkeypatch.setattr(shell_mod, "_lock_desktop_config_row_for_update", AsyncMock(return_value=_Cfg()))
    monkeypatch.setattr(shell_mod, "flag_modified", lambda *_a, **_k: None)
    monkeypatch.setattr(shell_mod, "get_shell_state_idempotent_response", AsyncMock(return_value=None))
    monkeypatch.setattr(shell_mod, "claim_shell_state_idempotency_key", AsyncMock(return_value=True))
    remember = AsyncMock()
    monkeypatch.setattr(shell_mod, "remember_shell_state_idempotent_response", remember)
    monkeypatch.setattr(shell_mod, "release_shell_state_idempotency_claim", AsyncMock())

    out = await shell_mod.patch_shell_state(
        data=shell_mod.DesktopShellStatePatch(recent_app_ids=["app-b"]),
        request=MagicMock(headers={}),
        response=MagicMock(headers={}),
        current_user=MagicMock(),
        user_id=uuid4(),
        db=AsyncMock(),
        idempotency_key_header="shell-idem-ok-0001",
    )

    assert out.recent_app_ids == ["app-b"]
    remember.assert_awaited_once()


def test_normalize_shell_state_idempotency_key_bounds() -> None:
    assert idem_mod.normalize_shell_state_idempotency_key("short") is None
    assert idem_mod.normalize_shell_state_idempotency_key("long-enough-key") == "long-enough-key"
    assert idem_mod.normalize_shell_state_idempotency_key("  padded-key-xx  ") == "padded-key-xx"
