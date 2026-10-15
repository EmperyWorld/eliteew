# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Yandex Search API web search for chat/agent context with cache, retries, and event recording.
# Invariants:
# - Provider is Yandex only; failures yield [] without charging quota.
# - Quota is checked before search and consumed only after non-empty hits.
# - ConnectError/ConnectTimeout fail fast (no retries); read/HTTP 429/502/503 may retry.
# - SERP hits are multi-token ranked (not single-token OR) before prompt injection.
# - Short meta clarifications («нужна точность…») resolve the SERP query from prior user topic.
# Related:
# - api/services/search_runtime_config_service.py
# - api/services/web_search_events_service.py
# - api/services/web_search_relevance.py
# - documentation/platform/docker-re_doc/PROD-CORE-PODMAN-EGRESS.md
# - documentation/product/WEB-SEARCH-ADMIN-OPERATIONS.md
# - documentation/product/ewa/EWA-COMPANION-CHAT-AND-WORKFLOW-EXTENSION-GUIDE.md
# ---

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
import os
import random
import re
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import Any
from uuid import UUID

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.http_clients import get_httpx_client
from api.core.unified_config import get_unified_settings
from api.services.search_runtime_config_service import (
    EffectiveSearchRuntimeConfig,
    resolve_effective_search_runtime_config,
)
from api.services.unified_cache_service import get_unified_cache
from api.services.web_search_events_service import record_web_search_event
from api.services.web_search_quota_service import (
    WebSearchQuotaExceededError,
    get_web_search_quota_status,
    try_consume_web_search_quota,
)
from api.services.web_search_relevance import rank_web_search_hits, tokenize_web_search_query
from api.utils.llm_wall_clock_context import anchor_web_search_query_to_wall_clock, web_search_freshness_preamble

logger = logging.getLogger(__name__)

YANDEX_WEB_SEARCH_URL = "https://searchapi.api.cloud.yandex.net/v2/web/search"
YANDEX_SEARCH_TIMEOUT = 35.0
YANDEX_CONNECT_TIMEOUT = 5.0
MAX_YANDEX_RETRIES = 2
# Skip SEARCH_TYPE_COM fallback when the RU leg already spent too long (egress/slow path).
YANDEX_COM_RETRY_MAX_FIRST_LEG_MS = 12_000
RETRYABLE_HTTP_STATUSES = frozenset({429, 502, 503})


def _yandex_httpx_timeout() -> httpx.Timeout:
    """Short connect budget; keep read budget for large XML payloads."""

    return httpx.Timeout(
        connect=YANDEX_CONNECT_TIMEOUT,
        read=YANDEX_SEARCH_TIMEOUT,
        write=min(15.0, YANDEX_SEARCH_TIMEOUT),
        pool=YANDEX_CONNECT_TIMEOUT,
    )


MAX_SNIPPET_CHARS = 2500
WEB_SEARCH_QUERY_MAX_CHARS = 160
# Yandex Search API v2: passages per document (community SDK range 1–5; default was implicit 1).
DEFAULT_YANDEX_MAX_PASSAGES = 4
# Legacy alias used by marketing/EWRP modules
BEZ_SEARX_QUERY_MAX_CHARS = WEB_SEARCH_QUERY_MAX_CHARS

WEB_SEARCH_TRIGGERS = (
    "новости",
    "погода",
    "найди в интернете",
    "поищи в интернете",
    "поищи",
    "актуальные данные",
    "документация",
    "что в интернете",
    "поиск в сети",
    "найди в сети",
    "поиск в интернете",
    "свежие данные",
    "последние новости",
    "актуальная информация",
    "поиск по запросу",
    "найди информацию",
    "поищи информацию",
    "что говорит интернет",
    "по гугли",
    "загугли",
    "найди",
)

PURE_TRIGGER_PHRASES = (
    "найди в интернете",
    "поищи в интернете",
    "найди в сети",
    "поиск в сети",
    "поищи в сети",
    "поищи",
    "найди в интернете.",
    "поищи в интернете.",
)

