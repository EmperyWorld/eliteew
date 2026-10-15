"""Unit tests: IMC RAG orchestrate flags in UGS input payload."""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

from api.schemas.imc import ImcRunResearchRequest
from api.services.imc.imc_service import ImcService


def _gt(*, type_key: str, meta: dict) -> SimpleNamespace:
    return SimpleNamespace(
        type_key=type_key,
        model_name="gemma-4-26B.gguf",
        parameters={"research_type": type_key, "prompt_instructions": "test"},
        type_metadata=meta,
    )


def test_build_ugs_input_data_enables_orchestrate_from_type_metadata() -> None:
    meta = {
        "imc_cabinet": True,
        "imc_vector_only": True,
        "imc_output_sections": ["A", "B", "C"],
        "imc_rag_orchestrate": True,
        "imc_rag_orchestrate_mode": "sections",
        "imc_rag_orchestrate_max_steps": 6,
        "imc_rag_step_num_predict": 8192,
        "imc_rag_merge_num_predict": 12288,
    }
    body = ImcRunResearchRequest(
        company_id=str(uuid4()),
        project_id=str(uuid4()),
        type_key="imc_rag_trends_signals",
        context={"brief": "тренды"},
    )
    svc = ImcService.__new__(ImcService)
    payload = svc._build_ugs_input_data(body, _gt(type_key="imc_rag_trends_signals", meta=meta))
    assert payload["imc_rag_orchestrate"] is True
    assert payload["imc_rag_orchestrate_mode"] == "sections"
    assert payload["imc_rag_orchestrate_max_steps"] == 6
    assert payload["imc_rag_step_num_predict"] == 8192
    assert payload["imc_rag_merge_num_predict"] == 12288


def test_build_ugs_input_data_skips_orchestrate_when_metadata_false() -> None:
    meta = {
        "imc_cabinet": True,
        "imc_vector_only": True,
        "imc_output_sections": ["A", "B"],
        "imc_rag_orchestrate": False,
    }
    body = ImcRunResearchRequest(
        company_id=str(uuid4()),
        project_id=str(uuid4()),
        type_key="imc_rag_swot",
        context={},
    )
    svc = ImcService.__new__(ImcService)
    payload = svc._build_ugs_input_data(body, _gt(type_key="imc_rag_swot", meta=meta))
    assert "imc_rag_orchestrate" not in payload
