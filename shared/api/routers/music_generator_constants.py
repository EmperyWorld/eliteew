# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   Shared limits for the music generator HTTP surface so companion tools can import them without pulling in the
#   full router stack (DB, SQLAlchemy, UGS wiring).
# Invariants:
#   - Values here must stay in sync with user-facing wizard contracts (Студия «Основной», EWA companion).
# Related:
#   - api/routers/music_generator.py
#   - api/ewa_platform/companion/orchestration/tool_registry.py
# ---
"""Shared limits for music generator routes and integrations."""

from __future__ import annotations

# Мастер «Основной»: тема песни (UI фронта может быть уже; API допускает длиннее для чата-компаньона).
MAX_WIZARD_THEME_CHARS = 160

# Лимит текста песни в HTTP wizard (``music_generator.py``); companion обрезает до отправки в suggest/generate.
MAX_LYRICS_LENGTH = 8000

# EWA companion: unified creative brief for /lyrics, /generate-style, /suggest-production-params.
MAX_EWA_COMPANION_CONTEXT_CHARS = 32768
