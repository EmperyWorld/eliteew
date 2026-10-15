# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# HTTP/операционные метрики (Prometheus) и structlog для запросов; уровни логов по классам HTTP-статусов.
# Invariants:
# - 401 и ожидаемые «мягкие» ответы не зашумляют warning; 5xx кроме 502/503/504 — error.
# Related:
# - api/core/logging_config.py
# ---

"""Monitoring utilities: structured logging and Prometheus metrics for the API."""

import time
from collections.abc import Awaitable, Callable, Coroutine
from functools import wraps
from typing import Any, ParamSpec, TypeVar

import structlog  # type: ignore[import-not-found]

P = ParamSpec("P")
R = TypeVar("R")
from prometheus_client import Counter, Gauge, Histogram, generate_latest  # type: ignore[import-not-found]


# Configure structured logging
def setup_structured_logging() -> None:
    """Setup structured logging with JSON format"""
    shared_processors = [
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer(),
    ]

    structlog.configure(
        processors=shared_processors,  # type: ignore[arg-type]
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )


# Initialize structured logger
logger = structlog.get_logger(__name__)

# ============================================================================
# PROMETHEUS METRICS
# ============================================================================

# Use a custom registry to avoid conflicts
from prometheus_client import CollectorRegistry  # type: ignore[import-not-found]

monitoring_registry = CollectorRegistry()

# HTTP Request Metrics
http_requests_total = Counter(
    "http_requests_total",
    "Total number of HTTP requests",
    ["method", "endpoint", "status_code"],
    registry=monitoring_registry,
)

http_request_duration_seconds = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "endpoint", "status_code"],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0],
    registry=monitoring_registry,
)

# Error Metrics
http_errors_total = Counter(
    "http_errors_total",
    "Total number of HTTP errors",
    ["method", "endpoint", "status_code", "error_type"],
    registry=monitoring_registry,
)

# 500 Error specific metrics
http_500_errors_total = Counter(
    "http_500_errors_total",
    "Total number of HTTP 500 errors",
    ["method", "endpoint", "service"],
    registry=monitoring_registry,
)

# API Operation Metrics
api_operations_total = Counter(
    "api_operations_total",
    "Total number of API operations",
    ["operation", "service", "status"],
    registry=monitoring_registry,
)

api_operation_duration_seconds = Histogram(
    "api_operation_duration_seconds",
    "API operation duration in seconds",
    ["operation", "service"],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0],
    registry=monitoring_registry,
)

# Database Metrics
db_operations_total = Counter(
    "db_operations_total",
    "Total number of database operations",
    ["operation", "table", "status"],
    registry=monitoring_registry,
)

db_operation_duration_seconds = Histogram(
    "db_operation_duration_seconds",
    "Database operation duration in seconds",
    ["operation", "table"],
    buckets=[0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 2.0],
    registry=monitoring_registry,
)

# Cache Metrics
cache_operations_total = Counter(
    "cache_operations_total",
    "Total number of cache operations",
    ["operation", "cache_type", "status"],
    registry=monitoring_registry,
)

cache_hit_ratio = Gauge("cache_hit_ratio", "Cache hit ratio (0.0 to 1.0)", ["cache_type"], registry=monitoring_registry)

# Service Health Metrics
service_health_status = Gauge(
    "service_health_status",
    "Service health status (0=down, 1=healthy, 0.5=degraded)",
    ["service"],
    registry=monitoring_registry,
)

# ============================================================================
# STRUCTURED LOGGING FUNCTIONS
# ============================================================================


def log_error(error: Exception, context: dict[str, Any] | None = None, level: str = "error") -> None:
    """
    Log error with structured format and context

    Args:
        error: Exception object
        context: Additional context dictionary
        level: Log level (error, warning, info)
    """
    log_data = {
        "error_type": type(error).__name__,
        "error_message": str(error),
        "traceback": True,  # structlog will add full traceback
    }

    if context:
        log_data.update(context)

    getattr(logger, level)("Error occurred", **log_data)