# Short quality/meta clarifications that are not a SERP topic on their own.
_META_CLARIFICATION_MARKERS = (
    "точн",
    "конкрет",
    "подробн",
    "разверн",
    "детализ",
    "деталн",
    "источник",
    "ссылк",
    "цитир",
    "по фактам",
    "только факты",
    "precise",
    "specific",
    "more detail",
    "more details",
    "with sources",
    "cite",
)

_META_CLARIFICATION_STOPWORDS = frozenset(
    {
        "нужна",
        "нужно",
        "нужны",
        "надо",
        "пожалуйста",
        "очень",
        "более",
        "ещё",
        "еще",
        "чуть",
        "совсем",
        "максимально",
        "пожалуй",
        "давай",
        "сделай",
        "ответь",
        "пиши",
        "будь",
        "please",
        "more",
        "be",
        "with",
        "the",
        "and",
        "и",
        "а",
        "но",
        "же",
        "то",
        "что",
        "как",
        "мне",
        "нам",
        "ваш",
        "ваша",
        "ваше",
        "ответ",
        "ответе",
    }
)

SEARCH_QUERY_STOPWORDS = {
    "создай",
    "создать",
    "сделай",
    "сделать",
    "использовать",
    "используй",
    "инструменты",
    "инструмент",
    "анализ",
    "полноценный",
    "детальный",
    "детального",
    "после",
    "затем",
    "потом",
    "собора",
    "сбора",
    "данных",
    "включи",
    "учти",
    "которое",
    "которая",
    "который",
    "будет",
    "чтобы",
    "через",
    "для",
    "это",
    "этого",
    "этой",
    "всему",
    "миру",
    "crawl4ai",
    "изображение",
    "изображения",
    "картинку",
    "картинка",
    "сгенерируй",
    "сгенерировать",
    "генерацию",
    "генерация",
}


@dataclass(frozen=True)
class YandexSearchOutcome:
    hits: list[dict[str, str]]
    error_code: str | None
    http_status: int | None
    latency_ms: int


@dataclass(frozen=True)
class WebSearchCallResult:
    """Structured outcome for callers that need status beyond hit rows."""

    hits: list[dict[str, str]]
    status: str  # ok | empty | error | blocked | quota_denied
    error_code: str | None = None
    latency_ms: int = 0
    cache_hit: bool = False


def should_trigger_web_search(user_message: str) -> bool:
    if not (user_message or "").strip():
        return False
    lower = user_message.strip().lower()
    return any(trigger in lower for trigger in WEB_SEARCH_TRIGGERS)


def _is_pure_trigger_message(text: str) -> bool:
    if not (text or "").strip():
        return True
    lower = text.strip().lower()
    if len(lower) > 60:
        return False
    return any(lower == p or lower.rstrip(".!") == p.rstrip(".!") for p in PURE_TRIGGER_PHRASES)


_META_TOPIC_BLOCKLIST = frozenset(
    {
        "точность",
        "конкретика",
        "конкретнее",
        "конкретно",
        "конкретику",
        "конкретики",
        "точнее",
        "подробнее",
        "разверни",
        "развернуть",
        "детальнее",
        "детально",
        "источники",
        "источник",
        "ссылки",
        "ссылка",
        "цитаты",
        "facts",
        "sources",
        "details",
        "precise",
        "specific",
        "precision",
    }
)

_META_STEM_PREFIXES = (
    "точн",
    "конкрет",
    "подробн",
    "разверн",
    "детализ",
    "деталн",
    "источник",
    "ссылк",
    "цитир",
)


def _substance_tokens_for_web_query(text: str) -> list[str]:
    """Tokens that look like a search topic after stripping meta/stop filler."""

    lower = (text or "").strip().lower()
    raw = re.findall(r"[a-zа-яё0-9]{2,}", lower, flags=re.IGNORECASE)
    out: list[str] = []
    for tok in raw:
        t = tok.casefold()
        if t in SEARCH_QUERY_STOPWORDS or t in _META_CLARIFICATION_STOPWORDS:
            continue
        if t in _META_TOPIC_BLOCKLIST:
            continue
        if any(t.startswith(prefix) for prefix in _META_STEM_PREFIXES):
            continue
        out.append(t)
    return out


