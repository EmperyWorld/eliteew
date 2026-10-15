# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Resolve UGS text models from DB-backed model routes instead of per-type model fields or env-first fallbacks.
# Invariants:
# - DB settings/provider config are the canonical runtime source; env is only an emergency fallback source.
# - `generation_types.model_name` is legacy metadata and must not be the primary model selector.
# Related:
# - api/services/ugs/provider_manager_service_v2.py
# - api/services/ugs/admin_v2_service.py
# ---

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import select  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.unified_config import unified_settings
from api.models.database_models import UGSSetting
from api.schemas.ugs_admin import (
    UgsAdminV2ConfigSourceAuditItem,
    UgsAdminV2ModelInventoryItem,
    UgsAdminV2ModelRoutes,
    UgsAdminV2ResolvedModel,
)
from api.services.ugs.text_llm_constants import TEXT_LLM_PROVIDER_TYPES

MODEL_ROUTES_SETTING_KEY = "model_routes"


@dataclass(frozen=True)
class ResolvedUgsModel:
    model: str | None
    source: str
    warnings: list[str] = field(default_factory=list)


def infer_ugs_domain(type_key: str, category: str | None = None) -> str | None:
    key = (type_key or "").strip()
    if key.startswith("imc_") or key.startswith("marketing_"):
        return "imc"
    if key.startswith("professional_worlds_"):
        return "professional_worlds"
    if key.startswith("music_generator_"):
        return "music"
    if key.startswith("image_studio_"):
        return "image_studio"
    if key.startswith("video_studio_image_prompt"):
        return "image_studio"
    if key.startswith("video_studio_"):
        return "video_studio"
    if category:
        normalized = category.strip()
        return normalized or None
    return None


def _normalized_model(value: Any) -> str | None:
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return None


def _serializable_model_routes(routes: UgsAdminV2ModelRoutes) -> dict[str, Any]:
    payload = routes.model_dump(mode="json")
    for key in ("provider_defaults", "category_defaults", "domain_defaults", "type_overrides"):
        values = payload.get(key) or {}
        if isinstance(values, dict):
            payload[key] = {
                str(route_key): model
                for route_key, raw_model in values.items()
                if (model := _normalized_model(raw_model))
            }
    payload["global_default_model"] = _normalized_model(payload.get("global_default_model"))
    payload["request_model_override_allowlist"] = [
        item for raw in payload.get("request_model_override_allowlist", []) if (item := _normalized_model(raw))
    ]
    return payload