def log_http_request(
    method: str,
    endpoint: str,
    status_code: int,
    duration: float,
    user_id: str | None = None,
    request_id: str | None = None,
    username: str | None = None,
) -> None:
    """
    Log HTTP request with structured format

    Args:
        method: HTTP method
        endpoint: API endpoint
        status_code: HTTP status code
        duration: Request duration in seconds
        user_id: User ID if available
        request_id: Request ID for tracing
        username: Preferred username or email (logged first when present)
    """
    log_data: dict[str, Any] = {
        "method": method,
        "endpoint": endpoint,
        "status_code": status_code,
        "duration_seconds": duration,
        "is_error": status_code >= 400,
    }

    if username:
        log_data = {"user": username, **log_data}

    if user_id is not None:
        log_data["user_id"] = user_id

    if request_id is not None:
        log_data["request_id"] = request_id

    endpoint_lower = endpoint.lower()
    is_content_thumbnail_404 = (
        status_code == 404 and endpoint_lower.startswith("/api/v1/content/") and endpoint_lower.endswith("/thumbnail")
    )

    if status_code >= 500:
        # 502/503/504 — чаще прокси/рантайм/сеть (Site Studio, внешние сервисы), не баг Python-стека
        if status_code in (502, 503, 504):
            logger.warning("HTTP upstream unavailable", **log_data)
        else:
            logger.error("HTTP server error", **log_data)
    elif status_code == 401:
        # 401 Unauthorized - expected behavior for unauthenticated requests, log as DEBUG
        logger.debug("HTTP 401 Unauthorized (expected)", **log_data)
    elif is_content_thumbnail_404:
        # Thumbnail may legitimately be absent right after upload or for unsupported formats.
        logger.debug("HTTP thumbnail not found (expected in some flows)", **log_data)
    elif status_code == 409:
        # Concurrency / double-submit (join room, idempotency) — не сигнал деградации сервиса.
        logger.debug("HTTP 409 conflict (expected in some flows)", **log_data)
    elif status_code == 412 and (
        endpoint_lower.rstrip("/").endswith("/desktop/shell-state") or "/desktop/shell-state" in endpoint_lower
    ):
        # ETag / multi-tab shell-state conflict — expected; ops scrapers must not treat as ERROR.
        log_data["is_error"] = False
        logger.debug("HTTP 412 shell-state conflict (expected)", **log_data)
    elif status_code >= 400:
        logger.warning("HTTP client error", **log_data)
    elif status_code == 304:
        # 304 — не редирект, а валидация кэша (If-None-Match / If-Modified-Since)
        logger.debug("HTTP not modified", **log_data)
    elif status_code >= 300:
        # Реальные редиректы (301, 302, 307, 308, …) — только на DEBUG
        logger.debug("HTTP redirect", **log_data)
    # Успешные запросы (2xx) - логируем только на DEBUG для обычных запросов
    # Исключение: не логируем служебные эндпоинты вообще
    elif endpoint not in ["/health", "/metrics", "/api/health", "/api/metrics", "/favicon.ico"]:
        logger.debug("HTTP request", **log_data)


def log_api_operation(
    operation: str,
    service: str,
    duration: float,
    status: str = "success",
    context: dict[str, Any] | None = None,
) -> None:
    """
    Log API operation with structured format

    Args:
        operation: Operation name
        service: Service name
        duration: Operation duration in seconds
        status: Operation status (success, error, timeout)
        context: Additional context
    """
    log_data = {
        "operation": operation,
        "service": service,
        "duration_seconds": duration,
        "status": status,
    }

    if context:
        log_data.update(context)

    if status == "error":
        logger.error("API operation failed", **log_data)
    else:
        logger.info("API operation completed", **log_data)


def log_database_operation(
    operation: str,
    table: str,
    duration: float,
    status: str = "success",
    row_count: int | None = None,
) -> None:
    """
    Log database operation with structured format

    Args:
        operation: DB operation (select, insert, update, delete)
        table: Table name
        duration: Operation duration in seconds
        status: Operation status
        row_count: Number of affected rows
    """
    log_data = {
        "operation": operation,
        "table": table,
        "duration_seconds": duration,
        "status": status,
    }

    if row_count is not None:
        log_data["row_count"] = row_count

    if status == "error":
        logger.error("Database operation failed", **log_data)
    else:
        logger.debug("Database operation", **log_data)


# ============================================================================
# DECORATORS FOR AUTOMATIC MONITORING
# ============================================================================


