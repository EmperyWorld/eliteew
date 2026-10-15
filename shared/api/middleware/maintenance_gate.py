# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Planned-maintenance HTTP gate: protected API routes return calm 503 JSON with Retry-After during restart phases.
# Invariants:
# - Health, auth, build-version, Socket.IO, and maintenance control endpoints must remain reachable.
# - The gate never turns unplanned failures into maintenance; it only follows explicit MaintenanceWindow state.
# Related:
# - api/services/maintenance_service.py
# - shared/web/frontend/src/services/maintenance/maintenanceState.ts
# ---
"""HTTP middleware for planned maintenance windows."""

from __future__ import annotations

import logging
import re
from collections.abc import Awaitable, Callable

from fastapi import Request, Response, status  # type: ignore[import-untyped]
from starlette.middleware.base import BaseHTTPMiddleware  # type: ignore[import-untyped]
from starlette.responses import JSONResponse  # type: ignore[import-untyped]

from api.services.maintenance_service import get_maintenance_service

logger = logging.getLogger(__name__)

_SKIP_PATH_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p)
    for p in (
        r"^/health$",
        r"^/api/health$",
        r"^/api/v1/health$",
        r"^/metrics$",
        r"^/api/metrics$",
        r"^/api/v1/system-info$",
        r"^/api/v1/ping$",
        r"^/api/version$",
        r"^/version$",
        r"^/api/auth/",
        r"^/api/v1/auth/",
        r"^/socket\.io/",
        r"^/api/v1/system/maintenance$",
        r"^/api/admin/system/maintenance(?:/.*)?$",
        r"^/api/v1/logs/client-error$",
    )
)


def _path_skipped(path: str) -> bool:
    return any(pattern.match(path) for pattern in _SKIP_PATH_PATTERNS)


class MaintenanceGateMiddleware(BaseHTTPMiddleware):
    """Return maintenance 503 for protected API calls while the operator restarts services."""

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        path = request.url.path
        if not path.startswith("/api/") or _path_skipped(path) or request.method == "OPTIONS":
            return await call_next(request)

        try:
            window = await get_maintenance_service().get_current_window()
        except Exception as exc:
            logger.debug("maintenance_gate_state_unavailable path=%s error=%s", path, exc)
            return await call_next(request)

        if not window or not window.gates_api:
            return await call_next(request)

        retry_after = str(window.retry_after_seconds)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "code": "maintenance",
                "error": "maintenance",
                "detail": window.message,
                "title": window.title,
                "phase": window.phase.value,
                "window_id": window.id,
                "retry_after": window.retry_after_seconds,
                "window": window.model_dump(mode="json"),
            },
            headers={
                "Retry-After": retry_after,
                "Cache-Control": "no-store",
                "X-EliteEW-Maintenance": window.id,
            },
        )
