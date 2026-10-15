# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Validate user workflow payloads and build ``CompanionWorkflowDefinitionV1`` for runtime.
# Invariants:
# - Only allowlisted tools; max step count enforced.
# Related:
# - api/ewa_platform/companion/workflows/user/user_workflow_allowlist.py
# ---

from __future__ import annotations

import re
import uuid
from typing import Any, Literal, Self

from api.ewa_platform.companion.workflows.user.user_workflow_allowlist import (
    USER_WORKFLOW_ALLOWED_TOOLS,
    USER_WORKFLOW_ASYNC_TOOLS,
    USER_WORKFLOW_MAX_STEPS,
    USER_WORKFLOW_TOOL_RECOMMENDED_ARGS,
    USER_WORKFLOW_TOOL_REQUIRED_ARGS,
    USER_WORKFLOW_TOOLS_REQUIRING_CONFIRM,
    sanitize_user_workflow_args,
)
from api.ewa_platform.schemas.pydantic.companion_workflow import (
    CompanionWorkflowDefinitionV1,
    CompanionWorkflowStepV1,
    CompanionWorkflowTriggerV1,
)
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import (
    CompanionWorkflowBuilderMetaV2,
    CompanionWorkflowDefinitionV2,
    CompanionWorkflowEdgeV2,
    CompanionWorkflowNodeV2,
)
from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator

_WORKFLOW_ID_RE = re.compile(r"^[a-z][a-z0-9_]{2,63}$")
_VAGUE_TRIGGER_WORDS: frozenset[str] = frozenset(
    {
        "да",
        "нет",
        "ок",
        "ok",
        "yes",
        "no",
        "go",
        "старт",
        "start",
        "run",
        "дела",
        "привет",
        "hello",
        "hi",
    }
)


class UserWorkflowStepPreviewV1(BaseModel):
    step_index: int
    step_kind: str = "tool"
    tool_name: str
    title_ru: str
    title_en: str
    async_step: bool = False
    requires_confirm: bool = False
    missing_recommended_fields: list[str] = Field(default_factory=list)


class UserWorkflowAnalysisV1(BaseModel):
    ok: bool
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    execution_mode: str = "sync"
    preview_steps: list[UserWorkflowStepPreviewV1] = Field(default_factory=list)


class UserWorkflowTriggerPhraseV1(BaseModel):
    type: str = "phrase"
    patterns: list[str] = Field(min_length=1, max_length=8)

    @field_validator("patterns")
    @classmethod
    def _normalize_patterns(cls, patterns: list[str]) -> list[str]:
        out: list[str] = []
        for raw in patterns:
            text = str(raw or "").strip()
            if not text:
                continue
            if len(text) > 200:
                msg = "trigger phrase too long"
                raise ValueError(msg)
            out.append(text)
        if not out:
            msg = "at least one trigger phrase required"
            raise ValueError(msg)
        return out


class UserWorkflowStepInV1(BaseModel):
    step_kind: Literal["tool", "confirm_gate"] = "tool"
    tool_name: str = ""
    title_ru: str = ""
    title_en: str = ""
    args_template: dict[str, Any] = Field(default_factory=dict)

    @field_validator("args_template")
    @classmethod
    def _sanitize_args(cls, value: dict[str, Any], info: Any) -> dict[str, Any]:
        step_kind = str((info.data or {}).get("step_kind") or "tool").strip()
        if step_kind == "confirm_gate":
            return {}
        tool_name = str((info.data or {}).get("tool_name") or "").strip()
        if not tool_name:
            return dict(value or {})
        return sanitize_user_workflow_args(tool_name, value)

    @field_validator("tool_name")
    @classmethod
    def _normalize_tool_name(cls, value: str) -> str:
        return str(value or "").strip()

    @model_validator(mode="after")
    def _validate_step_contract(self) -> Self:
        if self.step_kind == "confirm_gate":
            return self
        if self.tool_name not in USER_WORKFLOW_ALLOWED_TOOLS:
            msg = f"tool not allowed for user workflows: {self.tool_name!r}"
            raise ValueError(msg)
        return self


