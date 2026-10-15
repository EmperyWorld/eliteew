# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Read-only AMKA driver over the UGS Admin v2 aggregate snapshot (providers, types, workflows, validation).
# Surfaces validation gaps as plan tasks; mutations remain on UGS Admin bulk/compare APIs.
# Invariants:
# - Calls `build_snapshot` only inside `read()`; does not touch Marketing Cabinet AMKA tables.
# - `act()` is a no-op delegating operators to Admin v2 (same posture as `UgsAdminAmkaDriver`).
# Related:
# - shared/api/services/ugs/admin_v2_service.py
# - shared/api/services/amka_core/contracts.py
# - documentation/product/amka-seed-album/RFC-001-amka-driver-contract.md
# ---
from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

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

_ISSUES_TOP_LIMIT = 24


class UgsAdminGenerationInventoryAmkaDriver:
    """UGS Admin v2 snapshot alignment: generation inventory coherence (read-only act)."""

    driver_key = "ugs_admin"
    domain_profile = "generation_inventory"

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def read(self, subject: AmkaSubjectRef) -> AmkaSnapshot:
        from api.services.ugs.admin_v2_service import build_snapshot

        snap = await build_snapshot(self._db)
        err_n = sum(1 for i in snap.issues if i.severity == "error")
        warn_n = sum(1 for i in snap.issues if i.severity == "warning")
        top_issues = [i.model_dump(mode="json") for i in snap.issues[:_ISSUES_TOP_LIMIT]]

        return AmkaSnapshot(
            subject=subject,
            health={
                "providers_count": len(snap.providers),
                "generation_types_count": len(snap.types),
                "workflows_count": len(snap.workflows),
                "validation_error_count": err_n,
                "validation_warning_count": warn_n,
                "autofix_recommendation_count": len(snap.autofix_recommendations),
            },
            context_text=(
                "UGS Admin v2 snapshot: providers, generation types, workflows, "
                "and the same validation issues as Compare/Snapshot in Admin."
            ),
            entities={
                "issues_top": top_issues,
            },
            metadata={
                "driver_key": self.driver_key,
                "ugs": True,
                "snapshot_generated_at": snap.generated_at.isoformat(),
            },
        )

    async def plan(
        self,
        subject: AmkaSubjectRef,
        snapshot: AmkaSnapshot,
    ) -> Sequence[AmkaPlanTask]:
        h = snapshot.health
        err_n = int(h.get("validation_error_count") or 0)
        warn_n = int(h.get("validation_warning_count") or 0)
        prov_n = int(h.get("providers_count") or 0)
        typ_n = int(h.get("generation_types_count") or 0)

        if err_n > 0:
            return (
                AmkaPlanTask(
                    task_key="ugs-inventory-validation-errors",
                    title="Fix UGS validation errors",
                    summary=(
                        f"UGS Admin v2 snapshot reports {err_n} blocking validation error(s). "
                        "Resolve them in Admin Compare/Snapshot before relying on bulk apply."
                    ),
                    risk=AmkaRiskLevel.HIGH,
                    operations=(
                        AmkaPlanOperation(
                            operation_key="ugs.open_admin_snapshot",
                            kind="review",
                            title="Review UGS Admin v2 validation issues",
                            risk=AmkaRiskLevel.HIGH,
                            requires_approval=True,
                        ),
                    ),
                    metadata={"source": "ugs_admin_v2_snapshot"},
                ),
            )
        if prov_n == 0 and typ_n > 0:
            return (
                AmkaPlanTask(
                    task_key="ugs-inventory-missing-providers",
                    title="Add generation providers for configured types",
                    summary=(
                        f"{typ_n} generation type(s) exist but no providers are configured; "
                        "requests may fail at runtime."
                    ),
                    risk=AmkaRiskLevel.MEDIUM,
                    operations=(
                        AmkaPlanOperation(
                            operation_key="ugs.create_or_enable_provider",
                            kind="config",
                            title="Configure at least one generation provider in UGS Admin",
                            risk=AmkaRiskLevel.MEDIUM,
                            requires_approval=True,
                        ),
                    ),
                    metadata={"source": "ugs_admin_v2_snapshot"},
                ),
            )
        if warn_n > 0:
            return (
                AmkaPlanTask(
                    task_key="ugs-inventory-validation-warnings",
                    title="Review UGS validation warnings",
                    summary=(
                        f"UGS Admin v2 snapshot reports {warn_n} warning(s) "
                        "that may affect routing or inventory coherence."
                    ),
                    risk=AmkaRiskLevel.MEDIUM,
                    operations=(
                        AmkaPlanOperation(
                            operation_key="ugs.review_warnings",
                            kind="review",
                            title="Review warnings in UGS Admin v2",
                            risk=AmkaRiskLevel.MEDIUM,
                            requires_approval=True,
                        ),
                    ),
                    metadata={"source": "ugs_admin_v2_snapshot"},
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
                reason="No inventory gaps detected for this alignment pass.",
            )
        return AmkaPolicyDecision(
            allowed=True,
            mode="semi_auto",
            reason="Inventory fixes require UGS Admin review; AMKA does not auto-apply config.",
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
            "reason": (
                "ugs_admin generation_inventory profile is read-only for act(); "
                "use UGS Admin v2 endpoints to apply changes."
            ),
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
        if not tasks:
            return AmkaPulseArtifact(
                summary="UGS generation inventory snapshot shows no blocking validator issues in this pass.",
                preserved=("Providers, types, and workflows are included in the Admin v2 snapshot.",),
                agreements=("Alignment is informational; use Admin Compare when changing inventory.",),
                next_safe_step="Re-run alignment after bulk edits in UGS Admin v2.",
            )

        task_key = tasks[0].task_key
        if task_key == "ugs-inventory-validation-errors":
            return AmkaPulseArtifact(
                summary="UGS validation errors break a clean generation inventory posture.",
                changed=(),
                preserved=("Existing DB rows are unchanged through AMKA.",),
                doubts=("Unresolved errors may prevent bulk apply or yield inconsistent runtime behavior.",),
                agreements=("Fix issues in UGS Admin v2, not through AMKA act().",),
                next_safe_step="Open UGS Admin Compare/Snapshot and clear blocking validation errors.",
            )
        if task_key == "ugs-inventory-missing-providers":
            return AmkaPulseArtifact(
                summary="Generation types exist without any configured provider.",
                changed=(),
                preserved=("Type rows remain; routing may be incomplete until providers exist.",),
                doubts=("Runtime may return errors for affected generation requests.",),
                agreements=("Add or enable providers via UGS Admin rather than AMKA act().",),
                next_safe_step="Configure at least one provider that matches active generation types.",
            )
        if task_key == "ugs-inventory-validation-warnings":
            return AmkaPulseArtifact(
                summary="UGS snapshot reports validator warnings worth reviewing.",
                changed=(),
                preserved=("Warnings do not always block apply; review before large changes.",),
                doubts=("Some warnings precede harder failures after config edits.",),
                agreements=("Confirm intent in UGS Admin v2 before relying on current routing.",),
                next_safe_step="Review warning list in Admin snapshot and adjust providers or routes.",
            )

        return AmkaPulseArtifact(
            summary="UGS generation inventory needs operator review.",
            changed=(),
            doubts=(),
            agreements=("Use UGS Admin v2 for applying changes.",),
        )
