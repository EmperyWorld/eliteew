# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# **Sidecar LLM** подмодули EWA companion: intent planner, trust classify/turn/state, markdown KV, bandwidth, Arlika wrath.
# Этот пакет **не** реэкспортирует символы на уровне ``__init__`` — импортируйте ``sidecar.intent_planner`` и т.д.
# или плоские шимы ``companion_intent_planner`` и др.
# Invariants:
# - Тяжёлые зависимости подтягиваются только при импорте конкретного подмодуля.
# Related:
# - api/ewa_platform/docs/EWA-COMPANION-PACKAGE-MIGRATION.md
# ---
"""EWA companion sidecar HTTP LLM helpers (subpackage; no barrel exports)."""

from __future__ import annotations
