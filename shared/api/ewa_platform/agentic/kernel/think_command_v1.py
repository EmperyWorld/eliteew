# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Phase 3.2 Structured Reasoning command — discriminated union on decision_type + payload.
# Invariants:
# - JSON is transport; this model is the authority layer before loop Act dispatch.
# - Maps to loop-native AgenticThinkOutput via to_loop_output().
# Related:
# - api/ewa_platform/agentic/kernel/legacy_adapter.py
# - api/ewa_platform/agentic/kernel/engine.py
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator

from api.ewa_platform.agentic.agentic_locale import agentic_gate_title_default
from api.ewa_platform.agentic.config import agentic_max_tree_nodes
from api.ewa_platform.agentic.kernel.legacy_adapter import adapt_legacy_think_blob
from api.ewa_platform.agentic.kernel.think_schema import AgenticPlanNode, AgenticThinkOutput
from api.ewa_platform.agentic.kernel.types import AgenticContext
from api.ewa_platform.agentic.schemas.tool_args import validate_core_tool_args
from api.ewa_platform.companion.orchestration.tool_registry import REGISTRY

logger = logging.getLogger(__name__)

StructuredDecisionType = Literal["continue", "intervene", "mutate", "terminate"]


class ContinuePayload(BaseModel):
    decision_type: Literal["continue"] = "continue"
    tool_name: str = Field(min_length=1, max_length=80)
    tool_args: dict[str, Any] = Field(default_factory=dict)
    node_id: str | None = Field(default=None, max_length=64)


class IntervenePayload(BaseModel):
    decision_type: Literal["intervene"] = "intervene"
    gate_json: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _require_prompt(self) -> IntervenePayload:
        prompt = str(self.gate_json.get("prompt") or "").strip()
        if not prompt:
            raise ValueError("gate_json.prompt is required for intervene")
        return self


class MutatePayload(BaseModel):
    decision_type: Literal["mutate"] = "mutate"
    plan_nodes: list[AgenticPlanNode] = Field(default_factory=list)
    patch_instructions: str | None = Field(default=None, max_length=4000)


class TerminatePayload(BaseModel):
    decision_type: Literal["terminate"] = "terminate"


ThinkPayloadUnion = Annotated[
    ContinuePayload | IntervenePayload | MutatePayload | TerminatePayload,
    Field(discriminator="decision_type"),
]


