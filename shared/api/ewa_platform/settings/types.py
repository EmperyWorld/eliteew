# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Shared types for EWA platform settings stored in Postgres (operator-editable via admin).
# Invariants:
# - ``EWA_DATABASE_URL`` is bootstrap-only and never appears in the catalog table.
# Related:
# - api/ewa_platform/settings/catalog.py
# - documentation/product/ewa/EWA-PLATFORM-SETTINGS-DB.md
# ---

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

SettingValueType = Literal["bool", "int", "float", "string", "csv", "secret"]


@dataclass(frozen=True)
class SettingDefinition:
    key: str
    category: str
    value_type: SettingValueType
    default_value: str
    title_ru: str
    title_en: str
    description_ru: str
    description_en: str
    allowed_values: str
    affects_ru: str
    affects_en: str
    sort_order: int
    is_secret: bool = False
