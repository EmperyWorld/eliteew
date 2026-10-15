# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# UGS generation type catalog and metrics/analytics facade methods on UnifiedGenerationService.
# Invariants:
# - Type listing delegates to GenerationTypeService; no duplicate type CRUD logic here.
# - GET /types list rows validate as GenerationTypeResponse (full catalog shape, not partial dicts).
# Related:
# - api/services/ugs/unified_generation_service.py
# - api/services/ugs/generation_type_service.py
# - api/services/ugs/metrics_service.py
# - documentation/api/FRONTEND-BACKEND-HTTP.md §UGS typed contracts
# ---
# pyright: reportAttributeAccessIssue=false
# Mixin attrs (type_service, metrics_service) are provided by UnifiedGenerationService composition.

from __future__ import annotations

from typing import Any
from uuid import UUID

from api.models.database_models import GenerationType
from api.schemas.ugs import GenerationTypeResponse


class GenerationTypesFacadeMixin:
    """Generation types and UGS metrics/analytics reads."""

    async def get_performance_metrics(self, hours: int = 24) -> dict[str, Any]:
        """Get UGS performance metrics"""
        return await self.metrics_service.get_performance_metrics(hours)

    async def get_error_analysis(self, hours: int = 24, limit: int = 10000) -> dict[str, Any]:
        """Get UGS error analysis."""
        return await self.metrics_service.get_error_analysis(hours, limit=limit)

    async def get_analytics_summary(
        self,
        user_id: str,
        *,
        hours: int = 24,
        recent_errors_limit: int = 50,
    ) -> dict[str, Any]:
        """
        Combined analytics payload for UGS Analytics page: totals, success rate,
        by_type breakdown, and recent errors. User-scoped; reuses UGSMetricsService only.
        """
        user_uuid = UUID(user_id) if isinstance(user_id, str) else user_id
        metrics = await self.metrics_service.get_performance_metrics(hours=hours, user_id=user_uuid)
        errors = await self.metrics_service.get_error_analysis(hours=hours, limit=recent_errors_limit)
        sr_raw = float(metrics.get("success_rate", 0.0) or 0.0)
        success_rate_01 = sr_raw / 100.0 if sr_raw > 1.0 else sr_raw
        return {
            "totals": {
                "total_generations": metrics.get("total_generations", 0),
                "successful": metrics.get("successful", 0),
                "failed": metrics.get("failed", 0),
                "cancelled": metrics.get("cancelled", 0),
            },
            "success_rate": success_rate_01,
            "avg_duration_ms": metrics.get("avg_duration_ms", 0.0),
            "by_type": metrics.get("by_type", []),
            "recent_errors": errors.get("recent_errors", []),
            "error_distribution": errors.get("error_distribution", []),
        }

    async def get_system_health(self) -> dict[str, Any]:
        """Get UGS system health"""
        return await self.metrics_service.get_system_health()

    async def get_available_types(self, category: str | None = None) -> list[GenerationTypeResponse]:
        """Get list of available generation types as GenerationTypeResponse rows."""
        types = await self.type_service.get_active_types(category)
        return [GenerationTypeResponse.model_validate(t.to_dict()) for t in types]

    async def create_generation_type(
        self,
        type_data: dict[str, Any],
        created_by: str,  # noqa: ARG002
    ) -> GenerationType:
        """Create new generation type"""
        return await self.type_service.create_type(type_data)
