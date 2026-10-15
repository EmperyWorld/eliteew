# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   Pure EWDesk news helpers (URL validation, AI polish parse, feed search/filters/sort) without HTTP imports.
# Invariants:
#   - No database or storage dependencies; safe for unit tests.
# Related:
#   - api/routers/product_desktop_news.py
# ---

from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any
from uuid import UUID

_EW_MARK_TITLE = "<<<EW_TITLE>>>"
_EW_MARK_BODY = "<<<EW_BODY>>>"
EW_MARK_TITLE = _EW_MARK_TITLE
EW_MARK_BODY = _EW_MARK_BODY

MAX_NEWS_IMAGE_URL_LEN = 2048
MAX_NEWS_SEARCH_QUERY_LEN = 200
DEFAULT_NEWS_LIST_LIMIT = 50
MAX_NEWS_LIST_LIMIT = 200
VALID_NEWS_LIST_SORTS = frozenset({"newest", "oldest"})
NEWS_SEARCH_TS_CONFIG = "russian"
NEWS_LIST_CURSOR_SEP = "|"
MAX_NEWS_LIST_CURSOR_LEN = 512


def normalize_news_search_query(raw: str | None) -> str | None:
    """Trim feed search query; empty → None; cap length for full-text query."""
    if raw is None:
        return None
    s = raw.strip()
    if not s:
        return None
    if len(s) > MAX_NEWS_SEARCH_QUERY_LEN:
        return s[:MAX_NEWS_SEARCH_QUERY_LEN]
    return s


def news_search_ilike_pattern(query: str) -> str:
    """Build ILIKE pattern with escaped wildcards (use SQL ESCAPE '\\')."""
    escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def news_list_next_offset(*, offset: int, items_count: int, total: int) -> int | None:
    """Return next page offset when more published rows exist, else None."""
    if items_count <= 0:
        return None
    next_offset = offset + items_count
    return next_offset if next_offset < total else None


def encode_news_list_cursor(*, pinned: bool, published_at: datetime, post_id: UUID) -> str:
    """Opaque keyset cursor for published feed (pinned, published_at, id)."""
    pin = "1" if pinned else "0"
    return f"{pin}{NEWS_LIST_CURSOR_SEP}{published_at.isoformat()}{NEWS_LIST_CURSOR_SEP}{post_id}"


def decode_news_list_cursor(cursor: str) -> tuple[bool, datetime, UUID]:
    """Parse cursor from encode_news_list_cursor; raises ValueError when malformed."""
    if len(cursor) > MAX_NEWS_LIST_CURSOR_LEN:
        msg = "cursor too long"
        raise ValueError(msg)
    parts = cursor.split(NEWS_LIST_CURSOR_SEP, 2)
    if len(parts) != 3 or parts[0] not in {"0", "1"}:
        msg = "invalid cursor"
        raise ValueError(msg)
    pinned = parts[0] == "1"
    try:
        published_at = datetime.fromisoformat(parts[1])
        post_id = UUID(parts[2])
    except (TypeError, ValueError) as exc:
        msg = "invalid cursor"
        raise ValueError(msg) from exc
    return pinned, published_at, post_id


def news_list_keyset_where_sql(sort: str) -> str:
    """Keyset predicate for rows after cursor in pinned/date order (no full-text search)."""
    normalized = normalize_news_list_sort(sort)
    if normalized == "oldest":
        return (
            " AND ("
            "pinned < :cursor_pinned "
            "OR (pinned = :cursor_pinned AND published_at > :cursor_published_at) "
            "OR (pinned = :cursor_pinned AND published_at = :cursor_published_at AND id > :cursor_id)"
            ")"
        )
    return (
        " AND ("
        "pinned < :cursor_pinned "
        "OR (pinned = :cursor_pinned AND published_at < :cursor_published_at) "
        "OR (pinned = :cursor_pinned AND published_at = :cursor_published_at AND id < :cursor_id)"
        ")"
    )


def news_list_keyset_params(*, pinned: bool, published_at: datetime, post_id: UUID) -> dict[str, Any]:
    """Bind params for news_list_keyset_where_sql."""
    return {
        "cursor_pinned": pinned,
        "cursor_published_at": published_at,
        "cursor_id": str(post_id),
    }


def normalize_news_list_sort(raw: str | None) -> str:
    """Normalize feed sort token; unknown values fall back to newest."""
    if raw in VALID_NEWS_LIST_SORTS:
        return raw
    return "newest"


