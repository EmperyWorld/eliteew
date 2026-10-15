# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Coerce PostgreSQL JSON/JSONB values to dict and register asyncpg codecs so
# pooled connections decode jsonb as Python objects (not raw str).
# Invariants:
# - coerce_json_object never returns None; missing/empty → {}.
# - Non-object JSON (array/scalar) raises ValueError.
# Related:
# - api/core/database.py
# - api/services/barrel_service.py
# - api/services/ingestion_service.py
# ---

from __future__ import annotations

import json
import logging
from collections.abc import Mapping
from typing import Any

import asyncpg

logger = logging.getLogger(__name__)

_JSONB_OBJECT_KEYS = frozenset({"metadata", "payload"})


def coerce_json_object(value: Any) -> dict[str, Any]:
    """Normalize asyncpg/PG JSON object fields to ``dict[str, Any]``.

    Handles ``None``, ``dict``, ``Mapping``, and JSON text (str/bytes) that
    asyncpg returns when no jsonb codec is registered.
    """

    if value is None:
        return {}
    if isinstance(value, dict):
        return dict(value)
    if isinstance(value, Mapping):
        return dict(value)
    if isinstance(value, memoryview):
        value = value.tobytes()
    if isinstance(value, (bytes, bytearray)):
        value = bytes(value).decode("utf-8")
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return {}
        parsed = json.loads(text)
        if not isinstance(parsed, dict):
            raise ValueError(f"JSON object expected, got {type(parsed).__name__}")
        return parsed
    raise TypeError(f"Cannot coerce JSON object from {type(value).__name__}")


def coerce_record_json_objects(row: dict[str, Any]) -> dict[str, Any]:
    """In-place-safe copy: coerce known jsonb object columns on a row dict."""

    out = dict(row)
    for key in _JSONB_OBJECT_KEYS:
        if key in out:
            out[key] = coerce_json_object(out[key])
    return out


async def register_json_codecs(conn: asyncpg.Connection) -> None:
    """Decode/encode PG json/jsonb as Python objects on each pooled connection."""

    for typename in ("json", "jsonb"):
        await conn.set_type_codec(
            typename,
            encoder=json.dumps,
            decoder=json.loads,
            schema="pg_catalog",
            format="text",
        )
    logger.debug("[STEP] kbsew_asyncpg_json_codec registered")
