# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# HTTP helpers that probe ``/health`` + ``/api/tags`` vs ``/v1/models`` to choose Llama vs OpenAI-compatible
# llama.cpp servers; normalize chat (``/api/chat``, streaming), generate, and embeddings.
# Invariants:
# - upper bounds for ``num_predict``/``max_tokens`` and optional ``num_ctx`` stay aligned with stack chat KV (256k-class).
# - OpenAI-compat **streaming** collects ``delta.content`` and, when empty (default), ``delta.reasoning_content`` /
#   ``delta.reasoning`` / ``delta.thinking`` — except when ``openai_visible_assistant_content_only`` is set (companion UX:
#   never surface CoT as the main reply). Non-stream **JSON chat** may merge reasoning into ``response`` when
#   ``openai_sidecar_merge_reasoning`` is set (trust/intent sidecars with empty ``content``).
# - OpenAI-compat **non-stream and stream chat** send ``response_format`` / ``chat_template_kwargs`` /
#   ``extra_params`` (e.g. ``reasoning_format``) on ``/v1/chat/completions`` when provided.
#   ``httpx_compat_generate_json`` / ``aiohttp_compat_generate_json`` skip legacy ``/v1/completions`` when
#   ``json_format``/``json_schema`` is set or when backend probe saw llama-server ``/health`` ok (chat-tuned stack2
#   models fail completions parser at pos 0); use chat-completions directly.
#   Native Llama ``/api/chat`` maps ``response_format`` to ``format`` (``"json"`` or JSON Schema object) via
#   ``llama_native_format_from_response_format``; OpenAI-only keys (incl. ``chat_template_kwargs``) are never
#   forwarded on the native branch.
# - Main chat LLM HTTP (``stack2-llama-chat``) is gated by ``stack2_text_llm_slot`` (``LLAMA_CHAT_PARALLEL``) so API
#   concurrency matches llama-server slot count and avoids ``ServerDisconnected`` under parallel autofill + stream.
# - Optional request/response dumps: non-empty ``STACK2_LLM_DEBUG_SAVE_DIR`` → each outbound JSON body is written under
#   ``<dir>/<kind>/`` before POST; the matching HTTP response is written under ``<dir>/responses/<kind>/`` with the same
#   ``correlation_stem`` filename (embedding vectors in JSON are truncated to preview+len for file size).
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# - api/services/ugs/providers/imc_rag_research_provider.py
# - documentation/platform/docker-re_doc/STACK0-LLM-OVERVIEW.md
# ---
"""Llama JSON API vs llama.cpp OpenAI-compatible (/health, /v1/completions, /v1/embeddings)."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal
from uuid import uuid4

import aiohttp
import httpx
from api.utils.stack2_text_llm_slot import maybe_stack2_text_llm_slot

logger = logging.getLogger(__name__)


def _stack2_llm_debug_save_dir() -> str:
    return os.environ.get("STACK2_LLM_DEBUG_SAVE_DIR", "").strip()


def _new_stack2_llm_debug_stem() -> str:
    ts = datetime.now(UTC).strftime("%Y%m%d_%H%M%S_%f")
    return f"stack2_llm_{ts}_{uuid4().hex[:8]}"


def _maybe_save_stack2_llm_request_sync(
    *,
    kind: str,
    base_url: str,
    http_path: str,
    body: dict[str, Any],
) -> str | None:
    """Write one JSON file if ``STACK2_LLM_DEBUG_SAVE_DIR`` is set. Returns correlation stem (filename without .json)."""

    if not _stack2_llm_debug_save_dir():
        return None
    try:
        root = Path(_stack2_llm_debug_save_dir()).expanduser()
        safe_kind = re.sub(r"[^a-z0-9_-]+", "_", (kind or "request").lower())[:48].strip("_") or "request"
        out_dir = root / safe_kind
        out_dir.mkdir(parents=True, exist_ok=True)
        stem = _new_stack2_llm_debug_stem()
        fname = f"{stem}.json"
        envelope: dict[str, Any] = {
            "saved_at": datetime.now(UTC).isoformat(),
            "kind": kind,
            "base_url": (base_url or "").strip().rstrip("/"),
            "path": http_path,
            "correlation_stem": stem,
            "request_body": body,
        }
        (out_dir / fname).write_text(
            json.dumps(envelope, ensure_ascii=False, indent=2, default=str) + "\n",
            encoding="utf-8",
        )
        return stem
    except OSError as e:
        logger.warning("stack2 LLM debug save failed (IO): %s", e)
    except Exception:
        logger.warning("stack2 LLM debug save failed", exc_info=True)
    return None


def _slim_debug_json_for_disk(obj: Any, *, embed_preview: int = 8) -> Any:
    """Drop huge ``embedding`` arrays from OpenAI-compat embed responses (keep len + short preview)."""

    if isinstance(obj, dict):
        out: dict[str, Any] = {}
        for k, v in obj.items():
            if k == "embedding" and isinstance(v, list) and len(v) > embed_preview:
                out["embedding_len"] = len(v)
                out["embedding_preview"] = v[:embed_preview]
            else:
                out[k] = _slim_debug_json_for_disk(v, embed_preview=embed_preview)
        return out
    if isinstance(obj, list):
        return [_slim_debug_json_for_disk(x, embed_preview=embed_preview) for x in obj]
    return obj


def _maybe_save_stack2_llm_response_sync(
    *,
    kind: str,
    base_url: str,
    http_path: str,
    stem: str | None,
    http_status: int,
    response_json: Any | None = None,
    response_text: str | None = None,
    stream_aggregated_text: str | None = None,
    error_message: str | None = None,
) -> None:
    """Write response envelope next to request dumps under ``responses/<kind>/`` (debug only)."""

    if not stem or not _stack2_llm_debug_save_dir():
        return
    try:
        root = Path(_stack2_llm_debug_save_dir()).expanduser()
        safe_kind = re.sub(r"[^a-z0-9_-]+", "_", (kind or "response").lower())[:48].strip("_") or "response"
        out_dir = root / "responses" / safe_kind
        out_dir.mkdir(parents=True, exist_ok=True)
        envelope: dict[str, Any] = {
            "saved_at": datetime.now(UTC).isoformat(),
            "kind": kind,
            "base_url": (base_url or "").strip().rstrip("/"),
            "path": http_path,
            "correlation_stem": stem,
            "http_status": int(http_status),
        }
        if error_message:
            envelope["error_message"] = error_message
        if stream_aggregated_text is not None:
            envelope["stream_aggregated_text"] = stream_aggregated_text
        if response_text is not None:
            envelope["response_text_preview"] = response_text[:50_000]
        if response_json is not None:
            envelope["response_body"] = _slim_debug_json_for_disk(response_json)
        (out_dir / f"{stem}.json").write_text(
            json.dumps(envelope, ensure_ascii=False, indent=2, default=str) + "\n",
            encoding="utf-8",
        )
    except OSError as e:
        logger.warning("stack2 LLM debug response save failed (IO): %s", e)
    except Exception:
        logger.warning("stack2 LLM debug response save failed", exc_info=True)


async def _maybe_save_stack2_llm_request(
    *,
    kind: str,
    base_url: str,
    http_path: str,
    body: dict[str, Any],
) -> str | None:
    if not _stack2_llm_debug_save_dir():
        return None
    try:
        return await asyncio.to_thread(
            _maybe_save_stack2_llm_request_sync,
            kind=kind,
            base_url=base_url,
            http_path=http_path,
            body=body,
        )
    except Exception:
        logger.warning("stack2 LLM debug save schedule failed", exc_info=True)
        return None


async def _maybe_save_stack2_llm_response(
    *,
    kind: str,
    base_url: str,
    http_path: str,
    stem: str | None,
    http_status: int,
    response_json: Any | None = None,
    response_text: str | None = None,
    stream_aggregated_text: str | None = None,
    error_message: str | None = None,
) -> None:
    if not stem or not _stack2_llm_debug_save_dir():
        return
    try:
        await asyncio.to_thread(
            _maybe_save_stack2_llm_response_sync,
            kind=kind,
            base_url=base_url,
            http_path=http_path,
            stem=stem,
            http_status=http_status,
            response_json=response_json,
            response_text=response_text,
            stream_aggregated_text=stream_aggregated_text,
            error_message=error_message,
        )
    except Exception:
        logger.warning("stack2 LLM debug response save schedule failed", exc_info=True)


# Options passed to Llama ``/api/chat`` / compat layers (256 Ki tokens — class, not model-specific limit).
LLAMA_COMPAT_MAX_NUM_PREDICT: int = 262_144
LLAMA_COMPAT_MAX_NUM_CTX: int = 262_144

Backend = Literal["llama", "openai"]
# Keys ``httpx_compat_chat_completion_json`` will never take from ``extra_params`` (must stay caller-controlled).
_OPENAI_CHAT_BODY_LOCKED_KEYS = frozenset({"model", "messages", "stream"})
_backend_cache: dict[str, Backend] = {}
_openai_model_ids_cache: dict[str, list[str]] = {}
_openai_generate_prefers_chat_completion: set[str] = set()


def _norm_base(base: str) -> str:
    return (base or "").strip().rstrip("/")


def pick_resolved_openai_model_id(requested: str, ids: list[str]) -> str | None:
    """Map a configured model name to a server ``id`` from GET /v1/models (llama.cpp is strict)."""
    req = (requested or "").strip()
    if not req or not ids:
        return None
    # Basename match (env ``gemma-4-26B.gguf`` ↔ server ``/models/gemma-4-26B.gguf``).
    from api.utils.llama_models import resolve_model_id

    by_base = resolve_model_id(req, ids)
    if by_base:
        return by_base
    # Sentinel used by callers when settings field is missing — sole loaded model wins.
    if req.casefold() in {"local", "default", "auto"} and len(ids) == 1:
        return ids[0]
    id_set = set(ids)
    if req in id_set:
        return req
    lower_to_canon = {i.lower(): i for i in ids}
    rl = req.lower()
    if rl in lower_to_canon:
        return lower_to_canon[rl]
    stem = req.removesuffix(".gguf").strip()
    if stem:
        if stem in id_set:
            return stem
        sl = stem.lower()
        if sl in lower_to_canon:
            return lower_to_canon[sl]
        ended = [i for i in ids if i == stem or i.endswith("/" + stem) or i.endswith(stem)]
        if len(ended) == 1:
            return ended[0]
        if len(ended) > 1:
            ended.sort(key=len)
            logger.warning(
                "llm openai-compat: ambiguous model stem %r matches %s; picking %r",
                stem,
                ended[:5],
                ended[0],
            )
            return ended[0]
    if stem and len(stem) >= 6:
        subs = [i for i in ids if stem.lower() in i.lower()]
        if len(subs) == 1:
            return subs[0]
        if len(subs) > 1:
            subs.sort(key=len)
            logger.warning(
                "llm openai-compat: ambiguous substring for %r among %s; picking %r",
                requested,
                subs[:5],
                subs[0],
            )
            return subs[0]
    return None


async def _fetch_openai_model_ids_httpx(client: httpx.AsyncClient, base: str) -> list[str]:
    b = _norm_base(base)
    try:
        r = await client.get(f"{b}/v1/models", timeout=4.0)
        if r.status_code != 200:
            return []
        data = r.json()
        rows = data.get("data") if isinstance(data, dict) else None
        out: list[str] = []
        if isinstance(rows, list):
            for row in rows:
                if isinstance(row, dict):
                    mid = row.get("id")
                    if isinstance(mid, str) and mid.strip():
                        out.append(mid.strip())
        return out
    except (TimeoutError, httpx.HTTPError, OSError, ValueError, TypeError) as e:
        logger.debug("GET /v1/models failed for %s: %s", b, e)
        return []


async def _cached_openai_model_ids_httpx(client: httpx.AsyncClient, base: str) -> list[str]:
    b = _norm_base(base)
    if b in _openai_model_ids_cache:
        return _openai_model_ids_cache[b]
    ids = await _fetch_openai_model_ids_httpx(client, b)
    _openai_model_ids_cache[b] = ids
    return ids


async def _resolve_openai_model_for_httpx(
    client: httpx.AsyncClient,
    base_url: str,
    model: str,
) -> str:
    """If the text server exposes /v1/models, rewrite unknown ``model`` strings (e.g. ``.gguf`` filenames)."""
    b = _norm_base(base_url)
    req = (model or "").strip()
    if not b or not req:
        return req
    ids = await _cached_openai_model_ids_httpx(client, b)
    if not ids:
        return req
    picked = pick_resolved_openai_model_id(req, ids)
    if picked:
        if picked != req:
            logger.info(
                "llm openai-compat: resolved model %r -> %r (server %s/v1/models)",
                req,
                picked,
                b,
            )
        return picked
    logger.warning(
        "llm openai-compat: model %r not listed in /v1/models for %s (n=%s sample=%s); "
        "llama.cpp often returns empty text for wrong ids",
        req,
        b,
        len(ids),
        ids[:12],
    )
    return req


def invalidate_llm_backend_cache(url: str | None = None) -> None:
    if url is None:
        _backend_cache.clear()
        _openai_model_ids_cache.clear()
        _openai_generate_prefers_chat_completion.clear()
    else:
        nb = _norm_base(url)
        _backend_cache.pop(nb, None)
        _openai_model_ids_cache.pop(nb, None)
        _openai_generate_prefers_chat_completion.discard(nb)


def _prefer_chat_completion_for_generate(base_url: str) -> bool:
    return _norm_base(base_url) in _openai_generate_prefers_chat_completion


def _mark_prefer_chat_completion_for_generate(base_url: str, *, reason: str) -> None:
    base = _norm_base(base_url)
    if not base:
        return
    if base in _openai_generate_prefers_chat_completion:
        return
    _openai_generate_prefers_chat_completion.add(base)
    logger.info(
        "llm openai-compat: generate-json prefers /v1/chat/completions for %s after %s",
        base,
        reason,
    )


def _should_retry_generate_as_chat(status_code: int, error_text: str) -> tuple[bool, str]:
    """Detect OpenAI-compat completions failures that should transparently fall back to chat completions."""

    if status_code in (400, 404, 422):
        return True, f"/v1/completions_http_{status_code}"
    text_cf = (error_text or "").casefold()
    # llama.cpp may return HTTP 500 for /v1/completions with this parser error while
    # /v1/chat/completions succeeds for the same model/prompt.
    if status_code == 500 and ("content-only format" in text_cf or "content-only output" in text_cf):
        return True, "content_only_format_500"
    if status_code == 500 and (
        "failed to parse input at pos" in text_cf or ("failed to parse input" in text_cf and "pos 0" in text_cf)
    ):
        return True, "parse_input_500"
    return False, ""


async def detect_llm_backend_aiohttp(session: aiohttp.ClientSession, base_url: str) -> Backend:
    base = _norm_base(base_url)
    if not base:
        return "openai"
    if base in _backend_cache:
        return _backend_cache[base]
    to = aiohttp.ClientTimeout(total=4)
    tags_not_llama = False
    # Сначала /health: llama.cpp отдаёт {"status":"ok"} и при этом может имитировать GET /api/tags (200),
    # но POST /api/generate у llama нет — нельзя считать сервер нативным Llama только по /api/tags.
    try:
        async with session.get(f"{base}/health", timeout=to) as r:
            if r.status == 200:
                try:
                    js = await r.json()
                except Exception:
                    js = {}
                if isinstance(js, dict) and js.get("status") == "ok":
                    _backend_cache[base] = "openai"
                    _mark_prefer_chat_completion_for_generate(base, reason="llama_server_health_ok")
                    return "openai"
            # llama.cpp: модель грузится — не опираться на /api/tags как на Llama
            if r.status == 503:
                _backend_cache[base] = "openai"
                return "openai"
    except (TimeoutError, aiohttp.ClientError, OSError) as e:
        logger.debug("llm backend probe /health %s: %s", base, e)
    try:
        async with session.get(f"{base}/api/tags", timeout=to) as r:
            if r.status == 200:
                _backend_cache[base] = "llama"
                return "llama"
            if r.status == 404:
                tags_not_llama = True
    except (TimeoutError, aiohttp.ClientError, OSError) as e:
        logger.debug("llm backend probe /api/tags %s: %s", base, e)
    try:
        async with session.get(f"{base}/v1/models", timeout=to) as r:
            if r.status == 200:
                _backend_cache[base] = "openai"
                return "openai"
    except (TimeoutError, aiohttp.ClientError, OSError) as e:
        logger.debug("llm backend probe /v1/models %s: %s", base, e)
    if tags_not_llama:
        _backend_cache[base] = "openai"
        return "openai"
    logger.warning(
        "llm backend unclear for %s (no /health ok, no /api/tags 200, no /v1/models 200); using openai",
        base,
    )
    _backend_cache[base] = "openai"
    return "openai"


async def detect_llm_backend_httpx(client: httpx.AsyncClient, base_url: str) -> Backend:
    base = _norm_base(base_url)
    if not base:
        return "openai"
    if base in _backend_cache:
        return _backend_cache[base]
    tags_not_llama = False
    try:
        r = await client.get(f"{base}/health", timeout=4.0)
        if r.status_code == 200:
            try:
                js = r.json()
            except Exception:
                js = {}
            if isinstance(js, dict) and js.get("status") == "ok":
                _backend_cache[base] = "openai"
                _mark_prefer_chat_completion_for_generate(base, reason="llama_server_health_ok")
                return "openai"
        if r.status_code == 503:
            _backend_cache[base] = "openai"
            return "openai"
    except (TimeoutError, httpx.HTTPError, OSError) as e:
        logger.debug("httpx backend probe /health %s: %s", base, e)
    try:
        r = await client.get(f"{base}/api/tags", timeout=4.0)
        if r.status_code == 200:
            _backend_cache[base] = "llama"
            return "llama"
        if r.status_code == 404:
            tags_not_llama = True
    except (TimeoutError, httpx.HTTPError, OSError) as e:
        logger.debug("httpx backend probe /api/tags %s: %s", base, e)
    try:
        r = await client.get(f"{base}/v1/models", timeout=4.0)
        if r.status_code == 200:
            _backend_cache[base] = "openai"
            return "openai"
    except (TimeoutError, httpx.HTTPError, OSError) as e:
        logger.debug("httpx backend probe /v1/models %s: %s", base, e)
    if tags_not_llama:
        _backend_cache[base] = "openai"
        return "openai"
    logger.warning(
        "httpx llm backend unclear for %s (no /health ok, no /api/tags 200, no /v1/models 200); using openai",
        base,
    )
    _backend_cache[base] = "openai"
    return "openai"


def _apply_num_ctx_to_llama_options(opts: dict[str, Any], llama_opts: dict[str, Any]) -> None:
    """Copy ``num_ctx`` from caller options into Llama ``/api/chat`` ``options`` when set and positive."""

    if "num_ctx" not in opts:
        return
    try:
        nc = int(opts["num_ctx"])
    except (TypeError, ValueError):  # fmt: skip
        return
    if nc <= 0:
        return
    llama_opts["num_ctx"] = max(2048, min(nc, LLAMA_COMPAT_MAX_NUM_CTX))


def max_tokens_from_llama_options(options: dict[str, Any] | None, default: int = 2048) -> int:
    if not options:
        return default
    n = options.get("num_predict", default)
    try:
        ni = int(n)
        if ni <= 0 or ni > LLAMA_COMPAT_MAX_NUM_PREDICT:
            return default
        return ni
    except (TypeError, ValueError):  # fmt: skip
        return default


def _normalize_openai_chat_content(raw: Any, *, role: str) -> str | list[dict[str, Any]]:
    if isinstance(raw, list):
        if role != "user":
            text_bits = [
                str(part.get("text", "") or "") for part in raw if isinstance(part, dict) and part.get("type") == "text"
            ]
            joined = "\n".join(t.strip() for t in text_bits if t.strip()).strip()
            return joined
        parts: list[dict[str, Any]] = []
        for part in raw:
            if not isinstance(part, dict):
                continue
            ptype = str(part.get("type") or "").strip()
            if ptype == "text":
                text = str(part.get("text") or "").strip()
                if text:
                    parts.append({"type": "text", "text": text})
            elif ptype == "image_url":
                image_url = part.get("image_url")
                if isinstance(image_url, dict):
                    url = str(image_url.get("url") or "").strip()
                else:
                    url = str(image_url or "").strip()
                if url.startswith("data:image/"):
                    parts.append({"type": "image_url", "image_url": {"url": url}})
        if not parts:
            msg = "No supported multimodal user content (text and/or image_url required)"
            raise ValueError(msg)
        return parts
    if isinstance(raw, str):
        return raw
    if raw is None:
        return ""
    return str(raw)


def openai_compatible_chat_messages(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep system/user/assistant rows; user may carry OpenAI multimodal ``content`` (llama-server vision)."""
    from api.utils.llm_json_extract import strip_llm_thinking_prefix

    out: list[dict[str, Any]] = []
    for msg in messages:
        role = str(msg.get("role", "user")).strip()
        if role not in ("system", "user", "assistant"):
            continue
        content = _normalize_openai_chat_content(msg.get("content", ""), role=role)
        if isinstance(content, str):
            content = strip_llm_thinking_prefix(content)
            if not content.strip():
                continue
        elif isinstance(content, list):
            cleaned_parts: list[dict[str, Any]] = []
            for part in content:
                if not isinstance(part, dict):
                    continue
                if part.get("type") == "text":
                    text = strip_llm_thinking_prefix(str(part.get("text") or ""))
                    if text.strip():
                        cleaned_parts.append({"type": "text", "text": text})
                elif part.get("type") == "image_url":
                    cleaned_parts.append(part)
            if not cleaned_parts:
                continue
            content = cleaned_parts
        if isinstance(content, str) and not content.strip():
            continue
        out.append({"role": role, "content": content})
    if not out:
        msg = "No supported chat messages (roles system, user, assistant with text content required)"
        raise ValueError(msg)
    return out


