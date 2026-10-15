# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Direct stack2 LLM calls for marketing AMKA: JSON plan/audit/autofill via ``format=json``, plain text for prose.
# Invariants:
# - ``amka_llm_json*`` and ``amka_llm_json_raw`` always set ``json_format=True`` on ``httpx_compat_generate_json``.
# - Parse failures in ``amka_llm_json*`` return empty dict with reason meta; never raise to plan orchestration callers.
# Related:
# - api/services/marketing_cabinet/amka_llm_plan.py
# - api/utils/llm_openai_compat_http.py
# ---
"""AMKA Llama/OpenAI-compat JSON and text calls (no AmkaService dependency)."""

from __future__ import annotations

from typing import Any

import httpx  # type: ignore[import-not-found]

from api.core.unified_config import unified_settings
from api.services.marketing_cabinet.amka_llm_json import amka_parse_model_json_detail
from api.utils.llm_openai_compat_http import httpx_compat_generate_json


async def amka_llm_json_with_parse_meta(
    *,
    prompt: str,
    max_tokens: int = 2200,
    temperature: float = 0.15,
) -> tuple[dict[str, Any], str, int, str]:
    """dict из модели, причина разбора, длина сырого текста, сырой текст ответа (может быть пустым)."""
    base_url = str(unified_settings.llama_url or "").strip()
    model = str(unified_settings.llama_model_marketing or unified_settings.marketing_cabinet_router_model or "").strip()
    if not base_url or not model:
        raise RuntimeError("LLM is not configured for AMKA")
    timeout = httpx.Timeout(timeout=300.0, connect=10.0)
    async with httpx.AsyncClient() as client:
        payload = await httpx_compat_generate_json(
            client,
            base_url,
            model=model,
            prompt=prompt,
            options={"temperature": temperature, "num_predict": max(512, int(max_tokens))},
            json_format=True,
            timeout=timeout,
        )
    raw = str(payload.get("response") or payload.get("text") or "").strip()
    if not raw:
        return {}, "empty_model_response", 0, ""
    data, reason = amka_parse_model_json_detail(raw)
    return data, reason, len(raw), raw


async def amka_llm_json(*, prompt: str, max_tokens: int = 2200) -> dict[str, Any]:
    data, _reason, _n, _raw = await amka_llm_json_with_parse_meta(prompt=prompt, max_tokens=max_tokens)
    return data


async def amka_llm_json_raw(
    *,
    prompt: str,
    max_tokens: int = 3200,
    temperature: float = 0.2,
) -> str:
    """Structured JSON text via stack2 ``format=json`` (llama.cpp grammar); for document-autofill parsers."""
    base_url = str(unified_settings.llama_url or "").strip()
    model = str(unified_settings.llama_model_marketing or unified_settings.marketing_cabinet_router_model or "").strip()
    if not base_url or not model:
        raise RuntimeError("LLM is not configured for AMKA")
    timeout = httpx.Timeout(timeout=360.0, connect=10.0)
    async with httpx.AsyncClient() as client:
        payload = await httpx_compat_generate_json(
            client,
            base_url,
            model=model,
            prompt=prompt,
            options={"temperature": temperature, "num_predict": max(512, int(max_tokens))},
            json_format=True,
            timeout=timeout,
        )
    raw = str(payload.get("response") or payload.get("text") or "").strip()
    if not raw:
        raise RuntimeError("AMKA model returned empty structured JSON response")
    return raw


async def amka_llm_text(
    *,
    prompt: str,
    max_tokens: int = 3200,
    temperature: float = 0.2,
) -> str:
    base_url = str(unified_settings.llama_url or "").strip()
    model = str(unified_settings.llama_model_marketing or unified_settings.marketing_cabinet_router_model or "").strip()
    if not base_url or not model:
        raise RuntimeError("LLM is not configured for AMKA")
    timeout = httpx.Timeout(timeout=360.0, connect=10.0)
    async with httpx.AsyncClient() as client:
        payload = await httpx_compat_generate_json(
            client,
            base_url,
            model=model,
            prompt=prompt,
            options={"temperature": temperature, "num_predict": max(512, int(max_tokens))},
            json_format=False,
            timeout=timeout,
        )
    raw = str(payload.get("response") or payload.get("text") or "").strip()
    if not raw:
        raise RuntimeError("AMKA model returned empty response")
    return raw
