#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Bootstrap the EliteEW FastAPI application, middleware, lifecycle, Socket.IO wrapper, domain routers and maintenance UX gate.
# Invariants:
# - Domain registration order must keep auth and public gateways available before feature routers.
# - Startup must use shared infrastructure managers, not feature-local pools (except optional EWA orchestration pool from ``EWA_DATABASE_URL``).
# - When enabled, Site Studio worker readiness is a startup invariant, not a late runtime surprise.
# - Aggregate ``/api/health`` merges DatabaseManager summary with the EWA Postgres snapshot (``ewa_postgres``)
#   and Celery beat honesty slice (``celery_beat`` — Trust T5 / V-H2; does not invent beat HA).
# - Unauthenticated ``/api/health`` returns ``{"ok": bool}`` only; full topology requires admin JWT.
# Related:
# - api/domains/__init__.py
# - api/services/site_studio_lifecycle_jobs.py
# - api/ewa_platform/desktop/ewa_health_snapshot.py (``/api/health`` EWA Postgres slice)
# - api/monitoring/metrics.py (``build_celery_beat_health_slice``)
# - api/monitoring/api_health_public.py
# - documentation/platform/docker-re_doc/STACK0-API-STARTUP.md
# - documentation/platform/USER-SAFE-RESTARTS-AND-MAINTENANCE.md
# - documentation/platform/FRONTEND-SECURITY-NGINX-STATIC.md
# ---
"""
EliteEW API v4.0 - Production Ready

Refactored main.py with:
- Extracted startup functions (api/core/startup.py)
- Extracted system metrics (api/utils/system_metrics.py)
- Removed dead code (Auth Portal routes, inline utilities)
- Removed commented middleware
- Fixed encoding issues
- Cleaned up duplicate health checks

"""

# ============================================================================
# DISABLE PYTHON BYTECODE CACHE (.pyc files)
# ============================================================================
import asyncio
import json
import logging
import os

# Disable .pyc file creation (if not set via environment variable)
os.environ.setdefault("PYTHONDONTWRITEBYTECODE", "1")  # cSpell:ignore PYTHONDONTWRITEBYTECODE

# Suppress warnings from third-party libraries
import sys
import traceback
import warnings
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as pkg_version
from typing import Any

import socketio  # type: ignore[import-untyped,import-not-found]
import structlog  # type: ignore[import-not-found]

# Imports block - complex structure prevents automatic sorting
# isort: off
# NOTE: FastAPI is installed in venv, but linter doesn't see it due to configuration
# This is a linter configuration error, not a code error - module is available at runtime
from fastapi import FastAPI, HTTPException, Request, Response  # type: ignore[reportMissingImports,import-untyped]  # pyright: ignore[reportMissingImports]
from fastapi.exceptions import RequestValidationError  # type: ignore[reportMissingImports,import-untyped]  # pyright: ignore[reportMissingImports]
from fastapi.middleware.cors import CORSMiddleware  # type: ignore[reportMissingImports,import-untyped]  # pyright: ignore[reportMissingImports]
from fastapi.middleware.trustedhost import TrustedHostMiddleware  # type: ignore[reportMissingImports,import-untyped]  # pyright: ignore[reportMissingImports]
from fastapi.responses import JSONResponse  # type: ignore[import-untyped]  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]

