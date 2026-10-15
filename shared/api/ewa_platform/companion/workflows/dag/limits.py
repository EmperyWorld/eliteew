# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Tiered node quota limits for DAG workflow v2 (Phase 2).
# Invariants:
# - Regular users: max 3 nodes; verified (``User.is_verified``): max 10 nodes.
# Related:
# - documentation/product/ewa/EWA-COMPANION-WORKFLOW-ENGINE-V2.md
# ---

from __future__ import annotations

from api.ewa_platform.companion.workflows.dag.context import WorkflowValidationContext
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import CompanionWorkflowDefinitionV2

DAG_MAX_NODES_REGULAR: int = 3
DAG_MAX_NODES_VERIFIED: int = 10


def max_nodes_for_context(ctx: WorkflowValidationContext) -> int:
    return DAG_MAX_NODES_VERIFIED if ctx.is_verified_user else DAG_MAX_NODES_REGULAR


def validate_node_quota(
    definition: CompanionWorkflowDefinitionV2,
    ctx: WorkflowValidationContext,
) -> list[str]:
    limit = max_nodes_for_context(ctx)
    count = len(definition.nodes)
    if count <= limit:
        return []
    tier = "verified" if ctx.is_verified_user else "unverified"
    return [f"node quota exceeded: {count} nodes (max {limit} for {tier} users)"]


__all__ = (
    "DAG_MAX_NODES_REGULAR",
    "DAG_MAX_NODES_VERIFIED",
    "max_nodes_for_context",
    "validate_node_quota",
)
