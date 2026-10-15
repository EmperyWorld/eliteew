# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Domain router registration for Social Hub, friends graph, chat, and video calls.
# Invariants:
# - New social routes register under `/api/v1`; legacy `/api` mount stays limited to Friends router compatibility.
# - Imports remain local so optional domain dependencies do not slow app module import.
# Related:
# - api/routers/friends.py
# - api/routers/social_hub.py
# ---

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import FastAPI  # type: ignore[import-untyped]


def register_domain_social(app: FastAPI) -> None:
    """Register social graph and direct user interaction routers."""
    from api.gaf_chat.router import router as gaf_chat_router  # noqa: PLC0415
    from api.routers.friends import router as friends_router  # noqa: PLC0415
    from api.routers.social_hub import router as social_hub_router  # noqa: PLC0415
    from api.video_calls.router import router as video_calls_router  # noqa: PLC0415

    app.include_router(friends_router, prefix="/api/v1", tags=["Friends"])
    app.include_router(social_hub_router, prefix="/api/v1", tags=["Social Hub"])
    app.include_router(gaf_chat_router, prefix="/api/v1", tags=["GAF Chat"])
    app.include_router(video_calls_router, prefix="/api/v1", tags=["Video Calls"])
    app.include_router(friends_router, prefix="/api", tags=["Friends (Legacy)"])