# NOTE: Module exists, but linter doesn't see it due to Python path configuration
# This is a linter configuration error, not a code error - module is available at runtime
from api.core.auth_errors import (
    AUTH_ACTION_LOGIN,
    AUTH_REASON_FORBIDDEN,
    AUTH_REASON_INVALID_TOKEN,
    build_auth_error_body,
)
from api.core.database_manager import DatabaseConnectionError, get_database_manager  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
from api.ewa_platform.desktop.ewa_health_snapshot import (  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
    build_ewa_postgres_health_payload,
    merge_api_overall_status_with_celery_beat,
    merge_api_overall_status_with_ewa,
)
from api.core.service_unavailable import (
    is_auth_provider_or_config_error as _is_auth_provider_or_config_error,
    is_db_connection_error as _is_db_connection_error,
    is_db_schema_migration_required_error as _is_db_schema_migration_required_error,
    is_elasticsearch_or_storage_error as _is_elasticsearch_or_storage_error,
    is_service_unavailable_error as _is_service_unavailable_error,
)
from api.core.cors_origins import (
    DESKTOP_CLIENT_CORS_ORIGIN_REGEX,
    resolve_cors_origins,
)
from api.core.http_clients import init_http_clients  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
from api.core.logging_config import (
    align_foreign_stderr_logging,
    bind_global_context,
    configure_logging,
    pulse_align_stderr_handlers,
)  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
from api.utils.log_redaction import ensure_redact_filter_on_all_handlers  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
from api.utils.log_user_color import ensure_user_color_filter_on_stderr_handlers  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
from api.core.startup import (  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
    init_cache_version_manager,
    init_cache_warming,
    init_rabbitmq_queues,
    init_unified_audio_service,
    init_whisper_model_preload,
    shutdown_http_sessions,
    shutdown_monitoring,
)
from api.core.unified_config import unified_settings  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
from api.domains import (  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
    register_domain_auth,
    register_domain_bi_ugs,
    register_domain_chat,
    register_domain_content,
    register_domain_creative,
    register_domain_desktop,
    register_domain_desktop_client,
    register_domain_marketing,
    register_domain_misc,
    register_domain_professional_worlds,
    register_domain_site_studio_public_gateway,
    register_domain_social,
    register_domain_voice,
)
from api.middleware.api_versioning import APIVersioningMiddleware  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
from api.middleware.monitoring import MonitoringMiddleware  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
from api.middleware.client_build_gate import ClientBuildGateMiddleware  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
from api.middleware.maintenance_gate import MaintenanceGateMiddleware  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
from api.middleware.oauth2_protection import OAuth2ProtectionMiddleware  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
from api.middleware.rate_limiter import setup_rate_limiter  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
from api.middleware.request_context import RequestContextMiddleware  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
from api.middleware.request_size_middleware import RequestSizeMiddleware  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
from api.middleware.product_desktop_no_store import (  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
    ProductDesktopNoStoreMiddleware,
)
from api.middleware.response_cache import ResponseCacheMiddleware  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
from api.middleware.voice_deprecation import VoiceDeprecationMiddleware  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
from api.utils.monitoring import (  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
    get_prometheus_metrics,
    log_error,
    refresh_prometheus_metrics_overlays,
)
# isort: on

warnings.filterwarnings("ignore", category=FutureWarning, module="transformers")  # torch._pytree deprecation
warnings.filterwarnings(
    "ignore",
    message=".*Field.*model_file.*conflict with protected namespace.*",
    category=UserWarning,
)  # pydantic model_ namespace
warnings.filterwarnings(
    "ignore", message=".*pynvml package is deprecated.*", category=FutureWarning
)  # PyTorch pynvml deprecation warning

# Optional imports
try:
    import redis.asyncio as redis  # type: ignore[import-untyped]
except ImportError:
    redis = None  # type: ignore[assignment]

# OpenTelemetry: disabled (re-enable by wiring setup_telemetry + exporters)
setup_telemetry = None  # type: ignore[assignment]
TELEMETRY_AVAILABLE = False  # type: ignore[assignment]

# Logger
configure_logging()
bind_global_context(
    service="eliteew-api",  # cSpell:ignore eliteew
    environment="development" if unified_settings.debug else "production",
    version=unified_settings.app_version,
)
logger = structlog.get_logger("eliteew.api")  # cSpell:ignore eliteew
runtime_marker_logger = logging.getLogger("uvicorn.error")


# ============================================================================
# VERSION CHECK FUNCTION
# ============================================================================
# Constants for version checking. Docker/CI image for API must use Python 3.14.
EXPECTED_PYTHON_MAJOR = 3
EXPECTED_PYTHON_MINOR = 14

# Minimum versions aligned with docker/builders/stack0-api/requirements/base.in floors.
_CRITICAL_PACKAGE_MINIMUMS: dict[str, str] = {
    "fastapi": "0.135.0",
    "pydantic": "2.12.5",
    "sqlalchemy": "2.0.48",
    "uvicorn": "0.42.0",
}


def _parse_version_tuple(v: str) -> tuple[int, ...]:
    parts: list[int] = []
    for part in v.split("."):
        digits = ""
        for ch in part:
            if ch.isdigit():
                digits += ch
            else:
                break
        parts.append(int(digits) if digits else 0)
    return tuple(parts) if parts else (0,)


def _meets_minimum(actual: str, minimum: str) -> bool:
    try:
        return _parse_version_tuple(actual) >= _parse_version_tuple(minimum)
    except (TypeError, ValueError):  # fmt: skip
        return False


def _installed_package_version(package_name: str) -> str | None:
    try:
        return pkg_version(package_name)
    except PackageNotFoundError:
        pass
    try:
        mod = __import__(package_name)
        ver = getattr(mod, "__version__", None)
        return str(ver) if ver is not None else None
    except ImportError:
        return None


