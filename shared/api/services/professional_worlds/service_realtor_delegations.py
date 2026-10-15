# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Realtor Pro delegation mixin for ProfessionalWorldsService — thin wrappers over realtor_pro and leads.
# Invariants:
# - All methods require user_id ownership checks in underlying realtor_pro modules.
# Related:
# - api/services/professional_worlds/service.py
# - api/services/professional_worlds/realtor_pro.py
# ---

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.schemas.professional_worlds import (
    CommunicationLogCreate,
    DealEventAppend,
    MarketingCampaignCreate,
    MarketingCampaignUpdate,
    ObjectionReplyUpsert,
    PriceAnalysisSnapshotCreate,
    ProfessionalClientCreate,
    PublicationChannelPatch,
    PublicationChannelUpsert,
    RealtorBuyerRequirementCreate,
    RealtorBuyerRequirementUpdate,
    RealtorLeadCreate,
    RealtorProDocumentCreate,
    RealtorProDocumentUpdate,
    RealtorPropertyShowingCreate,
    RealtorPropertyShowingUpdate,
    RealtorSellerProfileCreate,
    RealtorSellerProfileUpdate,
    RealtorTaskCreate,
    RealtorTaskUpdate,
)
from api.services.professional_worlds import (
    professional_crm_service,
    realtor_leads_service,
    realtor_pro,
)


