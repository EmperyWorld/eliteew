"""Устойчивый разбор JSON из ответов маркетинговой LLM (Llama и др.)."""

from __future__ import annotations

import json
from typing import Any

from api.routers.marketing_cabinet.common import extract_json_payload


def amka_first_balanced_json_segment(text: str) -> str | None:
    """Первый сбалансированный JSON-объект или массив (строки и escape учитываются)."""
    stripped = text.strip()
    for opener, closer in (("{", "}"), ("[", "]")):
        start = stripped.find(opener)
        if start < 0:
            continue
        depth = 0
        in_string = False
        escape = False
        for i in range(start, len(stripped)):
            ch = stripped[i]
            if in_string:
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == '"':
                    in_string = False
                continue
            if ch == '"':
                in_string = True
                continue
            if ch == opener:
                depth += 1
            elif ch == closer:
                depth -= 1
                if depth == 0:
                    return stripped[start : i + 1]
    return None


def amka_parse_model_json_detail(raw_text: str) -> tuple[dict[str, Any], str]:
    """
    Разбор JSON из ответа модели; второй элемент — причина для логов (ok / empty_input / …).
    """
    raw_text = str(raw_text or "").strip()
    if not raw_text:
        return {}, "empty_input"
    try:
        parsed = extract_json_payload(raw_text)
        if isinstance(parsed, dict):
            return parsed, "ok"
        return {}, "extract_non_object"
    except ValueError:
        pass
    chunk = amka_first_balanced_json_segment(raw_text)
    if chunk:
        try:
            parsed = extract_json_payload(chunk)
            if isinstance(parsed, dict):
                return parsed, "ok"
        except ValueError:
            pass
        try:
            parsed = json.loads(chunk)
        except json.JSONDecodeError:
            return {}, "json_decode_error"
        if isinstance(parsed, dict):
            return parsed, "ok"
        return {}, "root_non_object"
    return {}, "no_json_segment"


def amka_parse_model_json_dict(raw_text: str) -> dict[str, Any]:
    """
    Разбор JSON из ответа модели: markdown-ограждения обрабатывает extract_json_payload;
    при сбое пробуем вырезать первый сбалансированный объект и json.loads.
    """
    data, _reason = amka_parse_model_json_detail(raw_text)
    return data
