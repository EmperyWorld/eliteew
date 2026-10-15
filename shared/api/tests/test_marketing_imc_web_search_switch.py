# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Marketing cabinet IMC / shared web-search helper contract tests.
# Invariants:
# - Live web search runs only when use_web_search=true and user/db context exists.
# Related:
# - api.services.ugs.providers.imc_rag_research_provider
# - api.services.marketing_web_search_context
# ---

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from api.services.marketing_web_search_context import (
    build_ewrp_web_search_queries,
    build_imc_web_search_queries,
    build_imc_web_search_query,
    is_imc_boilerplate_research_text,
    resolve_marketing_web_search_context,
)
from api.services.marketing_web_search_quality import normalize_web_search_quality
from api.services.ugs.providers.imc_rag_research_provider import build_rag_research_prompt


@pytest.mark.asyncio
async def test_resolve_marketing_web_search_context_skips_without_flag() -> None:
    with patch(
        "api.services.marketing_web_search_context.web_search",
        new=AsyncMock(side_effect=AssertionError("web_search must not run without flag")),
    ):
        out = await resolve_marketing_web_search_context(
            query="Brand Analytics reputation tools",
            use_web_search=False,
            user_id="user-1",
            db=object(),
        )
    assert out == ""


@pytest.mark.asyncio
async def test_resolve_marketing_web_search_context_formats_hits() -> None:
    fake_hits = [{"title": "YouScan", "url": "https://youscan.io", "content": "Vision analytics"}]

    async def _fake_web_search(*_args, **_kwargs):  # noqa: ANN002, ANN003
        return fake_hits

    with patch("api.services.marketing_web_search_context.web_search", new=_fake_web_search):
        out = await resolve_marketing_web_search_context(
            query="Brand Analytics YouScan monitoring tools Russia",
            use_web_search=True,
            user_id="user-1",
            db=object(),
        )
    assert "YouScan" in out
    assert "youscan.io" in out


def test_build_imc_web_search_query_uses_project_not_boilerplate() -> None:
    boilerplate = (
        "Маркетинговое исследование по выбранному проекту. Опирайся только на переданные фрагменты документов проекта"
    )
    assert is_imc_boilerplate_research_text(boilerplate) is True
    q = build_imc_web_search_query(
        imc_type_key="imc_rag_competitive",
        project_name="Селёдка",
        company_name="Улов16",
        industry="рыболовство",
        project_description="Добыча сельди, консервация, Японское море",
        brief=boilerplate,
    )
    assert "Улов16" in q
    assert "Селёдка" in q
    assert "конкуренты" in q
    assert "опирайся только" not in q.casefold()


def test_build_rag_research_prompt_competitive_web_overrides() -> None:
    prompt = build_rag_research_prompt(
        "brief",
        prompt_instructions="ИНВАРИАНТЫ: только контекст; без веба; запрещён веб-поиск.",
        project_document_rag="fragment=1 label=brief …",
        imc_type_key="imc_rag_competitive",
        web_context="- [RBC](https://example.com) консервы сельди",
    )
    assert "игнорируй в методологии типа" in prompt
    assert "imc_rag_competitive" in prompt
    assert "конкурент" in prompt.casefold()
    assert "RBC" in prompt

    web = "## Web results\n- [Example](https://example.com) snippet"
    prompt = build_rag_research_prompt(
        "market monitoring tools",
        prompt_instructions=None,
        project_document_rag="fragment=1 label=brief …",
        imc_type_key="imc_rag_deep_market_showcase",
        web_context=web,
    )
    assert "Срез из веб-поиска" in prompt
    assert "Example" in prompt
    assert "fragment=1" in prompt


def test_normalize_web_search_quality_legacy_flag() -> None:
    assert normalize_web_search_quality(use_web_search=True) == "standard"
    assert normalize_web_search_quality("deep") == "deep"
    assert normalize_web_search_quality("off") == "off"


def test_build_imc_web_search_queries_respects_quality_tier() -> None:
    base = dict(
        imc_type_key="imc_rag_competitive",
        project_name="Селёдка",
        company_name="Улов16",
        industry="рыболовство",
    )
    assert len(build_imc_web_search_queries(quality="light", **base)) == 1
    assert len(build_imc_web_search_queries(quality="standard", **base)) == 2
    assert len(build_imc_web_search_queries(quality="deep", **base)) == 3
    assert build_imc_web_search_queries(quality="off", **base) == []


def test_build_ewrp_web_search_queries_from_topic() -> None:
    queries = build_ewrp_web_search_queries(
        topic="Рынок консервированной сельди в РФ",
        title="Улов16",
        extra_context=None,
        quality="standard",
    )
    assert len(queries) == 2
    joined = " ".join(queries).casefold()
    assert "улов16" in joined or "сельд" in joined
