# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Compatibility alias — serialize helpers live on FriendsServiceBase.
# Invariants:
# - Prefer importing FriendsServiceBase from api.services.friends.base.
# Related:
# - api/services/friends/base.py
# ---

from __future__ import annotations

from api.services.friends.base import FriendsServiceBase as FriendsSerializeMixin

__all__ = ["FriendsSerializeMixin"]
