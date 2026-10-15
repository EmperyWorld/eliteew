# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lexical relevance ranking for Yandex SERP hits before LLM prompt injection.
# Invariants:
# - Prefer multi-token coverage over single-token OR matches.
# - Short critical tokens (цб, рф, …) are kept; marketplace hosts penalized for non-shopping queries.
# Related:
# - api/services/search_service.py
# - documentation/product/WEB-SEARCH-ADMIN-OPERATIONS.md
# ---

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from urllib.parse import urlsplit

logger = logging.getLogger(__name__)

# Whole-word short tokens that matter for finance/geo queries (length < 3 normalizer).
SHORT_TOKEN_ALLOWLIST = frozenset(
    {
        "цб",
        "рф",
        "сша",
        "ес",
        "вб",
        "сбер",
        "втб",
        "нк",
        "пд",
        "ип",
        "ооо",
        "пао",
        "фнс",
        "мвд",
        "мид",
        "жкх",
        "ндс",
        "нпф",
        "кб",
        "тбанк",
        "ozon",
        "wb",
        "dns",
    }
)

SHOPPING_INTENT_MARKERS = (
    "купить",
    "покуп",
    "заказать",
    "заказ",
    "цена",
    "цены",
    "стоимость",
    "скидк",
    "ozon",
    "wildberries",
    "вайлдберриз",
    "яндекс маркет",
    "market.yandex",
    "dns-shop",
    "вб ",
    " wb",
    "артикул",
    "доставк",
)

MARKETPLACE_HOST_FRAGMENTS = (
    "ozon.ru",
    "wildberries.ru",
    "wb.ru",
    "market.yandex.",
    "ya.ru/market",
    "dns-shop.ru",
    "avito.ru",
    "aliexpress.",
    "lamoda.ru",
    "megamarket.ru",
    "citilink.ru",
    "mvideo.ru",
    "onlinetrade.ru",
    "sbermegamarket.",
)

_WORD_RE = re.compile(r"[a-zа-яё0-9-]{2,}", re.IGNORECASE)


@dataclass(frozen=True)
class HitScore:
    score: float
    coverage: float
    matched: int
    token_weight: float
    marketplace: bool


def is_shopping_intent(query: str) -> bool:
    lower = (query or "").casefold()
    if not lower.strip():
        return False
    return any(marker in lower for marker in SHOPPING_INTENT_MARKERS)


def is_marketplace_url(url: str) -> bool:
    host = (urlsplit(url or "").netloc or "").casefold()
    if not host:
        # Some SERP rows may put the host only in the path-less string.
        host = (url or "").casefold()
    return any(frag in host for frag in MARKETPLACE_HOST_FRAGMENTS)


def tokenize_web_search_query(query: str, *, stopwords: set[str] | frozenset[str]) -> list[str]:
    """Ordered unique query tokens for scoring (includes allowlisted short tokens)."""

    q = (query or "").strip().casefold()
    if not q:
        return []
    raw = _WORD_RE.findall(q)
    out: list[str] = []
    seen: set[str] = set()
    for tok in raw:
        if tok in stopwords:
            continue
        if len(tok) < 3 and tok not in SHORT_TOKEN_ALLOWLIST:
            continue
        if tok in seen:
            continue
        seen.add(tok)
        out.append(tok)
        if len(out) >= 20:
            break
    return out


def _token_weight(tok: str) -> float:
    if tok in SHORT_TOKEN_ALLOWLIST:
        return 2.2
    if len(tok) >= 5:
        return 2.0
    return 1.0


def _token_in_text(tok: str, text: str) -> bool:
    if not tok or not text:
        return False
    if tok in text:
        return True
    # Weak Russian stem: long tokens may appear as adjective/noun variants.
    return bool(len(tok) >= 5 and tok[:5] in text)


def score_web_search_hit(
    row: dict[str, str],
    tokens: list[str],
    *,
    shopping_intent: bool,
) -> HitScore:
    title = (row.get("title") or "").casefold()
    snippet = (row.get("content") or row.get("snippet") or "").casefold()
    url = (row.get("url") or "").casefold()
    body = f"{snippet} {url}"

    if not tokens:
        return HitScore(score=0.0, coverage=0.0, matched=0, token_weight=0.0, marketplace=False)

    matched = 0
    weight_hit = 0.0
    weight_total = 0.0
    for tok in tokens:
        w = _token_weight(tok)
        weight_total += w
        in_title = _token_in_text(tok, title)
        in_body = _token_in_text(tok, body)
        if in_title or in_body:
            matched += 1
            weight_hit += w
            if in_title:
                weight_hit += 0.35 * w  # title bonus

    coverage = weight_hit / weight_total if weight_total else 0.0
    marketplace = is_marketplace_url(row.get("url") or "")
    score = coverage
    if marketplace and not shopping_intent:
        score *= 0.28
    elif marketplace and shopping_intent:
        score *= 1.05

    return HitScore(
        score=score,
        coverage=coverage,
        matched=matched,
        token_weight=weight_total,
        marketplace=marketplace,
    )


