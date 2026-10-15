# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Runtime module predicates for Professional Worlds snapshot assembly and UGS type resolution.
# Invariants:
# - Module keys normalize to lowercase hyphen form before comparison.
# Related:
# - api/services/professional_worlds/service.py
# ---
# pyright: reportUnusedFunction=false

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

REALTOR_VERTICAL_SLUG = "realtor"
TEXT_CHAT_TYPE_KEY = "text_chat"


def _normalize_module_key(module_key: str) -> str:
    return module_key.strip().lower().replace("_", "-")


def _runtime_module_enabled(modules: list[dict[str, Any]], module_key: str) -> bool:
    target = _normalize_module_key(module_key)
    return any(
        _normalize_module_key(str(mod.get("module_key") or "")) == target and bool(mod.get("is_enabled"))
        for mod in modules
    )


def _should_fetch_profile_snapshot(modules: list[dict[str, Any]]) -> bool:
    return _runtime_module_enabled(modules, "profile")


def _should_fetch_clients_snapshot(modules: list[dict[str, Any]]) -> bool:
    return _runtime_module_enabled(modules, "clients")


def _should_fetch_deals_snapshot(modules: list[dict[str, Any]]) -> bool:
    return _runtime_module_enabled(modules, "deals") or _runtime_module_enabled(modules, "clients")


def _should_fetch_learning_snapshot(modules: list[dict[str, Any]]) -> bool:
    return _runtime_module_enabled(modules, "learning")


def _should_fetch_artifacts_snapshot(modules: list[dict[str, Any]]) -> bool:
    return _runtime_module_enabled(modules, "artifacts")


def _vertical_supports_listing_workspace(vertical_slug: str, modules: list[dict[str, Any]]) -> bool:
    return vertical_slug == REALTOR_VERTICAL_SLUG and _runtime_module_enabled(modules, "objects")


def resolve_pw_ugs_type_key(action: Mapping[str, Any] | None) -> str:
    """Return configured UGS type for a Professional Worlds AI action."""
    key = str((action or {}).get("ugs_type_key") or "").strip()
    return key or TEXT_CHAT_TYPE_KEY
