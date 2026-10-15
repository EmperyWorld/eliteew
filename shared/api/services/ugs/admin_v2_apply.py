# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Persist UGS Admin v2 bulk operations to DB after upstream validation.
# Invariants:
# - Apply never bypasses validate_operations; callers must validate before commit.
# - Bulk operations must not log secrets or large JSON payloads.
# Related:
# - api/routers/ugs_admin.py
# - api/services/ugs/admin_v2_service.py (facade)
# ---

from __future__ import annotations

from collections.abc import Sequence
from urllib.parse import urljoin
from uuid import UUID

import aiohttp
from sqlalchemy import select  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.models.database_models import ComfyUIWorkflow, GenerationProvider, GenerationType, UGSSetting
from api.schemas.ugs_admin import (
    UgsAdminV2BulkOperation,
    UgsAdminV2ModelRoutesPatchOperation,
    UgsAdminV2ModelRoutesReplaceOperation,
    UgsAdminV2ProviderCreateOperation,
    UgsAdminV2ProviderDefaultModelSetOperation,
    UgsAdminV2ProviderModelsRefreshOperation,
    UgsAdminV2ProviderPatchOperation,
    UgsAdminV2ProviderSetEnabledOperation,
    UgsAdminV2SettingCreateOperation,
    UgsAdminV2SettingDeleteOperation,
    UgsAdminV2SettingPatchOperation,
    UgsAdminV2TypeClearModelNamesOperation,
    UgsAdminV2TypeCreateOperation,
    UgsAdminV2TypePatchOperation,
    UgsAdminV2TypeSetActiveOperation,
    UgsAdminV2WorkflowCreateOperation,
    UgsAdminV2WorkflowImportFromDiskOperation,
    UgsAdminV2WorkflowPatchOperation,
    UgsAdminV2WorkflowSetActiveOperation,
)
from api.services.ugs.admin_v2_state import (
    ApplyOperationsResult,
    _merge_model_routes,
    _model_routes_patch_result_entries,
    _normalize_patch_payload,
    _provider_supports_text_model_fields,
)
from api.services.ugs.comfyui_workflow_catalog import import_comfyui_workflows_from_disk
from api.services.ugs.model_routing_service import UGSModelRoutingService


async def _fetch_provider_models(base_url: str) -> list[str]:
    base = base_url.rstrip("/") + "/"
    endpoints = ("api/tags", "v1/models")
    timeout = aiohttp.ClientTimeout(total=15)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        for endpoint in endpoints:
            try:
                async with session.get(urljoin(base, endpoint)) as response:
                    if response.status >= 400:
                        continue
                    payload = await response.json()
            except (aiohttp.ClientError, TimeoutError, ValueError):  # fmt: skip
                continue
            if isinstance(payload, dict) and isinstance(payload.get("models"), list):
                models: list[str] = []
                for item in payload["models"]:
                    if isinstance(item, str):
                        models.append(item)
                    elif isinstance(item, dict):
                        name = item.get("name") or item.get("id")
                        if isinstance(name, str) and name.strip():
                            models.append(name.strip())
                if models:
                    return sorted(set(models))
            if isinstance(payload, dict) and isinstance(payload.get("data"), list):
                models = [
                    item["id"].strip()
                    for item in payload["data"]
                    if isinstance(item, dict) and isinstance(item.get("id"), str) and item["id"].strip()
                ]
                if models:
                    return sorted(set(models))
    return []


