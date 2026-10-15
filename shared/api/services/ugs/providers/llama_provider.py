#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# HTTP client for stack2 text LLM (Llama-native or OpenAI-compat): chat, generate, health, model list.
# Invariants:
# - Read timeout from unified_settings.ugs_llama_chat_read_timeout_seconds (env UGS_LLAMA_CHAT_READ_TIMEOUT_SEC).
# - keepalive_expiry on httpx pool must be >= read timeout.
# Related:
# - api.services.ugs.provider_manager_service_v2 (music_generator_lyrics, text_rag_chat)
# - documentation/platform/docker-re_doc/STACK0-LLM-OVERVIEW.md
# ---
"""
Llama / OpenAI-compat text LLM provider for UGS (chat, generate, streaming).
"""

import asyncio
import json
import logging
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import Any

import httpx  # type: ignore[import-not-found]

from api.core.redis_db_constants import (
    REDIS_DB_LLAMA_CACHE,
    STACK2_CACHE_TTL_LLAMA_MODELS,
)
from api.core.unified_config import unified_settings
from api.services.ugs.text_llm_constants import CANONICAL_DOCKER_TEXT_LLM_URL
from api.utils.llama_keep_alive import llama_keep_alive_from_settings
from api.utils.llm_openai_compat_http import (
    httpx_compat_chat_completion_json,
    httpx_compat_generate_json,
    httpx_compat_generate_text_stream,
)

# HTTP status codes
HTTP_STATUS_OK = 200
MAX_HEALTH_CHECK_INTERVAL = 300
LLAMA_CACHE_KEY = "llama:models"

logger = logging.getLogger(__name__)


