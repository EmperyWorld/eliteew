from __future__ import annotations

import contextlib
import uuid
from typing import TYPE_CHECKING

import structlog  # type: ignore[import-not-found]
from starlette.middleware.base import BaseHTTPMiddleware  # type: ignore[import-untyped]

"""Middleware enriching logs with per-request context."""

if TYPE_CHECKING:
    from collections.abc import Callable

    from fastapi import Request, Response  # type: ignore[import-untyped]

REQUEST_ID_HEADER = "x-request-id"


def _extract_request_id(request: Request) -> str:
    header_value: str | None = request.headers.get(REQUEST_ID_HEADER)
    if header_value:
        return header_value
    return str(uuid.uuid4())


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Attach request-specific context to structlog throughout the handling pipeline."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = _extract_request_id(request)
        client_ip = request.client.host if request.client else "unknown"

        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            http_method=request.method,
            http_path=request.url.path,
            client_ip=client_ip,
        )

        # Expose request id downstream (responses, other middleware, routers)
        request.state.request_id = request_id

        try:
            response = await call_next(request)
            response.headers.setdefault("X-Request-ID", request_id)
            return response
        finally:
            structlog.contextvars.unbind_contextvars(
                "request_id",
                "http_method",
                "http_path",
                "client_ip",
            )
            with contextlib.suppress(KeyError):
                structlog.contextvars.unbind_contextvars(
                    "user_id",
                    "username",
                    "user_roles",
                )