async def apply_operations(
    db: AsyncSession,
    operations: Sequence[UgsAdminV2BulkOperation],
) -> ApplyOperationsResult:
    """
    Apply operations to DB.

    Returns:
        Detailed per-entity apply result with aggregate counts.
    """
    result = ApplyOperationsResult()

    for op in operations:
        if isinstance(op, UgsAdminV2ProviderCreateOperation):
            provider = op.provider
            name = provider.provider_name.strip()
            res = await db.execute(select(GenerationProvider).where(GenerationProvider.provider_name == name))
            exists = res.scalar_one_or_none()
            if exists is not None:
                result.add(
                    kind=op.kind,
                    entity_type="provider",
                    entity_id=name,
                    status="failed",
                    message="Provider with this name already exists.",
                )
                continue
            row = GenerationProvider(
                provider_name=name,
                provider_type=provider.provider_type.strip(),
                base_url=(provider.base_url.strip() if provider.base_url else None),
                api_key_required=bool(provider.api_key_required),
                health_endpoint=(provider.health_endpoint.strip() if provider.health_endpoint else None),
                timeout_seconds=int(provider.timeout_seconds),
                max_concurrent=int(provider.max_concurrent),
                enabled=bool(provider.enabled),
                cost_per_request=float(provider.cost_per_request),
                fallback_priority=int(provider.fallback_priority),
                fallback_for=list(provider.fallback_for or []),
                config_json=provider.config_json or {},
                display_label=provider.display_label.strip() if provider.display_label else None,
            )
            db.add(row)
            result.add(
                kind=op.kind,
                entity_type="provider",
                entity_id=name,
                status="applied",
                message="Provider created.",
            )
            continue
        if not isinstance(op, (UgsAdminV2ProviderPatchOperation, UgsAdminV2ProviderSetEnabledOperation)):
            continue
        for name in op.provider_names:
            res = await db.execute(select(GenerationProvider).where(GenerationProvider.provider_name == name))
            row = res.scalar_one_or_none()
            if row is None:
                result.add(
                    kind=op.kind,
                    entity_type="provider",
                    entity_id=name,
                    status="skipped",
                    message="Provider not found.",
                )
                continue
            try:
                if isinstance(op, UgsAdminV2ProviderSetEnabledOperation):
                    row.enabled = op.enabled  # type: ignore[assignment]
                else:
                    patch = _normalize_patch_payload(op.patch)
                    for k, v in patch.items():
                        if v is None:
                            continue
                        setattr(row, k, v)
                result.add(
                    kind=op.kind,
                    entity_type="provider",
                    entity_id=name,
                    status="applied",
                    message="Provider updated.",
                )
            except Exception as exc:
                result.add(
                    kind=op.kind,
                    entity_type="provider",
                    entity_id=name,
                    status="failed",
                    message=f"Provider update failed: {exc}",
                )

    for op in operations:
        if isinstance(op, UgsAdminV2TypeCreateOperation):
            payload = op.generation_type
            key = payload.type_key.strip()
            res = await db.execute(select(GenerationType).where(GenerationType.type_key == key))
            if res.scalar_one_or_none() is not None:
                result.add(
                    kind=op.kind,
                    entity_type="type",
                    entity_id=key,
                    status="failed",
                    message="Generation type with this type_key already exists.",
                )
                continue
            model_name = (payload.model_name or "").strip()
            row = GenerationType(
                type_key=key,
                category=payload.category.strip(),
                display_name=payload.display_name.strip(),
                description=payload.description,
                provider=payload.provider.strip(),
                model_name=model_name,
                parameters=payload.parameters or {},
                complexity=payload.complexity or "medium",
                estimated_time=int(payload.estimated_time),
                max_retries=int(payload.max_retries),
                priority=int(payload.priority),
                cost_credits=float(payload.cost_credits),
                is_active=bool(payload.is_active),
                type_metadata=payload.metadata or {},
            )
            db.add(row)
            result.add(
                kind=op.kind,
                entity_type="type",
                entity_id=key,
                status="applied",
                message="Generation type created.",
            )
            continue
        if not isinstance(
            op,
            (
                UgsAdminV2TypePatchOperation,
                UgsAdminV2TypeSetActiveOperation,
                UgsAdminV2TypeClearModelNamesOperation,
            ),
        ):
            continue
        for key in op.type_keys:
            res = await db.execute(select(GenerationType).where(GenerationType.type_key == key))
            row = res.scalar_one_or_none()
            if row is None:
                result.add(
                    kind=op.kind,
                    entity_type="type",
                    entity_id=key,
                    status="skipped",
                    message="Generation type not found.",
                )
                continue
            try:
                if isinstance(op, UgsAdminV2TypeSetActiveOperation):
                    row.is_active = op.is_active  # type: ignore[assignment]
                elif isinstance(op, UgsAdminV2TypeClearModelNamesOperation):
                    row.model_name = ""  # type: ignore[assignment]
                else:
                    patch = _normalize_patch_payload(op.patch)
                    if "metadata" in patch:
                        patch["type_metadata"] = patch.pop("metadata")
                    for k, v in patch.items():
                        if v is None:
                            continue
                        setattr(row, k, v)
                result.add(
                    kind=op.kind,
                    entity_type="type",
                    entity_id=key,
                    status="applied",
                    message="Generation type updated.",
                )
            except Exception as exc:
                result.add(
                    kind=op.kind,
                    entity_type="type",
                    entity_id=key,
                    status="failed",
                    message=f"Generation type update failed: {exc}",
                )

    for op in operations:
        if isinstance(op, UgsAdminV2WorkflowCreateOperation):
            payload = op.workflow
            slug = payload.slug.strip()
            res = await db.execute(select(ComfyUIWorkflow).where(ComfyUIWorkflow.slug == slug))
            if res.scalar_one_or_none() is not None:
                result.add(
                    kind=op.kind,
                    entity_type="workflow",
                    entity_id=slug,
                    status="failed",
                    message="Workflow with this slug already exists.",
                )
                continue
            row = ComfyUIWorkflow(
                name=payload.name.strip(),
                slug=slug,
                category=payload.category,
                description=payload.description,
                json_body=payload.json_body or {},
                model_dependencies=list(payload.model_dependencies or []),
                meta_data=payload.metadata or {},
                estimated_time=payload.estimated_time,
                version=int(payload.version),
                is_active=bool(payload.is_active),
            )
            db.add(row)
            result.add(
                kind=op.kind,
                entity_type="workflow",
                entity_id=slug,
                status="applied",
                message="Workflow created.",
            )
            continue
        if not isinstance(op, (UgsAdminV2WorkflowPatchOperation, UgsAdminV2WorkflowSetActiveOperation)):
            continue
        for slug in op.slugs:
            res = await db.execute(select(ComfyUIWorkflow).where(ComfyUIWorkflow.slug == slug))
            row = res.scalar_one_or_none()
            if row is None:
                result.add(
                    kind=op.kind,
                    entity_type="workflow",
                    entity_id=slug,
                    status="skipped",
                    message="Workflow not found.",
                )
                continue
            try:
                if isinstance(op, UgsAdminV2WorkflowSetActiveOperation):
                    row.is_active = op.is_active  # type: ignore[assignment]
                else:
                    patch = _normalize_patch_payload(op.patch)
                    metadata = patch.pop("metadata", None)
                    for k, v in patch.items():
                        if v is None:
                            continue
                        setattr(row, k, v)
                    if metadata is not None:
                        row.meta_data = metadata  # type: ignore[assignment]
                result.add(
                    kind=op.kind,
                    entity_type="workflow",
                    entity_id=slug,
                    status="applied",
                    message="Workflow updated.",
                )
            except Exception as exc:
                result.add(
                    kind=op.kind,
                    entity_type="workflow",
                    entity_id=slug,
                    status="failed",
                    message=f"Workflow update failed: {exc}",
                )

    routing_service = UGSModelRoutingService(db)
    for op in operations:
        if isinstance(op, UgsAdminV2ModelRoutesPatchOperation):
            current = await routing_service.get_model_routes()
            await routing_service.save_model_routes(_merge_model_routes(current, op.routes))
            route_entries = _model_routes_patch_result_entries(op.routes)
            if not route_entries:
                route_entries = [("model_routes", "patched")]
            for entity_id, action in route_entries:
                result.add(
                    kind=op.kind,
                    entity_type="model_route",
                    entity_id=entity_id,
                    status="applied",
                    message=f"Model route {action}.",
                )
        elif isinstance(op, UgsAdminV2ModelRoutesReplaceOperation):
            await routing_service.save_model_routes(op.routes)
            result.add(
                kind=op.kind,
                entity_type="model_route",
                entity_id="model_routes",
                status="applied",
                message="Model routes replaced.",
            )
        elif isinstance(op, UgsAdminV2ProviderModelsRefreshOperation):
            for name in op.provider_names:
                res = await db.execute(select(GenerationProvider).where(GenerationProvider.provider_name == name))
                row = res.scalar_one_or_none()
                if row is None or not row.base_url:
                    result.add(
                        kind=op.kind,
                        entity_type="provider",
                        entity_id=name,
                        status="skipped",
                        message="Provider not found or base_url is empty.",
                    )
                    continue
                provider_row = {
                    "provider_name": name,
                    "provider_type": str(row.provider_type or ""),
                    "config_json": row.config_json if isinstance(row.config_json, dict) else {},
                }
                if not _provider_supports_text_model_fields(provider_row):
                    result.add(
                        kind=op.kind,
                        entity_type="provider",
                        entity_id=name,
                        status="failed",
                        message="Model inventory refresh is allowed only for llama/llama/miso providers.",
                    )
                    continue
                models = await _fetch_provider_models(str(row.base_url))
                if not models:
                    result.add(
                        kind=op.kind,
                        entity_type="provider",
                        entity_id=name,
                        status="skipped",
                        message="Provider returned no models.",
                    )
                    continue
                config = row.config_json if isinstance(row.config_json, dict) else {}
                row.config_json = {**config, "models": models}  # type: ignore[assignment]
                result.add(
                    kind=op.kind,
                    entity_type="provider",
                    entity_id=name,
                    status="applied",
                    message=f"Model inventory refreshed: {len(models)} models.",
                )
        elif isinstance(op, UgsAdminV2ProviderDefaultModelSetOperation):
            for name in op.provider_names:
                res = await db.execute(select(GenerationProvider).where(GenerationProvider.provider_name == name))
                row = res.scalar_one_or_none()
                if row is None:
                    result.add(
                        kind=op.kind,
                        entity_type="provider",
                        entity_id=name,
                        status="skipped",
                        message="Provider not found.",
                    )
                    continue
                provider_row = {
                    "provider_name": name,
                    "provider_type": str(row.provider_type or ""),
                    "config_json": row.config_json if isinstance(row.config_json, dict) else {},
                }
                if not _provider_supports_text_model_fields(provider_row):
                    result.add(
                        kind=op.kind,
                        entity_type="provider",
                        entity_id=name,
                        status="failed",
                        message="Default model is allowed only for llama/llama/miso providers.",
                    )
                    continue
                config = row.config_json if isinstance(row.config_json, dict) else {}
                config = {**config, "default_model": op.default_model.strip()}
                row.config_json = config  # type: ignore[assignment]
                result.add(
                    kind=op.kind,
                    entity_type="provider",
                    entity_id=name,
                    status="applied",
                    message="Provider default_model updated.",
                )
        elif isinstance(op, UgsAdminV2WorkflowImportFromDiskOperation):
            import_result = await import_comfyui_workflows_from_disk(
                db,
                overwrite_existing=op.overwrite_existing,
            )
            imported = int(import_result.get("imported", 0) or 0)
            updated = int(import_result.get("updated", 0) or 0)
            skipped_count = int(import_result.get("skipped", 0) or 0)
            errors = [str(x) for x in (import_result.get("errors", []) or [])]
            for idx in range(imported + updated):
                result.add(
                    kind=op.kind,
                    entity_type="workflow",
                    entity_id=f"disk:{idx + 1}",
                    status="applied",
                    message="Workflow materialized from disk.",
                )
            for idx in range(skipped_count):
                result.add(
                    kind=op.kind,
                    entity_type="workflow",
                    entity_id=f"disk:skipped:{idx + 1}",
                    status="skipped",
                    message="Workflow import skipped existing row.",
                )
            for idx, error in enumerate(errors, start=1):
                result.add(
                    kind=op.kind,
                    entity_type="workflow",
                    entity_id=f"disk:error:{idx}",
                    status="failed",
                    message=error,
                )

    for op in operations:
        if isinstance(op, UgsAdminV2SettingCreateOperation):
            data = op.setting.model_dump(mode="json")
            key = str(data.get("key") or "").strip()
            entity_id = key or "?"
            stmt = select(UGSSetting).where(
                UGSSetting.scope == data["scope"],
                UGSSetting.key == data["key"],
                UGSSetting.company_id == data.get("company_id"),
                UGSSetting.project_id == data.get("project_id"),
                UGSSetting.user_id == data.get("user_id"),
            )
            existing = await db.execute(stmt)
            if existing.scalar_one_or_none() is not None:
                result.add(
                    kind=op.kind,
                    entity_type="settings",
                    entity_id=entity_id,
                    status="failed",
                    message="Такая настройка уже существует. Используйте settings.patch.",
                )
                continue
            row = UGSSetting(**data)
            db.add(row)
            result.add(
                kind=op.kind,
                entity_type="settings",
                entity_id=entity_id,
                status="applied",
                message="Setting created.",
            )
            continue
        if not isinstance(op, (UgsAdminV2SettingPatchOperation, UgsAdminV2SettingDeleteOperation)):
            continue
        for raw_id in op.setting_ids:
            entity_id = str(raw_id)
            try:
                setting_id = UUID(entity_id)
            except ValueError:
                result.add(
                    kind=op.kind,
                    entity_type="settings",
                    entity_id=entity_id,
                    status="failed",
                    message="Invalid setting id.",
                )
                continue
            res = await db.execute(select(UGSSetting).where(UGSSetting.id == setting_id))
            row = res.scalar_one_or_none()
            if row is None:
                result.add(
                    kind=op.kind,
                    entity_type="settings",
                    entity_id=entity_id,
                    status="skipped",
                    message="Setting not found.",
                )
                continue
            entity_id = f"{row.scope}:{row.key}"
            try:
                if isinstance(op, UgsAdminV2SettingDeleteOperation):
                    await db.delete(row)
                    result.add(
                        kind=op.kind,
                        entity_type="settings",
                        entity_id=entity_id,
                        status="applied",
                        message="Setting deleted.",
                    )
                else:
                    update_data = op.patch.model_dump(exclude_unset=True, mode="json")
                    for field, value in update_data.items():
                        setattr(row, field, value)
                    result.add(
                        kind=op.kind,
                        entity_type="settings",
                        entity_id=entity_id,
                        status="applied",
                        message="Setting updated.",
                    )
            except Exception as exc:
                result.add(
                    kind=op.kind,
                    entity_type="settings",
                    entity_id=entity_id,
                    status="failed",
                    message=f"Setting update failed: {exc}",
                )

    return result
