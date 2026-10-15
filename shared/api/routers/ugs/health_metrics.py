# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   UGS health aggregate, per-user metrics hub counters, and provider status overview.
# Invariants:
#   - ``/metrics`` raises 503 when global metrics cannot be loaded (no silent empty success).
#   - ``/providers/status`` must not coerce a failed probe into ``response_time: 0`` (use null + ``error``).
#   - Hot dashboard endpoints use throttled stale cleanup and short provider-status TTL caching.
# Related:
#   - api/routers/ugs/common.py (infrastructure health helpers)
# ---
"""UGS health and metrics routes."""

from __future__ import annotations

import asyncio
import time
from datetime import UTC, datetime
from typing import Any, cast

from fastapi import APIRouter, Depends, HTTPException  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.routers.ugs.common import (
    get_cache_health,
    get_database_health,
    get_queue_health,
)
from api.routers.ugs.deps import get_provider_manager, get_ugs_service, logger
from api.schemas.ugs import UGSHealthResponse, UGSMetricsResponse, UGSProvidersStatusResponse
from api.services.ugs.provider_manager_service_v2 import ProviderManagerServiceV2
from api.services.ugs.unified_generation_service import UnifiedGenerationService

PROVIDER_STATUS_CACHE_TTL_SECONDS = 15.0
_providers_status_cache: UGSProvidersStatusResponse | None = None
_providers_status_cache_monotonic = 0.0


def provider_status_cache_is_fresh(
    cached_at_monotonic: float,
    *,
    now_monotonic: float | None = None,
    ttl_seconds: float = PROVIDER_STATUS_CACHE_TTL_SECONDS,
) -> bool:
    """Return whether the provider-status dashboard cache can satisfy this request."""
    now = time.monotonic() if now_monotonic is None else now_monotonic
    return cached_at_monotonic > 0 and (now - cached_at_monotonic) < ttl_seconds


async def _build_providers_status_payload(provider_manager: ProviderManagerServiceV2) -> UGSProvidersStatusResponse:
    """Probe all configured UGS providers and normalize the dashboard response payload."""
    providers = await provider_manager.get_available_providers()
    await provider_manager.get_provider_stats()

    statuses = await asyncio.gather(
        *[provider_manager.check_provider_status(p["name"]) for p in providers],
        return_exceptions=True,
    )
    result = []
    for provider, status in zip(providers, statuses, strict=False):
        if isinstance(status, Exception):
            logger.warning("Provider %s status check failed: %s", provider.get("name"), status)
            status_payload = {
                "available": False,
                "response_time": None,
                "last_checked": datetime.now(UTC),
                "error": str(status),
            }
        else:
            status_payload = cast(dict[str, Any], status)
        available = status_payload.get("available", False)
        last_check = status_payload.get("last_checked")
        if isinstance(last_check, str):
            last_check = datetime.fromisoformat(last_check.replace("Z", "+00:00"))
        elif not isinstance(last_check, datetime):
            last_check = datetime.now(UTC)
        raw_rt = status_payload.get("response_time")
        response_time: float | None
        if isinstance(raw_rt, bool):
            response_time = None
        elif isinstance(raw_rt, (int, float)) and raw_rt >= 0:
            response_time = float(raw_rt)
        else:
            response_time = None
        result.append(
            {
                "provider_name": provider["name"],
                "display_label": provider.get("display_label"),
                "status": "healthy" if available else "unhealthy",
                "response_time": response_time,
                "last_check": last_check,
                "error": status_payload.get("error"),
            }
        )

    total_providers = len(result)
    healthy_providers = sum(1 for p in result if p["status"] == "healthy")
    rts = [
        float(p["response_time"])
        for p in result
        if isinstance(p.get("response_time"), (int, float)) and not isinstance(p.get("response_time"), bool)
    ]
    average_response_time = sum(rts) / len(rts) if rts else 0.0

    return UGSProvidersStatusResponse(
        providers=result,
        summary={
            "total": total_providers,
            "healthy": healthy_providers,
            "unhealthy": total_providers - healthy_providers,
            "average_response_time": average_response_time,
        },
    )


