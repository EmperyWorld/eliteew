# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Defines Pydantic contracts for Marketing Cabinet AMKA runs, steps, controls, and detail responses.
# The schema is backward-compatible with the current AMKA API and accepts additive standalone fields.
# Invariants:
# - Existing run/step fields stay source-compatible for frontend clients.
# - New standalone artifacts, such as pulse and core-alignment traces, are additive and optional from older persisted data.
# Related:
# - shared/api/routers/marketing_cabinet/amka.py
# - shared/api/services/marketing_cabinet/amka_pulse.py
# - shared/api/services/amka_core/marketing_core_bridge.py
# ---
from __future__ import annotations

from typing import Any, Literal

from api.schemas.marketing_web_search import WebSearchQuality
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator  # type: ignore[import-untyped]

AmkaRunStatus = Literal[
    "planning",
    "awaiting_approval",
    "awaiting_step_approval",
    "queued",
    "running",
    "completed",
    "failed",
    "cancelled",
]

AmkaStepStatus = Literal[
    "pending",
    "running",
    "completed",
    "failed",
    "skipped",
]

AmkaStageKind = Literal[
    "section_audit",
    "master_plan",
    "execute_section",
    "final_assessment",
]

AmkaSectionKey = Literal[
    "overview",
    "companies",
    "projects",
    "team",
    "jtbd",
    "value",
    "analysis",
    "evidence",
    "project_rag",
    "segments",
    "campaigns",
    "funnel",
    "tasks",
    "alerts",
    "dashboard",
    "imc",
    "client_interaction",
]

AmkaScopeKey = Literal["all_visible"]

AmkaImcFocus = Literal["global", "rf", "mixed"]

AmkaRunMode = Literal["auto", "semi_auto"]


class AmkaSourceRefOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    type: str
    id: str
    title: str | None = None
    status: str | None = None
    excerpt: str | None = None
    content_id: str | None = None
    target_section: str | None = None
    included_in_rag: bool | None = None


class AmkaOperationOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    operation_key: str | None = None
    kind: str
    entity_type: str | None = None
    entity_id: str | None = None
    target_section: str | None = None
    title: str | None = None
    reason: str | None = None
    expected_effect: str | None = None
    destructive: bool = False
    requires_backup: bool = False
    status: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    replacement_payload: dict[str, Any] = Field(default_factory=dict)
    source_refs: list[AmkaSourceRefOut] = Field(default_factory=list)
    source_ref: dict[str, Any] = Field(default_factory=dict)
    before_snapshot: dict[str, Any] = Field(default_factory=dict)
    after_snapshot: dict[str, Any] = Field(default_factory=dict)
    result: dict[str, Any] = Field(default_factory=dict)
    mutated_entity_ids: list[str] = Field(default_factory=list)


class AmkaPlanTaskOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    step_key: str
    section_key: str
    title: str
    rationale: str | None = None
    depends_on: list[str] = Field(default_factory=list)
    write_policy: str | None = None
    autofill_targets: list[str] = Field(default_factory=list)
    operations: list[AmkaOperationOut] = Field(default_factory=list)


class AmkaRunOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    project_id: str
    company_id: str
    created_by_user_id: str
    scope_key: str
    status: str
    current_stage: str | None = None
    progress: int = 0
    progress_message: str | None = None
    plan_source: str | None = None
    plan_llm_status: str | None = Field(
        default=None,
        description="Статус разбора LLM master plan: ok, empty, parse_error, error, disabled, not_applicable, heuristic_fallback.",
    )
    plan_llm_parse_reason: str | None = None
    plan_llm_response_chars: int | None = None
    plan_llm_retried: bool | None = None
    plan_used_llm_tasks: bool | None = Field(
        default=None,
        description="True, если итоговые задачи плана взяты из нормализованного ответа LLM (не откат на кандидатов).",
    )
    plan_llm_repair_attempted: bool | None = None
    plan_llm_repaired: bool | None = None
    plan_structure_errors: list[str] | None = Field(
        default=None,
        description="Краткие коды ошибок структуры ответа LLM master plan (до нормализации).",
    )
    audit_llm_stats: dict[str, Any] | None = None
    master_plan_summary: str | None = None
    master_plan: list[AmkaPlanTaskOut] = Field(default_factory=list)
    final_summary_markdown: str | None = None
    final_assessment: dict[str, Any] = Field(default_factory=dict)
    metrics_before: dict[str, Any] = Field(default_factory=dict)
    metrics_after: dict[str, Any] = Field(default_factory=dict)
    error_payload: dict[str, Any] = Field(default_factory=dict)
    approved_at: str | None = None
    started_at: str | None = None
    completed_at: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    run_mode: str | None = None
    auto_cycle_index: int | None = None
    auto_cycle_total: int | None = None
    auto_cycle_group_id: str | None = None
    preset_id: str | None = Field(
        default=None,
        description="Необязательный пресет проекта (доп. шаги плана).",
    )


class AmkaRunStepOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    run_id: str
    ordinal: int
    stage_kind: str
    section_key: str | None = None
    title: str
    status: str
    plan_payload: dict[str, Any] = Field(default_factory=dict)
    report_markdown: str | None = None
    report_payload: dict[str, Any] = Field(default_factory=dict)
    applied_entities: list[dict[str, Any]] = Field(default_factory=list)
    operation_trail: list[AmkaOperationOut] = Field(default_factory=list)
    metrics_before: dict[str, Any] = Field(default_factory=dict)
    metrics_after: dict[str, Any] = Field(default_factory=dict)
    error_payload: dict[str, Any] = Field(default_factory=dict)
    started_at: str | None = None
    completed_at: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class AmkaRunListResponse(BaseModel):
    items: list[AmkaRunOut]
    total: int
    poll_after_ms: int = Field(
        default=0,
        description="Интервал опроса UI (мс), если в списке есть незавершённые запуски; 0 если все терминальны.",
    )
    recent_runs_digest: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Последние завершённые запуски AMKA по проекту (кратко, для UI/памяти).",
    )
    recent_runs_digest_markdown: str = Field(
        default="",
        description="Тот же дайджест в markdown для read-only блока в кабинете.",
    )


class AmkaRunDetailResponse(BaseModel):
    run: AmkaRunOut
    steps: list[AmkaRunStepOut]
    poll_after_ms: int = 2000
    pulse: dict[str, Any] = Field(
        default_factory=dict,
        description="Human-facing AMKA pulse: changes, preserved state, doubts, agreements, and no-op reason.",
    )
    standalone_projection: dict[str, Any] = Field(
        default_factory=dict,
        description="Read-only projection of the marketing run through the standalone AMKA driver boundary.",
    )
    overview_health_preview: dict[str, Any] = Field(default_factory=dict)


class AmkaCoreAlignmentOut(BaseModel):
    """Read-only AmkaCoreEngine alignment for an existing run (persisted plan, no act())."""

    model_config = ConfigDict(extra="ignore")

    status: str = Field(description="AmkaCoreRunStatus value from the engine.")
    pulse: dict[str, Any] = Field(default_factory=dict)
    policy: dict[str, Any] = Field(default_factory=dict)
    projection: dict[str, Any] = Field(default_factory=dict)
    observations: dict[str, Any] = Field(default_factory=dict)
    traces: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Normalized AmkaCoreEngine trace timeline (stage, event, message, payload).",
    )
    task_preview: list[dict[str, Any]] = Field(default_factory=list)
    task_count: int = 0


class AmkaAsyncStartResponse(BaseModel):
    run: AmkaRunOut
    poll_after_ms: int = 2000


