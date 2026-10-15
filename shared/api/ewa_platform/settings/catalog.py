# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Canonical registry of EWA platform settings (metadata for admin UI + DB seed).
# Invariants:
# - Runtime values live in ``ewa_platform_setting``; this module defines schema metadata only.
# - Bootstrap ``EWA_DATABASE_URL`` is excluded.
# Related:
# - api/ewa_platform/settings/catalog_entries.py (generated)
# - api/ewa_platform/persistence_pg/platform_settings_asyncpg.py
# ---

from __future__ import annotations

from api.ewa_platform.settings.catalog_entries import GENERATED_CATALOG
from api.ewa_platform.settings.types import SettingDefinition

CATALOG: dict[str, SettingDefinition] = dict(GENERATED_CATALOG)


def get_setting_definition(key: str) -> SettingDefinition | None:
    return CATALOG.get(key.strip())


def iter_setting_definitions(*, category: str | None = None) -> tuple[SettingDefinition, ...]:
    items = sorted(CATALOG.values(), key=lambda d: (d.category, d.sort_order, d.key))
    if category:
        items = [d for d in items if d.category == category]
    return tuple(items)


__all__ = [
    "CATALOG",
    "SettingDefinition",
    "get_setting_definition",
    "iter_setting_definitions",
]
