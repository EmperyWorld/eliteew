#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# WorkflowService facade — composes domain mixins and preserves stable import path
# `api.services.ugs.workflow_service.WorkflowService`.
# Invariants:
# - Public API: WorkflowService methods and re-exported builder constants.
# - Child modules must not import this facade (lazy imports only inside runners).
# Related:
# - api/routers/ugs/workflows.py
# ---

"""
Workflow Service — visual workflow builder orchestration facade.
"""

from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.services.ugs.workflow_builder_catalog import WorkflowBuilderCatalogMixin
from api.services.ugs.workflow_builder_catalog_data import (
    BUILDER_CONTRACT_VERSION,
    LEGACY_CONDITION_OPERATORS,
    LEGACY_EXECUTABLE_NODE_TYPES,
    LEGACY_GENERATION_NODE_CATALOG,
    LEGACY_GENERATION_TYPE_MAP,
    LEGACY_TRANSFORM_TYPES,
)
from api.services.ugs.workflow_catalog_execute import WorkflowCatalogExecuteMixin
from api.services.ugs.workflow_catalog_read import WorkflowCatalogReadMixin
from api.services.ugs.workflow_crud import WorkflowCrudMixin
from api.services.ugs.workflow_graph_validation import WorkflowGraphValidationMixin
from api.services.ugs.workflow_legacy_execution_runner import WorkflowLegacyExecutionRunnerMixin
from api.services.ugs.workflow_legacy_node_runtime import WorkflowLegacyNodeRuntimeMixin
from api.services.ugs.workflow_ugs_bridge import WorkflowUgsBridgeMixin

__all__ = [
    "BUILDER_CONTRACT_VERSION",
    "LEGACY_CONDITION_OPERATORS",
    "LEGACY_EXECUTABLE_NODE_TYPES",
    "LEGACY_GENERATION_NODE_CATALOG",
    "LEGACY_GENERATION_TYPE_MAP",
    "LEGACY_TRANSFORM_TYPES",
    "WorkflowService",
]


class WorkflowService(
    WorkflowCatalogExecuteMixin,
    WorkflowLegacyExecutionRunnerMixin,
    WorkflowUgsBridgeMixin,
    WorkflowLegacyNodeRuntimeMixin,
    WorkflowGraphValidationMixin,
    WorkflowBuilderCatalogMixin,
    WorkflowCatalogReadMixin,
    WorkflowCrudMixin,
):
    """Workflow Service — manages workflows, templates, and execution lifecycle."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
