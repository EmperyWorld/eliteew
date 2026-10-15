# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `utils/json_safe.py`; preserves its existing EliteEW API/service responsibilities.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

"""JSON-serializable values for API responses (HTTPException detail, structured errors)."""

from __future__ import annotations

import base64
import json
from collections.abc import Mapping
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

_DEFAULT_LOG_TRUNCATE = 1024


def json_safe_api_detail(value: Any) -> Any:
    """Recursively normalize values for HTTPException ``detail`` (UUID/datetime/Decimal/asyncpg rows)."""
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return value
    if isinstance(value, str):
        return value
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, bytes):
        return base64.b64encode(value).decode("ascii")
    if isinstance(value, (set, frozenset)):
        return [json_safe_api_detail(v) for v in value]
    if isinstance(value, Mapping):
        return {str(k): json_safe_api_detail(v) for k, v in value.items()}
    if isinstance(value, list):
        return [json_safe_api_detail(v) for v in value]
    if isinstance(value, tuple):
        return [json_safe_api_detail(v) for v in value]
    try:
        json.dumps(value)
    except (TypeError, ValueError):  # fmt: skip
        return str(value)
    return value


def truncate_for_log(text: str, *, max_chars: int = _DEFAULT_LOG_TRUNCATE) -> str:
    """Bound log line length for LLM/HTTP previews (does not remove secrets — use redaction/masking separately)."""
    if max_chars <= 0 or len(text) <= max_chars:
        return text
    return text[:max_chars] + f"...(truncated,len={len(text)})"


def mask_secret_for_log(
    secret: str,
    *,
    head: int = 8,
    tail: int = 6,
) -> str:
    """Show only prefix and suffix of secrets (JWT, API keys) for operator-friendly logs."""
    s = (secret or "").strip()
    if not s:
        return ""
    min_keep = head + tail + 1
    if len(s) <= min_keep:
        return "…"
    return f"{s[:head]}…{s[-tail:]}"


def opaque_token_ref(token: str) -> str:
    """Token preview for logs: masked body + length (do not log raw JWT)."""
    preview = mask_secret_for_log(token)
    return f"{preview} len={len(token)}"
