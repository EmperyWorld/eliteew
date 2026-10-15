# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Tests Yandex web search retry on transient HTTP failures (429/502/503)
# and fail-fast on connect errors (egress/route).
# Related:
# - api/services/search_service.py
# ---

from __future__ import annotations

import base64
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from api.services import search_service as ss
from api.services.search_runtime_config_service import EffectiveSearchRuntimeConfig

YANDEX_XML_SAMPLE = """\
<yandexsearch><response><results><group><doc>
<url>https://example.com</url><title>Ok</title>
<passages><passage>content</passage></passages>
</doc></group></results></response></yandexsearch>
"""


def _runtime() -> EffectiveSearchRuntimeConfig:
    return EffectiveSearchRuntimeConfig(
        yandex_api_key="key",
        yandex_folder_id="folder",
        yandex_search_type="auto",
        yandex_search_l10n="auto",
        yandex_search_region="225",
        yandex_groups_on_page=5,
        cache_enabled=False,
        cache_ttl_sec=300,
        cache_empty_ttl_sec=60,
        quota_enforced=True,
        monthly_free_default=50,
        default_limit=8,
        surfaces={"desktop": True, "ewa": True, "marketing": True, "imperorg": True, "ugs": True},
        source="db",
        surface_enabled=True,
    )


@pytest.mark.asyncio
async def test_yandex_fetch_retries_429_then_succeeds(monkeypatch: pytest.MonkeyPatch) -> None:
    raw_b64 = base64.b64encode(YANDEX_XML_SAMPLE.encode()).decode()
    fail_resp = MagicMock()
    fail_resp.status_code = 429
    fail_resp.text = "rate limit"

    ok_resp = MagicMock()
    ok_resp.status_code = 200
    ok_resp.json = MagicMock(return_value={"rawData": raw_b64})

    client = MagicMock()
    client.post = AsyncMock(side_effect=[fail_resp, ok_resp])

    sleep = AsyncMock()
    monkeypatch.setattr(ss, "asyncio", MagicMock(sleep=sleep))
    monkeypatch.setattr(ss.random, "uniform", lambda _a, _b: 0)

    outcome = await ss._yandex_web_search_fetch_once(
        client,
        "python release",
        limit=3,
        runtime=_runtime(),
    )

    assert outcome.error_code is None
    assert len(outcome.hits) == 1
    assert client.post.await_count == 2
    sleep.assert_awaited()


@pytest.mark.asyncio
async def test_yandex_fetch_no_retry_on_401() -> None:
    resp = MagicMock()
    resp.status_code = 401
    resp.text = "unauthorized"

    client = MagicMock()
    client.post = AsyncMock(return_value=resp)

    outcome = await ss._yandex_web_search_fetch_once(
        client,
        "query",
        limit=3,
        runtime=_runtime(),
    )

    assert outcome.hits == []
    assert outcome.error_code == "credentials_invalid"
    client.post.assert_awaited_once()


@pytest.mark.asyncio
async def test_yandex_fetch_read_timeout_retries_then_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    client = MagicMock()
    client.post = AsyncMock(side_effect=httpx.ReadTimeout("timeout"))

    sleep = AsyncMock()
    monkeypatch.setattr(ss, "asyncio", MagicMock(sleep=sleep))
    monkeypatch.setattr(ss.random, "uniform", lambda _a, _b: 0)
    monkeypatch.setattr(ss, "MAX_YANDEX_RETRIES", 1)

    outcome = await ss._yandex_web_search_fetch_once(
        client,
        "query",
        limit=3,
        runtime=_runtime(),
    )

    assert outcome.error_code == "timeout"
    assert client.post.await_count == 2
    sleep.assert_awaited()


@pytest.mark.asyncio
async def test_yandex_fetch_connect_timeout_fails_fast(monkeypatch: pytest.MonkeyPatch) -> None:
    client = MagicMock()
    client.post = AsyncMock(side_effect=httpx.ConnectTimeout("connect timeout"))

    sleep = AsyncMock()
    monkeypatch.setattr(ss, "asyncio", MagicMock(sleep=sleep))
    monkeypatch.setattr(ss, "MAX_YANDEX_RETRIES", 2)

    outcome = await ss._yandex_web_search_fetch_once(
        client,
        "query",
        limit=3,
        runtime=_runtime(),
    )

    assert outcome.error_code == "connect_timeout"
    assert client.post.await_count == 1
    sleep.assert_not_awaited()


@pytest.mark.asyncio
async def test_yandex_fetch_connect_error_fails_fast(monkeypatch: pytest.MonkeyPatch) -> None:
    client = MagicMock()
    client.post = AsyncMock(side_effect=httpx.ConnectError("connection refused"))

    sleep = AsyncMock()
    monkeypatch.setattr(ss, "asyncio", MagicMock(sleep=sleep))
    monkeypatch.setattr(ss, "MAX_YANDEX_RETRIES", 2)

    outcome = await ss._yandex_web_search_fetch_once(
        client,
        "query",
        limit=3,
        runtime=_runtime(),
    )

    assert outcome.error_code == "connect_failed"
    assert client.post.await_count == 1
    sleep.assert_not_awaited()


@pytest.mark.asyncio
async def test_fetch_yandex_skips_com_retry_when_first_leg_slow(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    slow_empty = ss.YandexSearchOutcome(
        hits=[],
        error_code=None,
        http_status=200,
        latency_ms=ss.YANDEX_COM_RETRY_MAX_FIRST_LEG_MS + 1,
    )
    fetch_once = AsyncMock(return_value=slow_empty)
    monkeypatch.setattr(ss, "_yandex_web_search_fetch_once", fetch_once)
    monkeypatch.setattr(ss, "_yandex_credentials_configured", lambda **_: True)
    monkeypatch.setattr(ss, "get_httpx_client", lambda: MagicMock())
    monkeypatch.setattr(ss, "_yandex_search_type_for_query", lambda *_a, **_k: "SEARCH_TYPE_RU")
    monkeypatch.setattr(ss, "_filter_hits_by_query_overlap", lambda hits, *_a, **_k: hits)

    outcome = await ss.fetch_yandex_web_search("ставка ЦБ", limit=3, runtime=_runtime())

    assert outcome.hits == []
    assert fetch_once.await_count == 1