def is_meta_clarification_web_line(text: str) -> bool:
    """True when the line is a quality/meta ask without a standalone SERP topic."""

    lower = (text or "").strip().lower().rstrip(".!?…")
    if not lower or len(lower) > 96:
        return False
    if not any(m in lower for m in _META_CLARIFICATION_MARKERS):
        return False
    # Pure meta only — keep lines that still carry a topic token («точность по ставке ЦБ»).
    return not _substance_tokens_for_web_query(lower)


def is_web_search_query_ambiguous(query: str) -> bool:
    """True when SERP would run on meta/follow-up/filler without a usable topic."""

    q = (query or "").strip()
    if not q:
        return True
    # Unresolved follow-up / pure trigger / pure meta is not a search topic.
    if _should_resolve_query_from_history(q):
        return True
    return not _substance_tokens_for_web_query(q)


def _should_resolve_query_from_history(text: str) -> bool:
    if _is_pure_trigger_message(text):
        return True
    if is_meta_clarification_web_line(text):
        return True
    lower = text.strip().lower().rstrip(".!?…")
    if len(lower) > 96:
        return False
    followups = (
        "поищи еще",
        "поищи ещё",
        "найди еще",
        "найди ещё",
        "ищи еще",
        "ищи ещё",
        "сейчас попробуй",
        "попробуй найти",
        "попробуй еще",
        "попробуй ещё",
        "давай",
        "а сейчас",
        "еще раз",
        "ещё раз",
    )
    if any(lower == phrase or lower.startswith(f"{phrase} ") for phrase in followups):
        return True
    if len(lower) <= 28 and any(w in lower for w in ("поищ", "найди", "ищи", "попробуй")):
        tokens = re.findall(r"[a-zа-яё0-9]{4,}", lower)
        if len(tokens) <= 3:
            return True
    return False


