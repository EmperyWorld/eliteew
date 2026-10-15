"""Regression: structured JSON extraction from thinking-model LLM output."""

from __future__ import annotations

import json

from api.utils.llm_json_extract import (
    extract_llm_json_payload,
    extract_slides_list_from_llm,
    salvage_json_array_objects,
    salvage_text_from_llama_server_error,
    strip_llm_channel_markup,
    strip_llm_thinking_prefix,
)

_THINK_OPEN = "\u003c" + "think" + "\u003e"
_THINK_CLOSE = "\u003c/" + "think" + "\u003e"


def test_salvage_json_array_objects_truncated_outline() -> None:
    raw = """[
  {"slideNumber": 1, "title": "A"},
  {"slideNumber": 2, "title": "B"},
  {"slideNumber": 3, "title": "C", "broken": """
    salvaged = salvage_json_array_objects(raw)
    assert len(salvaged) == 2
    assert salvaged[1]["title"] == "B"


def test_extract_slides_list_from_llm_outline_array() -> None:
    raw = '[{"slideNumber": 1, "title": "Intro"}, {"slideNumber": 2, "title": "Body"}]'
    items = extract_slides_list_from_llm(raw)
    assert items is not None
    assert len(items) == 2


def test_extract_llm_json_payload_fenced_object() -> None:
    raw = 'Пояснение\n```json\n{"slideNumber": 1, "title": "A"}\n```\nхвост'
    parsed = extract_llm_json_payload(raw)
    assert parsed == {"slideNumber": 1, "title": "A"}


def test_extract_llm_json_payload_outline_array_after_thinking() -> None:
    inner = '[{"slideNumber": 1, "type": "title", "title": "Введение"}]'
    raw = f"{_THINK_OPEN}planning steps...{_THINK_CLOSE}\n{inner}"
    assert strip_llm_thinking_prefix(raw).strip().startswith("[")
    parsed = extract_llm_json_payload(raw)
    assert isinstance(parsed, list)
    assert parsed[0]["slideNumber"] == 1


def test_extract_llm_json_payload_last_fence_wins() -> None:
    raw = (
        '```json\n{"slideNumber": 1, "broken": true,\n```\n'
        '```json\n{"slideNumber": 2, "title": "ok", "content": ["a"]}\n```'
    )
    parsed = extract_llm_json_payload(raw)
    assert parsed["slideNumber"] == 2
    assert parsed["title"] == "ok"


def test_extract_llm_json_payload_nested_braces_in_string() -> None:
    raw = '{"k": "a}b", "content": ["x"]}'
    parsed = extract_llm_json_payload(raw)
    assert parsed["k"] == "a}b"


def test_extract_llm_json_payload_strips_control_chars() -> None:
    raw = '{"title": "A\u000bb", "content": []}'
    parsed = extract_llm_json_payload(raw)
    assert "title" in parsed


def test_strip_llm_channel_markup() -> None:
    raw = '<|channel>thought\n<|channel|>[{"slideNumber": 1}]'
    cleaned = strip_llm_channel_markup(raw)
    assert "<|channel" not in cleaned
    assert cleaned.startswith("[")

    prose = "<|channel>* <channel|>Вы можете открыть плеер."
    assert strip_llm_channel_markup(prose) == "Вы можете открыть плеер."


def test_salvage_text_from_llama_server_error() -> None:
    inner = (
        "Failed to parse input at pos 13: <|channel>thought\n<|channel|>["
        '\n  {"slideNumber": 1, "type": "title", "title": "Достаточно"}\n]'
    )
    err_body = json.dumps({"error": {"code": 500, "message": inner}})
    salvaged = salvage_text_from_llama_server_error(err_body)
    assert salvaged is not None
    parsed = extract_llm_json_payload(salvaged)
    assert isinstance(parsed, list)
    assert parsed[0]["slideNumber"] == 1


def test_salvage_text_from_llama_server_error_lyrics_prose() -> None:
    inner = (
        "Failed to parse input at pos 13: <|channel>thought\n<|channel|>"
        "[Intro: Soft Piano, 75 BPM]\n(Voice: Calm)\nТекст куплета."
    )
    err_body = json.dumps({"error": {"code": 500, "message": inner}})
    salvaged = salvage_text_from_llama_server_error(err_body)
    assert salvaged is not None
    assert salvaged.startswith("[Intro:")
    assert "Текст куплета" in salvaged
    assert "<|channel" not in salvaged


def test_extract_llm_json_payload_ewrp_slide_shape() -> None:
    """Regression shape from EWRP slide prompt (object with content array)."""
    raw = """```json
{
  "slideNumber": 2,
  "type": "content",
  "title": "Преимущества",
  "content": ["Свежий воздух", "Вид на море"],
  "speakerNotes": "Рассказать про климат.",
  "imagePrompt": "beach house sunset, cinematic, 8k, no text"
}
```"""
    parsed = extract_llm_json_payload(raw)
    assert parsed["slideNumber"] == 2
    assert len(parsed["content"]) == 2
