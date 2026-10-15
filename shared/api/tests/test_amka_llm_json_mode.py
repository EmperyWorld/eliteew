# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests: AMKA direct LLM JSON paths use stack2 ``format=json``.
# Invariants:
# - amka_llm_json_with_parse_meta and amka_llm_json_raw pass json_format=True to httpx_compat_generate_json.
# Related:
# - api/services/marketing_cabinet/amka_llm_runtime.py
# ---

from __future__ import annotations

from pathlib import Path


def test_amka_llm_runtime_json_calls_use_json_format_flag() -> None:
    src = Path(__file__).resolve().parents[1] / "services" / "marketing_cabinet" / "amka_llm_runtime.py"
    text = src.read_text(encoding="utf-8")
    assert "json_format=True" in text
    assert "json_format=False" in text
    json_fn = text.split("async def amka_llm_json_with_parse_meta")[1].split("async def amka_llm_json")[0]
    assert "json_format=True" in json_fn
    json_raw_fn = text.split("async def amka_llm_json_raw")[1].split("async def amka_llm_text")[0]
    assert "json_format=True" in json_raw_fn
    text_fn = text.split("async def amka_llm_text")[1]
    assert "json_format=False" in text_fn
