# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pydantic contract for **declarative EWA companion DAG workflows** (schema_version 2).
# Invariants:
# - ``schema_version`` must be ``2``; stored in ``ewa_companion_user_workflows.definition_json``.
# - Node ``type`` uses abstract ops; tool mapping lives in the runner adapter layer.
# Related:
# - api/ewa_platform/schemas/json/companion_workflow_v2.json
# - documentation/product/ewa/EWA-COMPANION-WORKFLOW-ENGINE-V2.md
# ---

from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from api.ewa_platform.schemas.pydantic.companion_workflow import (
    CompanionWorkflowExecutionMode,
    CompanionWorkflowTriggerV1,
)

CompanionWorkflowNodeTypeV2 = Literal[
    "prompt_gen",
    "api_call",
    "image_gen",
    "document_import",
    "pdf_generate",
    "telegram_sender",
    "email_dispatcher",
    "vision_analyzer",
    "llm_summarizer",
    "llm_classifier",
    "pdf_parser",
    "document_extractor",
    "logic_filter",
    "confirm_gate",
    "delay",
    "decision",
    "switch",
    "print_log",
    "for_each",
    "data_transformer",
]
CompanionWorkflowNodeModeV2 = Literal["stateless", "stateful"]
CompanionWorkflowOutputTypeV2 = Literal["string", "text", "json", "boolean", "number", "image_url"]
CompanionWorkflowOnErrorStrategyV2 = Literal["stop", "retry", "fallback_value"]

_WORKFLOW_ID_PATTERN = r"^[a-z][a-z0-9_]{2,63}$"


class CompanionWorkflowSwitchCaseV2(BaseModel):
    """One labeled branch arm for a ``switch`` node."""

    branch: str = Field(min_length=1, max_length=64)
    op: str = Field(default="eq", max_length=32)
    value: Any = None
    source: str = Field(default="text", max_length=64)
    expression: str | None = Field(default=None, max_length=512)


class CompanionWorkflowNodeConfigV2(BaseModel):
    """LLM/service hyperparameters for a DAG node."""

    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=1024, ge=1, le=128_000)
    top_p: float = Field(default=1.0, ge=0.0, le=1.0)
    tool_name: str | None = Field(
        default=None,
        max_length=64,
        description="Optional override mapping to ``tool_registry`` name (``api_call`` nodes).",
    )
    delay_sec: int = Field(default=0, ge=0, le=3600)
    confirm_message_ru: str = ""
    confirm_message_en: str = ""
    condition: str | None = Field(
        default=None,
        max_length=512,
        description="Optional human-readable condition label for decision/switch nodes.",
    )
    condition_op: str | None = Field(
        default=None,
        max_length=32,
        description="Comparison operator: eq, ne, gt, gte, lt, lte, contains, truthy, length_gt, …",
    )
    condition_field: str = Field(default="text", max_length=64)
    condition_value: Any = None
    condition_expression: str | None = Field(
        default=None,
        max_length=512,
        description="Boolean expression with placeholders and AND/OR (overrides condition_op when set).",
    )
    items_field: str = Field(default="items", max_length=64)
    switch_source: str = Field(default="text", max_length=64)
    switch_cases: list[CompanionWorkflowSwitchCaseV2] = Field(default_factory=list)
    transform_op: str | None = Field(
        default=None,
        max_length=64,
        description="data_transformer operation name (json_parse, string_trim, …).",
    )
    transform_args: dict[str, Any] = Field(
        default_factory=dict,
        description="Optional op-specific args for data_transformer nodes.",
    )


class CompanionWorkflowOnErrorV2(BaseModel):
    """Per-node failure policy (circuit breaker)."""

    strategy: CompanionWorkflowOnErrorStrategyV2 = "stop"
    max_attempts: int = Field(default=3, ge=1, le=5)
    fallback_outputs: dict[str, Any] = Field(default_factory=dict)


class CompanionWorkflowOutputSpecV2(BaseModel):
    """Declared output field produced by a node."""

    type: CompanionWorkflowOutputTypeV2


class CompanionWorkflowInputSpecV2(BaseModel):
    """Expected resolved type for one node input key."""

    type: CompanionWorkflowOutputTypeV2
    required: bool = True


class CompanionWorkflowNodeV2(BaseModel):
    """One node in a DAG workflow."""

    id: UUID
    type: CompanionWorkflowNodeTypeV2
    mode: CompanionWorkflowNodeModeV2 = "stateful"
    config: CompanionWorkflowNodeConfigV2 = Field(default_factory=CompanionWorkflowNodeConfigV2)
    inputs: dict[str, Any] = Field(default_factory=dict)
    input_specs: dict[str, CompanionWorkflowInputSpecV2] = Field(default_factory=dict)
    outputs: dict[str, CompanionWorkflowOutputSpecV2] = Field(default_factory=dict)
    on_error: CompanionWorkflowOnErrorV2 = Field(default_factory=CompanionWorkflowOnErrorV2)
    title_ru: str = ""
    title_en: str = ""


