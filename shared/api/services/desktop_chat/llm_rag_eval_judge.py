# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Deterministic mock-judge for Desktop AI Chat LLM/RAG eval (faithfulness + relevance).
# Invariants:
# - No external API; used in default CI when stack2 judge unavailable.
# Related:
# - api/services/desktop_chat/llm_rag_eval_service.py
# ---

"""Mock judge for Desktop AI Chat LLM eval harness."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class JudgeScores:
    faithfulness: float
    answer_relevance: float
    must_not_claim_violations: tuple[str, ...]


def score_case_deterministic(
    *,
    user_query: str,
    actual_response: str,
    context_snippets: list[str],
    must_not_claim: list[str],
    expected_context_snippets: list[str],
) -> JudgeScores:
    response_lower = actual_response.lower()
    violations: list[str] = []
    for forbidden in must_not_claim:
        token = forbidden.strip()
        if token and token.lower() in response_lower:
            violations.append(token)

    context_text = " ".join(context_snippets).lower()
    anchor_hits = 0
    for snippet in expected_context_snippets:
        token = snippet.strip().lower()
        if token and token in context_text:
            anchor_hits += 1
    faithfulness = 1.0 if not violations else 0.0
    if expected_context_snippets:
        faithfulness = min(faithfulness, anchor_hits / len(expected_context_snippets))

    query_tokens = [t for t in user_query.lower().split() if len(t) > 3][:6]
    if not query_tokens:
        relevance = 0.85
    else:
        hits = sum(1 for t in query_tokens if t in response_lower)
        relevance = min(1.0, 0.5 + hits / max(len(query_tokens), 1) * 0.5)

    return JudgeScores(
        faithfulness=faithfulness,
        answer_relevance=relevance,
        must_not_claim_violations=tuple(violations),
    )


def judge_mode_from_env() -> str:
    import os

    return (os.environ.get("AI_CHAT_EVAL_JUDGE_MODE") or "mock").strip().lower()


def score_case(
    *,
    user_query: str,
    actual_response: str,
    context_snippets: list[str],
    must_not_claim: list[str],
    expected_context_snippets: list[str],
    judge_mode: str | None = None,
) -> JudgeScores:
    mode = (judge_mode or judge_mode_from_env()).lower()
    if mode in {"mock", "deterministic"}:
        return score_case_deterministic(
            user_query=user_query,
            actual_response=actual_response,
            context_snippets=context_snippets,
            must_not_claim=must_not_claim,
            expected_context_snippets=expected_context_snippets,
        )
    # stack2 / ragas modes fall back to deterministic in CI unless wired
    return score_case_deterministic(
        user_query=user_query,
        actual_response=actual_response,
        context_snippets=context_snippets,
        must_not_claim=must_not_claim,
        expected_context_snippets=expected_context_snippets,
    )
