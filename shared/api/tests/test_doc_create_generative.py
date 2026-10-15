# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression tests for generative companion doc_create (compose body via LLM, then confirmation task run).
# Invariants:
# - Natural-language «напиши в нём…» must not stop at need_body when compose is available.
# Related:
# - api/ewa_platform/companion/orchestration/flows/doc_create.py
# ---

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from api.ewa_platform.companion.orchestration import tool_registry as reg
from api.ewa_platform.companion.orchestration.flows.doc_create import (
    _doc_create_llm_runtime,
    compose_generative_doc_body_markdown,
    resolve_file_create_inputs,
    user_line_requests_generative_doc_body,
)


@pytest.mark.unit
def test_doc_create_llm_runtime_defaults_include_num_ctx(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_DOC_CREATE_NUM_PREDICT", raising=False)
    monkeypatch.delenv("EWA_COMPANION_DOC_CREATE_NUM_CTX", raising=False)
    monkeypatch.setenv("EWA_COMPANION_CHAT_NUM_CTX", "262144")
    _base, _model, num_predict, _timeout, num_ctx = _doc_create_llm_runtime()
    assert num_predict == 16384
    assert num_ctx == 262144


@pytest.mark.unit
def test_doc_create_compose_continues_until_minimum(monkeypatch: pytest.MonkeyPatch) -> None:
    responses = iter(
        [
            {"response": "# Title\n\n" + ("a" * 4_900), "finish_reason": "stop"},
            {"response": "## Continuation\n\n" + ("b" * 4_900), "finish_reason": "stop"},
        ]
    )

    async def fake_completion(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        return next(responses)

    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.flows.doc_create._doc_create_llm_runtime",
        lambda: ("http://llm.test", "test-model", 16_384, 30.0, 32_768),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.flows.doc_create._doc_create_output_limits",
        lambda **_kwargs: (8_000, 12_000, 2),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.flows.doc_create.httpx_compat_chat_completion_json",
        fake_completion,
    )

    body = asyncio.run(
        compose_generative_doc_body_markdown(
            user_line="Document request:\nWrite a detailed launch plan",
            principal_id="tester",
        )
    )
    assert body is not None
    assert len(body) >= 8_000
    assert "# Title" in body
    assert "## Continuation" in body


@pytest.mark.unit
def test_doc_create_compose_slice_returns_continue_draft(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_completion(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        return {"response": "# Title\n\n" + ("a" * 4_900), "finish_reason": "stop"}

    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.flows.doc_create._doc_create_llm_runtime",
        lambda: ("http://llm.test", "test-model", 16_384, 30.0, 32_768),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.flows.doc_create._doc_create_output_limits",
        lambda **_kwargs: (8_000, 12_000, 4),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.flows.doc_create.httpx_compat_chat_completion_json",
        fake_completion,
    )

    out = asyncio.run(
        compose_generative_doc_body_markdown(
            user_line="Document request:\nWrite a detailed launch plan",
            principal_id="tester",
            max_passes_this_slice=1,
        )
    )
    assert isinstance(out, dict)
    assert out.get("status") == "continue"
    draft = out.get("doc_create_draft_v1")
    assert isinstance(draft, dict)
    assert len(str(draft.get("body") or "")) >= 100
    assert int(draft.get("pass_index") or 0) == 1


@pytest.mark.unit
def test_doc_create_compose_rejects_body_below_minimum(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_completion(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        return {"response": "too short", "finish_reason": "stop"}

    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.flows.doc_create._doc_create_llm_runtime",
        lambda: ("http://llm.test", "test-model", 16_384, 30.0, 32_768),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.flows.doc_create._doc_create_output_limits",
        lambda **_kwargs: (8_000, 12_000, 2),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.flows.doc_create.httpx_compat_chat_completion_json",
        fake_completion,
    )

    body = asyncio.run(
        compose_generative_doc_body_markdown(
            user_line="Document request:\nWrite a detailed launch plan",
            principal_id="tester",
        )
    )
    assert body is None


@pytest.mark.unit
def test_user_line_poet_reflection_request_is_generative() -> None:
    line = "создай документ и напиши в нём всё что ты думаешь обо мне и о себе"
    assert user_line_requests_generative_doc_body(line) is True
    assert resolve_file_create_inputs(line, {}) == "generate_body"


@pytest.mark.unit
def test_create_document_about_topic_is_generative() -> None:
    line = "создай документ про бассейн и обслуживание"
    assert user_line_requests_generative_doc_body(line) is True
    assert resolve_file_create_inputs(line, {}) == "generate_body"


@pytest.mark.unit
def test_bare_create_document_without_topic_still_need_body() -> None:
    line = "создай документ"
    assert user_line_requests_generative_doc_body(line) is False
    assert resolve_file_create_inputs(line, {}) == "need_body"


@pytest.mark.unit
def test_literal_create_without_body_still_need_body() -> None:
    line = "создай файл notes.md"
    assert user_line_requests_generative_doc_body(line) is False
    assert resolve_file_create_inputs(line, {}) == "need_body"


@pytest.mark.unit
def test_structured_name_without_body_is_generate_body() -> None:
    line = "Создать регламент с учетом новых правил"
    assert resolve_file_create_inputs(line, {"name": "правила_работы.md"}) == "generate_body"


@pytest.mark.unit
def test_default_doc_create_filename_uses_context_and_timestamp() -> None:
    from datetime import datetime
    from zoneinfo import ZoneInfo

    from api.ewa_platform.companion.orchestration.flows.doc_create import (
        default_doc_create_filename,
        parse_doc_create_payload,
    )

    fixed = datetime(2026, 6, 9, 14, 30, tzinfo=ZoneInfo("UTC"))
    line = "создай документ про бассейн и обслуживание"
    name = default_doc_create_filename(line, now=fixed)
    assert name == "бассейн-обслуживание-09.06.14.30.md"

    payload = parse_doc_create_payload(line)
    assert payload is not None
    assert payload[0] == name


@pytest.mark.unit
def test_resolve_doc_create_filename_without_parse_match() -> None:
    from api.ewa_platform.companion.orchestration.flows.doc_create import (
        default_doc_create_filename,
        resolve_doc_create_filename,
    )

    line = "hello world"
    assert resolve_doc_create_filename(line, {}) == default_doc_create_filename(line)


@pytest.mark.unit
def test_file_create_generative_proposes_confirmation(monkeypatch: pytest.MonkeyPatch) -> None:
    created: list[dict[str, Any]] = []

    async def fake_compose(**_kwargs: Any) -> str:
        return "# Reflections\n\nHello poet."

    async def fake_run_create(*_a: Any, **kwargs: Any) -> dict[str, Any]:
        run = {"id": "run-gen", "status": kwargs["status"], "plan_payload": dict(kwargs["plan_payload"])}
        created.append(run)
        return run

    async def fake_step_create(*_a: Any, **_k: Any) -> dict[str, Any]:
        return {"id": "step-gen"}

    async def fake_run_update(*_a: Any, **kwargs: Any) -> dict[str, Any]:
        run = created[0] if created else {"id": "run-gen"}
        if "plan_payload" in kwargs:
            run = {**run, "plan_payload": dict(kwargs["plan_payload"])}
        if "status" in kwargs:
            run = {**run, "status": kwargs["status"]}
        if created:
            created[0] = run
        return run

    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.flows.doc_create.compose_generative_doc_body_markdown",
        fake_compose,
    )
    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_asyncpg.companion_task_run_create",
        fake_run_create,
    )
    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_asyncpg.companion_task_step_create",
        fake_step_create,
    )
    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_asyncpg.companion_task_run_update",
        fake_run_update,
    )

    line = "создай документ и напиши в нём всё что ты думаешь обо мне и о себе"
    ctx = reg.ToolContext(
        principal_id="tester",
        user_line=line,
        content_catalog_user_id="uc-1",
        oauth2_sub_for_content_alternate=None,
        companion_pool=object(),
    )
    out = asyncio.run(reg.dispatch_tool_by_name("file_create", {"user_line": line}, ctx))
    assert out is not None
    assert out.get("status") == "needs_confirm"
    assert created[0]["plan_payload"]["body"].startswith("# Reflections")
    assert "Подтверди" in str(out.get("reply") or "")
