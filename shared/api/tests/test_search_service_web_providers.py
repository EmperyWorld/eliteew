# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for Yandex-only web_search routing and XML parsing.
# Invariants:
# - No live HTTP to Yandex in this module.
# Related:
# - api/services/search_service.py
# ---

from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from api.services import search_service as ss
from api.services.search_runtime_config_service import EffectiveSearchRuntimeConfig
from api.services.web_search_quota_service import WebSearchQuotaExceededError, WebSearchQuotaStatus

YANDEX_XML_SAMPLE = """\
<yandexsearch>
  <response>
    <results>
      <group>
        <doc>
          <url>https://example.com/rates</url>
          <title>Ключевая ставка</title>
          <passages><passage>Ставка 16%</passage></passages>
        </doc>
      </group>
    </results>
  </response>
</yandexsearch>
"""


def _runtime(
    *,
    quota_enforced: bool = True,
    surface_enabled: bool = True,
    yandex_api_key: str = "key",
    yandex_folder_id: str = "b1folder",
    cache_enabled: bool = False,
) -> EffectiveSearchRuntimeConfig:
    return EffectiveSearchRuntimeConfig(
        yandex_api_key=yandex_api_key,
        yandex_folder_id=yandex_folder_id,
        yandex_search_type="auto",
        yandex_search_l10n="auto",
        yandex_search_region="225",
        yandex_groups_on_page=5,
        cache_enabled=cache_enabled,
        cache_ttl_sec=300,
        cache_empty_ttl_sec=60,
        quota_enforced=quota_enforced,
        monthly_free_default=50,
        default_limit=8,
        surfaces={"desktop": True, "ewa": True, "marketing": True, "imperorg": True, "ugs": True},
        source="db",
        surface_enabled=surface_enabled,
        updated_by=None,
        updated_at_iso=None,
    )


def test_parse_yandex_web_search_xml_extracts_rows() -> None:
    rows = ss.parse_yandex_web_search_xml(YANDEX_XML_SAMPLE, limit=5)
    assert len(rows) == 1
    assert rows[0]["url"] == "https://example.com/rates"
    assert rows[0]["title"] == "Ключевая ставка"
    assert "16%" in rows[0]["content"]


def test_build_yandex_body_includes_max_passages_and_flat_groups() -> None:
    body = ss._build_yandex_web_search_body("цены электросамокаты Москва", limit=8, runtime=_runtime())
    assert body is not None
    assert body["maxPassages"] == 4
    assert body["groupSpec"]["groupMode"] == "GROUP_MODE_FLAT"
    assert body["groupSpec"]["docsInGroup"] == "1"
    assert "groupsOnPage" in body["groupSpec"]
    assert body["query"]["searchType"] == "SEARCH_TYPE_RU"


def test_resolve_web_search_provider_yandex_when_credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    runtime = _runtime()
    assert ss.resolve_web_search_provider(runtime=runtime) == "yandex"


def test_resolve_web_search_provider_none_without_credentials() -> None:
    runtime = _runtime(yandex_api_key="", yandex_folder_id="")
    assert ss.resolve_web_search_provider(runtime=runtime) is None


def test_yandex_search_type_auto_cyrillic() -> None:
    assert ss._yandex_search_type_for_query("ставка ЦБ", "auto") == "SEARCH_TYPE_RU"
    assert ss._yandex_search_type_for_query("python release", "auto") == "SEARCH_TYPE_COM"


@pytest.mark.asyncio
async def test_web_search_routes_yandex_and_parses_response(monkeypatch: pytest.MonkeyPatch) -> None:
    outcome = ss.YandexSearchOutcome(
        hits=ss.parse_yandex_web_search_xml(YANDEX_XML_SAMPLE, limit=5),
        error_code=None,
        http_status=200,
        latency_ms=10,
    )
    monkeypatch.setattr(ss, "resolve_effective_search_runtime_config", AsyncMock(return_value=_runtime()))
    monkeypatch.setattr(ss, "try_consume_web_search_quota", AsyncMock())
    monkeypatch.setattr(ss, "fetch_yandex_web_search", AsyncMock(return_value=outcome))
    monkeypatch.setattr(ss, "record_web_search_event", AsyncMock())

    rows = await ss.web_search("ставка ЦБ", limit=3, db=object())  # type: ignore[arg-type]
    assert len(rows) == 1
    assert rows[0]["title"] == "Ключевая ставка"