class AgenticStructuredThinkOutput(BaseModel):
    """SRE command model (Phase 3.2). Alias: AgenticThinkOutputV1."""

    reasoning_trace: str = Field(min_length=1, max_length=8000)
    plan_update_summary: str = Field(default="", max_length=4000)
    decision_type: StructuredDecisionType
    payload: ThinkPayloadUnion = Field(discriminator="decision_type")

    @field_validator("decision_type", mode="before")
    @classmethod
    def _normalize_decision_type(cls, raw: Any) -> StructuredDecisionType:
        from api.ewa_platform.agentic.kernel.legacy_adapter import _normalize_decision

        return _normalize_decision(raw)

    @model_validator(mode="after")
    def _root_payload_decision_match(self) -> AgenticStructuredThinkOutput:
        if self.payload.decision_type != self.decision_type:
            raise ValueError(
                f"decision_type mismatch: root={self.decision_type!r} payload={self.payload.decision_type!r}"
            )
        return self

    @classmethod
    def from_llm_blob(cls, blob: Mapping[str, Any]) -> AgenticStructuredThinkOutput:
        normalized = adapt_legacy_think_blob(blob)
        return cls.model_validate(normalized)

    def validate_registry_tool(self, *, allowlist: frozenset[str] | None = None) -> None:
        if self.decision_type != "continue":
            return
        if not isinstance(self.payload, ContinuePayload):
            raise ValueError("continue decision requires ContinuePayload")
        name = self.payload.tool_name.strip()
        if name not in REGISTRY:
            raise ValueError(f"tool {name!r} is not registered")
        if allowlist is not None and name not in allowlist:
            raise ValueError(f"tool {name!r} is not in session allowlist")

    def validate_tool_args(self) -> None:
        if self.decision_type != "continue":
            return
        if not isinstance(self.payload, ContinuePayload):
            raise ValueError("continue decision requires ContinuePayload")
        normalized = validate_core_tool_args(self.payload.tool_name, self.payload.tool_args)
        self.payload.tool_args = normalized

    def truncate_plan_nodes(self, ctx: AgenticContext) -> tuple[list[AgenticPlanNode], bool]:
        if self.decision_type != "mutate" or not isinstance(self.payload, MutatePayload):
            return [], False
        nodes = list(self.payload.plan_nodes)
        total_existing = sum(int(v) for v in ctx.tree_summary.values())
        cap = agentic_max_tree_nodes()
        remaining = max(0, cap - total_existing)
        if len(nodes) <= remaining:
            return nodes, False
        logger.error(
            "[STEP] agentic_think_plan_truncated session_id=%s requested=%s cap=%s remaining=%s",
            ctx.session.get("id"),
            len(nodes),
            cap,
            remaining,
        )
        return nodes[:remaining], True

    def to_loop_output(self, ctx: AgenticContext) -> AgenticThinkOutput:
        summary = self.plan_update_summary.strip()
        rationale = self.reasoning_trace.strip()

        if self.decision_type == "terminate":
            return AgenticThinkOutput(
                action="complete",
                rationale=rationale,
                plan_summary_patch=summary or None,
            )

        if self.decision_type == "intervene" and isinstance(self.payload, IntervenePayload):
            gate = self.payload.gate_json
            kind = str(gate.get("kind") or "freeform").strip().lower()
            if kind not in {"confirm", "choose", "freeform"}:
                kind = "freeform"
            options_raw = gate.get("options")
            options: list[dict[str, str]] = []
            if isinstance(options_raw, list):
                for item in options_raw:
                    if isinstance(item, Mapping):
                        options.append(
                            {
                                "id": str(item.get("id") or ""),
                                "label": str(item.get("label") or item.get("text") or ""),
                            }
                        )
            gate_node = AgenticPlanNode(
                node_kind="gate",
                title=str(gate.get("title") or agentic_gate_title_default(ctx.session))[:240],
                gate_kind=kind,  # type: ignore[arg-type]
                gate_prompt=str(gate.get("prompt") or "")[:4000],
                gate_options=options,
            )
            return AgenticThinkOutput(
                action="gate",
                rationale=rationale,
                gate=gate_node,
                plan_summary_patch=summary or None,
            )

        if self.decision_type == "mutate" and isinstance(self.payload, MutatePayload):
            nodes, _truncated = self.truncate_plan_nodes(ctx)
            status = str(ctx.session.get("status") or "")
            if not nodes and status in {"init", "planning", "replanning"}:
                return AgenticThinkOutput(
                    action="plan",
                    rationale=rationale,
                    plan_nodes=[],
                    plan_summary_patch=summary or None,
                )
            return AgenticThinkOutput(
                action="plan",
                rationale=rationale,
                plan_nodes=nodes,
                plan_summary_patch=summary or None,
            )

        if isinstance(self.payload, ContinuePayload):
            node_id = self.payload.node_id
            if not node_id:
                pending = [n for n in ctx.active_nodes if str(n.get("status")) == "pending"]
                if pending and pending[0].get("tool_name"):
                    node_id = str(pending[0]["id"])
            return AgenticThinkOutput(
                action="act",
                rationale=rationale,
                act_node_id=node_id,
                act_tool_name=self.payload.tool_name.strip(),
                act_tool_args=dict(self.payload.tool_args or {}),
                plan_summary_patch=summary or None,
            )

        raise ValueError(f"unsupported structured think command: {self.decision_type!r}")


# Backward-compatible alias used across engine/tests.
AgenticThinkOutputV1 = AgenticStructuredThinkOutput


class ThinkSchemaError(ValueError):
    """Raised when LLM output cannot be validated as AgenticThinkOutputV1."""


def extract_json_object(raw: str) -> dict[str, Any] | None:
    text = (raw or "").strip()
    if not text:
        return None
    if text.startswith("```"):
        lines = text.splitlines()
        body: list[str] = []
        in_fence = False
        for line in lines:
            if line.strip().startswith("```"):
                if in_fence:
                    break
                in_fence = True
                continue
            if in_fence:
                body.append(line)
        text = "\n".join(body).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        return None
    import json

    try:
        parsed = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _compact_validation_loc(err: Mapping[str, Any] | dict[str, Any]) -> str:
    """Dotted Pydantic loc for checkpoint evidence (no raw LLM payload)."""

    loc = err.get("loc")
    if not isinstance(loc, (list, tuple)):
        return ""
    parts: list[str] = []
    for item in loc:
        if isinstance(item, (str, int)):
            parts.append(str(item))
    return ".".join(parts)[:80]


def format_schema_validation_failed(exc: ValidationError) -> str:
    """``schema_validation_failed:<type>[:<loc>]`` — actionable without dumping the model response."""

    errors = exc.errors()
    if not errors:
        return "schema_validation_failed:unknown"
    first = errors[0]
    err_type = str(first.get("type") or "unknown")[:48]
    loc = _compact_validation_loc(first)
    if loc:
        return f"schema_validation_failed:{err_type}:{loc}"
    return f"schema_validation_failed:{err_type}"


def parse_structured_think_from_text(raw: str) -> AgenticStructuredThinkOutput:
    blob = extract_json_object(raw)
    if blob is None:
        raise ThinkSchemaError("no_json_object_in_llm_response")
    try:
        return AgenticStructuredThinkOutput.from_llm_blob(blob)
    except ValidationError as exc:
        raise ThinkSchemaError(format_schema_validation_failed(exc)) from exc


parse_think_v1_from_text = parse_structured_think_from_text