def monitor_http_endpoint(
    method: str | None = None, endpoint: str | None = None
) -> Callable[[Callable[P, Awaitable[R]]], Callable[P, Coroutine[Any, Any, R]]]:
    """
    Decorator to monitor HTTP endpoints with Prometheus metrics and logging

    Usage:
        @monitor_http_endpoint()
        async def my_endpoint():
            pass
    """

    def decorator(func: Callable[P, Awaitable[R]]) -> Callable[P, Coroutine[Any, Any, R]]:
        @wraps(func)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            start_time = time.time()

            # Extract method and endpoint from function name if not provided
            func_method = method or "GET"
            func_endpoint = endpoint or f"/{func.__name__}"

            try:
                result = await func(*args, **kwargs)
                duration = time.time() - start_time

                # Assume 200 status if no exception
                status_code = getattr(result, "status_code", 200) if hasattr(result, "status_code") else 200

                # Update Prometheus metrics
                http_requests_total.labels(method=func_method, endpoint=func_endpoint, status_code=status_code).inc()

                http_request_duration_seconds.labels(
                    method=func_method, endpoint=func_endpoint, status_code=status_code
                ).observe(duration)

                # Log the request
                log_http_request(func_method, func_endpoint, status_code, duration)

                return result

            except Exception as e:
                duration = time.time() - start_time
                status_code = 500

                # Update error metrics
                http_requests_total.labels(method=func_method, endpoint=func_endpoint, status_code=status_code).inc()

                http_request_duration_seconds.labels(
                    method=func_method, endpoint=func_endpoint, status_code=status_code
                ).observe(duration)

                http_errors_total.labels(
                    method=func_method,
                    endpoint=func_endpoint,
                    status_code=status_code,
                    error_type=type(e).__name__,
                ).inc()

                http_500_errors_total.labels(method=func_method, endpoint=func_endpoint, service="api").inc()

                # Log the error
                log_error(
                    e,
                    {
                        "method": func_method,
                        "endpoint": func_endpoint,
                        "duration_seconds": duration,
                    },
                )

                raise

        return wrapper

    return decorator


def monitor_api_operation(
    operation: str, service: str = "api"
) -> Callable[[Callable[P, Awaitable[R]]], Callable[P, Coroutine[Any, Any, R]]]:
    """
    Decorator to monitor API operations

    Usage:
        @monitor_api_operation("create_user")
        async def create_user():
            pass
    """

    def decorator(func: Callable[P, Awaitable[R]]) -> Callable[P, Coroutine[Any, Any, R]]:
        @wraps(func)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            start_time = time.time()

            try:
                result = await func(*args, **kwargs)
                duration = time.time() - start_time

                # Update metrics
                api_operations_total.labels(operation=operation, service=service, status="success").inc()

                api_operation_duration_seconds.labels(operation=operation, service=service).observe(duration)

                # Log operation
                log_api_operation(operation, service, duration, "success")

                return result

            except Exception as e:
                duration = time.time() - start_time

                # Update error metrics
                api_operations_total.labels(operation=operation, service=service, status="error").inc()

                # Log error
                log_api_operation(
                    operation,
                    service,
                    duration,
                    "error",
                    {"error_type": type(e).__name__, "error_message": str(e)},
                )

                raise

        return wrapper

    return decorator


def monitor_db_operation(
    operation: str, table: str
) -> Callable[[Callable[P, Awaitable[R]]], Callable[P, Coroutine[Any, Any, R]]]:
    """
    Decorator to monitor database operations

    Usage:
        @monitor_db_operation("select", "users")
        async def get_users():
            pass
    """

    def decorator(func: Callable[P, Awaitable[R]]) -> Callable[P, Coroutine[Any, Any, R]]:
        @wraps(func)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            start_time = time.time()

            try:
                result = await func(*args, **kwargs)
                duration = time.time() - start_time

                # Update metrics
                db_operations_total.labels(operation=operation, table=table, status="success").inc()

                db_operation_duration_seconds.labels(operation=operation, table=table).observe(duration)

                # Log operation
                log_database_operation(operation, table, duration, "success")

                return result

            except Exception:
                duration = time.time() - start_time

                # Update error metrics
                db_operations_total.labels(operation=operation, table=table, status="error").inc()

                # Log error
                log_database_operation(operation, table, duration, "error")

                raise

        return wrapper

    return decorator


