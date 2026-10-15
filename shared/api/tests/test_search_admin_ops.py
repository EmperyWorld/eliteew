# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for search admin ops: meta, probe, test-search blockers, audit list.
# Related:
# - api/services/search_admin_ops_service.py
# - api/routers/desktop_admin_search_config.py
# ---

from __future__ import annotations

from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from api.services import search_admin_ops_service as ops
from api.services.web_search_quota_service import WebSearchQuotaExceededError, WebSearchQuotaStatus


@pytest.mark.asyncio
async def test_admin_run_test_search_blocked_when_surface_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    runtime = SimpleNamespace(
        surface_enabled=False,
        yandex_api_key="k",
        yandex_folder_id="f",
    )
    monkeypatch.setattr(
        ops,
        "resolve_effective_search_runtime_config",
        AsyncMock(return_value=runtime),
    )
    monkeypatch.setattr(ops, "resolve_web_search_provider", lambda *, runtime: "yandex")

    result = await ops.admin_run_test_search(
        object(),  # type: ignore[arg-type]
        actor_user_id=uuid4(),
        request=ops.AdminTestSearchRequest(
            query="test query",
            surface="desktop",
            limit=5,
            consume_quota=False,
            simulate_chat_query=False,
            user_id=None,
        ),
    )
    assert result["status"] == "blocked"
    assert "surface_disabled" in result["blockers"]


@pytest.mark.asyncio
async def test_admin_run_test_search_requires_user_for_quota() -> None:
    with pytest.raises(ValueError, match="user_id is required"):
        await ops.admin_run_test_search(
            object(),  # type: ignore[arg-type]
            actor_user_id=uuid4(),
            request=ops.AdminTestSearchRequest(
                query="q",
                surface=None,
                limit=5,
                consume_quota=True,
                simulate_chat_query=False,
                user_id=None,
            ),
        )


@pytest.mark.asyncio
async def test_admin_run_test_search_ok_with_hits(monkeypatch: pytest.MonkeyPatch) -> None:
    runtime = SimpleNamespace(
        surface_enabled=True,
        yandex_api_key="k",
        yandex_folder_id="f",
    )
    monkeypatch.setattr(
        ops,
        "resolve_effective_search_runtime_config",
        AsyncMock(return_value=runtime),
    )
    monkeypatch.setattr(ops, "resolve_web_search_provider", lambda *, runtime: "yandex")
    monkeypatch.setattr(
        ops,
        "web_search",
        AsyncMock(return_value=[{"title": "T", "content": "C", "url": "https://x"}]),
    )
    monkeypatch.setattr(ops, "format_search_results_for_prompt", lambda hits: "prompt-block")
    monkeypatch.setattr(ops, "assert_search_admin_test_rate_limit", lambda _actor: None)

    result = await ops.admin_run_test_search(
        object(),  # type: ignore[arg-type]
        actor_user_id=uuid4(),
        request=ops.AdminTestSearchRequest(
            query="hello",
            surface="desktop",
            limit=3,
            consume_quota=False,
            simulate_chat_query=False,
            user_id=None,
        ),
    )
    assert result["status"] == "ok"
    assert len(result["hits"]) == 1
    assert result["prompt_preview"] == "prompt-block"


@pytest.mark.asyncio
async def test_admin_run_test_search_quota_exceeded(monkeypatch: pytest.MonkeyPatch) -> None:
    runtime = SimpleNamespace(
        surface_enabled=True,
        yandex_api_key="k",
        yandex_folder_id="f",
    )
    uid = uuid4()
    monkeypatch.setattr(
        ops,
        "resolve_effective_search_runtime_config",
        AsyncMock(return_value=runtime),
    )
    monkeypatch.setattr(ops, "resolve_web_search_provider", lambda *, runtime: "yandex")
    monkeypatch.setattr(
        ops,
        "get_web_search_quota_status",
        AsyncMock(
            return_value=WebSearchQuotaStatus(
                user_id=str(uid),
                monthly_limit=10,
                monthly_used=10,
                monthly_remaining=0,
                coins=0,
                total_remaining=0,
                period_month=date(2026, 7, 1),
            )
        ),
    )

    async def _raise_quota(*_args, **_kwargs):
        raise WebSearchQuotaExceededError(
            WebSearchQuotaStatus(
                user_id=str(uid),
                monthly_limit=10,
                monthly_used=10,
                monthly_remaining=0,
                coins=0,
                total_remaining=0,
                period_month=date(2026, 7, 1),
            )
        )

    monkeypatch.setattr(ops, "web_search", _raise_quota)
    monkeypatch.setattr(ops, "assert_search_admin_test_rate_limit", lambda _actor: None)

    result = await ops.admin_run_test_search(
        object(),  # type: ignore[arg-type]
        actor_user_id=uuid4(),
        request=ops.AdminTestSearchRequest(
            query="hello",
            surface="desktop",
            limit=3,
            consume_quota=True,
            simulate_chat_query=False,
            user_id=uid,
        ),
    )
    assert result["status"] == "blocked"
    assert "quota_exceeded" in result["blockers"]


@pytest.mark.asyncio
async def test_probe_yandex_missing_credentials() -> None:
    runtime = SimpleNamespace(
        yandex_api_key="",
        yandex_folder_id="",
        yandex_search_type="auto",
        yandex_search_l10n="auto",
        yandex_search_region="225",
        yandex_groups_on_page=5,
    )
    result = await ops._probe_yandex(runtime=runtime, smoke_query="test")
    assert result.ok is False
    assert result.error_code == "missing_credentials"


def test_settings_diff_summary() -> None:
    changed = ops._settings_diff_summary({"a": 1, "b": 2}, {"a": 1, "b": 3})
    assert changed == ["b"]
