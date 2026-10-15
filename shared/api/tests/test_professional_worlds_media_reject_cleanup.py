# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Lightweight tests for optional UC cleanup when rejecting Professional Worlds enhancement outputs.
# Invariants:
# - No imports of heavy Unified Content internals; mocks only.
# Related:
# - api/services/professional_worlds/media_rejected_cleanup.py
# ---

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from api.services.professional_worlds.media_rejected_cleanup import (
    maybe_delete_rejected_enhancement_output,
    professional_media_reject_cleanup_enabled,
)


def test_professional_media_reject_cleanup_toggle(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PROFESSIONAL_MEDIA_REJECT_CLEANUP_ENABLED", "false")
    assert professional_media_reject_cleanup_enabled() is False
    monkeypatch.setenv("PROFESSIONAL_MEDIA_REJECT_CLEANUP_ENABLED", "1")
    assert professional_media_reject_cleanup_enabled() is True


@pytest.mark.anyio
async def test_maybe_delete_calls_content_service(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PROFESSIONAL_MEDIA_REJECT_CLEANUP_ENABLED", "1")
    user = SimpleNamespace(id="11111111-1111-1111-1111-111111111111")
    cid = uuid4()
    svc = SimpleNamespace(delete_content=AsyncMock())
    await maybe_delete_rejected_enhancement_output(content_service=svc, user=user, output_content_id=cid)  # type: ignore[arg-type]
    svc.delete_content.assert_awaited_once_with(cid, user)


@pytest.mark.anyio
async def test_maybe_delete_noop_when_no_output(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PROFESSIONAL_MEDIA_REJECT_CLEANUP_ENABLED", "1")
    svc = SimpleNamespace(delete_content=AsyncMock())
    await maybe_delete_rejected_enhancement_output(content_service=svc, user=SimpleNamespace(), output_content_id=None)
    svc.delete_content.assert_not_called()