# ============================================================================
# METRICS EXPORT FUNCTIONS
# ============================================================================


async def refresh_prometheus_metrics_overlays() -> None:
    """Refresh async overlays that must be visible in the next Prometheus scrape."""

    try:
        from api.monitoring.metrics import refresh_ewa_ops_observability_from_redis_async

        await refresh_ewa_ops_observability_from_redis_async()
    except Exception as exc:  # noqa: BLE001 — scrape overlays are best-effort
        logger.debug("Prometheus async overlay refresh skipped: %s", exc, exc_info=True)


def get_prometheus_metrics(*, refresh_ewa_ops: bool = True) -> str:
    """
    Get all Prometheus metrics in text format for /metrics endpoint.
    Includes infrastructure health from DatabaseManager when initialized.
    """
    if refresh_ewa_ops:
        try:
            from api.monitoring.metrics import refresh_ewa_ops_observability_from_redis

            refresh_ewa_ops_observability_from_redis()
        except Exception as exc:  # noqa: BLE001 — EWA ops overlay is optional for /metrics scrape
            logger.debug("Prometheus EWA ops overlay skipped: %s", exc, exc_info=True)
    try:
        from api.core.database_manager import db_manager

        if db_manager.is_initialized:
            summary = db_manager.get_health_summary()
            for name, detail in summary.get("databases", {}).items():
                status = detail.get("status", "down")
                val = 1.0 if status == "healthy" else (0.5 if status == "degraded" else 0.0)
                service_health_status.labels(service=name).set(val)
    except Exception as exc:  # noqa: BLE001 — DB health overlay is optional for /metrics scrape
        logger.debug("Prometheus DB health overlay skipped: %s", exc, exc_info=True)
    return generate_latest(monitoring_registry).decode("utf-8")


def get_monitoring_stats() -> dict[str, Any]:
    """
    Get comprehensive monitoring statistics

    Returns:
        (dict[str, Any])ionary with monitoring stats
    """
    return {
        "prometheus_metrics": get_prometheus_metrics(),
        "structured_logging": {"enabled": True, "format": "json"},
        "monitored_endpoints": {
            "http_requests": len(http_requests_total._metrics),
            "api_operations": len(api_operations_total._metrics),
            "db_operations": len(db_operations_total._metrics),
        },
        "error_rates": {
            "http_500_errors": http_500_errors_total._value,
            "total_http_errors": http_errors_total._value,
        },
    }


# ============================================================================
# ALERTING FUNCTIONS
# ============================================================================


def check_500_error_rate() -> dict[str, Any]:
    """
    Check 500 error rate and return alert status

    Returns:
        Alert information if threshold exceeded
    """
    # Get sample values from metrics (simplified approach)
    # In production, you might want to use a time window
    total_500_errors = sum(
        metric._value.get() if hasattr(metric._value, "get") else metric._value
        for metric in http_500_errors_total._metrics.values()
    )  # type: ignore[attr-defined]
    total_requests = sum(
        metric._value.get() if hasattr(metric._value, "get") else metric._value
        for metric in http_requests_total._metrics.values()
    )  # type: ignore[attr-defined]

    if total_requests == 0:
        return {"status": "ok", "error_rate": 0.0}

    error_rate = float(total_500_errors) / float(total_requests)

    if error_rate > 0.05:  # 5% threshold
        return {
            "status": "critical",
            "error_rate": error_rate,
            "total_500_errors": int(total_500_errors),
            "total_requests": int(total_requests),
            "message": f"High 500 error rate: {error_rate:.2%}",
        }
    if error_rate > 0.01:  # 1% threshold
        return {
            "status": "warning",
            "error_rate": error_rate,
            "total_500_errors": int(total_500_errors),
            "total_requests": int(total_requests),
            "message": f"Elevated 500 error rate: {error_rate:.2%}",
        }

    return {"status": "ok", "error_rate": error_rate}


# ============================================================================
# INITIALIZATION
# ============================================================================


def init_monitoring() -> None:
    """Initialize monitoring system"""
    setup_structured_logging()
    logger.info("Monitoring system initialized", service="api")


# Call initialization
init_monitoring()
