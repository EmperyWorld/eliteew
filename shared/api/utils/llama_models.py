#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Список имён LLM через HTTP (/v1/models и /api/tags) и выбор модели по умолчанию для вызовов LlamaService.
# Invariants:
# - llama-server может не иметь /api/tags; нативный Llama — иной /v1/models: пробуем оба пути; ожидаемый 404 не уровня WRN.
# - id от llama.cpp часто с путём (/models/foo.gguf); LLAMA_MODEL в env — basename; матч по basename → server id.
# Related:
# - api/services/llama_service.py (chat route)
# ---
"""Утилита: список моделей LLM (Llama / OpenAI-compat) и дефолтная модель."""

from __future__ import annotations

import logging
import os
import time
from pathlib import PurePosixPath

import aiohttp  # type: ignore[import-not-found]
from api.core.unified_config import unified_settings

logger = logging.getLogger(__name__)

# Дефолтная модель — только LLAMA_MODEL / DEFAULT_AI_MODEL (.env.stack0.backend).
DEFAULT_MODEL = unified_settings.default_ai_model

# Кеш для списка моделей (обновляется при каждом запросе)
_models_cache: list[str] | None = None
_cache_timestamp: float = 0.0
CACHE_TTL = 60.0  # Кеш на 60 секунд


def _model_basename(model_id: str) -> str:
    """Normalize model id to basename (gemma-4-26B.gguf from /models/gemma-4-26B.gguf)."""
    raw = (model_id or "").strip()
    if not raw:
        return ""
    return PurePosixPath(raw.replace("\\", "/")).name


def resolve_model_id(requested: str, available: list[str]) -> str | None:
    """
    Map configured/requested name to an id from /v1/models.

    Exact match first; then basename match (env ``gemma-4-26B.gguf`` vs server
    ``/models/gemma-4-26B.gguf``).
    """
    want = (requested or "").strip()
    if not want or not available:
        return None
    if want in available:
        return want
    want_base = _model_basename(want)
    if not want_base:
        return None
    for mid in available:
        if _model_basename(mid) == want_base:
            return mid
    return None


async def get_available_models(force_refresh: bool = False) -> list[str]:
    """
    Получить список доступных моделей.

    Порядок: ``GET /v1/models`` (llama.cpp / vLLM), затем ``GET /api/tags`` (нативный Llama).
    """
    global _models_cache, _cache_timestamp  # noqa: PLW0603

    if not force_refresh and _models_cache is not None and (time.time() - _cache_timestamp) < CACHE_TTL:
        return _models_cache

    llama_url = os.environ.get("LLAMA_BASE_URL") or getattr(unified_settings, "llama_url", None) or ""
    base_url = llama_url.strip().rstrip("/")
    if not base_url:
        return []

    status_v1: int | None = None
    status_tags: int | None = None
    models: list[str] = []

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{base_url}/v1/models",
                timeout=aiohttp.ClientTimeout(total=5),
            ) as response:
                status_v1 = response.status
                if response.status == 200:
                    data = await response.json()
                    models = [m.get("id", "") for m in data.get("data", []) if m.get("id")]
                    if models:
                        logger.info("Found %s models via /v1/models", len(models))
                        _models_cache = models
                        _cache_timestamp = time.time()
                        return models
                elif response.status == 404:
                    logger.debug("GET /v1/models -> 404 (expected on some native Llama builds)")
                else:
                    logger.debug("GET /v1/models -> HTTP %s", response.status)

            async with session.get(
                f"{base_url}/api/tags",
                timeout=aiohttp.ClientTimeout(total=5),
            ) as response:
                status_tags = response.status
                if response.status == 200:
                    data = await response.json()
                    models = [model["name"] for model in data.get("models", [])]
                    if models:
                        logger.info("Found %s models via /api/tags", len(models))
                        _models_cache = models
                        _cache_timestamp = time.time()
                        return models
                elif response.status == 404:
                    logger.debug("GET /api/tags -> 404 (expected on llama-server / OpenAI-compat)")
                else:
                    logger.debug("GET /api/tags -> HTTP %s", response.status)

    except Exception as e:
        logger.exception("Error getting models: %s", e)
        _models_cache = [DEFAULT_MODEL]
        _cache_timestamp = time.time()
        return [DEFAULT_MODEL]

    logger.warning(
        "⚠️ No model list from /v1/models (HTTP %s) or /api/tags (HTTP %s); using configured default id only",
        status_v1,
        status_tags,
    )
    _models_cache = [DEFAULT_MODEL]
    _cache_timestamp = time.time()
    return [DEFAULT_MODEL]


async def get_default_model() -> str:
    """
    Получить дефолтную модель.

    Возвращает DEFAULT_MODEL из unified_settings (LLAMA_MODEL в .env.stack0.backend).

    Returns:
        Имя дефолтной модели
    """
    return DEFAULT_MODEL


async def get_model_or_default(requested_model: str | None = None) -> str:
    """
    Получить модель из запроса или дефолтную.

    Если модель указана и доступна - возвращает её (id как у сервера).
    Если не указана или недоступна - возвращает дефолтную (тоже через resolve).

    Args:
        requested_model: Запрошенная модель (опционально)

    Returns:
        Имя модели для использования
    """
    available_models = await get_available_models()
    want = (requested_model or "").strip() or DEFAULT_MODEL
    resolved = resolve_model_id(want, available_models)
    if resolved is not None:
        return resolved

    default_resolved = resolve_model_id(DEFAULT_MODEL, available_models)
    if default_resolved is not None:
        if want != DEFAULT_MODEL:
            logger.warning(
                "Requested model '%s' not available, using default: %s",
                want,
                default_resolved,
            )
        return default_resolved

    if want != DEFAULT_MODEL:
        logger.warning(
            "Requested model '%s' not available, using default: %s",
            want,
            DEFAULT_MODEL,
        )
    return DEFAULT_MODEL


async def is_model_available(model_name: str) -> bool:
    """
    Проверить доступность модели.

    Args:
        model_name: Имя модели для проверки

    Returns:
        True если модель доступна, False иначе
    """
    available_models = await get_available_models()
    return resolve_model_id(model_name, available_models) is not None