def normalize_openai_tool_choice_for_llama_server(
    tool_choice: str | dict[str, Any] | None,
) -> str | None:
    """llama.cpp OpenAI server accepts ``tool_choice`` as string only (not OpenAI object form)."""
    if tool_choice is None:
        return None
    if isinstance(tool_choice, str):
        return tool_choice.strip() or None
    if not isinstance(tool_choice, dict):
        return None
    fn = tool_choice.get("function")
    if isinstance(fn, dict):
        name = fn.get("name")
        if isinstance(name, str) and name.strip():
            return name.strip()
    tc_type = tool_choice.get("type")
    if tc_type in ("required", "auto", "none"):
        return str(tc_type)
    return "required"


def _chat_max_tokens(options: dict[str, Any] | None, default: int = 2048) -> int:
    opts = options or {}
    if "max_tokens" in opts:
        try:
            mt = int(opts["max_tokens"])
            if 0 < mt <= LLAMA_COMPAT_MAX_NUM_PREDICT:
                return mt
        except (TypeError, ValueError):  # fmt: skip
            pass
    return max_tokens_from_llama_options(opts, default)


_JSON_SCHEMA_ROOT_TYPES = frozenset({"object", "array", "string", "number", "integer", "boolean", "null"})


def llama_native_format_from_response_format(
    response_format: dict[str, Any] | str | None,
) -> dict[str, Any] | str | None:
    """Map OpenAI-style ``response_format`` to native llama.cpp ``/api/chat`` ``format`` field.

    Accepts:
    - ``{"type": "json_object"}`` → ``"json"`` (or nested ``schema`` dict when present)
    - ``{"type": "json_schema", "schema": {...}}`` or OpenAI ``json_schema.schema`` wrapper → schema dict
    - Raw JSON Schema dict (e.g. Pydantic ``model_json_schema()``) with ``properties`` / ``$defs`` / combinators
    - String ``"json"`` passthrough
    """
    if response_format is None:
        return None
    if isinstance(response_format, str):
        token = response_format.strip()
        if not token:
            return None
        return "json" if token.lower() == "json" else token
    if not isinstance(response_format, dict):
        return None

    rf_type = response_format.get("type")
    if rf_type == "json_object":
        nested = response_format.get("schema")
        if isinstance(nested, dict) and nested:
            return nested
        return "json"

    if rf_type == "json_schema":
        nested = response_format.get("schema")
        if not isinstance(nested, dict) or not nested:
            js_wrap = response_format.get("json_schema")
            if isinstance(js_wrap, dict):
                nested = js_wrap.get("schema")
        if isinstance(nested, dict) and nested:
            return nested
        return "json"

    root_type = rf_type if isinstance(rf_type, str) else None
    if root_type in _JSON_SCHEMA_ROOT_TYPES and (
        "properties" in response_format
        or "items" in response_format
        or "$defs" in response_format
        or "anyOf" in response_format
        or "oneOf" in response_format
        or "allOf" in response_format
    ):
        return response_format

    return None


