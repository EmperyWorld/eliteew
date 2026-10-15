# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Package root for the EWA companion workflow DAG engine (v2).
# Related:
# - documentation/product/ewa/EWA-COMPANION-WORKFLOW-ENGINE-V2.md
# ---

from api.ewa_platform.companion.workflows.dag.context import WorkflowValidationContext
from api.ewa_platform.companion.workflows.dag.context_switcher import build_node_tool_context
from api.ewa_platform.companion.workflows.dag.graph import build_workflow_graph, topological_sort_node_ids
from api.ewa_platform.companion.workflows.dag.limits import DAG_MAX_NODES_REGULAR, DAG_MAX_NODES_VERIFIED
from api.ewa_platform.companion.workflows.dag.runner import DagRunResult, run_workflow_dag_sync
from api.ewa_platform.companion.workflows.dag.state_registry import WorkflowStateRegistry
from api.ewa_platform.companion.workflows.dag.tool_registry_adapter import execute_tool_registry_node
from api.ewa_platform.companion.workflows.dag.validation import validate_dag_definition_for_execution
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import CompanionWorkflowDefinitionV2

__all__ = (
    "CompanionWorkflowDefinitionV2",
    "DAG_MAX_NODES_REGULAR",
    "DAG_MAX_NODES_VERIFIED",
    "DagRunResult",
    "WorkflowStateRegistry",
    "WorkflowValidationContext",
    "build_node_tool_context",
    "build_workflow_graph",
    "execute_tool_registry_node",
    "run_workflow_dag_sync",
    "topological_sort_node_ids",
    "validate_dag_definition_for_execution",
)