def _condense_search_query(text: str) -> str:
    cleaned = re.sub(r"https?://\S+", " ", text, flags=re.IGNORECASE)
    cleaned = re.sub(
        r"\bcrawl4ai\b",
        " ",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(
        r"(после\s+анализа.*|затем.*|потом.*|и\s+(?:сгенерируй|создай|нарисуй).*)",
        " ",
        cleaned,
        flags=re.IGNORECASE | re.DOTALL,
    )
    # Shared tokenizer keeps allowlisted short tokens (цб, рф, …) that {3,} would drop.
    tokens = tokenize_web_search_query(cleaned, stopwords=SEARCH_QUERY_STOPWORDS)
    return " ".join(tokens[:16]).strip()


def _filter_hits_by_query_overlap(rows: list[dict[str, str]], query: str, limit: int) -> list[dict[str, str]]:
    """Rank/filter SERP hits by multi-token coverage (legacy name kept for callers/tests)."""

    return rank_web_search_hits(
        rows,
        query,
        limit=limit,
        stopwords=SEARCH_QUERY_STOPWORDS,
    )


def _web_search_rerank_enabled() -> bool:
    raw = (os.getenv("WEB_SEARCH_RERANK_ENABLED") or "").strip().lower()
    if raw in {"0", "false", "off", "no"}:
        return False
    if raw in {"1", "true", "on", "yes"}:
        return True
    base = (getattr(get_unified_settings(), "rag_rerank_base_url", None) or "").strip()
    return bool(base)


async def _maybe_rerank_web_hits(
    *,
    query: str,
    hits: list[dict[str, str]],
    take: int,
) -> list[dict[str, str]]:
    if take <= 0 or len(hits) <= 1 or not _web_search_rerank_enabled():
        return hits[:take]
    try:
        from api.services.rerank_client import DEFAULT_RERANK_TIMEOUT_SEC, rerank_by_index
    except Exception as exc:  # noqa: BLE001 — optional dependency path
        logger.debug("[STEP] search.rerank_import_skip reason=%s", exc)
        return hits[:take]

    docs: list[str] = []
    for row in hits[: max(take * 2, take)]:
        title = (row.get("title") or "").strip()
        snippet = (row.get("content") or row.get("snippet") or "").strip()
        docs.append(f"{title}\n{snippet}".strip()[:1800])
    ranked = await rerank_by_index(query, docs, timeout=min(25.0, DEFAULT_RERANK_TIMEOUT_SEC))
    if not ranked:
        logger.debug("[STEP] search.rerank_skip reason=unavailable_or_failed take=%s", take)
        return hits[:take]

    by_score = sorted(ranked, key=lambda item: item[1], reverse=True)
    ordered: list[dict[str, str]] = []
    seen: set[int] = set()
    for idx, _score in by_score:
        if 0 <= idx < len(hits) and idx not in seen:
            seen.add(idx)
            ordered.append(hits[idx])
        if len(ordered) >= take:
            break
    for index, row in enumerate(hits):
        if index not in seen:
            ordered.append(row)
        if len(ordered) >= take:
            break
    logger.info("[STEP] search.rerank_applied in=%s out=%s", len(hits), len(ordered[:take]))
    return ordered[:take]


def sanitize_web_search_query(query: str) -> str:
    q = (query or "").strip()
    if not q:
        return ""
    max_c = WEB_SEARCH_QUERY_MAX_CHARS
    if len(q) <= max_c:
        return q
    condensed = _condense_search_query(q).strip()
    pick = condensed if condensed else q
    if len(pick) <= max_c:
        return pick
    cut = pick[:max_c]
    if " " in cut:
        cut = cut.rsplit(" ", 1)[0].strip()
    return cut or pick[:max_c]


def sanitize_searx_query_for_bez(query: str) -> str:
    """Legacy alias — use sanitize_web_search_query."""
    return sanitize_web_search_query(query)


def get_web_search_query(current_content: str, recent_messages: list[dict]) -> str:
    content = (current_content or "").strip()
    if not content:
        return ""
    if len(content) > 220 or "crawl4ai" in content.lower():
        condensed = _condense_search_query(content)
        if condensed:
            return condensed
    if not _should_resolve_query_from_history(content):
        return content
    user_contents = [
        (m.get("content") or "").strip()
        for m in (recent_messages or [])
        if (m.get("role") or "").strip().lower() == "user"
    ]
    for prev in reversed(user_contents[:-1] if len(user_contents) > 1 else []):
        if not prev:
            continue
        # Skip prior meta/follow-up lines; land on the last substantive topic.
        if _should_resolve_query_from_history(prev):
            continue
        if is_web_search_query_ambiguous(prev):
            continue
        return prev
    return content


def _yandex_credentials_configured(*, runtime: EffectiveSearchRuntimeConfig | None = None) -> bool:
    if runtime is not None:
        return bool((runtime.yandex_api_key or "").strip() and (runtime.yandex_folder_id or "").strip())
    settings = get_unified_settings()
    api_key = (getattr(settings, "yandex_search_api_key", None) or "").strip()
    folder_id = (getattr(settings, "yandex_cloud_folder_id", None) or "").strip()
    return bool(api_key and folder_id)


def resolve_web_search_provider(*, runtime: EffectiveSearchRuntimeConfig | None = None) -> str | None:
    """Return active provider id: yandex, or None when credentials are missing."""
    return "yandex" if _yandex_credentials_configured(runtime=runtime) else None


def _query_has_cyrillic(text: str) -> bool:
    return any("\u0400" <= c <= "\u04ff" for c in text)


def _yandex_search_type_for_query(query: str, configured: str) -> str:
    cfg = (configured or "auto").strip()
    if cfg and cfg.lower() != "auto":
        return cfg
    return "SEARCH_TYPE_RU" if _query_has_cyrillic(query) else "SEARCH_TYPE_COM"


def _yandex_l10n_for_search_type(search_type: str, configured: str) -> str:
    cfg = (configured or "auto").strip()
    if cfg and cfg.lower() != "auto":
        return cfg
    if search_type == "SEARCH_TYPE_RU":
        return "LOCALIZATION_RU"
    if search_type == "SEARCH_TYPE_TR":
        return "LOCALIZATION_TR"
    return "LOCALIZATION_EN"


def _yandex_xml_text(node: ET.Element | None) -> str:
    if node is None:
        return ""
    return "".join(node.itertext()).strip()


def parse_yandex_web_search_xml(xml_text: str, *, limit: int) -> list[dict[str, str]]:
    root = ET.fromstring(xml_text)
    out: list[dict[str, str]] = []
    for doc in root.iter("doc"):
        url_val = _yandex_xml_text(doc.find("url"))
        title = _yandex_xml_text(doc.find("title"))
        passages = [_yandex_xml_text(p) for p in doc.findall(".//passage")]
        content = " ".join(p for p in passages if p).strip()
        if not (url_val or title or content):
            continue
        out.append(
            {
                "title": (title or "(no title)")[:500],
                "content": (content or title or "")[:MAX_SNIPPET_CHARS],
                "url": url_val,
            }
        )
        if len(out) >= limit:
            break
    return out


def _build_yandex_web_search_body(
    query: str,
    *,
    limit: int,
    runtime: EffectiveSearchRuntimeConfig | None = None,
) -> dict[str, Any] | None:
    q = (query or "").strip()
    if not q:
        return None
    if runtime is not None:
        search_type_cfg = runtime.yandex_search_type
        l10n_cfg = runtime.yandex_search_l10n
        groups_cap = int(runtime.yandex_groups_on_page or 5)
        folder_id = (runtime.yandex_folder_id or "").strip()
        region = (runtime.yandex_search_region or "225").strip()
    else:
        settings = get_unified_settings()
        search_type_cfg = getattr(settings, "yandex_search_type", "auto") or "auto"
        l10n_cfg = getattr(settings, "yandex_search_l10n", "auto") or "auto"
        groups_cap = int(getattr(settings, "yandex_search_groups_on_page", 5) or 5)
        folder_id = (settings.yandex_cloud_folder_id or "").strip()
        region = str(getattr(settings, "yandex_search_region", "225") or "225").strip()

    settings = get_unified_settings()
    max_passages = int(
        getattr(settings, "yandex_search_max_passages", DEFAULT_YANDEX_MAX_PASSAGES) or DEFAULT_YANDEX_MAX_PASSAGES
    )
    max_passages = max(1, min(5, max_passages))

    search_type = _yandex_search_type_for_query(q, search_type_cfg)
    l10n = _yandex_l10n_for_search_type(search_type, l10n_cfg)
    return {
        "query": {
            "searchType": search_type,
            "queryText": q,
            "familyMode": "FAMILY_MODE_NONE",
            "fixTypoMode": "FIX_TYPO_MODE_ON",
        },
        "folderId": folder_id,
        "groupSpec": {
            "groupMode": "GROUP_MODE_FLAT",
            "groupsOnPage": str(min(limit, max(1, groups_cap))),
            "docsInGroup": "1",
        },
        "maxPassages": max_passages,
        "l10n": l10n,
        "region": region,
        "responseFormat": "FORMAT_XML",
    }


def _yandex_params_fingerprint(
    query: str,
    *,
    limit: int,
    runtime: EffectiveSearchRuntimeConfig | None,
) -> str:
    body = _build_yandex_web_search_body(query, limit=limit, runtime=runtime) or {}
    payload = json.dumps(body, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:24]


def _web_search_cache_key(query: str, *, limit: int, runtime: EffectiveSearchRuntimeConfig) -> str:
    fp = _yandex_params_fingerprint(query, limit=limit, runtime=runtime)
    q_hash = hashlib.sha256(query.strip().lower().encode("utf-8")).hexdigest()[:16]
    return f"web_search:v1:{q_hash}:{limit}:{fp}"


async def invalidate_web_search_cache() -> None:
    try:
        cache = await get_unified_cache()
        await cache.invalidate_pattern("web_search:v1:*")
        logger.info("[STEP] search.cache_invalidated")
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] search.cache_invalidate_failed err=%s", exc)


