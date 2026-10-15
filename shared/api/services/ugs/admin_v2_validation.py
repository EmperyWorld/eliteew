# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Cross-entity validation for UGS Admin v2 state snapshots and model routes.
# Invariants:
# - Validation output is shared by dry-run, validate_operations, and build_snapshot.
# Related:
# - api/services/ugs/admin_v2_state.py
# - api/services/ugs/admin_v2_service.py (facade)
# ---

from __future__ import annotations

from api.schemas.ugs_admin import (
    UgsAdminV2ModelInventoryItem,
    UgsAdminV2ResolvedModel,
    UgsAdminV2ValidationIssue,
)
from api.services.ugs.admin_v2_state import (
    _index_by,
    _is_embedding_service_url,
    _issue,
    _looks_like_embedding_model,
    _model_fields_present,
    _provider_config,
    _provider_supports_text_model_fields,
    _provider_type,
    _State,
)
from api.services.ugs.model_routing_service import infer_ugs_domain


def validate_state(state: _State) -> list[UgsAdminV2ValidationIssue]:
    issues: list[UgsAdminV2ValidationIssue] = []

    providers_by_name = _index_by(state.providers, "provider_name")

    for p in state.providers:
        name = str(p.get("provider_name") or "")
        config = _provider_config(p)
        models_raw = config.get("models") if isinstance(config, dict) else None
        default_model = config.get("default_model") if isinstance(config, dict) else None
        ptype = _provider_type(p)
        role = str(config.get("provider_role") or "").strip().lower()
        supports_text_model_fields = _provider_supports_text_model_fields(p)
        if not supports_text_model_fields:
            present_model_fields = _model_fields_present(config)
            if present_model_fields:
                issues.append(
                    _issue(
                        severity="warning",
                        entity_type="provider",
                        entity_id=name or "?",
                        message=(
                            "В config_json остались legacy default_model/models у non-text провайдера. "
                            "Используйте autofix очистки или удалите эти ключи вручную."
                        ),
                        field="config_json",
                    )
                )
            if role == "text":
                issues.append(
                    _issue(
                        severity="warning",
                        entity_type="provider",
                        entity_id=name or "?",
                        message=(
                            f"config_json.provider_role=text не соответствует provider_type=`{ptype or '?'}`; "
                            "очистите роль или выберите text-LLM provider_type."
                        ),
                        field="config_json.provider_role",
                    )
                )
        if (
            supports_text_model_fields
            and isinstance(models_raw, list)
            and isinstance(default_model, str)
            and default_model.strip()
        ):
            models = [str(x).strip() for x in models_raw if isinstance(x, str) and str(x).strip()]
            if models and default_model.strip() not in models:
                issues.append(
                    _issue(
                        severity="warning",
                        entity_type="provider",
                        entity_id=name or "?",
                        message="config_json.default_model не входит в config_json.models — UI может показать расхождение.",
                        field="config_json",
                    )
                )
        if supports_text_model_fields:
            configured_models: list[str] = []
            if isinstance(default_model, str) and default_model.strip():
                configured_models.append(default_model.strip())
            if isinstance(models_raw, list):
                configured_models.extend(
                    str(item).strip() for item in models_raw if isinstance(item, str) and str(item).strip()
                )
            bad_models = sorted({item for item in configured_models if _looks_like_embedding_model(item)})
            if bad_models:
                issues.append(
                    _issue(
                        severity="error",
                        entity_type="provider",
                        entity_id=name or "?",
                        message=(
                            "Embedding model нельзя использовать как text-generation model "
                            f"для UGS provider: {', '.join(bad_models)}."
                        ),
                        field="config_json.models",
                    )
                )
        base_url = p.get("base_url")
        if (
            isinstance(base_url, str)
            and base_url.strip()
            and not (base_url.startswith("http://") or base_url.startswith("https://"))
        ):
            issues.append(
                _issue(
                    severity="error",
                    entity_type="provider",
                    entity_id=name or "?",
                    message="base_url должен начинаться с http:// или https://",
                    field="base_url",
                )
            )
        if supports_text_model_fields and _is_embedding_service_url(base_url):
            issues.append(
                _issue(
                    severity="error",
                    entity_type="provider",
                    entity_id=name or "?",
                    message=(
                        "base_url text provider указывает на LLAMA_EMBEDDING_URL; "
                        "для генерации нужен chat/text LLM URL."
                    ),
                    field="base_url",
                )
            )

        fallback_for = p.get("fallback_for") or []
        if isinstance(fallback_for, list):
            for target in fallback_for:
                if str(target) not in providers_by_name:
                    issues.append(
                        _issue(
                            severity="warning",
                            entity_type="provider",
                            entity_id=name or "?",
                            message=f"fallback_for ссылается на неизвестный провайдер: {target}",
                            field="fallback_for",
                        )
                    )

    for t in state.types:
        key = str(t.get("type_key") or "")
        provider_name = str(t.get("provider") or "")
        legacy_model_name = str(t.get("model_name") or "").strip()
        if legacy_model_name:
            issues.append(
                _issue(
                    severity="warning",
                    entity_type="type",
                    entity_id=key or "?",
                    message="generation_types.model_name заполнен: мигрируйте модель в model_routes/provider default.",
                    field="model_name",
                )
            )
        provider = providers_by_name.get(provider_name)
        if not provider:
            issues.append(
                _issue(
                    severity="error",
                    entity_type="type",
                    entity_id=key or "?",
                    message=f"Тип ссылается на отсутствующий провайдер: {provider_name}",
                    field="provider",
                )
            )
            continue
        if bool(t.get("is_active", False)) and not bool(provider.get("enabled", True)):
            issues.append(
                _issue(
                    severity="warning",
                    entity_type="type",
                    entity_id=key or "?",
                    message=f"Тип активен, но провайдер выключен: {provider_name}",
                    field="provider",
                )
            )

    seen_slugs: set[str] = set()
    for w in state.workflows:
        slug = str(w.get("slug") or "")
        if not slug.strip():
            issues.append(
                _issue(
                    severity="error",
                    entity_type="workflow",
                    entity_id=str(w.get("id") or "?"),
                    message="slug обязателен",
                    field="slug",
                )
            )
            continue
        if slug in seen_slugs:
            issues.append(
                _issue(
                    severity="error",
                    entity_type="workflow",
                    entity_id=slug,
                    message="slug должен быть уникальным",
                    field="slug",
                )
            )
        seen_slugs.add(slug)
        json_body = w.get("json_body")
        if json_body is None or not isinstance(json_body, dict) or not json_body:
            issues.append(
                _issue(
                    severity="warning",
                    entity_type="workflow",
                    entity_id=slug,
                    message="workflow.json_body пустой или не объект",
                    field="json_body",
                )
            )

    return issues


