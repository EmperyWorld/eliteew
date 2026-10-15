# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Thin orchestration facade for Professional Worlds: runtime config, snapshot, CRM, media, and AI glue.
# Realtor Pro CRUD delegations live in service_realtor_delegations; schema/brand/prompt lookups are split modules.
# Invariants:
# - All mutable domain queries include user_id.
# - Object-intake previews surface parse fallbacks via warnings rather than silently showing template defaults.
# Related:
# - api/routers/professional_worlds.py
# - api/services/professional_worlds/service_realtor_delegations.py
# - api/services/professional_worlds/vertical_schema_service.py
# - api/services/professional_worlds/brand_kit_service.py
# - api/services/professional_worlds/runtime_lookup_service.py
# - api/services/professional_worlds/realtor_generation_prompts.py
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.schemas.professional_worlds import (
    CoachSimulationBody,
    LessonCompleteBody,
    MediaEnhancementRequest,
    ObjectIntakeCommitRequest,
    ObjectIntakeParseRequest,
    ProfessionalClientCreate,
    ProfessionalClientUpdate,
    ProfessionalDealCreate,
    ProfessionalDealUpdate,
    ProfessionalMediaAlbumCreate,
    ProfessionalMediaAlbumPatch,
    RealtorGenerationBody,
    RealtorPropertyCreate,
    RealtorPropertyMediaCreate,
    RealtorPropertyUpdate,
    SpecialistProfileUpsert,
)
from api.services.professional_worlds import (
    brand_kit_service,
    media_batch_service,
    media_enhancement_service,
    object_intake_jobs_service,
    professional_artifacts_service,
    professional_crm_service,
    professional_learning_service,
    professional_media_albums_service,
    professional_profile_service,
    realtor_generation_prompts,
    realtor_properties_service,
    runtime_config_service,
    runtime_lookup_service,
    snapshot_service,
    vertical_schema_service,
)
from api.services.professional_worlds.media_output_naming import (
    pw_media_display_name,
    pw_media_uc_metadata,
)
from api.services.professional_worlds.object_intake_parsing import (
    build_object_intake_prompt,
    parse_object_intake_result,
)
from api.services.professional_worlds.service_realtor_delegations import (
    ProfessionalWorldsRealtorDelegationsMixin,
)
from api.services.professional_worlds.snapshot_helpers import REALTOR_VERTICAL_SLUG
from api.services.professional_worlds.vertical_schema_service import ActiveSchemaValidationError

logger = logging.getLogger(__name__)

__all__ = [
    "ActiveSchemaValidationError",
    "ProfessionalWorldsService",
    "REALTOR_VERTICAL_SLUG",
    "pw_media_display_name",
    "pw_media_uc_metadata",
]