async def _yandex_web_search_fetch_once(
    client: httpx.AsyncClient,
    query: str,
    *,
    limit: int,
    search_type_override: str | None = None,
    runtime: EffectiveSearchRuntimeConfig | None = None,
) -> YandexSearchOutcome:
    started = time.perf_counter()
    body = _build_yandex_web_search_body(query, limit=limit, runtime=runtime)
    if not body:
        return YandexSearchOutcome(hits=[], error_code="invalid_query", http_status=None, latency_ms=0)
    if search_type_override:
        body = {
            **body,
            "query": {**body["query"], "searchType": search_type_override},
            "l10n": _yandex_l10n_for_search_type(
                search_type_override,
                runtime.yandex_search_l10n
                if runtime is not None
                else getattr(get_unified_settings(), "yandex_search_l10n", "auto") or "auto",
            ),
        }

    api_key = (
        (runtime.yandex_api_key if runtime is not None else get_unified_settings().yandex_search_api_key) or ""
    ).strip()
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Api-Key {api_key}",
        "User-Agent": "EliteEW-ChatSearch/1.0",
    }

    last_error: str | None = None
    last_status: int | None = None
    request_timeout = _yandex_httpx_timeout()
    for attempt in range(MAX_YANDEX_RETRIES + 1):
        try:
            resp = await client.post(
                YANDEX_WEB_SEARCH_URL,
                headers=headers,
                json=body,
                timeout=request_timeout,
            )
            latency_ms = int((time.perf_counter() - started) * 1000)
            last_status = resp.status_code
            if resp.status_code in RETRYABLE_HTTP_STATUSES and attempt < MAX_YANDEX_RETRIES:
                last_error = f"http_{resp.status_code}"
                await asyncio.sleep((0.4 * (2**attempt)) + random.uniform(0, 0.2))
                continue
            if resp.status_code != 200:
                logger.warning(
                    "Yandex web/search failed: status=%s query=%s body=%s",
                    resp.status_code,
                    query[:120],
                    (resp.text or "")[:300],
                )
                code = "credentials_invalid" if resp.status_code in {401, 403} else f"http_{resp.status_code}"
                return YandexSearchOutcome(
                    hits=[], error_code=code, http_status=resp.status_code, latency_ms=latency_ms
                )
            data = resp.json()
            if not isinstance(data, dict):
                return YandexSearchOutcome(
                    hits=[], error_code="invalid_payload", http_status=resp.status_code, latency_ms=latency_ms
                )
            raw_data = data.get("rawData")
            if not isinstance(raw_data, str) or not raw_data.strip():
                return YandexSearchOutcome(
                    hits=[], error_code="empty_raw_data", http_status=resp.status_code, latency_ms=latency_ms
                )
            xml_text = base64.b64decode(raw_data).decode("utf-8", errors="replace")
            hits = parse_yandex_web_search_xml(xml_text, limit=limit)
            return YandexSearchOutcome(hits=hits, error_code=None, http_status=resp.status_code, latency_ms=latency_ms)
        except (httpx.ConnectError, httpx.ConnectTimeout) as exc:
            # Egress drop / DNS / route failures will not heal on immediate retry.
            last_error = "connect_timeout" if isinstance(exc, httpx.ConnectTimeout) else "connect_failed"
            logger.warning(
                "[STEP] search.yandex_connect_fail_fast error=%s query=%s",
                last_error,
                query[:100],
            )
            break
        except httpx.TimeoutException:
            last_error = "timeout"
            if attempt < MAX_YANDEX_RETRIES:
                await asyncio.sleep((0.4 * (2**attempt)) + random.uniform(0, 0.2))
                continue
        except Exception as exc:
            last_error = "request_failed"
            logger.warning("Yandex web/search error query=%s: %s", query[:100], exc)
            break

    latency_ms = int((time.perf_counter() - started) * 1000)
    return YandexSearchOutcome(hits=[], error_code=last_error, http_status=last_status, latency_ms=latency_ms)


