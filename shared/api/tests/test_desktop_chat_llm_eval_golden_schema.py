# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Schema validation for desktop_chat_llm_eval_golden.jsonl (≥50 cases).
# Related:
# - api/services/desktop_chat/llm_rag_eval_service.py
# ---

from __future__ import annotations

from api.services.desktop_chat.llm_rag_eval_service import DEFAULT_GOLDEN_PATH, load_llm_eval_cases


def test_llm_eval_golden_has_at_least_50_cases() -> None:
    cases = load_llm_eval_cases(DEFAULT_GOLDEN_PATH)
    assert len(cases) >= 50


def test_llm_eval_golden_tags_cover_rag_layers() -> None:
    cases = load_llm_eval_cases(DEFAULT_GOLDEN_PATH)
    all_tags = {tag for case in cases for tag in case.tags}
    for required in (
        "solo_rag_attachments",
        "vault_rag",
        "episodic_memory",
        "web_search_on",
        "empty_rag",
    ):
        assert required in all_tags