def _min_coverage_threshold(token_count: int) -> float:
    if token_count <= 1:
        return 0.99
    if token_count == 2:
        return 0.72
    if token_count == 3:
        return 0.62
    return 0.55


def _serp_row_blob(row: dict[str, str]) -> str:
    return " ".join(
        str(row.get(k) or "") for k in ("title", "snippet", "content", "description", "url", "link")
    ).casefold()


def _is_search_engine_landing(url: str) -> bool:
    """Bare search-engine home / country TLD landings — not factual articles."""
    raw = (url or "").strip()
    if not raw:
        return False
    parts = urlsplit(raw if "://" in raw else f"https://{raw}")
    host = (parts.netloc or "").casefold()
    if host.startswith("www."):
        host = host[4:]
    path = (parts.path or "").rstrip("/")
    # google.com.ai / google.com / ya.ru / bing.com with no article path
    landing_hosts = (
        "google.com",
        "google.com.ai",
        "google.ru",
        "google.by",
        "google.kz",
        "bing.com",
        "ya.ru",
        "yandex.ru",
        "yandex.com",
        "duckduckgo.com",
    )
    if host in landing_hosts and path in {"", "/"}:
        return True
    return bool(host.endswith(".google.com") and path in {"", "/", "/webhp"})


def is_meta_howto_serp_row(row: dict[str, str]) -> bool:
    """Reject SERP tutorials / product docs about searching the web (not domain facts)."""
    blob = _serp_row_blob(row)
    if not blob.strip():
        return False
    url = str(row.get("url") or row.get("link") or "")
    if _is_search_engine_landing(url):
        return True
    needles = (
        "как искать в google",
        "как искать в гугл",
        "как гуглить",
        "как правильно искать",
        "хитрости эффективного поиска",
        "internet-searching",
        "how to search google",
        "how to google",
        "search engine tips",
        "уроки поиска в интернете",
        "секреты поиска в google",
        "эффективного поиска информации",
        "поиск информации в интернете",
        "включение и использование веб-поиска",
        "использование веб-поиска",
        "enable web search",
        "using web search",
        "веб-поиска | anthropic",
        "support.claude.com",
        "сочетание каких клавиш включает поиск",
        "сочетание клавиш включает поиск",
        "поиск слова или фразы по странице",
        "ctrl+f",
        "ctrl + f",
        "find on page",
        "поиск по странице",
    )
    if any(n in blob for n in needles):
        return True
    if "skillbox" in blob and any(x in blob for x in ("поиск", "гугл", "google", "search")):
        return True
    # Q&A / help about browser find-in-page when title is the keyboard question itself.
    if (
        "клавиш" in blob
        and "поиск" in blob
        and any(x in blob for x in ("страниц", "фразы", "слова или", "напомните", "ответы mail"))
    ):
        return True
    # Vendor help centers about enabling their own web-search product feature.
    return bool(
        any(h in blob for h in ("anthropic help", "help.openai.com", "support.claude"))
        and any(x in blob for x in ("веб-поиск", "web search", "web-search"))
    )


_SOFT_FAIL_MIN_SCORE = 0.22


def rank_web_search_hits(
    rows: list[dict[str, str]],
    query: str,
    *,
    limit: int,
    stopwords: set[str] | frozenset[str],
) -> list[dict[str, str]]:
    """Rank + filter SERP rows by multi-token coverage; preserve relative quality order."""

    if not rows or limit <= 0:
        return []
    filtered: list[dict[str, str]] = []
    for row in rows:
        if is_meta_howto_serp_row(row):
            logger.info(
                "[STEP] search.meta_howto_rejected title=%s url=%s",
                (row.get("title") or "")[:120],
                (row.get("url") or row.get("link") or "")[:160],
            )
            continue
        filtered.append(row)
    rows = filtered
    if not rows:
        return []
    tokens = tokenize_web_search_query(query, stopwords=stopwords)
    if not tokens:
        return rows[:limit]

    shopping = is_shopping_intent(query)
    threshold = _min_coverage_threshold(len(tokens))
    scored: list[tuple[HitScore, int, dict[str, str]]] = []
    for index, row in enumerate(rows):
        hs = score_web_search_hit(row, tokens, shopping_intent=shopping)
        scored.append((hs, index, row))

    # Primary keep set: coverage/score above threshold.
    kept = [(hs, idx, row) for hs, idx, row in scored if hs.coverage + 1e-9 >= threshold]
    if not kept:
        # Fail-soft: keep the best lexical matches only if score is not near-zero trash.
        scored.sort(key=lambda item: (-item[0].score, item[1]))
        soft_n = 1 if len(tokens) >= 3 else min(2, limit)
        kept = [item for item in scored[:soft_n] if item[0].score + 1e-9 >= _SOFT_FAIL_MIN_SCORE]
        if not kept:
            logger.info(
                "[STEP] search.soft_fail_empty query=%s best_score=%.3f",
                (query or "")[:120],
                scored[0][0].score if scored else -1.0,
            )
            return []
    else:
        kept.sort(key=lambda item: (-item[0].score, item[1]))

    return [row for _hs, _idx, row in kept[:limit]]
