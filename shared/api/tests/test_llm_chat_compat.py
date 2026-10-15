# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for HTTP chat compatibility helpers (Llama vs OpenAI-compatible) and related provider wiring.
# Invariants:
# - Mock transports are deterministic; no live LLM calls.
# Related:
# - api/utils/llm_openai_compat_http.py
# ---
"""Tests for llama-server / Llama chat completion HTTP helpers and UGS LlamaProvider capabilities."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from api.utils.llm_openai_compat_http import (
    LLAMA_COMPAT_MAX_NUM_PREDICT,
    httpx_compat_chat_completion_json,
    httpx_compat_chat_completion_stream,
    httpx_compat_generate_json,
    invalidate_llm_backend_cache,
    max_tokens_from_llama_options,
    normalize_openai_tool_choice_for_llama_server,
    openai_compatible_chat_messages,
    pick_resolved_openai_model_id,
)


@pytest.mark.unit
def test_openai_compatible_chat_messages_filters_roles() -> None:
    out = openai_compatible_chat_messages(
        [
            {"role": "system", "content": "sys"},
            {"role": "tool", "content": "ignored"},
            {"role": "user", "content": "hi"},
        ]
    )
    assert [m["role"] for m in out] == ["system", "user"]
    assert out[1]["content"] == "hi"


@pytest.mark.unit
def test_openai_compatible_chat_messages_non_string_content() -> None:
    out = openai_compatible_chat_messages([{"role": "user", "content": 42}])
    assert out[0]["content"] == "42"


@pytest.mark.unit
def test_openai_compatible_chat_messages_empty_raises() -> None:
    with pytest.raises(ValueError, match="No supported chat messages"):
        openai_compatible_chat_messages([{"role": "tool", "content": "x"}])


@pytest.mark.unit
def test_pick_resolved_openai_model_id_strips_gguf() -> None:
    ids = ["vikhr-nemo-12b-instruct-r-21-09-24-q4_k_m"]
    want = "vikhr-nemo-12b-instruct-r-21-09-24-q4_k_m.gguf"
    assert pick_resolved_openai_model_id(want, ids) == ids[0]


@pytest.mark.unit
def test_pick_resolved_openai_model_id_basename_to_models_path() -> None:
    ids = ["/models/gemma-4-26B.gguf"]
    assert pick_resolved_openai_model_id("gemma-4-26B.gguf", ids) == ids[0]


@pytest.mark.unit
def test_pick_resolved_openai_model_id_local_sentinel_sole_model() -> None:
    ids = ["/models/gemma-4-26B.gguf"]
    assert pick_resolved_openai_model_id("local", ids) == ids[0]
    assert pick_resolved_openai_model_id("default", ids) == ids[0]


@pytest.mark.unit
def test_pick_resolved_openai_model_id_local_sentinel_multi_model() -> None:
    ids = ["/models/a.gguf", "/models/b.gguf"]
    assert pick_resolved_openai_model_id("local", ids) is None


@pytest.mark.unit
def test_max_tokens_from_llama_options_accepts_256k_class_cap() -> None:
    assert max_tokens_from_llama_options({"num_predict": LLAMA_COMPAT_MAX_NUM_PREDICT}) == LLAMA_COMPAT_MAX_NUM_PREDICT


@pytest.mark.unit
def test_max_tokens_from_llama_options_rejects_above_cap() -> None:
    d = 2048
    assert max_tokens_from_llama_options({"num_predict": LLAMA_COMPAT_MAX_NUM_PREDICT + 1}, default=d) == d


@pytest.mark.unit
def test_httpx_compat_chat_completion_json_openai_backend() -> None:
    invalidate_llm_backend_cache()

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/health":
            return httpx.Response(200, json={"status": "ok"})
        if request.method == "POST" and request.url.path == "/v1/chat/completions":
            body = json.loads(request.content.decode())
            assert body["model"] == "m.gguf"
            assert body["messages"] == [{"role": "user", "content": "yo"}]
            assert body["max_tokens"] == 100
            assert body["temperature"] == 0.5
            assert body["stream"] is False
            return httpx.Response(
                200,
                json={
                    "choices": [{"message": {"role": "assistant", "content": "Hi"}}],
                    "usage": {"prompt_tokens": 3, "completion_tokens": 4},
                },
            )
        return httpx.Response(404, text="unexpected " + request.url.path)

    transport = httpx.MockTransport(handler)

    async def _run() -> None:
        async with httpx.AsyncClient(transport=transport, base_url="http://llm-openai-test") as client:
            out = await httpx_compat_chat_completion_json(
                client,
                "http://llm-openai-test",
                model="m.gguf",
                messages=[{"role": "user", "content": "yo"}],
                options={"temperature": 0.5, "num_predict": 100},
            )
        assert out["response"] == "Hi"
        assert out["prompt_eval_count"] == 3
        assert out["eval_count"] == 4
        assert out["model"] == "m.gguf"

    asyncio.run(_run())


@pytest.mark.unit
def test_httpx_compat_generate_json_health_ok_skips_completions_probe() -> None:
    """llama-server ``/health`` ok → generate-json uses chat-completions without probing ``/v1/completions``."""

    invalidate_llm_backend_cache()
    calls = {"completions": 0, "chat": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/health":
            return httpx.Response(200, json={"status": "ok"})
        if request.method == "GET" and request.url.path == "/v1/models":
            return httpx.Response(200, json={"data": [{"id": "m.gguf"}]})
        if request.method == "POST" and request.url.path == "/v1/completions":
            calls["completions"] += 1
            return httpx.Response(
                200,
                json={
                    "choices": [{"text": ""}],
                    "usage": {"prompt_tokens": 3, "completion_tokens": 0},
                },
            )
        if request.method == "POST" and request.url.path == "/v1/chat/completions":
            calls["chat"] += 1
            return httpx.Response(
                200,
                json={
                    "choices": [{"message": {"role": "assistant", "content": '{"ok":true}'}}],
                    "usage": {"prompt_tokens": 3, "completion_tokens": 4},
                },
            )
        return httpx.Response(404, text=f"unexpected {request.url.path}")

    transport = httpx.MockTransport(handler)

    async def _run() -> None:
        async with httpx.AsyncClient(transport=transport, base_url="http://llm-openai-empty") as client:
            out1 = await httpx_compat_generate_json(
                client,
                "http://llm-openai-empty",
                model="m.gguf",
                prompt="hi",
                options={"num_predict": 64},
            )
            out2 = await httpx_compat_generate_json(
                client,
                "http://llm-openai-empty",
                model="m.gguf",
                prompt="again",
                options={"num_predict": 64},
            )
        assert out1["response"] == '{"ok":true}'
        assert out2["response"] == '{"ok":true}'

    asyncio.run(_run())
    assert calls["completions"] == 0
    assert calls["chat"] == 2


@pytest.mark.unit
def test_httpx_compat_generate_json_structured_skips_completions_probe() -> None:
    """json_format=True must use /v1/chat/completions directly (stack2 chat models reject completions)."""

    invalidate_llm_backend_cache()
    calls = {"completions": 0, "chat": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/health":
            return httpx.Response(200, json={"status": "ok"})
        if request.method == "GET" and request.url.path == "/v1/models":
            return httpx.Response(200, json={"data": [{"id": "m.gguf"}]})
        if request.method == "POST" and request.url.path == "/v1/completions":
            calls["completions"] += 1
            return httpx.Response(500, json={"error": {"message": "Failed to parse input at pos 0"}})
        if request.method == "POST" and request.url.path == "/v1/chat/completions":
            calls["chat"] += 1
            return httpx.Response(
                200,
                json={
                    "choices": [{"message": {"role": "assistant", "content": '{"items":[]}'}}],
                    "usage": {"prompt_tokens": 3, "completion_tokens": 4},
                },
            )
        return httpx.Response(404, text=f"unexpected {request.url.path}")

    transport = httpx.MockTransport(handler)

    async def _run() -> None:
        async with httpx.AsyncClient(transport=transport, base_url="http://llm-json-direct") as client:
            out = await httpx_compat_generate_json(
                client,
                "http://llm-json-direct",
                model="m.gguf",
                prompt="structured autofill prompt",
                options={"num_predict": 64},
                json_format=True,
            )
        assert out["response"] == '{"items":[]}'

    asyncio.run(_run())
    assert calls["completions"] == 0
    assert calls["chat"] == 1


@pytest.mark.unit
def test_httpx_compat_generate_json_plain_text_amka_skips_completions_on_health_ok() -> None:
    """Plain-text AMKA prose (``json_format=False``) must not probe ``/v1/completions`` on stack2 llama-server."""

    invalidate_llm_backend_cache()
    calls = {"completions": 0, "chat": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/health":
            return httpx.Response(200, json={"status": "ok"})
        if request.method == "GET" and request.url.path == "/v1/models":
            return httpx.Response(200, json={"data": [{"id": "m.gguf"}]})
        if request.method == "POST" and request.url.path == "/v1/completions":
            calls["completions"] += 1
            return httpx.Response(
                500,
                json={"error": {"message": "Failed to parse input at pos 0: \n\n*# AMKA notes"}},
            )
        if request.method == "POST" and request.url.path == "/v1/chat/completions":
            calls["chat"] += 1
            body = json.loads(request.content.decode())
            assert "## Итоговая сводка" in str(body["messages"][0]["content"])
            return httpx.Response(
                200,
                json={
                    "choices": [{"message": {"role": "assistant", "content": "Сводка готова."}}],
                    "usage": {"prompt_tokens": 100, "completion_tokens": 20},
                },
            )
        return httpx.Response(404, text=f"unexpected {request.url.path}")

    transport = httpx.MockTransport(handler)

    async def _run() -> None:
        async with httpx.AsyncClient(transport=transport, base_url="http://llm-amka-text") as client:
            out = await httpx_compat_generate_json(
                client,
                "http://llm-amka-text",
                model="m.gguf",
                prompt="## Итоговая сводка AMKA\n\n## Анализ выполнения плана",
                options={"num_predict": 512},
                json_format=False,
            )
        assert "Сводка" in out["response"]

    asyncio.run(_run())
    assert calls["completions"] == 0
    assert calls["chat"] == 1


@pytest.mark.unit
def test_httpx_compat_generate_json_prefers_chat_after_content_only_500() -> None:
    """Retry chat-completions when /v1/completions returns llama.cpp Content-only parser 500 (no /health shortcut)."""

    invalidate_llm_backend_cache()
    calls = {"completions": 0, "chat": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/health":
            return httpx.Response(404)
        if request.method == "GET" and request.url.path == "/api/tags":
            return httpx.Response(404)
        if request.method == "GET" and request.url.path == "/v1/models":
            return httpx.Response(200, json={"data": [{"id": "m.gguf"}]})
        if request.method == "POST" and request.url.path == "/v1/completions":
            calls["completions"] += 1
            return httpx.Response(
                500,
                json={
                    "error": {
                        "code": 500,
                        "message": "The model produced output that does not match the expected Content-only format",
                        "type": "server_error",
                    }
                },
            )
        if request.method == "POST" and request.url.path == "/v1/chat/completions":
            calls["chat"] += 1
            return httpx.Response(
                200,
                json={
                    "choices": [{"message": {"role": "assistant", "content": '{"ok":"chat-fallback"}'}}],
                    "usage": {"prompt_tokens": 3, "completion_tokens": 4},
                },
            )
        return httpx.Response(404, text=f"unexpected {request.url.path}")

    transport = httpx.MockTransport(handler)

    async def _run() -> None:
        async with httpx.AsyncClient(transport=transport, base_url="http://llm-openai-content-only-500") as client:
            out1 = await httpx_compat_generate_json(
                client,
                "http://llm-openai-content-only-500",
                model="m.gguf",
                prompt="hi",
                options={"num_predict": 64},
            )
            out2 = await httpx_compat_generate_json(
                client,
                "http://llm-openai-content-only-500",
                model="m.gguf",
                prompt="again",
                options={"num_predict": 64},
            )
        assert out1["response"] == '{"ok":"chat-fallback"}'
        assert out2["response"] == '{"ok":"chat-fallback"}'

    asyncio.run(_run())
    assert calls["completions"] == 1
    assert calls["chat"] == 2


@pytest.mark.unit
def test_httpx_compat_chat_completion_json_openai_llama_extras_and_timings() -> None:
    """OpenAI branch forwards llama-server fields and surfaces timings."""

    invalidate_llm_backend_cache()

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/health":
            return httpx.Response(200, json={"status": "ok"})
        if request.method == "POST" and request.url.path == "/v1/chat/completions":
            body = json.loads(request.content.decode())
            assert body["response_format"] == {"type": "json_object"}
            assert body["chat_template_kwargs"] == {"enable_thinking": False}
            assert body["frequency_penalty"] == 0.1
            assert body["stream"] is False
            return httpx.Response(
                200,
                json={
                    "choices": [{"message": {"role": "assistant", "content": "{}"}}],
                    "usage": {"prompt_tokens": 5, "completion_tokens": 6},
                    "timings": {"prompt_ms": 1.0, "predicted_ms": 2.0, "cache_n": 3},
                },
            )
        return httpx.Response(404, text="unexpected " + request.url.path)

    transport = httpx.MockTransport(handler)

    async def _run() -> None:
        async with httpx.AsyncClient(transport=transport, base_url="http://llm-openai-test") as client:
            out = await httpx_compat_chat_completion_json(
                client,
                "http://llm-openai-test",
                model="m.gguf",
                messages=[{"role": "user", "content": "yo"}],
                options={"temperature": 0.5, "num_predict": 100},
                response_format={"type": "json_object"},
                chat_template_kwargs={"enable_thinking": False},
                extra_params={"frequency_penalty": 0.1},
            )
        assert out["response"] == "{}"
        assert out["timings"] == {"prompt_ms": 1.0, "predicted_ms": 2.0, "cache_n": 3}

    asyncio.run(_run())


@pytest.mark.unit
def test_httpx_compat_chat_completion_json_openai_salvages_500_channel_lyrics() -> None:
    """Gemma stack2: llama-server HTTP 500 may embed generated lyrics after channel tokens."""

    invalidate_llm_backend_cache()
    inner = (
        "Failed to parse input at pos 13: <|channel>thought\n<|channel|>"
        "[Intro: Soft Piano, 75 BPM]\n(Voice: Calm)\nТекст куплета."
    )

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/health":
            return httpx.Response(200, json={"status": "ok"})
        if request.method == "POST" and request.url.path == "/v1/chat/completions":
            return httpx.Response(
                500,
                json={"error": {"code": 500, "message": inner}},
            )
        return httpx.Response(404, text="unexpected " + request.url.path)

    transport = httpx.MockTransport(handler)

    async def _run() -> None:
        async with httpx.AsyncClient(transport=transport, base_url="http://llm-openai-salvage-500") as client:
            out = await httpx_compat_chat_completion_json(
                client,
                "http://llm-openai-salvage-500",
                model="m.gguf",
                messages=[{"role": "user", "content": "write lyrics"}],
                options={"num_predict": 100},
            )
        assert out["finish_reason"] == "recovered_from_error"
        assert out["response"].startswith("[Intro:")
        assert "Текст куплета" in out["response"]

    asyncio.run(_run())


@pytest.mark.unit
def test_normalize_openai_tool_choice_for_llama_server() -> None:
    assert normalize_openai_tool_choice_for_llama_server("required") == "required"
    assert (
        normalize_openai_tool_choice_for_llama_server(
            {"type": "function", "function": {"name": "companion_route_turn"}}
        )
        == "companion_route_turn"
    )
    assert normalize_openai_tool_choice_for_llama_server({"type": "auto"}) == "auto"


@pytest.mark.unit
def test_httpx_compat_chat_completion_json_openai_tool_choice_string_for_llama() -> None:
    """llama.cpp rejects object-shaped tool_choice; HTTP layer coerces to string."""

    invalidate_llm_backend_cache()

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/health":
            return httpx.Response(200, json={"status": "ok"})
        if request.method == "POST" and request.url.path == "/v1/chat/completions":
            body = json.loads(request.content.decode())
            assert body["tool_choice"] == "companion_route_turn"
            return httpx.Response(
                200,
                json={
                    "choices": [
                        {
                            "message": {
                                "role": "assistant",
                                "tool_calls": [
                                    {
                                        "function": {
                                            "name": "companion_route_turn",
                                            "arguments": "{}",
                                        }
                                    }
                                ],
                            }
                        }
                    ],
                    "usage": {"prompt_tokens": 1, "completion_tokens": 1},
                },
            )
        return httpx.Response(404, text="unexpected " + request.url.path)

    transport = httpx.MockTransport(handler)

    async def _run() -> None:
        async with httpx.AsyncClient(transport=transport, base_url="http://llm-openai-test") as client:
            out = await httpx_compat_chat_completion_json(
                client,
                "http://llm-openai-test",
                model="m.gguf",
                messages=[{"role": "user", "content": "open app"}],
                extra_params={
                    "tools": [{"type": "function", "function": {"name": "companion_route_turn"}}],
                    "tool_choice": {
                        "type": "function",
                        "function": {"name": "companion_route_turn"},
                    },
                },
            )
        assert "tool_calls" in str(out.get("message", {}))

    asyncio.run(_run())


@pytest.mark.unit
def test_httpx_compat_chat_completion_json_llama_maps_response_format_to_native_format() -> None:
    """Native Llama maps OpenAI response_format to ``format``; never sends OpenAI-only keys."""

    invalidate_llm_backend_cache()

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/health":
            return httpx.Response(404)
        if request.method == "GET" and request.url.path == "/api/tags":
            return httpx.Response(200, json={"models": [{"name": "dummy", "size": 1}]})
        if request.method == "POST" and request.url.path == "/api/chat":
            body = json.loads(request.content.decode())
            assert body.get("format") == "json"
            assert "response_format" not in body
            assert "chat_template_kwargs" not in body
            assert "foo" not in body
            return httpx.Response(
                200,
                json={"message": {"role": "assistant", "content": "ok"}, "prompt_eval_count": 1, "eval_count": 2},
            )
        return httpx.Response(404, text="unexpected " + request.url.path)

    transport = httpx.MockTransport(handler)

    async def _run() -> None:
        async with httpx.AsyncClient(transport=transport, base_url="http://llm-llama-test") as client:
            out = await httpx_compat_chat_completion_json(
                client,
                "http://llm-llama-test",
                model="mistral",
                messages=[{"role": "user", "content": "hi"}],
                options={"num_predict": 50},
                response_format={"type": "json_object"},
                chat_template_kwargs={"enable_thinking": False},
                extra_params={"foo": "bar"},
            )
        assert out["response"] == "ok"
        assert "timings" not in out

    asyncio.run(_run())


@pytest.mark.unit
def test_stack2_llm_debug_save_writes_json_before_post(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """When STACK2_LLM_DEBUG_SAVE_DIR is set, request + paired response envelopes are written (no live LLM)."""

    monkeypatch.setenv("STACK2_LLM_DEBUG_SAVE_DIR", str(tmp_path))
    invalidate_llm_backend_cache()

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/health":
            return httpx.Response(200, json={"status": "ok"})
        if request.method == "POST" and request.url.path == "/v1/chat/completions":
            return httpx.Response(
                200,
                json={
                    "choices": [{"message": {"role": "assistant", "content": "Hi"}}],
                    "usage": {"prompt_tokens": 1, "completion_tokens": 1},
                },
            )
        return httpx.Response(404, text="unexpected " + request.url.path)

    transport = httpx.MockTransport(handler)

    async def _run() -> None:
        async with httpx.AsyncClient(transport=transport, base_url="http://llm-openai-test") as client:
            await httpx_compat_chat_completion_json(
                client,
                "http://llm-openai-test",
                model="m.gguf",
                messages=[{"role": "user", "content": "yo"}],
                options={"temperature": 0.5, "num_predict": 100},
            )

    asyncio.run(_run())

    saved = sorted(tmp_path.rglob("stack2_llm_*.json"))
    assert len(saved) == 2
    req_paths = [p for p in saved if "responses" not in p.parts]
    resp_paths = [p for p in saved if "responses" in p.parts]
    assert len(req_paths) == 1
    assert len(resp_paths) == 1
    req_data = json.loads(req_paths[0].read_text(encoding="utf-8"))
    resp_data = json.loads(resp_paths[0].read_text(encoding="utf-8"))
    stem = req_data["correlation_stem"]
    assert resp_data["correlation_stem"] == stem
    assert req_paths[0].name == f"{stem}.json"
    assert resp_paths[0].name == f"{stem}.json"
    assert req_data["path"] == "/v1/chat/completions"
    assert req_data["request_body"]["model"] == "m.gguf"
    assert req_data["request_body"]["messages"] == [{"role": "user", "content": "yo"}]
    assert resp_data["http_status"] == 200
    body = resp_data.get("response_body") or {}
    choices = body.get("choices") or []
    assert choices
    assert choices[0].get("message", {}).get("content") == "Hi"


@pytest.mark.unit
def test_httpx_compat_chat_completion_json_llama_backend() -> None:
    invalidate_llm_backend_cache()

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/health":
            return httpx.Response(404)
        if request.method == "GET" and request.url.path == "/api/tags":
            return httpx.Response(200, json={"models": [{"name": "dummy", "size": 1}]})
        if request.method == "POST" and request.url.path == "/api/chat":
            body = json.loads(request.content.decode())
            assert body["model"] == "mistral"
            assert body["stream"] is False
            assert body["messages"][0]["role"] == "user"
            return httpx.Response(
                200,
                json={
                    "message": {"role": "assistant", "content": "Llama hello"},
                    "prompt_eval_count": 10,
                    "eval_count": 20,
                },
            )
        return httpx.Response(404, text="unexpected " + request.url.path)

    transport = httpx.MockTransport(handler)

    async def _run() -> None:
        async with httpx.AsyncClient(transport=transport, base_url="http://llm-llama-test") as client:
            out = await httpx_compat_chat_completion_json(
                client,
                "http://llm-llama-test",
                model="mistral",
                messages=[{"role": "user", "content": "hi"}],
                options={"num_predict": 512, "temperature": 0.2},
                keep_alive="-1",
            )
        assert out["response"] == "Llama hello"
        assert out["prompt_eval_count"] == 10
        assert out["eval_count"] == 20

    asyncio.run(_run())


@pytest.mark.unit
def test_httpx_compat_chat_completion_json_llama_passes_num_ctx() -> None:
    invalidate_llm_backend_cache()

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/health":
            return httpx.Response(404)
        if request.method == "GET" and request.url.path == "/api/tags":
            return httpx.Response(200, json={"models": [{"name": "dummy", "size": 1}]})
        if request.method == "POST" and request.url.path == "/api/chat":
            body = json.loads(request.content.decode())
            opts = body.get("options") or {}
            assert opts.get("num_ctx") == 262144
            return httpx.Response(
                200,
                json={"message": {"role": "assistant", "content": "x"}, "prompt_eval_count": 1, "eval_count": 1},
            )
        return httpx.Response(404, text="unexpected " + request.url.path)

    transport = httpx.MockTransport(handler)

    async def _run() -> None:
        async with httpx.AsyncClient(transport=transport, base_url="http://llm-llama-ctx") as client:
            out = await httpx_compat_chat_completion_json(
                client,
                "http://llm-llama-ctx",
                model="mistral",
                messages=[{"role": "user", "content": "hi"}],
                options={"num_predict": 100, "temperature": 0.2, "num_ctx": 262144},
            )
        assert out["response"] == "x"

    asyncio.run(_run())


@pytest.mark.unit
def test_httpx_compat_chat_completion_json_openai_uses_reasoning_when_content_empty() -> None:
    """Non-stream: llama-server may put assistant text in ``message.reasoning_content`` (Gemma / CoT templates)."""

    invalidate_llm_backend_cache()

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/health":
            return httpx.Response(200, json={"status": "ok"})
        if request.method == "POST" and request.url.path == "/v1/chat/completions":
            return httpx.Response(
                200,
                json={
                    "choices": [
                        {
                            "message": {
                                "role": "assistant",
                                "content": "",
                                "reasoning_content": "Visible via reasoning_content field",
                            },
                        },
                    ],
                    "usage": {"prompt_tokens": 2, "completion_tokens": 5},
                },
            )
        return httpx.Response(404, text="unexpected " + request.url.path)

    transport = httpx.MockTransport(handler)

    async def _run() -> None:
        async with httpx.AsyncClient(transport=transport, base_url="http://llm-openai-reason") as client:
            out = await httpx_compat_chat_completion_json(
                client,
                "http://llm-openai-reason",
                model="m.gguf",
                messages=[{"role": "user", "content": "yo"}],
                options={"temperature": 0.5, "num_predict": 100},
            )
        assert out["response"] == "Visible via reasoning_content field"

    asyncio.run(_run())


@pytest.mark.unit
def test_httpx_compat_chat_completion_json_openai_respects_content_only_skips_reasoning() -> None:
    """Non-stream with ``openai_visible_assistant_content_only``: do not return reasoning as ``response``."""

    invalidate_llm_backend_cache()

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/health":
            return httpx.Response(200, json={"status": "ok"})
        if request.method == "POST" and request.url.path == "/v1/chat/completions":
            return httpx.Response(
                200,
                json={
                    "choices": [
                        {
                            "message": {
                                "role": "assistant",
                                "content": "",
                                "reasoning_content": "internal only",
                            },
                        },
                    ],
                    "usage": {"prompt_tokens": 2, "completion_tokens": 5},
                },
            )
        return httpx.Response(404, text="unexpected " + request.url.path)

    transport = httpx.MockTransport(handler)

    async def _run() -> None:
        async with httpx.AsyncClient(transport=transport, base_url="http://llm-openai-content-only") as client:
            out = await httpx_compat_chat_completion_json(
                client,
                "http://llm-openai-content-only",
                model="m.gguf",
                messages=[{"role": "user", "content": "yo"}],
                options={
                    "temperature": 0.5,
                    "num_predict": 100,
                    "openai_visible_assistant_content_only": True,
                },
            )
        assert out["response"] == ""

    asyncio.run(_run())


@pytest.mark.unit
def test_httpx_compat_chat_completion_json_openai_sidecar_merge_reasoning_overrides_content_only() -> None:
    """Empty ``content`` + ``content_only``: ``openai_sidecar_merge_reasoning`` still yields reasoning in ``response``."""

    invalidate_llm_backend_cache()

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/health":
            return httpx.Response(200, json={"status": "ok"})
        if request.method == "POST" and request.url.path == "/v1/chat/completions":
            return httpx.Response(
                200,
                json={
                    "choices": [
                        {
                            "message": {
                                "role": "assistant",
                                "content": "",
                                "reasoning_content": "internal only",
                            },
                        },
                    ],
                    "usage": {"prompt_tokens": 2, "completion_tokens": 5},
                },
            )
        return httpx.Response(404, text="unexpected " + request.url.path)

    transport = httpx.MockTransport(handler)

    async def _run() -> None:
        async with httpx.AsyncClient(transport=transport, base_url="http://llm-openai-sidecar-merge") as client:
            out = await httpx_compat_chat_completion_json(
                client,
                "http://llm-openai-sidecar-merge",
                model="m.gguf",
                messages=[{"role": "user", "content": "yo"}],
                options={
                    "temperature": 0.5,
                    "num_predict": 100,
                    "openai_visible_assistant_content_only": True,
                    "openai_sidecar_merge_reasoning": True,
                },
            )
        assert out["response"] == "internal only"

    asyncio.run(_run())


@pytest.mark.unit
def test_httpx_compat_chat_completion_stream_openai_reasoning_chunks() -> None:
    """Stream: empty ``delta.content`` but tokens in ``delta.reasoning_content`` (llama-server Gemma peg template)."""

    invalidate_llm_backend_cache()
    sse = 'data: {"choices":[{"index":0,"delta":{"reasoning_content":"Hello"}}]}\n\ndata: [DONE]\n\n'

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/health":
            return httpx.Response(200, json={"status": "ok"})
        if request.method == "GET" and request.url.path == "/v1/models":
            return httpx.Response(200, json={"data": [{"id": "m.gguf"}]})
        if request.method == "POST" and request.url.path == "/v1/chat/completions":
            return httpx.Response(200, content=sse.encode(), headers={"content-type": "text/event-stream"})
        return httpx.Response(404, text="unexpected " + request.url.path)

    transport = httpx.MockTransport(handler)

    async def _run() -> None:
        async with httpx.AsyncClient(transport=transport, base_url="http://llm-stream-reason") as client:
            parts: list[str] = []
            async for piece in httpx_compat_chat_completion_stream(
                client,
                "http://llm-stream-reason",
                model="m.gguf",
                messages=[{"role": "user", "content": "x"}],
                options={"num_predict": 50, "temperature": 0.5},
            ):
                parts.append(piece)
        assert "".join(parts) == "Hello"

    asyncio.run(_run())


@pytest.mark.unit
def test_httpx_compat_chat_completion_stream_openai_content_only_skips_reasoning() -> None:
    """Stream with ``openai_visible_assistant_content_only``: reasoning deltas must not be yielded."""

    invalidate_llm_backend_cache()
    sse = 'data: {"choices":[{"index":0,"delta":{"reasoning_content":"Secret"}}]}\n\ndata: [DONE]\n\n'

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/health":
            return httpx.Response(200, json={"status": "ok"})
        if request.method == "GET" and request.url.path == "/v1/models":
            return httpx.Response(200, json={"data": [{"id": "m.gguf"}]})
        if request.method == "POST" and request.url.path == "/v1/chat/completions":
            return httpx.Response(200, content=sse.encode(), headers={"content-type": "text/event-stream"})
        return httpx.Response(404, text="unexpected " + request.url.path)

    transport = httpx.MockTransport(handler)

    async def _run() -> None:
        async with httpx.AsyncClient(transport=transport, base_url="http://llm-stream-content-only") as client:
            parts: list[str] = []
            async for piece in httpx_compat_chat_completion_stream(
                client,
                "http://llm-stream-content-only",
                model="m.gguf",
                messages=[{"role": "user", "content": "x"}],
                options={
                    "num_predict": 50,
                    "temperature": 0.5,
                    "openai_visible_assistant_content_only": True,
                },
            ):
                parts.append(piece)
        assert parts == []

    asyncio.run(_run())


@pytest.mark.unit
def test_httpx_compat_chat_completion_stream_openai_forwards_template_kwargs() -> None:
    """Stream OpenAI path must forward Gemma 4 ``chat_template_kwargs`` + ``reasoning_format``."""

    invalidate_llm_backend_cache()
    sse = 'data: {"choices":[{"index":0,"delta":{"content":"Hi"}}]}\n\ndata: [DONE]\n\n'
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/health":
            return httpx.Response(200, json={"status": "ok"})
        if request.method == "GET" and request.url.path == "/v1/models":
            return httpx.Response(200, json={"data": [{"id": "m.gguf"}]})
        if request.method == "POST" and request.url.path == "/v1/chat/completions":
            body = json.loads(request.content.decode())
            seen["body"] = body
            return httpx.Response(200, content=sse.encode(), headers={"content-type": "text/event-stream"})
        return httpx.Response(404, text="unexpected " + request.url.path)

    transport = httpx.MockTransport(handler)

    async def _run() -> None:
        async with httpx.AsyncClient(transport=transport, base_url="http://llm-stream-tpl") as client:
            parts: list[str] = []
            async for piece in httpx_compat_chat_completion_stream(
                client,
                "http://llm-stream-tpl",
                model="m.gguf",
                messages=[{"role": "user", "content": "x"}],
                options={"num_predict": 50, "temperature": 0.5},
                chat_template_kwargs={"enable_thinking": False},
                extra_params={"reasoning_format": "none"},
            ):
                parts.append(piece)
        assert "".join(parts) == "Hi"

    asyncio.run(_run())
    assert seen["body"]["chat_template_kwargs"] == {"enable_thinking": False}
    assert seen["body"]["reasoning_format"] == "none"


@pytest.mark.unit
def test_llama_provider_get_capabilities_lists_id_when_no_name() -> None:
    from api.services.ugs.providers.llama_provider import LlamaProvider

    prov = LlamaProvider(base_url="http://noop")

    async def _run() -> None:
        with patch.object(
            LlamaProvider,
            "get_available_models",
            new=AsyncMock(return_value=[{"id": "model.gguf", "object": "model"}]),
        ):
            cap = await prov.get_capabilities()
        assert cap["models"] == ["model.gguf"]

    asyncio.run(_run())
