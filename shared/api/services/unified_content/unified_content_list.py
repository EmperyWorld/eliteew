# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Keyset cursor helpers for Unified Content list pagination (encode/decode, ORDER BY tie-breaker, WHERE fragment).
# Invariants:
# - Cursor pagination is disabled for full-text search ranking and group_by_type list modes.
# - Cursor sort_field/sort_order must match the active request or decode raises ValueError.
# Related:
# - api/services/unified_content/content_storage_service.py
# - api/routers/unified_content.py
# ---
"""Pure helpers for GET /content cursor (keyset) pagination."""

from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from api.schemas.unified_content import Content

CONTENT_LIST_CURSOR_VERSION = 1
MAX_CONTENT_LIST_CURSOR_LEN = 1024
VALID_CONTENT_LIST_SORT_FIELDS = frozenset({"name", "date", "modified", "size", "type"})
VALID_CONTENT_LIST_SORT_ORDERS = frozenset({"asc", "desc"})

SORT_FIELD_TO_DB_COLUMN: dict[str, str] = {
    "name": "name",
    "date": "created_at",
    "modified": "updated_at",
    "size": "file_size",
    "type": "content_type",
}


@dataclass(frozen=True)
class ContentListCursorState:
    sort_field: str
    sort_order: str
    sort_value: str
    content_id: UUID


def normalize_content_list_sort_field(raw: str | None) -> str:
    if raw in VALID_CONTENT_LIST_SORT_FIELDS:
        return raw
    if raw in SORT_FIELD_TO_DB_COLUMN:
        return raw
    return "modified"


def normalize_content_list_sort_order(raw: str | None) -> str:
    if raw in VALID_CONTENT_LIST_SORT_ORDERS:
        return raw
    return "desc"


def content_list_supports_keyset(
    *,
    search_query: str | None,
    group_by_type: bool,
) -> bool:
    """Keyset cursors apply only to stable sort orders without search ranking."""
    if group_by_type:
        return False
    return not (search_query or "").strip()


def content_row_sort_key(content: Content, sort_field: str) -> str:
    """Serialize the sort column value from a list row for cursor encoding."""
    normalized = normalize_content_list_sort_field(sort_field)
    if normalized == "name":
        return content.name or ""
    if normalized == "date":
        return content.created_at.isoformat()
    if normalized == "modified":
        anchor = content.updated_at or content.created_at
        return anchor.isoformat()
    if normalized == "size":
        size = content.file_size
        return str(size if size is not None else -1)
    if normalized == "type":
        ct = content.content_type
        return ct.value if hasattr(ct, "value") else str(ct)
    return content.created_at.isoformat()


def encode_content_list_cursor(
    *,
    sort_field: str,
    sort_order: str,
    sort_value: str,
    content_id: UUID,
) -> str:
    payload = {
        "v": CONTENT_LIST_CURSOR_VERSION,
        "sf": normalize_content_list_sort_field(sort_field),
        "so": normalize_content_list_sort_order(sort_order),
        "sv": sort_value,
        "id": str(content_id),
    }
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    token = base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
    if len(token) > MAX_CONTENT_LIST_CURSOR_LEN:
        msg = "cursor too long"
        raise ValueError(msg)
    return token


def decode_content_list_cursor(cursor: str) -> ContentListCursorState:
    if not cursor or len(cursor) > MAX_CONTENT_LIST_CURSOR_LEN:
        msg = "invalid cursor"
        raise ValueError(msg)
    pad = "=" * (-len(cursor) % 4)
    try:
        raw = base64.urlsafe_b64decode(f"{cursor}{pad}")
        payload = json.loads(raw.decode("utf-8"))
    except (TypeError, ValueError, json.JSONDecodeError) as exc:
        msg = "invalid cursor"
        raise ValueError(msg) from exc
    if not isinstance(payload, dict):
        msg = "invalid cursor"
        raise ValueError(msg)
    if payload.get("v") != CONTENT_LIST_CURSOR_VERSION:
        msg = "invalid cursor"
        raise ValueError(msg)
    sort_field = payload.get("sf")
    sort_order = payload.get("so")
    sort_value = payload.get("sv")
    content_id_raw = payload.get("id")
    if (
        sort_field not in VALID_CONTENT_LIST_SORT_FIELDS
        or sort_order not in VALID_CONTENT_LIST_SORT_ORDERS
        or not isinstance(sort_value, str)
        or not isinstance(content_id_raw, str)
    ):
        msg = "invalid cursor"
        raise ValueError(msg)
    try:
        content_id = UUID(content_id_raw)
    except (TypeError, ValueError) as exc:
        msg = "invalid cursor"
        raise ValueError(msg) from exc
    return ContentListCursorState(
        sort_field=sort_field,
        sort_order=sort_order,
        sort_value=sort_value,
        content_id=content_id,
    )


def assert_cursor_sort_matches_request(
    cursor_state: ContentListCursorState,
    *,
    sort_field: str | None,
    sort_order: str | None,
) -> None:
    expected_field = normalize_content_list_sort_field(sort_field)
    expected_order = normalize_content_list_sort_order(sort_order)
    if cursor_state.sort_field != expected_field or cursor_state.sort_order != expected_order:
        msg = "cursor sort mismatch"
        raise ValueError(msg)


