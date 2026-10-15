# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Bounded friends overview snapshot for Social Hub.
# Invariants:
# - Part of FriendsService package; do not import friends_service facade from here.
# Related:
# - api/services/friends_service.py
# ---

from __future__ import annotations

from api.services.friends.graph_queries import FriendsGraphQueriesMixin


class FriendsOverviewMixin(FriendsGraphQueriesMixin):
    async def get_overview(self, user_id: str) -> dict:
        """Return friends graph snapshot for the current user in one API call."""
        uid = self._parse_user_uuid(user_id)
        if uid is None:
            return {
                "friends": [],
                "incoming_requests": [],
                "sent_requests": [],
                "circles": [],
                "stats": {
                    "friends_count": 0,
                    "incoming_requests_count": 0,
                    "sent_requests_count": 0,
                },
            }

        async with self.db_pool.acquire() as conn:
            friends = await self._fetch_friends(conn, uid)
            incoming_requests = await self._fetch_incoming_requests(conn, uid)
            sent_requests = await self._fetch_sent_requests(conn, uid)
            circles = await self._fetch_circles(conn, uid)

        return {
            "friends": friends,
            "incoming_requests": incoming_requests,
            "sent_requests": sent_requests,
            "circles": circles,
            "stats": {
                "friends_count": len(friends),
                "incoming_requests_count": len(incoming_requests),
                "sent_requests_count": len(sent_requests),
            },
        }
