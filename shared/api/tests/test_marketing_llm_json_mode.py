# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests: marketing cabinet structured LLM steps request schema-constrained JSON from stack2.
# Invariants:
# - document_structured_extract, SWOT, JTBD types enable json_format via ugs_generation_requests_json_object.
# Related:
# - api/services/ugs/text_llm_constants.py
# - documentation/laama-cpp.md (response_format json_object)
# ---

from __future__ import annotations

from api.services.ugs.text_llm_constants import (
    MARKETING_LLM_JSON_OBJECT_GENERATION_TYPES,
    ugs_generation_requests_json_object,
)


def test_marketing_json_object_generation_types_cover_structured_flows() -> None:
    assert "document_structured_extract" in MARKETING_LLM_JSON_OBJECT_GENERATION_TYPES
    assert "marketing_swot_analysis" in MARKETING_LLM_JSON_OBJECT_GENERATION_TYPES
    assert "marketing_jtbd_extract" in MARKETING_LLM_JSON_OBJECT_GENERATION_TYPES
    assert "text_chat" not in MARKETING_LLM_JSON_OBJECT_GENERATION_TYPES


def test_ugs_generation_requests_json_object_marketing_and_override() -> None:
    assert ugs_generation_requests_json_object("marketing_swot_analysis", {}) is True
    assert ugs_generation_requests_json_object("marketing_jtbd_extract", {}) is True
    assert ugs_generation_requests_json_object("document_structured_extract", {}) is True
    assert ugs_generation_requests_json_object("text_chat", {}) is False
    assert ugs_generation_requests_json_object("text_chat", {"json_format": True}) is True


def test_ugs_generation_requests_json_object_music_and_professional_worlds() -> None:
    assert ugs_generation_requests_json_object("music_generator_suggest_params", {}) is True
    assert ugs_generation_requests_json_object("professional_worlds_realtor_object_extract", {}) is True