async def fetch_yandex_web_search(
    query: str,
    limit: int,
    *,
    runtime: EffectiveSearchRuntimeConfig | None = None,
) -> YandexSearchOutcome:
    """Public Yandex fetch with RU→COM retry — used by web_search and admin probe."""
    if not _yandex_credentials_configured(runtime=runtime):
        return YandexSearchOutcome(hits=[], error_code="missing_credentials", http_status=None, latency_ms=0)
    qtext = (query or "").strip()
    if not qtext:
        return YandexSearchOutcome(hits=[], error_code="invalid_query", http_status=None, latency_ms=0)
    client = get_httpx_client()
    search_type = _yandex_search_type_for_query(
        qtext,
        runtime.yandex_search_type
        if runtime is not None
        else getattr(get_unified_settings(), "yandex_search_type", "auto") or "auto",
    )
    logger.info("[STEP] search.yandex_start query=%s type=%s", qtext[:120], search_type)
    # Over-fetch so multi-token ranker / optional rerank can drop marketplace noise.
    fetch_limit = min(20, max(int(limit) * 2, int(limit)))
    outcome = await _yandex_web_search_fetch_once(client, qtext, limit=fetch_limit, runtime=runtime)
    if not outcome.hits and search_type == "SEARCH_TYPE_RU" and outcome.error_code is None:
        if int(outcome.latency_ms or 0) >= YANDEX_COM_RETRY_MAX_FIRST_LEG_MS:
            logger.info(
                "[STEP] search.yandex_skip_com_retry reason=slow_first_leg ms=%s query=%s",
                outcome.latency_ms,
                qtext[:120],
            )
        else:
            logger.info("[STEP] search.yandex_retry_type_com query=%s", qtext[:120])
            outcome = await _yandex_web_search_fetch_once(
                client,
                qtext,
                limit=fetch_limit,
                search_type_override="SEARCH_TYPE_COM",
                runtime=runtime,
            )
    pool_limit = min(12, max(int(limit) * 2, int(limit)))
    ranked = _filter_hits_by_query_overlap(outcome.hits, qtext, pool_limit)
    hits = await _maybe_rerank_web_hits(query=qtext, hits=ranked, take=int(limit))
    logger.info(
        "[STEP] search.yandex_done query=%s raw=%s ranked=%s out=%s",
        qtext[:80],
        len(outcome.hits),
        len(ranked),
        len(hits),
    )
    return YandexSearchOutcome(
        hits=hits,
        error_code=outcome.error_code,
        http_status=outcome.http_status,
        latency_ms=outcome.latency_ms,
    )


