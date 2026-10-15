# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# **Persona / evolution / proactive anticipation:** личность (`character`), слияние learned_preferences (`evolution_tick`),
# LLM-эволюция (`evolution_summary`), подсказки наблюдения (`anticipation`). Импортируйте подмодули явно или плоские
# шимы ``companion.character`` / ``evolution_*`` / ``anticipation`` — символов на уровне ``persona.__init__`` нет.
# Invariants:
# - Не реэкспортировать всё из ``__init__``, чтобы не тянуть тяжёлые цепочки без нужды.
# Related:
# - api/ewa_platform/docs/EWA-COMPANION-PACKAGE-MIGRATION.md
# ---
"""EWA companion persona and evolution subpackage (no barrel exports)."""

from __future__ import annotations