def content_list_order_by_sql(
    *,
    sort_field: str | None,
    sort_order: str | None,
    group_by_type: bool,
    search_active: bool,
) -> str:
    """ORDER BY with stable ``id`` tie-breaker for keyset pagination."""
    if group_by_type:
        field = normalize_content_list_sort_field(sort_field)
        order = normalize_content_list_sort_order(sort_order)
        db_field = SORT_FIELD_TO_DB_COLUMN[field]
        return f"ORDER BY content_type, {db_field} {order.upper()}, id {order.upper()}"
    if search_active:
        return "ORDER BY search_score DESC NULLS LAST, created_at DESC, id DESC"
    field = normalize_content_list_sort_field(sort_field)
    order = normalize_content_list_sort_order(sort_order)
    db_field = SORT_FIELD_TO_DB_COLUMN[field]
    if field == "size":
        return f"ORDER BY COALESCE({db_field}, -1) {order.upper()}, id {order.upper()}"
    if field in {"date", "modified"}:
        return f"ORDER BY {db_field} {order.upper()} NULLS LAST, id {order.upper()}"
    return f"ORDER BY {db_field} {order.upper()}, id {order.upper()}"


def content_list_keyset_where_sql(
    cursor_state: ContentListCursorState,
) -> tuple[str, list[Any]]:
    """Return extra AND clause and bind values for rows strictly after the cursor."""
    field = cursor_state.sort_field
    order = cursor_state.sort_order
    db_field = SORT_FIELD_TO_DB_COLUMN[field]
    id_param = cursor_state.content_id

    if field == "size":
        try:
            size_val = int(cursor_state.sort_value)
        except ValueError as exc:
            msg = "invalid cursor"
            raise ValueError(msg) from exc
        sort_expr = f"COALESCE({db_field}, -1)"
        if order == "asc":
            clause = f"({sort_expr} > $KEYSET_SIZE OR ({sort_expr} = $KEYSET_SIZE AND id > $KEYSET_ID))"
        else:
            clause = f"({sort_expr} < $KEYSET_SIZE OR ({sort_expr} = $KEYSET_SIZE AND id < $KEYSET_ID))"
        return clause, [size_val, size_val, id_param]

    if field in {"date", "modified"}:
        try:
            dt_val = datetime.fromisoformat(cursor_state.sort_value)
        except ValueError as exc:
            msg = "invalid cursor"
            raise ValueError(msg) from exc
        if order == "asc":
            clause = f"({db_field} > $KEYSET_DT OR ({db_field} = $KEYSET_DT AND id > $KEYSET_ID))"
        else:
            clause = (
                f"({db_field} < $KEYSET_DT OR "
                f"({db_field} IS NULL AND $KEYSET_DT IS NOT NULL) OR "
                f"({db_field} = $KEYSET_DT AND id < $KEYSET_ID))"
            )
        return clause, [dt_val, dt_val, id_param]

    text_val = cursor_state.sort_value
    if order == "asc":
        clause = f"({db_field} > $KEYSET_TEXT OR ({db_field} = $KEYSET_TEXT AND id > $KEYSET_ID))"
    else:
        clause = f"({db_field} < $KEYSET_TEXT OR ({db_field} = $KEYSET_TEXT AND id < $KEYSET_ID))"
    return clause, [text_val, text_val, id_param]


def bind_keyset_where_clause(clause: str, start_index: int) -> str:
    """Replace placeholder tokens with asyncpg positional parameters."""
    replacements = [
        ("$KEYSET_SIZE", f"${start_index}"),
        ("$KEYSET_SIZE", f"${start_index + 1}"),
        ("$KEYSET_ID", f"${start_index + 2}"),
    ]
    if "$KEYSET_DT" in clause:
        replacements = [
            ("$KEYSET_DT", f"${start_index}"),
            ("$KEYSET_DT", f"${start_index + 1}"),
            ("$KEYSET_ID", f"${start_index + 2}"),
        ]
    elif "$KEYSET_TEXT" in clause:
        replacements = [
            ("$KEYSET_TEXT", f"${start_index}"),
            ("$KEYSET_TEXT", f"${start_index + 1}"),
            ("$KEYSET_ID", f"${start_index + 2}"),
        ]
    out = clause
    for token, param in replacements:
        out = out.replace(token, param, 1)
    return out


def build_next_content_list_cursor(
    *,
    items: list[Content],
    sort_field: str | None,
    sort_order: str | None,
    limit: int,
    search_query: str | None,
    group_by_type: bool,
) -> str | None:
    if not content_list_supports_keyset(search_query=search_query, group_by_type=group_by_type):
        return None
    if len(items) < limit or not items:
        return None
    last = items[-1]
    normalized_field = normalize_content_list_sort_field(sort_field)
    normalized_order = normalize_content_list_sort_order(sort_order)
    return encode_content_list_cursor(
        sort_field=normalized_field,
        sort_order=normalized_order,
        sort_value=content_row_sort_key(last, normalized_field),
        content_id=last.id,
    )
