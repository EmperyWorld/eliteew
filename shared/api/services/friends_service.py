# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Stable import path for FriendsService (implementation lives in api.services.friends package).
# Invariants:
# - `from api.services.friends_service import FriendsService` remains the public API.
# - Do not re-implement graph logic here.
# Related:
# - api/services/friends/facade.py
# - api/routers/friends.py
# ---

from __future__ import annotations

from api.services.friends.facade import FriendsService

__all__ = ["FriendsService"]
