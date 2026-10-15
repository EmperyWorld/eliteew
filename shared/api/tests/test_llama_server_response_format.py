# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Locks llama-server OpenAI shim response_format normalization and orchestrator JSON parse.
# Invariants:
# - Raw Pydantic schema maps to strict json_schema wrapper for /v1/chat/completions.
# - Channel markup prefix must not break orchestrator JSON extraction.
# Related:
# - api/utils/llm_openai_compat_http.py
# - api/services/llama_service.py
# - archive/legacy_freeform/orchestrator.py
# ---

from __future__ import annotations

from api.services.desktop_chat_ensemble.archive.legacy_freeform.orchestrator import (
    _OrchestratorJsonBody,
    _parse_json_object,
)
from api.utils.llm_openai_compat_http import (
    build_openai_strict_json_schema,
    normalize_llama_server_chat_response_format,
    openai_compat_response_format_payload,
)


def test_normalize_raw_schema_to_strict_json_schema_wrapper() -> None:
    schema = _OrchestratorJsonBody.model_json_schema()
    out = normalize_llama_server_chat_response_format(schema, strict_name="ensemble_orchestrator_plan")
    assert isinstance(out, dict)
    assert out.get("type") == "json_schema"
    js = out.get("json_schema")
    assert isinstance(js, dict)
    assert js.get("strict") is True
    assert js.get("name") == "ensemble_orchestrator_plan"
    assert js.get("schema") == schema


def test_openai_compat_preserves_strict_wrapper() -> None:
    wrapped = build_openai_strict_json_schema("delivery", {"type": "object", "properties": {}})
    payload = openai_compat_response_format_payload(wrapped)
    assert payload is wrapped
    assert wrapped["type"] == "json_schema"


def test_orchestrator_parse_json_strips_channel_markup() -> None:
    raw = (
        "<|channel>thought\n"
        "<channel|>{"
        '"speakers":["max_safin"],'
        '"delivery_mode":"joint",'
        '"reason":"test",'
        '"task_blocks":[],'
        '"focus":[],'
        '"huddle_lines":[]'
        "}"
    )
    parsed = _parse_json_object(raw)
    assert parsed is not None
    body = _OrchestratorJsonBody.model_validate(parsed)
    assert body.delivery_mode == "joint"
    assert body.speakers == ["max_safin"]


def test_json_string_maps_to_json_object() -> None:
    out = normalize_llama_server_chat_response_format("json")
    assert out == {"type": "json_object"}
