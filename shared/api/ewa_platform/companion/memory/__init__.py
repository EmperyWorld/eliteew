# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Package barrel for **EWA companion durable memory** (HCM L1 facts / top-N helpers). Re-exports the public surface
# of ``hcm_store`` so ``from api.ewa_platform.companion.memory import …`` stays stable. Submodule ``memory.retrieval``
# holds the HCM composer (import explicitly to avoid loading asyncpg when only parsing helpers are needed).
# Invariants:
# - This ``__init__`` imports **only** ``hcm_store`` (no heavy retrieval stack at import time).
# Related:
# - api/ewa_platform/companion/memory/hcm_store.py
# - api/ewa_platform/companion/memory/retrieval.py
# - api/ewa_platform/docs/EWA-COMPANION-PACKAGE-MIGRATION.md
# ---
"""EWA companion memory package (durable facts + prompt helpers)."""

from __future__ import annotations

from .hcm_store import *  # noqa: F403
from .hcm_store import __all__ as __all__
