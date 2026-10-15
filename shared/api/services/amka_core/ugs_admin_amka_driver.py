# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Production-flavored AMKA driver for UGS Admin model routing (`UGSSetting` key `model_routes`).
# Read-only alignment: snapshot + optional planning hints; mutations stay in UGS Admin UI/API.
# Invariants:
# - Uses `UGSModelRoutingService` only; does not import Marketing Cabinet AMKA tables.
# - `act()` never mutates routing; operators use existing UGS admin bulk endpoints.
# Related:
# - shared/api/services/ugs/model_routing_service.py
# - shared/api/services/amka_core/contracts.py
# - documentation/product/amka-seed-album/RFC-001-amka-driver-contract.md
# ---
from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from api.services.amka_core.contracts import (
    AmkaPlanOperation,
    AmkaPlanTask,
    AmkaPolicyDecision,
    AmkaPulseArtifact,
    AmkaRiskLevel,
    AmkaSnapshot,
    AmkaSubjectRef,
    AmkaTraceEvent,
)
from api.services.ugs.model_routing_service import UGSModelRoutingService


class UgsAdminAmkaDriver:
    """UGS Admin model-routing snapshot as AMKA alignment subject (read-only act)."""

    driver_key = "ugs_admin"
    domain_profile = "model_routing"

    def __init__(self, routing: UGSModelRoutingService) -> None:
        self._routing = routing

    async def read(self, subject: AmkaSubjectRef) -> AmkaSnapshot:
        routes = await self._routing.get_model_routes()
        data = routes.model_dump()
        type_overrides = data.get("type_overrides") or {}
        provider_defaults = data.get("provider_defaults") or {}
        category_defaults = data.get("category_defaults") or {}
        domain_defaults = data.get("domain_defaults") or {}
        if not isinstance(type_overrides, dict):
            type_overrides = {}
        if not isinstance(provider_defaults, dict):
            provider_defaults = {}
        if not isinstance(category_defaults, dict):
            category_defaults = {}
        if not isinstance(domain_defaults, dict):
            domain_defaults = {}
        return AmkaSnapshot(
            subject=subject,
            health={
                "has_global_default_model": bool(data.get("global_default_model")),
                "type_override_count": len(type_overrides),
                "provider_default_count": len(provider_defaults),
                "category_default_count": len(category_defaults),
                "domain_default_count": len(domain_defaults),
            },
            context_text="UGS DB-backed model routing (UGSSetting.model_routes).",
            entities={"model_routes": data},
            metadata={"driver_key": self.driver_key, "ugs": True},
        )

    async def plan(
        self,
        subject: AmkaSubjectRef,
        snapshot: AmkaSnapshot,
    ) -> Sequence[AmkaPlanTask]:
        routes = (snapshot.entities or {}).get("model_routes")
        if not isinstance(routes, dict):
            return ()
        if not routes.get("global_default_model"):
            return (
                AmkaPlanTask(
                    task_key="ugs-routing-global-default",
                    title="Set global_default_model in model_routes",
                    summary="No global default model is configured in UGS model routes.",
                    risk=AmkaRiskLevel.MEDIUM,
                    operations=(
                        AmkaPlanOperation(
                            operation_key="ugs.set_global_default_model",
                            kind="config",
                            title="Define global default LLM model",
                            risk=AmkaRiskLevel.MEDIUM,
                            requires_approval=True,
                        ),
                    ),
                    metadata={"source": "ugs_model_routes"},
                ),
            )
        return ()

    async def policy(
        self,
        subject: AmkaSubjectRef,
        snapshot: AmkaSnapshot,
        tasks: Sequence[AmkaPlanTask],
    ) -> AmkaPolicyDecision:
        if not tasks:
            return AmkaPolicyDecision(
                allowed=True,
                mode="auto",
                reason="No routing gaps detected for this alignment pass.",
            )
        return AmkaPolicyDecision(
            allowed=True,
            mode="semi_auto",
            reason="Routing changes require UGS Admin review; AMKA does not auto-apply config.",
        )

    async def act(
        self,
        subject: AmkaSubjectRef,
        task: AmkaPlanTask,
        decision: AmkaPolicyDecision,
    ) -> Mapping[str, Any]:
        return {
            "executed": False,
            "task_key": task.task_key,
            "reason": "ugs_admin profile is read-only for act(); use UGS Admin v2 endpoints to apply changes.",
        }

    async def observe(self, subject: AmkaSubjectRef) -> Mapping[str, Any]:
        return {
            "driver_key": self.driver_key,
            "domain_profile": self.domain_profile,
            "read_only_act": True,
        }

    async def pulse(
        self,
        subject: AmkaSubjectRef,
        snapshot: AmkaSnapshot,
        tasks: Sequence[AmkaPlanTask],
        traces: Sequence[AmkaTraceEvent],
    ) -> AmkaPulseArtifact:
        routes = (snapshot.entities or {}).get("model_routes")
        if not isinstance(routes, dict):
            routes = {}
        if not tasks:
            return AmkaPulseArtifact(
                summary="UGS model routing looks configured at a baseline level (global default present).",
                preserved=("Existing model_routes row in UGSSetting.",),
                agreements=("Alignment is informational; verify overrides in Admin v2 if routing issues persist.",),
                no_change_reason=None,
                next_safe_step="Use UGS Admin snapshot/compare when changing providers or type overrides.",
            )
        return AmkaPulseArtifact(
            summary="UGS model routing has a visible gap: missing global_default_model.",
            changed=(),
            preserved=("Type/provider overrides may still be partially effective.",),
            doubts=("Without a global default, some generation types may fall back unpredictably.",),
            agreements=("Fix routing via UGS Admin rather than through AMKA act().",),
            next_safe_step="Open UGS Admin v2 and set global_default_model or explicit overrides.",
        )
