# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Companion per-turn web search attaches honest status payloads (ok/empty/error/quota/skipped)
# plus history-aware query, chit-chat skip, and optional top-URL enrich.
# Related:
# - api/ewa_platform/companion/turn/web_search_prefetch.py
# - api/ewa_platform/companion/turn/chat_turn.py
# ---

from __future__ import annotations

from datetime import date
from typing import Any
from unittest.mock import AsyncMock

import pytest

from api.ewa_platform.companion.turn import web_search_prefetch as wsp
from api.ewa_platform.companion.turn.phases.turn_entry import TurnMessageContext
from api.services.search_service import WebSearchCallResult, WebSearchQuotaExceededError
from api.services.web_search_quota_service import WebSearchQuotaStatus


def _msg(user_line: str = "новости владивосток") -> TurnMessageContext:
    return TurnMessageContext(
        shell_norm={"schema_version": 1, "windows": []},
        user_line=user_line,
        vision_data_url=None,
        has_image_attachment=False,
        image_ocr_context=None,
    )


def _require_shell(out: TurnMessageContext) -> dict[str, Any]:
    shell = out.shell_norm
    assert shell is not None
    return shell


@pytest.mark.asyncio
async def test_companion_web_search_skipped_without_context() -> None:
    out = await wsp.append_companion_web_search_context(
        _msg(),
        use_web_search=True,
        web_search_db=None,
        content_catalog_user_id=None,
    )
    shell = _require_shell(out)
    result = shell["web_search_result"]
    assert result["status"] == "skipped"
    assert result["error_code"] == "missing_context"
    assert "web_search_context" not in shell


@pytest.mark.asyncio
async def test_companion_web_search_skipped_trivial_chit_chat() -> None:
    out = await wsp.append_companion_web_search_context(
        _msg("привет"),
        use_web_search=True,
        web_search_db=object(),
        content_catalog_user_id="11111111-1111-1111-1111-111111111111",
    )
    shell = _require_shell(out)
    result = shell["web_search_result"]
    assert result["status"] == "skipped"
    assert result["error_code"] == "trivial_chit_chat"
    assert "web_search_context" not in shell


@pytest.mark.asyncio
async def test_companion_web_search_uses_history_for_followup(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, Any] = {}

    async def _capture(query: str, *args: Any, **kwargs: Any) -> WebSearchCallResult:
        captured["query"] = query
        return WebSearchCallResult(
            hits=[{"title": "T", "url": "https://ex.test", "content": "snippet"}],
            status="ok",
            latency_ms=40,
        )

    monkeypatch.setattr(wsp, "web_search_detailed", _capture)
    monkeypatch.setattr(wsp, "companion_web_search_fetch_top_enabled", lambda: False)
    recent = [
        {"role": "user", "content": "погода во владивостоке"},
        {"role": "assistant", "content": "сейчас смотрю"},
        {"role": "user", "content": "поищи ещё"},
    ]
    out = await wsp.append_companion_web_search_context(
        _msg("поищи ещё"),
        use_web_search=True,
        web_search_db=object(),
        content_catalog_user_id="11111111-1111-1111-1111-111111111111",
        recent_messages=recent,
    )
    shell = _require_shell(out)
    assert shell["web_search_result"]["status"] == "ok"
    assert "владивосток" in str(captured.get("query") or "").lower()


@pytest.mark.asyncio
async def test_companion_web_search_meta_clarification_uses_history(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}

    async def _capture(query: str, *args: Any, **kwargs: Any) -> WebSearchCallResult:
        captured["query"] = query
        return WebSearchCallResult(
            hits=[{"title": "T", "url": "https://ex.test", "content": "snippet"}],
            status="ok",
            latency_ms=40,
        )

    monkeypatch.setattr(wsp, "web_search_detailed", _capture)
    monkeypatch.setattr(wsp, "companion_web_search_fetch_top_enabled", lambda: False)
    recent = [
        {
            "role": "user",
            "content": "мировые практики AI-оркестраторов и инструменты сильных игроков",
        },
        {"role": "assistant", "content": "черновик"},
        {"role": "user", "content": "нужна точность и конкретика"},
    ]
    out = await wsp.append_companion_web_search_context(
        _msg("нужна точность и конкретика"),
        use_web_search=True,
        web_search_db=object(),
        content_catalog_user_id="11111111-1111-1111-1111-111111111111",
        recent_messages=recent,
    )
    shell = _require_shell(out)
    assert shell["web_search_result"]["status"] == "ok"
    q = str(captured.get("query") or "").lower()
    assert "оркестратор" in q or "практик" in q
    assert "точность" not in q


@pytest.mark.asyncio
async def test_companion_web_search_skipped_ambiguous_query() -> None:
    out = await wsp.append_companion_web_search_context(
        _msg("нужна точность и конкретика"),
        use_web_search=True,
        web_search_db=object(),
        content_catalog_user_id="11111111-1111-1111-1111-111111111111",
        recent_messages=[{"role": "user", "content": "нужна точность и конкретика"}],
    )
    shell = _require_shell(out)
    result = shell["web_search_result"]
    assert result["status"] == "skipped"
    assert result["error_code"] == "ambiguous_query"
    assert "web_search_context" not in shell


