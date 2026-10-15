# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Map queue-worker sidecar failures to structured FastAPI HTTP errors (503/502).
# Invariants:
# - API /api/health must not depend on sidecars; only user-facing sidecar routes raise here.
# Related:
# - api/services/rendering/browser_render_client.py
# - api/services/science_stack/science_client.py
# ---
from __future__ import annotations

import httpx
from fastapi import HTTPException

from api.services.rendering.browser_render_client import BrowserRenderUnavailableError
from api.services.science_stack.science_client import ScienceStackUnavailableError


def sidecar_http_exception(exc: Exception, *, service: str) -> HTTPException:
    """Convert sidecar client errors to structured HTTP responses."""
    if isinstance(exc, BrowserRenderUnavailableError | ScienceStackUnavailableError):
        detail = str(exc) or f"{service} sidecar unavailable"
        status = 503
        cause = exc.__cause__
        if isinstance(cause, httpx.ConnectError | httpx.ConnectTimeout):
            status = 502
        return HTTPException(status_code=status, detail=detail)

    if isinstance(exc, httpx.HTTPError):
        status = 502 if isinstance(exc, httpx.ConnectError | httpx.ConnectTimeout) else 503
        return HTTPException(
            status_code=status,
            detail=f"{service} sidecar request failed: {exc}",
        )

    return HTTPException(status_code=503, detail=f"{service} sidecar unavailable: {exc}")