class UGSModelRoutingService:
    """DB-backed model routing service for UGS runtime and Admin v2."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_model_routes(self) -> UgsAdminV2ModelRoutes:
        result = await self.db.execute(select(UGSSetting).where(UGSSetting.key == MODEL_ROUTES_SETTING_KEY))
        setting = result.scalar_one_or_none()
        value = setting.value if setting is not None else {}
        if not isinstance(value, dict):
            value = {}
        return UgsAdminV2ModelRoutes.model_validate(value)

    async def save_model_routes(self, routes: UgsAdminV2ModelRoutes) -> None:
        result = await self.db.execute(select(UGSSetting).where(UGSSetting.key == MODEL_ROUTES_SETTING_KEY))
        setting = result.scalar_one_or_none()
        value = _serializable_model_routes(routes)
        if setting is None:
            self.db.add(
                UGSSetting(
                    scope="global",
                    key=MODEL_ROUTES_SETTING_KEY,
                    value=value,
                    description="UGS DB-backed model routing defaults and overrides.",
                )
            )
            return
        setting.value = value  # type: ignore[assignment]
        setting.description = setting.description or "UGS DB-backed model routing defaults and overrides."  # type: ignore[assignment]

    def build_inventory(self, providers: list[dict[str, Any]]) -> list[UgsAdminV2ModelInventoryItem]:
        inventory: list[UgsAdminV2ModelInventoryItem] = []
        seen: set[tuple[str, str]] = set()
        for provider in providers:
            provider_name = str(provider.get("provider_name") or "")
            config = provider.get("config_json") if isinstance(provider.get("config_json"), dict) else {}
            models = config.get("models") if isinstance(config, dict) else []
            default_model = _normalized_model(config.get("default_model") if isinstance(config, dict) else None)
            raw_items = models if isinstance(models, list) else []
            if default_model:
                raw_items = [default_model, *raw_items]
            for item in raw_items:
                model_id = _normalized_model(item)
                if isinstance(item, dict):
                    model_id = _normalized_model(item.get("model_id") or item.get("id") or item.get("name"))
                if not model_id:
                    continue
                key = (provider_name, model_id)
                if key in seen:
                    continue
                seen.add(key)
                capabilities = item.get("capabilities", []) if isinstance(item, dict) else []
                inventory.append(
                    UgsAdminV2ModelInventoryItem(
                        provider_name=provider_name,
                        model_id=model_id,
                        label=str(item.get("label")) if isinstance(item, dict) and item.get("label") else None,
                        enabled=bool(item.get("enabled", True)) if isinstance(item, dict) else True,
                        capabilities=[str(x) for x in capabilities] if isinstance(capabilities, list) else [],
                    )
                )
        return inventory

    async def resolve_for_type(
        self,
        *,
        type_key: str,
        provider_name: str,
        provider_type: str | None = None,
        category: str | None,
        provider_config: dict[str, Any] | None,
        request_model: str | None = None,
        allow_request_override: bool = False,
    ) -> ResolvedUgsModel:
        normalized_provider_type = (provider_type or "").strip().lower()
        # Model routing applies only to text-LLM providers (llama/llama) and text-stack aliases (miso rows).
        if normalized_provider_type and normalized_provider_type not in {*TEXT_LLM_PROVIDER_TYPES, "miso"}:
            return ResolvedUgsModel(model=None, source="not_applicable", warnings=[])

        routes = await self.get_model_routes()
        domain = infer_ugs_domain(type_key, category)
        warnings: list[str] = []

        request_model = _normalized_model(request_model)
        if request_model and (allow_request_override or type_key in routes.request_model_override_allowlist):
            return ResolvedUgsModel(model=request_model, source="request.input_data.model", warnings=warnings)
        if request_model:
            warnings.append("input_data.model ignored; configure model routing in DB.")

        chain: list[tuple[str, str | None]] = [
            (f"type_overrides.{type_key}", routes.type_overrides.get(type_key)),
            (f"domain_defaults.{domain}", routes.domain_defaults.get(domain or "")),
            (f"category_defaults.{category}", routes.category_defaults.get(category or "")),
            (f"provider_defaults.{provider_name}", routes.provider_defaults.get(provider_name)),
            (
                "generation_providers.config_json.default_model",
                _normalized_model(provider_config.get("default_model") if isinstance(provider_config, dict) else None),
            ),
            ("model_routes.global_default_model", routes.global_default_model),
        ]
        for source, value in chain:
            model = _normalized_model(value)
            if model:
                return ResolvedUgsModel(model=model, source=source, warnings=warnings)

        fallback = _normalized_model(unified_settings.default_ai_model)
        if fallback:
            warnings.append("Using env fallback; configure model_routes/provider default in DB.")
            return ResolvedUgsModel(model=fallback, source="env.LLAMA_MODEL", warnings=warnings)

        warnings.append("No model resolved.")
        return ResolvedUgsModel(model=None, source="unresolved", warnings=warnings)

    async def resolve_all_types(
        self,
        types: list[dict[str, Any]],
        providers_by_name: dict[str, dict[str, Any]],
    ) -> list[UgsAdminV2ResolvedModel]:
        resolved: list[UgsAdminV2ResolvedModel] = []
        for item in types:
            type_key = str(item.get("type_key") or "")
            provider_name = str(item.get("provider") or "")
            category = str(item.get("category") or "") or None
            provider = providers_by_name.get(provider_name) or {}
            provider_type = str(provider.get("provider_type") or "") or None
            provider_config = provider.get("config_json") if isinstance(provider.get("config_json"), dict) else {}
            result = await self.resolve_for_type(
                type_key=type_key,
                provider_name=provider_name,
                provider_type=provider_type,
                category=category,
                provider_config=provider_config,
            )
            resolved.append(
                UgsAdminV2ResolvedModel(
                    type_key=type_key,
                    provider=provider_name,
                    category=category,
                    domain=infer_ugs_domain(type_key, category),
                    resolved_model=result.model,
                    source=result.source,
                    warnings=result.warnings,
                )
            )
        return resolved

    def config_source_audit(self) -> list[UgsAdminV2ConfigSourceAuditItem]:
        return [
            UgsAdminV2ConfigSourceAuditItem(
                key="env.LLAMA_MODEL",
                source_type="env",
                message="Env fallback still exists for emergency startup.",
                recommendation="Set model_routes/global or provider defaults in DB so runtime does not reach env fallback.",
            ),
            UgsAdminV2ConfigSourceAuditItem(
                key="provider_manager_service_v2.get_runtime_provider_seed",
                source_type="hardcode",
                message="Runtime provider seeds are Python bootstrap defaults.",
                recommendation="Use them only to create missing DB rows; edit live provider config in UGS Admin v2.",
            ),
            UgsAdminV2ConfigSourceAuditItem(
                key="comfyui.workflow/*.json",
                source_type="file",
                message="ComfyUI workflow JSON files are import templates.",
                recommendation="Materialize active workflows into comfyui_workflows and manage enabled state in DB.",
            ),
        ]
