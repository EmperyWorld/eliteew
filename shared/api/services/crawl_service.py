# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `services/crawl_service.py`; preserves its existing EliteEW API/service responsibilities.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

# SPDX-License-Identifier: MIT
"""
Crawl4AI integration: scrape URL to Markdown for chat context.
Uses Redis cache (1h TTL) to avoid re-parsing the same URL.

Crawl4AI (and stack5-style page fetch) is optional when the service URL is unset or
infra is off; this code degrades to empty/fallback text and does not repair external crawl.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
from html import unescape
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urlparse

from api.core.http_clients import get_httpx_client
from api.core.unified_config import CRAWL4AI_INTERNAL_DEFAULT_BASE, get_unified_settings

logger = logging.getLogger(__name__)
# Crawl4AI often needs ~60s internal Playwright navigation before returning 5xx.
CRAWL4AI_TIMEOUT = 120.0
CRAWL_CACHE_TTL = 3600  # 1 hour
CRAWL_CACHE_PREFIX = "crawl:md:"
# If HTTP-first text is at least this long, skip Crawl4AI (saves Playwright timeouts on doc sites).
HTTP_FIRST_MIN_CHARS = 500

# Triggers for "need to crawl this page" (case-insensitive).
CRAWL_TRIGGER_PHRASES = (
    "изучи подробно эту страницу",
    "прочитай страницу",
    "открой ссылку",
    "разбери эту страницу",
    "контент по ссылке",
    "прочитай по ссылке",
    "изучи страницу",
    "разбери страницу",
    "открой эту ссылку",
    "проанализируй страницу",
    "что на этой странице",
    "crawl4ai",
    "лучшие практики",
    "сравнение лучших практик",
    "детальный анализ",
    "детального анализа",
    "сравни проекты",
    "сравнение проектов",
)

# First URL in text (http or https).
URL_RE = re.compile(r"https?://[^\s\]\)\"']+", re.IGNORECASE)


class _HTMLTextExtractor(HTMLParser):
    _BLOCK_TAGS = {
        "article",
        "aside",
        "blockquote",
        "br",
        "div",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "li",
        "main",
        "p",
        "pre",
        "section",
        "table",
        "tr",
        "ul",
        "ol",
    }

    def __init__(self) -> None:
        super().__init__()
        self._chunks: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style", "noscript"}:
            self._skip_depth += 1
            return
        if self._skip_depth == 0 and tag in self._BLOCK_TAGS:
            self._chunks.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript"} and self._skip_depth > 0:
            self._skip_depth -= 1
            return
        if self._skip_depth == 0 and tag in self._BLOCK_TAGS:
            self._chunks.append("\n")

    def handle_data(self, data: str) -> None:
        if self._skip_depth > 0:
            return
        text = unescape(data or "")
        if text.strip():
            self._chunks.append(text)

    def get_text(self) -> str:
        joined = "".join(self._chunks)
        lines = [" ".join(line.split()).strip() for line in joined.splitlines()]
        filtered = [line for line in lines if line]
        return "\n".join(filtered)


def _get_crawl4ai_base_url() -> str:
    settings = get_unified_settings()
    url = getattr(settings, "crawl4ai_url", None)
    if url and str(url).strip():
        return str(url).strip().rstrip("/")
    return CRAWL4AI_INTERNAL_DEFAULT_BASE


def _get_fallback_fetch_timeout() -> float:
    try:
        settings = get_unified_settings()
        raw = float(getattr(settings, "crawl_fallback_timeout_seconds", 45.0))
    except (TypeError, ValueError):  # fmt: skip
        raw = 45.0
    return max(5.0, min(raw, 180.0))


def _host_suffix_match(host: str, csv: str) -> bool:
    h = (host or "").lower().strip()
    if h.startswith("www."):
        h = h[4:]
    for part in (csv or "").split(","):
        suf = part.strip().lower()
        if not suf:
            continue
        if h == suf or h.endswith("." + suf):
            return True
    return False


def prefer_http_first_fetch(url: str) -> bool:
    """
    Use simple HTTP GET before Crawl4AI for known-heavy documentation sites.
    Path heuristics apply even when ELITEEW_CRAWL_HTTP_FIRST_HOSTS is empty.
    """
    p = urlparse(url or "")
    host = (p.netloc or "").lower()
    if "@" in host:
        host = host.split("@")[-1]
    host = host.split(":")[0]
    if host.startswith("www."):
        host = host[4:]
    path_l = (p.path or "").lower()
    if "/docs" in path_l or path_l.startswith("/api/"):
        return True
    if host.startswith("docs.") or host.endswith(".readthedocs.io"):
        return True
    settings = get_unified_settings()
    csv = str(getattr(settings, "crawl_http_first_host_suffixes", "") or "").strip()
    if csv:
        return _host_suffix_match(host, csv)
    return False


def _classify_crawl4ai_error_body(body: str) -> str:
    if not (body or "").strip():
        return "empty_response_body"
    try:
        data = json.loads(body)
        detail = str(data.get("detail") or "")
    except (json.JSONDecodeError, TypeError):  # fmt: skip
        detail = body
    low = detail.lower()
    if "timeout" in low and "ms exceeded" in low:
        return "playwright_goto_timeout"
    if "err_timed_out" in low or "net::err_timed_out" in low:
        return "playwright_net_timeout"
    if "timeout" in low:
        return "timeout"
    return "crawl4ai_internal_error"


def _normalize_url(url: str) -> str:
    u = (url or "").strip()
    if not u:
        return ""
    if not u.startswith(("http://", "https://")):
        u = "https://" + u
    return u


def _cache_key(url: str) -> str:
    return CRAWL_CACHE_PREFIX + hashlib.sha256(url.encode()).hexdigest()


def _extract_text_from_html(html_text: str) -> str:
    if not html_text:
        return ""
    parser = _HTMLTextExtractor()
    try:
        parser.feed(html_text)
        parser.close()
    except Exception as exc:
        logger.debug("[STEP] crawl_html_text_extract_skip err=%s", exc)
        return ""
    return parser.get_text()


async def _fetch_text_via_http_fallback(url: str) -> str:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        )
    }
    timeout_sec = _get_fallback_fetch_timeout()
    try:
        client = get_httpx_client()
        response = await client.get(
            url,
            headers=headers,
            follow_redirects=True,
            timeout=timeout_sec,
        )
        if response.status_code != 200:
            logger.warning(
                "Crawl fallback failed: status=%s url=%s",
                response.status_code,
                url[:120],
            )
            return ""
        content_type = (response.headers.get("content-type") or "").lower()
        text = response.text or ""
        if "html" in content_type:
            text = _extract_text_from_html(text)
        if not text.strip():
            return ""
        normalized = "\n".join(line for line in text.splitlines() if line.strip())
        trimmed = normalized[:60_000].strip()
        if trimmed:
            logger.info("Crawl fallback succeeded for url=%s len=%s", url[:120], len(trimmed))
        return trimmed
    except Exception as e:
        logger.warning("Crawl fallback error: %s", e)
        return ""


async def _get_redis_client() -> Any:
    """Redis client from DatabaseManager (DB 0). Returns None if unavailable."""
    try:
        from api.core.database_manager import get_database_manager

        manager = await get_database_manager()
        client = await manager.get_redis_client()
        if client:
            await client.ping()
        return client
    except Exception as e:
        logger.debug("Crawl cache: Redis unavailable: %s", e)
        return None


def should_trigger_crawl(message: str) -> bool:
    """True if message contains a URL or a crawl trigger phrase."""
    if not (message or "").strip():
        return False
    lower = message.strip().lower()
    if URL_RE.search(message):
        return True
    return any(phrase in lower for phrase in CRAWL_TRIGGER_PHRASES)


def extract_url_from_message(message: str) -> str | None:
    """Extract first valid URL from text. Returns None if none found."""
    if not (message or "").strip():
        return None
    m = URL_RE.search(message)
    if not m:
        return None
    raw = m.group(0).rstrip(".,;:!?)")
    return _normalize_url(raw) or None


def get_crawl_url_from_messages(current_content: str, recent_messages: list[dict]) -> str | None:
    """
    URL to crawl: from current message, or from previous user message if current is only a trigger.
    """
    url = extract_url_from_message(current_content)
    if url:
        return url
    # No URL in current; check if current is trigger-only and take URL from previous user message
    if not (current_content or "").strip():
        return None
    lower = current_content.strip().lower()
    if not any(p in lower for p in CRAWL_TRIGGER_PHRASES):
        return None
    for m in reversed(recent_messages or []):
        if (m.get("role") or "").strip().lower() != "user":
            continue
        prev_url = extract_url_from_message((m.get("content") or "").strip())
        if prev_url:
            return prev_url
    return None


async def scrape_url(url: str) -> str:
    """
    Fetch URL via Crawl4AI and return markdown. Uses Redis cache (1h).
    Returns empty string on invalid URL, missing config, or any error.
    """
    normalized = _normalize_url(url)
    if not normalized:
        return ""

    base = _get_crawl4ai_base_url()
    if not base:
        return ""

    cache_key = _cache_key(normalized)
    try:
        redis = await _get_redis_client()
        if redis:
            cached = await redis.get(cache_key)
            if cached is not None:
                out = cached.decode("utf-8") if isinstance(cached, bytes) else str(cached)
                logger.info("Crawl4AI cache hit for url=%s", normalized[:80])
                return out
    except Exception as e:
        logger.debug("Crawl cache get error: %s", e)

    if prefer_http_first_fetch(normalized):
        logger.info(
            "[STEP] crawl.http_first_try target_url=%s timeout_s=%.1f",
            normalized[:160],
            _get_fallback_fetch_timeout(),
        )
        early_text = await _fetch_text_via_http_fallback(normalized)
        if early_text and len(early_text.strip()) >= HTTP_FIRST_MIN_CHARS:
            try:
                redis = await _get_redis_client()
                if redis:
                    await redis.setex(cache_key, CRAWL_CACHE_TTL, early_text)
            except Exception as cache_exc:
                logger.debug("Crawl cache set error: %s", cache_exc)
            logger.info(
                "[STEP] crawl.http_first_ok target_url=%s len=%s skipped_crawl4ai=1",
                normalized[:160],
                len(early_text),
            )
            return early_text
        if early_text:
            logger.info(
                "[STEP] crawl.http_first_short target_url=%s len=%s will_try_crawl4ai=1",
                normalized[:160],
                len(early_text),
            )

    logger.info("Crawl4AI scrape started: %s", normalized[:80])
    api_url = f"{base}/crawl"
    payload = {"urls": [normalized]}
    fallback_markdown = ""
    try:
        client = get_httpx_client()
        resp = await client.post(api_url, json=payload, timeout=CRAWL4AI_TIMEOUT)
        if resp.status_code != 200:
            err_body = resp.text or ""
            reason = _classify_crawl4ai_error_body(err_body)
            logger.warning(
                "[STEP] crawl.crawl4ai_failed status=%s target_url=%s reason=%s detail=%s",
                resp.status_code,
                normalized[:160],
                reason,
                err_body[:280].replace("\n", " "),
            )
            logger.info(
                "[STEP] crawl.fallback_try target_url=%s timeout_s=%.1f",
                normalized[:160],
                _get_fallback_fetch_timeout(),
            )
            fallback_markdown = await _fetch_text_via_http_fallback(normalized)
            if fallback_markdown:
                markdown = fallback_markdown
                try:
                    redis = await _get_redis_client()
                    if redis:
                        await redis.setex(cache_key, CRAWL_CACHE_TTL, markdown)
                except Exception as e:
                    logger.debug("Crawl cache set error: %s", e)
                logger.info(
                    "[STEP] crawl.fallback_ok target_url=%s len=%s (after Crawl4AI error)",
                    normalized[:160],
                    len(markdown),
                )
                return markdown
            logger.warning(
                "[STEP] crawl.fallback_empty target_url=%s (Crawl4AI failed, simple GET no text)",
                normalized[:160],
            )
            return ""
        data = resp.json()
    except Exception as e:
        logger.warning(
            "[STEP] crawl.crawl4ai_transport_error target_url=%s error=%s",
            normalized[:160],
            e,
        )
        logger.info(
            "[STEP] crawl.fallback_try target_url=%s timeout_s=%.1f",
            normalized[:160],
            _get_fallback_fetch_timeout(),
        )
        fallback_markdown = await _fetch_text_via_http_fallback(normalized)
        if fallback_markdown:
            try:
                redis = await _get_redis_client()
                if redis:
                    await redis.setex(cache_key, CRAWL_CACHE_TTL, fallback_markdown)
            except Exception as cache_error:
                logger.debug("Crawl cache set error: %s", cache_error)
            logger.info(
                "[STEP] crawl.fallback_ok target_url=%s len=%s (after transport error)",
                normalized[:160],
                len(fallback_markdown),
            )
            return fallback_markdown
        logger.warning(
            "[STEP] crawl.fallback_empty target_url=%s (transport error, simple GET no text)",
            normalized[:160],
        )
        return ""

    # Crawl4AI v0.5+: {"results": [{...}]} or older: list/dict with "markdown"
    markdown = ""
    item = data
    if isinstance(data, dict) and "results" in data:
        results = data["results"]
        item = results[0] if isinstance(results, list) and results else data
    elif isinstance(data, list) and data:
        item = data[0]

    if isinstance(item, dict):
        md_field = item.get("markdown")
        if isinstance(md_field, str):
            markdown = md_field
        elif isinstance(md_field, dict):
            markdown = (
                md_field.get("raw_markdown")
                or md_field.get("markdown_with_citations")
                or md_field.get("fit_markdown")
                or ""
            )
    if not markdown or not isinstance(markdown, str):
        logger.warning("Crawl4AI: no markdown in response for url=%s", normalized[:80])
        fallback_markdown = await _fetch_text_via_http_fallback(normalized)
        if fallback_markdown:
            try:
                redis = await _get_redis_client()
                if redis:
                    await redis.setex(cache_key, CRAWL_CACHE_TTL, fallback_markdown)
            except Exception as cache_error:
                logger.debug("Crawl cache set error: %s", cache_error)
            return fallback_markdown
        return ""

    logger.info("Crawl4AI scrape finished: url=%s len=%s", normalized[:80], len(markdown))

    try:
        redis = await _get_redis_client()
        if redis:
            await redis.setex(cache_key, CRAWL_CACHE_TTL, markdown)
    except Exception as e:
        logger.debug("Crawl cache set error: %s", e)

    return markdown


def truncate_markdown_for_context(markdown: str, max_chars: int = 40_000) -> str:
    """Truncate to ~10k tokens (4 chars/token). Keeps the start of the page."""
    if not markdown or len(markdown) <= max_chars:
        return markdown
    return markdown[: max_chars - 80].rstrip() + "\n\n[... контент обрезан из-за лимита токенов ...]"
