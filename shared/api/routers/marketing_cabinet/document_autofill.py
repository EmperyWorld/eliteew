# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# HTTP API for marketing document/project autofill preview and apply flows.
# Invariants:
# - Preview shape filtering must reject mixed-section model rows before persistence.
# - Funnel/JTBD normalizers keep generated drafts compatible with cabinet entity schemas.
# - Structured autofill uses UGS ``document_structured_extract`` with stack2 ``format=json`` (no text_chat fallback).
# Related:
# - api/routers/marketing_cabinet/autofill_draft_normalize.py
# ---
from __future__ import annotations

import hashlib
import json
import logging
import re
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]
import httpx  # type: ignore[import-untyped]
from fastapi import APIRouter, Depends, HTTPException, status  # type: ignore[import-untyped]
from pydantic import BaseModel, Field, TypeAdapter, field_validator, model_validator  # type: ignore[import-untyped]

from api.routers.marketing_cabinet.ai_support import (
    build_marketing_queue_snapshot,
    ensure_marketing_idempotency,
    get_marketing_ai_service,
    record_marketing_ai_run,
)
from api.routers.marketing_cabinet.analysis import _create_swot_analysis
from api.routers.marketing_cabinet.autofill_draft_normalize import (
    _coerce_nonneg_int,
    ensure_dict_name_from_aliases,
    normalize_funnel_draft_stages_field,
)
from api.routers.marketing_cabinet.common import (
    build_project_context,
    extract_json_payload,
    format_project_context_for_prompt,
    get_accessible_project,
    get_marketing_db_pool,
    get_marketing_user_id,
    normalize_content_item,
)
from api.routers.marketing_cabinet.competitors import (
    COMPETITOR_MARKET_POSITION_MAX_LEN,
    COMPETITOR_PRICING_STRATEGY_MAX_LEN,
    normalize_competitor_market_position_for_db,
    normalize_competitor_pricing_strategy_for_db,
    normalize_competitor_type_for_db,
    prepare_competitor_write_fields,
)
from api.routers.marketing_cabinet.funnels import FunnelStageInput, _insert_funnel_stages
from api.routers.marketing_cabinet.jtbd import (
    _insert_job_story_with_connection,
    _validate_job_category_enum,
    _validate_job_priority_enum,
    normalize_job_category_for_db,
    normalize_job_priority_for_db,
)
from api.routers.marketing_cabinet.rate_limit import check_marketing_cabinet_ai_rate_limit
from api.routers.marketing_cabinet.researches import (
    _coerce_research_priority_value,
    _coerce_research_status_value,
    _coerce_research_type_value,
    _validate_research_priority_enum,
    _validate_research_status_enum,
    _validate_research_type_enum,
)
from api.routers.marketing_cabinet.value_proposition import (
    _coerce_value_prop_status_value,
    _validate_value_prop_status_enum,
)
from api.schemas.marketing_cabinet import MarketingAiAsyncStartResponse, MarketingDocumentAutofillResponse
from api.services.marketing_cabinet.document_project_generate_service import (
    enqueue_document_generate_from_project,
)
from api.services.marketing_cabinet_ai_service import MarketingCabinetAIService
from api.services.marketing_project_rag_service import merge_project_context_text_with_rag

router = APIRouter(prefix="/autofill", tags=["Marketing Cabinet - Document Autofill"])
logger = logging.getLogger("api.routers.marketing_cabinet.document_autofill")

_MAX_SOURCE_TEXT_LENGTH = 18_000


class AutofillTarget(StrEnum):
    JTBD = "jtbd"
    VALUE_PROPOSITIONS = "value_propositions"
    SWOT = "swot"
    COMPETITORS = "competitors"
    RESEARCHES = "researches"
    SEGMENTS = "segments"
    CAMPAIGNS = "campaigns"
    FUNNELS = "funnels"
    TASKS = "tasks"
    ALERTS = "alerts"


class AutofillMode(StrEnum):
    PREVIEW = "preview"
    APPLY = "apply"


class DocumentAutofillDraftInput(BaseModel):
    draft_id: str = Field(..., min_length=2, max_length=80)
    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=2000)
    payload: dict[str, Any] = Field(default_factory=dict)
    evidence: list[str] = Field(default_factory=list)


class MarketingDocumentAutofillRequest(BaseModel):
    project_id: UUID
    content_id: UUID
    target_section: AutofillTarget
    mode: AutofillMode = AutofillMode.PREVIEW
    user_instruction: str | None = Field(default=None, max_length=2000)
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=120)
    draft_items: list[DocumentAutofillDraftInput] = Field(default_factory=list)
    selected_item_ids: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_apply_payload(self) -> MarketingDocumentAutofillRequest:
        if self.mode == AutofillMode.APPLY and not self.draft_items:
            raise ValueError("Для режима apply нужно передать draft_items из preview")
        return self


class MarketingDocumentProjectGenerateRequest(BaseModel):
    """Генерация черновиков раздела только из контекста проекта + RAG (без файла)."""

    project_id: UUID
    target_section: AutofillTarget
    user_instruction: str | None = Field(default=None, max_length=2000)
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=120)


# Стабильный UUID для метаданных async_job (не строка unified_content).
_PROJECT_CONTEXT_SOURCE_ID = UUID("00000000-0000-4000-8000-000000000001")


def _is_project_context_source_id(content_id: UUID) -> bool:
    return content_id == _PROJECT_CONTEXT_SOURCE_ID


def _synthetic_project_source_content_item() -> dict[str, Any]:
    return {
        "id": str(_PROJECT_CONTEXT_SOURCE_ID),
        "name": "Контекст проекта (AI)",
        "content_type": "project_context",
        "description": "Генерация без приложенного файла; источник — карточка проекта и RAG.",
        "processing_status": "complete",
        "project_id": None,
        "company_id": None,
        "mime_type": "application/x-eliteew-project-context",
    }


class StructuredDraftBase(BaseModel):
    evidence: list[str] = Field(default_factory=list)


_JTBD_DUPLICATE_MARKER_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\b(когда)\s+\1\b", re.IGNORECASE),
    re.compile(r"\b(я\s+хочу)\s+\1\b", re.IGNORECASE),
    re.compile(r"\b(чтобы)\s+\1(?:\s+\1)*\b", re.IGNORECASE),
)


def sanitize_generated_duplicate_markers(value: object) -> object:
    """Remove common LLM duplicate markers before preview/apply persistence."""
    if not isinstance(value, str):
        return value
    text = " ".join(value.split())
    for pattern in _JTBD_DUPLICATE_MARKER_PATTERNS:
        text = pattern.sub(lambda m: m.group(1), text)
    return text.strip()


def sanitize_jtbd_generated_text(value: object) -> object:
    """Remove common LLM duplicate JTBD markers before preview/apply persistence."""
    return sanitize_generated_duplicate_markers(value)


class JobStoryDraft(StructuredDraftBase):
    title: str = Field(..., min_length=3, max_length=255)
    situation: str = Field(..., min_length=3)
    motivation: str = Field(..., min_length=3)
    expected_outcome: str = Field(..., min_length=3)
    category: str = Field(default="functional")
    priority: str = Field(default="medium")
    importance_score: float | None = Field(default=None, ge=0, le=10)
    satisfaction_score: float | None = Field(default=None, ge=0, le=10)
    tags: list[str] = Field(default_factory=list)

    @field_validator("title", "situation", "motivation", "expected_outcome", mode="before")
    @classmethod
    def jtbd_text_sanitize(cls, value: object) -> object:
        return sanitize_jtbd_generated_text(value)

    @field_validator("category", mode="before")
    @classmethod
    def job_category_normalize(cls, value: object) -> str:
        if value is None or (isinstance(value, str) and not value.strip()):
            return "functional"
        return normalize_job_category_for_db(str(value))

    @field_validator("category")
    @classmethod
    def job_category_validate(cls, value: str) -> str:
        return _validate_job_category_enum(value)

    @field_validator("priority", mode="before")
    @classmethod
    def job_priority_normalize(cls, value: object) -> str:
        if value is None or (isinstance(value, str) and not value.strip()):
            return "medium"
        return normalize_job_priority_for_db(str(value))

    @field_validator("priority")
    @classmethod
    def job_priority_validate(cls, value: str) -> str:
        return _validate_job_priority_enum(value)


class ValuePropositionDraft(StructuredDraftBase):
    headline: str | None = Field(default=None, max_length=255)
    subheadline: str | None = Field(default=None, max_length=500)
    value_statement: str = Field(..., min_length=10)
    proof_points: list[str] = Field(default_factory=list)
    target_channels: list[str] = Field(default_factory=list)
    status: str = Field(default="draft")
    job_story_ids: list[UUID] = Field(default_factory=list)
    job_story_titles: list[str] = Field(default_factory=list)

    @field_validator("status", mode="before")
    @classmethod
    def value_prop_status_normalize(cls, value: object) -> object:
        return _coerce_value_prop_status_value(value)

    @field_validator("status")
    @classmethod
    def value_prop_status_validate(cls, value: str) -> str:
        return _validate_value_prop_status_enum(value)


class SwotDraft(StructuredDraftBase):
    title: str = Field(..., min_length=3, max_length=255)
    description: str | None = None
    executive_summary: str | None = None
    company_name: str | None = Field(default=None, max_length=255)
    industry: str | None = Field(default=None, max_length=255)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    opportunities: list[str] = Field(default_factory=list)
    threats: list[str] = Field(default_factory=list)


class CompetitorDraft(StructuredDraftBase):
    name: str = Field(..., min_length=2, max_length=255)
    website: str | None = Field(default=None, max_length=500)
    description: str | None = None
    competitor_type: str = Field(default="direct")
    market_position: str | None = Field(default=None, max_length=COMPETITOR_MARKET_POSITION_MAX_LEN)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    pricing_strategy: str | None = Field(default=None, max_length=COMPETITOR_PRICING_STRATEGY_MAX_LEN)

    @field_validator("competitor_type", mode="before")
    @classmethod
    def _coerce_competitor_type(cls, value: object) -> str:
        return normalize_competitor_type_for_db(str(value) if value is not None else None)

    @field_validator("market_position", mode="before")
    @classmethod
    def _coerce_market_position(cls, value: object) -> object:
        if value is None:
            return None
        return normalize_competitor_market_position_for_db(str(value))

    @field_validator("pricing_strategy", mode="before")
    @classmethod
    def _coerce_pricing_strategy(cls, value: object) -> object:
        if value is None:
            return None
        return normalize_competitor_pricing_strategy_for_db(str(value))