class CompanionWorkflowEdgeV2(BaseModel):
    """Directed edge with optional key→template mapping and branch label."""

    source_node_id: UUID
    target_node_id: UUID
    branch: str | None = Field(
        default=None,
        max_length=64,
        description="Branch label for decision/switch nodes (e.g. yes, no, case_a, default).",
    )
    mapping_rules: dict[str, Any] = Field(default_factory=dict)


class CompanionWorkflowBuilderMetaNodePositionV2(BaseModel):
    """Canvas position for one DAG node (visual editor only)."""

    x: float
    y: float


class CompanionWorkflowBuilderMetaV2(BaseModel):
    """Visual layout metadata stored with v2 definitions; ignored by the DAG runner."""

    schema_version: Literal[1] = 1
    node_positions: dict[str, CompanionWorkflowBuilderMetaNodePositionV2] = Field(default_factory=dict)
    viewport: dict[str, float] | None = Field(
        default=None,
        description="React Flow viewport: x, y, zoom.",
    )


class CompanionWorkflowDefinitionV2(BaseModel):
    """Full declarative DAG workflow definition (user + future catalog)."""

    schema_version: Literal[2] = 2
    workflow_id: str = Field(pattern=_WORKFLOW_ID_PATTERN)
    version: int = Field(ge=1)
    title_ru: str = Field(min_length=1)
    title_en: str = Field(min_length=1)
    description_ru: str = ""
    description_en: str = ""
    enabled: bool = False
    triggers: list[CompanionWorkflowTriggerV1] = Field(min_length=1)
    nodes: list[CompanionWorkflowNodeV2] = Field(min_length=1, max_length=10)
    edges: list[CompanionWorkflowEdgeV2] = Field(default_factory=list)
    execution_mode: CompanionWorkflowExecutionMode = "async"
    env_gate: str | None = None
    tags: list[str] = Field(default_factory=list)
    builder_meta: CompanionWorkflowBuilderMetaV2 | None = Field(
        default=None,
        description="Optional visual-editor layout; not consumed by execution.",
    )

    @model_validator(mode="after")
    def _validate_graph_references(self) -> CompanionWorkflowDefinitionV2:
        node_ids = {node.id for node in self.nodes}
        if len(node_ids) != len(self.nodes):
            msg = "node id values must be unique within a workflow"
            raise ValueError(msg)
        for edge in self.edges:
            if edge.source_node_id not in node_ids:
                msg = f"edge source_node_id references unknown node: {edge.source_node_id}"
                raise ValueError(msg)
            if edge.target_node_id not in node_ids:
                msg = f"edge target_node_id references unknown node: {edge.target_node_id}"
                raise ValueError(msg)
            if edge.source_node_id == edge.target_node_id:
                msg = "self-loop edges are not allowed"
                raise ValueError(msg)
        for node in self.nodes:
            if node.on_error.strategy == "fallback_value" and not node.on_error.fallback_outputs:
                msg = f"node {node.id}: fallback_value requires non-empty on_error.fallback_outputs"
                raise ValueError(msg)
        if self.builder_meta is not None:
            node_id_strs = {str(node.id) for node in self.nodes}
            orphans = set(self.builder_meta.node_positions) - node_id_strs
            if orphans:
                msg = f"builder_meta.node_positions references unknown nodes: {sorted(orphans)}"
                raise ValueError(msg)
        return self


class CompanionWorkflowValidateV2Request(BaseModel):
    """HTTP body for validate-v2 (schema + graph checks, no execution)."""

    definition: CompanionWorkflowDefinitionV2


class CompanionWorkflowValidateV2Response(BaseModel):
    ok: bool = True
    workflow_id: str
    version: int
    node_count: int
    edge_count: int
    max_nodes_allowed: int = 3
    ordered_node_ids: list[str] = Field(default_factory=list)
    entrypoint_node_ids: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


def extract_workflow_node_types(definition: CompanionWorkflowDefinitionV2) -> tuple[str, ...]:
    """Return sorted unique abstract node types."""

    return tuple(sorted({node.type for node in definition.nodes}))


__all__ = (
    "CompanionWorkflowBuilderMetaNodePositionV2",
    "CompanionWorkflowBuilderMetaV2",
    "CompanionWorkflowDefinitionV2",
    "CompanionWorkflowEdgeV2",
    "CompanionWorkflowInputSpecV2",
    "CompanionWorkflowNodeConfigV2",
    "CompanionWorkflowNodeModeV2",
    "CompanionWorkflowNodeTypeV2",
    "CompanionWorkflowNodeV2",
    "CompanionWorkflowOnErrorStrategyV2",
    "CompanionWorkflowOnErrorV2",
    "CompanionWorkflowOutputSpecV2",
    "CompanionWorkflowOutputTypeV2",
    "CompanionWorkflowSwitchCaseV2",
    "CompanionWorkflowValidateV2Request",
    "CompanionWorkflowValidateV2Response",
    "extract_workflow_node_types",
)