def check_critical_versions() -> None:
    """Log Python version; warn if critical packages are below policy minimums (requirements floors)."""
    python_version = sys.version_info
    if python_version.major != EXPECTED_PYTHON_MAJOR or python_version.minor != EXPECTED_PYTHON_MINOR:
        logger.warning(
            "Python version mismatch: expected 3.14, got %s.%s",
            python_version.major,
            python_version.minor,
            extra={
                "python_version": f"{python_version.major}.{python_version.minor}.{python_version.micro}",
            },
        )
    else:
        logger.info(
            "Python version: %s.%s.%s",
            python_version.major,
            python_version.minor,
            python_version.micro,
        )

    for package_name, minimum in _CRITICAL_PACKAGE_MINIMUMS.items():
        actual = _installed_package_version(package_name)
        if actual is None:
            logger.warning("Critical package %s not installed or version unknown", package_name)
            continue
        if _meets_minimum(actual, minimum):
            logger.debug("%s: %s (>= %s)", package_name, actual, minimum)
        else:
            logger.warning(
                "Package %s below policy minimum: need >=%s, got %s",
                package_name,
                minimum,
                actual,
                extra={"package": package_name, "minimum": minimum, "actual": actual},
            )


def _parse_allowed_hosts(raw: str | None) -> list[str]:
    values = [host.strip() for host in (raw or "").split(",") if host.strip()]
    return values or ["*"]


# Router registration utility

# ============================================================================
# LIFESPAN - SIMPLIFIED USING STARTUP FUNCTIONS
# ============================================================================


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    """
    Lifecycle manager for the application.

    Simplified by extracting init/shutdown functions to api/core/startup.py
    """
    # Startup

    # Uvicorn may register access-log handlers after configure_logging; attach token redaction to any new handlers
    align_foreign_stderr_logging()
    ensure_redact_filter_on_all_handlers()
    ensure_user_color_filter_on_stderr_handlers()

    from api.utils.asyncio_logging import install_asyncio_exception_handler

    install_asyncio_exception_handler()

    asyncio.create_task(pulse_align_stderr_handlers())

    # Check critical dependencies versions
    check_critical_versions()

    # Initialize core infrastructure via DatabaseManager (single owner of DB/Redis/ES/S3/RabbitMQ)
    db_manager = await get_database_manager()
    try:
        # Backward-compatible aliases for legacy code still using app.state.db_pool / redis_client.
        # These reference the same underlying connections managed by DatabaseManager.
        app.state.db_pool = await db_manager.get_asyncpg_pool()
    except DatabaseConnectionError:
        app.state.db_pool = None

    try:
        app.state.redis_client = await db_manager.get_redis_client()
    except DatabaseConnectionError:
        app.state.redis_client = None

    if os.getenv("ELITEEW_REQUIRE_DB_AT_STARTUP", "").lower() in ("1", "true", "yes") and app.state.db_pool is None:
        raise RuntimeError("PostgreSQL pool required at startup (ELITEEW_REQUIRE_DB_AT_STARTUP)")
    if (
        os.getenv("ELITEEW_REQUIRE_REDIS_AT_STARTUP", "").lower() in ("1", "true", "yes")
        and app.state.redis_client is None
    ):
        raise RuntimeError("Redis client required at startup (ELITEEW_REQUIRE_REDIS_AT_STARTUP)")

    from api.services.site_studio_lifecycle_jobs import (
        site_studio_startup_preflight_required,
        wait_for_site_studio_worker_ready_at_startup,
    )

    if site_studio_startup_preflight_required():
        if app.state.db_pool is None:
            message = (
                "Site Studio startup preflight failed: PostgreSQL pool is unavailable, "
                "so worker heartbeat cannot be verified."
            )
            logger.critical(message)
            raise RuntimeError(message)
        try:
            async with db_manager.get_postgres_session() as session:
                readiness = await wait_for_site_studio_worker_ready_at_startup(session)
        except Exception as exc:
            logger.critical("Site Studio startup preflight failed; aborting API startup", error=str(exc), exc_info=True)
            raise
        logger.info("Site Studio startup preflight passed", **(readiness or {}))

    if app.state.db_pool is not None:
        from api.services.imc.generation_type_provider_invariant import log_or_raise_imc_provider_invariant

        await log_or_raise_imc_provider_invariant(app.state.db_pool)

    # Drop orphaned stack0-release maintenance windows left in active/recovering (never admin windows).
    if app.state.redis_client is not None:
        try:
            from api.services.maintenance_service import get_maintenance_service

            clear_result = await get_maintenance_service().clear_stale_deploy_window_after_api_start()
            if clear_result == "cleared":
                logger.info("maintenance_deploy_orphan_cleared_on_startup result=%s", clear_result)
                try:
                    from api.routers.socketio_handler import emit_system_maintenance
                    from api.services.maintenance_service import maintenance_status_payload

                    await emit_system_maintenance(maintenance_status_payload(None))
                except Exception as emit_exc:  # noqa: BLE001
                    logger.debug(
                        "maintenance_deploy_orphan_emit_skipped error=%s",
                        emit_exc,
                    )
            else:
                logger.debug("maintenance_deploy_orphan_skip result=%s", clear_result)
        except Exception as maint_exc:  # noqa: BLE001 — startup must not fail on maintenance hygiene
            logger.warning("maintenance_deploy_orphan_clear_failed error=%s", maint_exc)

    # Initialize all remaining services using extracted functions
    await init_cache_version_manager()  # Version check and auto-invalidation of cache on deploy
    await init_unified_audio_service(app)  # Unified TTS providers
    await init_http_clients()  # Central aiohttp/httpx clients (prevents session leaks)
    from api.ewa_platform.desktop.pool import init_ewa_orchestration_pool_if_configured  # noqa: PLC0415

    await init_ewa_orchestration_pool_if_configured(app)
    await init_cache_warming()
    await init_whisper_model_preload()  # Preload Whisper model to speed up transcription
    await init_rabbitmq_queues()  # Declare RabbitMQ queues (UGS, documents, notifications)

    yield

    # Shutdown

    from api.ewa_platform.desktop.pool import close_ewa_orchestration_pool  # noqa: PLC0415

    await close_ewa_orchestration_pool(app)

    # Graceful shutdown using centralized DatabaseManager
    await shutdown_monitoring(app)
    try:
        db_manager = await get_database_manager()
        await db_manager.close_all_connections()
    except DatabaseConnectionError:
        # If infrastructure was not initialized or already failed, proceed with shutdown.
        pass
    await shutdown_http_sessions(app)


