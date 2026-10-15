# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# HTTP POST llama-server `/v1/rerank` для desktop и marketing RAG; при сбое — None, порядок из Qdrant.
# Invariants:
# - Пустой `RAG_RERANK_BASE_URL` — реранк не выполняем; не логируем полные документы.
# Related:
# - api.services.marketing_project_rag_service
# - docker/stack/stack2.yml (`llama-rerank`)
# ---

"""HTTP-клиент POST /v1/rerank (llama-server)."""

from __future__ import annotations

import asyncio
import logging
import random
import time
from dataclasses import replace
from typing import Any

import httpx

from api.core.unified_config import unified_settings
from api.monitoring.metrics import observe_rerank_request, observe_rerank_retry
from api.services.marketing_project_rag_service import MarketingRagChunk

logger = logging.getLogger(__name__)

# CPU llama-rerank (Qwen3-Reranker-8B) on punisher: 40×6k chars often exceeds 45s under load.
DEFAULT_RERANK_TIMEOUT_SEC = 60.0
DEFAULT_RERANK_MAX_DOCS = 12
DEFAULT_RERANK_MAX_CHARS_PER_DOC = 2000
DEFAULT_RERANK_MAX_ATTEMPTS = 4
RETRYABLE_RERANK_STATUS_CODES = {429, 500, 502, 503, 504}
_RERANK_CIRCUIT_FAILURES = 0
_RERANK_CIRCUIT_OPEN_UNTIL = 0.0


def _rerank_circuit_open_seconds() -> float:
    raw = str(getattr(unified_settings, "rag_rerank_circuit_open_seconds", 30.0) or 30.0)
    try:
        return max(1.0, min(300.0, float(raw)))
    except ValueError:
        return 30.0


def _rerank_circuit_failure_threshold() -> int:
    raw = str(getattr(unified_settings, "rag_rerank_circuit_failure_threshold", 3) or 3)
    try:
        return max(1, min(20, int(raw)))
    except ValueError:
        return 3


def _rerank_circuit_is_open() -> bool:
    return time.monotonic() < _RERANK_CIRCUIT_OPEN_UNTIL


def _rerank_circuit_record(*, ok: bool) -> None:
    global _RERANK_CIRCUIT_FAILURES, _RERANK_CIRCUIT_OPEN_UNTIL  # noqa: PLW0603
    if ok:
        _RERANK_CIRCUIT_FAILURES = 0
        _RERANK_CIRCUIT_OPEN_UNTIL = 0.0
        return
    _RERANK_CIRCUIT_FAILURES += 1
    if _rerank_circuit_failure_threshold() <= _RERANK_CIRCUIT_FAILURES:
        _RERANK_CIRCUIT_OPEN_UNTIL = time.monotonic() + _rerank_circuit_open_seconds()
        logger.warning("[STEP] rag.rerank circuit_open failures=%s", _RERANK_CIRCUIT_FAILURES)


def _rerank_retry_delay_sec(attempt: int, *, error: Exception | None = None) -> float:
    """Bounded exponential backoff with jitter; longer delays for read timeouts under load."""
    base = 0.35 * (2**attempt)
    if isinstance(error, httpx.ReadTimeout):
        base = 0.5 * (2**attempt)
    jitter = random.uniform(0.0, 0.25)  # noqa: S311 - non-crypto jitter for retry spreading
    return min(base + jitter, 5.0)


def _truncate_for_rerank(text: str, max_chars: int) -> str:
    t = (text or "").strip()
    if max_chars <= 0 or len(t) <= max_chars:
        return t
    return f"{t[: max_chars - 1]}…"


