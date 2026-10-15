# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Pydantic contract for **declarative EWA companion action workflows** (multi-step tool cycles).
# Used by WF-0 schema validation, future admin JSON editor, and ``action/registry`` builtins.
# Invariants:
# - ``tool`` steps reference names that must exist in ``tool_registry.REGISTRY`` (validated separately).
# - ``workflow_id`` is stable; bump ``version`` for breaking definition changes.
# Related:
# - api/ewa_platform/schemas/json/companion_workflow_v1.json
# - documentation/product/ewa/EWA-COMPANION-WORKFLOW-TOOLS-STANDARD-MASTER-PLAN.md §4.2
# ---
"""Declarative action workflow schema for EWA companion (v1)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

CompanionWorkflowStepKind = Literal["tool", "confirm_gate", "delay", "llm_compose", "noop"]

CompanionWorkflowTriggerType = Literal[
    "regex",
    "tool_router_tool",
    "quick_intent_id",
    "manual_admin",
]

CompanionWorkflowExecutionMode = Literal["sync", "async"]

_WORKFLOW_ID_PATTERN = r"^[a-z][a-z0-9_]{2,63}$"


class CompanionWorkflowStepRetryV1(BaseModel):
    """Optional per-step retry policy (WF-4 step-level)."""

    max_attempts: int = Field(default=1, ge=1, le=5)
    backoff_ms: int = Field(default=5000, ge=0, le=300_000)
    retry_on: tuple[str, ...] = ("timeout", "503", "broker_down")


class CompanionWorkflowStepV1(BaseModel):
    """One step in a declarative action workflow."""

    step_key: str = Field(min_length=1, max_length=64)
    kind: CompanionWorkflowStepKind = "tool"
    tool_name: str | None = None
    step_kind: str | None = Field(
        default=None,
        description="Optional PG ``ewa_companion_task_steps.step_kind`` override for Celery executor.",
    )
    requires_confirm: bool = False
    continue_on_error: bool = False
    delay_after_ms: int = Field(default=0, ge=0, le=300_000)
    args_template: dict[str, Any] = Field(default_factory=dict)
    title_ru: str = ""
    title_en: str = ""
    depends_on_step_keys: list[str] = Field(default_factory=list)
    retry: CompanionWorkflowStepRetryV1 | None = None

    @model_validator(mode="after")
    def _validate_tool_step(self) -> CompanionWorkflowStepV1:
        if self.kind == "tool" and not (self.tool_name or "").strip():
            msg = "tool_name is required when kind=tool"
            raise ValueError(msg)
        return self


class CompanionWorkflowTriggerV1(BaseModel):
    """How a workflow may be started."""

    type: CompanionWorkflowTriggerType
    pattern: str | None = None
    tool_name: str | None = None
    min_confidence: float = Field(default=0.65, ge=0.0, le=1.0)

    @model_validator(mode="after")
    def _validate_trigger_fields(self) -> CompanionWorkflowTriggerV1:
        if self.type == "regex" and not (self.pattern or "").strip():
            msg = "pattern is required when type=regex"
            raise ValueError(msg)
        if self.type == "tool_router_tool" and not (self.tool_name or "").strip():
            msg = "tool_name is required when type=tool_router_tool"
            raise ValueError(msg)
        return self


class CompanionWorkflowDefinitionV1(BaseModel):
    """Full declarative action workflow definition (catalog + builtins)."""

    workflow_id: str = Field(pattern=_WORKFLOW_ID_PATTERN)
    version: int = Field(ge=1)
    title_ru: str = Field(min_length=1)
    title_en: str = Field(min_length=1)
    description_ru: str = ""
    description_en: str = ""
    enabled: bool = False
    triggers: list[CompanionWorkflowTriggerV1] = Field(min_length=1)
    steps: list[CompanionWorkflowStepV1] = Field(min_length=1, max_length=20)
    execution_mode: CompanionWorkflowExecutionMode = "async"
    env_gate: str | None = None
    tags: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate_unique_step_keys(self) -> CompanionWorkflowDefinitionV1:
        keys = [s.step_key for s in self.steps]
        if len(keys) != len(set(keys)):
            msg = "step_key values must be unique within a workflow"
            raise ValueError(msg)
        known = set(keys)
        for step in self.steps:
            for dep in step.depends_on_step_keys:
                if dep not in known:
                    msg = f"depends_on_step_keys references unknown step_key: {dep!r}"
                    raise ValueError(msg)
        return self


class CompanionWorkflowValidateRequestV1(BaseModel):
    """Admin API body: validate workflow JSON without persisting."""

    definition: CompanionWorkflowDefinitionV1


class CompanionWorkflowValidateResponseV1(BaseModel):
    ok: bool = True
    workflow_id: str
    version: int
    step_count: int
    tool_names: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


def extract_workflow_tool_names(definition: CompanionWorkflowDefinitionV1) -> tuple[str, ...]:
    """Return sorted unique tool_name values from tool steps."""

    names = {s.tool_name.strip() for s in definition.steps if s.kind == "tool" and s.tool_name}
    return tuple(sorted(names))


def validate_workflow_tools_registered(
    definition: CompanionWorkflowDefinitionV1,
    *,
    registered_tools: frozenset[str],
) -> list[str]:
    """Return errors for tool steps whose tool_name is not in ``registered_tools``."""

    errors: list[str] = []
    for name in extract_workflow_tool_names(definition):
        if name not in registered_tools:
            errors.append(f"unknown tool_name in workflow: {name!r}")
    return errors


__all__ = (
    "CompanionWorkflowDefinitionV1",
    "CompanionWorkflowExecutionMode",
    "CompanionWorkflowStepKind",
    "CompanionWorkflowStepRetryV1",
    "CompanionWorkflowStepV1",
    "CompanionWorkflowTriggerType",
    "CompanionWorkflowTriggerV1",
    "CompanionWorkflowValidateRequestV1",
    "CompanionWorkflowValidateResponseV1",
    "extract_workflow_tool_names",
    "validate_workflow_tools_registered",
)
