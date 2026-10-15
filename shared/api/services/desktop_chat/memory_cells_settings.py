# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Resolve Memory Cells admin defaults from desktop_ai_chat_config.defaults.
# Invariants:
# - Soft quota default 3 (1..5); hard DB ceiling remains 5.
# - Feature flag defaults to enabled when key absent.
# Related:
# - documentation/product/desktop/DESKTOP-AI-CHAT-MEMORY-CELLS.md
# ---

from __future__ import annotations

from typing import Any


def _clamp_int(raw: Any, *, default: int, lo: int, hi: int) -> int:
    try:
        n = int(raw)
    except TypeError, ValueError:
        return default
    return max(lo, min(hi, n))


def memory_cells_feature_enabled(defaults: dict[str, Any] | None) -> bool:
    d = defaults or {}
    raw = d.get("memory_cells_enabled")
    if raw is None:
        return True
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, (int, float)):
        return bool(raw)
    s = str(raw).strip().lower()
    if s in ("0", "false", "off", "no"):
        return False
    if s in ("1", "true", "on", "yes"):
        return True
    return True


def memory_cells_max_per_user(defaults: dict[str, Any] | None) -> int:
    return _clamp_int((defaults or {}).get("memory_cells_max_per_user"), default=3, lo=1, hi=5)


def memory_cells_max_messages(defaults: dict[str, Any] | None) -> int:
    return _clamp_int((defaults or {}).get("memory_cells_max_messages"), default=400, lo=20, hi=2000)


def memory_cells_max_chunks(defaults: dict[str, Any] | None) -> int:
    return _clamp_int((defaults or {}).get("memory_cells_max_chunks"), default=256, lo=16, hi=1024)


def memory_cells_retrieval_top_k(defaults: dict[str, Any] | None) -> int:
    return _clamp_int((defaults or {}).get("memory_cells_retrieval_top_k"), default=8, lo=1, hi=32)


def memory_cells_min_score(defaults: dict[str, Any] | None) -> float:
    raw = (defaults or {}).get("memory_cells_min_score")
    try:
        v = float(raw)
    except TypeError, ValueError:
        return 0.2
    return max(0.0, min(1.0, v))


def normalize_memory_cells_admin_defaults(patch: dict[str, Any]) -> dict[str, Any]:
    """Sanitize admin PATCH fragment for memory_cells_* keys only."""
    out: dict[str, Any] = {}
    if "memory_cells_enabled" in patch:
        out["memory_cells_enabled"] = memory_cells_feature_enabled(
            {"memory_cells_enabled": patch.get("memory_cells_enabled")}
        )
    if "memory_cells_max_per_user" in patch:
        out["memory_cells_max_per_user"] = memory_cells_max_per_user(patch)
    if "memory_cells_max_messages" in patch:
        out["memory_cells_max_messages"] = memory_cells_max_messages(patch)
    if "memory_cells_max_chunks" in patch:
        out["memory_cells_max_chunks"] = memory_cells_max_chunks(patch)
    if "memory_cells_retrieval_top_k" in patch:
        out["memory_cells_retrieval_top_k"] = memory_cells_retrieval_top_k(patch)
    if "memory_cells_min_score" in patch:
        out["memory_cells_min_score"] = memory_cells_min_score(patch)
    return out
