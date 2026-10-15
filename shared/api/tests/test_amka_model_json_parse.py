from __future__ import annotations

from api.services.marketing_cabinet.amka_llm_json import amka_parse_model_json_dict


def test_amka_parse_model_json_dict_plain_object() -> None:
    assert amka_parse_model_json_dict('{"a": 1}') == {"a": 1}


def test_amka_parse_model_json_dict_markdown_fence() -> None:
    raw = '```json\n{"b": 2}\n```'
    assert amka_parse_model_json_dict(raw) == {"b": 2}


def test_amka_parse_model_json_dict_prefix_noise_then_object() -> None:
    raw = 'Пояснение перед JSON:\n{"nested": {"x": true}}\n'
    assert amka_parse_model_json_dict(raw) == {"nested": {"x": True}}


def test_amka_parse_model_json_dict_nested_braces_not_greedy_regex() -> None:
    """Greedy `{.*}` в extract_json_payload ломается на вложенных объектах; балансный проход — нет."""
    raw = '{"outer": {"inner": 1}, "tail": 2}'
    assert amka_parse_model_json_dict(raw) == {"outer": {"inner": 1}, "tail": 2}


def test_amka_parse_model_json_dict_invalid_returns_empty() -> None:
    assert amka_parse_model_json_dict("совсем не json") == {}


def test_amka_parse_model_json_dict_empty_returns_empty() -> None:
    assert amka_parse_model_json_dict("") == {}


def test_amka_parse_model_json_dict_brace_inside_string_value() -> None:
    """Закрывающая скобка внутри строки не должна обрезать объект по жадному regex."""
    raw = 'prefix {"k": "a}b", "z": 1} trailing'
    assert amka_parse_model_json_dict(raw) == {"k": "a}b", "z": 1}
