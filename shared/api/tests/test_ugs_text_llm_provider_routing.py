# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Юнит-тесты резолва и принудительной подмены base URL для UGS text LLM / ИМК RAG.
# Invariants:
# — (нет)
# Related:
# - api.services.ugs.text_llm_constants
# ---

"""UGS text LLM: provider_type set and URL resolution (no heavy api imports)."""

from __future__ import annotations

from api.services.ugs.text_llm_constants import (
    CANONICAL_DOCKER_TEXT_LLM_URL,
    TEXT_LLM_PROVIDER_TYPES,
    coerce_imc_rag_research_llm_base_url,
    resolve_ugs_text_llm_base_url,
)


def test_text_llm_provider_types_include_llama_and_llama() -> None:
    assert "llama" in TEXT_LLM_PROVIDER_TYPES
    assert "llama" in TEXT_LLM_PROVIDER_TYPES


def test_resolve_ugs_text_llm_prefers_configured_base_url() -> None:
    assert (
        resolve_ugs_text_llm_base_url("http://admin:8080", env_llama_url="http://env-llm:9999") == "http://admin:8080"
    )


def test_resolve_ugs_text_llm_uses_env_when_configured_empty() -> None:
    assert resolve_ugs_text_llm_base_url(None, env_llama_url="http://env-llm:9999") == "http://env-llm:9999"
    assert resolve_ugs_text_llm_base_url("", env_llama_url="http://env-llm:9999") == "http://env-llm:9999"


def test_resolve_ugs_text_llm_falls_back_to_canonical_when_env_empty() -> None:
    assert resolve_ugs_text_llm_base_url(None, env_llama_url="") == CANONICAL_DOCKER_TEXT_LLM_URL
    assert resolve_ugs_text_llm_base_url("", env_llama_url="") == CANONICAL_DOCKER_TEXT_LLM_URL


def test_resolve_ugs_text_llm_strips_whitespace() -> None:
    assert resolve_ugs_text_llm_base_url("  http://x/  ", env_llama_url="") == "http://x"


def test_resolve_ugs_text_llm_prefers_env_lan_over_docker_internal_admin_url() -> None:
    assert (
        resolve_ugs_text_llm_base_url(
            "http://stack2-llama-chat:8080",
            env_llama_url="http://192.168.1.136:8080",
        )
        == "http://192.168.1.136:8080"
    )


def test_resolve_ugs_text_llm_keeps_docker_admin_when_env_is_same_compose_dns() -> None:
    assert (
        resolve_ugs_text_llm_base_url(
            "http://stack2-llama-chat:8080",
            env_llama_url="http://stack2-llama-chat:8080",
        )
        == "http://stack2-llama-chat:8080"
    )


def test_coerce_imc_rag_rejects_llama_embed_host() -> None:
    out, ch = coerce_imc_rag_research_llm_base_url("http://stack2-llama-embed:8080/")
    assert ch is True
    assert out == CANONICAL_DOCKER_TEXT_LLM_URL


def test_coerce_imc_rag_rejects_url_matching_embedding_env() -> None:
    out, ch = coerce_imc_rag_research_llm_base_url(
        "http://stack2-llama-embed:8080",
        embedding_base_url="http://stack2-llama-embed:8080/",
    )
    assert ch is True
    assert out == CANONICAL_DOCKER_TEXT_LLM_URL


def test_coerce_imc_rag_keeps_chat_url() -> None:
    out, ch = coerce_imc_rag_research_llm_base_url("http://stack2-llama-chat:8080", embedding_base_url=None)
    assert ch is False
    assert out == "http://stack2-llama-chat:8080"