class ResearchDraft(StructuredDraftBase):
    title: str = Field(..., min_length=3, max_length=500)
    research_type: str = Field(default="market")
    research_query: str = Field(..., min_length=3)
    description: str | None = None
    goals: list[str] = Field(default_factory=list)
    priority: str = Field(default="normal")
    status: str = Field(default="draft")
    result_summary: str | None = None

    @field_validator("research_type", mode="before")
    @classmethod
    def research_type_normalize(cls, value: object) -> object:
        return _coerce_research_type_value(value)

    @field_validator("research_type")
    @classmethod
    def research_type_validate(cls, value: str) -> str:
        return _validate_research_type_enum(value)

    @field_validator("priority", mode="before")
    @classmethod
    def research_priority_normalize(cls, value: object) -> object:
        return _coerce_research_priority_value(value)

    @field_validator("priority")
    @classmethod
    def research_priority_validate(cls, value: str) -> str:
        return _validate_research_priority_enum(value)

    @field_validator("status", mode="before")
    @classmethod
    def research_status_normalize(cls, value: object) -> object:
        return _coerce_research_status_value(value)

    @field_validator("status")
    @classmethod
    def research_status_validate(cls, value: str) -> str:
        return _validate_research_status_enum(value)


class SegmentDraft(StructuredDraftBase):
    name: str = Field(..., min_length=2, max_length=255)
    description: str | None = None
    segment_type: str = Field(default="icp")
    status: str = Field(default="draft")
    priority: str = Field(default="medium")
    estimated_reach: int = Field(default=0, ge=0)
    fit_score: float | None = Field(default=None, ge=0, le=100)
    pain_points: list[str] = Field(default_factory=list)
    gains: list[str] = Field(default_factory=list)
    linked_job_story_titles: list[str] = Field(default_factory=list)
    linked_competitor_names: list[str] = Field(default_factory=list)


class CampaignDraft(StructuredDraftBase):
    name: str = Field(..., min_length=2, max_length=255)
    objective: str | None = None
    channel: str = Field(default="organic")
    status: str = Field(default="draft")
    priority: str = Field(default="medium")
    owner_name: str | None = Field(default=None, max_length=255)
    hypothesis: str | None = None
    budget: float | None = Field(default=None, ge=0)
    target_metric_name: str | None = Field(default=None, max_length=255)
    target_metric: float | None = None
    actual_metric: float | None = None
    linked_segment_names: list[str] = Field(default_factory=list)
    linked_value_prop_titles: list[str] = Field(default_factory=list)
    start_date: str | None = None
    end_date: str | None = None


class FunnelStageDraft(BaseModel):
    stage_name: str = Field(..., min_length=2, max_length=255)
    stage_order: int = Field(default=0, ge=0)
    visitors: int = Field(default=0, ge=0)
    conversions: int = Field(default=0, ge=0)
    conversion_rate: float | None = None

    @field_validator("visitors", "conversions", "stage_order", mode="before")
    @classmethod
    def _coerce_funnel_stage_int_fields(cls, value: object) -> int:
        """JSON от LLM часто содержит null; default= в Field не подставляется для явного null."""
        return _coerce_nonneg_int(value, default=0)


class FunnelDraft(StructuredDraftBase):
    name: str = Field(..., min_length=2, max_length=255)
    status: str = Field(default="draft")
    primary_goal: str | None = None
    stages: list[FunnelStageDraft] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def normalize_funnel_stages_shape(cls, data: object) -> object:
        return normalize_funnel_draft_stages_field(data)


class TaskDraft(StructuredDraftBase):
    title: str = Field(..., min_length=2, max_length=255)
    description: str | None = None
    status: str = Field(default="open")
    priority: str = Field(default="medium")
    owner_name: str | None = Field(default=None, max_length=255)
    due_at: str | None = None


class AlertDraft(StructuredDraftBase):
    title: str = Field(..., min_length=2, max_length=255)
    description: str | None = None
    severity: str = Field(default="medium")
    status: str = Field(default="open")
    owner_name: str | None = Field(default=None, max_length=255)


_SECTION_ADAPTERS: dict[AutofillTarget, TypeAdapter[Any]] = {
    AutofillTarget.JTBD: TypeAdapter(list[JobStoryDraft]),
    AutofillTarget.VALUE_PROPOSITIONS: TypeAdapter(list[ValuePropositionDraft]),
    AutofillTarget.SWOT: TypeAdapter(list[SwotDraft]),
    AutofillTarget.COMPETITORS: TypeAdapter(list[CompetitorDraft]),
    AutofillTarget.RESEARCHES: TypeAdapter(list[ResearchDraft]),
    AutofillTarget.SEGMENTS: TypeAdapter(list[SegmentDraft]),
    AutofillTarget.CAMPAIGNS: TypeAdapter(list[CampaignDraft]),
    AutofillTarget.FUNNELS: TypeAdapter(list[FunnelDraft]),
    AutofillTarget.TASKS: TypeAdapter(list[TaskDraft]),
    AutofillTarget.ALERTS: TypeAdapter(list[AlertDraft]),
}

_FLOAT_LIKE_KEYS = {
    "importance_score",
    "satisfaction_score",
    "fit_score",
    "budget",
    "target_metric",
    "actual_metric",
    "conversion_rate",
}
_INT_LIKE_KEYS = {
    "estimated_reach",
    "stage_order",
    "visitors",
    "conversions",
}
_NUMERIC_RANGE_RE = re.compile(r"^\s*(-?\d+(?:[.,]\d+)?)\s*[-–]\s*(-?\d+(?:[.,]\d+)?)\s*$")


def _normalize_lookup_key(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]+", " ", value.lower(), flags=re.UNICODE)).strip()


def _coerce_string_list(value: object) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return []


def _parse_number_token(token: str) -> float | None:
    candidate = token.strip().replace(" ", "")
    if not candidate:
        return None
    candidate = candidate.replace(",", ".") if "," in candidate and "." not in candidate else candidate.replace(",", "")
    try:
        return float(candidate)
    except ValueError:
        return None


def _coerce_optional_float(value: object) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if not isinstance(value, str):
        return None

    candidate = value.strip().removesuffix("%")
    if not candidate:
        return None

    range_match = _NUMERIC_RANGE_RE.match(candidate)
    if range_match:
        start = _parse_number_token(range_match.group(1))
        end = _parse_number_token(range_match.group(2))
        if start is None or end is None:
            return None
        return round((start + end) / 2, 4)

    direct = _parse_number_token(candidate)
    if direct is not None:
        return direct

    token_match = re.search(r"-?\d+(?:[.,]\d+)?", candidate)
    if not token_match:
        return None
    return _parse_number_token(token_match.group(0))


def _coerce_optional_int(value: object) -> int | None:
    parsed = _coerce_optional_float(value)
    if parsed is None:
        return None
    return max(0, int(round(parsed)))


def _clamp_llm_score_float(key: str, parsed: float) -> float:
    """Модели часто выдают «288» или проценты >100; схема Pydantic требует диапазоны."""
    if key in ("importance_score", "satisfaction_score"):
        return max(0.0, min(10.0, parsed))
    if key == "fit_score":
        return max(0.0, min(100.0, parsed))
    return parsed


def _normalize_preview_payload_value(value: object, *, key: str | None = None) -> tuple[object, bool]:
    if isinstance(value, dict):
        changed = False
        normalized: dict[str, Any] = {}
        for child_key, child_value in value.items():
            next_value, next_changed = _normalize_preview_payload_value(child_value, key=child_key)
            normalized[child_key] = next_value
            changed = changed or next_changed
        return normalized, changed

    if isinstance(value, list):
        changed = False
        normalized_items: list[object] = []
        for item in value:
            next_value, next_changed = _normalize_preview_payload_value(item, key=key)
            normalized_items.append(next_value)
            changed = changed or next_changed
        return normalized_items, changed

    if key in _FLOAT_LIKE_KEYS:
        parsed = _coerce_optional_float(value)
        if parsed is None:
            return value, False
        clamped = _clamp_llm_score_float(key, parsed)
        if clamped != parsed:
            return clamped, True
        if isinstance(value, str) and parsed is not None:
            return clamped, True
        return value, False

    if key in _INT_LIKE_KEYS:
        if value is None:
            return 0, True
        parsed = _coerce_optional_int(value)
        if parsed is not None and parsed != value:
            return parsed, True
        return value, False

    return value, False


def _normalize_preview_items_for_validation(raw_items: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], bool]:
    changed = False
    normalized_items: list[dict[str, Any]] = []
    for item in raw_items:
        normalized, item_changed = _normalize_preview_payload_value(item)
        normalized_items.append(dict(normalized) if isinstance(normalized, dict) else item)
        changed = changed or item_changed
    return normalized_items, changed


def _coerce_jtbd_expected_outcome_key(item: dict[str, Any]) -> dict[str, Any]:
    merged = dict(item)
    if not str(merged.get("expected_outcome") or "").strip():
        out = merged.get("outcome")
        if str(out or "").strip():
            merged["expected_outcome"] = out
    return merged