def news_list_order_sql(sort: str, *, search_active: bool = False) -> str:
    """SQL ORDER BY for published feed; with search, rank by ts_rank then pinned/date."""
    normalized = normalize_news_list_sort(sort)
    if search_active:
        rank = "ts_rank(search_vector, plainto_tsquery(:ts_config, :search)) DESC"
        if normalized == "oldest":
            return f"ORDER BY {rank}, pinned DESC, published_at ASC NULLS LAST"
        return f"ORDER BY {rank}, pinned DESC, published_at DESC NULLS LAST"
    if normalized == "oldest":
        return "ORDER BY pinned DESC, published_at ASC NULLS LAST"
    return "ORDER BY pinned DESC, published_at DESC NULLS LAST"


def build_news_list_user_filter_sql(
    *,
    unread_only: bool,
    starred_only: bool,
) -> tuple[str, bool]:
    """Return extra WHERE SQL for user-scoped filters and whether :uid is required."""
    parts: list[str] = []
    if unread_only:
        parts.append(
            "NOT EXISTS ("
            "SELECT 1 FROM ewdesk_user_news_state s "
            "WHERE s.user_id = CAST(:uid AS uuid) "
            "AND s.post_id = company_news_posts.id "
            "AND s.read_at IS NOT NULL)"
        )
    if starred_only:
        parts.append(
            "EXISTS ("
            "SELECT 1 FROM ewdesk_user_news_state s "
            "WHERE s.user_id = CAST(:uid AS uuid) "
            "AND s.post_id = company_news_posts.id "
            "AND s.starred = true)"
        )
    if not parts:
        return "", False
    return " AND " + " AND ".join(parts), True


def news_fulltext_search_sql_clause() -> str:
    """SQL fragment for published feed full-text match (requires search_vector column)."""
    return "search_vector @@ plainto_tsquery(:ts_config, :search)"


def news_fulltext_search_params(query: str) -> dict[str, str]:
    """Bind params for plainto_tsquery full-text search."""
    return {"ts_config": NEWS_SEARCH_TS_CONFIG, "search": query}


_NEWS_POST_ID_SEARCH_MIN_LEN = 4
_NEWS_POST_ID_SEARCH_RE = re.compile(r"^[0-9a-fA-F-]+$")


def is_news_post_id_search_query(query: str) -> bool:
    """True when query looks like a UUID (full or prefix) suitable for id ILIKE."""
    s = query.strip()
    if len(s) < _NEWS_POST_ID_SEARCH_MIN_LEN:
        return False
    if not _NEWS_POST_ID_SEARCH_RE.match(s):
        return False
    return any(ch in "0123456789abcdefABCDEF" for ch in s)


def news_post_id_search_sql_clause() -> str:
    """SQL fragment matching post id as text (partial UUID paste)."""
    return "CAST(id AS text) ILIKE :id_search ESCAPE '\\'"


def news_post_id_search_params(query: str) -> dict[str, str]:
    """Bind params for id ILIKE search."""
    return {"id_search": news_search_ilike_pattern(query.strip())}


def news_combined_search_sql_clause(query: str) -> str:
    """Full-text search, optionally OR id match when query looks like a post UUID."""
    fts = news_fulltext_search_sql_clause()
    if is_news_post_id_search_query(query):
        return f"(({fts}) OR ({news_post_id_search_sql_clause()}))"
    return fts


def news_combined_search_params(query: str) -> dict[str, str]:
    """Bind params for combined feed search (FTS + optional id ILIKE)."""
    params = news_fulltext_search_params(query)
    if is_news_post_id_search_query(query):
        params.update(news_post_id_search_params(query))
    return params


def normalize_optional_news_image_url(v: str | None) -> str | None:
    """Allow https/http URLs or same-origin path (/...). Empty → None."""
    if v is None:
        return None
    s = v.strip()
    if not s:
        return None
    if len(s) > MAX_NEWS_IMAGE_URL_LEN:
        msg = "image_url too long"
        raise ValueError(msg)
    lower = s.lower()
    if lower.startswith("https://") or lower.startswith("http://"):
        return s
    if s.startswith("/") and not s.startswith("//"):
        return s
    msg = "image_url must be https, http, or a path starting with /"
    raise ValueError(msg)


