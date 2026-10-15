# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pytest gate for mocked ensemble route LLM classifier golden-set contracts.
# Invariants:
# - No live Llama; patches desktop_llm_json_object return values from fixtures.
# Related:
# - api/services/desktop_chat_ensemble/route_llm_eval.py
# - api/services/desktop_chat_ensemble/conversational_route.py
# ---

"""Desktop AI Chat route LLM classifier eval harness tests."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

pytest.importorskip("sqlalchemy")

from api.services.desktop_chat_ensemble.conversational_route import (
    heuristic_ensemble_route_phase,
    resolve_auto_blueprint_vs_legacy,
)
from api.services.desktop_chat_ensemble.route_llm_eval import (
    RouteLlmEvalCase,
    evaluate_route_llm_classifier,
    load_route_llm_eval_cases,
)

_GOLDEN_PATH = Path(__file__).parent / "fixtures" / "desktop_chat_route_llm_eval_golden.jsonl"
_SIDECAR_PATCH = "api.services.desktop_chat_ensemble.conversational_route.desktop_llm_json_object"
_AUDIT_PATCH = "api.services.desktop_chat_ensemble.conversational_route.ensemble_audit_log.log_llm_chat"


def test_per_member_registry_uses_specialized_legacy_council() -> None:
    phase = heuristic_ensemble_route_phase(
        user_text=(
            "Каждый участник предлагает ровно 3 разных приложения. "
            "Полные названия оформите в общем документе и не дублируйте коллег."
        ),
        defaults={},
        history=[],
    )
    assert phase == "legacy"


def test_route_llm_eval_golden_schema() -> None:
    rows = [json.loads(line) for line in _GOLDEN_PATH.read_text(encoding="utf-8").splitlines() if line.strip()]
    assert len(rows) >= 6
    for row in rows:
        assert isinstance(row.get("id"), str) and row["id"].strip()
        assert isinstance(row.get("expect_intent_substr"), str) and row["expect_intent_substr"].strip()
        assert "expect_blueprint" in row


@pytest.mark.asyncio
async def test_route_llm_eval_golden_classifier_accuracy() -> None:
    cases = load_route_llm_eval_cases(_GOLDEN_PATH)
    report = await evaluate_route_llm_classifier(
        cases,
        sidecar_patch_target=_SIDECAR_PATCH,
        audit_patch_target=_AUDIT_PATCH,
    )
    if report.mismatches:
        details = "\n".join(f"- {m.case_id}: {m.reason}" for m in report.mismatches)
        pytest.fail(f"route llm eval mismatches ({report.passed}/{report.total} passed):\n{details}")
    assert report.accuracy == 1.0


@pytest.mark.asyncio
async def test_route_llm_eval_reports_mismatch_shape_on_drift() -> None:
    cases = [
        RouteLlmEvalCase(
            id="forced-mismatch",
            mock_response={"intent": "chat", "confidence": 0.95},
            mock_error=None,
            defaults={},
            user_text="test",
            history_tail="",
            expect_blueprint=True,
            expect_intent_substr="document",
            tags=(),
        )
    ]
    report = await evaluate_route_llm_classifier(
        cases,
        sidecar_patch_target=_SIDECAR_PATCH,
        audit_patch_target=_AUDIT_PATCH,
    )
    assert report.passed == 0
    assert len(report.mismatches) == 1


@pytest.mark.asyncio
async def test_resolve_auto_uncertain_delegates_to_llm_classifier() -> None:
    uncertain_text = (
        "Мне интересно услышать ваши мнения о том, как команда видит ближайшие шаги, "
        "какие есть сильные стороны и слабые места в текущем подходе, и что стоит обсудить "
        "на следующей встрече без подготовки финального материала заранее."
    )
    llama_cm = AsyncMock()
    llama_cm.__aenter__ = AsyncMock(return_value=object())
    llama_cm.__aexit__ = AsyncMock(return_value=None)
    with (
        patch(_SIDECAR_PATCH, AsyncMock(return_value={"intent": "document", "confidence": 0.9})),
        patch(_AUDIT_PATCH, new=AsyncMock()),
        patch(
            "api.services.desktop_chat_ensemble.conversational_route.LlamaService",
            return_value=llama_cm,
        ),
    ):
        use_bp, note = await resolve_auto_blueprint_vs_legacy(
            user_text=uncertain_text,
            history=[],
            defaults={"ensemble_blueprint_conversational_fallback": True},
            model="test-model",
        )
    assert use_bp is True
    assert "llm intent=document" in note


@pytest.mark.asyncio
async def test_resolve_auto_uncertain_skips_llm_when_disabled() -> None:
    uncertain_text = (
        "Мне интересно услышать ваши мнения о том, как команда видит ближайшие шаги, "
        "какие есть сильные стороны и слабые места в текущем подходе, и что стоит обсудить "
        "на следующей встрече без подготовки финального материала заранее."
    )
    sidecar = AsyncMock(return_value={"intent": "document", "confidence": 0.99})
    with patch(_SIDECAR_PATCH, sidecar):
        use_bp, note = await resolve_auto_blueprint_vs_legacy(
            user_text=uncertain_text,
            history=[],
            defaults={
                "ensemble_blueprint_conversational_fallback": True,
                "ensemble_route_llm_enabled": False,
            },
            model="test-model",
        )
    sidecar.assert_not_called()
    assert use_bp is False
    assert note == "uncertain_no_llm"
