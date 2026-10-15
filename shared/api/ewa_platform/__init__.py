# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Root of the **`api.ewa_platform`** package — version marker and package surface for platform EWA.
# Invariants:
# - No imports from api.services.amka_core; legacy remains a separate codepath until cutover.
# Related:
# - api/ewa_platform/README.md
# - documentation/product/amka-seed-album/AMKA-PLATFORM-GREENFIELD.md
# ---
from __future__ import annotations

__all__ = ["__version__"]
__version__ = "0.1.0"
