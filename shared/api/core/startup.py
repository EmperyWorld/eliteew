#!/usr/bin/env python3
"""Application startup functions.

Extracted from api/main.py lifespan for better code organization.
Handles initialization and shutdown of various services.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from fastapi import FastAPI  # type: ignore[import-untyped]
else:
    # Runtime import - FastAPI is used at runtime, not just for type checking
    from fastapi import FastAPI  # type: ignore[import-untyped]  # noqa: TC002

# isort: off
# NOTE: Elasticsearch is installed in venv, but linter doesn't see it due to configuration
# This is a linter configuration error, not a code error - module is available at runtime
# isort: on

# isort: off
# NOTE: Module exists, but linter doesn't see it due to Python path configuration
# This is a linter configuration error, not a code error - module is available at runtime
from api.core.cache_warmer import warm_cache_on_startup  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
# isort: on

try:
    from api.services.cache_version_manager import (
        initialize_cache_version_on_startup,  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
    )
except ImportError:
    initialize_cache_version_on_startup = None  # type: ignore[assignment,misc]

try:
    from api.core.http_clients import (
        close_http_clients,  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
    )
except ImportError:
    close_http_clients = None  # type: ignore[assignment,misc]

try:
    from api.services.ugs.provider_manager_service_v2 import (
        close_global_http_session,  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
    )
except ImportError:
    close_global_http_session = None  # type: ignore[assignment,misc]

try:
    from api.services.unified_audio_service import (
        get_unified_audio_service,  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
    )
except ImportError:
    get_unified_audio_service = None  # type: ignore[assignment,misc]
# isort: on

if TYPE_CHECKING:
    # isort: off
    # NOTE: Module exists, but linter doesn't see it due to Python path configuration
    # This is a linter configuration error, not a code error - module is available at runtime
    from api.core.unified_config import UnifiedConfig  # type: ignore[import-untyped,reportMissingImports]  # pyright: ignore[reportMissingImports]
    # isort: on
else:
    # Runtime import to avoid circular dependency
    UnifiedConfig = Any  # type: ignore[assignment,misc,valid-type]

# Type alias for compatibility
UnifiedSettings = UnifiedConfig

logger = logging.getLogger(__name__)

# avoid circular import at module load time
_unified_settings: Any | None = None  # type: ignore[assignment]


def get_unified_settings() -> UnifiedSettings:  # type: ignore[return-value]
    """Get unified settings instance (lazy loading to avoid circular imports)."""
    global _unified_settings  # noqa: PLW0603
    if _unified_settings is None:
        # Циклическая зависимость: избегаем импорт на top-level
        # isort: off
        # NOTE: Module exists, but linter doesn't see it due to Python path configuration
        # This is a linter configuration error, not a code error - module is available at runtime
        from api.core.unified_config import unified_settings  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]  # noqa: PLC0415
        # isort: on

        _unified_settings = unified_settings
    return _unified_settings  # type: ignore[return-value]


async def init_whisper_model_preload() -> None:
    """STT via stack9 whisper-fast only; local Whisper preload is disabled (no-op)."""
    logger.info(
        "STT via stack9 whisper-fast only; local Whisper model preload skipped.",
    )


async def init_cache_version_manager() -> None:
    """Initialize cache version manager at application startup.

    Automatically checks application version and invalidates cache if needed.
    This ensures "hot reload" for cache when deploying new build.
    """
    if initialize_cache_version_on_startup is None:
        logger.warning("Cache version manager not available")
        return

    try:
        await initialize_cache_version_on_startup()  # type: ignore[misc]
    except Exception:
        logger.exception("Error: Cache version manager initialization failed")
        # Don't block application startup on cache error


async def init_cache_warming() -> None:
    """Run cache warming to improve performance."""
    try:
        await warm_cache_on_startup()
    except Exception:
        logger.exception("Cache warming failed")


async def init_unified_audio_service(app: FastAPI) -> None:
    """Initialize Unified Audio Service for TTS providers.

    Args:
        app: FastAPI application instance

    """
    if get_unified_audio_service is None:
        logger.warning("Unified Audio Service not available")
        return

    try:
        # Initialize the unified audio service
        unified_audio = get_unified_audio_service()
        await unified_audio.initialize()
        app.state.unified_audio_service = unified_audio

        # Get provider status
        status = await unified_audio.get_provider_status()
        logger.info(
            "Unified Audio Service initialized: %s healthy, %s unhealthy providers",
            status["healthy_count"],
            status["unhealthy_count"],
        )

        # Log healthy providers
        for name, provider_status in status["providers"].items():
            health = "ok" if provider_status["healthy"] else "fail"
            logger.info("   %s %s", health, name)

    except Exception:
        logger.exception("Unified Audio Service initialization failed")
        app.state.unified_audio_service = None


async def init_rabbitmq_queues() -> None:
    """Объявить очереди RabbitMQ при старте (идемпотентно). Вызывать после инициализации DatabaseManager."""
    try:
        from api.services.rabbitmq_service import get_rabbitmq_service

        svc = get_rabbitmq_service()
        await svc.ensure_queues()
    except RuntimeError as e:
        if "RabbitMQ not available" in str(e):
            logger.debug("RabbitMQ queues skip: %s", e)
        else:
            logger.warning("RabbitMQ ensure_queues: %s", e)
    except Exception:
        logger.exception("RabbitMQ ensure_queues failed")


# ============================================================================
# SHUTDOWN FUNCTIONS
# ============================================================================


async def shutdown_monitoring(app: FastAPI) -> None:
    """Gracefully shutdown Monitoring Service."""
    if hasattr(app.state, "monitoring") and app.state.monitoring:
        try:
            await app.state.monitoring.stop_monitoring()
        except Exception:
            logger.exception("Monitoring shutdown")


async def shutdown_http_sessions(app: FastAPI) -> None:
    """Shutdown all HTTP sessions to prevent memory leaks."""
    try:
        # Close central aiohttp/httpx clients first
        if close_http_clients is not None:
            try:
                await close_http_clients()
                logger.info("Central HTTP clients closed")
            except Exception:
                logger.exception("Error closing central HTTP clients")

        # Close ProviderManagerServiceV2 global HTTP session
        if close_global_http_session is not None:
            try:
                await close_global_http_session()
            except Exception:
                logger.exception("Error closing ProviderManagerServiceV2 HTTP session")

        # Close Unified Audio Service
        if hasattr(app.state, "unified_audio_service") and app.state.unified_audio_service:
            try:
                await app.state.unified_audio_service.close()
                logger.info("Unified Audio Service closed")
            except Exception:
                logger.exception("Unified Audio Service shutdown")

        # Close all aiohttp sessions
        if hasattr(app.state, "http_sessions"):
            for session in app.state.http_sessions:
                if not session.closed:
                    await session.close()
            logger.info("HTTP sessions closed")

        # Close specific service sessions
        services_to_cleanup = [
            "llama_pool_service",  # cSpell:ignore llama
            "chromadb_service",
            "prometheus_service",
        ]

        for service_name in services_to_cleanup:
            if hasattr(app.state, service_name):
                service = getattr(app.state, service_name)
                if service and hasattr(service, "cleanup"):
                    await service.cleanup()
                    logger.info("%s cleaned up", service_name)

    except Exception:
        logger.exception("Error closing HTTP sessions")
