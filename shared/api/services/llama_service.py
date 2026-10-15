#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# HTTP-клиент к Llama и OpenAI-совместимым бэкендам (llama.cpp, vLLM): chat, stream, generate.
# Invariants:
# - Извлечение текста из ``/v1/chat/completions`` должно поддерживать string и list content (multimodal schema).
# Related:
# - api/utils/llama_models.py, api/core/unified_config.py
# ---
"""LlamaService: Llama и OpenAI-compat HTTP для LLM."""

import asyncio
import json
import logging
import os
import time
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import Any

import aiohttp  # type: ignore[import-not-found]

from api.core.http_clients import get_aiohttp_session
from api.utils.json_safe import truncate_for_log
from api.utils.llama_keep_alive import llama_keep_alive_from_settings, pop_keep_alive_from_kwargs
from api.utils.llama_models import DEFAULT_MODEL
from api.utils.llm_openai_compat_http import normalize_llama_server_chat_response_format

logger = logging.getLogger(__name__)


def _openai_assistant_text(message: dict[str, Any]) -> str:
    """Normalize ``choices[].message`` content from OpenAI-compatible servers (string or typed parts)."""
    raw = message.get("content")
    if raw is None:
        text_out = ""
    elif isinstance(raw, str):
        text_out = raw.strip()
    elif isinstance(raw, list):
        parts: list[str] = []
        for block in raw:
            if isinstance(block, dict):
                t = block.get("text")
                if isinstance(t, str):
                    parts.append(t)
            elif isinstance(block, str):
                parts.append(block)
        text_out = "".join(parts).strip()
    else:
        text_out = str(raw).strip()
    if text_out:
        return text_out
    for k in ("reasoning_content", "reasoning"):
        v = message.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return ""