class LlamaProvider:
    """
    🔥 LLAMA AI PROVIDER 🔥

    Production-ready Llama integration for text generation and analysis
    """

    def __init__(self, base_url: str = CANONICAL_DOCKER_TEXT_LLM_URL):
        """Initialize Llama provider"""
        self.base_url = base_url.rstrip("/")
        self.client: httpx.AsyncClient | None = None
        self.models_cache: dict[str, Any] = {}
        self.last_health_check: datetime | None = None
        self.health_status = False
        self._initializing = False  # Prevent multiple simultaneous initializations
        self._last_health_error: str | None = None  # For clearer "service unavailable" message

        read_sec = float(getattr(unified_settings, "ugs_llama_chat_read_timeout_seconds", 300.0) or 300.0)
        read_sec = max(60.0, min(read_sec, 3600.0))
        pool_cap = max(read_sec, 180.0)
        self._read_timeout_seconds = read_sec
        self.timeout = httpx.Timeout(pool_cap, connect=15.0, read=read_sec)
        self.max_retries = 2  # Reduced retries
        self.retry_delay = 1.0
        self.max_response_size = 10 * 1024 * 1024  # 10MB max response

    async def initialize(self) -> None:
        """Initialize HTTP client - skip health check to prevent memory issues"""
        # Prevent multiple simultaneous initializations
        if self._initializing:
            logger.warning("Llama provider already initializing, skipping")
            return

        if self.client:
            logger.info("Llama provider already initialized")
            return

        self._initializing = True
        try:
            self.client = httpx.AsyncClient(
                timeout=self.timeout,
                limits=httpx.Limits(
                    max_keepalive_connections=5,  # Reduced to prevent leaks
                    max_connections=10,  # Reduced to prevent leaks
                    keepalive_expiry=self._read_timeout_seconds + 30.0,
                ),
                follow_redirects=True,
            )

            # Skip initial health check to prevent hanging/memory issues
            # Health check will be done lazily on first use
            self.health_status = False
            logger.info("Llama provider initialized at %s (health check skipped)", self.base_url)
        finally:
            self._initializing = False

    async def close(self) -> None:
        """Close HTTP client - ensure proper cleanup"""
        if self.client:
            try:
                async with asyncio.timeout(5.0):
                    await self.client.aclose()
            except TimeoutError:
                logger.warning("Timeout closing Llama client, forcing close")
            except (httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError, OSError):  # fmt: skip
                logger.exception("Error closing Llama client")
            finally:
                self.client = None
                self.health_status = False
                logger.info("Llama provider closed")

    async def _check_health(self) -> bool:
        """Check Llama service health and update models cache (Redis DB 5 for shared cache)."""
        if not self.client:
            return False
        try:
            # Try Redis cache first (stack2 — отдельная база, меньше запросов к Llama)
            try:
                from api.core.database_manager import get_database_manager  # noqa: PLC0415

                manager = await get_database_manager()
                redis = await manager.get_redis_client(db=REDIS_DB_LLAMA_CACHE)
                if redis:
                    cached = await redis.get(LLAMA_CACHE_KEY)
                    if cached:
                        models_list = json.loads(cached)
                        if isinstance(models_list, list) and models_list:
                            self.models_cache = {
                                m.get("name", m.get("id", "")): m
                                for m in models_list
                                if isinstance(m, dict) and (m.get("name") or m.get("id"))
                            }
                            self.health_status = True
                            self._last_health_error = None
                            self.last_health_check = datetime.now(UTC)  # type: ignore[assignment]
                            logger.debug("Llama models from Redis cache: %s", len(self.models_cache))
                            return True
            except Exception as exc:  # noqa: BLE001 — Redis cache is best-effort before Llama fetch
                logger.debug("Llama models Redis read skipped: %s", exc, exc_info=True)

            timeout = httpx.Timeout(5.0, connect=3.0)
            for path, key in (("/api/tags", "models"), ("/v1/models", "data")):
                response = await self.client.get(f"{self.base_url}{path}", timeout=timeout)
                if response.status_code != HTTP_STATUS_OK:
                    continue
                data = response.json()
                if not isinstance(data, dict):
                    continue
                models_list = data.get(key, []) or []
                if key == "data":
                    self.models_cache = {}
                    for m in models_list:
                        if not isinstance(m, dict) or not m.get("id"):
                            continue
                        mid = str(m.get("id", ""))
                        entry = {**m, "name": m.get("name") or mid}
                        self.models_cache[mid] = entry
                else:
                    self.models_cache = {
                        model["name"]: model for model in models_list if isinstance(model, dict) and "name" in model
                    }
                self.health_status = True
                self._last_health_error = None
                self.last_health_check = datetime.now(UTC)  # type: ignore[assignment]
                logger.info("Llama healthy: %s models available", len(self.models_cache))

                # Save to Redis for other workers
                try:
                    from api.core.database_manager import get_database_manager  # noqa: PLC0415

                    manager = await get_database_manager()
                    redis = await manager.get_redis_client(db=REDIS_DB_LLAMA_CACHE)
                    if redis and self.models_cache:
                        await redis.setex(
                            LLAMA_CACHE_KEY,
                            STACK2_CACHE_TTL_LLAMA_MODELS,
                            json.dumps(list(self.models_cache.values()), default=str),
                        )
                except Exception as exc:  # noqa: BLE001 — Redis cache write is best-effort
                    logger.debug("Llama models Redis write skipped: %s", exc, exc_info=True)
                return True
            h = await self.client.get(f"{self.base_url}/health", timeout=timeout)
            if h.status_code == HTTP_STATUS_OK:
                try:
                    js = h.json()
                except Exception:
                    js = {}
                if isinstance(js, dict) and js.get("status") == "ok":
                    m = unified_settings.default_ai_model
                    self.models_cache = {m: {"name": m}}
                    self.health_status = True
                    self._last_health_error = None
                    self.last_health_check = datetime.now(UTC)  # type: ignore[assignment]
                    logger.info("llama.cpp server healthy at %s (model=%s)", self.base_url, m)
                    return True
            logger.warning("Llama health check failed: %s returned no models", self.base_url)
            self._last_health_error = "health endpoint returned no models or non-200"
            self.health_status = False
            return False

        except (httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError, OSError) as e:
            self._last_health_error = str(e)
            logger.exception("Llama health check error at %s: %s", self.base_url, e)
            self.health_status = False
            return False

    async def get_available_models(self) -> list[dict[str, Any]]:
        """
        Get list of available Llama models

        Returns:
            List of model information dictionaries
        """
        # Refresh cache if needed (every 5 minutes); use only our server time (not Llama container time)
        if (
            not self.last_health_check
            or (datetime.now(UTC) - self.last_health_check).total_seconds() > MAX_HEALTH_CHECK_INTERVAL
        ):
            await self._check_health()

        return list(self.models_cache.values())

    async def generate_text(
        self,
        prompt: str,
        model: str = unified_settings.default_ai_model,
        options: dict[str, Any] | None = None,
        *,  # Все последующие аргументы keyword-only
        stream: bool = False,
        json_format: bool = False,
    ) -> AsyncGenerator[dict[str, Any]]:
        """
        Generate text using Llama model

        Args:
            prompt: Input prompt
            model: Model name (e.g., "llama3.2:latest")
            options: Generation options (temperature, top_p, etc.)
            stream: Whether to stream the response
            json_format: When True and stream is False, ask the backend for JSON object output
                (Llama ``format: json``; OpenAI-compat adds a JSON-only suffix to the prompt).

        Yields:
            Generation results (full response if not streaming, chunks if streaming)
        """
        if not self.health_status:
            await self._check_health()
            if not self.health_status:
                hint = f" ({self._last_health_error})" if self._last_health_error else ""
                msg = f"Text LLM service unavailable at {self.base_url}{hint}. Ensure the stack2 text LLM (llama.cpp server or Llama) is running and reachable from the API."
                raise RuntimeError(msg)

        opts: dict[str, Any] = {}
        if options:
            opts = dict(options)
            if "max_tokens" in opts and "num_predict" not in opts:
                opts["num_predict"] = opts.pop("max_tokens")
            else:
                opts.pop("max_tokens", None)

        if model not in self.models_cache:
            logger.warning("Model %s not in cache, attempting to use anyway", model)

        if not self.client:
            msg = "Llama provider client not initialized"
            raise RuntimeError(msg)
        try:
            if not stream:
                data = await httpx_compat_generate_json(
                    self.client,
                    self.base_url,
                    model=model,
                    prompt=prompt,
                    system=None,
                    options=opts,
                    json_format=json_format,
                    keep_alive=llama_keep_alive_from_settings(),
                    timeout=self.timeout,
                )
                yield data
                return
            async for piece in httpx_compat_generate_text_stream(
                self.client,
                self.base_url,
                model=model,
                prompt=prompt,
                system=None,
                options=opts,
                timeout=self.timeout,
            ):
                yield {"response": piece, "done": False}
            yield {"response": "", "done": True}

        except (httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError, RuntimeError) as e:
            logger.exception("Llama generation error")
            msg = f"Text generation failed: {e}"
            raise RuntimeError(msg) from e

    async def chat_completion(
        self,
        messages: list[dict[str, Any]],
        model: str = unified_settings.default_ai_model,
        options: dict[str, Any] | None = None,
        stream: bool = False,
        *,
        json_format: bool = False,
    ) -> AsyncGenerator[dict[str, Any]]:
        """
        Chat completion with conversation history.

        When ``stream=False``, uses native chat APIs: ``/v1/chat/completions`` (llama-server / vLLM)
        or ``/api/chat`` (Llama), so the model chat template applies to ``messages``.

        When ``stream=True``, falls back to a single prompt + ``/v1/completions`` or ``/api/generate``
        (legacy path; no callers in-repo — prefer non-streaming chat or add streaming chat later).
        """
        if not self.health_status:
            await self._check_health()
            if not self.health_status:
                hint = f" ({self._last_health_error})" if self._last_health_error else ""
                msg = f"Text LLM service unavailable at {self.base_url}{hint}. Ensure the stack2 text LLM (llama.cpp server or Llama) is running and reachable from the API."
                raise RuntimeError(msg)

        if stream:
            if len(messages) == 1:
                raw0 = messages[0].get("content", "")
                prompt = raw0 if isinstance(raw0, str) else str(raw0) if raw0 is not None else ""
            else:
                prompt = self._format_conversation(messages)
            async for result in self.generate_text(prompt, model, options, stream=True):
                yield result
            return

        if not self.client:
            msg = "Llama provider client not initialized"
            raise RuntimeError(msg)

        opts: dict[str, Any] = {}
        if options:
            opts = dict(options)
            if "max_tokens" in opts and "num_predict" not in opts:
                opts["num_predict"] = opts.pop("max_tokens")
            else:
                opts.pop("max_tokens", None)

        if model not in self.models_cache:
            logger.warning("Model %s not in cache, attempting to use anyway", model)

        response_format: dict[str, str] | None = None
        chat_template_kwargs: dict[str, bool] | None = None
        extra_params: dict[str, Any] | None = None
        if json_format:
            response_format = {"type": "json_object"}
        if not opts.get("enable_thinking"):
            chat_template_kwargs = {"enable_thinking": False}
            extra_params = {"reasoning_format": "none"}

        try:
            data = await httpx_compat_chat_completion_json(
                self.client,
                self.base_url,
                model=model,
                messages=messages,
                options=opts,
                keep_alive=llama_keep_alive_from_settings(),
                timeout=self.timeout,
                response_format=response_format,
                chat_template_kwargs=chat_template_kwargs,
                extra_params=extra_params,
            )
            yield data
        except (httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError, RuntimeError, ValueError) as e:
            logger.exception("Llama chat_completion error")
            msg = f"Chat completion failed: {e}"
            raise RuntimeError(msg) from e

    def _format_conversation(self, messages: list[dict[str, Any]]) -> str:
        """Format conversation messages into a single prompt"""
        formatted = []

        for msg in messages:
            role = msg.get("role", "user")
            raw = msg.get("content", "")
            content = raw if isinstance(raw, str) else str(raw) if raw is not None else ""

            if role == "system":
                formatted.append(f"System: {content}")
            elif role == "user":
                formatted.append(f"User: {content}")
            elif role == "assistant":
                formatted.append(f"Assistant: {content}")

        return "\n\n".join(formatted) + "\n\nAssistant:"

    async def analyze_text(
        self,
        text: str,
        task: str,
        model: str = unified_settings.default_ai_model,
        temperature: float = 0.7,
    ) -> dict[str, Any]:
        """
        Analyze text with specific task

        Args:
            text: Text to analyze
            task: Analysis task description
            model: Model to use
            temperature: Generation temperature

        Returns:
            Analysis result
        """
        prompt = f"""Please analyze the following text according to this task: {task}

Text to analyze:
{text}

Provide a detailed analysis:"""

        options = {
            "temperature": temperature,
            "num_predict": 8156,  # Limit response length
            "top_p": 0.9,
        }

        result = None
        async for chunk in self.generate_text(prompt, model, options, stream=False):
            result = chunk
            break

        if result and "response" in result:
            return {
                "analysis": result["response"],
                "model": model,
                "tokens_used": result.get("eval_count", 0),
                "task": task,
            }
        msg = "Analysis failed - no response generated"
        raise RuntimeError(msg)

    async def get_model_info(self, model_name: str) -> dict[str, Any] | None:
        """
        Get detailed information about a specific model

        Args:
            model_name: Name of the model

        Returns:
            Model information or None if not found
        """
        # Refresh cache if needed; use only our server time
        if (
            not self.last_health_check
            or (datetime.now(UTC) - self.last_health_check).total_seconds() > MAX_HEALTH_CHECK_INTERVAL
        ):
            await self._check_health()

        return self.models_cache.get(model_name)

    async def pull_model(self, model_name: str) -> bool:
        """
        Pull (download) a model from Llama library

        Args:
            model_name: Name of model to pull

        Returns:
            Success status
        """
        if not self.client:
            msg = "Llama provider client not initialized"
            raise RuntimeError(msg)
        try:
            response = await self.client.post(
                f"{self.base_url}/api/pull",
                json={"name": model_name},
                timeout=600.0,  # Long timeout for model download
            )

            if response.status_code == HTTP_STATUS_OK:
                logger.info("Successfully pulled model: %s", model_name)
                # Refresh model cache
                await self._check_health()
                return True
            logger.error("Failed to pull model %s: HTTP %s", model_name, response.status_code)
            return False

        except (httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError, OSError):  # fmt: skip
            logger.exception("Error pulling model %s", model_name)
            return False

    async def delete_model(self, model_name: str) -> bool:
        """
        Delete a model from local Llama instance

        Args:
            model_name: Name of model to delete

        Returns:
            Success status
        """
        if not self.client:
            msg = "Llama provider client not initialized"
            raise RuntimeError(msg)
        try:
            response = await self.client.delete(
                f"{self.base_url}/api/delete", params={"name": model_name}, timeout=60.0
            )

            if response.status_code == HTTP_STATUS_OK:
                logger.info("Successfully deleted model: %s", model_name)
                # Refresh model cache
                await self._check_health()
                return True
            logger.error("Failed to delete model %s: HTTP %s", model_name, response.status_code)
            return False

        except (httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError, OSError):  # fmt: skip
            logger.exception("Error deleting model %s", model_name)
            return False

    # ========================================
    # PROVIDER INTERFACE METHODS
    # ========================================

    async def is_available(self) -> bool:
        """Check if provider is available"""
        return await self._check_health()

    async def get_capabilities(self) -> dict[str, Any]:
        """Get provider capabilities"""
        models = await self.get_available_models()

        return {
            "provider": "llama",
            "type": "llm",
            "capabilities": ["text_generation", "chat_completion", "text_analysis"],
            "models": [
                (str(m.get("name") or m.get("id") or "")).strip()
                for m in models
                if isinstance(m, dict) and (m.get("name") or m.get("id"))
            ],
            "streaming": True,
            "max_context_length": 8192,  # Default, varies by model
            "features": ["conversational", "instruction_following", "code_generation"],
        }

    async def get_status(self) -> dict[str, Any]:
        """Get provider status"""
        available = await self.is_available()
        models = list(self.models_cache.keys()) if available else []

        return {
            "provider": "llama",
            "available": available,
            "models_count": len(models),
            "models": models,
            "base_url": self.base_url,
            "last_checked": self.last_health_check.isoformat() if self.last_health_check else None,
        }
