#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Track stale SPA bundles on protected HTTP API via X-App-Build header; Socket.IO keeps the hard gate.
# Soft mismatch responses include X-EliteEW-App-Build-Status for SPA toast.
# Invariants:
# - Public paths (health, /api/version, auth, maintenance status) skip the gate; mobile native UA is exempt.
# - When server has no deploy id file, gate is a no-op.
# Related:
# - api/services/client_build_service.py, shared/web/frontend/src/utils/staleBundleReload.ts
# - shared/web/frontend/src/utils/softAppBuildMismatchToast.ts
# ---
"""Middleware: log stale SPA bundles; hard block stays on Socket.IO only."""

from __future__ import annotations

import logging
import re

from starlette.middleware.base import BaseHTTPMiddleware  # type: ignore[import-untyped]
from starlette.requests import Request  # type: ignore[import-untyped]
from starlette.responses import Response  # type: ignore[import-untyped]

from api.services.client_build_service import validate_client_build

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
        r"^/api/v1/system/maintenance$",
        r"^/api/version$",
        r"^/version$",
        r"^/api/auth/",
        r"^/api/v1/auth/",
        r"^/socket\.io/",
        r"^/api/v1/logs/client-error$",
    )
)


def _path_skipped(path: str) -> bool:
    return any(p.match(path) for p in _SKIP_PATH_PATTERNS)


class ClientBuildGateMiddleware(BaseHTTPMiddleware):
    """Log outdated X-App-Build on HTTP; do not 409 (avoids login deadlock on stale tabs)."""

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        if path.startswith("/api") and not _path_skipped(path):
            ua = request.headers.get("user-agent")
            client_build = request.headers.get("x-app-build") or request.headers.get("X-App-Build")
            ok, reason = validate_client_build(client_build, user_agent=ua, reject_missing=False)
            if not ok:
                logger.info(
                    "client_build_http_soft_warn path=%s reason=%s client_build=%s",
                    path,
                    reason,
                    (client_build or "")[:24] or "(none)",
                )
                response = await call_next(request)
                response.headers["X-EliteEW-App-Build-Status"] = "mismatch"
                if reason:
                    response.headers["X-EliteEW-App-Build-Reason"] = str(reason)[:64]
                return response

        return await call_next(request)