class LlamaService:
    def __init__(self, base_url: str | None = None):
        url = (base_url or os.environ.get("LLAMA_BASE_URL") or "").strip()
        if not url:
            from api.core.unified_config import unified_settings

            url = getattr(unified_settings, "llama_url", "") or ""
        self.base_url = (url or "").rstrip("/")
        self.session: aiohttp.ClientSession | None = None  # ⚡ FIX MYPY: Explicit type annotation
        self.available_models: list[dict[str, Any]] = []  # ⚡ FIX MYPY: Explicit type annotation
        self.model_info_cache: dict[str, Any] = {}  # ⚡ FIX MYPY: Explicit type annotation
        self._api_type: str | None = None  # 'llama' или 'openai' (vLLM)

    async def __aenter__(self):
        """Async context manager entry - uses central HTTP session (not closed on exit)."""
        self.session = get_aiohttp_session()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit - central session is closed at app shutdown."""
        self.session = None

    def _session(self) -> aiohttp.ClientSession:
        if self.session is None:
            self.session = get_aiohttp_session()
        assert self.session is not None
        return self.session

    async def _detect_api_type(self) -> str:
        """
        Определяет тип API: 'llama' или 'openai' (vLLM / llama.cpp server).

        Важно: сам Llama тоже отдаёт `/v1/models` (OpenAI-совместимость). Если проверять его
        первым, весь трафик помечался бы как openai, а ветка chat() для openai **не передаёт
        tools** — планировщик Безраздельного и tool-agent получали бы пустые tool_calls.
        Сначала `/health` (llama.cpp: status ok; 503 = загрузка модели — не считать Llama по /api/tags),
        затем нативный Llama `GET /api/tags`, затем `/v1/models`.
        LLAMA_USE_OPENAI_API=true — принудительно openai; false — llama.
        """
        from api.core.unified_config import unified_settings

        forced = getattr(unified_settings, "llama_use_openai_api", None)
        if forced is True:
            self._api_type = "openai"
            return "openai"
        if forced is False:
            self._api_type = "llama"
            return "llama"

        if self._api_type:
            return self._api_type

        session = self._session()
        tags_not_llama = False

        try:
            async with session.get(f"{self.base_url}/health", timeout=aiohttp.ClientTimeout(total=5)) as response:
                if response.status == 200:
                    try:
                        body = await response.json()
                    except Exception:
                        body = {}
                    if isinstance(body, dict) and body.get("status") == "ok":
                        self._api_type = "openai"
                        return "openai"
                if response.status == 503:
                    self._api_type = "openai"
                    return "openai"
        except Exception as exc:  # noqa: BLE001 — probe /health for OpenAI-compatible stack2
            logger.debug("LLM API probe /health skipped base_url=%s err=%s", self.base_url, exc, exc_info=True)

        try:
            async with session.get(f"{self.base_url}/api/tags", timeout=aiohttp.ClientTimeout(total=5)) as response:
                if response.status == 200:
                    self._api_type = "llama"
                    return "llama"
                if response.status == 404:
                    tags_not_llama = True
        except Exception as exc:  # noqa: BLE001 — probe /api/tags for native Llama
            logger.debug("LLM API probe /api/tags skipped base_url=%s err=%s", self.base_url, exc, exc_info=True)

        try:
            async with session.get(f"{self.base_url}/v1/models", timeout=aiohttp.ClientTimeout(total=5)) as response:
                if response.status == 200:
                    self._api_type = "openai"
                    return "openai"
        except Exception as exc:  # noqa: BLE001 — probe /v1/models for OpenAI-compatible stack2
            logger.debug("LLM API probe /v1/models skipped base_url=%s err=%s", self.base_url, exc, exc_info=True)

        if tags_not_llama:
            self._api_type = "openai"
            return "openai"
        logger.warning(
            "LLM API type unclear for %s (expected Llama /api/tags 200 or openai /health|/v1/models); using openai",
            self.base_url,
        )
        self._api_type = "openai"
        return "openai"

    async def generate(
        self,
        prompt: str,
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 12000,
        system_prompt: str | None = None,
        stream: bool = False,
        **kwargs,
    ) -> dict[str, Any]:
        from api.utils.llama_models import get_model_or_default

        try:
            # Определяем тип API
            api_type = await self._detect_api_type()

            # Получаем модель или дефолтную
            model = await get_model_or_default(model)

            http = self._session()

            start_time = time.time()

            if api_type == "openai":
                # Используем OpenAI API (vLLM)
                full_prompt = prompt
                if system_prompt:
                    full_prompt = f"{system_prompt}\n\n{prompt}"

                request_data = {
                    "model": model,
                    "prompt": full_prompt,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "stream": stream,
                }
                # Добавляем дополнительные параметры если они есть
                if "top_p" in kwargs:
                    request_data["top_p"] = kwargs["top_p"]

                async with http.post(f"{self.base_url}/v1/completions", json=request_data) as response:
                    if response.status == 200:
                        if stream:
                            return await self._handle_openai_streaming_response(response)
                        result = await response.json()
                        processing_time = time.time() - start_time
                        choice = result.get("choices", [{}])[0]
                        usage = result.get("usage", {})

                        return {
                            "text": choice.get("text", ""),
                            "model": model,
                            "prompt_tokens": usage.get("prompt_tokens", 0),
                            "completion_tokens": usage.get("completion_tokens", 0),
                            "processing_time": processing_time,
                            "done": True,
                            "context": [],
                        }
                    error_text = await response.text()
                    msg = f"vLLM (OpenAI) API error: {response.status} - {error_text}"
                    raise Exception(msg)
            else:
                # Используем Llama API. keep_alive из LLAMA_KEEP_ALIVE (API), не фиксированное 5m.
                request_data = {
                    "model": model,
                    "prompt": prompt,
                    "stream": stream,
                    "keep_alive": pop_keep_alive_from_kwargs(kwargs),
                    "options": {"temperature": temperature, "num_predict": max_tokens, **kwargs},
                }
                if system_prompt:
                    request_data["system"] = system_prompt

                async with http.post(f"{self.base_url}/api/generate", json=request_data) as response:
                    if response.status == 200:
                        if stream:
                            return await self._handle_streaming_response(response)
                        result = await response.json()
                        processing_time = time.time() - start_time

                        return {
                            "text": result.get("response", ""),
                            "model": model,
                            "prompt_tokens": result.get("prompt_eval_count", 0),
                            "completion_tokens": result.get("eval_count", 0),
                            "processing_time": processing_time,
                            "done": result.get("done", False),
                            "context": result.get("context", []),
                        }
                    error_text = await response.text()
                    msg = f"Llama API error: {response.status} - {error_text}"
                    raise Exception(msg)

        except Exception as e:
            logger.exception(f"LLM generate error: {e}")
            return {"text": "", "error": str(e), "model": model, "processing_time": 0}

    async def chat(
        self,
        messages: list[dict[str, Any]],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 12000,
        stream: bool = False,
        request_timeout: float | None = None,
        tools: list[dict[str, Any]] | None = None,
        strict_model: bool = False,
        tool_choice: str | dict[str, Any] | None = None,
        response_format: str | dict[str, Any] | None = None,
        **kwargs,
    ) -> dict[str, Any]:
        from api.utils.llama_models import get_model_or_default

        try:
            # Определяем тип API
            api_type = await self._detect_api_type()

            # Получаем модель или дефолтную (strict_model — без подмены, для tool-router вроде functiongemma)
            if strict_model and model:
                resolved_model = model
            else:
                resolved_model = await get_model_or_default(model)
            model = resolved_model

            http = self._session()

            start_time = time.time()
            post_timeout = aiohttp.ClientTimeout(total=float(request_timeout)) if request_timeout is not None else None
            post_kw: dict[str, Any] = {}
            if post_timeout is not None:
                post_kw["timeout"] = post_timeout

            if api_type == "openai":
                # Используем OpenAI API (vLLM)
                openai_messages = []
                for msg in messages:
                    role = msg.get("role", "user")
                    content = msg.get("content", "")
                    if role in ["system", "user", "assistant"]:
                        openai_messages.append({"role": role, "content": content})

                request_data = {
                    "model": model,
                    "messages": openai_messages,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "stream": stream,
                }
                if "top_p" in kwargs:
                    request_data["top_p"] = kwargs["top_p"]

                normalized_rf = normalize_llama_server_chat_response_format(
                    response_format,
                    strict_name="llm_chat_structured",
                )
                if normalized_rf is not None:
                    request_data["response_format"] = normalized_rf
                    chat_template_kwargs = kwargs.get("chat_template_kwargs")
                    if chat_template_kwargs is None:
                        request_data["chat_template_kwargs"] = {"enable_thinking": False}
                    elif isinstance(chat_template_kwargs, dict):
                        request_data["chat_template_kwargs"] = chat_template_kwargs
                    request_data["reasoning_format"] = kwargs.get("reasoning_format", "none")
                    request_data["reasoning_effort"] = kwargs.get("reasoning_effort", "none")

                async with http.post(
                    f"{self.base_url}/v1/chat/completions",
                    json=request_data,
                    **post_kw,
                ) as response:
                    if response.status == 200:
                        if stream:
                            return await self._handle_openai_streaming_response(response)
                        result = await response.json()
                        processing_time = time.time() - start_time
                        choice = result.get("choices", [{}])[0]
                        message = choice.get("message") or {}
                        if not isinstance(message, dict):
                            message = {}
                        usage = result.get("usage", {})
                        finish_reason = choice.get("finish_reason")
                        text_combined = _openai_assistant_text(message)
                        if not text_combined and isinstance(choice, dict):
                            legacy = choice.get("text")
                            if isinstance(legacy, str) and legacy.strip():
                                text_combined = legacy.strip()

                        return {
                            "text": text_combined,
                            "role": message.get("role", "assistant"),
                            "model": model,
                            "prompt_tokens": usage.get("prompt_tokens", 0),
                            "completion_tokens": usage.get("completion_tokens", 0),
                            "processing_time": processing_time,
                            "done": True,
                            "finish_reason": finish_reason,
                        }
                    error_text = await response.text()
                    msg = f"vLLM (OpenAI) Chat API error: {response.status} - {error_text}"
                    raise Exception(msg)
            else:
                # Используем Llama API. keep_alive из LLAMA_KEEP_ALIVE (API).
                request_data = {
                    "model": model,
                    "messages": messages,
                    "stream": stream,
                    "keep_alive": pop_keep_alive_from_kwargs(kwargs),
                    "options": {"temperature": temperature, "num_predict": max_tokens, **kwargs},
                }
                if response_format is not None:
                    request_data["format"] = response_format
                if tools:
                    request_data["tools"] = tools
                    # Без этого router-модели (functiongemma) часто отвечают текстом без tool_calls.
                    if tool_choice is not None:
                        request_data["tool_choice"] = tool_choice

                async with http.post(
                    f"{self.base_url}/api/chat",
                    json=request_data,
                    **post_kw,
                ) as response:
                    if response.status == 200:
                        if stream:
                            return await self._handle_streaming_response(response)
                        result = await response.json()
                        processing_time = time.time() - start_time

                        # Preview only: full payloads can contain user content; cap length in prod logs.
                        try:
                            raw_preview = truncate_for_log(
                                json.dumps(result, ensure_ascii=False),
                                max_chars=1200,
                            )
                            logger.info("Llama /api/chat raw result (truncated): %s", raw_preview)
                        except Exception:
                            logger.exception("Failed to log raw Llama chat result")

                        message = result.get("message", {})
                        # Некоторые модели (например, Qwen3 4B Thinking) кладут основной текст в поле "thinking"
                        text = message.get("content", "") or result.get("response", "") or message.get("thinking", "")
                        # Llama: done_reason (e.g. stop, length); align with OpenAI finish_reason for callers.
                        llama_done = result.get("done_reason")

                        return {
                            "text": text,
                            "role": message.get("role", "assistant"),
                            "model": model,
                            "prompt_tokens": result.get("prompt_eval_count", 0),
                            "completion_tokens": result.get("eval_count", 0),
                            "processing_time": processing_time,
                            "done": result.get("done", False),
                            "tool_calls": message.get("tool_calls"),
                            "finish_reason": llama_done,
                        }
                    error_text = await response.text()
                    msg = f"Llama Chat API error: {response.status} - {error_text}"
                    raise Exception(msg)

        except Exception as e:
            logger.exception(f"LLM chat error: {e}")
            return {"text": "", "error": str(e), "model": model, "processing_time": 0}

    async def chat_stream(
        self,
        messages: list[dict[str, Any]],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 12000,
        request_timeout: float | None = None,
        strict_model: bool = False,
        **kwargs,
    ) -> AsyncGenerator[str]:
        """Stream assistant tokens via ``httpx_compat_chat_completion_stream`` (stack2 slot gate)."""
        import httpx

        from api.utils.llama_models import get_model_or_default
        from api.utils.llm_openai_compat_http import httpx_compat_chat_completion_stream

        if strict_model and model:
            resolved_model = model
        else:
            resolved_model = await get_model_or_default(model)
        opts: dict[str, Any] = {
            "temperature": temperature,
            "num_predict": max_tokens,
            "openai_visible_assistant_content_only": True,
            **kwargs,
        }
        timeout_sec = float(request_timeout) if request_timeout is not None else 300.0
        timeout = httpx.Timeout(max(30.0, timeout_sec))
        try:
            async with httpx.AsyncClient() as client:
                async for piece in httpx_compat_chat_completion_stream(
                    client,
                    self.base_url,
                    model=resolved_model,
                    messages=messages,
                    options=opts,
                    timeout=timeout,
                ):
                    yield piece
        except Exception as e:
            logger.exception("chat_stream error: %s", e)
            yield f"[error] {e!s}"

    async def generate_stream(
        self,
        prompt: str,
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 12000,
        system_prompt: str | None = None,
        **kwargs,
    ) -> AsyncGenerator[str]:
        from api.utils.llama_models import get_model_or_default

        try:
            model = await get_model_or_default(model)
            http = self._session()
            api_type = await self._detect_api_type()

            if api_type == "openai":
                full_prompt = prompt
                if system_prompt:
                    full_prompt = f"{system_prompt}\n\n{prompt}"
                request_data = {
                    "model": model,
                    "prompt": full_prompt,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "stream": True,
                }
                if "top_p" in kwargs:
                    request_data["top_p"] = kwargs["top_p"]
                async with http.post(f"{self.base_url}/v1/completions", json=request_data) as response:
                    if response.status != 200:
                        err = await response.text()
                        yield f"Error: {response.status} {err[:500]}"
                        return
                    async for raw in response.content:
                        if not raw:
                            continue
                        for line in raw.decode("utf-8", errors="ignore").splitlines():
                            line = line.strip()
                            if not line.startswith("data: "):
                                continue
                            payload_s = line[6:].strip()
                            if payload_s == "[DONE]":
                                break
                            try:
                                chunk = json.loads(payload_s)
                            except json.JSONDecodeError:
                                continue
                            choice = (chunk.get("choices") or [{}])[0]
                            piece = choice.get("text") or ""
                            if isinstance(piece, str) and piece:
                                yield piece
                return

            request_data = {
                "model": model,
                "prompt": prompt,
                "stream": True,
                "keep_alive": pop_keep_alive_from_kwargs(kwargs),
                "options": {"temperature": temperature, "num_predict": max_tokens, **kwargs},
            }

            if system_prompt:
                request_data["system"] = system_prompt

            async with http.post(f"{self.base_url}/api/generate", json=request_data) as response:
                if response.status == 200:
                    async for line in response.content:
                        if line:
                            try:
                                chunk = json.loads(line.decode("utf-8"))
                                if chunk.get("response"):
                                    yield chunk["response"]
                                if chunk.get("done", False):
                                    break
                            except json.JSONDecodeError:
                                continue
                else:
                    yield f"Error: {response.status}"

        except Exception as e:
            logger.exception(f" {e}")
            yield f"Error: {e!s}"

    async def get_embeddings(self, text: str, model: str | None = None) -> dict[str, Any]:
        from api.core.unified_config import unified_settings
        from api.utils.llama_models import get_model_or_default
        from api.utils.llm_openai_compat_http import aiohttp_compat_embeddings_dict

        try:
            model = await get_model_or_default(model)
            http = self._session()
            embed_base = unified_settings.llama_embeddings_service_base
            force_openai = bool((getattr(unified_settings, "llama_embedding_url", None) or "").strip())
            dim_raw = int(getattr(unified_settings, "ai_embeddings_dimension", 768) or 768)
            dimensions = dim_raw if dim_raw >= 32 else None
            result = await aiohttp_compat_embeddings_dict(
                http,
                embed_base,
                model=model,
                input_data=text,
                dimensions=dimensions,
                keep_alive=llama_keep_alive_from_settings(),
                timeout=aiohttp.ClientTimeout(
                    total=float(getattr(unified_settings, "llama_embed_timeout_sec", 180) or 180)
                ),
                force_openai=force_openai,
            )
            emb_list = result.get("embeddings")
            vec: list[Any] = []
            if isinstance(emb_list, list) and emb_list:
                first = emb_list[0]
                if isinstance(first, list):
                    vec = first
            return {"embeddings": vec, "model": model, "text": text}

        except Exception as e:
            logger.exception(f" {e}")
            return {"embeddings": [], "error": str(e), "model": model, "text": text}

    async def list_models(self) -> list[dict[str, Any]]:
        try:
            api_type = await self._detect_api_type()

            http = self._session()

            if api_type == "openai":
                # Используем OpenAI API (vLLM / llama.cpp). У llama-server /v1/models может отсутствовать.
                async with http.get(f"{self.base_url}/v1/models") as response:
                    if response.status == 200:
                        result = await response.json()
                        models_data = result.get("data", [])
                        models = [
                            {
                                "name": m.get("id", ""),
                                "size": 0,
                                "modified_at": m.get("created", 0),
                            }
                            for m in models_data
                        ]
                        self.available_models = models
                        return models
                    if response.status == 404:
                        from api.core.unified_config import unified_settings

                        m = unified_settings.default_ai_model
                        models = [{"name": m, "size": 0, "modified_at": 0}]
                        self.available_models = models
                        return models
                    error_text = await response.text()
                    msg = f"vLLM (OpenAI) Models API error: {response.status} - {error_text}"
                    raise Exception(msg)
            else:
                # Используем Llama API
                async with http.get(f"{self.base_url}/api/tags") as response:
                    if response.status == 200:
                        result = await response.json()
                        models = result.get("models", [])

                        self.available_models = models

                        return models
                    error_text = await response.text()
                    msg = f"Llama Tags API error: {response.status} - {error_text}"
                    raise Exception(msg)

        except Exception as e:
            logger.exception(f"list_models error: {e}")
            return []

    async def get_model_info(self, model: str) -> dict[str, Any]:
        try:
            if model in self.model_info_cache:
                cache_time = self.model_info_cache[model].get("cache_time", 0)
                if time.time() - cache_time < 300:
                    return self.model_info_cache[model]["data"]

            http = self._session()

            request_data = {"name": model}

            async with http.post(f"{self.base_url}/api/show", json=request_data) as response:
                if response.status == 200:
                    result = await response.json()

                    model_info = {
                        "name": model,
                        "size": result.get("size", 0),
                        "digest": result.get("digest", ""),
                        "family": result.get("details", {}).get("family", ""),
                        "format": result.get("details", {}).get("format", ""),
                        "parameters": result.get("details", {}).get("parameter_size", ""),
                        "quantization": result.get("details", {}).get("quantization_level", ""),
                        "modified_at": result.get("modified_at", ""),
                        "template": result.get("template", ""),
                        "modelfile": result.get("modelfile", ""),
                    }

                    self.model_info_cache[model] = {"data": model_info, "cache_time": time.time()}

                    return model_info
                error_text = await response.text()
                msg = f"Llama Show API error: {response.status} - {error_text}"
                raise Exception(msg)

        except Exception as e:
            logger.exception(f" {model}: {e}")
            return {"name": model, "error": str(e)}

    async def pull_model(self, model: str) -> AsyncGenerator[dict[str, Any]]:
        try:
            http = self._session()

            request_data = {"name": model}

            async with http.post(f"{self.base_url}/api/pull", json=request_data) as response:
                if response.status == 200:
                    async for line in response.content:
                        if line:
                            try:
                                chunk = json.loads(line.decode("utf-8"))
                                yield chunk
                                if chunk.get("status") == "success":
                                    break
                            except json.JSONDecodeError:
                                continue
                else:
                    yield {"status": "error", "error": f"HTTP {response.status}"}

        except Exception as e:
            logger.exception(f" {model}: {e}")
            yield {"status": "error", "error": str(e)}

    async def delete_model(self, model: str) -> dict[str, Any]:
        try:
            http = self._session()

            request_data = {"name": model}

            async with http.delete(f"{self.base_url}/api/delete", json=request_data) as response:
                if response.status == 200:
                    if model in self.model_info_cache:
                        del self.model_info_cache[model]

                    return {"status": "success", "message": f" {model} "}
                error_text = await response.text()
                msg = f"Llama Delete API error: {response.status} - {error_text}"
                raise Exception(msg)

        except Exception as e:
            logger.exception(f" {model}: {e}")
            return {"status": "error", "error": str(e)}

    async def copy_model(self, source: str, destination: str) -> dict[str, Any]:
        try:
            http = self._session()

            request_data = {"source": source, "destination": destination}

            async with http.post(f"{self.base_url}/api/copy", json=request_data) as response:
                if response.status == 200:
                    return {"status": "success", "message": f" {source}  {destination}"}
                error_text = await response.text()
                msg = f"Llama Copy API error: {response.status} - {error_text}"
                raise Exception(msg)

        except Exception as e:
            logger.exception(f" {source} -> {destination}: {e}")
            return {"status": "error", "error": str(e)}

    async def check_health(self) -> dict[str, Any]:
        try:
            http = self._session()

            api_type = await self._detect_api_type()
            start_time = time.time()
            health_url = f"{self.base_url}/v1/models" if api_type == "openai" else f"{self.base_url}/api/tags"

            async with http.get(health_url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                response_time = time.time() - start_time

                if response.status == 200:
                    result = await response.json()
                    if api_type == "openai":
                        models_count = len(result.get("data", []))
                    else:
                        models_count = len(result.get("models", []))

                    return {
                        "status": "healthy",
                        "response_time": response_time,
                        "models_available": models_count,
                        "base_url": self.base_url,
                        "api_type": api_type,
                        "timestamp": datetime.now(UTC).isoformat(),
                    }
                return {
                    "status": "unhealthy",
                    "error": f"HTTP {response.status}",
                    "response_time": response_time,
                    "base_url": self.base_url,
                    "timestamp": datetime.now(UTC).isoformat(),
                }

        except Exception as e:
            return {
                "status": "unavailable",
                "error": str(e),
                "base_url": self.base_url,
                "timestamp": datetime.now(UTC).isoformat(),
            }

    async def _handle_streaming_response(self, response) -> dict[str, Any]:
        full_response = ""
        tokens_count = 0

        async for line in response.content:
            if line:
                try:
                    chunk = json.loads(line.decode("utf-8"))
                    if chunk.get("response"):
                        full_response += chunk["response"]
                        tokens_count += 1
                    if chunk.get("done", False):
                        return {"text": full_response, "tokens_count": tokens_count, "done": True}
                except json.JSONDecodeError:
                    continue

        return {"text": full_response, "tokens_count": tokens_count, "done": True}

    async def _handle_openai_streaming_response(self, response) -> dict[str, Any]:
        """Обработка streaming ответа от OpenAI API (vLLM)"""
        full_response = ""
        tokens_count = 0

        async for line in response.content:
            if line:
                try:
                    line_text = line.decode("utf-8").strip()
                    if line_text.startswith("data: "):
                        data_text = line_text[6:]  # Убираем "data: "
                        if data_text == "[DONE]":
                            break
                        chunk = json.loads(data_text)
                        choice = chunk.get("choices", [{}])[0]
                        delta = choice.get("delta", {})
                        if "content" in delta:
                            content = delta["content"]
                            full_response += content
                            tokens_count += 1
                except json.JSONDecodeError:
                    continue

        return {"text": full_response, "tokens_count": tokens_count, "done": True}

    def format_chat_messages(self, messages: list[dict[str, str]]) -> list[dict[str, str]]:
        formatted_messages = []

        for message in messages:
            role = message.get("role", "user")
            content = message.get("content", "")

            if role not in ["system", "user", "assistant"]:
                role = "user"

            formatted_messages.append({"role": role, "content": content})

        return formatted_messages

    def estimate_tokens(self, text: str) -> int:
        return len(text) // 4

    def truncate_text(self, text: str, max_tokens: int) -> str:
        estimated_tokens = self.estimate_tokens(text)

        if estimated_tokens <= max_tokens:
            return text

        max_chars = max_tokens * 3
        if len(text) <= max_chars:
            return text

        sentences = text.split(".")
        truncated = ""

        for sentence in sentences:
            test_text = truncated + sentence + "."
            if self.estimate_tokens(test_text) > max_tokens:
                break
            truncated = test_text

        return truncated if truncated else text[:max_chars]

    async def get_recommended_models(self) -> list[dict[str, Any]]:
        return [
            {
                "name": DEFAULT_MODEL,
                "description": "Везде лама",
                "size": "2.0GB",
                "tasks": ["text", "chat", "analysis"],
                "performance": "high",
                "recommended_for": "Везде лама",
            },
            {
                "name": DEFAULT_MODEL,
                "description": "Везде лама",
                "size": "4.7GB",
                "tasks": ["text", "analysis", "reasoning"],
                "performance": "very_high",
                "recommended_for": "Везде лама",
            },
            {
                "name": "codellama:latest",
                "description": "Везде лама",
                "size": "3.8GB",
                "tasks": ["code", "analysis"],
                "performance": "high",
                "recommended_for": "Везде лама",
            },
            {
                "name": "mistral:latest",
                "description": "Везде лама",
                "size": "4.1GB",
                "tasks": ["text", "chat", "summarization"],
                "performance": "high",
                "recommended_for": "Везде лама",
            },
            {
                "name": "neural-chat:latest",
                "description": "Везде лама",
                "size": "4.1GB",
                "tasks": ["chat", "instructions"],
                "performance": "high",
                "recommended_for": "Везде лама",
            },
        ]

    async def optimize_for_task(self, task_type: str) -> dict[str, Any]:
        optimization_settings = {
            "extract": {
                "temperature": 0.1,
                "top_p": 0.9,
                "top_k": 10,
                "recommended_model": DEFAULT_MODEL,
                "description": "extract",
            },
            "summarize": {
                "temperature": 0.4,
                "top_p": 0.95,
                "top_k": 20,
                "recommended_model": DEFAULT_MODEL,
                "description": "summarize",
            },
            "classify": {
                "temperature": 0.2,
                "top_p": 0.9,
                "top_k": 15,
                "recommended_model": DEFAULT_MODEL,
                "description": "classify",
            },
            "translate": {
                "temperature": 0.3,
                "top_p": 0.95,
                "top_k": 25,
                "recommended_model": DEFAULT_MODEL,
                "description": "translate",
            },
            "chat": {
                "temperature": 0.7,
                "top_p": 0.95,
                "top_k": 40,
                "recommended_model": DEFAULT_MODEL,
                "description": "chat",
            },
            "creative": {
                "temperature": 0.8,
                "top_p": 0.98,
                "top_k": 50,
                "recommended_model": DEFAULT_MODEL,
                "description": "creative",
            },
        }

        return optimization_settings.get(
            task_type,
            {
                "temperature": 0.7,
                "top_p": 0.95,
                "top_k": 30,
                "recommended_model": DEFAULT_MODEL,
                "description": "EW",
            },
        )

    async def batch_generate(
        self,
        prompts: list[str],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 12000,
        max_concurrent: int = 3,
    ) -> list[dict[str, Any]]:
        from api.utils.llama_models import get_model_or_default

        # Получаем модель или дефолтную
        model = await get_model_or_default(model)

        semaphore = asyncio.Semaphore(max_concurrent)

        async def generate_single(prompt: str, index: int) -> dict[str, Any]:
            async with semaphore:
                result = await self.generate(prompt=prompt, model=model, temperature=temperature, max_tokens=max_tokens)
                result["prompt_index"] = index
                return result

        tasks = [generate_single(prompt, i) for i, prompt in enumerate(prompts)]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        processed_results: list[dict[str, Any]] = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append({"prompt_index": i, "text": "", "error": str(result), "model": model})
            else:
                # Type narrowing: result is dict[str, Any] here
                if isinstance(result, dict):
                    processed_results.append(result)
                else:
                    # Fallback for unexpected types
                    processed_results.append({"prompt_index": i, "text": str(result), "model": model})

        return processed_results
