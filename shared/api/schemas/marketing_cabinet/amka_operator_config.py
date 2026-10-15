# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `schemas/marketing_cabinet/amka_operator_config.py`; preserves its existing EliteEW API/service responsibilities.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

"""Схема v1 для операторского конфига AMKA (конструктор)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AmkaBaselineAuditConfigV1(BaseModel):
    model_config = ConfigDict(extra="ignore")

    extra_prompt_suffix: str = Field(default="", max_length=4000)


class AmkaSectionLlmAuditConfigV1(BaseModel):
    model_config = ConfigDict(extra="ignore")

    enabled: bool = True
    delay_ms: int | None = Field(default=None, ge=0, le=60_000)
    parallelism: int | None = Field(default=None, ge=1, le=8)
    require_work_needed_quotes: bool = Field(
        default=True,
        description="Если true — отбрасывать пункты work_needed без подтверждённой цитаты «…» из контекста.",
    )
    extra_prompt_instruction: str = Field(default="", max_length=8000)


class AmkaMasterPlanConfigV1(BaseModel):
    model_config = ConfigDict(extra="ignore")

    llm_enabled: bool = True
    max_tokens: int | None = Field(default=None, ge=512, le=8000)
    extra_prompt_instruction: str = Field(default="", max_length=12000)
    retry_on_parse_failure: bool = Field(
        default=False,
        description="Повторный вызов LLM при пустом/непарсящемся JSON плана (один retry).",
    )
    repair_json_on_parse_failure: bool = Field(
        default=False,
        description="Один узкий вызов LLM для починки сырого ответа в валидный JSON (после основного вызова/retry).",
    )


class AmkaExecuteConfigV1(BaseModel):
    model_config = ConfigDict(extra="ignore")

    max_wait_seconds: float | None = Field(default=None, ge=30.0, le=7200.0)
    exclude_recent_imc_type_keys: bool = Field(
        default=False,
        description="В run_mode=auto подмешивать в exclude_imc_type_keys последние успешные type_key из imc_research_runs по проекту.",
    )
    exclude_recent_imc_type_keys_limit: int = Field(
        default=3,
        ge=0,
        le=20,
        description="Сколько последних уникальных type_key из истории проекта исключать (0 — не подмешивать даже при флаге).",
    )
    desktop_ensemble_enabled: bool = Field(
        default=True,
        description="Разрешить execution_mode=desktop_ensemble (Desktop AI Chat «Команда»).",
    )
    ensemble_fallback_to_tool_agent: bool = Field(
        default=True,
        description="При ошибке desktop_ensemble выполнить fallback на marketing_tool_agent вместо падения шага.",
    )


class AmkaFinalAssessmentConfigV1(BaseModel):
    model_config = ConfigDict(extra="ignore")

    llm_enabled: bool = True
    max_prompt_chars: int | None = Field(default=None, ge=10_000, le=500_000)
    extra_prompt_instruction: str = Field(default="", max_length=8000)


class AmkaOperatorConfigV1(BaseModel):
    model_config = ConfigDict(extra="ignore")

    schema_version: int = Field(default=1, ge=1, le=1)
    baseline_audit: AmkaBaselineAuditConfigV1 = Field(default_factory=AmkaBaselineAuditConfigV1)
    section_llm_audit: AmkaSectionLlmAuditConfigV1 = Field(default_factory=AmkaSectionLlmAuditConfigV1)
    master_plan: AmkaMasterPlanConfigV1 = Field(default_factory=AmkaMasterPlanConfigV1)
    execute: AmkaExecuteConfigV1 = Field(default_factory=AmkaExecuteConfigV1)
    final_assessment: AmkaFinalAssessmentConfigV1 = Field(default_factory=AmkaFinalAssessmentConfigV1)

    @field_validator("schema_version", mode="before")
    @classmethod
    def coerce_schema(cls, v: Any) -> int:
        try:
            return int(v)
        except (TypeError, ValueError):  # fmt: skip
            return 1


class AmkaOperatorConfigEffectiveOut(BaseModel):
    """Эффективные значения после merge с env (для UI и отладки)."""

    model_config = ConfigDict(extra="ignore")

    baseline_audit: dict[str, Any]
    section_llm_audit: dict[str, Any]
    master_plan: dict[str, Any]
    execute: dict[str, Any]
    final_assessment: dict[str, Any]


class AmkaOperatorConfigEnvCapsOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    audit_delay_ms_max: int
    audit_parallelism_max: int
    execute_max_wait_seconds_max: float
    execute_max_wait_seconds_min: float
    final_prompt_chars_max: int
    master_plan_max_tokens_max: int


class AmkaOperatorConfigBundleOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    stored: AmkaOperatorConfigV1
    effective: AmkaOperatorConfigEffectiveOut
    env_caps: AmkaOperatorConfigEnvCapsOut
    updated_at: str | None = Field(
        default=None,
        description="ISO8601 время последнего сохранения конфига (из БД).",
    )
    updated_by_user_id: str | None = Field(
        default=None,
        description="UUID пользователя, последним сохранившего конфиг.",
    )


class AmkaOperatorConfigPutBody(BaseModel):
    model_config = ConfigDict(extra="ignore")

    config: AmkaOperatorConfigV1