class ProfessionalWorldsService(ProfessionalWorldsRealtorDelegationsMixin):
    """User-scoped data service for Professional Worlds."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_verticals(self) -> list[dict[str, Any]]:
        """List active profession verticals."""
        return await runtime_config_service.list_verticals(self.db)

    async def get_runtime_config(
        self, vertical_slug: str = REALTOR_VERTICAL_SLUG, *, user_id: UUID | None = None
    ) -> dict[str, Any]:
        """Resolve enabled runtime modules, schemas, AI actions, photo presets and integrations."""
        return await runtime_config_service.get_runtime_config(self.db, vertical_slug, user_id=user_id)

    async def list_user_vertical_activations(self, user_id: UUID) -> list[dict[str, Any]]:
        """List active Professional Worlds verticals for a user."""
        return await runtime_config_service.list_user_vertical_activations(self.db, user_id)

    async def upsert_user_vertical_activation(
        self, user_id: UUID, vertical_slug: str, *, is_active: bool
    ) -> dict[str, Any]:
        """Activate or deactivate a vertical for the current user."""
        return await runtime_config_service.upsert_user_vertical_activation(
            self.db, user_id, vertical_slug, is_active=is_active
        )

    async def patch_user_vertical_onboarding(
        self, user_id: UUID, vertical_slug: str, onboarding: Mapping[str, Any]
    ) -> dict[str, Any]:
        """Patch onboarding JSON for a user's vertical activation."""
        return await runtime_config_service.patch_user_vertical_onboarding(self.db, user_id, vertical_slug, onboarding)

    async def list_runtime_configs_for_user(self, user_id: UUID) -> list[dict[str, Any]]:
        """Return runtime config for every active user vertical."""
        return await runtime_config_service.list_runtime_configs_for_user(self.db, user_id)

    async def load_user_snapshot(self, user_id: UUID, vertical_slug: str = REALTOR_VERTICAL_SLUG) -> dict[str, Any]:
        """Build the Desktop bootstrap snapshot for one vertical with module-aware fetches."""
        return await snapshot_service.load_user_snapshot(self, user_id, vertical_slug)

    async def get_active_schema(self, vertical_slug: str, schema_key: str) -> dict[str, Any] | None:
        """Return active schema metadata for lightweight runtime validation."""
        return await vertical_schema_service.get_active_schema(self.db, vertical_slug, schema_key)

    async def validate_against_active_schema(
        self, vertical_slug: str, schema_key: str, payload: Mapping[str, Any], *, partial: bool = False
    ) -> None:
        """Validate required fields from active JSON schema without adding a new dependency."""
        await vertical_schema_service.validate_against_active_schema(
            self.db, vertical_slug, schema_key, payload, partial=partial
        )

    async def get_profile(self, user_id: UUID, vertical_slug: str = REALTOR_VERTICAL_SLUG) -> dict[str, Any] | None:
        """Return a specialist profile owned by the user."""
        return await professional_profile_service.get_profile(self.db, user_id, vertical_slug=vertical_slug)

    async def upsert_profile(self, user_id: UUID, payload: SpecialistProfileUpsert) -> dict[str, Any]:
        """Create or update the user's specialist profile."""
        return await professional_profile_service.upsert_profile(
            self.db,
            user_id,
            payload,
            validate_against_active_schema=self.validate_against_active_schema,
        )

    async def list_properties(self, user_id: UUID) -> list[dict[str, Any]]:
        """List non-deleted realtor properties for a user."""
        return await realtor_properties_service.list_properties(self.db, user_id)

    async def create_property(self, user_id: UUID, payload: RealtorPropertyCreate) -> dict[str, Any]:
        """Create a realtor property."""
        return await realtor_properties_service.create_property(
            self.db,
            user_id,
            payload,
            validate_against_active_schema=self.validate_against_active_schema,
        )

    async def get_property(self, user_id: UUID, property_id: UUID) -> dict[str, Any] | None:
        """Return one realtor property owned by a user."""
        return await realtor_properties_service.get_property(self.db, user_id, property_id)

    async def update_property(
        self, user_id: UUID, property_id: UUID, payload: RealtorPropertyUpdate
    ) -> dict[str, Any] | None:
        """Patch a realtor property."""
        return await realtor_properties_service.update_property(
            self.db,
            user_id,
            property_id,
            payload,
            validate_against_active_schema=self.validate_against_active_schema,
        )

    async def delete_property(self, user_id: UUID, property_id: UUID) -> bool:
        """Soft delete a realtor property."""
        return await realtor_properties_service.delete_property(self.db, user_id, property_id)

    async def attach_property_media(
        self, user_id: UUID, property_id: UUID, payload: RealtorPropertyMediaCreate
    ) -> dict[str, Any] | None:
        """Attach existing Unified Content media to a realtor property."""
        return await realtor_properties_service.attach_property_media(self.db, user_id, property_id, payload)

    async def list_property_media(self, user_id: UUID, property_id: UUID) -> list[dict[str, Any]] | None:
        """List Unified Content media attached to a realtor property."""
        return await realtor_properties_service.list_property_media(self.db, user_id, property_id)

    async def delete_property_media(self, user_id: UUID, property_id: UUID, media_id: UUID) -> bool:
        """Remove a media attachment from a realtor property."""
        return await realtor_properties_service.delete_property_media(self.db, user_id, property_id, media_id)

    async def apply_accepted_enhancement_to_property(
        self,
        user_id: UUID,
        property_id: UUID,
        *,
        source_content_id: UUID | None,
        output_content_id: UUID,
        preset_key: str | None = None,
    ) -> dict[str, Any]:
        """Replace listing photo source→output when user accepts an enhancement candidate."""
        return await realtor_properties_service.apply_accepted_enhancement_to_property(
            self.db,
            user_id,
            property_id,
            source_content_id=source_content_id,
            output_content_id=output_content_id,
            preset_key=preset_key,
        )

    async def list_clients(self, user_id: UUID, vertical_slug: str = REALTOR_VERTICAL_SLUG) -> list[dict[str, Any]]:
        """List CRM-lite clients."""
        return await professional_crm_service.list_clients(self.db, user_id, vertical_slug=vertical_slug)

    async def create_client(self, user_id: UUID, payload: ProfessionalClientCreate) -> dict[str, Any]:
        """Create CRM-lite client."""
        return await professional_crm_service.create_client(self.db, user_id, payload)

    async def update_client(
        self, user_id: UUID, client_id: UUID, payload: ProfessionalClientUpdate
    ) -> dict[str, Any] | None:
        """Patch CRM-lite client."""
        return await professional_crm_service.update_client(self.db, user_id, client_id, payload)

    async def delete_client(self, user_id: UUID, client_id: UUID) -> bool:
        """Delete CRM-lite client when no linked deals exist."""
        return await professional_crm_service.delete_client(self.db, user_id, client_id)

    async def list_deals(self, user_id: UUID, vertical_slug: str = REALTOR_VERTICAL_SLUG) -> list[dict[str, Any]]:
        """List deals."""
        return await professional_crm_service.list_deals(self.db, user_id, vertical_slug=vertical_slug)

    async def create_deal(self, user_id: UUID, payload: ProfessionalDealCreate) -> dict[str, Any]:
        """Create deal."""
        return await professional_crm_service.create_deal(self.db, user_id, payload)

    async def update_deal(self, user_id: UUID, deal_id: UUID, payload: ProfessionalDealUpdate) -> dict[str, Any] | None:
        """Patch deal."""
        return await professional_crm_service.update_deal(self.db, user_id, deal_id, payload)

    async def delete_deal(self, user_id: UUID, deal_id: UUID) -> bool:
        """Delete deal."""
        return await professional_crm_service.delete_deal(self.db, user_id, deal_id)

    async def backfill_deal_property_links(
        self, user_id: UUID, vertical_slug: str = REALTOR_VERTICAL_SLUG
    ) -> dict[str, int]:
        """Persist unique legacy title matches into deal_data.property_id (idempotent)."""
        return await professional_crm_service.backfill_deal_property_links(
            self.db, user_id, vertical_slug=vertical_slug
        )

    async def list_courses(self, user_id: UUID, vertical_slug: str = REALTOR_VERTICAL_SLUG) -> list[dict[str, Any]]:
        """List courses with lessons and completion flags."""
        return await professional_learning_service.list_courses(self.db, user_id, vertical_slug=vertical_slug)

    async def complete_lesson(self, user_id: UUID, lesson_id: UUID, payload: LessonCompleteBody) -> bool:
        """Mark a lesson as completed for the current user."""
        return await professional_learning_service.complete_lesson(self.db, user_id, lesson_id, payload)

    async def list_artifacts(self, user_id: UUID, vertical_slug: str = REALTOR_VERTICAL_SLUG) -> list[dict[str, Any]]:
        """List current-user artifacts."""
        return await professional_artifacts_service.list_artifacts(self.db, user_id, vertical_slug=vertical_slug)

    async def save_artifact(
        self,
        *,
        user_id: UUID,
        source_type: str,
        title: str,
        content: str,
        source_id: UUID | None = None,
        recipe_key: str | None = None,
        artifact_data: dict[str, Any] | None = None,
        unified_content_id: UUID | None = None,
        ugs_request_id: UUID | None = None,
        module_key: str | None = None,
        artifact_kind: str = "text",
        parent_artifact_id: UUID | None = None,
        source_media_id: UUID | None = None,
        export_metadata: dict[str, Any] | None = None,
        vertical_slug: str = REALTOR_VERTICAL_SLUG,
    ) -> dict[str, Any]:
        """Persist a generated artifact."""
        return await professional_artifacts_service.save_artifact(
            self.db,
            user_id=user_id,
            source_type=source_type,
            title=title,
            content=content,
            source_id=source_id,
            recipe_key=recipe_key,
            artifact_data=artifact_data,
            unified_content_id=unified_content_id,
            ugs_request_id=ugs_request_id,
            module_key=module_key,
            artifact_kind=artifact_kind,
            parent_artifact_id=parent_artifact_id,
            source_media_id=source_media_id,
            export_metadata=export_metadata,
            vertical_slug=vertical_slug,
        )

    async def delete_artifact(self, user_id: UUID, artifact_id: UUID) -> bool:
        """Delete generated artifact for current user."""
        return await professional_artifacts_service.delete_artifact(self.db, user_id, artifact_id)

    async def list_artifacts_filtered(
        self,
        user_id: UUID,
        *,
        vertical_slug: str = REALTOR_VERTICAL_SLUG,
        source_id: UUID | None = None,
        module_key: str | None = None,
        artifact_kind: str | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """List current-user artifacts with optional runtime filters."""
        return await professional_artifacts_service.list_artifacts_filtered(
            self.db,
            user_id,
            vertical_slug=vertical_slug,
            source_id=source_id,
            module_key=module_key,
            artifact_kind=artifact_kind,
            limit=limit,
        )

    async def get_ai_action(self, vertical_slug: str, action_key: str) -> dict[str, Any] | None:
        """Resolve an active AI action for runtime use."""
        return await runtime_lookup_service.get_ai_action(self.db, vertical_slug, action_key)

    def render_ai_action_prompt(self, template: str, variables: Mapping[str, Any]) -> str:
        """Render a small safe prompt template with JSON variables."""
        return runtime_lookup_service.render_ai_action_prompt(template, variables)

    def build_object_intake_prompt(self, source_text: str) -> str:
        """Build structured object extraction prompt."""
        return build_object_intake_prompt(source_text)

    def parse_object_intake_result(
        self,
        text_out: str,
        source_text: str,
        *,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        """Parse AI JSON result and normalize into preview shape."""
        return parse_object_intake_result(
            text_out,
            source_text,
            idempotency_key=idempotency_key,
        )

    async def save_object_intake_preview(
        self,
        *,
        user_id: UUID,
        payload: ObjectIntakeParseRequest,
        preview: dict[str, Any],
        ugs_request_id: UUID | None = None,
    ) -> dict[str, Any]:
        """Persist object intake preview job without saving a property."""
        return await object_intake_jobs_service.save_object_intake_preview(
            self.db,
            user_id=user_id,
            payload=payload,
            preview=preview,
            ugs_request_id=ugs_request_id,
        )

    async def commit_object_intake(self, user_id: UUID, payload: ObjectIntakeCommitRequest) -> dict[str, Any] | None:
        """Commit accepted intake fields into a new or existing property."""
        return await object_intake_jobs_service.commit_object_intake(
            self.db,
            user_id,
            payload,
            validate_against_active_schema=self.validate_against_active_schema,
        )

    async def get_photo_preset(self, vertical_slug: str, preset_key: str) -> dict[str, Any] | None:
        """Resolve active photo preset."""
        return await runtime_lookup_service.get_photo_preset(self.db, vertical_slug, preset_key)

    async def create_media_enhancement_job(
        self,
        *,
        user_id: UUID,
        property_id: UUID,
        payload: MediaEnhancementRequest,
        status: str = "queued",
        batch_job_id: UUID | None = None,
    ) -> dict[str, Any] | None:
        """Persist media enhancement job after property ownership check."""
        return await media_enhancement_service.create_media_enhancement_job(
            self.db,
            user_id=user_id,
            property_id=property_id,
            payload=payload,
            status=status,
            batch_job_id=batch_job_id,
        )

    async def complete_media_enhancement_job(
        self,
        *,
        user_id: UUID,
        job_id: UUID,
        output_content_id: UUID | None,
        provider_result: dict[str, Any],
        ugs_request_id: UUID | None = None,
        status: str = "completed",
    ) -> dict[str, Any] | None:
        """Complete or fail a media enhancement job."""
        return await media_enhancement_service.complete_media_enhancement_job(
            self.db,
            user_id=user_id,
            job_id=job_id,
            output_content_id=output_content_id,
            provider_result=provider_result,
            ugs_request_id=ugs_request_id,
            status=status,
        )

    async def list_media_enhancement_jobs(self, user_id: UUID, property_id: UUID) -> list[dict[str, Any]] | None:
        """List media enhancement jobs for a property."""
        return await media_enhancement_service.list_media_enhancement_jobs(self.db, user_id, property_id)

    async def set_media_enhancement_decision(
        self, user_id: UUID, job_id: UUID, accepted: bool
    ) -> dict[str, Any] | None:
        """Accept or reject an enhanced media candidate."""
        return await media_enhancement_service.set_media_enhancement_decision(self.db, user_id, job_id, accepted)

    async def find_reusable_enhancement_duplicate(
        self,
        user_id: UUID,
        property_id: UUID,
        source_content_id: UUID,
        preset_key: str,
    ) -> dict[str, Any] | None:
        """Return latest successful enhancement sharing source + preset (for idempotent skips)."""
        return await media_enhancement_service.find_reusable_enhancement_duplicate(
            self.db,
            user_id,
            property_id,
            source_content_id,
            preset_key,
        )

    async def get_brand_visual_kit(
        self, user_id: UUID, vertical_slug: str = REALTOR_VERTICAL_SLUG
    ) -> dict[str, Any] | None:
        return await brand_kit_service.get_brand_visual_kit(self.db, user_id, vertical_slug=vertical_slug)

    async def upsert_brand_visual_kit(
        self, user_id: UUID, kit: dict[str, Any], vertical_slug: str = REALTOR_VERTICAL_SLUG
    ) -> dict[str, Any]:
        return await brand_kit_service.upsert_brand_visual_kit(self.db, user_id, kit, vertical_slug=vertical_slug)

    async def list_professional_media_albums(self, user_id: UUID) -> list[dict[str, Any]]:
        return await professional_media_albums_service.list_professional_media_albums(self.db, user_id)

    async def create_professional_media_album(
        self, user_id: UUID, payload: ProfessionalMediaAlbumCreate
    ) -> dict[str, Any]:
        return await professional_media_albums_service.create_professional_media_album(self.db, user_id, payload)

    async def patch_professional_media_album(
        self, user_id: UUID, album_id: UUID, payload: ProfessionalMediaAlbumPatch
    ) -> dict[str, Any] | None:
        return await professional_media_albums_service.patch_professional_media_album(
            self.db, user_id, album_id, payload
        )

    async def delete_professional_media_album(self, user_id: UUID, album_id: UUID) -> bool:
        """Delete a professional worlds media album owned by the user."""
        return await professional_media_albums_service.delete_professional_media_album(self.db, user_id, album_id)

    async def get_media_batch_job(self, user_id: UUID, property_id: UUID, batch_id: UUID) -> dict[str, Any] | None:
        """Return batch envelope with items & enhancement_jobs for Realtor media cockpit."""
        return await media_batch_service.get_media_batch_job(self.db, user_id, property_id, batch_id)

    async def create_media_batch_job(
        self,
        *,
        user_id: UUID,
        property_id: UUID,
        preset_key: str,
        instruction: str | None,
        source_content_ids: list[UUID],
        idempotency_key: str | None,
        batch_meta: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        """Create (or replay) Realtor media enhancement batch keyed by optional idempotency."""
        return await media_batch_service.create_media_batch_job(
            self.db,
            user_id=user_id,
            property_id=property_id,
            preset_key=preset_key,
            instruction=instruction,
            source_content_ids=source_content_ids,
            idempotency_key=idempotency_key,
            batch_meta=batch_meta,
        )

    async def set_media_batch_job_status(self, user_id: UUID, batch_id: UUID, *, status_label: str) -> bool:
        return await media_batch_service.set_media_batch_job_status(
            self.db, user_id, batch_id, status_label=status_label
        )

    async def set_media_batch_line_status(
        self,
        user_id: UUID,
        *,
        batch_item_id: UUID,
        line_status: str,
        error: str | None = None,
    ) -> dict[str, Any] | None:
        return await media_batch_service.set_media_batch_line_status(
            self.db,
            user_id,
            batch_item_id=batch_item_id,
            line_status=line_status,
            error=error,
        )

    async def set_media_batch_item_review_decision(
        self,
        user_id: UUID,
        *,
        property_id: UUID,
        batch_id: UUID,
        item_id: UUID,
        decision: str,
    ) -> tuple[dict[str, Any], dict[str, Any] | None] | None:
        """Persist before/after review on a batch line; returns (`item`,`job`)."""
        return await media_batch_service.set_media_batch_item_review_decision(
            self.db,
            user_id,
            property_id=property_id,
            batch_id=batch_id,
            item_id=item_id,
            decision=decision,
        )

    async def reconcile_batch_line_from_job(
        self,
        user_id: UUID,
        *,
        batch_item_id: UUID,
        job_snapshot: Mapping[str, Any],
    ) -> None:
        """Mirror enhancement job outcome into realtor_media_batch_items."""
        await media_batch_service.reconcile_batch_line_from_job(
            self.db,
            user_id,
            batch_item_id=batch_item_id,
            job_snapshot=job_snapshot,
        )

    def build_realtor_prompt(
        self, property_row: Mapping[str, Any], body: RealtorGenerationBody, *, content_pack: bool
    ) -> tuple[str, str]:
        """Build UGS input prompt for realtor object copy."""
        return realtor_generation_prompts.build_realtor_prompt(property_row, body, content_pack=content_pack)

    def build_coach_prompt(self, body: CoachSimulationBody) -> tuple[str, str]:
        """Build role-play coach prompt."""
        return realtor_generation_prompts.build_coach_prompt(body)

    def build_ugs_input(self, prompt: str) -> dict[str, Any]:
        """Create UGS input payload for text generation."""
        return realtor_generation_prompts.build_ugs_input(prompt)
