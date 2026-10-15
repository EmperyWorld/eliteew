# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests: OpenAI response_format / Pydantic JSON Schema map to native llama.cpp ``format``.
# Invariants:
# - json_object → format "json"; json_schema / raw schema → schema dict on native /api/chat and /api/generate.
# Related:
# - api/utils/llm_openai_compat_http.py
# - documentation/laama-cpp.md
# ---

from __future__ import annotations

import asyncio
import json

import httpx
import pytest

from api.utils.llm_openai_compat_http import (
    httpx_compat_chat_completion_json,
    httpx_compat_generate_json,
    invalidate_llm_backend_cache,
    llama_native_format_from_response_format,
)

_SAMPLE_SCHEMA = {
    "type": "object",
    "properties": {
        "speakers": {"type": "array", "items": {"type": "string"}},
        "delivery_mode": {"type": "string"},
    },
    "required": ["speakers"],
}


def test_llama_native_format_json_object() -> None:
    assert llama_native_format_from_response_format({"type": "json_object"}) == "json"


def test_llama_native_format_json_object_with_nested_schema() -> None:
    assert llama_native_format_from_response_format({"type": "json_object", "schema": _SAMPLE_SCHEMA}) == _SAMPLE_SCHEMA


def test_llama_native_format_json_schema_wrapper() -> None:
    assert llama_native_format_from_response_format({"type": "json_schema", "schema": _SAMPLE_SCHEMA}) == _SAMPLE_SCHEMA


def test_llama_native_format_openai_json_schema_nested() -> None:
    assert (
        llama_native_format_from_response_format(
            {
                "type": "json_schema",
                "json_schema": {"name": "plan", "schema": _SAMPLE_SCHEMA, "strict": True},
            }
        )
        == _SAMPLE_SCHEMA
    )


def test_llama_native_format_raw_pydantic_schema() -> None:
    assert llama_native_format_from_response_format(_SAMPLE_SCHEMA) == _SAMPLE_SCHEMA


def test_llama_native_format_string_json() -> None:
    assert llama_native_format_from_response_format("json") == "json"


@pytest.mark.unit
def test_httpx_chat_json_llama_native_schema_on_format_field() -> None:
    """Native /api/chat receives JSON Schema dict in ``format`` when response_format requests json_schema."""

    invalidate_llm_backend_cache()

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/health":
            return httpx.Response(404)
        if request.method == "GET" and request.url.path == "/api/tags":
            return httpx.Response(200, json={"models": [{"name": "m.gguf", "size": 1}]})
        if request.method == "POST" and request.url.path == "/api/chat":
            body = json.loads(request.content.decode())
            assert body.get("format") == _SAMPLE_SCHEMA
            assert "response_format" not in body
            return httpx.Response(
                200,
                json={"message": {"role": "assistant", "content": '{"speakers":["a","b"]}'}},
            )
        return httpx.Response(404, text="unexpected " + request.url.path)

    transport = httpx.MockTransport(handler)

    async def _run() -> None:
        async with httpx.AsyncClient(transport=transport, base_url="http://llm-llama-test") as client:
            out = await httpx_compat_chat_completion_json(
                client,
                "http://llm-llama-test",
                model="m.gguf",
                messages=[{"role": "user", "content": "plan"}],
                response_format={"type": "json_schema", "schema": _SAMPLE_SCHEMA},
            )
        assert '"speakers"' in out["response"]

    asyncio.run(_run())


@pytest.mark.unit
def test_httpx_generate_json_llama_native_schema_on_format_field() -> None:
    """Native /api/generate receives JSON Schema dict in ``format`` when json_schema is set."""

    invalidate_llm_backend_cache()

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/health":
            return httpx.Response(404)
        if request.method == "GET" and request.url.path == "/api/tags":
            return httpx.Response(200, json={"models": [{"name": "m.gguf", "size": 1}]})
        if request.method == "POST" and request.url.path == "/api/generate":
            body = json.loads(request.content.decode())
            assert body.get("format") == _SAMPLE_SCHEMA
            return httpx.Response(200, json={"response": '{"speakers":["x"]}'})
        return httpx.Response(404, text="unexpected " + request.url.path)

    transport = httpx.MockTransport(handler)

    async def _run() -> None:
        async with httpx.AsyncClient(transport=transport, base_url="http://llm-llama-test") as client:
            out = await httpx_compat_generate_json(
                client,
                "http://llm-llama-test",
                model="m.gguf",
                prompt="plan",
                json_schema=_SAMPLE_SCHEMA,
            )
        assert '"speakers"' in str(out.get("response"))

    asyncio.run(_run())


@pytest.mark.unit
def test_httpx_chat_json_openai_backend_schema_uses_native_api_chat() -> None:
    """When backend probes as OpenAI (``/health`` ok) but JSON Schema is requested, use native ``/api/chat`` ``format``."""

    invalidate_llm_backend_cache()

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/health":
            return httpx.Response(200, json={"status": "ok"})
        if request.method == "GET" and request.url.path == "/v1/models":
            return httpx.Response(200, json={"data": [{"id": "m.gguf"}]})
        if request.method == "POST" and request.url.path == "/api/chat":
            body = json.loads(request.content.decode())
            assert body.get("format") == _SAMPLE_SCHEMA
            assert "response_format" not in body
            return httpx.Response(
                200,
                json={"message": {"role": "assistant", "content": '{"speakers":["a"]}'}},
            )
        if request.method == "POST" and request.url.path == "/v1/chat/completions":
            body = json.loads(request.content.decode())
            rf = body.get("response_format")
            assert rf == {"type": "json_object"}, f"expected json_object fallback, got {rf!r}"
            return httpx.Response(
                200,
                json={"choices": [{"message": {"content": '{"speakers":["fallback"]}'}}]},
            )
        return httpx.Response(404, text="unexpected " + request.url.path)

    transport = httpx.MockTransport(handler)

    async def _run() -> None:
        async with httpx.AsyncClient(transport=transport, base_url="http://llm-openai-shim-test") as client:
            out = await httpx_compat_chat_completion_json(
                client,
                "http://llm-openai-shim-test",
                model="m.gguf",
                messages=[{"role": "user", "content": "plan"}],
                response_format={"type": "json_schema", "schema": _SAMPLE_SCHEMA},
            )
        assert '"speakers"' in out["response"]

    asyncio.run(_run())


@pytest.mark.unit
def test_httpx_generate_json_openai_backend_schema_uses_native_api_chat() -> None:
    """``httpx_compat_generate_json`` with json_schema on OpenAI-detected backend routes schema via ``/api/chat``."""

    invalidate_llm_backend_cache()

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/health":
            return httpx.Response(200, json={"status": "ok"})
        if request.method == "GET" and request.url.path == "/v1/models":
            return httpx.Response(200, json={"data": [{"id": "m.gguf"}]})
        if request.method == "POST" and request.url.path == "/api/chat":
            body = json.loads(request.content.decode())
            assert body.get("format") == _SAMPLE_SCHEMA
            return httpx.Response(
                200,
                json={"message": {"role": "assistant", "content": '{"speakers":["gen"]}'}},
            )
        return httpx.Response(404, text="unexpected " + request.url.path)

    transport = httpx.MockTransport(handler)

    async def _run() -> None:
        async with httpx.AsyncClient(transport=transport, base_url="http://llm-openai-shim-test") as client:
            out = await httpx_compat_generate_json(
                client,
                "http://llm-openai-shim-test",
                model="m.gguf",
                prompt="plan",
                json_schema=_SAMPLE_SCHEMA,
            )
        assert '"speakers"' in str(out.get("response"))

    asyncio.run(_run())
