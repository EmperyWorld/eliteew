"""
Prevent browser / intermediate proxies from caching product-desktop JSON.

Complements ResponseCacheMiddleware exclusion for `/api/v1/product-desktop/`:
even with Redis bypass, a client could still reuse a stale GET without `no-store`.
"""

from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

_PRODUCT_DESKTOP_PREFIX = "/api/v1/product-desktop"


class ProductDesktopNoStoreMiddleware(BaseHTTPMiddleware):
    """Set Cache-Control on responses under the product-desktop API mount."""

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        response = await call_next(request)
        path = request.url.path
        if path == _PRODUCT_DESKTOP_PREFIX or path.startswith(f"{_PRODUCT_DESKTOP_PREFIX}/"):
            response.headers["Cache-Control"] = "private, no-store"
            response.headers["Pragma"] = "no-cache"
        return response
