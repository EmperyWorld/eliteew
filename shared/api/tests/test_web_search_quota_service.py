# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for web search quota calculations and user-facing denial messages.
# Invariants:
# - No live PostgreSQL; DB consume flow covered indirectly via search_service tests.
# Related:
# - api/services/web_search_quota_service.py
# ---

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from api.services.web_search_quota_service import (
    WebSearchQuotaStatus,
    _monthly_limit_for_user,
    format_quota_denied_user_message,
)


@pytest.mark.asyncio
async def test_monthly_limit_uses_platform_default(monkeypatch) -> None:
    monkeypatch.setattr(
        "api.services.web_search_quota_service.resolve_effective_search_runtime_config",
        AsyncMock(return_value=SimpleNamespace(monthly_free_default=50)),
    )
    user = SimpleNamespace(web_search_monthly_limit=None)
    assert await _monthly_limit_for_user(object(), user) == 50


@pytest.mark.asyncio
async def test_monthly_limit_user_override(monkeypatch) -> None:
    monkeypatch.setattr(
        "api.services.web_search_quota_service.resolve_effective_search_runtime_config",
        AsyncMock(return_value=SimpleNamespace(monthly_free_default=50)),
    )
    user = SimpleNamespace(web_search_monthly_limit=120)
    assert await _monthly_limit_for_user(object(), user) == 120


def test_format_quota_denied_user_message_ru() -> None:
    msg = format_quota_denied_user_message(
        WebSearchQuotaStatus(
            user_id="u1",
            monthly_limit=50,
            monthly_used=50,
            monthly_remaining=0,
            coins=0,
            total_remaining=0,
            period_month=__import__("datetime").date(2026, 6, 1),
        )
    )
    assert "50/50" in msg
    assert "монет" in msg