def _parse_rerank_results(payload: dict[str, Any]) -> list[tuple[int, float]] | None:
    raw = payload.get("results")
    if not isinstance(raw, list) or not raw:
        return None
    out: list[tuple[int, float]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        idx = item.get("index")
        if not isinstance(idx, int):
            continue
        score_val = item.get("relevance_score")
        if score_val is None:
            score_val = item.get("score")
        try:
            score = float(score_val) if score_val is not None else 0.0
        except (TypeError, ValueError):  # fmt: skip
            score = 0.0
        out.append((idx, score))
    return out if out else None


async def rerank_by_index(
    query: str,
    documents: list[str],
    *,
    timeout: float,
    model: str | None = None,
) -> list[tuple[int, float]] | None:
    """Вызов llama-server /v1/rerank. Возвращает (index в переданном списке, score) или None при сбое."""
    base = (getattr(unified_settings, "rag_rerank_base_url", None) or "").strip()
    if not base:
        return None
    if _rerank_circuit_is_open():
        observe_rerank_retry(outcome="circuit_open")
        return None
    if not (query or "").strip() or not documents:
        return None
    url = f"{base.rstrip('/')}/v1/rerank"
    body: dict[str, Any] = {
        "query": query.strip(),
        "documents": documents,
    }
    if model and str(model).strip():
        body["model"] = str(model).strip()
    async with httpx.AsyncClient(timeout=timeout) as client:
        for attempt in range(DEFAULT_RERANK_MAX_ATTEMPTS):
            started = asyncio.get_event_loop().time()
            try:
                r = await client.post(url, json=body)
            except httpx.HTTPError as e:
                observe_rerank_request(
                    duration_seconds=asyncio.get_event_loop().time() - started,
                    status="http_error",
                )
                if attempt >= DEFAULT_RERANK_MAX_ATTEMPTS - 1:
                    observe_rerank_retry(outcome="exhausted_http_error")
                    logger.warning(
                        "[STEP] rag.rerank request_failed url=%s attempts=%s error_type=%s error=%r",
                        url,
                        DEFAULT_RERANK_MAX_ATTEMPTS,
                        type(e).__name__,
                        e,
                    )
                    _rerank_circuit_record(ok=False)
                    return None
                delay = _rerank_retry_delay_sec(attempt, error=e)
                observe_rerank_retry(outcome="retry_http_error")
                logger.warning(
                    "[STEP] rag.rerank retry_http_error url=%s attempt=%s/%s retry_in=%.2fs error_type=%s error=%r",
                    url,
                    attempt + 1,
                    DEFAULT_RERANK_MAX_ATTEMPTS,
                    delay,
                    type(e).__name__,
                    e,
                )
                await asyncio.sleep(delay)
                continue

            if r.status_code >= 400:
                observe_rerank_request(
                    duration_seconds=asyncio.get_event_loop().time() - started,
                    status=f"http_{r.status_code}",
                )
                preview = (r.text or "")[:240]
                if r.status_code == 500 and "too large to process" in preview.lower() and len(documents) > 1:
                    shorter = [_truncate_for_rerank(doc, max(128, len(doc) // 2)) for doc in documents]
                    if shorter != documents:
                        retry_body = dict(body)
                        retry_body["documents"] = shorter
                        r2 = await client.post(url, json=retry_body)
                        if r2.status_code < 400:
                            payload = r2.json()
                            if isinstance(payload, dict):
                                parsed = _parse_rerank_results(payload)
                                if parsed is not None:
                                    return parsed

                if r.status_code in RETRYABLE_RERANK_STATUS_CODES and attempt < DEFAULT_RERANK_MAX_ATTEMPTS - 1:
                    delay = _rerank_retry_delay_sec(attempt)
                    observe_rerank_retry(outcome="retry_http_status")
                    logger.warning(
                        "[STEP] rag.rerank retry_status url=%s status=%s attempt=%s/%s retry_in=%.2fs",
                        url,
                        r.status_code,
                        attempt + 1,
                        DEFAULT_RERANK_MAX_ATTEMPTS,
                        delay,
                    )
                    await asyncio.sleep(delay)
                    continue

                logger.warning(
                    "[STEP] rag.rerank http_status=%s url=%s body_preview=%s",
                    r.status_code,
                    url,
                    preview[:200],
                )
                observe_rerank_retry(outcome="failed_http_status")
                _rerank_circuit_record(ok=False)
                return None

            payload = r.json()
            if not isinstance(payload, dict):
                observe_rerank_request(
                    duration_seconds=asyncio.get_event_loop().time() - started,
                    status="invalid_json_type",
                )
                logger.warning("[STEP] rag.rerank invalid_json_type url=%s", url)
                _rerank_circuit_record(ok=False)
                return None
            parsed = _parse_rerank_results(payload)
            if parsed is None:
                observe_rerank_request(
                    duration_seconds=asyncio.get_event_loop().time() - started,
                    status="no_results",
                )
                logger.warning("[STEP] rag.rerank no_results url=%s keys=%s", url, list(payload.keys()))
                _rerank_circuit_record(ok=False)
                return None
            observe_rerank_request(
                duration_seconds=asyncio.get_event_loop().time() - started,
                status="ok",
            )
            _rerank_circuit_record(ok=True)
            return parsed
    return None


async def apply_rerank_to_chunks(
    query: str,
    chunks: list[MarketingRagChunk],
    *,
    take: int,
    timeout_sec: float = DEFAULT_RERANK_TIMEOUT_SEC,
    max_docs: int = DEFAULT_RERANK_MAX_DOCS,
    max_chars_per_doc: int = DEFAULT_RERANK_MAX_CHARS_PER_DOC,
) -> list[MarketingRagChunk]:
    """Переранжирует кандидатов; при сбое возвращает первые take чанков в исходном порядке."""
    if not chunks or take <= 0:
        return []
    if len(chunks) == 1:
        return [replace(chunks[0], ordinal=1)]

    pool = chunks[: max(1, max_docs)]
    docs = [_truncate_for_rerank(c.text, max_chars_per_doc) for c in pool]
    ranked = await rerank_by_index(query, docs, timeout=timeout_sec)

    if ranked is None:
        out = list(pool[:take])
        for i, c in enumerate(out):
            out[i] = replace(c, ordinal=i + 1)
        return out

    by_score = sorted(ranked, key=lambda x: x[1], reverse=True)
    ordered_indices: list[int] = []
    seen: set[int] = set()
    score_by_idx: dict[int, float] = {i: s for i, s in ranked}

    for idx, _s in by_score:
        if 0 <= idx < len(pool) and idx not in seen:
            seen.add(idx)
            ordered_indices.append(idx)
    for i in range(len(pool)):
        if i not in seen:
            ordered_indices.append(i)

    out_chunks: list[MarketingRagChunk] = []
    for j, idx in enumerate(ordered_indices[:take]):
        c = pool[idx]
        rs = score_by_idx.get(idx)
        out_chunks.append(
            replace(
                c,
                ordinal=j + 1,
                score=float(rs) if rs is not None else c.score,
            )
        )
    return out_chunks
