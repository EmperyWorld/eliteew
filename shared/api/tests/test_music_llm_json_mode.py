# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests: music UGS text steps request schema-constrained JSON from stack2 llama-chat.
# Invariants:
# - suggest-params, v3 suggest, evolution brief, promo script set json_format via type_key or input_data.
# - lyrics/style/improve paths stay plain text (no json_format).
# Related:
# - api/services/ugs/provider_manager_service_v2.py
# - api/services/ugs/text_llm_constants.py
# - documentation/laama-cpp.md (response_format json_object)
# ---

from __future__ import annotations

import asyncio
import json

import httpx
import pytest

from api.services.ugs.text_llm_constants import (
    MUSIC_LLM_JSON_OBJECT_GENERATION_TYPES,
    ugs_generation_requests_json_object,
)
from api.utils.llm_openai_compat_http import (
    httpx_compat_chat_completion_json,
    invalidate_llm_backend_cache,
)


def test_music_json_object_generation_types_cover_structured_flows() -> None:
    assert "music_generator_suggest_params" in MUSIC_LLM_JSON_OBJECT_GENERATION_TYPES
    assert "music_generator_v3_suggest_params" in MUSIC_LLM_JSON_OBJECT_GENERATION_TYPES
    assert "music_generator_evolution_brief" in MUSIC_LLM_JSON_OBJECT_GENERATION_TYPES
    assert "music_generator_promo_script" in MUSIC_LLM_JSON_OBJECT_GENERATION_TYPES
    assert "music_generator_lyrics" not in MUSIC_LLM_JSON_OBJECT_GENERATION_TYPES


def test_ugs_generation_requests_json_object_music_types() -> None:
    for key in (
        "music_generator_suggest_params",
        "music_generator_v3_suggest_params",
        "music_generator_evolution_brief",
        "music_generator_promo_script",
    ):
        assert ugs_generation_requests_json_object(key, {}) is True
    assert ugs_generation_requests_json_object("music_generator_lyrics", {}) is False
    assert ugs_generation_requests_json_object("music_generator_lyrics", {"json_format": True}) is True


def test_provider_manager_lists_promo_script_in_chat_completion_branch() -> None:
    from pathlib import Path

    src = Path(__file__).resolve().parents[1] / "services" / "ugs" / "provider_manager_service_v2.py"
    text = src.read_text(encoding="utf-8")
    assert '"music_generator_promo_script"' in text


@pytest.mark.unit
def test_httpx_chat_json_llama_native_format_when_response_format_json_object() -> None:
    """Native /api/chat must receive format=json when OpenAI response_format requests JSON."""

    invalidate_llm_backend_cache()

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/health":
            return httpx.Response(404)
        if request.method == "GET" and request.url.path == "/api/tags":
            return httpx.Response(200, json={"models": [{"name": "m.gguf", "size": 1}]})
        if request.method == "POST" and request.url.path == "/api/chat":
            body = json.loads(request.content.decode())
            assert body.get("format") == "json"
            return httpx.Response(
                200,
                json={"message": {"role": "assistant", "content": '{"vocal":"female"}'}},
            )
        return httpx.Response(404, text="unexpected " + request.url.path)

    transport = httpx.MockTransport(handler)

    async def _run() -> None:
        async with httpx.AsyncClient(transport=transport, base_url="http://llm-llama-test") as client:
            out = await httpx_compat_chat_completion_json(
                client,
                "http://llm-llama-test",
                model="m.gguf",
                messages=[{"role": "user", "content": "json only"}],
                response_format={"type": "json_object"},
            )
        assert '"vocal"' in out["response"]

    asyncio.run(_run())
