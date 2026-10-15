# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Validate proposed UGS Admin v2 bulk operations against current and projected state.
# Invariants:
# - validate_operations shares validate_state/validate_model_routes with dry-run apply path.
# Related:
# - api/routers/ugs_admin.py
# - api/services/ugs/admin_v2_service.py (facade)
# ---

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.schemas.ugs_admin import (
    UgsAdminV2BulkOperation,
    UgsAdminV2ProviderCreateOperation,
    UgsAdminV2ProviderDefaultModelSetOperation,
    UgsAdminV2ProviderModelsRefreshOperation,
    UgsAdminV2ProviderPatchOperation,
    UgsAdminV2SettingCreateOperation,
    UgsAdminV2TypeCreateOperation,
    UgsAdminV2ValidationIssue,
    UgsAdminV2WorkflowCreateOperation,
)
from api.services.ugs.admin_v2_dry_run import apply_ops_dry_run
from api.services.ugs.admin_v2_snapshot import build_snapshot
from api.services.ugs.admin_v2_state import (
    _index_by,
    _issue,
    _model_fields_present,
    _normalize_patch_payload,
    _provider_config,
    _provider_supports_text_model_fields,
    _provider_type,
    _setting_natural_key,
    _State,
)
from api.services.ugs.admin_v2_validation import validate_model_routes, validate_state
from api.services.ugs.model_routing_service import UGSModelRoutingService


async def validate_operations(
    db: AsyncSession, operations: Sequence[UgsAdminV2BulkOperation]
) -> list[UgsAdminV2ValidationIssue]:
    snapshot = await build_snapshot(db)
    state = _State(
        providers=[p.model_dump(mode="json") for p in snapshot.providers],
        types=[t.model_dump(mode="json") for t in snapshot.types],
        workflows=[w.model_dump(mode="json") for w in snapshot.workflows],
        model_routes=snapshot.model_routes,
        settings=[s.model_dump(mode="json") for s in snapshot.settings.items],
    )
    next_state = apply_ops_dry_run(state, operations)
    issues = validate_state(next_state)

    providers_by_name = _index_by(next_state.providers, "provider_name")
    types_by_key_before = _index_by(state.types, "type_key")
    workflows_by_slug_before = _index_by(state.workflows, "slug")
    for op in operations:
        if isinstance(op, UgsAdminV2TypeCreateOperation):
            key = str(op.generation_type.type_key or "").strip()
            if not key:
                issues.append(
                    _issue(
                        severity="error",
                        entity_type="type",
                        entity_id="?",
                        message="type_key обязателен для type.create.",
                        field="type_key",
                    )
                )
            elif key in types_by_key_before:
                issues.append(
                    _issue(
                        severity="error",
                        entity_type="type",
                        entity_id=key,
                        message="Тип с таким type_key уже существует.",
                        field="type_key",
                    )
                )
            continue
        if isinstance(op, UgsAdminV2WorkflowCreateOperation):
            slug = str(op.workflow.slug or "").strip()
            if not slug:
                issues.append(
                    _issue(
                        severity="error",
                        entity_type="workflow",
                        entity_id="?",
                        message="slug обязателен для workflow.create.",
                        field="slug",
                    )
                )
            elif slug in workflows_by_slug_before:
                issues.append(
                    _issue(
                        severity="error",
                        entity_type="workflow",
                        entity_id=slug,
                        message="Воркфлоу с таким slug уже существует.",
                        field="slug",
                    )
                )
            continue
        if isinstance(op, UgsAdminV2SettingCreateOperation):
            setting = op.setting.model_dump(mode="json")
            natural_key = _setting_natural_key(setting)
            if not str(setting.get("key") or "").strip():
                issues.append(
                    _issue(
                        severity="error",
                        entity_type="settings",
                        entity_id="?",
                        message="key обязателен для settings.create.",
                        field="key",
                    )
                )
            elif any(_setting_natural_key(item) == natural_key for item in state.settings or []):
                issues.append(
                    _issue(
                        severity="error",
                        entity_type="settings",
                        entity_id=str(setting.get("key") or "?"),
                        message="Такая настройка уже существует. Используйте settings.patch.",
                        field="key",
                    )
                )
            continue
        if isinstance(op, UgsAdminV2ProviderCreateOperation):
            provider = op.provider.model_dump(mode="json")
            config = _provider_config(provider)
            if not _provider_supports_text_model_fields(provider) and (
                _model_fields_present(config) or str(config.get("provider_role") or "").strip().lower() == "text"
            ):
                issues.append(
                    _issue(
                        severity="error",
                        entity_type="provider",
                        entity_id=str(provider.get("provider_name") or "?"),
                        message="Нельзя создать non-text провайдера с default_model/models/provider_role=text.",
                        field="config_json",
                    )
                )
            continue
        if isinstance(op, UgsAdminV2ProviderPatchOperation):
            patch = _normalize_patch_payload(op.patch)
            if "config_json" not in patch:
                continue
            for name in op.provider_names:
                provider = providers_by_name.get(name) or {}
                config = _provider_config(provider)
                if not _provider_supports_text_model_fields(provider) and (
                    _model_fields_present(config) or str(config.get("provider_role") or "").strip().lower() == "text"
                ):
                    issues.append(
                        _issue(
                            severity="error",
                            entity_type="provider",
                            entity_id=name,
                            message="Нельзя записать default_model/models/provider_role=text в non-text провайдера.",
                            field="config_json",
                        )
                    )
            continue
        if not isinstance(
            op,
            (UgsAdminV2ProviderDefaultModelSetOperation, UgsAdminV2ProviderModelsRefreshOperation),
        ):
            continue
        for name in op.provider_names:
            provider = providers_by_name.get(name) or {}
            ptype = _provider_type(provider)
            if not _provider_supports_text_model_fields(provider):
                issues.append(
                    _issue(
                        severity="error",
                        entity_type="provider",
                        entity_id=name,
                        message=(
                            f"Операция `{op.kind}` разрешена только для provider_type "
                            f"`llama`, `llama` или `miso` (сейчас type=`{ptype}`)."
                        ),
                        field="provider_type",
                    )
                )
    if next_state.model_routes:
        issues.extend(
            validate_model_routes(
                state=next_state,
                model_inventory=UGSModelRoutingService(db).build_inventory(next_state.providers),
            )
        )
    return issues