# ============================================================================
# FASTAPI APP INITIALIZATION
# ============================================================================

app = FastAPI(
    title=unified_settings.app_name,
    description="Production-ready unified microservices API orchestrating AI services",
    version=unified_settings.app_version,
    docs_url="/api/docs",
    redoc_url="/api/redoc",  # cSpell:ignore redoc
    lifespan=lifespan,
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=_parse_allowed_hosts(unified_settings.allowed_hosts),
)

# ============================================================================
# CORS MIDDLEWARE — CORS_ORIGINS=csv; optional built-in list if CORS_USE_DEFAULT_ORIGINS=true.
# Native Tauri desktop-client WebView origins are always merged (see api.core.cors_origins).
# ============================================================================
cors_origins = resolve_cors_origins()
if not cors_origins:
    logger.warning("CORS: empty allow_origins (set CORS_ORIGINS or CORS_USE_DEFAULT_ORIGINS=true)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=DESKTOP_CLIENT_CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# ============================================================================
# MIDDLEWARE STACK
# ============================================================================

# Request size middleware - increase body size limit for large audio files
app.add_middleware(RequestSizeMiddleware)

# Request context middleware - binds request id / client data into logs
app.add_middleware(RequestContextMiddleware)

# API Versioning Middleware - redirect legacy URLs
# IMPORTANT: Must be added BEFORE OAuth2ProtectionMiddleware to handle redirects first
app.add_middleware(APIVersioningMiddleware)

# Response Cache Middleware - MUST run AFTER OAuth2 so cache key includes user_id
# (Added before OAuth2 in stack so it runs after OAuth2 when request is processed)
app.add_middleware(ResponseCacheMiddleware)

# OAuth2 Protection Middleware - API endpoints protection (OAuth2 Proxy + Bearer tokens)
app.add_middleware(OAuth2ProtectionMiddleware)

# Rate Limiting - DDoS and abuse protection
setup_rate_limiter(app)

# Monitoring Middleware - add after authentication
app.add_middleware(MonitoringMiddleware)

# Voice deprecation shim - add X-Deprecation / X-Replacement-Endpoint for legacy voice routes
app.add_middleware(VoiceDeprecationMiddleware)

# Product desktop JSON: forbid browser/CDN caching of GET (EWDesk, feedback, assistant)
app.add_middleware(ProductDesktopNoStoreMiddleware)

# Stale SPA gate — outermost: reject outdated web bundle before auth work on /api/*
app.add_middleware(ClientBuildGateMiddleware)

# Planned maintenance gate — outermost user-safe 503 before auth/cache do extra work.
app.add_middleware(MaintenanceGateMiddleware)


# ============================================================================
# ROUTERS - REGISTERED VIA DOMAIN MODULES (api/domains/)
# ============================================================================

register_domain_site_studio_public_gateway(app)
register_domain_auth(app)
register_domain_creative(app)
register_domain_chat(app)
register_domain_social(app)
register_domain_content(app)
register_domain_voice(app)
register_domain_bi_ugs(app)
register_domain_desktop(app)
register_domain_desktop_client(app)
register_domain_professional_worlds(app)
register_domain_marketing(app)
register_domain_misc(app)

from api.routers.system_maintenance import admin_router as system_maintenance_admin_router  # noqa: E402
from api.routers.system_maintenance import public_router as system_maintenance_public_router  # noqa: E402

app.include_router(system_maintenance_public_router)
app.include_router(system_maintenance_admin_router)

# OpenAPI: mark legacy paths (under /api/ but not /api/v1/) as deprecated
_LEGACY_DEPRECATION_MSG = " Use /api/v1/... instead. Legacy path will be removed after 2026-06-01."
_original_openapi = app.openapi


def _openapi_with_deprecation() -> dict[str, Any]:
    schema = _original_openapi()
    paths = schema.get("paths") or {}
    for path, path_item in paths.items():
        if not isinstance(path_item, dict):
            continue
        if path.startswith("/api/") and not path.startswith("/api/v1/"):
            for method in ("get", "post", "put", "patch", "delete", "head", "options"):
                op = path_item.get(method)
                if isinstance(op, dict):
                    op["deprecated"] = True
                    op["description"] = (op.get("description") or "").rstrip() + _LEGACY_DEPRECATION_MSG
    return schema


app.openapi = _openapi_with_deprecation

# ============================================================================
# ROOT & HEALTH ENDPOINTS
# ============================================================================


@app.get("/")
async def root() -> dict[str, Any]:
    """API Root endpoint with ecosystem status"""
    return {
        "message": "EliteEW API v4.0 - Production Ready",
        "description": f"Unified microservices orchestration - {len(unified_settings.get_all_services())} services across 6 stacks",
        "docs": "/api/docs",
        "version": unified_settings.app_version,
        "ecosystem": {
            "total_services": len(unified_settings.get_all_services()),
            "enabled_services": len(unified_settings.get_enabled_services()),
            "gpu_services": len(unified_settings.get_gpu_services()),  # type: ignore[arg-type]
            "network": unified_settings.docker_network,
        },
    }


@app.get("/health")
async def health_check() -> dict[str, Any]:
    """Primary health check endpoint - use this for monitoring"""
    return {
        "status": "healthy",
        "message": "Production ready",
        "timestamp": datetime.now(UTC).isoformat(),
        "version": unified_settings.app_version,
    }


@app.get("/api/version")
async def api_version() -> dict[str, Any]:
    """Public version metadata for SPA diagnostics (no environment / host clock)."""
    from api.services.client_build_service import get_server_app_build_id

    return {
        "version": unified_settings.app_version,
        "buildHash": os.environ.get("BUILD_HASH") or os.environ.get("GIT_COMMIT") or "unknown",
        "appBuildId": get_server_app_build_id(),
    }


async def _api_health_payload(request: Request) -> dict[str, Any]:
    """Shared body for /api/health and versioned aliases (OpenAPI / FE contract).

    Public (no/invalid/non-admin Bearer): ``{"ok": bool}`` only.
    Admin JWT: full topology for Desktop/Admin monitoring.
    """
    from api.monitoring.api_health_public import (
        admin_authorized_for_health_detail,
        public_api_health_view,
    )
    from api.monitoring.metrics import build_celery_beat_health_slice

    try:
        db_manager = await get_database_manager()
        summary = db_manager.get_health_summary()
    except Exception as e:
        ewa = await build_ewa_postgres_health_payload(request.app)
        celery_beat = await build_celery_beat_health_slice()
        full = {
            "status": "unhealthy",
            "message": str(e),
            "api_version": unified_settings.app_version,
            "timestamp": datetime.now(UTC).isoformat(),
            "services": {},
            "ecosystem_services": len(unified_settings.get_enabled_services()),
            "ewa_postgres": ewa,
            "celery_beat": celery_beat,
        }
        if await admin_authorized_for_health_detail(request):
            return full
        return public_api_health_view(full)

    services: dict[str, str] = {}
    for name, detail in summary.get("databases", {}).items():
        if isinstance(detail, dict):
            services[name] = detail.get("status", "unknown")
        else:
            services[name] = "unknown"

    ewa = await build_ewa_postgres_health_payload(request.app)
    if ewa.get("configured"):
        services["ewa_postgres"] = str(ewa.get("status", "unknown"))

    celery_beat = await build_celery_beat_health_slice()
    services["celery_beat"] = str(celery_beat.get("status", "unknown"))

    overall = str(summary.get("overall_status", "unknown"))
    overall = merge_api_overall_status_with_ewa(overall, str(ewa.get("status", "")))
    overall = merge_api_overall_status_with_celery_beat(overall, str(celery_beat.get("status", "")))

    full = {
        "status": overall,
        "message": "Production ready",
        "api_version": unified_settings.app_version,
        "timestamp": summary.get("timestamp", datetime.now(UTC).isoformat()),
        "services": services,
        "ecosystem_services": len(unified_settings.get_enabled_services()),
        "ewa_postgres": ewa,
        "celery_beat": celery_beat,
    }
    if await admin_authorized_for_health_detail(request):
        return full
    return public_api_health_view(full)


@app.get("/api/health")
async def api_health_check(request: Request) -> dict[str, Any]:
    """API health: single source of truth via DatabaseManager.get_health_summary()."""
    return await _api_health_payload(request)


@app.get("/api/v1/health")
async def api_v1_health_check(request: Request) -> dict[str, Any]:
    """Versioned alias for /api/health (FE-BE gap / OpenAPI)."""
    return await _api_health_payload(request)


@app.get("/api/v1/system-info")
async def api_v1_system_info(request: Request) -> dict[str, Any]:
    """EliteEW ecosystem health summary (not SD WebUI); same payload as /api/health."""
    return await _api_health_payload(request)


@app.get("/api/v1/ping")
async def api_v1_ping() -> dict[str, Any]:
    """Lightweight liveness for clients and tests expecting /api/v1/ping."""
    return {"status": "ok", "timestamp": datetime.now(UTC).isoformat()}


@app.get("/metrics")
async def prometheus_metrics() -> Response:
    """Prometheus metrics endpoint"""
    await refresh_prometheus_metrics_overlays()
    return Response(
        content=get_prometheus_metrics(refresh_ewa_ops=False),
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )


@app.post("/api/monitoring/logs")
@app.post("/api/v1/monitoring/logs")
async def ingest_client_logs(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Ingest client-side log entries from ServiceLogger (frontend).
    Accepts log entries and returns 200. Optionally logs server-side for debugging.
    """
    runtime_marker_logger.warning(
        "Client monitoring raw payload: %s",
        json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str),
    )
    level_raw = payload.get("level", "info")
    level = str(level_raw).lower()
    service_name = str(payload.get("serviceName", "unknown"))
    message = str(payload.get("message", ""))
    if level in ("error", "critical"):
        if service_name == "StaleBundleReload" and message == "RELOAD_MARKER":
            marker_line = (
                "Client log: "
                f"{service_name} :: {message} "
                f"stage={payload.get('stage', '')} "
                f"reason={payload.get('reason', '')} "
                f"client_build={payload.get('clientBuildId', '')} "
                f"server_build={payload.get('serverBuildId', '')} "
                f"maintenance_active={payload.get('maintenanceActive', '')} "
                f"reload_hold={payload.get('reloadHoldActive', '')}"
            )
            logger.warning(marker_line, extra={"payload": payload})
            runtime_marker_logger.warning(marker_line)
        else:
            logger.warning(
                "Client log: %s :: %s",
                service_name,
                message,
                extra={"payload": payload},
            )
    return {"ok": True, "received": True}


# ============================================================================
# SERVICE-SPECIFIC ENDPOINTS (Real implementations using services)
# ============================================================================


@app.get("/api/database/health")
async def database_health(request: Request) -> dict[str, Any]:
    """Database health check with real connection test"""
    try:
        db_manager = await get_database_manager()
        health = db_manager.get_health_summary()
        ewa = await build_ewa_postgres_health_payload(request.app)

        return {
            "status": merge_api_overall_status_with_ewa(
                str(health.get("overall_status", "unknown")),
                str(ewa.get("status", "")),
            ),
            "service": "database",
            "details": health,
            "ewa_postgres": ewa,
            "timestamp": datetime.now(UTC).isoformat(),
        }
    except Exception as e:
        logger.exception("Database health check failed")
        ewa = await build_ewa_postgres_health_payload(request.app)
        return {
            "status": "error",
            "service": "database",
            "error": str(e),
            "ewa_postgres": ewa,
            "timestamp": datetime.now(UTC).isoformat(),
        }


@app.get("/ws/health")
async def ws_health() -> dict[str, Any]:
    """WebSocket health check"""
    return {"status": "healthy", "service": "websocket", "timestamp": datetime.now(UTC).isoformat()}


HTTP_INTERNAL_ERROR = 500


# ============================================================================
# ERROR HANDLERS
# ============================================================================


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handles Pydantic validation errors with detailed logging"""
    # Structured logging
    context = {
        "endpoint": request.url.path,
        "method": request.method,
        "validation_errors": exc.errors(),
    }

    try:
        body = await request.body()
        context["request_body"] = body.decode("utf-8")[:500]
    except (UnicodeDecodeError, ValueError) as e:
        logger.debug("Failed to decode request body: %s", e)

    log_error(exc, context, "warning")

    # Convert errors to serializable format
    errors = exc.errors()
    serializable_errors = []
    for error in errors:
        serializable_error = {
            "type": error.get("type"),
            "loc": error.get("loc"),
            "msg": error.get("msg"),
            "input": str(error.get("input", ""))[:200],  # Limit length
        }
        # Process ctx with ValueError objects
        if error.get("ctx"):
            ctx = {}
            for key, value in error["ctx"].items():
                if isinstance(value, Exception):
                    ctx[key] = str(value)
                else:
                    ctx[key] = value
            serializable_error["ctx"] = ctx
        serializable_errors.append(serializable_error)

    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation failed",
            # Как у стандартного FastAPI — для axios/SPA, которые читают `detail`
            "detail": serializable_errors,
            "details": serializable_errors,
            "timestamp": datetime.now(UTC).isoformat(),
        },
    )


