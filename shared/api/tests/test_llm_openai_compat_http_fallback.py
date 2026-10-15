# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for OpenAI-compatible completions fallback detection in LLM HTTP helpers.
# Invariants:
# - `/v1/completions` parser-style HTTP 500 must transparently route to chat-completions fallback.
# Related:
# - api/utils/llm_openai_compat_http.py
# ---

from api.utils.llm_openai_compat_http import _should_retry_generate_as_chat


def test_retry_generate_as_chat_for_content_only_500() -> None:
    should_retry, reason = _should_retry_generate_as_chat(
        500,
        '{"error":{"message":"content-only format is not supported"}}',
    )
    assert should_retry is True
    assert reason == "content_only_format_500"


def test_retry_generate_as_chat_for_parse_input_500() -> None:
    should_retry, reason = _should_retry_generate_as_chat(
        500,
        '{"error":{"message":"Failed to parse input at pos 0: *broken prompt"}}',
    )
    assert should_retry is True
    assert reason == "parse_input_500"
