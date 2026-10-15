"""Unit tests: IMC RAG merge flag coercion and defaults (imc_service helpers)."""

from __future__ import annotations

from api.services.imc.imc_rag_enrichment import coerce_meta_bool, resolve_imc_use_merged_context


def test_meta_bool_none_uses_default() -> None:
    assert coerce_meta_bool(None, default=False) is False
    assert coerce_meta_bool(None, default=True) is True


def test_meta_bool_python_bool() -> None:
    assert coerce_meta_bool(True) is True
    assert coerce_meta_bool(False) is False


def test_meta_bool_numeric() -> None:
    assert coerce_meta_bool(1) is True
    assert coerce_meta_bool(0) is False


def test_meta_bool_string_tokens() -> None:
    assert coerce_meta_bool("true") is True
    assert coerce_meta_bool("FALSE") is False
    assert coerce_meta_bool("1") is True
    assert coerce_meta_bool("0") is False


def test_meta_bool_unknown_string_falls_back_to_default() -> None:
    assert coerce_meta_bool("maybe", default=False) is False


def test_imc_rag_types_default_to_merged_when_flag_missing() -> None:
    assert resolve_imc_use_merged_context(type_key="imc_rag_swot", meta={}) is True
    assert resolve_imc_use_merged_context(type_key="imc_rag_jtbd", meta={}) is True


def test_imc_rag_explicit_false_disables_merged() -> None:
    assert (
        resolve_imc_use_merged_context(
            type_key="imc_rag_swot",
            meta={"imc_use_merged_context": False},
        )
        is False
    )
    assert (
        resolve_imc_use_merged_context(
            type_key="imc_rag_swot",
            meta={"imc_use_merged_context": "false"},
        )
        is False
    )


def test_non_imc_rag_does_not_default_merge() -> None:
    assert resolve_imc_use_merged_context(type_key="marketing_research_creator", meta={}) is False
    assert resolve_imc_use_merged_context(type_key="imc_cabinet_filler", meta={}) is False
