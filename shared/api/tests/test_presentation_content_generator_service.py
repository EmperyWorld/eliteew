"""Regression: EWRP presentation JSON parsing and token budgeting."""

from __future__ import annotations

from api.services.presentation_content_generator_service import (
    PresentationContentGeneratorService,
    PresentationGenerationConfig,
    ewrp_monolithic_num_predict,
    ewrp_outline_num_predict,
)
from api.utils.llm_json_extract import extract_slides_list_from_llm, salvage_json_array_objects


def test_ewrp_num_predict_scales_with_slide_count() -> None:
    assert ewrp_outline_num_predict(7) >= 2048
    assert ewrp_outline_num_predict(20) > ewrp_outline_num_predict(7)
    assert ewrp_monolithic_num_predict(20) > ewrp_monolithic_num_predict(7)


def test_salvage_truncated_outline_array() -> None:
    raw = """[
  {"slideNumber": 1, "type": "title", "title": "Lexus ES300h: роскошь"},
  {"slideNumber": 2, "type": "content", "title": "Гибридная система", "notes": "Разбор силового агрегата"},
  {"slideNumber": 3, "type": "content", "title": "Дизайн экстерьера", "notes": "Spindle Grille"""
    items = salvage_json_array_objects(raw)
    assert len(items) == 2
    assert items[0]["slideNumber"] == 1
    assert items[1]["title"] == "Гибридная система"


def test_extract_slides_list_rejects_single_slide_mistake() -> None:
    raw = '{"slideNumber": 1, "type": "title", "title": "Only one", "content": ["a"]}'
    assert extract_slides_list_from_llm(raw) is None


def test_extract_slides_list_from_monolithic_wrapper() -> None:
    raw = """{
  "slides": [
    {"slideNumber": 1, "type": "title", "title": "Введение", "content": ["Пункт 1"]},
    {"slideNumber": 2, "type": "content", "title": "Детали", "content": ["Пункт 2", "Пункт 3"]}
  ]
}"""
    items = extract_slides_list_from_llm(raw)
    assert items is not None
    assert len(items) == 2
    assert items[1]["title"] == "Детали"


def test_parse_slides_from_broken_monolithic_salvages_prefix() -> None:
    """Broken JSON after slide 2 must still yield salvaged slides, not template fallback."""
    raw = """{
  "slides": [
    {"slideNumber": 1, "type": "title", "title": "Lexus ES300h", "content": ["Обзор модели"]},
    {"slideNumber": 2, "type": "content", "title": "Гибрид", "content": ["2.5 л", "Электромотор"]},
    {"slideNumber": 3, "type": "content", "title": "Битый", "content": ["x"
  ]
}"""
    svc = PresentationContentGeneratorService()
    config = PresentationGenerationConfig(topic="Lexus ES300h", slide_count=3)
    slides, used_fallback = svc._parse_slides_from_response(raw, config)
    assert used_fallback is False
    assert len(slides) >= 2
    assert slides[0]["title"] == "Lexus ES300h"
    assert slides[0].get("content_source") == "monolithic"
