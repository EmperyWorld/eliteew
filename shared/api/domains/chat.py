# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Domain registrar slot for chat; legacy FastAPI `/api/ws*` echo soft-retired.
# Invariants:
# - Must not mount unauthenticated WebSocket routers.
# Related:
# - documentation/platform/REALTIME-SOCKETIO-AND-WS.md
# ---
"""Chat domain registrar.

Legacy unauthenticated FastAPI WebSocket echo router (`websocket_handler`) was
soft-retired 2026-07-28. Production realtime is Socket.IO (`socketio_handler`
mounted in ``main.py``) plus authenticated native WS (Live Voice, Doc Yjs).

GAF chat HTTP lives under social/gaf routers, not this domain.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import FastAPI  # type: ignore[import-untyped]


def register_domain_chat(app: FastAPI) -> None:
    """No routers: legacy `/api/ws*` removed; keep domain slot for registration order."""
    _ = app
