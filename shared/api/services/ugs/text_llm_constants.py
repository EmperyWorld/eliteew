# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Резервные URL и нормализация базового HTTP для UGS text LLM (Llama или OpenAI-compat llama.cpp).
# Invariants:
# - ИМК RAG (`imc_rag_research_provider`) не должен вызывать embed/rerank/TEI — иначе малый n_ctx (см. stack2).
# - LAN workers: docker-internal admin URL (`stack2-llama-chat`) yields to explicit LLAMA_URL LAN bind.
# Related:
# - documentation/platform/docker-re_doc/STACK0-LLM-OVERVIEW.md
# - api/services/ugs/provider_manager_service_v2.py
# - documentation/laama-cpp.md
# ---

"""Defaults for UGS text LLM (модульный краткий указатель; см. заголовок выше)."""

from __future__ import annotations

# Резервный URL для UGS text LLM при пустых admin URL и LLAMA_URL (сервис compose stack2-llama-chat).
# Не путать с «отключением LLM»; канон: documentation/platform/docker-re_doc/STACK0-LLM-OVERVIEW.md
CANONICAL_DOCKER_TEXT_LLM_URL = "http://stack2-llama-chat:8080"

TEXT_LLM_PROVIDER_TYPES: frozenset[str] = frozenset({"llama"})

# UGS generation_types that expect a single JSON object from stack2 llama-chat (schema-constrained output).
MUSIC_LLM_JSON_OBJECT_GENERATION_TYPES: frozenset[str] = frozenset(
    {
        "music_generator_suggest_params",
        "music_generator_v3_suggest_params",
        "music_generator_evolution_brief",
        "music_generator_promo_script",
    }
)

# Marketing cabinet structured LLM steps (document autofill, SWOT, JTBD, future analysis types).
MARKETING_LLM_JSON_OBJECT_GENERATION_TYPES: frozenset[str] = frozenset(
    {
        "document_structured_extract",
        "marketing_swot_analysis",
        "marketing_jtbd_extract",
        "marketing_porter_analysis",
        "marketing_competitor_report",
        "marketing_financial_projection",
        "marketing_channel_mix",
        "marketing_customer_insights",
    }
)

_PROFESSIONAL_WORLDS_JSON_OBJECT_GENERATION_TYPES: frozenset[str] = frozenset(
    {"professional_worlds_realtor_object_extract"}
)


def ugs_generation_requests_json_object(
    generation_type: str,
    input_data: dict[str, object] | None = None,
) -> bool:
    """True when UGS text LLM call must set llama.cpp ``format=json`` / OpenAI ``json_object``."""

    if bool((input_data or {}).get("json_format")):
        return True
    if generation_type in MUSIC_LLM_JSON_OBJECT_GENERATION_TYPES:
        return True
    if generation_type in MARKETING_LLM_JSON_OBJECT_GENERATION_TYPES:
        return True
    return generation_type in _PROFESSIONAL_WORLDS_JSON_OBJECT_GENERATION_TYPES


_DOCKER_INTERNAL_LLM_HOST_MARKERS: tuple[str, ...] = (
    "stack2-llama-chat",
    "stack2-llama",
)

_IMC_RAG_FORBIDDEN_URL_MARKERS: tuple[str, ...] = (
    "llama-embed",
    "llama-rerank",
    "tei-embed",
)


def _norm_base_url(url: str) -> str:
    return (url or "").strip().rstrip("/")


def _is_docker_internal_llm_url(url: str) -> bool:
    low = _norm_base_url(url).lower()
    return any(marker in low for marker in _DOCKER_INTERNAL_LLM_HOST_MARKERS)


def resolve_ugs_text_llm_base_url(
    configured_base_url: str | None,
    *,
    env_llama_url: str,
) -> str:
    """Prefer DB/admin base_url; else LLAMA_URL (`env_llama_url`); else compose default.

    LAN workers (gpu141) store compose DNS in DB but reach chat LLM via punisher LAN bind in LLAMA_URL.
    When admin URL is docker-internal and env URL is explicit external/LAN, prefer env.
    """
    configured = _norm_base_url(configured_base_url or "")
    env_url = _norm_base_url(env_llama_url or "")
    if configured and env_url and _is_docker_internal_llm_url(configured) and not _is_docker_internal_llm_url(env_url):
        return env_url
    if configured:
        return configured
    return env_url or CANONICAL_DOCKER_TEXT_LLM_URL


def coerce_imc_rag_research_llm_base_url(
    url: str,
    *,
    embedding_base_url: str | None = None,
) -> tuple[str, bool]:
    """
    Если URL указывает на известные не-chat конечные точки stack2 или совпадает с LLAMA_EMBEDDING_URL —
    подменяем на CANONICAL_DOCKER_TEXT_LLM_URL (ИМК иначе ловит exceed_context_size на малом n_ctx).
    """
    u = _norm_base_url(url)
    if not u:
        return CANONICAL_DOCKER_TEXT_LLM_URL, True
    low = u.lower()
    for m in _IMC_RAG_FORBIDDEN_URL_MARKERS:
        if m in low:
            return CANONICAL_DOCKER_TEXT_LLM_URL, True
    emb = _norm_base_url(embedding_base_url or "")
    if emb and u == emb:
        return CANONICAL_DOCKER_TEXT_LLM_URL, True
    return u, False
