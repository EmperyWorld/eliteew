# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Offline eval harness for ensemble route LLM classifier parsing (mocked sidecar responses).
# Invariants:
# - No live Llama calls; fixtures drive desktop_llm_json_object return values.
# Related:
# - api/services/desktop_chat_ensemble/conversational_route.py
# - api/tests/fixtures/desktop_chat_route_llm_eval_golden.jsonl
# ---

"""Golden-set evaluation for desktop ensemble route LLM classifier branches."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock

from api.services.desktop_chat_ensemble.conversational_route import llm_classify_blueprint_intent

DEFAULT_GOLDEN_PATH = (
    Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "desktop_chat_route_llm_eval_golden.jsonl"
)


@dataclass(frozen=True, slots=True)
class RouteLlmEvalCase:
    id: str
    mock_response: dict[str, Any] | None
    mock_error: str | None
    defaults: dict[str, Any]
    user_text: str
    history_tail: str
    expect_blueprint: bool
    expect_intent_substr: str
    tags: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class RouteLlmEvalMismatch:
    case_id: str
    reason: str


@dataclass(frozen=True, slots=True)
class RouteLlmEvalReport:
    total: int
    passed: int
    mismatches: tuple[RouteLlmEvalMismatch, ...]

    @property
    def accuracy(self) -> float:
        if self.total <= 0:
            return 1.0
        return self.passed / self.total


def load_route_llm_eval_cases(path: Path | None = None) -> list[RouteLlmEvalCase]:
    golden_path = path or DEFAULT_GOLDEN_PATH
    cases: list[RouteLlmEvalCase] = []
    for line in golden_path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if not text:
            continue
        row = json.loads(text)
        case_id = str(row.get("id") or "").strip()
        if not case_id:
            raise ValueError("route llm eval case missing id")
        mock_raw = row.get("mock_response")
        mock_response = dict(mock_raw) if isinstance(mock_raw, dict) else None
        mock_error_raw = row.get("mock_error")
        mock_error = str(mock_error_raw).strip() if isinstance(mock_error_raw, str) and mock_error_raw.strip() else None
        defaults_raw = row.get("defaults")
        defaults = dict(defaults_raw) if isinstance(defaults_raw, dict) else {}
        user_text = str(row.get("user_text") or "Нужен ваш совет по продукту")
        history_tail = str(row.get("history_tail") or "")
        expect_blueprint = bool(row.get("expect_blueprint"))
        expect_intent_substr = str(row.get("expect_intent_substr") or "").strip()
        if not expect_intent_substr:
            raise ValueError(f"route llm eval case {case_id!r} missing expect_intent_substr")
        raw_tags = row.get("tags")
        tags: tuple[str, ...] = ()
        if isinstance(raw_tags, list):
            tags = tuple(str(x).strip() for x in raw_tags if str(x).strip())
        cases.append(
            RouteLlmEvalCase(
                id=case_id,
                mock_response=mock_response,
                mock_error=mock_error,
                defaults=defaults,
                user_text=user_text,
                history_tail=history_tail,
                expect_blueprint=expect_blueprint,
                expect_intent_substr=expect_intent_substr,
                tags=tags,
            )
        )
    return cases


async def evaluate_route_llm_classifier(
    cases: list[RouteLlmEvalCase],
    *,
    sidecar_patch_target: str,
    audit_patch_target: str,
) -> RouteLlmEvalReport:
    from unittest.mock import patch

    mismatches: list[RouteLlmEvalMismatch] = []
    passed = 0
    llama = MagicMock()
    for case in cases:
        if case.mock_error:
            sidecar = AsyncMock(side_effect=RuntimeError(case.mock_error))
            mock_payload: dict[str, Any] | None = None
        else:
            sidecar = AsyncMock(return_value=case.mock_response)
            mock_payload = case.mock_response

        with (
            patch(sidecar_patch_target, sidecar),
            patch(audit_patch_target, new=AsyncMock()),
        ):
            use_bp, _conf, intent_note = await llm_classify_blueprint_intent(
                llama,
                model="test-model",
                user_text=case.user_text,
                history_tail=case.history_tail,
                defaults=case.defaults,
            )
        failure = _check_case(case, use_bp, intent_note)
        if failure is None:
            passed += 1
        else:
            mismatches.append(
                RouteLlmEvalMismatch(
                    case_id=case.id,
                    reason=f"{failure} (mock={mock_payload!r}, actual intent={intent_note!r}, use_bp={use_bp})",
                )
            )
    return RouteLlmEvalReport(total=len(cases), passed=passed, mismatches=tuple(mismatches))


def _check_case(case: RouteLlmEvalCase, use_bp: bool, intent_note: str) -> str | None:
    if use_bp != case.expect_blueprint:
        return f"blueprint mismatch: expected {case.expect_blueprint} actual {use_bp}"
    if case.expect_intent_substr not in intent_note:
        return f"intent note missing {case.expect_intent_substr!r}"
    return None
