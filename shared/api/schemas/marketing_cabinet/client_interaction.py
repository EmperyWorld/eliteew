# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pydantic request/response contracts for Marketing Cabinet client-interaction
# (GAF bridge, customer-facing summary, doc approvals, EWRP presentation shares).
# Invariants:
# - partner mirrors FriendsService.find_user_by_id (not friendship mute/block flags).
# - JSON handlers use these models as response_model; file/HTML/PDF stay binary.
# Related:
# - api/routers/marketing_cabinet/client_interaction.py
# - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md
# ---
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator  # type: ignore[import-untyped]


class MarketingClientPartnerOut(BaseModel):
    """User card from FriendsService.find_user_by_id for CI context / chat-bridge."""

    model_config = ConfigDict(extra="ignore")

    id: str
    username: str | None = None
    avatar_url: str | None = None
    full_name: str | None = None
    is_trusted: bool = False
    admin_badge_label: str | None = None
    admin_badge_hint: str | None = None
    is_system_account: bool = False


class ClientInteractionContextOut(BaseModel):
    project_id: str
    has_representative: bool
    is_lead: bool
    is_customer_representative: bool
    representative_user_id: str | None = None
    partner: MarketingClientPartnerOut | None = None
    lead_user_ids: list[str] = Field(default_factory=list)


class ClientChatBridgeOut(BaseModel):
    chat_id: str
    partner: MarketingClientPartnerOut | None = None


class CustomerFacingMetricOut(BaseModel):
    label: str
    value: str


class CustomerFacingMetricInput(BaseModel):
    label: str = Field(..., max_length=120)
    value: str = Field(..., max_length=500)


class CustomerFacingSummaryBody(BaseModel):
    """Сводка для кабинета заказчика; редактирует только руководитель."""

    headline: str | None = Field(None, max_length=200)
    intro: str | None = Field(None, max_length=4000)
    bullets: list[str] = Field(default_factory=list)
    metrics: list[CustomerFacingMetricInput] = Field(default_factory=list)

    @field_validator("bullets")
    @classmethod
    def _normalize_bullets(cls, v: list[str]) -> list[str]:
        out: list[str] = []
        for raw in v[:24]:
            s = (raw or "").strip()
            if not s:
                continue
            out.append(s[:500])
        return out

    @field_validator("metrics")
    @classmethod
    def _limit_metrics(cls, v: list[CustomerFacingMetricInput]) -> list[CustomerFacingMetricInput]:
        return v[:12]


class CustomerFacingSummaryPayloadOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    headline: str | None = None
    intro: str | None = None
    bullets: list[str] = Field(default_factory=list)
    metrics: list[CustomerFacingMetricOut] = Field(default_factory=list)


class CustomerFacingSummaryRecordOut(BaseModel):
    payload: CustomerFacingSummaryPayloadOut
    updated_at: datetime | None = None
    updated_by_user_id: str | None = None


class CustomerFacingSummaryGetOut(BaseModel):
    summary: CustomerFacingSummaryRecordOut | None = None


class MarketingOkOut(BaseModel):
    ok: bool = True


class MarketingClientApprovalActionOut(BaseModel):
    ok: bool = True
    id: str


class MarketingClientDocCountOut(BaseModel):
    count: int


class MarketingClientRemovalIdOut(BaseModel):
    removal_id: str


class MarketingClientShareIdOut(BaseModel):
    share_id: str


class SendDocumentsBody(BaseModel):
    content_ids: list[UUID] = Field(..., min_length=1, max_length=50)


class SharePresentationBody(BaseModel):
    ewrp_job_id: UUID


class MarketingClientDocPendingRemovalOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    approval_id: str
    status: str
    confirmed_at: datetime | None = None
    created_at: datetime | None = None


class MarketingClientDocApprovalOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    project_id: str
    content_id: str
    status: str
    approved_at: datetime | None = None
    created_at: datetime | None = None
    sent_by_user_id: str
    content_name: str | None = None
    content_title: str | None = None
    pending_removal: MarketingClientDocPendingRemovalOut | None = None


class ClientEwrpJobListItemOut(BaseModel):
    id: str
    title: str | None = None
    status: str
    has_html: bool
    has_pdf: bool


class ClientPresShareOut(BaseModel):
    share_id: str
    ewrp_job_id: str
    title: str | None = None
    created_at: datetime | None = None
