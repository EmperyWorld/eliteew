# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Autofix recommendation builder for UGS Admin v2 snapshot inconsistencies.
# Invariants:
# - Recommendations emit bulk-operation payloads only; they never mutate DB directly.
# Related:
# - api/services/ugs/admin_v2_state.py
# - api/services/ugs/admin_v2_service.py (facade)
# ---

from __future__ import annotations

from typing import Any

from api.schemas.ugs_admin import (
    AdminGenerationTypeResponse,
    ComfyUIWorkflowResponse,
    GenerationProviderResponse,
    UgsAdminV2AutofixRecommendation,
    UgsAdminV2ModelInventoryItem,
    UgsAdminV2ModelRoutes,
    UgsAdminV2ResolvedModel,
)
from api.services.ugs.admin_v2_state import (
    _clean_non_text_provider_config,
    _provider_supports_text_model_fields,
)


def _choose_shared_text_model(
    *,
    model_routes: UgsAdminV2ModelRoutes,
    model_inventory: list[UgsAdminV2ModelInventoryItem],
    resolved_models: list[UgsAdminV2ResolvedModel],
) -> str | None:
    if model_routes.global_default_model:
        return model_routes.global_default_model
    for item in resolved_models:
        if item.resolved_model and not item.source.startswith("env."):
            return item.resolved_model
    for item in model_inventory:
        if item.enabled and item.model_id:
            return item.model_id
    for item in resolved_models:
        if item.resolved_model:
            return item.resolved_model
    return None


def build_autofix_recommendations(
    *,
    providers: list[GenerationProviderResponse],
    types: list[AdminGenerationTypeResponse],
    workflows: list[ComfyUIWorkflowResponse],
    model_routes: UgsAdminV2ModelRoutes,
    model_inventory: list[UgsAdminV2ModelInventoryItem],
    resolved_models: list[UgsAdminV2ResolvedModel],
) -> list[UgsAdminV2AutofixRecommendation]:
    recommendations: list[UgsAdminV2AutofixRecommendation] = []
    shared_model = _choose_shared_text_model(
        model_routes=model_routes,
        model_inventory=model_inventory,
        resolved_models=resolved_models,
    )

    legacy_types = [t for t in types if str(t.model_name or "").strip()]
    if legacy_types:
        routes = model_routes.model_dump(mode="json")
        type_overrides = dict(routes.get("type_overrides") or {})
        for item in legacy_types:
            if item.model_name:
                type_overrides[item.type_key] = item.model_name
        routes["type_overrides"] = type_overrides
        recommendations.append(
            UgsAdminV2AutofixRecommendation(
                id="migrate-legacy-type-models",
                title="Перенести legacy model_name из типов",
                description=(
                    "Скопировать заполненные generation_types.model_name в model_routes.type_overrides "
                    "и очистить legacy-поле у типов."
                ),
                severity="warning",
                operations=[
                    {"kind": "model_routes.patch", "routes": routes},
                    {"kind": "type.clear_model_names", "type_keys": [t.type_key for t in legacy_types]},
                ],
                affected_count=len(legacy_types),
            )
        )

    non_text_model_field_ops: list[dict[str, Any]] = []
    for provider in providers:
        provider_type = str(provider.provider_type or "").strip().lower()
        config = provider.config_json if isinstance(provider.config_json, dict) else {}
        provider_row = {
            "provider_name": provider.provider_name,
            "provider_type": provider_type,
            "config_json": config,
        }
        if _provider_supports_text_model_fields(provider_row):
            continue
        cleaned = _clean_non_text_provider_config(config, provider_type=provider_type)
        if cleaned == config:
            continue
        non_text_model_field_ops.append(
            {
                "kind": "provider.patch",
                "provider_names": [provider.provider_name],
                "patch": {"config_json": cleaned},
            }
        )
    if non_text_model_field_ops:
        recommendations.append(
            UgsAdminV2AutofixRecommendation(
                id="clean-non-text-provider-model-fields",
                title="Очистить model fields у non-text провайдеров",
                description=(
                    "Удалить legacy `default_model` / `models` и ошибочный `provider_role=text` "
                    "из config_json ComfyUI, Faster Whisper, Silero и других non-text провайдеров."
                ),
                severity="warning",
                operations=non_text_model_field_ops,
                affected_count=len(non_text_model_field_ops),
            )
        )

    if shared_model and (
        model_routes.global_default_model != shared_model
        or model_routes.type_overrides
        or any(
            item.source.startswith("env.") or item.resolved_model != shared_model
            for item in resolved_models
            if item.provider in {"llama"}
        )
    ):
        routes = model_routes.model_dump(mode="json")
        routes["global_default_model"] = shared_model
        routes["category_defaults"] = {**routes.get("category_defaults", {}), "text": shared_model}
        routes["domain_defaults"] = {
            **routes.get("domain_defaults", {}),
            "imc": shared_model,
            "professional_worlds": shared_model,
            "music": shared_model,
            "image_studio": shared_model,
        }
        routes["type_overrides"] = {}
        operations: list[dict[str, Any]] = [{"kind": "model_routes.replace", "routes": routes}]
        if legacy_types:
            operations.append({"kind": "type.clear_model_names", "type_keys": [t.type_key for t in legacy_types]})
        recommendations.append(
            UgsAdminV2AutofixRecommendation(
                id="unify-text-model-routes",
                title="Унифицировать текстовую модель",
                description=(
                    "Назначить одну DB-backed модель для text/imc/professional_worlds/music/image_studio "
                    "и очистить type-specific overrides, чтобы все текстовые генерации шли одинаково."
                ),
                severity="warning",
                operations=operations,
                affected_count=len(resolved_models),
            )
        )

    providers_missing_inventory = [
        p.provider_name
        for p in providers
        if isinstance(p.config_json, dict)
        and p.config_json.get("default_model")
        and not p.config_json.get("models")
        and _provider_supports_text_model_fields(
            {
                "provider_name": p.provider_name,
                "provider_type": str(p.provider_type or ""),
                "config_json": p.config_json,
            }
        )
    ]
    if providers_missing_inventory:
        recommendations.append(
            UgsAdminV2AutofixRecommendation(
                id="refresh-provider-model-inventory",
                title="Обновить inventory моделей провайдеров",
                description="Просканировать OpenAI/Llama-compatible провайдеры и сохранить config_json.models в БД.",
                severity="info",
                operations=[{"kind": "provider.models.refresh", "provider_names": sorted(providers_missing_inventory)}],
                affected_count=len(providers_missing_inventory),
            )
        )

    if not workflows:
        recommendations.append(
            UgsAdminV2AutofixRecommendation(
                id="materialize-workflows",
                title="Материализовать workflow-шаблоны в БД",
                description="Импортировать ComfyUI JSON templates как DB rows, не перетирая существующие записи.",
                severity="info",
                operations=[{"kind": "workflow.import_from_disk", "overwrite_existing": False}],
                affected_count=0,
            )
        )

    return recommendations