def register_health_and_metrics_routes(router: APIRouter) -> None:
    # ========================================
    # HEALTH CHECK ENDPOINTS
    # ========================================

    @router.get(
        "/health",
        response_model=UGSHealthResponse,
        summary="UGS Health Check",
        description="Check the overall health of the UGS system",
    )
    async def health_check(
        provider_manager: ProviderManagerServiceV2 = Depends(get_provider_manager),  # noqa: B008
    ) -> UGSHealthResponse | dict[str, Any]:
        """
        🔥 UGS HEALTH CHECK 🔥

        Comprehensive health check of the Unified Generation System.
        """
        try:
            await provider_manager.initialize()

            # Check providers
            provider_stats = await provider_manager.get_provider_stats()

            # Overall health
            healthy_providers = provider_stats["available_providers"]
            total_providers = provider_stats["total_providers"]

            return {
                "status": "healthy" if healthy_providers > 0 else "degraded",
                "timestamp": provider_stats["timestamp"],
                "providers": {
                    "total": total_providers,
                    "healthy": healthy_providers,
                    "unhealthy": provider_stats["unavailable_providers"],
                },
                "services": {
                    "database": await get_database_health(),
                    "cache": await get_cache_health(),
                    "queue": await get_queue_health(),
                },
            }

        except (OSError, RuntimeError) as e:
            logger.exception("Health check failed")
            return {"status": "unhealthy", "error": str(e), "timestamp": "2025-10-20T00:00:00Z"}

    # ========================================
    # METRICS ENDPOINTS
    # ========================================

    @router.get(
        "/metrics",
        response_model=UGSMetricsResponse,
        summary="Get Generation Metrics",
        description="Get comprehensive generation metrics and statistics",
    )
    async def get_generation_metrics(
        user: User = Depends(require_oauth2_user),  # noqa: B008
        ugs_service: UnifiedGenerationService = Depends(get_ugs_service),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> UGSMetricsResponse | dict[str, Any]:
        """
        🔥 GET GENERATION METRICS 🔥

        Get comprehensive metrics about generation activity, performance, and usage.
        """
        try:
            # Get global/system metrics from the UGS service (last 24h by default)
            metrics = await ugs_service.get_performance_metrics()

            # Per-user activity counters for the hub (today/active)
            from sqlalchemy import func, select  # type: ignore[import-not-found]  # noqa: PLC0415

            from api.models.database_models import GenerationRequest  # noqa: PLC0415
            from api.services.ugs.queue_manager_service import QueueManagerService  # noqa: PLC0415

            user_id = str(user.id)
            today = func.date(func.now())
            queue_manager = QueueManagerService(db)
            await queue_manager.maybe_cleanup_stale_request_states()

            # Active generations (pending + processing) for current user
            active_query = select(func.count(GenerationRequest.id)).where(
                GenerationRequest.user_id == user_id,
                GenerationRequest.status.in_(["pending", "processing"]),
            )
            active_result = await db.execute(active_query)
            active_generations = int(active_result.scalar() or 0)

            # Completed today for current user
            completed_query = select(func.count(GenerationRequest.id)).where(
                GenerationRequest.user_id == user_id,
                GenerationRequest.status == "completed",
                func.date(GenerationRequest.updated_at) == today,
            )
            completed_result = await db.execute(completed_query)
            completed_today = int(completed_result.scalar() or 0)

            # Failed today for current user
            failed_query = select(func.count(GenerationRequest.id)).where(
                GenerationRequest.user_id == user_id,
                GenerationRequest.status == "failed",
                func.date(GenerationRequest.updated_at) == today,
            )
            failed_result = await db.execute(failed_query)
            failed_today = int(failed_result.scalar() or 0)

            total_generations = int(metrics.get("total_generations", 0) or 0)
            avg_duration_ms = float(metrics.get("avg_duration_ms", 0.0) or 0.0)
            success_rate_pct = float(metrics.get("success_rate", 0.0) or 0.0)

            return {
                "total_generations": total_generations,
                "active_generations": active_generations,
                "completed_today": completed_today,
                "failed_today": failed_today,
                "average_generation_time": avg_duration_ms / 1000.0,  # seconds
                "success_rate": success_rate_pct / 100.0,  # 0..1
                "popular_types": [
                    {
                        "type_key": type_metric["type_key"],
                        "display_name": (type_metric["type_key"] or "unknown").replace("_", " ").title(),
                        "count": int(type_metric.get("successful", 0) or 0) + int(type_metric.get("failed", 0) or 0),
                    }
                    for type_metric in metrics.get("by_type", [])
                    if type_metric.get("type_key")
                ],
            }

        except (OSError, RuntimeError) as e:
            logger.exception("Metrics retrieval failed")
            # Return error response, not fake data
            error_msg = f"Metrics service unavailable: {e}"
            raise HTTPException(status_code=503, detail=error_msg) from e

    # ========================================
    # PROVIDER STATUS ENDPOINTS
    # ========================================

    @router.get(
        "/providers/status",
        response_model=UGSProvidersStatusResponse,
        summary="Get Provider Status Overview",
        description="Get detailed status of all providers with monitoring data",
    )
    async def get_providers_status(
        user: User = Depends(require_oauth2_user),  # noqa: ARG001, B008
        provider_manager: ProviderManagerServiceV2 = Depends(get_provider_manager),  # noqa: B008
    ) -> UGSProvidersStatusResponse:
        """
        🔥 GET PROVIDER STATUS OVERVIEW 🔥

        Get comprehensive status information for all AI providers with monitoring metrics.
        """
        global _providers_status_cache, _providers_status_cache_monotonic  # noqa: PLW0603
        try:
            if _providers_status_cache is not None and provider_status_cache_is_fresh(
                _providers_status_cache_monotonic
            ):
                return _providers_status_cache

            payload = await _build_providers_status_payload(provider_manager)
            _providers_status_cache = payload
            _providers_status_cache_monotonic = time.monotonic()
            return payload
        except (OSError, RuntimeError) as e:
            logger.exception("Failed to get providers status")
            raise HTTPException(status_code=500, detail="Failed to retrieve provider status") from e
