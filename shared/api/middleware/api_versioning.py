#!/usr/bin/env python3
"""
API Versioning Middleware - Redirect legacy URLs to v1
Created: 2025-10-16
Updated: 2025-10-26
Purpose: Backward compatibility for all API endpoints

Redirects:
- /api/content/* -> /api/v1/content/*
- And other legacy API paths

HTTP 307 (Temporary Redirect) preserves POST/PUT method and body
"""

import logging  # noqa: I001

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint  # type: ignore[import-untyped]
from starlette.requests import Request  # type: ignore[import-untyped]
from starlette.responses import RedirectResponse, Response  # type: ignore[import-untyped]

from api.services.site_studio_public_utils import is_site_studio_public_host

logger = logging.getLogger(__name__)

# Constants
HTTP_TEMPORARY_REDIRECT = 307
API_PREFIX_REPLACEMENT_COUNT = 1


class APIVersioningMiddleware(BaseHTTPMiddleware):
    """
    API Versioning Middleware

    Redirects legacy API paths to v1 for backward compatibility.
    Uses HTTP 307 (Temporary Redirect) to preserve method and request body.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if is_site_studio_public_host(request.headers.get("host")):
            return await call_next(request)

        path = request.url.path

        # Define API paths that need versioning
        versioned_paths = [
            "/api/content/",
            "/api/unified-content/",
            "/api/chat/",
            "/api/projects/",
            "/api/companies/",
            "/api/profile/",
            "/api/user/",
            "/api/themes/",
            "/api/ugs/",
            "/api/ai-business-generator/",
            "/api/tts/",
            "/api/audio-transcription/",
            "/api/bi/",
            "/api/elite-editor/",
            "/api/unified-editor/",
            "/api/doc-editor/",
            "/api/livekit/",
            "/api/ai-sdk/",
        ]

        # Legacy unified-content -> canonical content path (so one handler, no duplicate 401)
        if path.startswith("/api/unified-content/"):
            new_path = path.replace("/api/unified-content/", "/api/v1/content/", 1)
            query_string = str(request.url.query)
            new_url = new_path if not query_string else f"{new_path}?{query_string}"
            logger.info("API Versioning: %s -> %s", path, new_path)
            return RedirectResponse(url=new_url, status_code=HTTP_TEMPORARY_REDIRECT)

        # Check if path needs versioning
        for legacy_path in versioned_paths:
            if path.startswith(legacy_path):
                new_path = path.replace("/api/", "/api/v1/", API_PREFIX_REPLACEMENT_COUNT)

                # Preserve query string
                query_string = str(request.url.query)
                new_url = new_path if not query_string else f"{new_path}?{query_string}"

                logger.info("API Versioning: %s -> %s", path, new_path)

                # 307 Temporary Redirect preserves HTTP method and body
                return RedirectResponse(url=new_url, status_code=HTTP_TEMPORARY_REDIRECT)

        # Pass through all other requests
        return await call_next(request)