async def web_search_detailed(
    query: str,
    limit: int = 10,
    *,
    user_id: UUID | str | None = None,
    db: AsyncSession | None = None,
    surface: str | None = None,
) -> WebSearchCallResult:
    """Yandex web search with explicit status for UX/ops callers (companion, admin)."""

    started = time.perf_counter()
    q = anchor_web_search_query_to_wall_clock((query or "").strip())
    cache_hit = False
    error_code: str | None = None
    hits: list[dict[str, str]] = []
    event_status = "error"
    quota_denied_raised = False

    def _latency_ms() -> int:
        return int((time.perf_counter() - started) * 1000)

    async def _record_event() -> None:
        await record_web_search_event(
            db,
            surface=surface,
            status=event_status,  # type: ignore[arg-type]
            latency_ms=_latency_ms(),
            hit_count=len(hits),
            error_code=error_code,
            cache_hit=cache_hit,
            actor_user_id=user_id,
            query=q,
        )

    try:
        if not q:
            event_status = "empty"
            return WebSearchCallResult(hits=[], status="empty", latency_ms=_latency_ms())

        runtime = await resolve_effective_search_runtime_config(db, surface=surface)
        if surface and not runtime.surface_enabled:
            logger.info("[STEP] search.surface_disabled surface=%s query=%s", surface, q[:120])
            error_code = "surface_disabled"
            event_status = "blocked"
            return WebSearchCallResult(
                hits=[],
                status="blocked",
                error_code=error_code,
                latency_ms=_latency_ms(),
            )

        provider = resolve_web_search_provider(runtime=runtime)
        if not provider:
            logger.info("[STEP] search_skip_no_provider query=%s", q[:120])
            error_code = "missing_credentials"
            event_status = "blocked"
            return WebSearchCallResult(
                hits=[],
                status="blocked",
                error_code=error_code,
                latency_ms=_latency_ms(),
            )

        enforce_quota = bool(runtime.quota_enforced)
        quota_user_id: UUID | None = None
        if enforce_quota and user_id is not None and db is not None:
            quota_user_id = user_id if isinstance(user_id, UUID) else UUID(str(user_id))
            quota_status = await get_web_search_quota_status(db, quota_user_id)
            if quota_status is None:
                msg = f"User {quota_user_id} not found"
                raise ValueError(msg)
            if quota_status.total_remaining <= 0:
                logger.info(
                    "[STEP] search.quota_denied user=%s query=%s remaining=%s",
                    quota_user_id,
                    q[:80],
                    quota_status.total_remaining,
                )
                error_code = "quota_exceeded"
                event_status = "quota_denied"
                quota_denied_raised = True
                raise WebSearchQuotaExceededError(quota_status)

        effective_limit = max(1, int(limit or runtime.default_limit or 10))

        if runtime.cache_enabled and db is not None:
            cache_key = _web_search_cache_key(q, limit=effective_limit, runtime=runtime)
            try:
                cache = await get_unified_cache()
                _cache_miss = object()
                cached = await cache.get(cache_key, default=_cache_miss)
                if cached is not _cache_miss and isinstance(cached, list):
                    hits = cached
                    cache_hit = True
                    event_status = "ok" if hits else "empty"
                    if quota_user_id is not None and hits:
                        await try_consume_web_search_quota(db, quota_user_id)
                    return WebSearchCallResult(
                        hits=hits,
                        status=event_status,
                        latency_ms=_latency_ms(),
                        cache_hit=True,
                    )
            except Exception as exc:  # noqa: BLE001
                logger.debug("[STEP] search.cache_read_skip err=%s", exc)

        outcome = await fetch_yandex_web_search(q, effective_limit, runtime=runtime)
        hits = outcome.hits
        error_code = outcome.error_code

        if runtime.cache_enabled and db is not None:
            ttl = runtime.cache_empty_ttl_sec if not hits else runtime.cache_ttl_sec
            if ttl > 0:
                try:
                    cache = await get_unified_cache()
                    cache_key = _web_search_cache_key(q, limit=effective_limit, runtime=runtime)
                    await cache.set(cache_key, hits, ttl=ttl)
                except Exception as exc:  # noqa: BLE001
                    logger.debug("[STEP] search.cache_write_skip err=%s", exc)

        if error_code and not hits:
            event_status = "error"
        elif not hits:
            event_status = "empty"
        else:
            event_status = "ok"

        if quota_user_id is not None and db is not None and hits:
            try:
                await try_consume_web_search_quota(db, quota_user_id)
            except WebSearchQuotaExceededError as exc:
                logger.info(
                    "[STEP] search.quota_denied user=%s query=%s remaining=%s",
                    quota_user_id,
                    q[:80],
                    exc.status.total_remaining,
                )
                error_code = "quota_exceeded"
                event_status = "quota_denied"
                quota_denied_raised = True
                raise

        return WebSearchCallResult(
            hits=hits,
            status=event_status,
            error_code=error_code,
            latency_ms=_latency_ms(),
            cache_hit=cache_hit,
        )
    except WebSearchQuotaExceededError:
        if not quota_denied_raised:
            event_status = "quota_denied"
        raise
    except ValueError:
        error_code = error_code or "invalid_user"
        event_status = "error"
        raise
    finally:
        if q:
            try:
                await _record_event()
            except Exception as exc:  # noqa: BLE001
                logger.debug("[STEP] search.event_record_skip err=%s", exc)


