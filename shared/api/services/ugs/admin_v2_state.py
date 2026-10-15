# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared UGS Admin v2 state containers, patch helpers, and provider/model-route utilities.
# Invariants:
# - State dataclasses are plain dict snapshots; DB rows are materialized only in apply layer.
# Related:
# - api/services/ugs/admin_v2_service.py (facade)
# ---
# pyright: reportAttributeAccessIssue=false, reportUnusedFunction=false, reportUnusedClass=false, reportUnusedImport=false
# Shared helpers are imported by sibling admin_v2_* modules / facade.

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Any

from api.core.unified_config import unified_settings
from api.schemas.ugs_admin import (
    UgsAdminV2BulkApplyOperationResult,
    UgsAdminV2ModelRoutes,
    UgsAdminV2ValidationIssue,
)
from api.services.ugs.text_llm_constants import TEXT_LLM_PROVIDER_TYPES

TEXT_MODEL_ROUTE_PROVIDER_TYPES = {*TEXT_LLM_PROVIDER_TYPES, "miso"}


@dataclass(frozen=True)
class _State:
    providers: list[dict[str, Any]]
    types: list[dict[str, Any]]
    workflows: list[dict[str, Any]]
    model_routes: UgsAdminV2ModelRoutes | None = None
    settings: list[dict[str, Any]] | None = None


@dataclass
class ApplyOperationsResult:
    applied: int = 0
    skipped: int = 0
    failed: int = 0
    operation_results: list[UgsAdminV2BulkApplyOperationResult] = field(default_factory=list)

    def add(
        self,
        *,
        kind: str,
        entity_type: str,
        entity_id: str,
        status: str,
        message: str,
    ) -> None:
        if status == "applied":
            self.applied += 1
        elif status == "skipped":
            self.skipped += 1
        else:
            self.failed += 1
        self.operation_results.append(
            UgsAdminV2BulkApplyOperationResult(
                kind=kind,  # type: ignore[arg-type]
                entity_type=entity_type,  # type: ignore[arg-type]
                entity_id=entity_id,
                status=status,  # type: ignore[arg-type]
                message=message,
            )
        )


def _issue(
    *,
    severity: str,
    entity_type: str,
    entity_id: str,
    message: str,
    field: str | None = None,
) -> UgsAdminV2ValidationIssue:
    return UgsAdminV2ValidationIssue(
        severity=severity, entity_type=entity_type, entity_id=entity_id, message=message, field=field
    )


def _index_by(items: Iterable[dict[str, Any]], key: str) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for it in items:
        v = it.get(key)
        if v is None:
            continue
        out[str(v)] = it
    return out


def _provider_config(row: dict[str, Any]) -> dict[str, Any]:
    config = row.get("config_json")
    return config if isinstance(config, dict) else {}


def _provider_type(row: dict[str, Any]) -> str:
    return str(row.get("provider_type") or "").strip().lower()


def _provider_supports_text_model_fields(row: dict[str, Any]) -> bool:
    return _provider_type(row) in TEXT_MODEL_ROUTE_PROVIDER_TYPES


def _configured_embedding_models() -> set[str]:
    out: set[str] = set()
    for raw in (
        getattr(unified_settings, "embedding_ai_model", None),
        getattr(unified_settings, "ai_embeddings_fallback_model", None),
    ):
        if isinstance(raw, str) and raw.strip():
            out.add(raw.strip().casefold())
    return out


def _looks_like_embedding_model(model_id: str | None) -> bool:
    model = str(model_id or "").strip()
    if not model:
        return False
    folded = model.casefold()
    return folded in _configured_embedding_models() or "embedding" in folded or "embed" in folded


def _normalized_url(raw: Any) -> str:
    return str(raw or "").strip().rstrip("/")


def _is_embedding_service_url(raw: Any) -> bool:
    url = _normalized_url(raw)
    if not url:
        return False
    embedding_url = _normalized_url(getattr(unified_settings, "llama_embedding_url", None))
    if not embedding_url:
        return False
    text_url = _normalized_url(getattr(unified_settings, "llama_url", None))
    return url == embedding_url and url != text_url


