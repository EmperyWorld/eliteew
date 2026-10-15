# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# In-memory dry-run application of UGS Admin v2 bulk operations on state snapshots.
# Invariants:
# - Dry-run never touches DB; apply layer must run validate_operations first.
# Related:
# - api/services/ugs/admin_v2_state.py
# - api/services/ugs/admin_v2_validate_ops.py
# ---

from __future__ import annotations

from collections.abc import Sequence

from api.schemas.ugs_admin import (
    UgsAdminV2BulkOperation,
    UgsAdminV2ModelRoutesPatchOperation,
    UgsAdminV2ModelRoutesReplaceOperation,
    UgsAdminV2ProviderCreateOperation,
    UgsAdminV2ProviderDefaultModelSetOperation,
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
    UgsAdminV2WorkflowPatchOperation,
    UgsAdminV2WorkflowSetActiveOperation,
)
from api.services.ugs.admin_v2_state import (
    _apply_provider_patch,
    _apply_setting_patch,
    _apply_type_patch,
    _apply_workflow_patch,
    _index_by,
    _merge_model_routes,
    _normalize_patch_payload,
    _setting_natural_key,
    _State,
)


def apply_ops_dry_run(state: _State, operations: Sequence[UgsAdminV2BulkOperation]) -> _State:
    providers = [dict(x) for x in state.providers]
    types = [dict(x) for x in state.types]
    workflows = [dict(x) for x in state.workflows]
    settings = [dict(x) for x in (state.settings or [])]

    providers_by_name = _index_by(providers, "provider_name")
    types_by_key = _index_by(types, "type_key")
    workflows_by_slug = _index_by(workflows, "slug")
    settings_by_id = _index_by(settings, "id")

    for op in operations:
        if isinstance(op, UgsAdminV2ProviderCreateOperation):
            provider = op.provider.model_dump(mode="json")
            name = str(provider.get("provider_name") or "").strip()
            if name and name not in providers_by_name:
                providers.append(provider)
                providers_by_name[name] = provider
        elif isinstance(op, UgsAdminV2ProviderPatchOperation):
            patch = _normalize_patch_payload(op.patch)
            for name in op.provider_names:
                row = providers_by_name.get(name)
                if row:
                    _apply_provider_patch(row, patch)
        elif isinstance(op, UgsAdminV2ProviderSetEnabledOperation):
            for name in op.provider_names:
                row = providers_by_name.get(name)
                if row:
                    row["enabled"] = op.enabled
        elif isinstance(op, UgsAdminV2ProviderDefaultModelSetOperation):
            for name in op.provider_names:
                row = providers_by_name.get(name)
                if row:
                    config = row.get("config_json") if isinstance(row.get("config_json"), dict) else {}
                    row["config_json"] = {**config, "default_model": op.default_model.strip()}
        elif isinstance(op, UgsAdminV2TypeCreateOperation):
            generation_type = op.generation_type.model_dump(mode="json")
            key = str(generation_type.get("type_key") or "").strip()
            if key and key not in types_by_key:
                types.append(generation_type)
                types_by_key[key] = generation_type
        elif isinstance(op, UgsAdminV2TypePatchOperation):
            patch = _normalize_patch_payload(op.patch)
            for key in op.type_keys:
                row = types_by_key.get(key)
                if row:
                    _apply_type_patch(row, patch)
        elif isinstance(op, UgsAdminV2TypeSetActiveOperation):
            for key in op.type_keys:
                row = types_by_key.get(key)
                if row:
                    row["is_active"] = op.is_active
        elif isinstance(op, UgsAdminV2TypeClearModelNamesOperation):
            for key in op.type_keys:
                row = types_by_key.get(key)
                if row:
                    row["model_name"] = ""
        elif isinstance(op, UgsAdminV2WorkflowCreateOperation):
            workflow = op.workflow.model_dump(mode="json")
            slug = str(workflow.get("slug") or "").strip()
            if slug and slug not in workflows_by_slug:
                workflows.append(workflow)
                workflows_by_slug[slug] = workflow
        elif isinstance(op, UgsAdminV2WorkflowPatchOperation):
            patch = _normalize_patch_payload(op.patch)
            for slug in op.slugs:
                row = workflows_by_slug.get(slug)
                if row:
                    _apply_workflow_patch(row, patch)
        elif isinstance(op, UgsAdminV2WorkflowSetActiveOperation):
            for slug in op.slugs:
                row = workflows_by_slug.get(slug)
                if row:
                    row["is_active"] = op.is_active
        elif isinstance(op, UgsAdminV2SettingCreateOperation):
            setting = op.setting.model_dump(mode="json")
            natural_key = _setting_natural_key(setting)
            if not any(_setting_natural_key(item) == natural_key for item in settings):
                settings.append(setting)
                settings_by_id[str(setting.get("id") or natural_key[1])] = setting
        elif isinstance(op, UgsAdminV2SettingPatchOperation):
            patch = _normalize_patch_payload(op.patch)
            for setting_id in op.setting_ids:
                row = settings_by_id.get(setting_id)
                if row:
                    _apply_setting_patch(row, patch)
        elif isinstance(op, UgsAdminV2SettingDeleteOperation):
            delete_ids = {str(setting_id) for setting_id in op.setting_ids}
            settings = [item for item in settings if str(item.get("id") or "") not in delete_ids]
            settings_by_id = _index_by(settings, "id")

    model_routes = state.model_routes
    for op in operations:
        if isinstance(op, UgsAdminV2ModelRoutesPatchOperation):
            model_routes = _merge_model_routes(model_routes, op.routes)
        elif isinstance(op, UgsAdminV2ModelRoutesReplaceOperation):
            model_routes = op.routes

    return _State(
        providers=providers,
        types=types,
        workflows=workflows,
        model_routes=model_routes,
        settings=settings,
    )