@pytest.mark.asyncio
async def test_web_search_quota_exhausted_blocks_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    user_id = uuid4()
    yandex = AsyncMock(return_value=ss.YandexSearchOutcome(hits=[], error_code=None, http_status=200, latency_ms=1))
    consume = AsyncMock()
    monkeypatch.setattr(ss, "resolve_effective_search_runtime_config", AsyncMock(return_value=_runtime()))
    monkeypatch.setattr(ss, "fetch_yandex_web_search", yandex)
    monkeypatch.setattr(ss, "try_consume_web_search_quota", consume)
    monkeypatch.setattr(ss, "record_web_search_event", AsyncMock())
    monkeypatch.setattr(
        ss,
        "get_web_search_quota_status",
        AsyncMock(
            return_value=WebSearchQuotaStatus(
                user_id=str(user_id),
                monthly_limit=50,
                monthly_used=50,
                monthly_remaining=0,
                coins=0,
                total_remaining=0,
                period_month=date(2026, 6, 1),
            )
        ),
    )
    with pytest.raises(WebSearchQuotaExceededError):
        await ss.web_search("ставка ЦБ", user_id=user_id, db=object())  # type: ignore[arg-type]

    yandex.assert_not_awaited()
    consume.assert_not_awaited()


@pytest.mark.asyncio
async def test_web_search_empty_does_not_consume_quota(monkeypatch: pytest.MonkeyPatch) -> None:
    user_id = uuid4()
    yandex = AsyncMock(return_value=ss.YandexSearchOutcome(hits=[], error_code=None, http_status=200, latency_ms=1))
    consume = AsyncMock()
    monkeypatch.setattr(ss, "resolve_effective_search_runtime_config", AsyncMock(return_value=_runtime()))
    monkeypatch.setattr(ss, "fetch_yandex_web_search", yandex)
    monkeypatch.setattr(ss, "try_consume_web_search_quota", consume)
    monkeypatch.setattr(ss, "record_web_search_event", AsyncMock())
    monkeypatch.setattr(
        ss,
        "get_web_search_quota_status",
        AsyncMock(
            return_value=WebSearchQuotaStatus(
                user_id=str(user_id),
                monthly_limit=50,
                monthly_used=1,
                monthly_remaining=49,
                coins=0,
                total_remaining=49,
                period_month=date(2026, 6, 1),
            )
        ),
    )
    assert await ss.web_search("ставка ЦБ", user_id=user_id, db=object()) == []  # type: ignore[arg-type]
    yandex.assert_awaited_once()
    consume.assert_not_awaited()


@pytest.mark.asyncio
async def test_web_search_hits_consume_quota_after_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    user_id = uuid4()
    hits = [{"title": "x", "content": "y", "url": "https://example.com"}]
    yandex = AsyncMock(return_value=ss.YandexSearchOutcome(hits=hits, error_code=None, http_status=200, latency_ms=1))
    consume = AsyncMock()
    monkeypatch.setattr(ss, "resolve_effective_search_runtime_config", AsyncMock(return_value=_runtime()))
    monkeypatch.setattr(ss, "fetch_yandex_web_search", yandex)
    monkeypatch.setattr(ss, "try_consume_web_search_quota", consume)
    monkeypatch.setattr(ss, "record_web_search_event", AsyncMock())
    monkeypatch.setattr(
        ss,
        "get_web_search_quota_status",
        AsyncMock(
            return_value=WebSearchQuotaStatus(
                user_id=str(user_id),
                monthly_limit=50,
                monthly_used=1,
                monthly_remaining=49,
                coins=0,
                total_remaining=49,
                period_month=date(2026, 6, 1),
            )
        ),
    )
    rows = await ss.web_search("ставка ЦБ", user_id=user_id, db=object())  # type: ignore[arg-type]

    assert rows == hits
    yandex.assert_awaited_once()
    consume.assert_awaited_once()


@pytest.mark.asyncio
async def test_web_search_skips_when_surface_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    yandex = AsyncMock()
    monkeypatch.setattr(
        ss,
        "resolve_effective_search_runtime_config",
        AsyncMock(return_value=_runtime(surface_enabled=False)),
    )
    monkeypatch.setattr(ss, "fetch_yandex_web_search", yandex)
    monkeypatch.setattr(ss, "record_web_search_event", AsyncMock())

    rows = await ss.web_search("ставка ЦБ", db=object(), surface="marketing")  # type: ignore[arg-type]

    assert rows == []
    yandex.assert_not_awaited()


@pytest.mark.asyncio
async def test_web_search_blocked_without_credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    yandex = AsyncMock()
    monkeypatch.setattr(
        ss,
        "resolve_effective_search_runtime_config",
        AsyncMock(return_value=_runtime(yandex_api_key="", yandex_folder_id="")),
    )
    monkeypatch.setattr(ss, "fetch_yandex_web_search", yandex)
    monkeypatch.setattr(ss, "record_web_search_event", AsyncMock())

    rows = await ss.web_search("hello", db=object())  # type: ignore[arg-type]

    assert rows == []
    yandex.assert_not_awaited()