def validate_model_routes(
    *,
    state: _State,
    model_inventory: list[UgsAdminV2ModelInventoryItem],
    resolved_models: list[UgsAdminV2ResolvedModel] | None = None,
) -> list[UgsAdminV2ValidationIssue]:
    routes = state.model_routes
    if routes is None:
        return []

    issues: list[UgsAdminV2ValidationIssue] = []
    route_payload = routes.model_dump(mode="json")
    known_models = {item.model_id for item in model_inventory if item.enabled and item.model_id}
    known_providers = {str(p.get("provider_name") or "") for p in state.providers}
    known_types = {str(t.get("type_key") or "") for t in state.types}
    known_categories = {str(t.get("category") or "") for t in state.types}
    known_domains = {
        domain
        for t in state.types
        if (domain := infer_ugs_domain(str(t.get("type_key") or ""), str(t.get("category") or "") or None))
    }

    global_default_model = routes.global_default_model
    if global_default_model and known_models and global_default_model not in known_models:
        issues.append(
            _issue(
                severity="warning",
                entity_type="model_route",
                entity_id="global_default_model",
                message=f"Модель `{global_default_model}` отсутствует в enabled inventory провайдеров.",
                field="global_default_model",
            )
        )

    scope_refs: dict[str, set[str]] = {
        "provider_defaults": known_providers,
        "category_defaults": known_categories,
        "domain_defaults": known_domains,
        "type_overrides": known_types,
    }
    for scope_name, known_keys in scope_refs.items():
        values = route_payload.get(scope_name) or {}
        if not isinstance(values, dict):
            continue
        for route_key, model in values.items():
            route_key_str = str(route_key)
            model_id = str(model).strip() if model is not None else ""
            if route_key_str not in known_keys:
                issues.append(
                    _issue(
                        severity="warning",
                        entity_type="model_route",
                        entity_id=route_key_str,
                        message=f"`{scope_name}` ссылается на неизвестный ключ `{route_key_str}`.",
                        field=scope_name,
                    )
                )
            if model_id and known_models and model_id not in known_models:
                issues.append(
                    _issue(
                        severity="warning",
                        entity_type="model_route",
                        entity_id=route_key_str,
                        message=f"Модель `{model_id}` отсутствует в enabled inventory провайдеров.",
                        field=scope_name,
                    )
                )
            if model_id and _looks_like_embedding_model(model_id):
                issues.append(
                    _issue(
                        severity="error",
                        entity_type="model_route",
                        entity_id=route_key_str,
                        message=(
                            "Embedding model нельзя назначать в UGS model_routes: "
                            f"`{model_id}`. Embedding используется отдельным retrieval-контуром."
                        ),
                        field=scope_name,
                    )
                )

    for type_key in routes.request_model_override_allowlist:
        if type_key not in known_types:
            issues.append(
                _issue(
                    severity="warning",
                    entity_type="model_route",
                    entity_id=type_key,
                    message="request_model_override_allowlist содержит неизвестный type_key.",
                    field="request_model_override_allowlist",
                )
            )

    for item in resolved_models or []:
        if item.source.startswith("env."):
            issues.append(
                _issue(
                    severity="warning",
                    entity_type="model_route",
                    entity_id=item.type_key,
                    message="Runtime дошёл до env fallback; задайте DB-backed model route или provider default.",
                    field=item.source,
                )
            )
        for warning in item.warnings:
            issues.append(
                _issue(
                    severity="warning",
                    entity_type="model_route",
                    entity_id=item.type_key,
                    message=warning,
                    field=item.source,
                )
            )
    return issues
