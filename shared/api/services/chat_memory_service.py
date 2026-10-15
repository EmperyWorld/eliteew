# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Долговременная память чата в Qdrant (chat_history): эмбеддинги, upsert/search с изоляцией по session_id и chat_profile.
# Опционально ограничивает число одновременных HTTP-запросов к сервису эмбеддингов (stack2 / LLAMA_EMBEDDING_URL) —
# см. ``EWA_COMPANION_EMBED_HTTP_CONCURRENCY``.
# Invariants:
# - Размер вектора и модель эмбеддингов согласованы с unified_settings (AI_EMBEDDINGS_DIMENSION и др.).
# - Коллекция chat_history пересоздаётся при рассогласовании dim с текущими настройками (см. ensure_cosine_vector_collection).
# - Embed HTTP input is clipped to ``LLAMA_EMBED_CTX`` (dense multilingual headroom); exceed_context 400 is not retried.
# Related:
# - api.core.qdrant_vector_collection
# - api.services.marketing_project_rag_service (общий Qdrant-клиент и EMBEDDING_DIMENSION)
# - documentation/platform/STACK2-LLM-CONTRACT.md (LLAMA_EMBED_CTX)
# ---
"""Chat long-term memory via Qdrant.

Embeddings: Llama ``/api/embed`` или llama-server ``/v1/embeddings`` (см. ``LLAMA_EMBEDDING_URL``).
Размерность вектора: ``AI_EMBEDDINGS_DIMENSION`` (по умолчанию 768; для v2-moe обычно оставить 768). Collection: chat_history;
payload: text, session_id, message_id (optional), chat_profile, memory_kind.

Embed input is clipped to fit remote ``LLAMA_EMBED_CTX`` (default 4096); permanent
``exceed_context_size`` / HTTP 400 validation errors are not retried as transient.

**Arly vs Bez (chat_profile isolation)**

- Primary scope is always ``session_id``: vectors are stored and retrieved per session.
- If the same ``session_id`` is reused with a different ``chat_profile`` (e.g. settings
  changed from ``arly_base`` to ``bezrazdelny_agent``), points written under the old
  profile would still match session-only search. Callers should pass ``chat_profile``
  into ``search_memory`` so retrieval is restricted to the current persona.
- ``bezrazdelny_agent``: search accepts only points whose payload ``chat_profile`` is
  exactly ``bezrazdelny_agent`` (no legacy untagged points).
- ``arly_base``: search accepts points tagged ``arly_base`` or **untagged** legacy rows
  (written before ``chat_profile`` was stored on the payload).
- Other canonical profile ids: exact payload match only.

Ingestion rules differ by profile (length floors, turn vs user-only); see
``prepare_memory_record`` and ``_memory_ingest_params``.

API: ``search_memory(..., chat_profile=...)``; ``upsert_memory(..., chat_profile=...)``.
"""

from __future__ import annotations

import asyncio
import logging
import os
import random
import uuid
from contextlib import asynccontextmanager
from typing import Any

try:
    import aiohttp
except ImportError:
    aiohttp = None  # type: ignore[assignment]

from api.core.unified_config import unified_settings
from api.monitoring.metrics import observe_embedding_request, observe_embedding_retry
from api.utils.llama_keep_alive import llama_keep_alive_from_settings
from api.utils.llm_openai_compat_http import aiohttp_compat_embeddings_dict

logger = logging.getLogger(__name__)

_EMBED_HTTP_SEM: asyncio.Semaphore | None = None
_EMBED_HTTP_SEM_CAP: int = -1


def _embed_http_concurrency_cap() -> int:
    """Max concurrent singleton embedding HTTP calls; ``0`` = unlimited."""

    try:
        raw = int(os.getenv("EWA_COMPANION_EMBED_HTTP_CONCURRENCY", "0").strip() or "0")
    except ValueError:
        raw = 0
    return max(0, min(raw, 64))


