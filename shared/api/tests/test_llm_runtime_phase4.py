# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Phase 4 contract locks: deep client gate, inflight semaphore, no interactive fallback.
# Invariants:
# - No live HTTP to ``.136``; monkeypatch / AsyncMock only.
# Related:
# - documentation/platform/LLM-MEMORY-RUNTIME-REDESIGN-DECISION.md Phase 4
# ---
"""Tests: Phase 4 deep LLM client + companion hop gate."""

from __future__ import annotations

from collections.abc import Iterator
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.services.llm_runtime.deep_client import (
    DeepLlmUnavailableError,
    deep_chat_completion,
    deep_llm_enabled,
    llama_deep_max_inflight,
    reset_deep_llm_inflight_for_tests,
    resolve_deep_base_url,
)
from api.services.llm_runtime.job_class import resolve_llm_base_url


@pytest.fixture(autouse=True)
def reset_deep_sem() -> Iterator[None]:
    reset_deep_llm_inflight_for_tests()
    yield
    reset_deep_llm_inflight_for_tests()


@pytest.mark.unit
def test_deep_llm_enabled_default_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_DEEP_LLM_ENABLED", raising=False)
    assert deep_llm_enabled() is False
    monkeypatch.setenv("EWA_DEEP_LLM_ENABLED", "1")
    assert deep_llm_enabled() is True


@pytest.mark.unit
def test_llama_deep_max_inflight_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("LLAMA_DEEP_MAX_INFLIGHT", raising=False)
    assert llama_deep_max_inflight() == 1
    monkeypatch.setenv("LLAMA_DEEP_MAX_INFLIGHT", "3")
    assert llama_deep_max_inflight() == 3


@pytest.mark.unit
def test_resolve_deep_no_interactive_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("LLAMA_DEEP_URL", raising=False)
    with pytest.raises(DeepLlmUnavailableError):
        resolve_deep_base_url()
    interactive = resolve_llm_base_url(job_class="interactive")
    assert interactive  # interactive still resolvable
    monkeypatch.setenv("LLAMA_DEEP_URL", "http://192.168.1.136:8080/")
    assert resolve_deep_base_url() == "http://192.168.1.136:8080"
    assert resolve_llm_base_url(job_class="interactive") == interactive


