# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Mock-judge LLM/RAG eval harness regression tests.
# Related:
# - api/services/desktop_chat/llm_rag_eval_service.py
# ---

from __future__ import annotations

from api.services.desktop_chat.llm_rag_eval_judge import score_case_deterministic
from api.services.desktop_chat.llm_rag_eval_service import run_llm_rag_eval


def test_deterministic_judge_flags_must_not_claim() -> None:
    scores = score_case_deterministic(
        user_query="What is revenue?",
        actual_response="Revenue is forbidden-stat-1 according to docs.",
        context_snippets=["context-solo_rag_attachments"],
        must_not_claim=["forbidden-stat-1"],
        expected_context_snippets=["context-solo_rag_attachments"],
    )
    assert scores.faithfulness == 0.0
    assert scores.must_not_claim_violations == ("forbidden-stat-1",)


def test_run_llm_rag_eval_meets_thresholds() -> None:
    report = run_llm_rag_eval()
    assert report.faithfulness_mean >= 0.85
    assert report.answer_relevance_mean >= 0.80
    assert not report.failed_ids
