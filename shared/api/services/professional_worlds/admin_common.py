# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared JSON/row helpers for Professional Worlds admin SQL modules.
# Invariants:
# - — (нет)
# Related:
# - api/services/professional_worlds/admin_service.py
# ---
# pyright: reportUnusedFunction=false

from __future__ import annotations

import json
from typing import Any


def _json(value: Any) -> str:
    """Serialize JSON payloads for SQL text queries."""
    return json.dumps(value, ensure_ascii=False, default=str)


def _row(row: Any) -> dict[str, Any] | None:
    """Convert SQLAlchemy RowMapping to plain dict."""
    return dict(row) if row is not None else None


def _rows(rows: list[Any]) -> list[dict[str, Any]]:
    """Convert SQLAlchemy RowMapping rows to plain dicts."""
    return [dict(row) for row in rows]
