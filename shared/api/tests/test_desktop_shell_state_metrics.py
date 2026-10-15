# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave C: shell_state PATCH/GET Prometheus SLI helpers and conflict_412 wiring.
# Invariants:
# - Observe helpers are best-effort; PATCH conflict path increments conflict_412.
# Related:
# - api/monitoring/metrics.py
# - api/routers/desktop_shell_config.py
# ---

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException, status

from api.monitoring import metrics
from api.routers import desktop_shell_config as shell_mod


def test_observe_desktop_shell_state_patch_conflict_increments() -> None:
    before = metrics.desktop_shell_state_patch_total.labels(result="conflict_412")._value.get()
    metrics.observe_desktop_shell_state_patch(result="conflict_412", duration_seconds=0.012)
    after = metrics.desktop_shell_state_patch_total.labels(result="conflict_412")._value.get()
    assert after == before + 1.0


def test_observe_desktop_shell_state_get_304_increments() -> None:
    before = metrics.desktop_shell_state_get_304_total._value.get()
    metrics.observe_desktop_shell_state_get_304()
    after = metrics.desktop_shell_state_get_304_total._value.get()
    assert after == before + 1.0


@pytest.mark.asyncio
async def test_patch_shell_state_conflict_412_increments_metric(monkeypatch: pytest.MonkeyPatch) -> None:
    before = metrics.desktop_shell_state_patch_total.labels(result="conflict_412")._value.get()

    class _Cfg:
        shell_state = {"recent_app_ids": ["app-a"]}

    async def _fake_lock(_db: object, _user_id: object) -> _Cfg:
        return _Cfg()

    monkeypatch.setattr(shell_mod, "_lock_desktop_config_row_for_update", _fake_lock)

    request = MagicMock()
    request.headers = {"if-match": '"stale-etag"'}
    response = MagicMock()
    response.headers = {}
    data = shell_mod.DesktopShellStatePatch(recent_app_ids=["app-b"])

    with pytest.raises(HTTPException) as exc_info:
        await shell_mod.patch_shell_state(
            data=data,
            request=request,
            response=response,
            current_user=MagicMock(),
            user_id=uuid4(),
            db=AsyncMock(),
            idempotency_key_header=None,
        )

    assert exc_info.value.status_code == status.HTTP_412_PRECONDITION_FAILED
    after = metrics.desktop_shell_state_patch_total.labels(result="conflict_412")._value.get()
    assert after == before + 1.0


@pytest.mark.asyncio
async def test_get_shell_state_304_increments_metric(monkeypatch: pytest.MonkeyPatch) -> None:
    before = metrics.desktop_shell_state_get_304_total._value.get()

    class _Cfg:
        shell_state = {"recent_app_ids": ["app-a"]}

    async def _fake_get_or_create(_db: object, _user_id: object) -> _Cfg:
        return _Cfg()

    monkeypatch.setattr(shell_mod, "_get_or_create_desktop_config_row", _fake_get_or_create)

    out = shell_mod._shell_state_to_out(shell_mod._normalize_shell_state(_Cfg.shell_state))
    etag = shell_mod._weak_etag_for_pydantic_model(out)

    request = MagicMock()
    request.headers = {"if-none-match": etag}
    response = MagicMock()
    response.headers = {}

    def _set_headers(_resp: object, _model: object) -> str:
        response.headers[shell_mod.SHELL_STATE_FIELD_ETAGS_HEADER] = "{}"
        return etag

    monkeypatch.setattr(shell_mod, "_set_shell_state_etag_headers", _set_headers)

    result = await shell_mod.get_shell_state(
        request=request,
        response=response,
        current_user=MagicMock(),
        user_id=uuid4(),
        db=AsyncMock(),
    )

    assert getattr(result, "status_code", None) == status.HTTP_304_NOT_MODIFIED
    after = metrics.desktop_shell_state_get_304_total._value.get()
    assert after == before + 1.0