@asynccontextmanager
async def _singleton_embed_http_slot():
    """Optional global throttle for ``_get_embedding`` (one text → one HTTP round-trip)."""

    cap = _embed_http_concurrency_cap()
    if cap <= 0:
        yield
        return
    global _EMBED_HTTP_SEM, _EMBED_HTTP_SEM_CAP
    if _EMBED_HTTP_SEM is None or cap != _EMBED_HTTP_SEM_CAP:
        _EMBED_HTTP_SEM = asyncio.Semaphore(cap)
        _EMBED_HTTP_SEM_CAP = cap
    sem = _EMBED_HTTP_SEM
    await sem.acquire()
    try:
        yield
    finally:
        sem.release()


CHAT_HISTORY_COLLECTION = "chat_history"
DEFAULT_CHAT_PROFILE = "arly_base"
PROFILE_BEZRAZDELNY_AGENT = "bezrazdelny_agent"
MEMORY_KIND_TURN = "turn"
MEMORY_KIND_USER_INPUT = "user_input"
DESKTOP_EPISODIC_MEMORY_POINT_NAMESPACE = uuid.UUID("c8f2a1b0-4d3e-4f5a-9b6c-1d2e3f4a5b6c")

# Shared floor for _looks_like_noise (per-profile user-only minimum is higher for bez).
_MIN_USER_CHARS = 12


def _resolve_memory_chat_profile(chat_profile: str | None) -> str:
    """Canonical profile string for payload tags and optional search filtering."""
    p = (chat_profile or DEFAULT_CHAT_PROFILE).strip()
    return p or DEFAULT_CHAT_PROFILE


def _payload_chat_profile_value(payload: dict[str, Any]) -> str | None:
    raw = payload.get("chat_profile")
    if not isinstance(raw, str):
        return None
    s = raw.strip()
    return s or None


def _payload_allowed_for_search_profile(payload: dict[str, Any], want: str) -> bool:
    """Whether a hit should be surfaced when search_memory narrows by chat_profile."""
    stored = _payload_chat_profile_value(payload)
    if want == PROFILE_BEZRAZDELNY_AGENT:
        return stored == PROFILE_BEZRAZDELNY_AGENT
    if want == DEFAULT_CHAT_PROFILE:
        return stored is None or stored == DEFAULT_CHAT_PROFILE
    return stored == want


def _memory_hit_excluded_by_message_id(payload: dict[str, Any], excluded_set: set[str]) -> bool:
    """Exclude inline history duplicates only; episodic turn records stay searchable."""
    if payload.get("memory_kind") == MEMORY_KIND_TURN:
        return False
    msg_id = payload.get("message_id")
    return isinstance(msg_id, str) and msg_id in excluded_set


def _embed_ctx_tokens() -> int:
    """Remote llama-embed ``-c`` / ``LLAMA_EMBED_CTX`` (gpu141 default 4096)."""
    try:
        raw = int(os.getenv("LLAMA_EMBED_CTX", "4096").strip() or "4096")
    except ValueError:
        raw = 4096
    return max(512, min(raw, 131072))


def _embed_max_input_chars() -> int:
    """
    Conservative char budget under ``LLAMA_EMBED_CTX``.

    Prod evidence (Qwen3-Embedding, Cyrillic turn): ~5200 chars → ~4383 tokens
    (~1.19 chars/token). Use 0.85 chars/token headroom so clip stays under n_ctx.
    """
    return max(256, int((_embed_ctx_tokens() - 64) * 0.85))


def _clip_text_for_embedding(text: str) -> str:
    """Clip one embed input so llama-server does not return exceed_context_size."""
    raw = (text or "").strip()
    if not raw:
        return ""
    limit = _embed_max_input_chars()
    if len(raw) <= limit:
        return raw
    clipped = raw[: max(1, limit - 1)].rstrip() + "…"
    logger.info(
        "[STEP] chat_memory_embed_clip chars_in=%s chars_out=%s embed_ctx=%s",
        len(raw),
        len(clipped),
        _embed_ctx_tokens(),
    )
    return clipped


def _is_non_retryable_embed_error(exc: BaseException) -> bool:
    """HTTP 400 validation / exceed_context_size will not succeed on retry."""
    msg = str(exc).lower()
    if "exceed_context_size" in msg or "exceeds the available context size" in msg:
        return True
    if "embeddings http 400" in msg or "embed http 400" in msg:
        return True
    return "embeddings http 422" in msg or "embed http 422" in msg


