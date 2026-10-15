"""AMKA execute: deprecated IMC type_key remaps to RAG successor before run."""

from __future__ import annotations

from api.services.marketing_cabinet.amka_imc_auto_heuristic import (
    resolve_amka_imc_type_key_for_execution,
)


def test_resolve_amka_imc_type_key_for_execution_removes_deep_market_showcase() -> None:
    assert resolve_amka_imc_type_key_for_execution("imc_rag_deep_market_showcase") == "imc_rag_cabinet_analysis"


def test_resolve_amka_imc_type_key_for_execution_keeps_active_key() -> None:
    assert resolve_amka_imc_type_key_for_execution("imc_rag_jtbd") == "imc_rag_jtbd"


def test_resolve_amka_imc_type_key_for_execution_invalid_falls_back() -> None:
    assert resolve_amka_imc_type_key_for_execution("not_imc") == "imc_rag_jtbd"