def _item_matches_target_section_shape(target_section: AutofillTarget, item: dict[str, Any]) -> bool:
    """Drop heterogeneous LLM rows (e.g. VP/SWOT inside JTBD items[]) before Pydantic."""
    if target_section == AutofillTarget.JTBD:
        it = _coerce_jtbd_expected_outcome_key(item)
        sit = str(it.get("situation") or "").strip()
        mot = str(it.get("motivation") or "").strip()
        out = str(it.get("expected_outcome") or "").strip()
        return len(sit) >= 3 and len(mot) >= 3 and len(out) >= 3
    if target_section == AutofillTarget.VALUE_PROPOSITIONS:
        return len(str(item.get("value_statement") or "").strip()) >= 10
    if target_section == AutofillTarget.SWOT:
        return len(str(item.get("title") or "").strip()) >= 3
    if target_section == AutofillTarget.COMPETITORS:
        return len(str(item.get("name") or "").strip()) >= 2
    if target_section == AutofillTarget.RESEARCHES:
        return (
            len(str(item.get("title") or "").strip()) >= 3 and len(str(item.get("research_query") or "").strip()) >= 3
        )
    if target_section == AutofillTarget.SEGMENTS:
        return len(str(item.get("name") or "").strip()) >= 2
    if target_section in (AutofillTarget.CAMPAIGNS, AutofillTarget.FUNNELS):
        return len(str(item.get("name") or "").strip()) >= 2
    if target_section in (AutofillTarget.TASKS, AutofillTarget.ALERTS):
        return len(str(item.get("title") or "").strip()) >= 2
    return True


def _coerce_item_dict_for_section_shape(target_section: AutofillTarget, item: dict[str, Any]) -> dict[str, Any]:
    """Подставить name из типовых алиасов до shape-фильтра и Pydantic."""
    it = dict(item)
    if target_section == AutofillTarget.FUNNELS:
        it = ensure_dict_name_from_aliases(
            it,
            alternate_keys=("title", "funnel_name", "label", "headline"),
        )
        if not str(it.get("name") or "").strip():
            pg = str(it.get("primary_goal") or "").strip()
            if len(pg) >= 2:
                it["name"] = pg[:255]
        return it
    if target_section == AutofillTarget.CAMPAIGNS:
        return ensure_dict_name_from_aliases(
            it,
            alternate_keys=("title", "campaign_name", "label", "headline"),
        )
    if target_section == AutofillTarget.SEGMENTS:
        return ensure_dict_name_from_aliases(
            it,
            alternate_keys=("title", "segment_name", "label", "headline"),
        )
    if target_section == AutofillTarget.COMPETITORS:
        return ensure_dict_name_from_aliases(
            it,
            alternate_keys=("title", "company_name", "label", "brand_name"),
        )
    return it


def _filter_raw_items_for_target_section(
    target_section: AutofillTarget,
    raw_items: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[str]]:
    kept: list[dict[str, Any]] = []
    dropped = 0
    for item in raw_items:
        coerced = _coerce_item_dict_for_section_shape(target_section, item)
        if _item_matches_target_section_shape(target_section, coerced):
            if target_section == AutofillTarget.JTBD:
                kept.append(_coerce_jtbd_expected_outcome_key(coerced))
            else:
                kept.append(coerced)
        else:
            dropped += 1
    warnings: list[str] = []
    if dropped:
        warnings.append(
            f"Пропущено {dropped} элемент(ов): структура не соответствует разделу «{target_section.value}» "
            "(модель иногда смешивает JTBD, ценностные предложения, SWOT, конкурентов, исследования)."
        )
    return kept, warnings


