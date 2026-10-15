"""
Monitoring Middleware for FastAPI
Automatically monitors HTTP requests with Prometheus metrics and structured logging
"""

import time
from collections.abc import Callable

from fastapi import Request, Response  # type: ignore[import-untyped]
from starlette.middleware.base import BaseHTTPMiddleware  # type: ignore[import-untyped]

from api.utils.monitoring import (
    http_500_errors_total,
    http_errors_total,
    http_request_duration_seconds,
    http_requests_total,
    log_http_request,
)

# HTTP status code constants
HTTP_STATUS_BAD_REQUEST = 400
HTTP_STATUS_INTERNAL_SERVER_ERROR = 500


class MonitoringMiddleware(BaseHTTPMiddleware):
    """
    Middleware for automatic HTTP request monitoring

    Tracks:
    - Request count by method, endpoint, status code
    - Request duration histograms
    - Error rates
    - 500 error alerts
    - Structured logging for all requests
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()

        # Extract request info
        method = request.method
        path = request.url.path

        # Skip monitoring for certain paths
        if path in ["/metrics", "/health", "/favicon.ico"] or path.startswith("/static/"):
            return await call_next(request)

        request_id = getattr(request.state, "request_id", None)

        try:
            # Process the request
            response = await call_next(request)
            duration = time.time() - start_time

            user_payload = getattr(request.state, "user", None)
            user_id = None
            username = None
            if isinstance(user_payload, dict):
                user_id = user_payload.get("id")
                username = user_payload.get("username") or user_payload.get("email")

            # Update Prometheus metrics
            http_requests_total.labels(method=method, endpoint=path, status_code=response.status_code).inc()

            http_request_duration_seconds.labels(
                method=method, endpoint=path, status_code=response.status_code
            ).observe(duration)

            # Update error metrics if it's an error
            if response.status_code >= HTTP_STATUS_BAD_REQUEST:
                http_errors_total.labels(
                    method=method,
                    endpoint=path,
                    status_code=response.status_code,
                    error_type="http_error",
                ).inc()

                if response.status_code >= HTTP_STATUS_INTERNAL_SERVER_ERROR:
                    http_500_errors_total.labels(method=method, endpoint=path, service="api").inc()

            # Log the request
            log_http_request(
                method,
                path,
                response.status_code,
                duration,
                user_id=user_id,
                request_id=request_id,
                username=username,
            )

        except Exception as e:
            duration = time.time() - start_time

            user_payload = getattr(request.state, "user", None)
            user_id = None
            username = None
            if isinstance(user_payload, dict):
                user_id = user_payload.get("id")
                username = user_payload.get("username") or user_payload.get("email")

            # Handle unhandled exceptions (500 errors)
            http_requests_total.labels(method=method, endpoint=path, status_code=500).inc()

            http_request_duration_seconds.labels(method=method, endpoint=path, status_code=500).observe(duration)

            http_errors_total.labels(method=method, endpoint=path, status_code=500, error_type=type(e).__name__).inc()

            http_500_errors_total.labels(method=method, endpoint=path, service="api").inc()

            # Log the error
            log_http_request(
                method,
                path,
                500,
                duration,
                user_id=user_id,
                request_id=request_id,
                username=username,
            )

            # Re-raise the exception (it will be handled by exception handlers)
            raise
        else:
            return response
