# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Survey Hub API Pydantic schemas (user + admin).
# Related:
# - api/routers/product_desktop_surveys*.py
# ---

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from api.models.surveys import SurveyAudienceMode


class SurveyRewardSpec(BaseModel):
    ugs_credits: int = Field(default=0, ge=0)
    ew_balance: int = Field(default=0, ge=0)
    web_search_coins: int = Field(default=0, ge=0)


class SurveyQuestionIn(BaseModel):
    question_key: str = Field(..., min_length=1, max_length=64)
    question_type: str
    prompt: str = Field(..., min_length=1, max_length=4000)
    help_text: str | None = None
    required: bool = True
    sort_order: int = 0
    options_json: dict[str, Any] = Field(default_factory=dict)
    validation_json: dict[str, Any] = Field(default_factory=dict)


class SurveyQuestionOut(SurveyQuestionIn):
    id: UUID


class SurveyCreateBody(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description_user: str = Field(default="", max_length=8000)
    description_admin: str | None = Field(default=None, max_length=8000)
    audience_mode: str = SurveyAudienceMode.GROUPS_OR_USERS.value
    reward: SurveyRewardSpec = Field(default_factory=SurveyRewardSpec)
    gaf_notify_body_template: str | None = Field(default=None, max_length=2000)
    closes_at: datetime | None = None
    sort_order: int = 0

    @field_validator("audience_mode")
    @classmethod
    def _mode_ok(cls, v: str) -> str:
        allowed = {m.value for m in SurveyAudienceMode}
        if v not in allowed:
            msg = f"audience_mode must be one of {sorted(allowed)}"
            raise ValueError(msg)
        return v


class SurveyPatchBody(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    description_user: str | None = Field(default=None, max_length=8000)
    description_admin: str | None = Field(default=None, max_length=8000)
    audience_mode: str | None = None
    reward: SurveyRewardSpec | None = None
    gaf_notify_body_template: str | None = Field(default=None, max_length=2000)
    closes_at: datetime | None = None
    sort_order: int | None = None

    @field_validator("audience_mode")
    @classmethod
    def _mode_ok(cls, v: str | None) -> str | None:
        if v is None:
            return v
        allowed = {m.value for m in SurveyAudienceMode}
        if v not in allowed:
            msg = f"audience_mode must be one of {sorted(allowed)}"
            raise ValueError(msg)
        return v


PUBLISHED_PATCH_FIELDS = frozenset({"closes_at"})


def published_survey_patch_allowed(body: SurveyPatchBody) -> bool:
    patch_fields = body.model_fields_set
    return bool(patch_fields) and patch_fields <= PUBLISHED_PATCH_FIELDS


class SurveyAudienceBody(BaseModel):
    audience_mode: str = SurveyAudienceMode.GROUPS_OR_USERS.value
    access_group_ids: list[UUID] = Field(default_factory=list)
    user_ids: list[UUID] = Field(default_factory=list)

    @field_validator("audience_mode")
    @classmethod
    def _mode_ok(cls, v: str) -> str:
        allowed = {m.value for m in SurveyAudienceMode}
        if v not in allowed:
            msg = f"audience_mode must be one of {sorted(allowed)}"
            raise ValueError(msg)
        return v


class SurveyAdminOut(BaseModel):
    id: UUID
    title: str
    description_user: str
    description_admin: str | None
    status: str
    audience_mode: str
    reward: SurveyRewardSpec
    gaf_notify_body_template: str | None
    closes_at: datetime | None
    published_at: datetime | None
    sort_order: int
    created_at: datetime
    updated_at: datetime
    access_group_ids: list[UUID] = Field(default_factory=list)
    user_ids: list[UUID] = Field(default_factory=list)
    questions: list[SurveyQuestionOut] = Field(default_factory=list)
    question_count: int = 0
    eligible_count: int | None = None
    completed_count: int | None = None


class SurveyListAdminOut(BaseModel):
    items: list[SurveyAdminOut]
    total: int


class SurveyUserListItem(BaseModel):
    id: UUID
    title: str
    description_user: str
    status: str
    reward: SurveyRewardSpec
    closes_at: datetime | None
    published_at: datetime | None
    question_count: int
    completed: bool
    completed_at: datetime | None
    reward_granted: SurveyRewardSpec | None = None


class SurveyUserListOut(BaseModel):
    items: list[SurveyUserListItem]
    total: int


def sort_completed_survey_items(items: list[SurveyUserListItem]) -> list[SurveyUserListItem]:
    return sorted(
        items,
        key=lambda item: item.completed_at.timestamp() if item.completed_at else 0,
        reverse=True,
    )


class SurveyUserDetailOut(BaseModel):
    id: UUID
    title: str
    description_user: str
    reward: SurveyRewardSpec
    closes_at: datetime | None
    questions: list[SurveyQuestionOut]
    completed: bool
    completed_at: datetime | None = None


class SurveySummaryOut(BaseModel):
    available_count: int
    completed_count: int
    total_reward_ugs: float
    total_reward_ew: int
    total_reward_coins: int


class SurveySubmitBody(BaseModel):
    answers: dict[str, Any] = Field(default_factory=dict)
    client_meta: dict[str, Any] | None = None


class SurveySubmitOut(BaseModel):
    response_id: UUID
    submitted_at: datetime
    reward_granted: SurveyRewardSpec


class SurveyResponseUserOut(BaseModel):
    survey_id: UUID
    answers: dict[str, Any]
    submitted_at: datetime
    reward_granted: SurveyRewardSpec | None


class SurveyResponseAdminOut(BaseModel):
    id: UUID
    user_id: UUID
    answers_json: dict[str, Any]
    reward_granted_json: dict[str, Any] | None
    submitted_at: datetime


class SurveyResponseAdminListOut(BaseModel):
    items: list[SurveyResponseAdminOut]
    total: int


class AudiencePreviewOut(BaseModel):
    eligible_count: int


class SurveyGafNotifyQueuedOut(BaseModel):
    queued: bool
    mode: str


class SurveyAiDraftIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description_user: str = Field(default="", max_length=8000)
    description_admin: str | None = Field(default=None, max_length=8000)
    gaf_notify_body_template: str | None = Field(default=None, max_length=2000)
    reward: SurveyRewardSpec = Field(default_factory=SurveyRewardSpec)
    questions: list[SurveyQuestionIn] = Field(default_factory=list)


class SurveyAiDraftOut(SurveyAiDraftIn):
    pass


class SurveyAiDraftRequest(BaseModel):
    brief: str = Field(..., min_length=10, max_length=20000)
    mode: Literal["create", "refine"] = "create"
    draft: SurveyAiDraftIn | None = None
    supplement: str | None = Field(default=None, max_length=20000)


class SurveyResultsQuestionSummaryOut(BaseModel):
    question_key: str
    question_type: str
    prompt: str
    response_count: int
    distribution: dict[str, int] | None = None
    average: float | None = None
    samples: list[str] | None = None


class SurveyResultsSummaryOut(BaseModel):
    survey_id: str
    title: str
    status: str
    eligible_users: int
    completed_count: int
    completion_rate: float
    questions: list[SurveyResultsQuestionSummaryOut]
