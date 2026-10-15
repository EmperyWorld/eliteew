#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# AI SDK provider adapter for Llama/llama.cpp OpenAI-compatible chat, generation and embeddings.
# Invariants:
# - Embeddings use provider-native batch input when available; no synthetic vectors on backend failure.
# - The historical LLAMA_* naming may point to llama-server; backend detection remains in the compat layer.
# Related:
# - api/services/ai_sdk/embedding_service.py
# - documentation/platform/docker-re_doc/STACK0-LLM-OVERVIEW.md
# ---
"""Llama/llama.cpp provider service for the AI SDK."""

import json
import logging
from collections.abc import AsyncIterator
from typing import Any

import httpx  # type: ignore[import-not-found]
from api.core.unified_config import unified_settings
from api.utils.llama_keep_alive import llama_keep_alive_from_settings
from api.utils.llm_openai_compat_http import (
    detect_llm_backend_httpx,
    httpx_compat_embeddings_first,
    httpx_compat_embeddings_many,
    httpx_compat_generate_json,
    httpx_compat_generate_text_stream,
)

logger = logging.getLogger(__name__)


class LlamaProviderService:
    """Сервис для работы с Llama или llama-server через общий слой совместимости."""

    def __init__(self, base_url: str | None = None):
        u = (base_url or getattr(unified_settings, "llama_url", None) or "").strip().rstrip("/")
        # unified_settings.llama_url уже даёт дефолт stack2 при пустом LLAMA_URL; литерал — последняя подстраховка.
        self.base_url = u or "http://stack2-llama:11434"
        self.client = httpx.AsyncClient(timeout=120.0)

    async def generate_text(
        self,
        model: str,
        prompt: str,
        system: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> str:
        """
        Генерация текста (аналог AI SDK generateText)
        Источник: docs/ai/AI_SDK_Core/file/generateText.md
        """
        data = await httpx_compat_generate_json(
            self.client,
            self.base_url,
            model=model,
            prompt=prompt,
            system=system,
            options={"temperature": temperature, "num_predict": max_tokens or -1},
            json_format=False,
            keep_alive=llama_keep_alive_from_settings(),
            timeout=self.client.timeout,
        )
        return str(data.get("response", "") or "")

    async def stream_text(
        self, model: str, prompt: str, system: str | None = None, temperature: float = 0.7
    ) -> AsyncIterator[str]:
        """
        Стриминг текста (аналог AI SDK streamText)
        Источник: docs/ai/AI_SDK_Core/file/streamText.md
        """
        async for piece in httpx_compat_generate_text_stream(
            self.client,
            self.base_url,
            model=model,
            prompt=prompt,
            system=system,
            options={"temperature": temperature},
            timeout=self.client.timeout,
        ):
            yield piece

    async def generate_object(
        self, model: str, schema: dict[str, Any], prompt: str, system: str | None = None
    ) -> dict[str, Any]:
        """
        Генерация структурированного объекта
        Источник: docs/ai/AI_SDK_Core/file/generateObject.md
        """
        system_prompt = system or ""
        system_prompt += f"\n\nRespond matching this schema:\n{json.dumps(schema, indent=2)}"

        data = await httpx_compat_generate_json(
            self.client,
            self.base_url,
            model=model,
            prompt=prompt,
            system=system_prompt,
            options={"temperature": 0.3, "num_predict": 8192},
            json_schema=schema,
            keep_alive=llama_keep_alive_from_settings(),
            timeout=self.client.timeout,
        )
        return json.loads(data["response"] or "{}")

    async def stream_object(
        self, model: str, schema: dict[str, Any], prompt: str, system: str | None = None
    ) -> AsyncIterator[dict[str, Any]]:
        """
        Streaming генерация структурированного объекта
        Источник: docs/ai/AI_SDK_Core/file/streamObject.md
        """
        system_prompt = system or ""
        system_prompt += f"\n\nRespond matching this schema:\n{json.dumps(schema, indent=2)}"

        buffer = ""
        async for piece in httpx_compat_generate_text_stream(
            self.client,
            self.base_url,
            model=model,
            prompt=prompt,
            system=system_prompt,
            options={"temperature": 0.3},
            timeout=self.client.timeout,
        ):
            buffer += piece
            try:
                parsed = json.loads(buffer)
                yield parsed
                buffer = ""
            except json.JSONDecodeError:
                continue

    async def embed(self, text: str, model: str | None = None) -> list[float]:
        """
        Создание embeddings
        Источник: docs/ai/AI_SDK_Core/file/embed.md
        """
        effective = model or getattr(unified_settings, "embedding_ai_model", None) or "nomic-embed-text"
        embed_base = unified_settings.llama_embeddings_service_base
        force_openai = bool((getattr(unified_settings, "llama_embedding_url", None) or "").strip())
        dim_raw = int(getattr(unified_settings, "ai_embeddings_dimension", 768) or 768)
        dimensions = dim_raw if dim_raw >= 32 else None
        return await httpx_compat_embeddings_first(
            self.client,
            embed_base,
            model=str(effective),
            text=text,
            dimensions=dimensions,
            keep_alive=llama_keep_alive_from_settings(),
            timeout=self.client.timeout,
            force_openai=force_openai,
        )

    async def embed_many(self, texts: list[str], model: str | None = None) -> list[list[float]]:
        """Batch embeddings using provider-native input arrays."""
        effective = model or getattr(unified_settings, "embedding_ai_model", None) or "nomic-embed-text"
        embed_base = unified_settings.llama_embeddings_service_base
        force_openai = bool((getattr(unified_settings, "llama_embedding_url", None) or "").strip())
        dim_raw = int(getattr(unified_settings, "ai_embeddings_dimension", 768) or 768)
        dimensions = dim_raw if dim_raw >= 32 else None
        return await httpx_compat_embeddings_many(
            self.client,
            embed_base,
            model=str(effective),
            texts=texts,
            dimensions=dimensions,
            keep_alive=llama_keep_alive_from_settings(),
            timeout=self.client.timeout,
            force_openai=force_openai,
        )

    async def list_models(self) -> list[dict[str, Any]]:
        """Список доступных моделей (vLLM, llama.cpp или Llama)."""
        try:
            r = await self.client.get(f"{self.base_url}/v1/models")
            if r.status_code == 200:
                data = r.json()
                return [{"name": m.get("id", ""), "id": m.get("id", "")} for m in data.get("data", []) if m.get("id")]
        except Exception as exc:  # noqa: BLE001 — fall through to /api/tags probe
            logger.debug(
                "AI SDK list_models /v1/models skipped base_url=%s err=%s",
                self.base_url,
                exc,
                exc_info=True,
            )
        try:
            response = await self.client.get(f"{self.base_url}/api/tags")
            response.raise_for_status()
            return response.json().get("models", [])
        except Exception as exc:  # noqa: BLE001 — return configured default model list
            logger.debug(
                "AI SDK list_models /api/tags skipped base_url=%s err=%s",
                self.base_url,
                exc,
                exc_info=True,
            )
            m = unified_settings.default_ai_model
            return [{"name": m, "id": m}]

    async def health_check(self) -> bool:
        """Проверка доступности (vLLM, llama или Llama)."""
        try:
            if await detect_llm_backend_httpx(self.client, self.base_url) == "openai":
                r = await self.client.get(f"{self.base_url}/health")
                return r.status_code == 200
            r = await self.client.get(f"{self.base_url}/api/tags")
            return r.status_code == 200
        except Exception as exc:
            logger.debug("[STEP] llama_provider_health_check_skip base_url=%s err=%s", self.base_url, exc)
            return False
