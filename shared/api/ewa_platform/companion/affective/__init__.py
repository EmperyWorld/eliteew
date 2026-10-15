# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# **Аффективный контур спутника** (Mela / EWA): маршрутизация настроения без LLM, стили персон для recall/prompt,
# self-correction по памяти, mood → ambient preset. Импортируйте подмодули или плоские шимы
# ``mood_palette``, ``affective_router``, ``persona_style``, ``self_correction`` на корне ``companion`` — barrel-реэкспорта
# в ``affective.__init__`` нет.
# Invariants:
# - Избегать циклов: базовые модули не тянут ``turn.chat_turn``; ``self_correction`` не импортирует соседей пакета.
# Related:
# - api/ewa_platform/docs/EWA-COMPANION-PACKAGE-MIGRATION.md
# - documentation/product/ewa/EWA-COMPANION-PROFILE-ADR.md
# ---
"""EWA companion affective / cognition helpers (no barrel exports)."""

from __future__ import annotations
