"""Helpers for gaf_messages.metadata (JSONB) when reading from PostgreSQL."""

from __future__ import annotations

import json
from typing import Any


def message_metadata_dict_from_db(raw: Any) -> dict[str, Any] | None:
    """Normalize JSONB metadata for API clients.

    asyncpg usually returns a dict; some paths may expose a JSON string — parse it
    so structured system payloads (e.g. onboarding_instruction) are not dropped.
    """
    if raw is None:
        return None
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return None
        return parsed if isinstance(parsed, dict) else None
    return None
