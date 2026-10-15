# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Realtor Pro CRM HTTP routes (leads, schedule, documents, communications, listing CRUD, quota summary).
# Invariants:
# - Routes mount on the main Professional Worlds router without a path prefix change.
# - Every handler is current-user scoped via `_service` / `_current_user_id`.
# Related:
# - api/routers/professional_worlds_deps.py
# - api/services/professional_worlds/quota_service.py
# ---

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.routers.professional_worlds_deps import _current_user_id, _service
from api.schemas.professional_worlds import (
    CommunicationLogCreate,
    DealEventAppend,
    MarketingCampaignCreate,
    MarketingCampaignUpdate,
    ObjectionReplyUpsert,
    PriceAnalysisSnapshotCreate,
    PublicationChannelPatch,
    PublicationChannelUpsert,
    RealtorBuyerRequirementCreate,
    RealtorBuyerRequirementOut,
    RealtorBuyerRequirementUpdate,
    RealtorCommunicationLogOut,
    RealtorDealEventOut,
    RealtorLeadConvertOut,
    RealtorLeadCreate,
    RealtorLeadOut,
    RealtorListingQualityScoreOut,
    RealtorMarketingCampaignOut,
    RealtorObjectionReplyOut,
    RealtorPriceAnalysisSnapshotOut,
    RealtorProDocumentCreate,
    RealtorProDocumentOut,
    RealtorProDocumentUpdate,
    RealtorPropertyCreate,
    RealtorPropertyOut,
    RealtorPropertyShowingCreate,
    RealtorPropertyShowingOut,
    RealtorPropertyShowingUpdate,
    RealtorPropertyUpdate,
    RealtorPublicationChannelOut,
    RealtorQuotaSummaryOut,
    RealtorSellerProfileCreate,
    RealtorSellerProfileOut,
    RealtorSellerProfileUpdate,
    RealtorTaskCreate,
    RealtorTaskOut,
    RealtorTaskUpdate,
)
from api.services.professional_worlds.quota_service import build_realtor_quota_summary

realtor_crm_router = APIRouter()