@pytest.mark.asyncio
async def test_companion_web_search_ok_attaches_prompt(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        wsp,
        "web_search_detailed",
        AsyncMock(
            return_value=WebSearchCallResult(
                hits=[{"title": "T", "url": "https://ex.test", "content": "snippet"}],
                status="ok",
                latency_ms=120,
            )
        ),
    )
    monkeypatch.setattr(wsp, "companion_web_search_fetch_top_enabled", lambda: False)
    out = await wsp.append_companion_web_search_context(
        _msg(),
        use_web_search=True,
        web_search_db=object(),
        content_catalog_user_id="11111111-1111-1111-1111-111111111111",
    )
    shell = _require_shell(out)
    result = shell["web_search_result"]
    assert result["status"] == "ok"
    assert result["result_count"] == 1
    assert "web_search_context" in shell


@pytest.mark.asyncio
async def test_companion_web_search_top_fetch_enriches_prompt(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        wsp,
        "web_search_detailed",
        AsyncMock(
            return_value=WebSearchCallResult(
                hits=[{"title": "T", "url": "https://ex.test/page", "content": "snippet"}],
                status="ok",
                latency_ms=10,
            )
        ),
    )
    monkeypatch.setattr(wsp, "companion_web_search_fetch_top_enabled", lambda: True)
    monkeypatch.setattr(wsp, "companion_web_search_budget_sec", lambda: 15.0)

    async def _fake_fetch(*_a: Any, **_k: Any) -> str:
        return "полный текст страницы про владивосток и афишу"

    monkeypatch.setattr(
        "api.services.desktop_chat.tools.fetch_url.run_fetch_url",
        _fake_fetch,
    )
    out = await wsp.append_companion_web_search_context(
        _msg(),
        use_web_search=True,
        web_search_db=object(),
        content_catalog_user_id="11111111-1111-1111-1111-111111111111",
    )
    shell = _require_shell(out)
    assert shell["web_search_result"]["status"] == "ok"
    assert "page excerpt" in shell["web_search_context"]


@pytest.mark.asyncio
async def test_companion_web_search_quota_status(monkeypatch: pytest.MonkeyPatch) -> None:
    status = WebSearchQuotaStatus(
        user_id="11111111-1111-1111-1111-111111111111",
        monthly_limit=10,
        monthly_used=10,
        monthly_remaining=0,
        coins=0,
        total_remaining=0,
        period_month=date(2026, 7, 1),
    )
    monkeypatch.setattr(
        wsp,
        "web_search_detailed",
        AsyncMock(side_effect=WebSearchQuotaExceededError(status)),
    )
    out = await wsp.append_companion_web_search_context(
        _msg(),
        use_web_search=True,
        web_search_db=object(),
        content_catalog_user_id="11111111-1111-1111-1111-111111111111",
    )
    shell = _require_shell(out)
    result = shell["web_search_result"]
    assert result["status"] == "quota"
    assert result["error_code"] == "quota_exceeded"
    assert "web_search_context" not in shell


@pytest.mark.asyncio
async def test_companion_web_search_budget_exceeded(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _hang(*_a: Any, **_k: Any):
        import asyncio

        await asyncio.sleep(60)

    monkeypatch.setattr(wsp, "web_search_detailed", _hang)
    monkeypatch.setattr(wsp, "companion_web_search_budget_sec", lambda: 0.05)
    out = await wsp.append_companion_web_search_context(
        _msg(),
        use_web_search=True,
        web_search_db=object(),
        content_catalog_user_id="11111111-1111-1111-1111-111111111111",
    )
    shell = _require_shell(out)
    result = shell["web_search_result"]
    assert result["status"] == "error"
    assert result["error_code"] == "budget_exceeded"


@pytest.mark.asyncio
async def test_prefetch_companion_grounding_parallel_merge(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        wsp,
        "web_search_detailed",
        AsyncMock(
            return_value=WebSearchCallResult(
                hits=[{"title": "T", "url": "https://ex.test", "content": "snippet"}],
                status="ok",
                latency_ms=20,
            )
        ),
    )
    monkeypatch.setattr(wsp, "companion_web_search_fetch_top_enabled", lambda: False)
    monkeypatch.setattr(wsp, "load_kbsew_defaults_for_companion", AsyncMock(return_value={"x": 1}))

    async def _kbsew_block(**_k: Any) -> str:
        return "KBSEW_BLOCK"

    monkeypatch.setattr(
        "api.services.kbsew.kbsew_prefetch.prefetch_kbsew_prompt_block",
        _kbsew_block,
    )
    out = await wsp.prefetch_companion_grounding(
        _msg(),
        use_web_search=True,
        web_search_db=object(),
        content_catalog_user_id="11111111-1111-1111-1111-111111111111",
    )
    shell = _require_shell(out)
    assert shell["web_search_result"]["status"] == "ok"
    assert shell["kbsew_context"] == "KBSEW_BLOCK"