def _model_fields_present(config: dict[str, Any]) -> list[str]:
    present: list[str] = []
    default_model = config.get("default_model")
    if isinstance(default_model, str) and default_model.strip():
        present.append("default_model")
    models = config.get("models")
    if isinstance(models, list) and models:
        present.append("models")
    return present


def _clean_non_text_provider_config(config: dict[str, Any], *, provider_type: str) -> dict[str, Any]:
    cleaned = dict(config)
    if provider_type not in TEXT_MODEL_ROUTE_PROVIDER_TYPES:
        cleaned.pop("default_model", None)
        cleaned.pop("models", None)
        if str(cleaned.get("provider_role") or "").strip().lower() == "text":
            cleaned.pop("provider_role", None)
    return cleaned


def _apply_provider_patch(row: dict[str, Any], patch: dict[str, Any]) -> None:
    for k, v in patch.items():
        if v is None:
            continue
        row[k] = v


def _apply_type_patch(row: dict[str, Any], patch: dict[str, Any]) -> None:
    for k, v in patch.items():
        if v is None:
            continue
        if k == "metadata":
            row["metadata"] = v
            continue
        row[k] = v


def _apply_workflow_patch(row: dict[str, Any], patch: dict[str, Any]) -> None:
    for k, v in patch.items():
        if v is None:
            continue
        if k == "metadata":
            row["metadata"] = v
            continue
        row[k] = v


def _setting_natural_key(row: dict[str, Any]) -> tuple[str, str, str | None, str | None, str | None]:
    return (
        str(row.get("scope") or "global"),
        str(row.get("key") or ""),
        str(row.get("company_id")) if row.get("company_id") else None,
        str(row.get("project_id")) if row.get("project_id") else None,
        str(row.get("user_id")) if row.get("user_id") else None,
    )


def _apply_setting_patch(row: dict[str, Any], patch: dict[str, Any]) -> None:
    for k, v in patch.items():
        if v is None:
            continue
        row[k] = v


def _normalize_patch_payload(payload: Any) -> dict[str, Any]:
    if payload is None:
        return {}
    if hasattr(payload, "model_dump"):
        return payload.model_dump(exclude_unset=True, mode="json")  # type: ignore[no-any-return]
    if isinstance(payload, dict):
        return dict(payload)
    return {}


def _merge_model_routes(
    current: UgsAdminV2ModelRoutes | None,
    patch: UgsAdminV2ModelRoutes,
) -> UgsAdminV2ModelRoutes:
    base = (current or UgsAdminV2ModelRoutes()).model_dump(mode="json")
    incoming = patch.model_dump(mode="json")
    for key, value in incoming.items():
        if isinstance(value, dict):
            next_map = dict(base.get(key) or {})
            for raw_key, raw_value in value.items():
                route_key = str(raw_key).strip()
                if not route_key:
                    continue
                if raw_value is None or not str(raw_value).strip():
                    next_map.pop(route_key, None)
                    continue
                next_map[route_key] = str(raw_value).strip()
            base[key] = next_map
        elif isinstance(value, list):
            base[key] = [str(x) for x in value if str(x).strip()]
        elif value is not None:
            normalized = str(value).strip() if isinstance(value, str) else value
            base[key] = normalized or None
    return UgsAdminV2ModelRoutes.model_validate(base)


def _model_routes_patch_result_entries(routes: UgsAdminV2ModelRoutes) -> list[tuple[str, str]]:
    payload = routes.model_dump(mode="json")
    entries: list[tuple[str, str]] = []
    global_model = payload.get("global_default_model")
    if isinstance(global_model, str) and global_model.strip():
        entries.append(("global_default_model", "set"))
    for scope_name in ("provider_defaults", "category_defaults", "domain_defaults", "type_overrides"):
        values = payload.get(scope_name) or {}
        if not isinstance(values, dict):
            continue
        for route_key, model in values.items():
            action = "deleted" if model is None or not str(model).strip() else "set"
            entries.append((f"{scope_name}.{route_key}", action))
    return entries