def _normalize_optional_datetime(value: str | None) -> datetime | None:
    if value is None:
        return None
    candidate = value.strip()
    if not candidate:
        return None
    try:
        parsed = datetime.fromisoformat(candidate.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is not None:
        return parsed.astimezone(UTC).replace(tzinfo=None)
    return parsed


def _scrub_llm_placeholder_task_due(parsed: datetime | None) -> datetime | None:
    """Models often emit 2023-01-01T00:00:00 as a training-example deadline; do not persist it."""
    if parsed is None:
        return None
    if (parsed.year, parsed.month, parsed.day) == (2023, 1, 1):
        return None
    return parsed


def _preview_description(target_section: AutofillTarget, payload: dict[str, Any]) -> str | None:
    if target_section == AutofillTarget.JTBD:
        return f"{payload.get('situation', '')} -> {payload.get('expected_outcome', '')}".strip(" ->")
    if target_section == AutofillTarget.VALUE_PROPOSITIONS:
        return str(payload.get("value_statement") or "")[:220] or None
    if target_section == AutofillTarget.SWOT:
        return payload.get("executive_summary") or payload.get("description")
    if target_section == AutofillTarget.COMPETITORS:
        return payload.get("description") or payload.get("market_position")
    if target_section == AutofillTarget.RESEARCHES:
        return payload.get("research_query") or payload.get("description")
    if target_section == AutofillTarget.SEGMENTS:
        return payload.get("description")
    if target_section == AutofillTarget.CAMPAIGNS:
        return payload.get("objective") or payload.get("hypothesis")
    if target_section == AutofillTarget.FUNNELS:
        return payload.get("primary_goal")
    if target_section == AutofillTarget.TASKS:
        return payload.get("description")
    if target_section == AutofillTarget.ALERTS:
        return payload.get("description")
    return None


def _preview_title(target_section: AutofillTarget, payload: dict[str, Any]) -> str:
    if target_section == AutofillTarget.JTBD:
        return str(payload.get("title") or payload.get("situation") or "JTBD")
    if target_section == AutofillTarget.VALUE_PROPOSITIONS:
        return str(payload.get("headline") or payload.get("subheadline") or "Ценностное предложение")
    if target_section == AutofillTarget.SWOT:
        return str(payload.get("title") or "SWOT-анализ")
    if target_section == AutofillTarget.COMPETITORS:
        return str(payload.get("name") or "Конкурент")
    if target_section == AutofillTarget.RESEARCHES:
        return str(payload.get("title") or "Исследование")
    if target_section == AutofillTarget.SEGMENTS:
        return str(payload.get("name") or "Сегмент")
    if target_section == AutofillTarget.CAMPAIGNS:
        return str(payload.get("name") or "Кампания")
    if target_section == AutofillTarget.FUNNELS:
        return str(payload.get("name") or "Воронка")
    if target_section == AutofillTarget.TASKS:
        return str(payload.get("title") or "Задача")
    if target_section == AutofillTarget.ALERTS:
        return str(payload.get("title") or "Алерт")
    return "Черновик"


def _section_prompt_contract(target_section: AutofillTarget) -> str:
    contracts = {
        AutofillTarget.JTBD: """
Верни JSON:
{
  "summary": "кратко, что извлечено",
  "warnings": ["опционально"],
  "items": [
    {
      "title": "короткое название JTBD",
      "situation": "когда ...",
      "motivation": "я хочу ...",
      "expected_outcome": "чтобы ...",
      "category": "functional|emotional|social|hybrid",
      "priority": "low|medium|high|critical",
      "importance_score": 0-10 или null,
      "satisfaction_score": 0-10 или null,
      "tags": ["..."],
      "evidence": ["короткие цитаты из документа"]
    }
  ]
}
Ограничение: максимум 6 items.
В массиве items только Job Stories: каждый объект обязан содержать situation, motivation и expected_outcome.
Не включай сюда ценностные предложения, SWOT, конкурентов или исследования (для них отдельные разделы кабинета).
""",
        AutofillTarget.VALUE_PROPOSITIONS: """
Верни JSON:
{
  "summary": "кратко",
  "warnings": ["опционально"],
  "items": [
    {
      "headline": "обещание ценности",
      "subheadline": "подзаголовок",
      "value_statement": "развёрнутое ценностное утверждение",
      "proof_points": ["доказательство 1", "доказательство 2"],
      "target_channels": ["landing", "sales deck"],
      "status": "draft",
      "job_story_ids": ["uuid JTBD из списка job stories проекта, предпочтительнее чем только названия"],
      "job_story_titles": ["точные короткие названия JTBD из контекста, если уместно"],
      "evidence": ["короткие цитаты"]
    }
  ]
}
Ограничение: максимум 4 items.
Для status используй только одно значение из списка: draft, testing, active, paused, archived.
Никогда не возвращай весь список статусов строкой через "|".
Не добавляй в объекты items полей, которых нет в примере выше (только headline, subheadline, value_statement, proof_points, target_channels, status, job_story_ids, job_story_titles, evidence).
Не вставляй // или /* */ в JSON.
""",
        AutofillTarget.SWOT: """
Верни JSON:
{
  "summary": "кратко",
  "warnings": ["опционально"],
  "items": [
    {
      "title": "название SWOT",
      "description": "контекст",
      "executive_summary": "короткое резюме",
      "company_name": "если видно",
      "industry": "если видно",
      "strengths": ["..."],
      "weaknesses": ["..."],
      "opportunities": ["..."],
      "threats": ["..."],
      "evidence": ["короткие цитаты"]
    }
  ]
}
Ограничение: максимум 1 item.
""",
        AutofillTarget.COMPETITORS: """
Верни JSON:
{
  "summary": "кратко",
  "warnings": ["опционально"],
  "items": [
    {
      "name": "название конкурента",
      "website": "https://..." или null,
      "description": "почему важен",
      "competitor_type": "direct|indirect|adjacent|replacement",
      "market_position": "позиция",
      "strengths": ["..."],
      "weaknesses": ["..."],
      "pricing_strategy": "кратко",
      "evidence": ["короткие цитаты"]
    }
  ]
}
Ограничение: максимум 6 items.
""",
        AutofillTarget.RESEARCHES: """
Верни JSON:
{
  "summary": "кратко",
  "warnings": ["опционально"],
  "items": [
    {
      "title": "название исследования",
      "research_type": "market|customer|competitive|product|swot|jtbd|value_proposition|trend_analysis|custom",
      "research_query": "что именно нужно исследовать дальше",
      "description": "контекст",
      "goals": ["цель 1", "цель 2"],
      "priority": "low|normal|high|urgent",
      "status": "draft|queued|processing|completed|failed|cancelled",
      "result_summary": "если можно сформулировать краткий вывод",
      "evidence": ["короткие цитаты"]
    }
  ]
}
Ограничение: максимум 4 items.
""",
        AutofillTarget.SEGMENTS: """
Верни JSON:
{
  "summary": "кратко",
  "warnings": ["опционально"],
  "items": [
    {
      "name": "название сегмента",
      "description": "описание сегмента",
      "segment_type": "icp|persona|account|industry|behavioral|lifecycle",
      "status": "draft|active|validated|archived",
      "priority": "low|medium|high|urgent",
      "estimated_reach": 0,
      "fit_score": 0-100 или null,
      "pain_points": ["..."],
      "gains": ["..."],
      "linked_job_story_titles": ["точные названия JTBD из контекста"],
      "linked_competitor_names": ["точные названия конкурентов из контекста"],
      "evidence": ["короткие цитаты"]
    }
  ]
}
Ограничение: максимум 5 items.
""",
        AutofillTarget.CAMPAIGNS: """
Верни JSON:
{
  "summary": "кратко",
  "warnings": ["опционально"],
  "items": [
    {
      "name": "название кампании",
      "objective": "цель кампании",
      "channel": "organic|paid_search|paid_social|email|outbound|partnership|event|content",
      "status": "draft|planned|active|paused|completed",
      "priority": "low|medium|high|urgent",
      "owner_name": "опционально",
      "hypothesis": "ключевая гипотеза",
      "budget": 0 или null,
      "target_metric_name": "CAC|MQL|CTR|SQL ...",
      "target_metric": число или null,
      "actual_metric": число или null,
      "linked_segment_names": ["точные названия сегментов из контекста"],
      "linked_value_prop_titles": ["точные headline VP из контекста"],
      "start_date": "ISO datetime или null",
      "end_date": "ISO datetime или null",
      "evidence": ["короткие цитаты"]
    }
  ]
}
Ограничение: максимум 4 items.
""",
        AutofillTarget.FUNNELS: """
Верни JSON:
{
  "summary": "кратко",
  "warnings": ["опционально"],
  "items": [
    {
      "name": "название воронки",
      "status": "draft|active|paused|completed",
      "primary_goal": "главная цель",
      "stages": [
        {
          "stage_name": "Awareness",
          "stage_order": 0,
          "visitors": 0,
          "conversions": 0,
          "conversion_rate": 0.0
        }
      ],
      "evidence": ["короткие цитаты"]
    }
  ]
}
Ограничение: максимум 3 items.
""",
        AutofillTarget.TASKS: """
Верни JSON:
{
  "summary": "кратко",
  "warnings": ["опционально"],
  "items": [
    {
      "title": "формулировка задачи",
      "description": "что сделать",
      "status": "open|in_progress|blocked|completed",
      "priority": "low|medium|high|urgent",
      "owner_name": "опционально",
      "due_at": "ISO datetime или null — только если срок явно в документе; не подставляй пример вроде 2023-01-01",
      "evidence": ["короткие цитаты"]
    }
  ]
}
Ограничение: максимум 8 items.
""",
        AutofillTarget.ALERTS: """
Верни JSON:
{
  "summary": "кратко",
  "warnings": ["опционально"],
  "items": [
    {
      "title": "заголовок риска/сигнала",
      "description": "почему важно",
      "severity": "low|medium|high|critical",
      "status": "open|watching|resolved",
      "owner_name": "опционально",
      "evidence": ["короткие цитаты"]
    }
  ]
}
Ограничение: максимум 6 items.
""",
    }
    return contracts[target_section].strip()


async def _fetch_source_content(
    db_pool: asyncpg.Pool,
    *,
    content_id: UUID,
    project_id: UUID,
    company_id: UUID,
) -> tuple[asyncpg.Record, dict[str, Any], str]:
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT
                id,
                name,
                content_type,
                description,
                processing_status,
                project_id,
                company_id,
                created_at,
                updated_at,
                metadata,
                extracted_text,
                file_size,
                mime_type
            FROM unified_content
            WHERE id = $1
              AND deleted_at IS NULL
              AND (
                project_id = $2
                OR (project_id IS NULL AND company_id = $3)
              )
            """,
            content_id,
            project_id,
            company_id,
        )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Документ не найден в контексте проекта")

    source_text = str(row.get("extracted_text") or row.get("description") or "").strip()
    if len(source_text) < 60:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Документ ещё не обработан или в нём недостаточно извлечённого текста для AI-анализа",
        )
    return row, normalize_content_item(row), source_text[:_MAX_SOURCE_TEXT_LENGTH]


def _build_prompt(
    *,
    target_section: AutofillTarget,
    content_item: dict[str, Any],
    content_text: str,
    project_context_text: str,
    user_instruction: str | None,
) -> str:
    instruction_suffix = user_instruction.strip() if user_instruction else "Нет дополнительной инструкции."
    return (
        "Ты продуктовый и маркетинговый стратег EliteEW.\n"
        "Нужно извлечь из документа только практичные артефакты для маркетингового кабинета.\n"
        "Ответ — валидный JSON-объект по контракту ниже (сервер llama.cpp ограничивает синтаксис JSON).\n"
        "Нельзя выдумывать факты, которых нет в документе или проектном контексте.\n"
        "Если данных мало, верни warnings и меньше items.\n\n"
        f"Раздел кабинета: {target_section.value}\n"
        f"Дополнительная инструкция пользователя: {instruction_suffix}\n\n"
        "Контекст проекта:\n"
        f"{project_context_text}\n\n"
        "Документ-источник:\n"
        f"- Название: {content_item.get('name') or 'Без названия'}\n"
        f"- Тип: {content_item.get('content_type') or 'unknown'}\n"
        f"- MIME: {content_item.get('mime_type') or 'unknown'}\n"
        f"- Описание: {content_item.get('description') or 'нет'}\n\n"
        "Текст документа:\n"
        f"{content_text}\n\n"
        "Контракт ответа:\n"
        f"{_section_prompt_contract(target_section)}"
    )


def _build_prompt_project_only(
    *,
    target_section: AutofillTarget,
    project_context_text: str,
    user_instruction: str | None,
) -> str:
    """Тот же JSON-контракт, что и «Анализировать» в document autofill, но без текста документа."""
    instruction_suffix = user_instruction.strip() if user_instruction else "Нет дополнительной инструкции."
    return (
        "Ты продуктовый и маркетинговый стратег EliteEW.\n"
        "Отдельный документ не приложён: используй только контекст проекта ниже и семантические фрагменты RAG.\n"
        "Нужно извлечь практичные артефакты для маркетингового кабинета.\n"
        "Ответ — валидный JSON-объект по контракту ниже (сервер llama.cpp ограничивает синтаксис JSON).\n"
        "В каждом объекте внутри items указывай только поля из контракта ниже — не добавляй произвольные ключи.\n"
        "Нельзя выдумывать факты вне переданного контекста.\n"
        "Если данных мало, верни warnings и меньше items.\n\n"
        f"Раздел кабинета: {target_section.value}\n"
        f"Дополнительная инструкция пользователя: {instruction_suffix}\n\n"
        "Контекст проекта (Postgres + RAG):\n"
        f"{project_context_text}\n\n"
        "Контракт ответа:\n"
        f"{_section_prompt_contract(target_section)}"
    )


def _log_autofill_json_extract_failure(raw_text: str, *, log_context: dict[str, Any] | None) -> None:
    body = raw_text or ""
    digest = hashlib.sha256(body.encode("utf-8", errors="replace")).hexdigest()[:16]
    n = len(body)
    head = body[:1200].replace("\n", "⏎")
    tail = body[-600:].replace("\n", "⏎") if n > 600 else ""
    logger.warning(
        "document_autofill.json_extract_failed chars=%s sha256_16=%s head=%s tail=%s ctx=%s",
        n,
        digest,
        head,
        tail,
        log_context or {},
    )


def _coerce_parsed_payload(
    raw_text: str,
    *,
    target_section: AutofillTarget | None = None,
    log_context: dict[str, Any] | None = None,
) -> tuple[str | None, list[str], list[dict[str, Any]]]:
    try:
        parsed = extract_json_payload(raw_text)
    except ValueError as exc:
        _log_autofill_json_extract_failure(raw_text, log_context=log_context)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI вернул невалидный JSON preview: {exc}",
        ) from exc
    if isinstance(parsed, list):
        return None, [], [dict(item) for item in parsed if isinstance(item, dict)]
    if isinstance(parsed, dict):
        summary = str(parsed.get("summary")).strip() if parsed.get("summary") else None
        warnings = [str(item).strip() for item in _coerce_string_list(parsed.get("warnings")) if str(item).strip()]
        items = [dict(item) for item in parsed.get("items", []) if isinstance(item, dict)]
        if not items and target_section == AutofillTarget.FUNNELS:
            for key in ("funnels", "funnel"):
                raw_section = parsed.get(key)
                if isinstance(raw_section, list):
                    items = [dict(item) for item in raw_section if isinstance(item, dict)]
                    break
                if isinstance(raw_section, dict):
                    items = [dict(raw_section)]
                    break
            if not items and any(parsed.get(key) is not None for key in ("stages", "funnel_steps", "steps")):
                items = [dict(parsed)]
        return summary, warnings, items
    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY, detail="AI вернул неструктурированный ответ вместо JSON"
    )


def _validate_preview_items(target_section: AutofillTarget, raw_items: list[dict[str, Any]]) -> list[BaseModel]:
    try:
        items = _SECTION_ADAPTERS[target_section].validate_python(raw_items)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Не удалось провалидировать AI-черновики для раздела {target_section.value}: {exc}",
        ) from exc
    if not items:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"AI не нашёл пригодных элементов для preview (раздел «{target_section.value}»): "
                "пустой items[] или все элементы отсеяны по форме (проверьте поле name и обязательные поля раздела)."
            ),
        )
    return items


def _build_preview_items(target_section: AutofillTarget, items: list[BaseModel]) -> list[dict[str, Any]]:
    preview_items: list[dict[str, Any]] = []
    for index, item in enumerate(items, start=1):
        item_dict = item.model_dump()
        evidence = _coerce_string_list(item_dict.pop("evidence", []))
        preview_items.append(
            {
                "draft_id": f"{target_section.value}-{index}",
                "title": _preview_title(target_section, item_dict),
                "description": _preview_description(target_section, item_dict),
                "payload": item_dict,
                "evidence": evidence[:4],
            }
        )
    return preview_items


def _extract_generation_text(payload: dict[str, Any]) -> str:
    return MarketingCabinetAIService._extract_text(payload)


def _build_preview_result_payload(
    *,
    target_section: AutofillTarget,
    content_item: dict[str, Any],
    raw_output: str,
    runtime_warnings: list[str] | None = None,
    generation_type_key: str,
    log_context: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], str, dict[str, Any]]:
    ctx = dict(log_context or {})
    ctx.setdefault("target_section", target_section.value)
    ctx.setdefault("generation_type_key", generation_type_key)
    summary, warnings, raw_items = _coerce_parsed_payload(raw_output, target_section=target_section, log_context=ctx)
    warnings = [*(runtime_warnings or []), *warnings]
    normalized_raw_items, preview_normalized = _normalize_preview_items_for_validation(raw_items)
    if preview_normalized:
        warnings.append(
            "Часть числовых значений из AI preview была автоматически нормализована для корректного импорта."
        )
    shaped_items, shape_warnings = _filter_raw_items_for_target_section(target_section, normalized_raw_items)
    warnings = [*warnings, *shape_warnings]
    if not shaped_items and normalized_raw_items:
        logger.warning(
            "[STEP] document_autofill.preview_all_items_shape_filtered target=%s raw_count=%s",
            target_section.value,
            len(normalized_raw_items),
        )
    validated_items = _validate_preview_items(target_section, shaped_items)
    preview_items = _build_preview_items(target_section, validated_items)
    result_payload = {
        "target_section": target_section.value,
        "mode": AutofillMode.PREVIEW.value,
        "source_content": content_item,
        "summary": summary,
        "warnings": warnings,
        "preview_items": preview_items,
        "applied_items": [],
    }
    metadata_extra = {
        "preview_count": len(preview_items),
        "generation_type_key": generation_type_key,
        "fallback_used": generation_type_key != "document_structured_extract",
        "preview_normalized": preview_normalized,
    }
    return result_payload, (summary or raw_output), metadata_extra


async def _build_lookup_indexes(
    conn: asyncpg.Connection,
    *,
    project_id: UUID,
) -> dict[str, dict[str, str]]:
    job_rows = await conn.fetch(
        """
        SELECT id, COALESCE(metadata->>'title', situation) AS title
        FROM job_stories
        WHERE project_id = $1
          AND deleted_at IS NULL
        """,
        project_id,
    )
    segment_rows = await conn.fetch(
        """
        SELECT id, name
        FROM marketing_segments
        WHERE project_id = $1
          AND deleted_at IS NULL
        """,
        project_id,
    )
    competitor_rows = await conn.fetch(
        """
        SELECT id, name
        FROM competitors
        WHERE project_id = $1
          AND deleted_at IS NULL
        """,
        project_id,
    )
    value_prop_rows = await conn.fetch(
        """
        SELECT id, COALESCE(headline, subheadline, value_statement) AS title
        FROM value_propositions
        WHERE project_id = $1
          AND deleted_at IS NULL
        """,
        project_id,
    )

    def build_index(rows: list[asyncpg.Record], field_name: str) -> dict[str, str]:
        index: dict[str, str] = {}
        for row in rows:
            key = _normalize_lookup_key(str(row.get(field_name) or ""))
            if key and key not in index:
                index[key] = str(row["id"])
        return index

    return {
        "jobs": build_index(list(job_rows), "title"),
        "segments": build_index(list(segment_rows), "name"),
        "competitors": build_index(list(competitor_rows), "name"),
        "value_props": build_index(list(value_prop_rows), "title"),
    }


def _resolve_linked_ids(values: list[str], index: dict[str, str]) -> list[UUID]:
    resolved: list[UUID] = []
    seen: set[str] = set()
    for value in values:
        key = _normalize_lookup_key(value)
        if not key:
            continue
        entity_id = index.get(key)
        if entity_id and entity_id not in seen:
            resolved.append(UUID(entity_id))
            seen.add(entity_id)
    return resolved


def _build_metadata(
    *,
    target_section: AutofillTarget,
    content_item: dict[str, Any],
    draft_id: str,
    evidence: list[str],
    user_instruction: str | None,
) -> dict[str, Any]:
    return {
        "ai_autofill": {
            "target_section": target_section.value,
            "content_id": content_item.get("id"),
            "content_name": content_item.get("name"),
            "content_type": content_item.get("content_type"),
            "draft_id": draft_id,
            "evidence": evidence[:4],
            "user_instruction": user_instruction,
        }
    }


async def _apply_jtbd(
    conn: asyncpg.Connection,
    *,
    project_id: UUID,
    company_id: UUID,
    user_id: UUID,
    draft_id: str,
    item: JobStoryDraft,
    content_item: dict[str, Any],
    user_instruction: str | None,
) -> dict[str, str]:
    normalized = await _insert_job_story_with_connection(
        conn,
        project_id=project_id,
        company_id=company_id,
        user_id=user_id,
        title=item.title,
        situation=item.situation,
        motivation=item.motivation,
        outcome=item.expected_outcome,
        category=item.category,
        priority=item.priority,
        importance_score=item.importance_score,
        satisfaction_score=item.satisfaction_score,
        tags=item.tags,
        source="manual",
        metadata_extra=_build_metadata(
            target_section=AutofillTarget.JTBD,
            content_item=content_item,
            draft_id=draft_id,
            evidence=item.evidence,
            user_instruction=user_instruction,
        ),
    )
    return {
        "entity_id": str(normalized["id"]),
        "entity_type": "job_story",
        "title": str(normalized["title"]),
        "target_section": AutofillTarget.JTBD.value,
    }


async def _apply_value_proposition(
    conn: asyncpg.Connection,
    *,
    project_id: UUID,
    user_id: UUID,
    draft_id: str,
    item: ValuePropositionDraft,
    content_item: dict[str, Any],
    lookup_indexes: dict[str, dict[str, str]],
    user_instruction: str | None,
) -> dict[str, str]:
    value_prop_status = _validate_value_prop_status_enum(str(_coerce_value_prop_status_value(item.status)))
    from_titles = _resolve_linked_ids(item.job_story_titles, lookup_indexes["jobs"])
    explicit_ids: list[UUID] = []
    if item.job_story_ids:
        rows = await conn.fetch(
            """
            SELECT id
            FROM job_stories
            WHERE project_id = $1
              AND id = ANY($2::uuid[])
              AND deleted_at IS NULL
            """,
            project_id,
            list(item.job_story_ids),
        )
        explicit_ids = [r["id"] for r in rows]
    merged: list[UUID] = []
    seen_m: set[str] = set()
    for jid in explicit_ids + from_titles:
        key = str(jid)
        if key not in seen_m:
            seen_m.add(key)
            merged.append(jid)
    addressed_job_ids = merged
    metadata = {
        "generated_from_jtbd": bool(addressed_job_ids),
        "source_jobs_count": len(addressed_job_ids),
        **_build_metadata(
            target_section=AutofillTarget.VALUE_PROPOSITIONS,
            content_item=content_item,
            draft_id=draft_id,
            evidence=item.evidence,
            user_instruction=user_instruction,
        ),
    }
    row = await conn.fetchrow(
        """
        INSERT INTO value_propositions (
            project_id,
            created_by,
            headline,
            subheadline,
            value_statement,
            proof_points,
            addressed_job_ids,
            target_channels,
            status,
            metadata,
            is_ai_generated,
            created_at,
            updated_at
        ) VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6::jsonb,
            $7::uuid[],
            $8::text[],
            $9::value_prop_status,
            $10::jsonb,
            TRUE,
            NOW(),
            NOW()
        )
        RETURNING id, COALESCE(headline, subheadline, value_statement) AS display_title
        """,
        project_id,
        user_id,
        item.headline,
        item.subheadline,
        item.value_statement,
        json.dumps(item.proof_points),
        addressed_job_ids,
        item.target_channels,
        value_prop_status,
        json.dumps(metadata),
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось сохранить value proposition"
        )
    return {
        "entity_id": str(row["id"]),
        "entity_type": "value_proposition",
        "title": str(row["display_title"] or "Ценностное предложение"),
        "target_section": AutofillTarget.VALUE_PROPOSITIONS.value,
    }


async def _apply_swot(
    db_pool: asyncpg.Pool,
    *,
    project_id: UUID,
    company_id: UUID,
    user_id: UUID,
    draft_id: str,
    item: SwotDraft,
    content_item: dict[str, Any],
    user_instruction: str | None,
) -> dict[str, str]:
    factors = {
        "strength": [{"factor_text": text, "impact_level": "medium", "priority_score": 50} for text in item.strengths],
        "weakness": [{"factor_text": text, "impact_level": "medium", "priority_score": 50} for text in item.weaknesses],
        "opportunity": [
            {"factor_text": text, "impact_level": "medium", "priority_score": 50} for text in item.opportunities
        ],
        "threat": [{"factor_text": text, "impact_level": "medium", "priority_score": 50} for text in item.threats],
    }
    normalized = await _create_swot_analysis(
        db_pool,
        project_id=project_id,
        company_id=company_id,
        user_id=user_id,
        title=item.title,
        description=item.description,
        executive_summary=item.executive_summary,
        company_name=item.company_name,
        industry=item.industry,
        factors_by_type=factors,
        ai_generated=True,
    )
    return {
        "entity_id": str(normalized["id"]),
        "entity_type": "swot",
        "title": str(normalized["title"]),
        "target_section": AutofillTarget.SWOT.value,
    }


async def _apply_competitor(
    conn: asyncpg.Connection,
    *,
    project_id: UUID,
    user_id: UUID,
    draft_id: str,
    item: CompetitorDraft,
    content_item: dict[str, Any],
    user_instruction: str | None,
) -> dict[str, str]:
    competitor_type, market_position, pricing_strategy = prepare_competitor_write_fields(
        competitor_type=item.competitor_type,
        market_position=item.market_position,
        pricing_strategy=item.pricing_strategy,
    )
    row = await conn.fetchrow(
        """
        INSERT INTO competitors (
            project_id,
            created_by,
            name,
            website,
            description,
            competitor_type,
            market_position,
            strengths,
            weaknesses,
            pricing_strategy,
            metadata,
            created_at,
            updated_at
        ) VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8::text[],
            $9::text[],
            $10,
            $11::jsonb,
            NOW(),
            NOW()
        )
        RETURNING id, name
        """,
        project_id,
        user_id,
        item.name,
        item.website,
        item.description,
        competitor_type,
        market_position,
        item.strengths,
        item.weaknesses,
        pricing_strategy,
        json.dumps(
            _build_metadata(
                target_section=AutofillTarget.COMPETITORS,
                content_item=content_item,
                draft_id=draft_id,
                evidence=item.evidence,
                user_instruction=user_instruction,
            )
        ),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось сохранить конкурента")
    return {
        "entity_id": str(row["id"]),
        "entity_type": "competitor",
        "title": str(row["name"]),
        "target_section": AutofillTarget.COMPETITORS.value,
    }


async def _apply_research(
    conn: asyncpg.Connection,
    *,
    project_id: UUID,
    company_id: UUID,
    user_id: UUID,
    content_id: UUID,
    draft_id: str,
    item: ResearchDraft,
    content_item: dict[str, Any],
    user_instruction: str | None,
) -> dict[str, str]:
    research_type = _validate_research_type_enum(str(_coerce_research_type_value(item.research_type)))
    research_priority = _validate_research_priority_enum(str(_coerce_research_priority_value(item.priority)))
    research_status = _validate_research_status_enum(str(_coerce_research_status_value(item.status)))
    row = await conn.fetchrow(
        """
        INSERT INTO research_projects (
            project_id,
            company_id,
            created_by,
            research_type,
            title,
            description,
            research_query,
            goals,
            priority,
            status,
            result_content_id,
            result_summary,
            created_at,
            updated_at
        ) VALUES (
            $1,
            $2,
            $3,
            $4::research_type,
            $5,
            $6,
            $7,
            $8::text[],
            $9::research_priority,
            $10::research_status,
            $11,
            $12,
            NOW(),
            NOW()
        )
        RETURNING id, title
        """,
        project_id,
        company_id,
        user_id,
        research_type,
        item.title,
        item.description,
        item.research_query,
        item.goals,
        research_priority,
        research_status,
        (None if _is_project_context_source_id(content_id) else content_id),
        item.result_summary,
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось сохранить исследование"
        )
    return {
        "entity_id": str(row["id"]),
        "entity_type": "research",
        "title": str(row["title"]),
        "target_section": AutofillTarget.RESEARCHES.value,
    }


async def _apply_segment(
    conn: asyncpg.Connection,
    *,
    project_id: UUID,
    company_id: UUID,
    user_id: UUID,
    content_id: UUID,
    draft_id: str,
    item: SegmentDraft,
    content_item: dict[str, Any],
    lookup_indexes: dict[str, dict[str, str]],
    user_instruction: str | None,
) -> dict[str, str]:
    linked_job_story_ids = _resolve_linked_ids(item.linked_job_story_titles, lookup_indexes["jobs"])
    linked_competitor_ids = _resolve_linked_ids(item.linked_competitor_names, lookup_indexes["competitors"])
    linked_content_ids: list[UUID] = [] if _is_project_context_source_id(content_id) else [content_id]
    row = await conn.fetchrow(
        """
        INSERT INTO marketing_segments (
            project_id,
            company_id,
            created_by,
            name,
            description,
            segment_type,
            status,
            priority,
            estimated_reach,
            fit_score,
            linked_job_story_ids,
            linked_content_ids,
            linked_competitor_ids,
            pain_points,
            gains,
            metadata,
            created_at,
            updated_at
        ) VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11::uuid[],
            $12::uuid[],
            $13::uuid[],
            $14::text[],
            $15::text[],
            $16::jsonb,
            NOW(),
            NOW()
        )
        RETURNING id, name
        """,
        project_id,
        company_id,
        user_id,
        item.name,
        item.description,
        item.segment_type,
        item.status,
        item.priority,
        item.estimated_reach,
        item.fit_score,
        linked_job_story_ids,
        linked_content_ids,
        linked_competitor_ids,
        item.pain_points,
        item.gains,
        json.dumps(
            _build_metadata(
                target_section=AutofillTarget.SEGMENTS,
                content_item=content_item,
                draft_id=draft_id,
                evidence=item.evidence,
                user_instruction=user_instruction,
            )
        ),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось сохранить сегмент")
    return {
        "entity_id": str(row["id"]),
        "entity_type": "segment",
        "title": str(row["name"]),
        "target_section": AutofillTarget.SEGMENTS.value,
    }


async def _apply_campaign(
    conn: asyncpg.Connection,
    *,
    project_id: UUID,
    company_id: UUID,
    user_id: UUID,
    draft_id: str,
    item: CampaignDraft,
    content_item: dict[str, Any],
    lookup_indexes: dict[str, dict[str, str]],
    user_instruction: str | None,
) -> dict[str, str]:
    linked_segment_ids = _resolve_linked_ids(item.linked_segment_names, lookup_indexes["segments"])
    linked_value_prop_ids = _resolve_linked_ids(item.linked_value_prop_titles, lookup_indexes["value_props"])
    row = await conn.fetchrow(
        """
        INSERT INTO marketing_campaigns (
            project_id,
            company_id,
            created_by,
            name,
            objective,
            channel,
            status,
            priority,
            owner_name,
            hypothesis,
            budget,
            target_metric_name,
            target_metric,
            actual_metric,
            linked_segment_ids,
            linked_value_prop_ids,
            metadata,
            start_date,
            end_date,
            created_at,
            updated_at
        ) VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
            $14,
            $15::uuid[],
            $16::uuid[],
            $17::jsonb,
            $18::timestamp,
            $19::timestamp,
            NOW(),
            NOW()
        )
        RETURNING id, name
        """,
        project_id,
        company_id,
        user_id,
        item.name,
        item.objective,
        item.channel,
        item.status,
        item.priority,
        item.owner_name,
        item.hypothesis,
        item.budget,
        item.target_metric_name,
        item.target_metric,
        item.actual_metric,
        linked_segment_ids,
        linked_value_prop_ids,
        json.dumps(
            _build_metadata(
                target_section=AutofillTarget.CAMPAIGNS,
                content_item=content_item,
                draft_id=draft_id,
                evidence=item.evidence,
                user_instruction=user_instruction,
            )
        ),
        _normalize_optional_datetime(item.start_date),
        _normalize_optional_datetime(item.end_date),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось сохранить кампанию")
    return {
        "entity_id": str(row["id"]),
        "entity_type": "campaign",
        "title": str(row["name"]),
        "target_section": AutofillTarget.CAMPAIGNS.value,
    }


async def _apply_funnel(
    conn: asyncpg.Connection,
    *,
    project_id: UUID,
    company_id: UUID,
    user_id: UUID,
    draft_id: str,
    item: FunnelDraft,
    content_item: dict[str, Any],
    user_instruction: str | None,
) -> dict[str, str]:
    row = await conn.fetchrow(
        """
        INSERT INTO marketing_funnels (
            project_id,
            company_id,
            created_by,
            name,
            status,
            primary_goal,
            metadata,
            created_at,
            updated_at
        ) VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7::jsonb,
            NOW(),
            NOW()
        )
        RETURNING id, name
        """,
        project_id,
        company_id,
        user_id,
        item.name,
        item.status,
        item.primary_goal,
        json.dumps(
            _build_metadata(
                target_section=AutofillTarget.FUNNELS,
                content_item=content_item,
                draft_id=draft_id,
                evidence=item.evidence,
                user_instruction=user_instruction,
            )
        ),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось сохранить воронку")

    stages = [FunnelStageInput.model_validate(stage.model_dump()) for stage in item.stages]
    await _insert_funnel_stages(conn, funnel_id=row["id"], stages=stages)
    return {
        "entity_id": str(row["id"]),
        "entity_type": "funnel",
        "title": str(row["name"]),
        "target_section": AutofillTarget.FUNNELS.value,
    }


async def _apply_task(
    conn: asyncpg.Connection,
    *,
    project_id: UUID,
    company_id: UUID,
    user_id: UUID,
    content_id: UUID,
    draft_id: str,
    item: TaskDraft,
    content_item: dict[str, Any],
    user_instruction: str | None,
) -> dict[str, str]:
    source_id_val = None if _is_project_context_source_id(content_id) else content_id
    row = await conn.fetchrow(
        """
        INSERT INTO marketing_tasks (
            project_id,
            company_id,
            created_by,
            title,
            description,
            status,
            priority,
            owner_name,
            due_at,
            source_type,
            source_id,
            metadata,
            created_at,
            updated_at
        ) VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9::timestamp,
            $10,
            $11,
            $12::jsonb,
            NOW(),
            NOW()
        )
        RETURNING id, title
        """,
        project_id,
        company_id,
        user_id,
        item.title,
        item.description,
        item.status,
        item.priority,
        item.owner_name,
        _scrub_llm_placeholder_task_due(_normalize_optional_datetime(item.due_at)),
        "document_autofill",
        source_id_val,
        json.dumps(
            _build_metadata(
                target_section=AutofillTarget.TASKS,
                content_item=content_item,
                draft_id=draft_id,
                evidence=item.evidence,
                user_instruction=user_instruction,
            )
        ),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось сохранить задачу")
    return {
        "entity_id": str(row["id"]),
        "entity_type": "task",
        "title": str(row["title"]),
        "target_section": AutofillTarget.TASKS.value,
    }


async def _apply_alert(
    conn: asyncpg.Connection,
    *,
    project_id: UUID,
    company_id: UUID,
    user_id: UUID,
    content_id: UUID,
    draft_id: str,
    item: AlertDraft,
    content_item: dict[str, Any],
    user_instruction: str | None,
) -> dict[str, str]:
    source_id_val = None if _is_project_context_source_id(content_id) else content_id
    row = await conn.fetchrow(
        """
        INSERT INTO marketing_alerts (
            project_id,
            company_id,
            created_by,
            title,
            description,
            severity,
            status,
            owner_name,
            source_type,
            source_id,
            metadata,
            created_at,
            updated_at
        ) VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11::jsonb,
            NOW(),
            NOW()
        )
        RETURNING id, title
        """,
        project_id,
        company_id,
        user_id,
        item.title,
        item.description,
        item.severity,
        item.status,
        item.owner_name,
        "document_autofill",
        source_id_val,
        json.dumps(
            _build_metadata(
                target_section=AutofillTarget.ALERTS,
                content_item=content_item,
                draft_id=draft_id,
                evidence=item.evidence,
                user_instruction=user_instruction,
            )
        ),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось сохранить алерт")
    return {
        "entity_id": str(row["id"]),
        "entity_type": "alert",
        "title": str(row["title"]),
        "target_section": AutofillTarget.ALERTS.value,
    }


async def apply_project_autofill_preview_to_entities(
    db_pool: asyncpg.Pool,
    *,
    project_id: UUID,
    user_id: UUID,
    target_section: AutofillTarget,
    result_payload: dict[str, Any],
    user_instruction: str | None,
) -> list[dict[str, str]]:
    """Сохраняет черновики из preview в БД (как apply «Из документа»), с синтетическим content_id."""
    preview_items = result_payload.get("preview_items") or []
    if not preview_items:
        return []
    project = await get_accessible_project(
        db_pool, project_id, user_id, for_mutation=True, required_mc_module="content_ai"
    )
    content_item = _synthetic_project_source_content_item()
    drafts = [
        DocumentAutofillDraftInput(
            draft_id=str(p["draft_id"]),
            title=str(p["title"]),
            description=p.get("description") if isinstance(p.get("description"), str) else None,
            payload=dict(p.get("payload") or {}),
            evidence=[str(x) for x in (p.get("evidence") or []) if str(x).strip()],
        )
        for p in preview_items
    ]
    apply_req = MarketingDocumentAutofillRequest(
        project_id=project_id,
        content_id=_PROJECT_CONTEXT_SOURCE_ID,
        target_section=target_section,
        mode=AutofillMode.APPLY,
        user_instruction=user_instruction,
        draft_items=drafts,
        selected_item_ids=[d.draft_id for d in drafts],
    )
    return await _apply_selected_items(
        db_pool,
        project=project,
        user_id=user_id,
        payload=apply_req,
        content_item=content_item,
    )


async def _apply_selected_items(
    db_pool: asyncpg.Pool,
    *,
    project: asyncpg.Record,
    user_id: UUID,
    payload: MarketingDocumentAutofillRequest,
    content_item: dict[str, Any],
) -> list[dict[str, str]]:
    selected_ids = set(payload.selected_item_ids) if payload.selected_item_ids else None
    selected_drafts = [item for item in payload.draft_items if selected_ids is None or item.draft_id in selected_ids]
    if not selected_drafts:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Не выбраны элементы для применения")

    raw_items = [{**draft.payload, "evidence": draft.evidence} for draft in selected_drafts]
    validated_items = _validate_preview_items(payload.target_section, raw_items)
    applied_items: list[dict[str, str]] = []

    if payload.target_section == AutofillTarget.SWOT:
        for draft, item in zip(selected_drafts, validated_items, strict=False):
            if not isinstance(item, SwotDraft):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректный SWOT-черновик")
            applied_items.append(
                await _apply_swot(
                    db_pool,
                    project_id=payload.project_id,
                    company_id=project["company_id"],
                    user_id=user_id,
                    draft_id=draft.draft_id,
                    item=item,
                    content_item=content_item,
                    user_instruction=payload.user_instruction,
                )
            )
        return applied_items

    async with db_pool.acquire() as conn, conn.transaction():
        lookup_indexes = await _build_lookup_indexes(conn, project_id=payload.project_id)
        for draft, item in zip(selected_drafts, validated_items, strict=False):
            if isinstance(item, JobStoryDraft):
                applied = await _apply_jtbd(
                    conn,
                    project_id=payload.project_id,
                    company_id=project["company_id"],
                    user_id=user_id,
                    draft_id=draft.draft_id,
                    item=item,
                    content_item=content_item,
                    user_instruction=payload.user_instruction,
                )
            elif isinstance(item, ValuePropositionDraft):
                applied = await _apply_value_proposition(
                    conn,
                    project_id=payload.project_id,
                    user_id=user_id,
                    draft_id=draft.draft_id,
                    item=item,
                    content_item=content_item,
                    lookup_indexes=lookup_indexes,
                    user_instruction=payload.user_instruction,
                )
            elif isinstance(item, CompetitorDraft):
                applied = await _apply_competitor(
                    conn,
                    project_id=payload.project_id,
                    user_id=user_id,
                    draft_id=draft.draft_id,
                    item=item,
                    content_item=content_item,
                    user_instruction=payload.user_instruction,
                )
            elif isinstance(item, ResearchDraft):
                applied = await _apply_research(
                    conn,
                    project_id=payload.project_id,
                    company_id=project["company_id"],
                    user_id=user_id,
                    content_id=payload.content_id,
                    draft_id=draft.draft_id,
                    item=item,
                    content_item=content_item,
                    user_instruction=payload.user_instruction,
                )
            elif isinstance(item, SegmentDraft):
                applied = await _apply_segment(
                    conn,
                    project_id=payload.project_id,
                    company_id=project["company_id"],
                    user_id=user_id,
                    content_id=payload.content_id,
                    draft_id=draft.draft_id,
                    item=item,
                    content_item=content_item,
                    lookup_indexes=lookup_indexes,
                    user_instruction=payload.user_instruction,
                )
            elif isinstance(item, CampaignDraft):
                applied = await _apply_campaign(
                    conn,
                    project_id=payload.project_id,
                    company_id=project["company_id"],
                    user_id=user_id,
                    draft_id=draft.draft_id,
                    item=item,
                    content_item=content_item,
                    lookup_indexes=lookup_indexes,
                    user_instruction=payload.user_instruction,
                )
            elif isinstance(item, FunnelDraft):
                applied = await _apply_funnel(
                    conn,
                    project_id=payload.project_id,
                    company_id=project["company_id"],
                    user_id=user_id,
                    draft_id=draft.draft_id,
                    item=item,
                    content_item=content_item,
                    user_instruction=payload.user_instruction,
                )
            elif isinstance(item, TaskDraft):
                applied = await _apply_task(
                    conn,
                    project_id=payload.project_id,
                    company_id=project["company_id"],
                    user_id=user_id,
                    content_id=payload.content_id,
                    draft_id=draft.draft_id,
                    item=item,
                    content_item=content_item,
                    user_instruction=payload.user_instruction,
                )
            elif isinstance(item, AlertDraft):
                applied = await _apply_alert(
                    conn,
                    project_id=payload.project_id,
                    company_id=project["company_id"],
                    user_id=user_id,
                    content_id=payload.content_id,
                    draft_id=draft.draft_id,
                    item=item,
                    content_item=content_item,
                    user_instruction=payload.user_instruction,
                )
            else:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неподдерживаемый тип AI-черновика")
            applied_items.append(applied)

    return applied_items


async def _start_document_autofill_ugs_stream(
    ai_service: MarketingCabinetAIService,
    *,
    user_id: UUID,
    project_id: UUID,
    company_id: UUID,
    autofill_input_data: dict[str, Any],
    log_context: str,
) -> tuple[dict[str, Any], str, list[str]]:
    """Start UGS stream for document autofill with stack2 schema-constrained JSON output."""
    generation_type_key = "document_structured_extract"
    runtime_warnings: list[str] = []
    uid = str(user_id)
    pid = str(project_id)
    cid = str(company_id)
    input_data = {**autofill_input_data, "json_format": True}
    try:
        start_payload = await ai_service.ugs_service.start_generation_for_stream(
            user_id=uid,
            type_key=generation_type_key,
            input_data=input_data,
            project_id=pid,
            company_id=cid,
        )
    except ValueError as exc:
        logger.warning(
            "document_autofill_ugs_start_value_error context=%s detail=%s",
            log_context,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Не удалось запустить AI preview: в UGS отсутствует type_key "
                "document_structured_extract (нужна миграция generation_types)."
            ),
        ) from exc
    except httpx.HTTPError as exc:
        logger.warning(
            "document_autofill_ugs_upstream_http context=%s detail=%s",
            log_context,
            exc,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Сеть до сервиса генерации недоступна: {exc}",
        ) from exc
    except Exception as exc:
        logger.exception(
            "document_autofill_ugs_start_failed context=%s error_type=%s",
            log_context,
            type(exc).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Не удалось запустить AI preview: {exc}",
        ) from exc
    return start_payload, generation_type_key, runtime_warnings


@router.post("/async", status_code=status.HTTP_202_ACCEPTED, response_model=MarketingAiAsyncStartResponse)
async def start_document_autofill_preview_async(
    payload: MarketingDocumentAutofillRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
    ai_service: MarketingCabinetAIService = Depends(get_marketing_ai_service),  # noqa: B008
) -> MarketingAiAsyncStartResponse:
    if payload.mode != AutofillMode.PREVIEW:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Async document autofill сейчас поддерживает только режим preview",
        )

    project = await get_accessible_project(
        db_pool, payload.project_id, user_id, for_mutation=True, required_mc_module="content_ai"
    )
    _, content_item, content_text = await _fetch_source_content(
        db_pool,
        content_id=payload.content_id,
        project_id=payload.project_id,
        company_id=project["company_id"],
    )

    allowed, retry_after = await check_marketing_cabinet_ai_rate_limit(str(user_id))
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Превышен лимит AI-запросов. Попробуйте через минуту.",
            headers={"Retry-After": str(int(retry_after or 60))},
        )
    await ensure_marketing_idempotency("document_autofill_preview_async", payload.idempotency_key, user_id=user_id)

    project_context = await build_project_context(db_pool, payload.project_id, user_id)
    base_ctx = format_project_context_for_prompt(project_context)
    rag_q = " ".join(x for x in [payload.user_instruction or "", (content_text or "")[:500]] if (x or "").strip())
    project_context_text = await merge_project_context_text_with_rag(
        db_pool,
        project_id=payload.project_id,
        user_id=user_id,
        query=rag_q or (content_text or "")[:800],
        context_text=base_ctx,
    )
    prompt = _build_prompt(
        target_section=payload.target_section,
        content_item=content_item,
        content_text=content_text,
        project_context_text=project_context_text,
        user_instruction=payload.user_instruction,
    )
    autofill_input_data: dict[str, Any] = {
        "prompt": prompt,
        "options": {"temperature": 0.2, "num_predict": max(256, 4000)},
    }
    start_payload, generation_type_key, runtime_warnings = await _start_document_autofill_ugs_stream(
        ai_service,
        user_id=user_id,
        project_id=payload.project_id,
        company_id=project["company_id"],
        autofill_input_data=autofill_input_data,
        log_context="document_preview_async",
    )

    initial_status = str(start_payload.get("status") or "processing")
    request_id = start_payload.get("request_id")
    tool_key = f"document_autofill_preview_{payload.target_section.value}"
    prompt_excerpt = (payload.user_instruction or f"Preview {payload.target_section.value} from document")[:800]

    if start_payload.get("cached") and initial_status == "completed":
        raw_output = _extract_generation_text(start_payload)
        result_payload, result_excerpt, metadata_extra = _build_preview_result_payload(
            target_section=payload.target_section,
            content_item=content_item,
            raw_output=raw_output,
            runtime_warnings=runtime_warnings,
            generation_type_key=generation_type_key,
        )
        run = await record_marketing_ai_run(
            db_pool,
            project_id=payload.project_id,
            company_id=project["company_id"],
            user_id=user_id,
            request_id=request_id,
            tool_key=tool_key,
            status_value="completed",
            prompt_excerpt=prompt_excerpt,
            result_excerpt=result_excerpt,
            metadata={
                "target_section": payload.target_section.value,
                "mode": payload.mode.value,
                "content_id": str(payload.content_id),
                "result_type": "document_autofill_preview",
                "result_payload": result_payload,
                **metadata_extra,
            },
        )
        return MarketingAiAsyncStartResponse.model_validate(
            {
                "run": run,
                "poll_after_ms": 0,
                "queue": None,
            }
        )

    if not request_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="UGS не вернул request_id для document autofill preview",
        )

    run = await record_marketing_ai_run(
        db_pool,
        project_id=payload.project_id,
        company_id=project["company_id"],
        user_id=user_id,
        request_id=request_id,
        tool_key=tool_key,
        status_value=initial_status if initial_status in {"queued", "processing"} else "processing",
        prompt_excerpt=prompt_excerpt,
        result_excerpt="",
        metadata={
            "target_section": payload.target_section.value,
            "mode": payload.mode.value,
            "content_id": str(payload.content_id),
            "source_content": content_item,
            "result_type": "document_autofill_preview",
            "generation_type_key": generation_type_key,
            "fallback_used": generation_type_key != "document_structured_extract",
            "runtime_warnings": runtime_warnings,
            "async_job": {
                "kind": "document_autofill_preview",
                "target_section": payload.target_section.value,
                "content_id": str(payload.content_id),
                "source_content": content_item,
                "generation_type_key": generation_type_key,
                "runtime_warnings": runtime_warnings,
            },
        },
        finish_run=False,
    )
    return MarketingAiAsyncStartResponse.model_validate(
        {
            "run": run,
            "poll_after_ms": 2000,
            "queue": await build_marketing_queue_snapshot(ai_service, status_value=initial_status),
        }
    )


@router.post(
    "/generate-from-project/async",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=MarketingAiAsyncStartResponse,
)
async def start_document_autofill_from_project_async(
    payload: MarketingDocumentProjectGenerateRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
    ai_service: MarketingCabinetAIService = Depends(get_marketing_ai_service),  # noqa: B008
) -> MarketingAiAsyncStartResponse:
    """Черновики раздела из контекста проекта + RAG (тот же JSON-контракт, что и preview «Из документа»)."""
    allowed, retry_after = await check_marketing_cabinet_ai_rate_limit(str(user_id))
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Превышен лимит AI-запросов. Попробуйте через минуту.",
            headers={"Retry-After": str(int(retry_after or 60))},
        )
    await ensure_marketing_idempotency(
        "document_autofill_project_preview_async",
        payload.idempotency_key,
        user_id=user_id,
    )

    return MarketingAiAsyncStartResponse.model_validate(
        await enqueue_document_generate_from_project(
            db_pool=db_pool,
            ai_service=ai_service,
            project_id=payload.project_id,
            user_id=user_id,
            target_section=payload.target_section,
            user_instruction=payload.user_instruction,
        )
    )


@router.post("", response_model=MarketingDocumentAutofillResponse)
async def preview_or_apply_document_autofill(
    payload: MarketingDocumentAutofillRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
    ai_service: MarketingCabinetAIService = Depends(get_marketing_ai_service),  # noqa: B008
) -> MarketingDocumentAutofillResponse:
    project = await get_accessible_project(
        db_pool, payload.project_id, user_id, for_mutation=True, required_mc_module="content_ai"
    )
    _, content_item, content_text = await _fetch_source_content(
        db_pool,
        content_id=payload.content_id,
        project_id=payload.project_id,
        company_id=project["company_id"],
    )

    if payload.mode == AutofillMode.PREVIEW:
        allowed, retry_after = await check_marketing_cabinet_ai_rate_limit(str(user_id))
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Превышен лимит AI-запросов. Попробуйте через минуту.",
                headers={"Retry-After": str(int(retry_after or 60))},
            )
        await ensure_marketing_idempotency("document_autofill_preview", payload.idempotency_key, user_id=user_id)
        project_context = await build_project_context(db_pool, payload.project_id, user_id)
        base_ctx = format_project_context_for_prompt(project_context)
        rag_q = " ".join(x for x in [payload.user_instruction or "", (content_text or "")[:500]] if (x or "").strip())
        project_context_text = await merge_project_context_text_with_rag(
            db_pool,
            project_id=payload.project_id,
            user_id=user_id,
            query=rag_q or (content_text or "")[:800],
            context_text=base_ctx,
        )
        prompt = _build_prompt(
            target_section=payload.target_section,
            content_item=content_item,
            content_text=content_text,
            project_context_text=project_context_text,
            user_instruction=payload.user_instruction,
        )
        generation_type_key = "document_structured_extract"
        runtime_warnings: list[str] = []
        generation_kwargs = {
            "user_id": str(user_id),
            "prompt": prompt,
            "project_id": str(payload.project_id),
            "company_id": str(project["company_id"]),
            "temperature": 0.2,
            "max_tokens": 4000,
            "type_key": generation_type_key,
            "json_format": True,
        }
        try:
            result = await ai_service.generate_text(**generation_kwargs)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=(
                    "Не удалось выполнить AI preview: в UGS отсутствует type_key "
                    "document_structured_extract (нужна миграция generation_types)."
                ),
            ) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Не удалось выполнить AI preview: {exc}",
            ) from exc
        raw_output = str(result.get("text") or "")
        summary, warnings, raw_items = _coerce_parsed_payload(
            raw_output,
            log_context={
                "route": "document_autofill_preview",
                "project_id": str(payload.project_id),
                "target_section": payload.target_section.value,
                "context_chars": len(project_context_text),
            },
        )
        warnings = [*runtime_warnings, *warnings]
        normalized_raw_items, preview_normalized = _normalize_preview_items_for_validation(raw_items)
        if preview_normalized:
            warnings.append(
                "Часть числовых значений из AI preview была автоматически нормализована для корректного импорта."
            )
        shaped_items, shape_warnings = _filter_raw_items_for_target_section(
            payload.target_section, normalized_raw_items
        )
        warnings = [*warnings, *shape_warnings]
        if not shaped_items and normalized_raw_items:
            logger.warning(
                "[STEP] document_autofill.preview_all_items_shape_filtered target=%s raw_count=%s",
                payload.target_section.value,
                len(normalized_raw_items),
            )
        validated_items = _validate_preview_items(payload.target_section, shaped_items)
        preview_items = _build_preview_items(payload.target_section, validated_items)
        run = await record_marketing_ai_run(
            db_pool,
            project_id=payload.project_id,
            company_id=project["company_id"],
            user_id=user_id,
            request_id=result.get("request_id"),
            tool_key=f"document_autofill_preview_{payload.target_section.value}",
            status_value="completed",
            prompt_excerpt=(payload.user_instruction or f"Preview {payload.target_section.value} from document")[:800],
            result_excerpt=(summary or raw_output)[:2000],
            metadata={
                "target_section": payload.target_section.value,
                "mode": payload.mode.value,
                "content_id": str(payload.content_id),
                "preview_count": len(preview_items),
                "generation_type_key": generation_type_key,
                "fallback_used": generation_type_key != "document_structured_extract",
                "preview_normalized": preview_normalized,
            },
        )
        return MarketingDocumentAutofillResponse.model_validate(
            {
                "run": run,
                "target_section": payload.target_section.value,
                "mode": payload.mode.value,
                "source_content": content_item,
                "summary": summary,
                "warnings": warnings,
                "preview_items": preview_items,
                "applied_items": [],
            }
        )

    await ensure_marketing_idempotency("document_autofill_apply", payload.idempotency_key, user_id=user_id)
    applied_items = await _apply_selected_items(
        db_pool,
        project=project,
        user_id=user_id,
        payload=payload,
        content_item=content_item,
    )
    run = await record_marketing_ai_run(
        db_pool,
        project_id=payload.project_id,
        company_id=project["company_id"],
        user_id=user_id,
        request_id=None,
        tool_key=f"document_autofill_apply_{payload.target_section.value}",
        status_value="completed",
        prompt_excerpt=(payload.user_instruction or f"Apply {payload.target_section.value} from document")[:800],
        result_excerpt=f"Применено элементов: {len(applied_items)}",
        metadata={
            "target_section": payload.target_section.value,
            "mode": payload.mode.value,
            "content_id": str(payload.content_id),
            "applied_count": len(applied_items),
            "selected_item_ids": payload.selected_item_ids,
        },
    )
    return MarketingDocumentAutofillResponse.model_validate(
        {
            "run": run,
            "target_section": payload.target_section.value,
            "mode": payload.mode.value,
            "source_content": content_item,
            "summary": f"Применено элементов: {len(applied_items)}",
            "warnings": [],
            "preview_items": payload.draft_items,
            "applied_items": applied_items,
        }
    )


__all__ = ("_build_prompt_project_only",)