class AmkaStartRequest(BaseModel):
    project_id: str
    company_id: str
    scope_key: AmkaScopeKey = "all_visible"
    user_instruction: str | None = Field(
        default=None,
        max_length=4000,
        description="Optional operator note about emphasis or constraints for the audit.",
    )
    section_keys: list[AmkaSectionKey] | None = Field(
        default=None,
        max_length=24,
        description="Optional subset of cabinet sections; transitive dependencies are added server-side.",
    )
    imc_type_key: str | None = Field(
        default=None,
        min_length=3,
        max_length=100,
        description="Default IMC research type_key when the plan does not override it.",
    )
    imc_focus: AmkaImcFocus | None = Field(
        default=None,
        description='Passed to ImcRunResearchRequest context.focus ("global" | "rf" | "mixed").',
    )
    imc_max_wait_seconds: int | None = Field(
        default=None,
        ge=10,
        le=3600,
        description="Max seconds to wait for IMC terminal status during execute_section (capped by server settings).",
    )
    run_mode: AmkaRunMode = Field(
        default="semi_auto",
        description="semi_auto: await plan approval. auto: start execution immediately after planning.",
    )
    per_step_execution: bool = Field(
        default=False,
        description="When true (semi_auto only), pause after each execute_section until POST continue-step.",
    )
    auto_cycle_count: int | None = Field(
        default=None,
        ge=1,
        le=5,
        description="Number of full AMKA runs in a row when run_mode=auto (ignored for semi_auto).",
    )

    preset_id: str | None = Field(
        default=None,
        description="UUID пресета проекта; дополнительные задачи плана подмешиваются при планировании.",
    )
    use_web_search: bool = Field(
        default=False,
        description="Legacy flag; when true and web_search_quality omitted, treated as standard.",
    )
    web_search_quality: WebSearchQuality = Field(
        default="off",
        description="Web search depth for AMKA IMC steps: off | light | standard | deep.",
    )

    @model_validator(mode="after")
    def validate_auto_cycles(self) -> AmkaStartRequest:
        if self.run_mode == "semi_auto" and self.auto_cycle_count is not None:
            msg = "auto_cycle_count is only allowed when run_mode is 'auto'"
            raise ValueError(msg)
        if self.per_step_execution and self.run_mode != "semi_auto":
            msg = "per_step_execution is only allowed when run_mode is 'semi_auto'"
            raise ValueError(msg)
        return self

    @field_validator("section_keys", mode="before")
    @classmethod
    def dedupe_section_keys(cls, v: object) -> object:
        if not isinstance(v, list):
            return v
        seen: set[str] = set()
        out: list[str] = []
        for item in v:
            s = str(item).strip()
            if s and s not in seen:
                seen.add(s)
                out.append(s)
        return out


class EwaApproveRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    skip_section_keys: list[str] = Field(
        default_factory=list,
        max_length=32,
        description="Execute_section steps for these section_key values are marked skipped before execution.",
    )
    skip_step_ids: list[str] = Field(
        default_factory=list,
        max_length=64,
        description="Pending execute_section steps with these UUID ids are skipped (for duplicate section_key e.g. several imc).",
    )
    skip_operation_keys: list[str] = Field(
        default_factory=list,
        max_length=64,
        description="Operations with these operation_key values are removed from master_plan and pending steps.",
    )


class AmkaResumeRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    skip_section_keys: list[str] = Field(
        default_factory=list,
        max_length=32,
        description="When resuming awaiting_approval, same as approve skip_section_keys.",
    )
    skip_step_ids: list[str] = Field(
        default_factory=list,
        max_length=64,
        description="When resuming awaiting_approval, same as approve skip_step_ids.",
    )
    skip_operation_keys: list[str] = Field(
        default_factory=list,
        max_length=64,
        description="When resuming awaiting_approval, same as approve skip_operation_keys.",
    )


class EwaApproveResponse(BaseModel):
    ok: bool = True
    run: AmkaRunOut
    poll_after_ms: int = 2000


class AmkaCancelResponse(BaseModel):
    ok: bool = True
    run: AmkaRunOut


class AmkaResumeResponse(BaseModel):
    ok: bool = True
    run: AmkaRunOut
    poll_after_ms: int = 2000


class AmkaContinueStepResponse(BaseModel):
    ok: bool = True
    run: AmkaRunOut
    poll_after_ms: int = 2000