def _sanitize_ewdesk_title_line(s: str) -> str | None:
    t = s.strip()
    if not t or t.upper() == "NONE":
        return None
    if re.match(r"^ONE\s+line\s*:\s*", t, re.IGNORECASE):
        t = re.sub(r"^ONE\s+line\s*:\s*", "", t, flags=re.IGNORECASE).strip()
    if re.match(r"^Одна\s+строка\s*:\s*", t, re.IGNORECASE):
        t = re.sub(r"^Одна\s+строка\s*:\s*", "", t, flags=re.IGNORECASE).strip()
    return t if t else None


def _extract_title_from_preamble(head: str) -> str:
    lines = [ln.strip() for ln in head.strip().splitlines() if ln.strip()]
    if not lines:
        return ""
    first = lines[0]
    if re.match(r"^ONE\s+line\s*:\s*", first, re.IGNORECASE):
        return re.sub(r"^ONE\s+line\s*:\s*", "", first, flags=re.IGNORECASE).strip()
    if re.match(r"^Одна\s+строка\s*:\s*", first, re.IGNORECASE):
        return re.sub(r"^Одна\s+строка\s*:\s*", "", first, flags=re.IGNORECASE).strip()
    return first


def _try_parse_ewdesk_delimited(raw: str) -> tuple[str, str | None] | None:
    if _EW_MARK_TITLE not in raw or _EW_MARK_BODY not in raw:
        return None
    try:
        idx_t = raw.index(_EW_MARK_TITLE) + len(_EW_MARK_TITLE)
        idx_b = raw.index(_EW_MARK_BODY)
        if idx_b <= idx_t:
            return None
        title_section = raw[idx_t:idx_b].strip()
        body_section = raw[idx_b + len(_EW_MARK_BODY) :].lstrip("\n\r")
        if not body_section.strip():
            return None
        title_line = title_section.split("\n", 1)[0].strip()
        title_out = _sanitize_ewdesk_title_line(title_line)
        return (body_section.rstrip(), title_out)
    except ValueError:
        return None


def _try_parse_ewdesk_body_only(raw: str) -> tuple[str, str | None] | None:
    if _EW_MARK_BODY not in raw or raw.count(_EW_MARK_BODY) != 1:
        return None
    head, body = raw.split(_EW_MARK_BODY, 1)
    body = body.lstrip("\n\r")
    if not body.strip():
        return None
    title_out: str | None = None
    if _EW_MARK_TITLE in head:
        try:
            after_t = head.split(_EW_MARK_TITLE, 1)[1].strip()
            title_line = after_t.split("\n", 1)[0].strip()
            title_out = _sanitize_ewdesk_title_line(title_line)
        except IndexError:
            title_out = None
    else:
        title_out = _sanitize_ewdesk_title_line(_extract_title_from_preamble(head))
    return (body.rstrip(), title_out)


def _parse_ewdesk_polish_json(raw: str) -> tuple[str, str | None]:
    s = raw.strip()
    if "```" in s:
        start = s.find("{")
        end = s.rfind("}") + 1
        if start >= 0 and end > start:
            s = s[start:end]
    data: Any = json.loads(s)
    if not isinstance(data, dict):
        msg = "AI response must be a JSON object"
        raise ValueError(msg)
    body = data.get("body")
    if not isinstance(body, str) or not body.strip():
        msg = "AI response missing non-empty body"
        raise ValueError(msg)
    title_out: str | None = None
    raw_title = data.get("title")
    if isinstance(raw_title, str):
        tt = raw_title.strip()
        title_out = tt if tt else None
    return (body.strip(), title_out)


def parse_ewdesk_polish_response(raw: str) -> tuple[str, str | None]:
    """Delimited body first, then JSON, then plain Markdown-only reply."""
    raw_stripped = raw.strip()
    if not raw_stripped:
        msg = "empty AI response"
        raise ValueError(msg)

    delimited = _try_parse_ewdesk_delimited(raw)
    if delimited is not None:
        return delimited

    body_only = _try_parse_ewdesk_body_only(raw)
    if body_only is not None:
        return body_only

    try:
        return _parse_ewdesk_polish_json(raw_stripped)
    except json.JSONDecodeError:
        pass

    if not raw_stripped.lstrip().startswith("{"):
        return (raw_stripped, None)

    msg = "could not parse AI response (invalid JSON and no EW markers)"
    raise ValueError(msg)
