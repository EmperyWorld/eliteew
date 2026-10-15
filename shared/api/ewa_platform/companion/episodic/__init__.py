# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# **Episodic memory** for EWA companion (HCM writer): Postgres row + best-effort Qdrant. Re-exports ``writer`` so
# ``from api.ewa_platform.companion.episodic import record_user_turn`` stays stable. Batch re-index lives in ``episodic.reembed``
# (shim: ``companion.episodic_reembed``).
# Invariants:
# - This ``__init__`` imports **only** ``writer``; Celery re-embed imports ``episodic.reembed`` or the flat shim.
# Related:
# - api/ewa_platform/companion/episodic/writer.py
# - api/ewa_platform/companion/episodic/reembed.py
# - api/ewa_platform/docs/EWA-COMPANION-PACKAGE-MIGRATION.md
# ---
"""EWA companion episodic memory package (HCM writer surface)."""

from __future__ import annotations

from .writer import *  # noqa: F403
from .writer import __all__ as __all__