def _memory_ingest_params(profile: str) -> tuple[int, int, int, int, int]:
    """
    Per-chat-profile ingestion limits for prepare_memory_record only.

    Returns:
        min_user_only: minimum normalized user length when storing user-only memory.
        min_assistant_turn: minimum assistant length to keep a turn record (or strip assistant).
        max_user: trim cap for user side.
        max_assistant: trim cap for assistant side in turn records.
        min_alnum: minimum alphanumeric characters to avoid noise rejection.

    Turn caps stay under ``_embed_max_input_chars()`` (``User:`` / ``Assistant:`` labels included).
    """
    # "User: " + "\\nAssistant: " ≈ 18 chars overhead on turn_text.
    budget = max(512, _embed_max_input_chars() - 24)
    match profile:
        case "bezrazdelny_agent":
            # Richer long-form memory, but still embeddable under LLAMA_EMBED_CTX.
            max_user = min(1200, budget // 3)
            max_assistant = max(400, budget - max_user)
            return (24, 24, max_user, max_assistant, 5)
        case _:
            # arly_base and unknown profiles: slightly tighter assistant blob, shorter user cap.
            max_user = min(1100, budget // 3)
            max_assistant = max(400, budget - max_user)
            return (12, 20, max_user, max_assistant, 4)


# Optional Qdrant client (lazy init)
_qdrant_client: Any = None
_qdrant_client_lock: Any = None

# Optional companion episodic client (lazy; may reuse generic client when URLs match and no api key).
_companion_episodic_qdrant_client: Any = None


def _get_qdrant_lock():
    import asyncio

    global _qdrant_client_lock
    if _qdrant_client_lock is None:
        _qdrant_client_lock = asyncio.Lock()
    return _qdrant_client_lock


async def _get_qdrant_client():
    """Lazy init AsyncQdrantClient; return None if unavailable."""
    global _qdrant_client
    try:
        from qdrant_client import AsyncQdrantClient
    except ImportError:
        logger.debug("qdrant_client not installed, chat memory disabled")
        return None
    async with _get_qdrant_lock():
        if _qdrant_client is not None:
            return _qdrant_client
        try:
            url = unified_settings.qdrant.internal_url
            _qdrant_client = AsyncQdrantClient(url=url)
            # lightweight check
            await _qdrant_client.get_collections()
            logger.info("Chat memory: Qdrant client connected to %s", url)
            return _qdrant_client
        except Exception as e:
            logger.warning("Chat memory: Qdrant unavailable (%s), long-term memory disabled", e)
            _qdrant_client = None
            return None


async def _get_qdrant_client_companion_episodic():
    """Lazy init companion HCM episodic ``AsyncQdrantClient``; may share the generic chat client."""

    global _companion_episodic_qdrant_client
    try:
        from qdrant_client import AsyncQdrantClient
    except ImportError:
        logger.debug("qdrant_client not installed, companion episodic disabled")
        return None

    url_e = unified_settings.companion_episodic_qdrant_http_url
    url_catalog = unified_settings.qdrant.internal_url.rstrip("/")
    api_key_raw = getattr(unified_settings, "ewa_qdrant_api_key", None)
    api_key = str(api_key_raw or "").strip()
    normalized_e = (url_e or "").strip().rstrip("/")

    if not api_key and normalized_e == url_catalog.strip().rstrip("/"):
        return await _get_qdrant_client()

    async with _get_qdrant_lock():
        if _companion_episodic_qdrant_client is not None:
            return _companion_episodic_qdrant_client
        try:
            kwargs: dict[str, Any] = {"url": normalized_e or url_catalog}
            if api_key:
                kwargs["api_key"] = api_key
            _companion_episodic_qdrant_client = AsyncQdrantClient(**kwargs)
            await _companion_episodic_qdrant_client.get_collections()
            logger.info("Companion episodic: Qdrant client connected to %s", kwargs["url"])
            return _companion_episodic_qdrant_client
        except Exception as e:
            logger.warning("Companion episodic: Qdrant unavailable (%s), episodic vector path degraded", e)
            _companion_episodic_qdrant_client = None
            return None


def _embedding_model() -> str:
    return unified_settings.embedding_ai_model


def _embedding_dim() -> int:
    return int(getattr(unified_settings, "ai_embeddings_dimension", 768) or 768)


def _llama_embed_timeout_sec(*, batch: bool = False) -> float:
    """Таймаут HTTP к Llama /api/embed (см. LLAMA_EMBED_TIMEOUT_SEC). Для батча — до 600с, не ниже одиночного."""
    base = int(getattr(unified_settings, "llama_embed_timeout_sec", 180) or 180)
    if batch:
        return float(min(600, max(base, base * 2)))
    return float(base)


def _embedding_retry_attempts() -> int:
    """Bounded retry count for transient embedding HTTP errors."""
    try:
        raw = int(os.getenv("EWA_COMPANION_EMBED_HTTP_RETRIES", "3").strip() or "3")
    except ValueError:
        raw = 3
    return max(1, min(raw, 5))


def _embedding_retry_delay_sec(attempt: int) -> float:
    """Exponential backoff with jitter for transient embed failures."""
    base = 0.2 * (2**attempt)
    jitter = random.uniform(0.0, 0.15)  # noqa: S311 - non-crypto jitter for retry spreading
    return min(base + jitter, 2.0)


# Размер вектора при импорте модуля; для рантайм-проверок см. _embedding_dim().
# Импортируют: marketing_project_rag_service, chat_knowledge_base_service.
EMBEDDING_DIMENSION = _embedding_dim()


def rag_http_embed_batch_size() -> int:
    """
    Сколько текстов слать одним HTTP-запросом при индексации RAG (chunks → /v1/embeddings).

    Env: ``AI_EMBEDDINGS_BATCH_SIZE`` (см. ``UnifiedConfig.ai_embeddings_batch_size``). Ограничение 8…128 —
    баланс между числом round-trip и памятью/ubatch на llama-embed.
    """
    raw = int(getattr(unified_settings, "ai_embeddings_batch_size", 50) or 50)
    return max(8, min(raw, 128))


async def _get_embedding(text: str) -> list[float] | None:
    """Эмбеддинг через Llama /api/embed или llama /v1/embeddings (LLAMA_EMBEDDING_URL)."""

    clipped = _clip_text_for_embedding(text)
    if not clipped or aiohttp is None:
        return None
    async with _singleton_embed_http_slot():
        dim = _embedding_dim()
        embed_base = unified_settings.llama_embeddings_service_base
        force_openai = bool((getattr(unified_settings, "llama_embedding_url", None) or "").strip())
        timeout = aiohttp.ClientTimeout(total=_llama_embed_timeout_sec(batch=False))
        attempts = _embedding_retry_attempts()
        async with aiohttp.ClientSession() as session:
            for attempt in range(attempts):
                started = asyncio.get_event_loop().time()
                try:
                    data = await aiohttp_compat_embeddings_dict(
                        session,
                        embed_base,
                        model=_embedding_model(),
                        input_data=clipped,
                        dimensions=dim if dim >= 32 else None,
                        keep_alive=llama_keep_alive_from_settings(),
                        timeout=timeout,
                        force_openai=force_openai,
                    )
                    emb_list = data.get("embeddings")
                    if isinstance(emb_list, list) and len(emb_list) > 0:
                        emb = emb_list[0]
                        if isinstance(emb, list) and len(emb) == dim:
                            observe_embedding_request(
                                operation="chat_memory_single",
                                duration_seconds=asyncio.get_event_loop().time() - started,
                                status="ok",
                            )
                            return emb
                        got = len(emb) if isinstance(emb, list) else type(emb).__name__
                        observe_embedding_request(
                            operation="chat_memory_single",
                            duration_seconds=asyncio.get_event_loop().time() - started,
                            status="invalid_shape",
                        )
                        logger.warning(
                            "Chat memory: invalid embedding shape expected_dim=%s got=%s (align AI_EMBEDDINGS_DIMENSION with POST /v1/embeddings)",
                            dim,
                            got,
                        )
                        return None
                    observe_embedding_request(
                        operation="chat_memory_single",
                        duration_seconds=asyncio.get_event_loop().time() - started,
                        status="empty",
                    )
                    logger.warning(
                        "Chat memory: invalid embedding shape expected_dim=%s got=no_vectors (check LLAMA_EMBEDDING_URL/model and embed service logs)",
                        dim,
                    )
                    return None
                except Exception as e:
                    observe_embedding_request(
                        operation="chat_memory_single",
                        duration_seconds=asyncio.get_event_loop().time() - started,
                        status="error",
                    )
                    if _is_non_retryable_embed_error(e) or attempt >= attempts - 1:
                        observe_embedding_retry(
                            operation="chat_memory_single",
                            outcome="non_retryable" if _is_non_retryable_embed_error(e) else "exhausted",
                        )
                        logger.warning(
                            "Chat memory: embedding error base=%s attempts=%s error=%s",
                            embed_base,
                            attempt + 1,
                            e,
                        )
                        return None
                    delay = _embedding_retry_delay_sec(attempt)
                    observe_embedding_retry(operation="chat_memory_single", outcome="retry")
                    logger.warning(
                        "Chat memory: embedding transient failure base=%s attempt=%s/%s retry_in=%.2fs error=%s",
                        embed_base,
                        attempt + 1,
                        attempts,
                        delay,
                        e,
                    )
                    await asyncio.sleep(delay)
        return None


async def _get_embeddings_batch(texts: list[str]) -> list[list[float] | None]:  # pyright: ignore[reportUnusedFunction]
    """Батч эмбеддингов (Llama или OpenAI-совместимый сервер)."""
    if not texts or aiohttp is None:
        return []
    inputs = [_clip_text_for_embedding(t) for t in texts if (t or "").strip()]
    inputs = [t for t in inputs if t]
    if not inputs:
        return [None] * len(texts)
    dim = _embedding_dim()
    embed_base = unified_settings.llama_embeddings_service_base
    force_openai = bool((getattr(unified_settings, "llama_embedding_url", None) or "").strip())
    timeout = aiohttp.ClientTimeout(total=_llama_embed_timeout_sec(batch=True))
    attempts = _embedding_retry_attempts()
    async with aiohttp.ClientSession() as session:
        for attempt in range(attempts):
            started = asyncio.get_event_loop().time()
            try:
                data = await aiohttp_compat_embeddings_dict(
                    session,
                    embed_base,
                    model=_embedding_model(),
                    input_data=inputs if len(inputs) > 1 else inputs[0],
                    dimensions=dim if dim >= 32 else None,
                    keep_alive=llama_keep_alive_from_settings(),
                    timeout=timeout,
                    force_openai=force_openai,
                )
                emb_list = data.get("embeddings")
                if not isinstance(emb_list, list):
                    observe_embedding_request(
                        operation="chat_memory_batch",
                        duration_seconds=asyncio.get_event_loop().time() - started,
                        status="invalid_shape",
                    )
                    return [None] * len(inputs)
                out: list[list[float] | None] = []
                for _i, emb in enumerate(emb_list):
                    if isinstance(emb, list) and len(emb) == dim:
                        out.append(emb)
                    else:
                        out.append(None)
                while len(out) < len(inputs):
                    out.append(None)
                observe_embedding_request(
                    operation="chat_memory_batch",
                    duration_seconds=asyncio.get_event_loop().time() - started,
                    status="ok",
                )
                return out[: len(inputs)]
            except Exception as e:
                observe_embedding_request(
                    operation="chat_memory_batch",
                    duration_seconds=asyncio.get_event_loop().time() - started,
                    status="error",
                )
                if _is_non_retryable_embed_error(e) or attempt >= attempts - 1:
                    observe_embedding_retry(
                        operation="chat_memory_batch",
                        outcome="non_retryable" if _is_non_retryable_embed_error(e) else "exhausted",
                    )
                    logger.warning(
                        "Chat memory: batch embedding error base=%s attempts=%s error=%s",
                        embed_base,
                        attempt + 1,
                        e,
                    )
                    return [None] * len(inputs)
                delay = _embedding_retry_delay_sec(attempt)
                observe_embedding_retry(operation="chat_memory_batch", outcome="retry")
                logger.warning(
                    "Chat memory: batch embedding transient failure base=%s attempt=%s/%s retry_in=%.2fs error=%s",
                    embed_base,
                    attempt + 1,
                    attempts,
                    delay,
                    e,
                )
                await asyncio.sleep(delay)
    return [None] * len(inputs)


async def _ensure_collection(client: Any) -> bool:
    """Create chat_history collection if not exists (размер из AI_EMBEDDINGS_DIMENSION, cosine)."""
    from api.core.qdrant_defaults import QDRANT_INDEXING_THRESHOLD
    from api.core.qdrant_vector_collection import ensure_cosine_vector_collection

    return await ensure_cosine_vector_collection(
        client,
        collection_name=CHAT_HISTORY_COLLECTION,
        vector_size=_embedding_dim(),
        indexing_threshold=QDRANT_INDEXING_THRESHOLD,
        log_step="Chat memory",
    )


async def search_memory(
    query: str,
    session_id: str,
    exclude_ids: list[str] | None = None,
    limit: int = 16,
    chat_profile: str | None = None,
) -> list[str]:
    """
    Search Qdrant for relevant past messages in this session.
    Excludes points whose payload.message_id is in exclude_ids (current history window),
    except episodic ``memory_kind=turn`` records (desktop/ensemble long-term memory).
    When ``chat_profile`` is set, results are limited to points allowed for that persona
    (see module docstring: Bez strict, Arly + legacy untagged).
    When omitted, behavior matches historical session-only search (callers should pass
    the resolved profile to avoid cross-persona recall within one session).
    Returns list of text payloads (most relevant first). Empty list on any failure.
    """
    if not (query or "").strip():
        return []
    embedding = await _get_embedding(query)
    if not embedding:
        return []
    client = await _get_qdrant_client()
    if client is None:
        return []
    if not await _ensure_collection(client):
        return []
    try:
        from qdrant_client.models import (
            FieldCondition,
            Filter,
            IsEmptyCondition,
            MatchValue,
            MinShould,
            PayloadField,
        )

        must: list[Any] = [FieldCondition(key="session_id", match=MatchValue(value=session_id))]
        search_profile: str | None = None
        if chat_profile is not None:
            search_profile = _resolve_memory_chat_profile(chat_profile)
            match search_profile:
                case p if p == PROFILE_BEZRAZDELNY_AGENT:
                    must.append(
                        FieldCondition(
                            key="chat_profile",
                            match=MatchValue(value=PROFILE_BEZRAZDELNY_AGENT),
                        )
                    )
                case p if p == DEFAULT_CHAT_PROFILE:
                    must.append(
                        Filter(
                            should=[
                                FieldCondition(
                                    key="chat_profile",
                                    match=MatchValue(value=DEFAULT_CHAT_PROFILE),
                                ),
                                IsEmptyCondition(is_empty=PayloadField(key="chat_profile")),
                            ],
                            min_should=MinShould(
                                conditions=[
                                    FieldCondition(
                                        key="chat_profile",
                                        match=MatchValue(value=DEFAULT_CHAT_PROFILE),
                                    ),
                                    IsEmptyCondition(is_empty=PayloadField(key="chat_profile")),
                                ],
                                min_count=1,
                            ),
                        )
                    )
                case p:
                    must.append(FieldCondition(key="chat_profile", match=MatchValue(value=p)))
        if exclude_ids:
            exclude_ids = [x for x in exclude_ids if x]
            if exclude_ids:
                logger.info(
                    "Chat memory: post-filter exclude_ids=%s (текущее окно истории; turn memory сохраняется)",
                    len(exclude_ids),
                )
        query_filter = Filter(must=must)
        res = await client.query_points(
            collection_name=CHAT_HISTORY_COLLECTION,
            query=embedding,
            query_filter=query_filter,
            limit=limit,
            with_payload=True,
            with_vectors=False,
        )
        texts: list[str] = []
        excluded_set = set(exclude_ids or [])
        for pt in res.points or []:
            payload = pt.payload or {}
            if search_profile is not None and not _payload_allowed_for_search_profile(
                payload,
                search_profile,
            ):
                continue
            if _memory_hit_excluded_by_message_id(payload, excluded_set):
                continue
            t = payload.get("text")
            if isinstance(t, str) and t.strip():
                cleaned = _normalize_memory_text(t)
                if cleaned:
                    texts.append(cleaned)
        if texts:
            logger.info(
                "Chat memory: найдено %s релевантных фрагментов для session_id=%s, подмешано в промпт:\n%s",
                len(texts),
                session_id,
                "\n---\n".join(t[:500] + ("..." if len(t) > 500 else "") for t in texts),
            )
        else:
            logger.info("Chat memory: по запросу для session_id=%s релевантных фрагментов не найдено", session_id)
        return texts
    except Exception as e:
        logger.warning("Chat memory: search failed: %s", e)
        return []


async def upsert_memory(
    text: str,
    session_id: str,
    message_id: str | None = None,
    assistant_text: str | None = None,
    chat_profile: str | None = None,
    *,
    source_message_id: str | None = None,
    idempotency_key: str | None = None,
) -> None:
    """
    Embed text and upsert one point into chat_history.
    Payload: text, session_id, message_id (legacy inline dedupe), chat_profile, memory_kind.
    ``source_message_id`` is traceability only (not used for exclude_ids dedupe).
    ``idempotency_key`` stabilizes point id for the same turn (re-stream / retry).
    If assistant_text is provided, stored text is "User: {text}\\nAssistant: {assistant_text}".
    No-op on embedding or Qdrant failure.
    """
    prepared = prepare_memory_record(
        user_text=text,
        assistant_text=assistant_text,
        chat_profile=chat_profile,
    )
    if prepared is None:
        return
    stored_text, payload_extras = prepared
    embedding = await _get_embedding(stored_text)
    if not embedding:
        return
    client = await _get_qdrant_client()
    if client is None:
        return
    if not await _ensure_collection(client):
        return
    try:
        from qdrant_client.models import PointStruct

        point_id: str
        if idempotency_key:
            point_id = str(
                uuid.uuid5(
                    DESKTOP_EPISODIC_MEMORY_POINT_NAMESPACE,
                    f"{session_id}:{idempotency_key}",
                )
            )
        elif message_id:
            point_id = str(message_id)
        else:
            point_id = str(uuid.uuid4())
        payload: dict[str, Any] = {"text": stored_text, "session_id": session_id}
        payload.update(payload_extras)
        if message_id:
            payload["message_id"] = message_id
        if source_message_id:
            payload["source_message_id"] = source_message_id
        point = PointStruct(id=point_id, vector=embedding, payload=payload)
        await client.upsert(collection_name=CHAT_HISTORY_COLLECTION, points=[point])
        logger.info(
            "[STEP] chat_memory.upsert session_id=%s kind=%s point_id=%s",
            session_id,
            payload.get("memory_kind"),
            point_id[:12],
        )
    except Exception as e:
        logger.warning("Chat memory: upsert failed: %s", e)


async def delete_chat_history_for_session(session_id: str) -> None:
    """Remove all chat_history points for a session (e.g. desktop chat delete)."""
    if not (session_id or "").strip():
        return
    client = await _get_qdrant_client()
    if client is None:
        return
    if not await _ensure_collection(client):
        return
    try:
        from qdrant_client.models import FieldCondition, Filter, MatchValue

        q_filter = Filter(must=[FieldCondition(key="session_id", match=MatchValue(value=session_id))])
        point_ids: list[Any] = []
        offset = None
        while True:
            res, offset = await client.scroll(
                collection_name=CHAT_HISTORY_COLLECTION,
                scroll_filter=q_filter,
                limit=100,
                offset=offset,
                with_payload=False,
                with_vectors=False,
            )
            for pt in res or []:
                point_ids.append(pt.id)
            if offset is None:
                break
        if point_ids:
            await client.delete(collection_name=CHAT_HISTORY_COLLECTION, points_selector=point_ids)
            logger.info("[STEP] chat_memory.delete session_id=%s points=%s", session_id, len(point_ids))
    except Exception as exc:
        logger.warning("Chat memory: delete session failed session_id=%s err=%s", session_id, exc)


def _normalize_memory_text(text: str | None) -> str:
    if not text:
        return ""
    from api.utils.llm_json_extract import strip_llm_channel_markup, strip_llm_thinking_prefix

    cleaned = strip_llm_thinking_prefix(strip_llm_channel_markup(str(text)))
    return " ".join(cleaned.replace("\u00a0", " ").split()).strip()


def _trim_memory_text(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 1].rstrip() + "…"


def _looks_like_noise(text: str, *, min_alnum: int, min_len_floor: int) -> bool:
    if not text:
        return True
    alnum_count = sum(ch.isalnum() for ch in text)
    if alnum_count < min_alnum:
        return True
    if len(text) < min_len_floor:
        return True
    alpha_count = sum(ch.isalpha() for ch in text)
    # Punctuation / symbol spam (keeps short Cyrillic/Latin phrases intact).
    if len(text) >= 28 and alpha_count > 0 and (alpha_count / len(text)) < 0.12:
        return True
    # Single-character stutter (e.g. "aaaaaa" or "??????").
    if len(text) >= 10:
        most_common = max((text.count(ch) for ch in set(text)), default=0)
        if most_common / len(text) >= 0.72:
            return True
    return False


def _is_ephemeral_assistant_note(text: str) -> bool:
    lowered = text.lower()
    ephemeral_markers = (
        "изображение успешно создано",
        "откройте превью",
        "скачайте оригинал",
        "использован веб-поиск",
        "выполнен анализ веб-страницы",
        "image generated successfully",
        "preview is ready",
        "web search was used",
        "analysis of the page",
    )
    # Short boilerplate only; longer assistant text with the same phrase is likely substantive.
    return any(marker in lowered for marker in ephemeral_markers) and len(lowered) < 240


def prepare_memory_record(
    *,
    user_text: str,
    assistant_text: str | None = None,
    chat_profile: str | None = None,
) -> tuple[str, dict[str, Any]] | None:
    """
    Build selective memory payload:
    - skip very short/noisy records,
    - trim oversized chunks,
    - keep structured turn-level records for profiles that need richer memory.
    """
    profile = _resolve_memory_chat_profile(chat_profile)
    min_user_only, min_assistant_turn, max_user, max_assistant, min_alnum = _memory_ingest_params(profile)

    user_norm = _normalize_memory_text(user_text)
    assistant_norm = _normalize_memory_text(assistant_text)

    if assistant_norm and _is_ephemeral_assistant_note(assistant_norm):
        assistant_norm = ""

    match profile:
        case "bezrazdelny_agent":
            pass
        case _:
            if assistant_norm and len(assistant_norm) < min_assistant_turn:
                assistant_norm = ""

    if assistant_norm and assistant_norm.lower() == user_norm.lower():
        assistant_norm = ""

    if not assistant_norm:
        if len(user_norm) < min_user_only or _looks_like_noise(
            user_norm,
            min_alnum=min_alnum,
            min_len_floor=_MIN_USER_CHARS,
        ):
            return None
        user_trimmed = _trim_memory_text(user_norm, max_user)
        return (
            user_trimmed,
            {"chat_profile": profile, "memory_kind": MEMORY_KIND_USER_INPUT},
        )

    if len(assistant_norm) < min_assistant_turn and profile == "bezrazdelny_agent":
        return None

    user_trimmed = _trim_memory_text(user_norm, max_user)
    assistant_trimmed = _trim_memory_text(assistant_norm, max_assistant)
    turn_text = f"User: {user_trimmed}\nAssistant: {assistant_trimmed}"
    return (
        turn_text,
        {"chat_profile": profile, "memory_kind": MEMORY_KIND_TURN},
    )


__all__ = ("_get_qdrant_client_companion_episodic",)