@app.exception_handler(DatabaseConnectionError)
async def database_connection_error_handler(request: Request, exc: DatabaseConnectionError) -> JSONResponse:
    """Handle database connection errors gracefully - return 503 instead of 500"""
    logger.warning("Database connection error on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=503,
        content={
            "error": "Service temporarily unavailable",
            "detail": "Database connection failed. Please try again later.",
            "status_code": 503,
            "timestamp": datetime.now(UTC).isoformat(),
            "path": str(request.url.path),
            "method": request.method,
        },
    )


# HTTP 403 with these string `detail` values are business rules (not "session invalid, log in again").
# Otherwise `http_exception_handler` wraps them in `build_auth_error_body(..., action=login)` and
# the SPA redirects to Keycloak — see `marketing_cabinet_install_gate`, desktop AI chat ensemble.
_PLAIN_403_FORBIDDEN_STRING_DETAILS: frozenset[str] = frozenset(
    {
        "marketing_cabinet_required_for_group_chat",
        # Desktop AI Chat solo slot (must not become auth { action: login } or SPA redirects)
        "solo_slot_required",
        "solo_slot_expired",
    }
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Production HTTP exception handler. 401/403 use unified auth format (reason, action)."""
    # DEBUG level for expected client errors (401, 404)
    if exc.status_code in (401, 404):
        logger.debug("HTTP %s on %s: %s", exc.status_code, request.url.path, exc.detail)
    elif exc.status_code >= HTTP_INTERNAL_ERROR:
        logger.error("HTTP %s error on %s: %s", exc.status_code, request.url, exc.detail)
    else:
        logger.info("HTTP %s on %s: %s", exc.status_code, request.url.path, exc.detail)

    # Unify 401/403 to auth format (reason, action) for frontend
    if exc.status_code in (401, 403):
        if isinstance(exc.detail, dict) and "reason" in exc.detail and "action" in exc.detail:
            content = dict(exc.detail)
            if "error" not in content:
                content.setdefault("error", "forbidden" if exc.status_code == 403 else "unauthorized")
        else:
            detail_str = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
            # 403 with "Access denied..." = permission to resource/business rule, not "please login".
            # Same for known business-rule detail strings (must stay plain JSON for api client).
            if (
                exc.status_code == 403
                and detail_str
                and ("Access denied" in detail_str or detail_str in _PLAIN_403_FORBIDDEN_STRING_DETAILS)
            ):
                content = {"error": "forbidden", "detail": detail_str}
            else:
                content = build_auth_error_body(
                    reason=AUTH_REASON_FORBIDDEN if exc.status_code == 403 else AUTH_REASON_INVALID_TOKEN,
                    action=AUTH_ACTION_LOGIN,
                    detail=detail_str or None,
                )
                if exc.status_code == 403:
                    content["error"] = "forbidden"
        headers = {"WWW-Authenticate": 'Bearer realm="empery"'} if exc.status_code == 401 else {}
        return JSONResponse(status_code=exc.status_code, content=content, headers=headers)

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            # Дублируем: глобальный handler кладёт тело в `error`, многие клиенты ждут `detail` (как у FastAPI)
            "detail": exc.detail,
            "status_code": exc.status_code,
            "timestamp": datetime.now(UTC).isoformat(),
            "path": str(request.url.path),
            "method": request.method,
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Production general exception handler with comprehensive logging

    Uses Python 3.14 improved traceback for better error context.
    """
    # Postgres schema mismatch (migration not applied) — operators see a clear remediation path vs opaque 500
    if _is_db_schema_migration_required_error(exc):
        logger.warning("DB schema / migration mismatch on %s: %s", request.url.path, exc)
        return JSONResponse(
            status_code=503,
            content={
                "error": "Service temporarily unavailable",
                "detail": (
                    "Database schema is behind application code — apply latest SQL migrations "
                    "(for current llama cutover: pending/20260617_01_llama_contract_cutover.sql). "
                    "See api/migrations/README.md"
                ),
                "reason": "db_schema_migration",
                "status_code": 503,
                "timestamp": datetime.now(UTC).isoformat(),
                "path": str(request.url.path),
                "method": request.method,
            },
        )

    # Return 503 for DB connection errors so clients see "Service Unavailable"
    if _is_db_connection_error(exc):
        logger.warning("DB connection error on %s: %s", request.url.path, exc)
        return JSONResponse(
            status_code=503,
            content={
                "error": "Service temporarily unavailable",
                "detail": "Database connection failed. See docker/docs-api-500-troubleshooting.md",
                "reason": "database",
                "status_code": 503,
                "timestamp": datetime.now(UTC).isoformat(),
                "path": str(request.url.path),
                "method": request.method,
            },
        )

    # Return 503 for auth-provider/config errors so clients see "Service Unavailable" instead of 500
    if _is_auth_provider_or_config_error(exc):
        logger.warning("Auth provider/config error on %s: %s", request.url.path, exc)
        return JSONResponse(
            status_code=503,
            content={
                "error": "Service temporarily unavailable",
                "detail": "Authentication provider or configuration unavailable. See docker/docs-api-500-troubleshooting.md",
                "reason": "auth_provider",
                "status_code": 503,
                "timestamp": datetime.now(UTC).isoformat(),
                "path": str(request.url.path),
                "method": request.method,
            },
        )

    # Return 503 for Redis/AMQP/other service connection errors
    if _is_service_unavailable_error(exc):
        logger.warning("Service unavailable on %s: %s", request.url.path, exc)
        return JSONResponse(
            status_code=503,
            content={
                "error": "Service temporarily unavailable",
                "detail": "Backend service (Redis/RabbitMQ/network) unavailable. See docker/docs-api-500-troubleshooting.md",
                "reason": "backend_service",
                "status_code": 503,
                "timestamp": datetime.now(UTC).isoformat(),
                "path": str(request.url.path),
                "method": request.method,
            },
        )

    # Return 503 for Elasticsearch/S3/Seaweed/storage errors
    if _is_elasticsearch_or_storage_error(exc):
        logger.warning("Storage/search unavailable on %s: %s", request.url.path, exc)
        return JSONResponse(
            status_code=503,
            content={
                "error": "Service temporarily unavailable",
                "detail": "Storage or search service temporarily unavailable. Try again later.",
                "reason": "storage",
                "status_code": 503,
                "timestamp": datetime.now(UTC).isoformat(),
                "path": str(request.url.path),
                "method": request.method,
            },
        )

    # Python 3.14 improved traceback with better context
    # format_exc() now includes more helpful information
    tb_str = traceback.format_exc()

    # Get exception context (Python 3.14 improvement)
    exc_context: dict[str, Any] = {
        "exception_type": type(exc).__name__,
        "exception_module": type(exc).__module__,
        "exception_message": str(exc),
    }

    # Add __cause__ and __context__ if available (Python 3.14 shows these better)
    if exc.__cause__:
        exc_context["cause"] = {
            "type": type(exc.__cause__).__name__,
            "message": str(exc.__cause__),
        }
    if exc.__context__:
        exc_context["context"] = {
            "type": type(exc.__context__).__name__,
            "message": str(exc.__context__),
        }

    # Structured logging for 500 errors
    context = {
        "endpoint": str(request.url.path),
        "method": request.method,
        "user_agent": request.headers.get("user-agent"),
        "traceback": tb_str if unified_settings.debug else None,
        **exc_context,
    }

    log_error(exc, context, "error")

    # Don't expose internal errors in production
    if unified_settings.debug:
        error_detail = str(exc)
        traceback_info = traceback.format_exc()
    else:
        error_detail = "Internal server error"
        traceback_info = None

    response_content = {
        "error": "Internal server error",
        "status_code": 500,
        "timestamp": datetime.now(UTC).isoformat(),
        "path": str(request.url.path),
        "method": request.method,
    }

    if unified_settings.debug:
        response_content["detail"] = error_detail
        response_content["traceback"] = traceback_info

    return JSONResponse(status_code=500, content=response_content)


# ============================================================================
# SOCKET.IO INTEGRATION
# ============================================================================
# Wrap FastAPI app in Socket.IO ASGIApp
# This allows Socket.IO to handle its requests and forward the rest to FastAPI

try:
    # isort: off
    from api.routers.socketio_handler import sio  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
    # isort: on

    fastapi_app = app
    socket_io_app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app, socketio_path="socket.io")

    # CRITICAL: This reassignment is intentional and required for Socket.IO to work
    # Uvicorn must run the Socket.IO wrapper, not the raw FastAPI app
    # Command: uvicorn api.main:app --workers 1 (workers MUST be 1 for Socket.IO)
    # Python 3.14+: inspect asyncio tasks: python -m asyncio ps <PID> or pstree <PID>

except (ImportError, AttributeError):  # fmt: skip
    socket_io_app = app

# CRITICAL: Reassign app to socket_io_app for uvicorn
# This is the correct pattern for Socket.IO + FastAPI integration
# Uvicorn api.main:app will now serve the Socket.IO wrapper
app = socket_io_app