@pytest.mark.unit
@pytest.mark.asyncio
async def test_deep_chat_completion_uses_deep_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLAMA_DEEP_URL", "http://192.168.1.136:8080")
    captured: dict[str, str] = {}

    async def _fake_completion(client, base_url, **kwargs):  # noqa: ANN001
        captured["base_url"] = base_url
        return {"response": "note"}

    monkeypatch.setattr(
        "api.services.llm_runtime.deep_client.httpx_compat_chat_completion_json",
        _fake_completion,
    )
    client = MagicMock()
    data = await deep_chat_completion(
        client,
        messages=[{"role": "user", "content": "x"}],
        reason="test",
    )
    assert data["response"] == "note"
    assert captured["base_url"] == "http://192.168.1.136:8080"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_companion_deep_hop_skipped_when_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.companion.turn.phases.deep_research_hop import (
        maybe_run_companion_deep_research_hop,
    )

    monkeypatch.setenv("EWA_DEEP_LLM_ENABLED", "0")
    monkeypatch.setenv("LLAMA_DEEP_URL", "http://192.168.1.136:8080")
    called = AsyncMock()
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.deep_research_hop.deep_chat_completion",
        called,
    )
    out = await maybe_run_companion_deep_research_hop(
        MagicMock(),
        user_line="q",
        answer_text="a",
        principal_id="p1",
        skip_heavy_steps=False,
    )
    assert out is None
    called.assert_not_awaited()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_companion_deep_hop_calls_deep_when_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.companion.turn.phases.deep_research_hop import (
        maybe_run_companion_deep_research_hop,
    )

    monkeypatch.setenv("EWA_DEEP_LLM_ENABLED", "1")
    monkeypatch.setenv("LLAMA_DEEP_URL", "http://192.168.1.136:8080")
    persist = AsyncMock(return_value={"id": "ep1"})

    async def _fake(client, **kwargs):  # noqa: ANN001
        return {"response": "research note"}

    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.deep_research_hop.deep_chat_completion",
        _fake,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.deep_research_hop.episode_insert",
        persist,
    )
    pool = MagicMock()
    out = await maybe_run_companion_deep_research_hop(
        MagicMock(),
        user_line="research this",
        answer_text="short answer",
        principal_id="p1",
        skip_heavy_steps=False,
        pool=pool,
    )
    assert out == "research note"
    persist.assert_awaited_once()
    persist_call = persist.await_args
    assert persist_call is not None
    assert persist_call.kwargs["kind"] == "deep_research"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_companion_deep_hop_degrades_when_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.companion.turn.phases.deep_research_hop import (
        maybe_run_companion_deep_research_hop,
    )

    monkeypatch.setenv("EWA_DEEP_LLM_ENABLED", "1")
    monkeypatch.setenv("LLAMA_DEEP_URL", "http://192.168.1.136:8080")

    async def _boom(*_a, **_k):  # noqa: ANN001
        raise DeepLlmUnavailableError("unset")

    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.deep_research_hop.deep_chat_completion",
        _boom,
    )
    out = await maybe_run_companion_deep_research_hop(
        MagicMock(),
        user_line="q",
        answer_text="a",
        principal_id="p1",
        skip_heavy_steps=False,
    )
    assert out is None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_companion_deep_hop_degrades_on_http_error(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.companion.turn.phases.deep_research_hop import (
        maybe_run_companion_deep_research_hop,
    )

    monkeypatch.setenv("EWA_DEEP_LLM_ENABLED", "1")
    monkeypatch.setenv("LLAMA_DEEP_URL", "http://192.168.1.136:8080")

    async def _boom(*_a, **_k):  # noqa: ANN001
        raise RuntimeError("connection reset")

    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.deep_research_hop.deep_chat_completion",
        _boom,
    )
    out = await maybe_run_companion_deep_research_hop(
        MagicMock(),
        user_line="q",
        answer_text="a",
        principal_id="p1",
        skip_heavy_steps=False,
    )
    assert out is None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_companion_deep_hop_skipped_on_heavy_skip(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.companion.turn.phases.deep_research_hop import (
        maybe_run_companion_deep_research_hop,
    )

    monkeypatch.setenv("EWA_DEEP_LLM_ENABLED", "1")
    called = AsyncMock()
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.deep_research_hop.deep_chat_completion",
        called,
    )
    out = await maybe_run_companion_deep_research_hop(
        MagicMock(),
        user_line="q",
        answer_text="a",
        principal_id="p1",
        skip_heavy_steps=True,
    )
    assert out is None
    called.assert_not_awaited()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_deep_inflight_semaphore_serializes(monkeypatch: pytest.MonkeyPatch) -> None:
    import asyncio

    monkeypatch.setenv("LLAMA_DEEP_URL", "http://192.168.1.136:8080")
    monkeypatch.setenv("LLAMA_DEEP_MAX_INFLIGHT", "1")
    reset_deep_llm_inflight_for_tests()
    inflight = 0
    peak = 0

    async def _fake(client, base_url, **kwargs):  # noqa: ANN001
        nonlocal inflight, peak
        inflight += 1
        peak = max(peak, inflight)
        await asyncio.sleep(0.05)
        inflight -= 1
        return {"response": "ok"}

    monkeypatch.setattr(
        "api.services.llm_runtime.deep_client.httpx_compat_chat_completion_json",
        _fake,
    )
    client = MagicMock()
    await asyncio.gather(
        deep_chat_completion(client, messages=[{"role": "user", "content": "a"}]),
        deep_chat_completion(client, messages=[{"role": "user", "content": "b"}]),
    )
    assert peak == 1