@realtor_crm_router.get("/realtor/quota-summary", response_model=RealtorQuotaSummaryOut)
async def get_realtor_quota_summary(
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Return user-scoped PW credits usage and playbook estimate helpers for realtor."""
    return await build_realtor_quota_summary(db, _current_user_id(user))


@realtor_crm_router.get("/realtor/leads", response_model=list[RealtorLeadOut])
async def list_realtor_leads(
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[dict[str, Any]]:
    """List realtor leads for the current user."""
    return await _service(db).list_realtor_leads(_current_user_id(user))


@realtor_crm_router.post("/realtor/leads", response_model=RealtorLeadOut, status_code=status.HTTP_201_CREATED)
async def create_realtor_lead_route(
    payload: RealtorLeadCreate,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Create a realtor lead."""
    return await _service(db).create_realtor_lead(_current_user_id(user), payload)


@realtor_crm_router.post(
    "/realtor/leads/{lead_id}/convert-to-client",
    response_model=RealtorLeadConvertOut,
)
async def convert_realtor_lead_to_client_route(
    lead_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Create a CRM client from a lead and link converted_client_id."""
    result = await _service(db).convert_realtor_lead_to_client(_current_user_id(user), lead_id)
    if not result or result.get("client") is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return result


# ---------------------------------------------------------------------------
# Realtor Pro (CRM extensions — requires migration 20260505_03)
# ---------------------------------------------------------------------------


@realtor_crm_router.get("/realtor/showings", response_model=list[RealtorPropertyShowingOut])
async def list_realtor_showings_route(
    property_id: UUID | None = None,
    scheduled_from: datetime | None = Query(None),
    scheduled_to: datetime | None = Query(None),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[dict[str, Any]]:
    """List scheduled property showings for the current realtor."""
    return await _service(db).list_realtor_property_showings(
        _current_user_id(user),
        property_id=property_id,
        scheduled_from=scheduled_from,
        scheduled_to=scheduled_to,
    )


@realtor_crm_router.post(
    "/realtor/showings", response_model=RealtorPropertyShowingOut, status_code=status.HTTP_201_CREATED
)
async def create_realtor_showing_route(
    payload: RealtorPropertyShowingCreate,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Schedule a property showing."""
    row = await _service(db).create_realtor_property_showing(_current_user_id(user), payload)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property or linked entity not found")
    return row


@realtor_crm_router.get("/realtor/showings/{showing_id}", response_model=RealtorPropertyShowingOut)
async def get_realtor_showing_route(
    showing_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Return one showing owned by the current user."""
    row = await _service(db).get_realtor_property_showing(_current_user_id(user), showing_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Showing not found")
    return row


@realtor_crm_router.patch("/realtor/showings/{showing_id}", response_model=RealtorPropertyShowingOut)
async def patch_realtor_showing_route(
    showing_id: UUID,
    payload: RealtorPropertyShowingUpdate,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Patch an existing showing."""
    row = await _service(db).update_realtor_property_showing(_current_user_id(user), showing_id, payload)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Showing not found")
    return row


@realtor_crm_router.delete("/realtor/showings/{showing_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_realtor_showing_route(
    showing_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> None:
    """Delete a scheduled showing."""
    deleted = await _service(db).delete_realtor_property_showing(_current_user_id(user), showing_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Showing not found")


@realtor_crm_router.get("/realtor/tasks", response_model=list[RealtorTaskOut])
async def list_realtor_tasks_route(
    task_status: str | None = Query(None, alias="status"),
    property_id: UUID | None = None,
    due_before: datetime | None = Query(None),
    due_after: datetime | None = Query(None),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[dict[str, Any]]:
    """List Realtor Pro tasks with optional due-date window."""
    return await _service(db).list_realtor_tasks(
        _current_user_id(user),
        status=task_status,
        property_id=property_id,
        due_before=due_before,
        due_after=due_after,
    )


@realtor_crm_router.post("/realtor/tasks", response_model=RealtorTaskOut, status_code=status.HTTP_201_CREATED)
async def create_realtor_task_route(
    payload: RealtorTaskCreate,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Create a Realtor Pro task."""
    row = await _service(db).create_realtor_task(_current_user_id(user), payload)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Linked entity not found")
    return row


@realtor_crm_router.get("/realtor/tasks/{task_id}", response_model=RealtorTaskOut)
async def get_realtor_task_route(
    task_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    row = await _service(db).get_realtor_task(_current_user_id(user), task_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return row


@realtor_crm_router.patch("/realtor/tasks/{task_id}", response_model=RealtorTaskOut)
async def patch_realtor_task_route(
    task_id: UUID,
    payload: RealtorTaskUpdate,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    row = await _service(db).update_realtor_task(_current_user_id(user), task_id, payload)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return row


@realtor_crm_router.delete("/realtor/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_realtor_task_route(
    task_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> None:
    deleted = await _service(db).delete_realtor_task(_current_user_id(user), task_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")


@realtor_crm_router.get("/realtor/buyer-requirements", response_model=list[RealtorBuyerRequirementOut])
async def list_buyer_requirements_route(
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[dict[str, Any]]:
    """List buyer requirement sheets."""
    return await _service(db).list_buyer_requirements(_current_user_id(user))


@realtor_crm_router.post(
    "/realtor/buyer-requirements", response_model=RealtorBuyerRequirementOut, status_code=status.HTTP_201_CREATED
)
async def create_buyer_requirement_route(
    payload: RealtorBuyerRequirementCreate,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Create buyer requirements."""
    return await _service(db).create_buyer_requirement(_current_user_id(user), payload)


@realtor_crm_router.patch("/realtor/buyer-requirements/{req_id}", response_model=RealtorBuyerRequirementOut)
async def update_buyer_requirement_route(
    req_id: UUID,
    payload: RealtorBuyerRequirementUpdate,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Patch buyer requirements row."""
    row = await _service(db).update_buyer_requirement(_current_user_id(user), req_id, payload)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Buyer requirements not found")
    return row


@realtor_crm_router.get("/realtor/seller-profiles", response_model=list[RealtorSellerProfileOut])
async def list_seller_profiles_route(
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[dict[str, Any]]:
    """List seller context profiles."""
    return await _service(db).list_seller_profiles(_current_user_id(user))


@realtor_crm_router.post(
    "/realtor/seller-profiles", response_model=RealtorSellerProfileOut, status_code=status.HTTP_201_CREATED
)
async def create_seller_profile_route(
    payload: RealtorSellerProfileCreate,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Create seller profile."""
    return await _service(db).create_seller_profile(_current_user_id(user), payload)


@realtor_crm_router.patch("/realtor/seller-profiles/{profile_id}", response_model=RealtorSellerProfileOut)
async def update_seller_profile_route(
    profile_id: UUID,
    payload: RealtorSellerProfileUpdate,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Replace seller_context JSON."""
    row = await _service(db).update_seller_profile(_current_user_id(user), profile_id, payload)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Seller profile not found")
    return row


@realtor_crm_router.get("/realtor/deals/{deal_id}/events", response_model=list[RealtorDealEventOut])
async def list_deal_events_route(
    deal_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[dict[str, Any]]:
    """List pipeline events for a deal (empty if not owned)."""
    return await _service(db).list_deal_events(_current_user_id(user), deal_id)


@realtor_crm_router.post(
    "/realtor/deals/{deal_id}/events", response_model=RealtorDealEventOut, status_code=status.HTTP_201_CREATED
)
async def append_deal_event_route(
    deal_id: UUID,
    payload: DealEventAppend,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Append deal stage / note event."""
    row = await _service(db).append_deal_event(_current_user_id(user), deal_id, payload)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")
    return row


@realtor_crm_router.get("/realtor/documents", response_model=list[RealtorProDocumentOut])
async def list_realtor_documents_route(
    deal_id: UUID | None = Query(default=None),
    property_id: UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[dict[str, Any]]:
    """List document rows with optional deal/property filter."""
    return await _service(db).list_realtor_documents(_current_user_id(user), deal_id=deal_id, property_id=property_id)


@realtor_crm_router.post(
    "/realtor/documents", response_model=RealtorProDocumentOut, status_code=status.HTTP_201_CREATED
)
async def create_realtor_document_route(
    payload: RealtorProDocumentCreate,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Create document checklist row."""
    row = await _service(db).create_realtor_document(_current_user_id(user), payload)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Linked deal/property not found or not owned")
    return row


@realtor_crm_router.patch("/realtor/documents/{doc_id}", response_model=RealtorProDocumentOut)
async def update_realtor_document_route(
    doc_id: UUID,
    payload: RealtorProDocumentUpdate,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Patch realtor document."""
    row = await _service(db).update_realtor_document(_current_user_id(user), doc_id, payload)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return row


@realtor_crm_router.get(
    "/realtor/properties/{property_id}/price-snapshots", response_model=list[RealtorPriceAnalysisSnapshotOut]
)
async def list_price_snapshots_route(
    property_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[dict[str, Any]]:
    """Price / comps snapshot history."""
    return await _service(db).list_price_snapshots(_current_user_id(user), property_id)


@realtor_crm_router.post(
    "/realtor/properties/{property_id}/price-snapshots",
    response_model=RealtorPriceAnalysisSnapshotOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_price_snapshot_route(
    property_id: UUID,
    payload: PriceAnalysisSnapshotCreate,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Store a new price analysis snapshot."""
    row = await _service(db).create_price_snapshot(_current_user_id(user), property_id, payload)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    return row


@realtor_crm_router.get("/realtor/marketing-campaigns", response_model=list[RealtorMarketingCampaignOut])
async def list_marketing_campaigns_route(
    property_id: UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[dict[str, Any]]:
    """List campaigns, optionally filtered by property."""
    return await _service(db).list_marketing_campaigns(_current_user_id(user), property_id)


@realtor_crm_router.post(
    "/realtor/marketing-campaigns", response_model=RealtorMarketingCampaignOut, status_code=status.HTTP_201_CREATED
)
async def create_marketing_campaign_route(
    payload: MarketingCampaignCreate,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Create marketing campaign."""
    row = await _service(db).create_marketing_campaign(_current_user_id(user), payload)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found or not owned")
    return row


@realtor_crm_router.patch("/realtor/marketing-campaigns/{campaign_id}", response_model=RealtorMarketingCampaignOut)
async def update_marketing_campaign_route(
    campaign_id: UUID,
    payload: MarketingCampaignUpdate,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Patch campaign."""
    row = await _service(db).update_marketing_campaign(_current_user_id(user), campaign_id, payload)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    return row


@realtor_crm_router.get("/realtor/communication-logs", response_model=list[RealtorCommunicationLogOut])
async def list_communication_logs_route(
    related_type: str | None = Query(default=None),
    related_id: UUID | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[dict[str, Any]]:
    """Communication timeline."""
    return await _service(db).list_communication_logs(
        _current_user_id(user), related_type=related_type, related_id=related_id, limit=limit
    )


@realtor_crm_router.post(
    "/realtor/communication-logs", response_model=RealtorCommunicationLogOut, status_code=status.HTTP_201_CREATED
)
async def create_communication_log_route(
    payload: CommunicationLogCreate,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Log communication."""
    return await _service(db).create_communication_log(_current_user_id(user), payload)


@realtor_crm_router.get("/realtor/objection-replies", response_model=list[RealtorObjectionReplyOut])
async def list_objection_replies_route(
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[dict[str, Any]]:
    """Objection handling snippets."""
    return await _service(db).list_objection_replies(_current_user_id(user))


@realtor_crm_router.put("/realtor/objection-replies/{objection_key:path}", response_model=RealtorObjectionReplyOut)
async def upsert_objection_reply_route(
    objection_key: str,
    payload: ObjectionReplyUpsert,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Create or update a reply for an objection key."""
    return await _service(db).upsert_objection_reply(_current_user_id(user), objection_key, payload)


@realtor_crm_router.get(
    "/realtor/properties/{property_id}/publication-channels",
    response_model=list[RealtorPublicationChannelOut],
)
async def list_publication_channels_route(
    property_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[dict[str, Any]]:
    """Per-listing publication channel statuses."""
    return await _service(db).list_publication_channels(_current_user_id(user), property_id)


@realtor_crm_router.post(
    "/realtor/properties/{property_id}/publication-channels",
    response_model=RealtorPublicationChannelOut,
    status_code=status.HTTP_201_CREATED,
)
async def upsert_publication_channel_route(
    property_id: UUID,
    payload: PublicationChannelUpsert,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Upsert publication channel row by channel_key."""
    row = await _service(db).upsert_publication_channel(_current_user_id(user), property_id, payload)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    return row


@realtor_crm_router.patch("/realtor/publication-channels/{channel_id}", response_model=RealtorPublicationChannelOut)
async def patch_publication_channel_route(
    channel_id: UUID,
    payload: PublicationChannelPatch,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Patch publication channel by id."""
    row = await _service(db).update_publication_channel(_current_user_id(user), channel_id, payload)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")
    return row


@realtor_crm_router.post(
    "/realtor/properties/{property_id}/listing-quality/recompute",
    response_model=RealtorListingQualityScoreOut,
    status_code=status.HTTP_201_CREATED,
)
async def recompute_listing_quality_route(
    property_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Recompute heuristic listing quality and append score row."""
    row = await _service(db).recompute_listing_quality(_current_user_id(user), property_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    return row


@realtor_crm_router.get(
    "/realtor/properties/{property_id}/listing-quality/scores",
    response_model=list[RealtorListingQualityScoreOut],
)
async def list_listing_quality_scores_route(
    property_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[dict[str, Any]]:
    """Listing quality history."""
    return await _service(db).list_listing_quality_scores(_current_user_id(user), property_id)


@realtor_crm_router.get("/realtor/properties", response_model=list[RealtorPropertyOut])
async def list_realtor_properties(
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[dict[str, Any]]:
    """List current user's realtor properties."""
    return await _service(db).list_properties(_current_user_id(user))


@realtor_crm_router.post("/realtor/properties", response_model=RealtorPropertyOut, status_code=status.HTTP_201_CREATED)
async def create_realtor_property(
    payload: RealtorPropertyCreate,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Create a realtor property."""
    return await _service(db).create_property(_current_user_id(user), payload)


@realtor_crm_router.get("/realtor/properties/{property_id}", response_model=RealtorPropertyOut)
async def get_realtor_property(
    property_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Return one realtor property."""
    row = await _service(db).get_property(_current_user_id(user), property_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    return row


@realtor_crm_router.patch("/realtor/properties/{property_id}", response_model=RealtorPropertyOut)
async def update_realtor_property(
    property_id: UUID,
    payload: RealtorPropertyUpdate,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Patch a realtor property."""
    row = await _service(db).update_property(_current_user_id(user), property_id, payload)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    return row


@realtor_crm_router.delete("/realtor/properties/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_realtor_property(
    property_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> None:
    """Soft delete a realtor property."""
    deleted = await _service(db).delete_property(_current_user_id(user), property_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
