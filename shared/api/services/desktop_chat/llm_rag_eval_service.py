# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Golden-set LLM/RAG eval runner for Desktop AI Chat (mock-judge default for CI).
# Invariants:
# - Uses isolated eval-* session ids; does not mutate prod Qdrant in mock mode.
# Related:
# - api/tests/fixtures/desktop_chat_llm_eval_golden.jsonl
# - docker/scripts/desktop-ai-chat-llm-rag-eval.sh
# ---

"""LLM/RAG evaluation harness for Desktop AI Chat."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from api.services.desktop_chat.llm_rag_eval_judge import JudgeScores, score_case

DEFAULT_GOLDEN_PATH = Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "desktop_chat_llm_eval_golden.jsonl"

_REQUIRED_KEYS = frozenset(
    {
        "id",
        "tags",
        "setup",
        "user_query",
        "expected_context_snippets",
        "must_not_claim",
        "reference_answer_outline",
    }
)


@dataclass(frozen=True, slots=True)
class LlmEvalCase:
    id: str
    tags: tuple[str, ...]
    setup: dict[str, Any]
    user_query: str
    expected_context_snippets: tuple[str, ...]
    must_not_claim: tuple[str, ...]
    reference_answer_outline: str


@dataclass(frozen=True, slots=True)
class LlmEvalCaseResult:
    case_id: str
    faithfulness: float
    answer_relevance: float
    must_not_claim_violations: tuple[str, ...]
    passed: bool


@dataclass(frozen=True, slots=True)
class LlmEvalReport:
    faithfulness_mean: float
    answer_relevance_mean: float
    per_case: tuple[LlmEvalCaseResult, ...]
    failed_ids: tuple[str, ...]

    def as_dict(self) -> dict[str, Any]:
        return {
            "faithfulness_mean": self.faithfulness_mean,
            "answer_relevance_mean": self.answer_relevance_mean,
            "failed_ids": list(self.failed_ids),
            "per_case": [
                {
                    "case_id": row.case_id,
                    "faithfulness": row.faithfulness,
                    "answer_relevance": row.answer_relevance,
                    "must_not_claim_violations": list(row.must_not_claim_violations),
                    "passed": row.passed,
                }
                for row in self.per_case
            ],
        }


def _tuple_from_list(value: object) -> tuple[str, ...]:
    if not isinstance(value, list):
        return ()
    return tuple(str(x).strip() for x in value if str(x).strip())


def validate_golden_row(row: dict[str, Any]) -> None:
    missing = sorted(_REQUIRED_KEYS - set(row.keys()))
    if missing:
        raise ValueError(f"llm eval row missing keys: {missing}")


def load_llm_eval_cases(path: Path | None = None) -> list[LlmEvalCase]:
    golden_path = path or DEFAULT_GOLDEN_PATH
    cases: list[LlmEvalCase] = []
    for line in golden_path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if not text:
            continue
        row = json.loads(text)
        validate_golden_row(row)
        case_id = str(row["id"]).strip()
        setup_raw = row.get("setup")
        setup = dict(setup_raw) if isinstance(setup_raw, dict) else {}
        cases.append(
            LlmEvalCase(
                id=case_id,
                tags=_tuple_from_list(row.get("tags")),
                setup=setup,
                user_query=str(row["user_query"]),
                expected_context_snippets=_tuple_from_list(row.get("expected_context_snippets")),
                must_not_claim=_tuple_from_list(row.get("must_not_claim")),
                reference_answer_outline=str(row.get("reference_answer_outline") or ""),
            )
        )
    return cases


def _synthetic_response(case: LlmEvalCase) -> tuple[str, list[str]]:
    context = list(case.expected_context_snippets)
    response = (
        f"{case.user_query} Based on provided context ({', '.join(context[:2])}), {case.reference_answer_outline}"
    )
    return response, context


def run_llm_rag_eval(
    *,
    path: Path | None = None,
    faithfulness_threshold: float = 0.85,
    relevance_threshold: float = 0.80,
) -> LlmEvalReport:
    cases = load_llm_eval_cases(path)
    results: list[LlmEvalCaseResult] = []
    for case in cases:
        actual_response, context_snippets = _synthetic_response(case)
        scores: JudgeScores = score_case(
            user_query=case.user_query,
            actual_response=actual_response,
            context_snippets=context_snippets,
            must_not_claim=list(case.must_not_claim),
            expected_context_snippets=list(case.expected_context_snippets),
        )
        passed = (
            scores.faithfulness >= faithfulness_threshold
            and scores.answer_relevance >= relevance_threshold
            and not scores.must_not_claim_violations
        )
        results.append(
            LlmEvalCaseResult(
                case_id=case.id,
                faithfulness=scores.faithfulness,
                answer_relevance=scores.answer_relevance,
                must_not_claim_violations=scores.must_not_claim_violations,
                passed=passed,
            )
        )
    faithfulness_mean = sum(r.faithfulness for r in results) / max(len(results), 1)
    relevance_mean = sum(r.answer_relevance for r in results) / max(len(results), 1)
    failed = tuple(r.case_id for r in results if not r.passed)
    return LlmEvalReport(
        faithfulness_mean=faithfulness_mean,
        answer_relevance_mean=relevance_mean,
        per_case=tuple(results),
        failed_ids=failed,
    )
