# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Build the UGS Admin v2 snapshot: DB rows, routing inventory, validation, and autofix hints.
# Invariants:
# - Snapshot issues combine entity validation and model-route validation on the same state view.
# Related:
# - api/routers/ugs_admin.py
# - api/services/ugs/admin_v2_service.py (facade)
# ---

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.models.database_models import ComfyUIWorkflow, GenerationProvider, GenerationType, UGSSetting
from api.schemas.ugs_admin import (
    AdminGenerationTypeResponse,
    ComfyUIWorkflowResponse,
    GenerationProviderResponse,
    UgsAdminV2SnapshotResponse,
    UGSSettingListResponse,
    UGSSettingResponse,
)
from api.services.ugs.admin_v2_autofix import build_autofix_recommendations
from api.services.ugs.admin_v2_state import _index_by, _State
from api.services.ugs.admin_v2_validation import validate_model_routes, validate_state
from api.services.ugs.model_routing_service import UGSModelRoutingService


async def build_snapshot(db: AsyncSession) -> UgsAdminV2SnapshotResponse:
    providers_res = await db.execute(select(GenerationProvider).order_by(GenerationProvider.provider_name))
    types_res = await db.execute(select(GenerationType).order_by(GenerationType.category, GenerationType.type_key))
    workflows_res = await db.execute(select(ComfyUIWorkflow).order_by(ComfyUIWorkflow.name))
    settings_res = await db.execute(select(UGSSetting).order_by(UGSSetting.updated_at.desc()))

    providers = [GenerationProviderResponse.model_validate(p.to_dict()) for p in providers_res.scalars().all()]
    types = [AdminGenerationTypeResponse.model_validate(t.to_dict()) for t in types_res.scalars().all()]
    workflows = [ComfyUIWorkflowResponse.model_validate(w.to_dict()) for w in workflows_res.scalars().all()]
    settings_items = [UGSSettingResponse.model_validate(s.to_dict()) for s in settings_res.scalars().all()]
    settings = UGSSettingListResponse(items=settings_items, total=len(settings_items))

    routing_service = UGSModelRoutingService(db)
    model_routes = await routing_service.get_model_routes()
    providers_dicts = [p.model_dump(mode="json") for p in providers]
    types_dicts = [t.model_dump(mode="json") for t in types]
    state = _State(
        providers=providers_dicts,
        types=types_dicts,
        workflows=[w.model_dump(mode="json") for w in workflows],
        model_routes=model_routes,
    )
    issues = validate_state(state)
    providers_by_name = _index_by(providers_dicts, "provider_name")
    model_inventory = routing_service.build_inventory(providers_dicts)
    resolved_models = await routing_service.resolve_all_types(types_dicts, providers_by_name)
    issues.extend(
        validate_model_routes(
            state=state,
            model_inventory=model_inventory,
            resolved_models=resolved_models,
        )
    )
    config_source_audit = routing_service.config_source_audit()
    autofix_recommendations = build_autofix_recommendations(
        providers=providers,
        types=types,
        workflows=workflows,
        model_routes=model_routes,
        model_inventory=model_inventory,
        resolved_models=resolved_models,
    )

    return UgsAdminV2SnapshotResponse(
        providers=providers,
        types=types,
        workflows=workflows,
        settings=settings,
        model_routes=model_routes,
        model_inventory=model_inventory,
        resolved_models_by_type=resolved_models,
        config_source_audit=config_source_audit,
        autofix_recommendations=autofix_recommendations,
        issues=issues,
        generated_at=datetime.now(UTC),
    )
