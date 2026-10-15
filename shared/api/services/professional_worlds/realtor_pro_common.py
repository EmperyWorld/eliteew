# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared JSON/row helpers for Realtor Pro SQL modules.
# Invariants:
# - — (нет)
# Related:
# - api/services/professional_worlds/realtor_pro.py
# ---
# pyright: reportUnusedFunction=false

from __future__ import annotations

import json
from typing import Any


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def _rows(rows: list[Any]) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]