class ProfessionalWorldsRealtorDelegationsMixin:
    """Realtor Pro CRUD/showings/tasks delegations mixed into ProfessionalWorldsService."""

    db: AsyncSession

    async def list_realtor_leads(self, user_id: UUID) -> list[dict[str, Any]]:
        """List realtor leads for a user."""
        return await realtor_leads_service.list_realtor_leads(self.db, user_id)

    async def create_realtor_lead(self, user_id: UUID, payload: RealtorLeadCreate) -> dict[str, Any]:
        """Create a realtor lead."""
        return await realtor_leads_service.create_realtor_lead(self.db, user_id, payload)

    async def convert_realtor_lead_to_client(self, user_id: UUID, lead_id: UUID) -> dict[str, Any]:
        """Create a CRM client from a lead and link converted_client_id."""

        async def create_client(user_id: UUID, payload: ProfessionalClientCreate) -> dict[str, Any]:
            return await professional_crm_service.create_client(self.db, user_id, payload)

        return await realtor_leads_service.convert_realtor_lead_to_client(
            self.db,
            user_id,
            lead_id,
            create_client=create_client,
        )

    async def list_realtor_property_showings(
        self,
        user_id: UUID,
        *,
        property_id: UUID | None = None,
        scheduled_from: datetime | None = None,
        scheduled_to: datetime | None = None,
    ) -> list[dict[str, Any]]:
        """List property showings owned by the current user."""
        return await realtor_pro.list_property_showings(
            self.db,
            user_id,
            property_id=property_id,
            scheduled_from=scheduled_from,
            scheduled_to=scheduled_to,
        )

    async def get_realtor_property_showing(self, user_id: UUID, showing_id: UUID) -> dict[str, Any] | None:
        """Return one showing row if owned by the user."""
        return await realtor_pro.get_property_showing(self.db, user_id, showing_id)

    async def create_realtor_property_showing(
        self, user_id: UUID, payload: RealtorPropertyShowingCreate
    ) -> dict[str, Any] | None:
        """Create a showing after validating linked entities."""
        return await realtor_pro.create_property_showing(
            self.db,
            user_id,
            property_id=payload.property_id,
            client_id=payload.client_id,
            scheduled_at=payload.scheduled_at,
            status=payload.status,
            notes=payload.notes,
            duration_minutes=payload.duration_minutes,
            location_notes=payload.location_notes,
            deal_id=payload.deal_id,
        )

    async def update_realtor_property_showing(
        self, user_id: UUID, showing_id: UUID, payload: RealtorPropertyShowingUpdate
    ) -> dict[str, Any] | None:
        """Patch a showing owned by the user."""
        return await realtor_pro.update_property_showing(
            self.db,
            user_id,
            showing_id,
            scheduled_at=payload.scheduled_at,
            status=payload.status,
            notes=payload.notes,
            duration_minutes=payload.duration_minutes,
            location_notes=payload.location_notes,
            client_id=payload.client_id,
            deal_id=payload.deal_id,
            unset_client=payload.clear_client,
            unset_deal=payload.clear_deal,
        )

    async def delete_realtor_property_showing(self, user_id: UUID, showing_id: UUID) -> bool:
        """Delete a showing row."""
        return await realtor_pro.delete_property_showing(self.db, user_id, showing_id)

    async def list_realtor_tasks(
        self,
        user_id: UUID,
        *,
        status: str | None = None,
        property_id: UUID | None = None,
        due_before: datetime | None = None,
        due_after: datetime | None = None,
    ) -> list[dict[str, Any]]:
        """List Realtor Pro tasks with optional due-date window filters."""
        return await realtor_pro.list_realtor_tasks(
            self.db,
            user_id,
            status=status,
            property_id=property_id,
            due_before=due_before,
            due_after=due_after,
        )

    async def get_realtor_task(self, user_id: UUID, task_id: UUID) -> dict[str, Any] | None:
        return await realtor_pro.get_realtor_task(self.db, user_id, task_id)

    async def create_realtor_task(self, user_id: UUID, payload: RealtorTaskCreate) -> dict[str, Any] | None:
        return await realtor_pro.create_realtor_task(
            self.db,
            user_id,
            title=payload.title,
            status=payload.status,
            priority=payload.priority,
            due_at=payload.due_at,
            reminder_at=payload.reminder_at,
            next_action=payload.next_action,
            notes=payload.notes,
            property_id=payload.property_id,
            client_id=payload.client_id,
            showing_id=payload.showing_id,
            deal_id=payload.deal_id,
            task_meta=payload.task_meta,
        )

    async def update_realtor_task(
        self, user_id: UUID, task_id: UUID, payload: RealtorTaskUpdate
    ) -> dict[str, Any] | None:
        return await realtor_pro.update_realtor_task(
            self.db,
            user_id,
            task_id,
            title=payload.title,
            status=payload.status,
            priority=payload.priority,
            due_at=payload.due_at,
            reminder_at=payload.reminder_at,
            next_action=payload.next_action,
            notes=payload.notes,
            property_id=payload.property_id,
            client_id=payload.client_id,
            showing_id=payload.showing_id,
            deal_id=payload.deal_id,
            task_meta=payload.task_meta,
            unset_property=payload.clear_property,
            unset_client=payload.clear_client,
            unset_showing=payload.clear_showing,
            unset_deal=payload.clear_deal,
        )

    async def delete_realtor_task(self, user_id: UUID, task_id: UUID) -> bool:
        return await realtor_pro.delete_realtor_task(self.db, user_id, task_id)

    async def list_buyer_requirements(self, user_id: UUID) -> list[dict[str, Any]]:
        return await realtor_pro.list_buyer_requirements(self.db, user_id)

    async def create_buyer_requirement(self, user_id: UUID, payload: RealtorBuyerRequirementCreate) -> dict[str, Any]:
        return await realtor_pro.create_buyer_requirement(
            self.db, user_id, title=payload.title, client_id=payload.client_id, requirements=payload.requirements
        )

    async def update_buyer_requirement(
        self, user_id: UUID, req_id: UUID, payload: RealtorBuyerRequirementUpdate
    ) -> dict[str, Any] | None:
        return await realtor_pro.update_buyer_requirement(
            self.db, user_id, req_id, title=payload.title, requirements=payload.requirements
        )

    async def list_seller_profiles(self, user_id: UUID) -> list[dict[str, Any]]:
        return await realtor_pro.list_seller_profiles(self.db, user_id)

    async def create_seller_profile(self, user_id: UUID, payload: RealtorSellerProfileCreate) -> dict[str, Any]:
        return await realtor_pro.create_seller_profile(
            self.db, user_id, client_id=payload.client_id, seller_context=payload.seller_context
        )

    async def update_seller_profile(
        self, user_id: UUID, profile_id: UUID, payload: RealtorSellerProfileUpdate
    ) -> dict[str, Any] | None:
        return await realtor_pro.update_seller_profile(
            self.db, user_id, profile_id, seller_context=payload.seller_context
        )

    async def list_deal_events(self, user_id: UUID, deal_id: UUID) -> list[dict[str, Any]]:
        return await realtor_pro.list_deal_events(self.db, user_id, deal_id)

    async def append_deal_event(self, user_id: UUID, deal_id: UUID, payload: DealEventAppend) -> dict[str, Any] | None:
        return await realtor_pro.append_deal_event(
            self.db,
            user_id,
            deal_id,
            stage_from=payload.stage_from,
            stage_to=payload.stage_to,
            note=payload.note,
            event_data=payload.event_data,
        )

    async def list_realtor_documents(
        self, user_id: UUID, *, deal_id: UUID | None, property_id: UUID | None
    ) -> list[dict[str, Any]]:
        return await realtor_pro.list_realtor_documents(self.db, user_id, deal_id=deal_id, property_id=property_id)

    async def create_realtor_document(self, user_id: UUID, payload: RealtorProDocumentCreate) -> dict[str, Any] | None:
        return await realtor_pro.create_realtor_document(
            self.db,
            user_id,
            deal_id=payload.deal_id,
            property_id=payload.property_id,
            title=payload.title,
            doc_type=payload.doc_type,
            checklist_state=payload.checklist_state,
            unified_content_id=payload.unified_content_id,
        )

    async def update_realtor_document(
        self, user_id: UUID, doc_id: UUID, payload: RealtorProDocumentUpdate
    ) -> dict[str, Any] | None:
        return await realtor_pro.update_realtor_document(
            self.db,
            user_id,
            doc_id,
            title=payload.title,
            doc_type=payload.doc_type,
            checklist_state=payload.checklist_state,
            unified_content_id=payload.unified_content_id,
        )

    async def list_price_snapshots(self, user_id: UUID, property_id: UUID) -> list[dict[str, Any]]:
        return await realtor_pro.list_price_snapshots(self.db, user_id, property_id)

    async def create_price_snapshot(
        self, user_id: UUID, property_id: UUID, payload: PriceAnalysisSnapshotCreate
    ) -> dict[str, Any] | None:
        return await realtor_pro.create_price_snapshot(self.db, user_id, property_id, snapshot=payload.snapshot)

    async def list_marketing_campaigns(self, user_id: UUID, property_id: UUID | None) -> list[dict[str, Any]]:
        return await realtor_pro.list_marketing_campaigns(self.db, user_id, property_id)

    async def create_marketing_campaign(self, user_id: UUID, payload: MarketingCampaignCreate) -> dict[str, Any] | None:
        return await realtor_pro.create_marketing_campaign(
            self.db,
            user_id,
            property_id=payload.property_id,
            title=payload.title,
            channels=payload.channels,
            status=payload.status,
            campaign_data=payload.campaign_data,
        )

    async def update_marketing_campaign(
        self, user_id: UUID, campaign_id: UUID, payload: MarketingCampaignUpdate
    ) -> dict[str, Any] | None:
        return await realtor_pro.update_marketing_campaign(
            self.db,
            user_id,
            campaign_id,
            title=payload.title,
            channels=payload.channels,
            status=payload.status,
            campaign_data=payload.campaign_data,
        )

    async def list_communication_logs(
        self,
        user_id: UUID,
        *,
        related_type: str | None,
        related_id: UUID | None,
        limit: int = 200,
    ) -> list[dict[str, Any]]:
        return await realtor_pro.list_communication_logs(
            self.db, user_id, related_type=related_type, related_id=related_id, limit=limit
        )

    async def create_communication_log(self, user_id: UUID, payload: CommunicationLogCreate) -> dict[str, Any]:
        return await realtor_pro.create_communication_log(
            self.db,
            user_id,
            related_type=payload.related_type,
            related_id=payload.related_id,
            channel=payload.channel,
            body=payload.body,
            meta=payload.meta,
        )

    async def list_objection_replies(self, user_id: UUID) -> list[dict[str, Any]]:
        return await realtor_pro.list_objection_replies(self.db, user_id)

    async def upsert_objection_reply(
        self, user_id: UUID, objection_key: str, payload: ObjectionReplyUpsert
    ) -> dict[str, Any]:
        return await realtor_pro.upsert_objection_reply(
            self.db, user_id, objection_key, reply_text=payload.reply_text, tags=payload.tags
        )

    async def list_publication_channels(self, user_id: UUID, property_id: UUID) -> list[dict[str, Any]]:
        return await realtor_pro.list_publication_channels(self.db, user_id, property_id)

    async def upsert_publication_channel(
        self, user_id: UUID, property_id: UUID, payload: PublicationChannelUpsert
    ) -> dict[str, Any] | None:
        return await realtor_pro.upsert_publication_channel(
            self.db,
            user_id,
            property_id,
            channel_key=payload.channel_key,
            status=payload.status,
            meta=payload.meta,
        )

    async def update_publication_channel(
        self, user_id: UUID, channel_row_id: UUID, payload: PublicationChannelPatch
    ) -> dict[str, Any] | None:
        return await realtor_pro.update_publication_channel_meta(
            self.db, user_id, channel_row_id, status=payload.status, meta=payload.meta
        )

    async def recompute_listing_quality(self, user_id: UUID, property_id: UUID) -> dict[str, Any] | None:
        return await realtor_pro.recompute_listing_quality(self.db, user_id, property_id)

    async def list_listing_quality_scores(self, user_id: UUID, property_id: UUID) -> list[dict[str, Any]]:
        return await realtor_pro.list_listing_quality_scores(self.db, user_id, property_id)
