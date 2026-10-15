# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# **Контекст спутника:** якорь (`anchor`), композер (`anchor_compose`), HTTP-операции (`anchor_ops`), контроллер
# прuning (`controller`), шум/санитайз (`noise`). Импортируйте подмодули или плоские шимы `context_anchor`,
# `companion_context_noise` и т.д. — на ``context.__init__`` реэкспорта нет.
# Invariants:
# - Избегать циклов: ``noise`` не импортирует ``anchor``.
# Related:
# - api/ewa_platform/docs/EWA-COMPANION-PACKAGE-MIGRATION.md
# - documentation/product/ewa/EWA-COMPANION-CONTEXT-ANCHOR-ROLLOUT.md
# ---
"""EWA companion context anchor and hygiene subpackage (no barrel exports)."""

from __future__ import annotations