async def web_search(
    query: str,
    limit: int = 10,
    *,
    user_id: UUID | str | None = None,
    db: AsyncSession | None = None,
    surface: str | None = None,
) -> list[dict[str, str]]:
    return (
        await web_search_detailed(
            query,
            limit,
            user_id=user_id,
            db=db,
            surface=surface,
        )
    ).hits


async def resolve_web_search_provider_for_surface(
    *,
    db: AsyncSession | None,
    surface: str | None,
) -> str | None:
    runtime = await resolve_effective_search_runtime_config(db, surface=surface)
    if surface and not runtime.surface_enabled:
        return None
    return resolve_web_search_provider(runtime=runtime)


def format_search_results_for_prompt(items: list[dict[str, str]], max_total_chars: int = MAX_SNIPPET_CHARS) -> str:
    if not items:
        return ""
    lines: list[str] = []
    total = 0
    for i, row in enumerate(items, 1):
        title = (row.get("title") or "").strip()
        content = (row.get("content") or "").strip()
        url = (row.get("url") or "").strip()
        block = f"[{i}] {title}\n    {content}\n    URL: {url}"
        if total + len(block) > max_total_chars and total > 0:
            break
        lines.append(block)
        total += len(block)
    body = "\n\n".join(lines) if lines else ""
    if not body:
        return ""
    return web_search_freshness_preamble() + body