def _requires_native_chat_schema_format(response_format: dict[str, Any] | str | None) -> bool:
    """True when grammar must use native ``/api/chat`` ``format`` (OpenAI shim rejects raw schema)."""

    native = llama_native_format_from_response_format(response_format)
    return isinstance(native, dict) and bool(native)


def openai_compat_response_format_payload(
    response_format: dict[str, Any] | str | None,
) -> dict[str, Any] | None:
    """Map structured output to llama-server OpenAI ``/v1/chat/completions``.

    Preserves OpenAI ``json_schema`` wrappers (incl. ``strict``); raw Pydantic schema dicts
    should use ``normalize_llama_server_chat_response_format`` instead.
    """

    if response_format is None:
        return None
    if isinstance(response_format, str):
        token = response_format.strip().lower()
        if token == "json":
            return {"type": "json_object"}
        return None
    if not isinstance(response_format, dict):
        return None
    rf_type = response_format.get("type")
    if rf_type == "text":
        return {"type": "text"}
    if rf_type == "json_object":
        return {"type": "json_object"}
    if rf_type == "json_schema":
        if isinstance(response_format.get("json_schema"), dict):
            return response_format
        nested = response_format.get("schema")
        if isinstance(nested, dict) and nested:
            return response_format
    if _requires_native_chat_schema_format(response_format):
        return {"type": "json_object"}
    return None


def build_openai_strict_json_schema(name: str, schema: dict[str, Any]) -> dict[str, Any]:
    """OpenAI-style strict JSON schema wrapper for llama-server ``/v1/chat/completions``."""

    clean_name = re.sub(r"[^a-zA-Z0-9_]", "_", (name or "structured_output").strip())[:64]
    return {
        "type": "json_schema",
        "json_schema": {
            "name": clean_name or "structured_output",
            "strict": True,
            "schema": schema,
        },
    }


def normalize_llama_server_chat_response_format(
    response_format: str | dict[str, Any] | None,
    *,
    strict_name: str = "structured_output",
) -> dict[str, Any] | str | None:
    """Normalize ``response_format`` for stack2 llama-server OpenAI shim."""

    if response_format is None:
        return None
    if isinstance(response_format, str):
        token = response_format.strip().lower()
        if token == "json":
            return {"type": "json_object"}
        return response_format
    if not isinstance(response_format, dict):
        return None

    rf_type = response_format.get("type")
    if rf_type == "json_object":
        schema = response_format.get("schema")
        if isinstance(schema, dict) and schema:
            return {"type": "json_object", "schema": schema}
        return {"type": "json_object"}
    if rf_type == "json_schema":
        payload = openai_compat_response_format_payload(response_format)
        if payload is not None:
            return payload

    native = llama_native_format_from_response_format(response_format)
    if isinstance(native, dict) and native:
        return build_openai_strict_json_schema(strict_name, native)
    return None


def _generate_json_routes_via_chat(
    base_url: str,
    *,
    json_format: bool,
    json_schema: dict[str, Any] | None,
) -> bool:
    """True when ``generate_json`` should use chat completions instead of legacy ``/v1/completions``."""

    if _prefer_chat_completion_for_generate(base_url):
        return True
    return bool(json_format or json_schema is not None)


