# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests: misc services (presentation, Site Studio, doc editor, i18n) use stack2 JSON mode.
# Invariants:
# - Presentation JSON LLM calls pass response_format json_object.
# - Site Studio JSON prompts route json_format=True through DocEditorService.
# Related:
# - api/services/presentation_content_generator_service.py
# - api/services/site_studio_ai_service.py
# - api/services/doc_editor_service.py
# - api/services/i18n_rewrite_stack2_service.py
# ---

from __future__ import annotations

from pathlib import Path


def _read_service(relative: str) -> str:
    return (Path(__file__).resolve().parents[1] / "services" / relative).read_text(encoding="utf-8")


def test_presentation_json_calls_use_response_format_json_object() -> None:
    text = _read_service("presentation_content_generator_service.py")
    fn = text.split("async def _call_llm_for_json_with_meta")[1].split("async def _call_llm_for_json")[0]
    assert 'response_format={"type": "json_object"}' in fn
    assert "response_format=None" not in fn


def test_doc_editor_ai_complete_supports_json_format_flag() -> None:
    text = _read_service("doc_editor_service.py")
    complete_fn = text.split("async def ai_complete")[1].split("async def ai_stream")[0]
    ugs_fn = text.split("async def _call_ugs_text_generation")[1].split("async def ai_complete")[0]
    assert "json_format: bool = False" in complete_fn
    assert "json_format=json_format" in complete_fn
    assert 'input_data["json_format"] = True' in ugs_fn


def test_site_studio_json_prompts_pass_json_format() -> None:
    text = _read_service("site_studio_ai_service.py")
    json_fn = text.split("async def _complete_json_prompt")[1].split("async def _complete_text_prompt")[0]
    assert "json_format=True" in json_fn
    assert "Верни только JSON без markdown" not in text


def test_ai_sdk_generate_object_uses_json_schema_param() -> None:
    src = Path(__file__).resolve().parents[1] / "services" / "ai_sdk" / "llama_provider_service.py"
    text = src.read_text(encoding="utf-8")
    fn = text.split("async def generate_object")[1].split("async def stream_object")[0]
    assert "json_schema=schema" in fn
    assert "json_format=True" not in fn


def test_i18n_rewrite_stack2_uses_json_object_response_format() -> None:
    repo_root = Path(__file__).resolve().parents[3]
    src = repo_root / "shared" / "tools" / "i18n_rewriter" / "stack2_service.py"
    text = src.read_text(encoding="utf-8")
    assert '"response_format": {"type": "json_object"}' in text
    assert "Do not wrap JSON in markdown fences" not in text


def test_ewrp_slide_rewrite_uses_json_format() -> None:
    src = Path(__file__).resolve().parents[1] / "services" / "ewrp_service.py"
    text = src.read_text(encoding="utf-8")
    fn = text.split("async def _llm_json_rewrite_slide")[1].split("async def regenerate_slide_text_workflow")[0]
    assert "json_format=True" in fn
    assert "Reply with JSON only" not in fn
