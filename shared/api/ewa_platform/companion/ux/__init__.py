# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# **Поверхность UX спутника** поверх allowlisted actions: парсинг ответа LLM, лог действий, детерминированные
# доп. действия (открыть плеер / тема стола), серверное применение ``patch_desktop_config``, rate-limit observation.
# Импортируйте подмодули или плоские шимы ``companion_action_inference`` и т.д. на корне ``companion`` — barrel в
# ``ux.__init__`` нет.
# Invariants:
# - Избегать циклов с ``turn.chat_turn``: модули ``ux`` не импортируют ``chat_turn``.
# Related:
# - api/ewa_platform/companion/actions/
# - api/ewa_platform/docs/EWA-COMPANION-PACKAGE-MIGRATION.md
# - documentation/product/ewa/EWA-COMPANION-DESKTOP-ACTIONS-ADR.md
# ---
"""EWA companion UX helpers (reply extract, desktop action extras, observation RL)."""

from __future__ import annotations