def _structured_output_response_format(
    *,
    json_format: bool,
    json_schema: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if json_schema is not None:
        return json_schema
    if json_format:
        return {"type": "json_object"}
    return None


async def httpx_compat_chat_completion_json(
    client: httpx.AsyncClient,
    base_url: str,
    *,
    model: str,
    messages: list[dict[str, Any]],
    options: dict[str, Any] | None = None,
    keep_alive: Any = None,
    timeout: httpx.Timeout | None = None,
    response_format: dict[str, Any] | None = None,
    chat_template_kwargs: dict[str, Any] | None = None,
    extra_params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Non-streaming chat: Llama ``/api/chat`` or OpenAI-compatible ``/v1/chat/completions``.

    Returns a dict shaped like ``httpx_compat_generate_json`` (``response``, ``prompt_eval_count``, ``eval_count``)
    plus optional ``finish_reason`` for OpenAI ``/v1/chat/completions`` (``None`` for Llama or if absent).
    OpenAI-compat responses may include ``timings`` (llama-server performance object); when present, the same dict is
    returned under key ``timings``.

    ``response_format`` and ``chat_template_kwargs`` are sent on OpenAI ``/v1/chat/completions``. On native Llama
    ``/api/chat``, ``response_format`` is translated to ``format`` (see ``llama_native_format_from_response_format``);
    ``chat_template_kwargs`` and ``extra_params`` are not forwarded on the native branch.

    Options (subset):
        ``openai_visible_assistant_content_only``: when the assistant ``content`` string is **empty**, do **not** copy
        ``reasoning_content`` / ``reasoning`` / ``thinking`` into ``response`` (callers that hide CoT from users).
        ``openai_sidecar_merge_reasoning``: if true, **override** that rule when ``content`` is empty — merge reasoning
        so trust/intent sidecars can parse KV emitted only in the reasoning slot (llama-server / some instruct models).
    """
    b = _norm_base(base_url)
    async with maybe_stack2_text_llm_slot(b, reason="httpx_chat_json"):
        opts = options or {}
        backend = await detect_llm_backend_httpx(client, b)
        chat_messages = openai_compatible_chat_messages(messages)
        max_tok = _chat_max_tokens(opts, 2048)
        temp = float(opts.get("temperature", 0.7))

        llama_format = llama_native_format_from_response_format(response_format)
        use_native_chat = backend == "llama" or isinstance(llama_format, dict)

        if use_native_chat:
            llama_opts: dict[str, Any] = {"temperature": temp, "num_predict": max_tok}
            if "top_p" in opts:
                llama_opts["top_p"] = float(opts["top_p"])
            _apply_num_ctx_to_llama_options(opts, llama_opts)
            body: dict[str, Any] = {
                "model": model,
                "messages": chat_messages,
                "stream": False,
                "options": llama_opts,
            }
            if keep_alive is not None:
                body["keep_alive"] = keep_alive
            if llama_format is not None:
                body["format"] = llama_format
            stem = await _maybe_save_stack2_llm_request(
                kind="chat_json_llama_api_chat", base_url=b, http_path="/api/chat", body=body
            )
            r = await client.post(f"{b}/api/chat", json=body, timeout=timeout)
            if r.status_code == 404:
                invalidate_llm_backend_cache(b)
                await _maybe_save_stack2_llm_response(
                    kind="chat_json_llama_api_chat",
                    base_url=b,
                    http_path="/api/chat",
                    stem=stem,
                    http_status=404,
                    response_text=r.text,
                )
            else:
                r.raise_for_status()
                data = r.json()
                await _maybe_save_stack2_llm_response(
                    kind="chat_json_llama_api_chat",
                    base_url=b,
                    http_path="/api/chat",
                    stem=stem,
                    http_status=r.status_code,
                    response_json=data,
                )
                message = data.get("message") or {}
                text = message.get("content", "") or data.get("response", "") or message.get("thinking", "") or ""
                return {
                    "response": text,
                    "model": model,
                    "done": True,
                    "message": message,
                    "prompt_eval_count": int(data.get("prompt_eval_count", 0) or 0),
                    "eval_count": int(data.get("eval_count", 0) or 0),
                    "finish_reason": None,
                }

        model = await _resolve_openai_model_for_httpx(client, b, model)
        openai_body: dict[str, Any] = {
            "model": model,
            "messages": chat_messages,
            "max_tokens": max_tok,
            "temperature": temp,
            "stream": False,
        }
        if "top_p" in opts:
            openai_body["top_p"] = float(opts["top_p"])
        for ek, ev in (extra_params or {}).items():
            if ek in _OPENAI_CHAT_BODY_LOCKED_KEYS:
                continue
            if ek == "tool_choice":
                openai_body[ek] = normalize_openai_tool_choice_for_llama_server(ev)
                continue
            openai_body[ek] = ev
        if response_format is not None:
            openai_rf = openai_compat_response_format_payload(response_format)
            if openai_rf is not None:
                openai_body["response_format"] = openai_rf
        if chat_template_kwargs is not None:
            openai_body["chat_template_kwargs"] = chat_template_kwargs
        stem = await _maybe_save_stack2_llm_request(
            kind="chat_json_openai_v1_chat_completions",
            base_url=b,
            http_path="/v1/chat/completions",
            body=openai_body,
        )
        r = await client.post(f"{b}/v1/chat/completions", json=openai_body, timeout=timeout)
        if r.status_code >= 400:
            err_full = r.text or ""
            await _maybe_save_stack2_llm_response(
                kind="chat_json_openai_v1_chat_completions",
                base_url=b,
                http_path="/v1/chat/completions",
                stem=stem,
                http_status=r.status_code,
                response_text=err_full[:800],
                error_message=f"chat completions HTTP {r.status_code}",
            )
            from api.utils.llm_json_extract import salvage_text_from_llama_server_error

            salvaged = salvage_text_from_llama_server_error(err_full)
            if salvaged:
                logger.warning(
                    "llm httpx chat completions HTTP %s for %s; recovered model text from error body (len=%s)",
                    r.status_code,
                    b,
                    len(salvaged),
                )
                return {
                    "response": salvaged,
                    "model": model,
                    "done": True,
                    "message": {"content": salvaged},
                    "prompt_eval_count": 0,
                    "eval_count": 0,
                    "finish_reason": "recovered_from_error",
                }
            raise RuntimeError(f"chat completions HTTP {r.status_code}: {err_full[:800]}")
        data = r.json()
        await _maybe_save_stack2_llm_response(
            kind="chat_json_openai_v1_chat_completions",
            base_url=b,
            http_path="/v1/chat/completions",
            stem=stem,
            http_status=r.status_code,
            response_json=data,
        )
        choice = (data.get("choices") or [{}])[0]
        msg = choice.get("message") or {}
        finish_reason = choice.get("finish_reason") if isinstance(choice, dict) else None
        text = _merge_openai_assistant_text(msg if isinstance(msg, dict) else {}, opts)
        usage = data.get("usage") or {}
        timings_out: dict[str, Any] | None = None
        raw_timings = data.get("timings")
        if isinstance(raw_timings, dict) and raw_timings:
            timings_out = raw_timings
            logger.debug(
                "llm openai-compat chat completions timings: prompt_ms=%s predicted_ms=%s cache_n=%s",
                timings_out.get("prompt_ms"),
                timings_out.get("predicted_ms"),
                timings_out.get("cache_n"),
            )
        out: dict[str, Any] = {
            "response": text,
            "model": model,
            "done": True,
            "message": msg,
            "prompt_eval_count": int(usage.get("prompt_tokens", 0) or 0),
            "eval_count": int(usage.get("completion_tokens", 0) or 0),
            "finish_reason": finish_reason,
        }
        if timings_out is not None:
            out["timings"] = timings_out
        return out


def _merge_openai_assistant_text(msg: dict[str, Any], opts: dict[str, Any]) -> str:
    """Visible assistant ``content``; optional merge from reasoning slots (sidecar / structured JSON)."""
    text = str(msg.get("content", "") or "")
    content_only = bool(opts.get("openai_visible_assistant_content_only"))
    sidecar_merge = bool(opts.get("openai_sidecar_merge_reasoning"))
    if not text.strip() and (not content_only or sidecar_merge):
        for k in ("reasoning_content", "reasoning", "thinking"):
            alt = msg.get(k)
            if isinstance(alt, str) and alt.strip():
                return str(alt)
    return text


async def aiohttp_compat_chat_completion_json(
    session: aiohttp.ClientSession,
    base_url: str,
    *,
    model: str,
    messages: list[dict[str, Any]],
    options: dict[str, Any] | None = None,
    keep_alive: Any = None,
    timeout: aiohttp.ClientTimeout | None = None,
    response_format: dict[str, Any] | None = None,
    chat_template_kwargs: dict[str, Any] | None = None,
    extra_params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Non-streaming chat (aiohttp): Llama ``/api/chat`` or OpenAI ``/v1/chat/completions``.

    Same contract as ``httpx_compat_chat_completion_json`` (``response``, token counts, ``finish_reason``).
    """
    opts = options or {}
    b = _norm_base(base_url)
    async with maybe_stack2_text_llm_slot(b, reason="aiohttp_chat_json"):
        backend = await detect_llm_backend_aiohttp(session, b)
        chat_messages = openai_compatible_chat_messages(messages)
        max_tok = _chat_max_tokens(opts, 2048)
        temp = float(opts.get("temperature", 0.7))

        llama_format = llama_native_format_from_response_format(response_format)
        use_native_chat = backend == "llama" or isinstance(llama_format, dict)

        if use_native_chat:
            llama_opts: dict[str, Any] = {"temperature": temp, "num_predict": max_tok}
            if "top_p" in opts:
                llama_opts["top_p"] = float(opts["top_p"])
            _apply_num_ctx_to_llama_options(opts, llama_opts)
            body: dict[str, Any] = {
                "model": model,
                "messages": chat_messages,
                "stream": False,
                "options": llama_opts,
            }
            if keep_alive is not None:
                body["keep_alive"] = keep_alive
            if llama_format is not None:
                body["format"] = llama_format
            stem = await _maybe_save_stack2_llm_request(
                kind="aiohttp_chat_json_llama_api_chat", base_url=b, http_path="/api/chat", body=body
            )
            async with session.post(f"{b}/api/chat", json=body, timeout=timeout) as resp:
                if resp.status == 404:
                    invalidate_llm_backend_cache(b)
                    rt = await resp.text()
                    await _maybe_save_stack2_llm_response(
                        kind="aiohttp_chat_json_llama_api_chat",
                        base_url=b,
                        http_path="/api/chat",
                        stem=stem,
                        http_status=404,
                        response_text=rt,
                    )
                else:
                    resp.raise_for_status()
                    data = await resp.json()
                    await _maybe_save_stack2_llm_response(
                        kind="aiohttp_chat_json_llama_api_chat",
                        base_url=b,
                        http_path="/api/chat",
                        stem=stem,
                        http_status=resp.status,
                        response_json=data,
                    )
                    message = data.get("message") or {}
                    text = message.get("content", "") or data.get("response", "") or message.get("thinking", "") or ""
                    return {
                        "response": text,
                        "model": model,
                        "done": True,
                        "message": message,
                        "prompt_eval_count": int(data.get("prompt_eval_count", 0) or 0),
                        "eval_count": int(data.get("eval_count", 0) or 0),
                        "finish_reason": None,
                    }

        openai_body: dict[str, Any] = {
            "model": model,
            "messages": chat_messages,
            "max_tokens": max_tok,
            "temperature": temp,
            "stream": False,
        }
        if "top_p" in opts:
            openai_body["top_p"] = float(opts["top_p"])
        for ek, ev in (extra_params or {}).items():
            if ek in _OPENAI_CHAT_BODY_LOCKED_KEYS:
                continue
            if ek == "tool_choice":
                openai_body[ek] = normalize_openai_tool_choice_for_llama_server(ev)
                continue
            openai_body[ek] = ev
        if response_format is not None:
            openai_rf = openai_compat_response_format_payload(response_format)
            if openai_rf is not None:
                openai_body["response_format"] = openai_rf
        if chat_template_kwargs is not None:
            openai_body["chat_template_kwargs"] = chat_template_kwargs
        stem = await _maybe_save_stack2_llm_request(
            kind="aiohttp_chat_json_openai_v1_chat_completions",
            base_url=b,
            http_path="/v1/chat/completions",
            body=openai_body,
        )
        async with session.post(f"{b}/v1/chat/completions", json=openai_body, timeout=timeout) as resp:
            if resp.status >= 400:
                err_full = await resp.text()
                err_preview = err_full[:800]
                await _maybe_save_stack2_llm_response(
                    kind="aiohttp_chat_json_openai_v1_chat_completions",
                    base_url=b,
                    http_path="/v1/chat/completions",
                    stem=stem,
                    http_status=int(resp.status),
                    response_text=err_preview,
                    error_message=f"chat completions HTTP {resp.status}",
                )
                from api.utils.llm_json_extract import salvage_text_from_llama_server_error

                salvaged = salvage_text_from_llama_server_error(err_full)
                if salvaged:
                    logger.warning(
                        "llm chat completions HTTP %s for %s; recovered model text from error body (len=%s)",
                        resp.status,
                        b,
                        len(salvaged),
                    )
                    return {
                        "response": salvaged,
                        "model": model,
                        "done": True,
                        "message": {"content": salvaged},
                        "prompt_eval_count": 0,
                        "eval_count": 0,
                        "finish_reason": "recovered_from_error",
                    }
                raise RuntimeError(f"chat completions HTTP {resp.status}: {err_preview}")
            data = await resp.json()
        await _maybe_save_stack2_llm_response(
            kind="aiohttp_chat_json_openai_v1_chat_completions",
            base_url=b,
            http_path="/v1/chat/completions",
            stem=stem,
            http_status=200,
            response_json=data,
        )
        choice = (data.get("choices") or [{}])[0]
        msg = choice.get("message") or {}
        finish_reason = choice.get("finish_reason") if isinstance(choice, dict) else None
        text = _merge_openai_assistant_text(msg if isinstance(msg, dict) else {}, opts)
        usage = data.get("usage") or {}
        timings_out: dict[str, Any] | None = None
        raw_timings = data.get("timings")
        if isinstance(raw_timings, dict) and raw_timings:
            timings_out = raw_timings
        out: dict[str, Any] = {
            "response": text,
            "model": model,
            "done": True,
            "message": msg,
            "prompt_eval_count": int(usage.get("prompt_tokens", 0) or 0),
            "eval_count": int(usage.get("completion_tokens", 0) or 0),
            "finish_reason": finish_reason,
        }
        if timings_out is not None:
            out["timings"] = timings_out
        return out


async def aiohttp_compat_generate_json(
    session: aiohttp.ClientSession,
    base_url: str,
    *,
    model: str,
    prompt: str,
    system: str | None = None,
    options: dict[str, Any] | None = None,
    json_format: bool = False,
    json_schema: dict[str, Any] | None = None,
    keep_alive: Any = None,
    timeout: aiohttp.ClientTimeout | None = None,
) -> dict[str, Any]:
    opts = options or {}
    b = _norm_base(base_url)
    async with maybe_stack2_text_llm_slot(b, reason="aiohttp_generate_json"):
        backend = await detect_llm_backend_aiohttp(session, b)
        structured_rf = _structured_output_response_format(json_format=json_format, json_schema=json_schema)
        if backend == "llama":
            body: dict[str, Any] = {
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": opts,
            }
            if system:
                body["system"] = system
            if keep_alive is not None:
                body["keep_alive"] = keep_alive
            llama_format = llama_native_format_from_response_format(structured_rf)
            if llama_format is not None:
                body["format"] = llama_format
            stem_o = await _maybe_save_stack2_llm_request(
                kind="aiohttp_generate_json_llama_api_generate",
                base_url=b,
                http_path="/api/generate",
                body=body,
            )
            async with session.post(f"{b}/api/generate", json=body, timeout=timeout) as resp:
                if resp.status == 404:
                    invalidate_llm_backend_cache(b)
                    rt = await resp.text()
                    await _maybe_save_stack2_llm_response(
                        kind="aiohttp_generate_json_llama_api_generate",
                        base_url=b,
                        http_path="/api/generate",
                        stem=stem_o,
                        http_status=404,
                        response_text=rt,
                    )
                else:
                    resp.raise_for_status()
                    data_o = await resp.json()
                    await _maybe_save_stack2_llm_response(
                        kind="aiohttp_generate_json_llama_api_generate",
                        base_url=b,
                        http_path="/api/generate",
                        stem=stem_o,
                        http_status=resp.status,
                        response_json=data_o,
                    )
                    return data_o
        full_prompt = f"{system}\n\n{prompt}" if system else prompt
        if json_format and json_schema is None:
            full_prompt = f"{full_prompt}\n\nYou must output valid JSON only, no markdown fences, no extra text."
        if _generate_json_routes_via_chat(b, json_format=json_format, json_schema=json_schema):
            return await aiohttp_compat_chat_completion_json(
                session,
                b,
                model=model,
                messages=[{"role": "user", "content": full_prompt}],
                options=opts,
                keep_alive=keep_alive,
                timeout=timeout,
                response_format=structured_rf,
            )
        openai_body: dict[str, Any] = {
            "model": model,
            "prompt": full_prompt,
            "max_tokens": max_tokens_from_llama_options(opts, 2048),
            "temperature": float(opts.get("temperature", 0.7)),
            "stream": False,
        }
        if "top_p" in opts:
            openai_body["top_p"] = float(opts["top_p"])
        stem = await _maybe_save_stack2_llm_request(
            kind="aiohttp_generate_json_openai_v1_completions",
            base_url=b,
            http_path="/v1/completions",
            body=openai_body,
        )
        async with session.post(f"{b}/v1/completions", json=openai_body, timeout=timeout) as resp:
            if resp.status >= 400:
                text = await resp.text()
                await _maybe_save_stack2_llm_response(
                    kind="aiohttp_generate_json_openai_v1_completions",
                    base_url=b,
                    http_path="/v1/completions",
                    stem=stem,
                    http_status=resp.status,
                    response_text=text,
                    error_message=f"llama completions HTTP {resp.status}",
                )
                should_retry, reason = _should_retry_generate_as_chat(resp.status, text)
                if should_retry:
                    _mark_prefer_chat_completion_for_generate(
                        b,
                        reason=reason,
                    )
                    logger.warning(
                        "llm aiohttp /v1/completions HTTP %s for %s; retrying /v1/chat/completions: %s",
                        resp.status,
                        b,
                        text[:800],
                    )
                    return await aiohttp_compat_chat_completion_json(
                        session,
                        b,
                        model=model,
                        messages=[{"role": "user", "content": full_prompt}],
                        options=opts,
                        keep_alive=keep_alive,
                        timeout=timeout,
                        response_format=structured_rf,
                    )
                raise RuntimeError(f"llama completions HTTP {resp.status}: {text[:800]}")
            data = await resp.json()
        await _maybe_save_stack2_llm_response(
            kind="aiohttp_generate_json_openai_v1_completions",
            base_url=b,
            http_path="/v1/completions",
            stem=stem,
            http_status=200,
            response_json=data,
        )
        text = (data.get("choices") or [{}])[0].get("text", "") or ""
        usage = data.get("usage") or {}
        if not str(text).strip():
            _mark_prefer_chat_completion_for_generate(
                b,
                reason="empty_completions_text",
            )
            logger.warning(
                "llm aiohttp /v1/completions returned empty text for %s; retrying /v1/chat/completions",
                b,
            )
            return await aiohttp_compat_chat_completion_json(
                session,
                b,
                model=model,
                messages=[{"role": "user", "content": full_prompt}],
                options=opts,
                keep_alive=keep_alive,
                timeout=timeout,
                response_format=structured_rf,
            )
        return {
            "response": text,
            "model": model,
            "done": True,
            "prompt_eval_count": usage.get("prompt_tokens", 0),
            "eval_count": usage.get("completion_tokens", 0),
        }


async def httpx_compat_generate_json(
    client: httpx.AsyncClient,
    base_url: str,
    *,
    model: str,
    prompt: str,
    system: str | None = None,
    options: dict[str, Any] | None = None,
    json_format: bool = False,
    json_schema: dict[str, Any] | None = None,
    keep_alive: Any = None,
    timeout: httpx.Timeout | None = None,
    chat_template_kwargs: dict[str, Any] | None = None,
) -> dict[str, Any]:
    b = _norm_base(base_url)

    async def _run() -> dict[str, Any]:
        opts = options or {}
        backend = await detect_llm_backend_httpx(client, b)
        structured_rf = _structured_output_response_format(json_format=json_format, json_schema=json_schema)
        if backend == "llama":
            body: dict[str, Any] = {
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": opts,
            }
            if system:
                body["system"] = system
            if keep_alive is not None:
                body["keep_alive"] = keep_alive
            llama_format = llama_native_format_from_response_format(structured_rf)
            if llama_format is not None:
                body["format"] = llama_format
            stem = await _maybe_save_stack2_llm_request(
                kind="generate_json_llama_api_generate",
                base_url=b,
                http_path="/api/generate",
                body=body,
            )
            r = await client.post(f"{b}/api/generate", json=body, timeout=timeout)
            if r.status_code == 404:
                invalidate_llm_backend_cache(b)
                await _maybe_save_stack2_llm_response(
                    kind="generate_json_llama_api_generate",
                    base_url=b,
                    http_path="/api/generate",
                    stem=stem,
                    http_status=404,
                    response_text=r.text,
                )
            else:
                r.raise_for_status()
                data = r.json()
                await _maybe_save_stack2_llm_response(
                    kind="generate_json_llama_api_generate",
                    base_url=b,
                    http_path="/api/generate",
                    stem=stem,
                    http_status=r.status_code,
                    response_json=data,
                )
                return data
        full_prompt = f"{system}\n\n{prompt}" if system else prompt
        if json_format and json_schema is None:
            full_prompt = f"{full_prompt}\n\nYou must output valid JSON only, no markdown fences, no extra text."
        if _generate_json_routes_via_chat(b, json_format=json_format, json_schema=json_schema):
            return await httpx_compat_chat_completion_json(
                client,
                b,
                model=model,
                messages=[{"role": "user", "content": full_prompt}],
                options=opts,
                keep_alive=keep_alive,
                timeout=timeout,
                response_format=structured_rf,
                chat_template_kwargs=chat_template_kwargs,
            )
        resolved_model = await _resolve_openai_model_for_httpx(client, b, model)
        openai_body: dict[str, Any] = {
            "model": resolved_model,
            "prompt": full_prompt,
            "max_tokens": max_tokens_from_llama_options(opts, 2048),
            "temperature": float(opts.get("temperature", 0.7)),
            "stream": False,
        }
        if "top_p" in opts:
            openai_body["top_p"] = float(opts["top_p"])
        stem = await _maybe_save_stack2_llm_request(
            kind="generate_json_openai_v1_completions",
            base_url=b,
            http_path="/v1/completions",
            body=openai_body,
        )
        r = await client.post(f"{b}/v1/completions", json=openai_body, timeout=timeout)
        if r.status_code >= 400:
            err_preview = (r.text or "")[:800]
            await _maybe_save_stack2_llm_response(
                kind="generate_json_openai_v1_completions",
                base_url=b,
                http_path="/v1/completions",
                stem=stem,
                http_status=r.status_code,
                response_text=r.text,
                error_message=f"completions HTTP {r.status_code}",
            )
            # Many llama.cpp / vLLM / gateway setups only implement chat, reject legacy completions payload,
            # or throw a parser-specific 500 on completions while chat-completions still works.
            should_retry, reason = _should_retry_generate_as_chat(r.status_code, r.text or "")
            if should_retry:
                _mark_prefer_chat_completion_for_generate(
                    b,
                    reason=reason,
                )
                logger.warning(
                    "llm /v1/completions HTTP %s for %s; retrying /v1/chat/completions: %s",
                    r.status_code,
                    b,
                    err_preview,
                )
                return await httpx_compat_chat_completion_json(
                    client,
                    b,
                    model=model,
                    messages=[{"role": "user", "content": full_prompt}],
                    options=opts,
                    keep_alive=keep_alive,
                    timeout=timeout,
                    response_format=structured_rf,
                    chat_template_kwargs=chat_template_kwargs,
                )
            raise RuntimeError(f"llama completions HTTP {r.status_code}: {err_preview}")
        data = r.json()
        await _maybe_save_stack2_llm_response(
            kind="generate_json_openai_v1_completions",
            base_url=b,
            http_path="/v1/completions",
            stem=stem,
            http_status=r.status_code,
            response_json=data,
        )
        text = (data.get("choices") or [{}])[0].get("text", "") or ""
        usage = data.get("usage") or {}
        if not str(text).strip():
            # llama.cpp: some instruct/chat-tuned GGUF models return HTTP 200 from /v1/completions with
            # empty `choices[0].text` while /v1/chat/completions fills `message.content` (same model id).
            _mark_prefer_chat_completion_for_generate(
                b,
                reason="empty_completions_text",
            )
            logger.warning(
                "llm /v1/completions returned empty text for %s; retrying /v1/chat/completions",
                b,
            )
            return await httpx_compat_chat_completion_json(
                client,
                b,
                model=model,
                messages=[{"role": "user", "content": full_prompt}],
                options=opts,
                keep_alive=keep_alive,
                timeout=timeout,
                response_format=structured_rf,
                chat_template_kwargs=chat_template_kwargs,
            )
        return {
            "response": text,
            "model": model,
            "done": True,
            "prompt_eval_count": usage.get("prompt_tokens", 0),
            "eval_count": usage.get("completion_tokens", 0),
        }

    async with maybe_stack2_text_llm_slot(b, reason="httpx_generate_json"):
        return await _run()


async def aiohttp_compat_embeddings_dict(
    session: aiohttp.ClientSession,
    embed_base_url: str,
    *,
    model: str,
    input_data: str | list[str],
    dimensions: int | None,
    keep_alive: Any = None,
    timeout: aiohttp.ClientTimeout | None = None,
    force_openai: bool = False,
) -> dict[str, Any]:
    """Returns Llama-shaped ``{ \"embeddings\": [[float, ...], ...] }``."""
    from api.utils.llama_embed_payload import build_llama_embed_payload

    b = _norm_base(embed_base_url)
    use_openai = force_openai or (await detect_llm_backend_aiohttp(session, b) == "openai")
    if not use_openai:
        payload = build_llama_embed_payload(model=model, input_data=input_data, keep_alive=keep_alive)
        stem = await _maybe_save_stack2_llm_request(
            kind="aiohttp_embed_llama_api_embed",
            base_url=b,
            http_path="/api/embed",
            body=payload,
        )
        async with session.post(f"{b}/api/embed", json=payload, timeout=timeout) as resp:
            if resp.status != 200:
                err = await resp.text()
                await _maybe_save_stack2_llm_response(
                    kind="aiohttp_embed_llama_api_embed",
                    base_url=b,
                    http_path="/api/embed",
                    stem=stem,
                    http_status=resp.status,
                    response_text=err,
                    error_message=f"Llama embed HTTP {resp.status}",
                )
                raise RuntimeError(f"Llama embed HTTP {resp.status}: {err[:600]}")
            data = await resp.json()
        await _maybe_save_stack2_llm_response(
            kind="aiohttp_embed_llama_api_embed",
            base_url=b,
            http_path="/api/embed",
            stem=stem,
            http_status=200,
            response_json=data,
        )
        return data
    body: dict[str, Any] = {"model": model, "input": input_data}
    if dimensions is not None and dimensions >= 32:
        body["dimensions"] = dimensions
    stem = await _maybe_save_stack2_llm_request(
        kind="aiohttp_embed_openai_v1_embeddings",
        base_url=b,
        http_path="/v1/embeddings",
        body=body,
    )
    async with session.post(f"{b}/v1/embeddings", json=body, timeout=timeout) as resp:
        if resp.status != 200:
            err = await resp.text()
            await _maybe_save_stack2_llm_response(
                kind="aiohttp_embed_openai_v1_embeddings",
                base_url=b,
                http_path="/v1/embeddings",
                stem=stem,
                http_status=resp.status,
                response_text=err,
                error_message=f"OpenAI embeddings HTTP {resp.status}",
            )
            raise RuntimeError(f"OpenAI embeddings HTTP {resp.status}: {err[:600]}")
        data = await resp.json()
    await _maybe_save_stack2_llm_response(
        kind="aiohttp_embed_openai_v1_embeddings",
        base_url=b,
        http_path="/v1/embeddings",
        stem=stem,
        http_status=200,
        response_json=data,
    )
    embs: list[list[float]] = []
    for row in data.get("data") or []:
        e = row.get("embedding") if isinstance(row, dict) else None
        if isinstance(e, list):
            embs.append(e)
    return {"embeddings": embs}


async def httpx_compat_embeddings_first(
    client: httpx.AsyncClient,
    embed_base_url: str,
    *,
    model: str,
    text: str,
    dimensions: int | None,
    keep_alive: Any = None,
    timeout: httpx.Timeout | None = None,
    force_openai: bool = False,
) -> list[float]:
    from api.utils.llama_embed_payload import build_llama_embed_payload

    b = _norm_base(embed_base_url)
    backend = await detect_llm_backend_httpx(client, b)
    use_openai = force_openai or backend == "openai"
    if not use_openai:
        payload = build_llama_embed_payload(model=model, input_data=text, keep_alive=keep_alive)
        stem = await _maybe_save_stack2_llm_request(
            kind="embed_httpx_llama_api_embed",
            base_url=b,
            http_path="/api/embed",
            body=payload,
        )
        r = await client.post(f"{b}/api/embed", json=payload, timeout=timeout)
        try:
            r.raise_for_status()
        except httpx.HTTPStatusError:
            await _maybe_save_stack2_llm_response(
                kind="embed_httpx_llama_api_embed",
                base_url=b,
                http_path="/api/embed",
                stem=stem,
                http_status=r.status_code,
                response_text=r.text,
                error_message="llama embed raise_for_status",
            )
            raise
        data = r.json()
        await _maybe_save_stack2_llm_response(
            kind="embed_httpx_llama_api_embed",
            base_url=b,
            http_path="/api/embed",
            stem=stem,
            http_status=r.status_code,
            response_json=data,
        )
        emb = data.get("embeddings") or []
        if isinstance(emb, list) and emb and isinstance(emb[0], list):
            return emb[0]
        return []
    body: dict[str, Any] = {"model": model, "input": text}
    if dimensions is not None and dimensions >= 32:
        body["dimensions"] = dimensions
    stem = await _maybe_save_stack2_llm_request(
        kind="embed_httpx_openai_v1_embeddings",
        base_url=b,
        http_path="/v1/embeddings",
        body=body,
    )
    r = await client.post(f"{b}/v1/embeddings", json=body, timeout=timeout)
    try:
        r.raise_for_status()
    except httpx.HTTPStatusError:
        await _maybe_save_stack2_llm_response(
            kind="embed_httpx_openai_v1_embeddings",
            base_url=b,
            http_path="/v1/embeddings",
            stem=stem,
            http_status=r.status_code,
            response_text=r.text,
            error_message="openai embeddings raise_for_status",
        )
        raise
    data = r.json()
    await _maybe_save_stack2_llm_response(
        kind="embed_httpx_openai_v1_embeddings",
        base_url=b,
        http_path="/v1/embeddings",
        stem=stem,
        http_status=r.status_code,
        response_json=data,
    )
    row0 = (data.get("data") or [{}])[0]
    e = row0.get("embedding") if isinstance(row0, dict) else None
    return e if isinstance(e, list) else []


async def httpx_compat_embeddings_many(
    client: httpx.AsyncClient,
    embed_base_url: str,
    *,
    model: str,
    texts: list[str],
    dimensions: int | None,
    keep_alive: Any = None,
    timeout: httpx.Timeout | None = None,
    force_openai: bool = False,
) -> list[list[float]]:
    from api.utils.llama_embed_payload import build_llama_embed_payload

    if not texts:
        return []
    b = _norm_base(embed_base_url)
    backend = await detect_llm_backend_httpx(client, b)
    use_openai = force_openai or backend == "openai"
    if not use_openai:
        payload = build_llama_embed_payload(model=model, input_data=texts, keep_alive=keep_alive)
        r = await client.post(f"{b}/api/embed", json=payload, timeout=timeout)
        r.raise_for_status()
        data = r.json()
        embs = data.get("embeddings") or []
        return [row for row in embs if isinstance(row, list)]
    body: dict[str, Any] = {"model": model, "input": texts}
    if dimensions is not None and dimensions >= 32:
        body["dimensions"] = dimensions
    r = await client.post(f"{b}/v1/embeddings", json=body, timeout=timeout)
    r.raise_for_status()
    data = r.json()
    out: list[list[float]] = []
    rows = data.get("data") or []
    for item in sorted((row for row in rows if isinstance(row, dict)), key=lambda row: int(row.get("index", 0) or 0)):
        embedding = item.get("embedding")
        if isinstance(embedding, list):
            out.append(embedding)
    return out


async def httpx_compat_chat_completion_stream(
    client: httpx.AsyncClient,
    base_url: str,
    *,
    model: str,
    messages: list[dict[str, Any]],
    options: dict[str, Any] | None = None,
    timeout: httpx.Timeout | None = None,
    chat_template_kwargs: dict[str, Any] | None = None,
    extra_params: dict[str, Any] | None = None,
) -> AsyncIterator[str]:
    """Stream chat completion deltas: Llama ``/api/chat`` (NDJSON ``message.content``) or OpenAI ``/v1/chat/completions`` SSE.

    Yields **non-empty** text chunks; the caller concatenates them into the final reply.

    Options:
        openai_visible_assistant_content_only: if true (e.g. EWA companion), OpenAI SSE yields **only**
        ``delta.content`` / final ``message.content`` chunks, never ``reasoning_content`` — so internal CoT is
        not shown as the assistant bubble.

    ``chat_template_kwargs`` / ``extra_params`` mirror the non-stream OpenAI path (Gemma 4
    ``enable_thinking``, ``reasoning_format``). Not forwarded on native Llama ``/api/chat``.
    """

    opts = options or {}
    b = _norm_base(base_url)
    async with maybe_stack2_text_llm_slot(b, reason="httpx_chat_stream"):
        backend = await detect_llm_backend_httpx(client, b)
        chat_messages = openai_compatible_chat_messages(messages)
        max_tok = _chat_max_tokens(opts, 2048)
        temp = float(opts.get("temperature", 0.7))

        if backend == "llama":
            llama_opts: dict[str, Any] = {"temperature": temp, "num_predict": max_tok}
            if "top_p" in opts:
                llama_opts["top_p"] = float(opts["top_p"])
            _apply_num_ctx_to_llama_options(opts, llama_opts)
            body: dict[str, Any] = {
                "model": model,
                "messages": chat_messages,
                "stream": True,
                "options": llama_opts,
            }
            stem = await _maybe_save_stack2_llm_request(
                kind="chat_stream_llama_api_chat", base_url=b, http_path="/api/chat", body=body
            )
            async with client.stream("POST", f"{b}/api/chat", json=body, timeout=timeout) as resp:
                if resp.status_code == 404:
                    await resp.aread()
                    invalidate_llm_backend_cache(b)
                    await _maybe_save_stack2_llm_response(
                        kind="chat_stream_llama_api_chat",
                        base_url=b,
                        http_path="/api/chat",
                        stem=stem,
                        http_status=404,
                        response_text="",
                    )
                else:
                    resp.raise_for_status()
                    agg_o: list[str] = []
                    try:
                        async for line in resp.aiter_lines():
                            if not line:
                                continue
                            try:
                                data = json.loads(line)
                            except json.JSONDecodeError:
                                continue
                            msg = data.get("message") or {}
                            piece = msg.get("content") if isinstance(msg, dict) else None
                            if isinstance(piece, str) and piece:
                                agg_o.append(piece)
                                yield piece
                            if data.get("done") is True:
                                break
                    except Exception as exc:  # noqa: BLE001
                        await _maybe_save_stack2_llm_response(
                            kind="chat_stream_llama_api_chat",
                            base_url=b,
                            http_path="/api/chat",
                            stem=stem,
                            http_status=599,
                            stream_aggregated_text="".join(agg_o),
                            error_message=str(exc),
                        )
                        raise
                    await _maybe_save_stack2_llm_response(
                        kind="chat_stream_llama_api_chat",
                        base_url=b,
                        http_path="/api/chat",
                        stem=stem,
                        http_status=200,
                        stream_aggregated_text="".join(agg_o),
                    )
                    return

        model = await _resolve_openai_model_for_httpx(client, b, model)
        openai_body: dict[str, Any] = {
            "model": model,
            "messages": chat_messages,
            "max_tokens": max_tok,
            "temperature": temp,
            "stream": True,
        }
        if "top_p" in opts:
            openai_body["top_p"] = float(opts["top_p"])
        for ek, ev in (extra_params or {}).items():
            if ek in _OPENAI_CHAT_BODY_LOCKED_KEYS:
                continue
            if ek == "tool_choice":
                openai_body[ek] = normalize_openai_tool_choice_for_llama_server(ev)
                continue
            openai_body[ek] = ev
        if chat_template_kwargs is not None:
            openai_body["chat_template_kwargs"] = chat_template_kwargs
        content_only = bool(opts.get("openai_visible_assistant_content_only"))
        stem = await _maybe_save_stack2_llm_request(
            kind="chat_stream_openai_v1_chat_completions",
            base_url=b,
            http_path="/v1/chat/completions",
            body=openai_body,
        )
        agg: list[str] = []
        async with client.stream("POST", f"{b}/v1/chat/completions", json=openai_body, timeout=timeout) as resp:
            if resp.status_code >= 400:
                err_preview = (await resp.aread()).decode("utf-8", errors="replace")[:8000]
                await _maybe_save_stack2_llm_response(
                    kind="chat_stream_openai_v1_chat_completions",
                    base_url=b,
                    http_path="/v1/chat/completions",
                    stem=stem,
                    http_status=resp.status_code,
                    response_text=err_preview,
                    error_message=f"chat completions stream HTTP {resp.status_code}",
                )
                raise RuntimeError(f"chat completions stream HTTP {resp.status_code}: {err_preview[:600]}")
            try:
                async for line in resp.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue
                    payload_s = line[6:].strip()
                    if payload_s == "[DONE]":
                        break
                    try:
                        chunk = json.loads(payload_s)
                    except json.JSONDecodeError:
                        continue
                    choice = (chunk.get("choices") or [{}])[0]
                    delta = choice.get("delta") if isinstance(choice, dict) else None
                    piece: Any = None
                    if isinstance(delta, dict):
                        piece = delta.get("content")
                        if not piece and not content_only:
                            for key in ("reasoning_content", "reasoning", "thinking"):
                                rv = delta.get(key)
                                if isinstance(rv, str) and rv:
                                    piece = rv
                                    break
                    if not piece:
                        msg = choice.get("message") if isinstance(choice, dict) else None
                        if isinstance(msg, dict):
                            piece = msg.get("content")
                            if not piece and not content_only:
                                for key in ("reasoning_content", "reasoning", "thinking"):
                                    rv = msg.get(key)
                                    if isinstance(rv, str) and rv:
                                        piece = rv
                                        break
                    if isinstance(piece, str) and piece:
                        agg.append(piece)
                        yield piece
            except Exception as exc:  # noqa: BLE001
                await _maybe_save_stack2_llm_response(
                    kind="chat_stream_openai_v1_chat_completions",
                    base_url=b,
                    http_path="/v1/chat/completions",
                    stem=stem,
                    http_status=599,
                    stream_aggregated_text="".join(agg),
                    error_message=str(exc),
                )
                raise
        await _maybe_save_stack2_llm_response(
            kind="chat_stream_openai_v1_chat_completions",
            base_url=b,
            http_path="/v1/chat/completions",
            stem=stem,
            http_status=200,
            stream_aggregated_text="".join(agg),
        )


async def httpx_compat_generate_text_stream(
    client: httpx.AsyncClient,
    base_url: str,
    *,
    model: str,
    prompt: str,
    system: str | None = None,
    options: dict[str, Any] | None = None,
    timeout: httpx.Timeout | None = None,
) -> AsyncIterator[str]:
    opts = options or {}
    b = _norm_base(base_url)
    backend = await detect_llm_backend_httpx(client, b)

    async def _iter_openai_sse() -> AsyncIterator[str]:
        full_prompt = f"{system}\n\n{prompt}" if system else prompt
        openai_body = {
            "model": model,
            "prompt": full_prompt,
            "max_tokens": max_tokens_from_llama_options(opts, 2048),
            "temperature": float(opts.get("temperature", 0.7)),
            "stream": True,
        }
        if "top_p" in opts:
            openai_body["top_p"] = float(opts["top_p"])
        stem = await _maybe_save_stack2_llm_request(
            kind="generate_text_stream_openai_v1_completions",
            base_url=b,
            http_path="/v1/completions",
            body=openai_body,
        )
        agg: list[str] = []
        async with client.stream("POST", f"{b}/v1/completions", json=openai_body, timeout=timeout) as resp:
            if resp.status_code >= 400:
                err_preview = (await resp.aread()).decode("utf-8", errors="replace")[:8000]
                await _maybe_save_stack2_llm_response(
                    kind="generate_text_stream_openai_v1_completions",
                    base_url=b,
                    http_path="/v1/completions",
                    stem=stem,
                    http_status=resp.status_code,
                    response_text=err_preview,
                    error_message=f"completions stream HTTP {resp.status_code}",
                )
                raise RuntimeError(
                    f"llama completions stream HTTP {resp.status_code}: {err_preview[:600]}",
                )
            try:
                async for line in resp.aiter_lines():
                    if not line or not line.startswith("data: "):
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
                        agg.append(piece)
                        yield piece
            except Exception as exc:  # noqa: BLE001
                await _maybe_save_stack2_llm_response(
                    kind="generate_text_stream_openai_v1_completions",
                    base_url=b,
                    http_path="/v1/completions",
                    stem=stem,
                    http_status=599,
                    stream_aggregated_text="".join(agg),
                    error_message=str(exc),
                )
                raise
        await _maybe_save_stack2_llm_response(
            kind="generate_text_stream_openai_v1_completions",
            base_url=b,
            http_path="/v1/completions",
            stem=stem,
            http_status=200,
            stream_aggregated_text="".join(agg),
        )

    if backend == "llama":
        payload: dict[str, Any] = {
            "model": model,
            "prompt": prompt,
            "stream": True,
            "options": opts,
        }
        if system:
            payload["system"] = system
        stem = await _maybe_save_stack2_llm_request(
            kind="generate_text_stream_llama_api_generate",
            base_url=b,
            http_path="/api/generate",
            body=payload,
        )
        async with client.stream("POST", f"{b}/api/generate", json=payload, timeout=timeout) as resp:
            if resp.status_code == 404:
                await resp.aread()
                invalidate_llm_backend_cache(b)
                await _maybe_save_stack2_llm_response(
                    kind="generate_text_stream_llama_api_generate",
                    base_url=b,
                    http_path="/api/generate",
                    stem=stem,
                    http_status=404,
                    response_text="",
                )
            elif resp.status_code >= 400:
                err_preview = (await resp.aread()).decode("utf-8", errors="replace")[:8000]
                await _maybe_save_stack2_llm_response(
                    kind="generate_text_stream_llama_api_generate",
                    base_url=b,
                    http_path="/api/generate",
                    stem=stem,
                    http_status=resp.status_code,
                    response_text=err_preview,
                    error_message=f"Llama generate stream HTTP {resp.status_code}",
                )
                raise RuntimeError(
                    f"Llama stream HTTP {resp.status_code}: {err_preview[:600]}",
                )
            else:
                agg_o: list[str] = []
                try:
                    async for line in resp.aiter_lines():
                        if not line:
                            continue
                        try:
                            data = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        piece = data.get("response")
                        if isinstance(piece, str) and piece:
                            agg_o.append(piece)
                            yield piece
                        if data.get("done") is True:
                            break
                except Exception as exc:  # noqa: BLE001
                    await _maybe_save_stack2_llm_response(
                        kind="generate_text_stream_llama_api_generate",
                        base_url=b,
                        http_path="/api/generate",
                        stem=stem,
                        http_status=599,
                        stream_aggregated_text="".join(agg_o),
                        error_message=str(exc),
                    )
                    raise
                await _maybe_save_stack2_llm_response(
                    kind="generate_text_stream_llama_api_generate",
                    base_url=b,
                    http_path="/api/generate",
                    stem=stem,
                    http_status=200,
                    stream_aggregated_text="".join(agg_o),
                )
                return

    async for piece in _iter_openai_sse():
        yield piece


async def aiohttp_compat_generate_text_stream(
    session: aiohttp.ClientSession,
    base_url: str,
    *,
    model: str,
    prompt: str,
    system: str | None = None,
    options: dict[str, Any] | None = None,
    timeout: aiohttp.ClientTimeout | None = None,
) -> AsyncIterator[str]:
    """Текстовый поток: Llama NDJSON /api/generate или OpenAI SSE /v1/completions."""
    opts = options or {}
    b = _norm_base(base_url)
    backend = await detect_llm_backend_aiohttp(session, b)

    async def _iter_openai_sse() -> AsyncIterator[str]:
        full_prompt = f"{system}\n\n{prompt}" if system else prompt
        openai_body: dict[str, Any] = {
            "model": model,
            "prompt": full_prompt,
            "max_tokens": max_tokens_from_llama_options(opts, 2048),
            "temperature": float(opts.get("temperature", 0.7)),
            "stream": True,
        }
        if "top_p" in opts:
            openai_body["top_p"] = float(opts["top_p"])
        stem = await _maybe_save_stack2_llm_request(
            kind="aiohttp_generate_text_stream_openai_v1_completions",
            base_url=b,
            http_path="/v1/completions",
            body=openai_body,
        )
        agg: list[str] = []
        async with session.post(f"{b}/v1/completions", json=openai_body, timeout=timeout) as resp:
            if resp.status >= 400:
                err = await resp.text()
                await _maybe_save_stack2_llm_response(
                    kind="aiohttp_generate_text_stream_openai_v1_completions",
                    base_url=b,
                    http_path="/v1/completions",
                    stem=stem,
                    http_status=int(resp.status),
                    response_text=err,
                    error_message=f"llama completions stream HTTP {resp.status}",
                )
                raise RuntimeError(f"llama completions stream HTTP {resp.status}: {err[:800]}")
            try:
                while True:
                    line_b = await resp.content.readline()
                    if not line_b:
                        break
                    line = line_b.decode("utf-8", errors="replace").rstrip("\r\n")
                    if not line or not line.startswith("data: "):
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
                        agg.append(piece)
                        yield piece
            except Exception as exc:  # noqa: BLE001
                await _maybe_save_stack2_llm_response(
                    kind="aiohttp_generate_text_stream_openai_v1_completions",
                    base_url=b,
                    http_path="/v1/completions",
                    stem=stem,
                    http_status=599,
                    stream_aggregated_text="".join(agg),
                    error_message=str(exc),
                )
                raise
        await _maybe_save_stack2_llm_response(
            kind="aiohttp_generate_text_stream_openai_v1_completions",
            base_url=b,
            http_path="/v1/completions",
            stem=stem,
            http_status=200,
            stream_aggregated_text="".join(agg),
        )

    if backend == "llama":
        payload: dict[str, Any] = {
            "model": model,
            "prompt": prompt,
            "stream": True,
            "options": opts,
        }
        if system:
            payload["system"] = system
        stem = await _maybe_save_stack2_llm_request(
            kind="aiohttp_generate_text_stream_llama_api_generate",
            base_url=b,
            http_path="/api/generate",
            body=payload,
        )
        async with session.post(f"{b}/api/generate", json=payload, timeout=timeout) as resp:
            if resp.status == 404:
                await _maybe_save_stack2_llm_response(
                    kind="aiohttp_generate_text_stream_llama_api_generate",
                    base_url=b,
                    http_path="/api/generate",
                    stem=stem,
                    http_status=404,
                    response_text="",
                )
                invalidate_llm_backend_cache(b)
            elif resp.status != 200:
                err = await resp.text()
                await _maybe_save_stack2_llm_response(
                    kind="aiohttp_generate_text_stream_llama_api_generate",
                    base_url=b,
                    http_path="/api/generate",
                    stem=stem,
                    http_status=int(resp.status),
                    response_text=err,
                    error_message=f"Llama stream HTTP {resp.status}",
                )
                raise RuntimeError(f"Llama stream HTTP {resp.status}: {err[:800]}")
            else:
                agg_o: list[str] = []
                try:
                    while True:
                        line_b = await resp.content.readline()
                        if not line_b:
                            break
                        line = line_b.decode("utf-8", errors="replace").strip()
                        if not line:
                            continue
                        try:
                            data = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        piece = data.get("response")
                        if isinstance(piece, str) and piece:
                            agg_o.append(piece)
                            yield piece
                        if data.get("done") is True:
                            break
                except Exception as exc:  # noqa: BLE001
                    await _maybe_save_stack2_llm_response(
                        kind="aiohttp_generate_text_stream_llama_api_generate",
                        base_url=b,
                        http_path="/api/generate",
                        stem=stem,
                        http_status=599,
                        stream_aggregated_text="".join(agg_o),
                        error_message=str(exc),
                    )
                    raise
                await _maybe_save_stack2_llm_response(
                    kind="aiohttp_generate_text_stream_llama_api_generate",
                    base_url=b,
                    http_path="/api/generate",
                    stem=stem,
                    http_status=200,
                    stream_aggregated_text="".join(agg_o),
                )
                return

    async for piece in _iter_openai_sse():
        yield piece
