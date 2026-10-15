"""
Request Size Middleware - Increase body size limit for large audio files

This middleware increases the maximum request body size for specific endpoints
that need to handle large files (e.g., audio transcription via UGS).

Note: The actual limit is controlled by uvicorn's --limit-max-requests flag
and nginx's client_max_body_size. This middleware provides validation and logging.
"""

import logging
from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware  # type: ignore[import-untyped]
from starlette.requests import Request  # type: ignore[import-untyped]
from starlette.responses import JSONResponse, Response  # type: ignore[import-untyped]
from starlette.types import ASGIApp  # type: ignore[import-untyped]

logger = logging.getLogger(__name__)

# Maximum request body size: 100MB (for base64-encoded audio files)
# Base64 increases size by ~33%, so 100MB base64 = ~75MB original file
MAX_REQUEST_BODY_SIZE = 100 * 1024 * 1024  # 100MB

# Endpoints that need larger body size
LARGE_BODY_ENDPOINTS = [
    "/api/v1/ugs/generate",  # UGS generation (audio transcription)
    "/api/v1/voice-center/transcribe",  # Voice center transcription
    "/api/v1/audio/transcribe",  # Audio transcription
]


class RequestSizeMiddleware(BaseHTTPMiddleware):
    """
    Middleware to validate and log request body sizes for large file endpoints.

    FastAPI/Starlette has a default limit controlled by uvicorn.
    This middleware validates body size and provides better error messages.

    To increase the actual limit, configure:
    1. uvicorn: --limit-max-requests flag (or in code)
    2. nginx: client_max_body_size 100M;
    """

    def __init__(self, app: ASGIApp, max_body_size: int = MAX_REQUEST_BODY_SIZE):
        super().__init__(app)
        self.max_body_size = max_body_size

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        # Check if this endpoint needs larger body size
        path = request.url.path
        needs_large_body = any(path.startswith(endpoint) for endpoint in LARGE_BODY_ENDPOINTS)

        if needs_large_body:
            # Try to read Content-Length header
            content_length = request.headers.get("content-length")
            if content_length:
                try:
                    size = int(content_length)
                    if size > self.max_body_size:
                        logger.warning(
                            "Request body too large: %d bytes (max: %d bytes) for %s", size, self.max_body_size, path
                        )
                        return JSONResponse(
                            status_code=413,
                            content={
                                "detail": f"Request body too large ({size / (1024 * 1024):.1f}MB). "
                                f"Maximum size: {self.max_body_size / (1024 * 1024):.0f}MB. "
                                f"Please use a smaller audio file or compress it."
                            },
                        )
                except ValueError:
                    logger.debug("Invalid content-length header, allowing request to proceed")

        # Process request
        try:
            return await call_next(request)
        except Exception as e:
            # Catch 413 errors and provide better message
            error_str = str(e).lower()
            if "413" in error_str or "payload too large" in error_str or "request entity too large" in error_str:
                logger.warning("413 error for %s: %s", path, e)
                return JSONResponse(
                    status_code=413,
                    content={
                        "detail": f"Request body too large. Maximum size: {self.max_body_size / (1024 * 1024):.0f}MB. "
                        f"Please use a smaller audio file or compress it. "
                        f"If the file is already small, check nginx/client_max_body_size configuration."
                    },
                )
            raise