class UserWorkflowCreateInV1(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    enabled: bool = True
    trigger: UserWorkflowTriggerPhraseV1
    steps: list[UserWorkflowStepInV1] | None = Field(
        default=None,
        min_length=1,
        max_length=USER_WORKFLOW_MAX_STEPS,
    )
    dag: UserWorkflowDagBodyV2 | None = None

    @model_validator(mode="after")
    def _steps_or_dag(self) -> Self:
        has_dag = self.dag is not None
        has_steps = bool(self.steps)
        if has_dag and has_steps:
            msg = "provide either steps or dag, not both"
            raise ValueError(msg)
        if not has_dag and not has_steps:
            msg = "either steps or dag is required"
            raise ValueError(msg)
        return self


class UserWorkflowDagBodyV2(BaseModel):
    """DAG graph payload from the visual builder (nodes, edges, layout)."""

    nodes: list[CompanionWorkflowNodeV2] = Field(min_length=1, max_length=10)
    edges: list[CompanionWorkflowEdgeV2] = Field(default_factory=list)
    builder_meta: CompanionWorkflowBuilderMetaV2 | None = None
    execution_mode: Literal["sync", "async"] = "async"


class UserWorkflowPatchInV1(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    enabled: bool | None = None
    trigger: UserWorkflowTriggerPhraseV1 | None = None
    steps: list[UserWorkflowStepInV1] | None = Field(default=None, max_length=USER_WORKFLOW_MAX_STEPS)
    dag: UserWorkflowDagBodyV2 | None = None

    @model_validator(mode="after")
    def _steps_or_dag(self) -> Self:
        if self.dag is not None and self.steps is not None:
            msg = "provide either steps or dag, not both"
            raise ValueError(msg)
        return self


def _phrase_to_regex(pattern: str) -> str:
    escaped = re.escape(pattern.strip())
    return rf"(?i)\b{escaped}\b"


def build_user_workflow_definition(
    *,
    workflow_id: str,
    name: str,
    trigger: UserWorkflowTriggerPhraseV1,
    steps: list[UserWorkflowStepInV1],
    enabled: bool = True,
) -> CompanionWorkflowDefinitionV1:
    wid = str(workflow_id or "").strip().lower()
    if not _WORKFLOW_ID_RE.fullmatch(wid):
        slug = re.sub(r"[^a-z0-9_]+", "_", name.strip().lower())[:40] or "chain"
        wid = f"user_{slug}_{uuid.uuid4().hex[:8]}"

    triggers = [CompanionWorkflowTriggerV1(type="regex", pattern=_phrase_to_regex(p)) for p in trigger.patterns]
    wf_steps: list[CompanionWorkflowStepV1] = []
    for idx, step in enumerate(steps, start=1):
        if step.step_kind == "confirm_gate":
            wf_steps.append(
                CompanionWorkflowStepV1(
                    step_key=f"step_{idx}",
                    kind="confirm_gate",
                    step_kind="confirm_gate",
                    title_ru=step.title_ru or "Подтверждение",
                    title_en=step.title_en or "Confirmation",
                )
            )
            continue
        requires_confirm = step.tool_name in USER_WORKFLOW_TOOLS_REQUIRING_CONFIRM
        wf_steps.append(
            CompanionWorkflowStepV1(
                step_key=f"step_{idx}",
                kind="tool",
                tool_name=step.tool_name,
                step_kind="tool_dispatch",
                requires_confirm=requires_confirm,
                args_template={
                    **(step.args_template or {}),
                    "user_line": "{{turn.user_line}}",
                },
                title_ru=step.title_ru or step.tool_name,
                title_en=step.title_en or step.tool_name,
            )
        )

    async_tools = {s.tool_name for s in steps if s.tool_name in USER_WORKFLOW_ASYNC_TOOLS}
    execution_mode = "async" if async_tools else "sync"

    return CompanionWorkflowDefinitionV1(
        workflow_id=wid,
        version=1,
        title_ru=name.strip(),
        title_en=name.strip(),
        description_ru="",
        description_en="",
        enabled=enabled,
        triggers=triggers,
        steps=wf_steps,
        execution_mode=execution_mode,
        tags=["user_workflow"],
    )


def build_user_workflow_definition_v2(
    *,
    workflow_id: str,
    name: str,
    trigger: UserWorkflowTriggerPhraseV1,
    dag: UserWorkflowDagBodyV2,
    enabled: bool = True,
    version: int = 1,
) -> CompanionWorkflowDefinitionV2:
    """Build a schema_version=2 definition from visual-builder payload."""

    wid = str(workflow_id or "").strip().lower()
    if not _WORKFLOW_ID_RE.fullmatch(wid):
        slug = re.sub(r"[^a-z0-9_]+", "_", name.strip().lower())[:40] or "chain"
        wid = f"user_{slug}_{uuid.uuid4().hex[:8]}"

    triggers = [CompanionWorkflowTriggerV1(type="regex", pattern=_phrase_to_regex(p)) for p in trigger.patterns]

    return CompanionWorkflowDefinitionV2(
        schema_version=2,
        workflow_id=wid,
        version=max(1, int(version)),
        title_ru=name.strip(),
        title_en=name.strip(),
        description_ru="",
        description_en="",
        enabled=enabled,
        triggers=triggers,
        nodes=list(dag.nodes),
        edges=list(dag.edges),
        execution_mode=dag.execution_mode,
        tags=["user_workflow", "dag_builder"],
        builder_meta=dag.builder_meta,
    )


def apply_user_workflow_v2_metadata(
    definition: CompanionWorkflowDefinitionV2,
    *,
    name: str,
    trigger: UserWorkflowTriggerPhraseV1,
    enabled: bool,
) -> CompanionWorkflowDefinitionV2:
    """Update title/trigger/enabled on an existing v2 definition without changing the graph."""

    triggers = [CompanionWorkflowTriggerV1(type="regex", pattern=_phrase_to_regex(p)) for p in trigger.patterns]
    return definition.model_copy(
        update={
            "title_ru": name.strip(),
            "title_en": name.strip(),
            "enabled": enabled,
            "triggers": triggers,
        }
    )


def validate_user_workflow_payload(body: UserWorkflowCreateInV1) -> list[str]:
    if body.dag is not None:
        return validate_user_workflow_dag_payload(body)
    assert body.steps is not None
    return analyze_user_workflow(body).errors


def validate_user_workflow_dag_payload(
    body: UserWorkflowCreateInV1,
    *,
    is_verified_user: bool = False,
) -> list[str]:
    """Validate DAG builder payload (schema + graph checks)."""

    from api.ewa_platform.companion.workflows.dag.context import WorkflowValidationContext
    from api.ewa_platform.companion.workflows.dag.validation import validate_dag_definition_for_execution

    if body.dag is None:
        return ["dag_required"]

    try:
        definition = build_user_workflow_definition_v2(
            workflow_id="user_preview",
            name=body.name,
            trigger=body.trigger,
            dag=body.dag,
            enabled=body.enabled,
        )
    except ValidationError as exc:
        return [err.get("msg", str(exc)) for err in exc.errors()]
    except ValueError as exc:
        return [str(exc)]

    validation_ctx = WorkflowValidationContext(is_verified_user=is_verified_user)
    result = validate_dag_definition_for_execution(definition, validation_ctx)
    return list(result.errors)


def _missing_recommended_fields(step: UserWorkflowStepInV1) -> list[str]:
    recommended = USER_WORKFLOW_TOOL_RECOMMENDED_ARGS.get(step.tool_name, frozenset())
    if not recommended:
        return []
    args = sanitize_user_workflow_args(step.tool_name, step.args_template)
    missing: list[str] = []
    for key in sorted(recommended):
        if _arg_value_missing(args.get(key)):
            missing.append(key)
    return missing


def _arg_value_missing(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    return False


def _missing_required_fields(step: UserWorkflowStepInV1) -> list[str]:
    required = USER_WORKFLOW_TOOL_REQUIRED_ARGS.get(step.tool_name, frozenset())
    if not required:
        return []
    args = sanitize_user_workflow_args(step.tool_name, step.args_template)
    missing: list[str] = []
    for key in sorted(required):
        if _arg_value_missing(args.get(key)):
            missing.append(key)
    return missing


def _trigger_overlap_warnings(
    patterns: list[str],
    *,
    other_workflow_names: list[str],
) -> list[str]:
    warnings: list[str] = []
    normalized = [p.strip().lower() for p in patterns if p.strip()]
    if len(normalized) != len(set(normalized)):
        warnings.append("duplicate_trigger_phrase")
    for phrase in normalized:
        if len(phrase) < 4:
            warnings.append("trigger_phrase_too_short")
        if phrase in _VAGUE_TRIGGER_WORDS:
            warnings.append("trigger_phrase_too_vague")
    if other_workflow_names:
        warnings.append("trigger_phrase_collision")
    return warnings


def _step_order_warnings(steps: list[UserWorkflowStepInV1]) -> list[str]:
    warnings: list[str] = []
    async_indexes = [idx for idx, step in enumerate(steps, start=1) if step.tool_name in USER_WORKFLOW_ASYNC_TOOLS]
    if len(async_indexes) > 1:
        warnings.append("multiple_async_steps")
    for async_idx in async_indexes:
        if async_idx < len(steps):
            next_step = steps[async_idx]
            if next_step.tool_name not in USER_WORKFLOW_ASYNC_TOOLS:
                warnings.append("sync_step_after_async")
    confirm_indexes = [
        idx for idx, step in enumerate(steps, start=1) if step.tool_name in USER_WORKFLOW_TOOLS_REQUIRING_CONFIRM
    ]
    if confirm_indexes and confirm_indexes[-1] < len(steps):
        warnings.append("confirm_step_not_last")
    return warnings


def analyze_user_workflow(
    body: UserWorkflowCreateInV1,
    *,
    other_workflow_names: list[str] | None = None,
) -> UserWorkflowAnalysisV1:
    """Validate workflow payload and return operator-facing preview + warnings."""

    if body.dag is not None:
        errors = validate_user_workflow_dag_payload(body)
        warnings = _trigger_overlap_warnings(
            list(body.trigger.patterns),
            other_workflow_names=list(other_workflow_names or []),
        )
        return UserWorkflowAnalysisV1(
            ok=not errors,
            errors=errors,
            warnings=warnings,
            execution_mode=str(body.dag.execution_mode),
            preview_steps=[],
        )

    errors: list[str] = []
    warnings: list[str] = []
    preview_steps: list[UserWorkflowStepPreviewV1] = []

    try:
        wf = build_user_workflow_definition(
            workflow_id="user_preview",
            name=body.name,
            trigger=body.trigger,
            steps=body.steps or [],
            enabled=body.enabled,
        )
    except ValueError as exc:
        return UserWorkflowAnalysisV1(ok=False, errors=[str(exc)])

    warnings.extend(
        _trigger_overlap_warnings(
            list(body.trigger.patterns),
            other_workflow_names=list(other_workflow_names or []),
        )
    )
    warnings.extend(_step_order_warnings(list(body.steps or [])))

    for idx, step in enumerate(body.steps or [], start=1):
        if step.step_kind == "confirm_gate":
            preview_steps.append(
                UserWorkflowStepPreviewV1(
                    step_index=idx,
                    step_kind="confirm_gate",
                    tool_name="confirm_gate",
                    title_ru=step.title_ru or "Подтверждение",
                    title_en=step.title_en or "Confirmation",
                    requires_confirm=True,
                )
            )
            continue
        missing_required = _missing_required_fields(step)
        if missing_required:
            errors.append(f"step_{idx}_missing_required:{','.join(missing_required)}")
        missing = _missing_recommended_fields(step)
        if missing:
            warnings.append(f"step_{idx}_missing_recommended:{','.join(missing)}")
        preview_steps.append(
            UserWorkflowStepPreviewV1(
                step_index=idx,
                step_kind="tool",
                tool_name=step.tool_name,
                title_ru=step.title_ru or step.tool_name,
                title_en=step.title_en or step.tool_name,
                async_step=step.tool_name in USER_WORKFLOW_ASYNC_TOOLS,
                requires_confirm=step.tool_name in USER_WORKFLOW_TOOLS_REQUIRING_CONFIRM,
                missing_recommended_fields=missing,
            )
        )

    # Deduplicate warnings while preserving order.
    seen: set[str] = set()
    deduped_warnings: list[str] = []
    for code in warnings:
        if code in seen:
            continue
        seen.add(code)
        deduped_warnings.append(code)

    return UserWorkflowAnalysisV1(
        ok=not errors,
        errors=errors,
        warnings=deduped_warnings,
        execution_mode=str(wf.execution_mode or "sync"),
        preview_steps=preview_steps,
    )


async def analyze_user_workflow_with_collisions(
    pool: Any,
    *,
    principal_id: str,
    body: UserWorkflowCreateInV1,
    exclude_workflow_id: str | None = None,
) -> UserWorkflowAnalysisV1:
    """Like ``analyze_user_workflow`` but checks enabled workflows for trigger overlap."""

    from api.ewa_platform.persistence_pg import companion_user_workflows_asyncpg as user_wf_pg

    other_names: list[str] = []
    patterns = [p.strip().lower() for p in body.trigger.patterns if p.strip()]
    rows = await user_wf_pg.companion_user_workflows_list_enabled(pool, principal_id=principal_id)
    for row in rows:
        row_id = str(row.get("id") or "").strip()
        if exclude_workflow_id and row_id == exclude_workflow_id:
            continue
        trig = row.get("trigger_json")
        if not isinstance(trig, dict):
            continue
        raw_patterns = trig.get("patterns")
        if not isinstance(raw_patterns, list):
            continue
        for other in raw_patterns:
            other_norm = str(other or "").strip().lower()
            if other_norm and other_norm in patterns:
                name = str(row.get("name") or row_id).strip()
                if name:
                    other_names.append(name)
                break

    if body.dag is not None:
        dag_errors = validate_user_workflow_dag_payload(
            body,
            is_verified_user=False,
        )
        warnings = _trigger_overlap_warnings(list(body.trigger.patterns), other_workflow_names=other_names)
        return UserWorkflowAnalysisV1(
            ok=not dag_errors,
            errors=dag_errors,
            warnings=warnings,
            execution_mode=str(body.dag.execution_mode if body.dag else "async"),
            preview_steps=[],
        )

    return analyze_user_workflow(body, other_workflow_names=other_names)


__all__ = (
    "UserWorkflowAnalysisV1",
    "UserWorkflowCreateInV1",
    "UserWorkflowDagBodyV2",
    "UserWorkflowPatchInV1",
    "UserWorkflowStepInV1",
    "UserWorkflowStepPreviewV1",
    "UserWorkflowTriggerPhraseV1",
    "analyze_user_workflow",
    "analyze_user_workflow_with_collisions",
    "apply_user_workflow_v2_metadata",
    "build_user_workflow_definition",
    "build_user_workflow_definition_v2",
    "validate_user_workflow_dag_payload",
    "validate_user_workflow_payload",
)
