# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# FriendsService facade composing package mixins for Social Hub graph operations.
# Invariants:
# - Public import path remains api.services.friends_service.FriendsService.
# - Mixins must not import this facade.
# Related:
# - api/services/friends_service.py
# - api/routers/friends.py
# ---

from __future__ import annotations

import logging

import asyncpg  # type: ignore[import-not-found,import-untyped]

from api.services.friends.overview import FriendsOverviewMixin
from api.services.friends.profile import FriendsProfileMixin
from api.services.friends.relationship_controls import FriendsRelationshipControlsMixin
from api.services.friends.requests import FriendsRequestsMixin

logger = logging.getLogger(__name__)


class FriendsService(
    FriendsOverviewMixin,
    FriendsRequestsMixin,
    FriendsProfileMixin,
    FriendsRelationshipControlsMixin,
):
    """Friends graph service facade (stable import via friends_service.py)."""

    def __init__(self, db_pool: asyncpg.Pool) -> None:
        self.db_pool = db_pool
