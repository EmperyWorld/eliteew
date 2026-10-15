# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# pyright: reportAttributeAccessIssue=false, reportUnusedFunction=false, reportUnusedImport=false
# Shared helpers are imported by provider_manager facade / sibling mixins.
# Purpose:
# ProviderConfig model, DB row normalizers, and provider exception types.
# Invariants:
# - ComfyUI health_endpoint defaults to /system_stats when empty.
# Related:
# - api/services/ugs/provider_manager_service_v2.py
# ---

from typing import Any

from api.services.ugs.provider_runtime_seeds import get_runtime_provider_seed


class ProviderConfig:
    """Configuration for a single provider"""

    def __init__(self, data: dict[str, Any]):
        self.provider_name = data["provider_name"]
        self.provider_type = data["provider_type"]
        self.base_url = data["base_url"]
        self.api_key_required = data.get("api_key_required", False)
        self.health_endpoint = data["health_endpoint"]
        self.timeout_seconds = data["timeout_seconds"]
        self.max_concurrent = data["max_concurrent"]
        self.enabled = data["enabled"]
        self.config_json = data.get("config_json", {})
        self.fallback_for = data.get("fallback_for", [])
        self.cost_per_request = data.get("cost_per_request", 0.0)


def _normalize_provider_health_endpoint(
    provider_name: str | None,
    provider_type: str | None,
    health_endpoint: str | None,
) -> str:
    """Repair legacy or incomplete health endpoints from DB/admin payloads."""
    normalized_provider_name = (provider_name or "").strip().lower()
    normalized_provider_type = (provider_type or "").strip().lower()
    normalized_endpoint = (health_endpoint or "").strip()

    runtime_seed = get_runtime_provider_seed(normalized_provider_name) if normalized_provider_name else None
    default_endpoint = (
        str(runtime_seed.get("health_endpoint")) if runtime_seed and runtime_seed.get("health_endpoint") else "/health"
    )

    if normalized_provider_name == "comfyui" or normalized_provider_type == "comfyui":
        return "/system_stats" if normalized_endpoint in {"", "/"} else normalized_endpoint

    return normalized_endpoint or default_endpoint


def _normalize_provider_row(row: dict[str, Any]) -> dict[str, Any]:
    """Normalize provider config loaded from DB before runtime usage."""
    normalized = dict(row)
    base_url = normalized.get("base_url")
    if isinstance(base_url, str):
        normalized["base_url"] = base_url.strip().rstrip("/") or None
    normalized["health_endpoint"] = _normalize_provider_health_endpoint(
        provider_name=str(normalized.get("provider_name") or ""),
        provider_type=str(normalized.get("provider_type") or ""),
        health_endpoint=normalized.get("health_endpoint"),
    )
    return normalized


class ProviderError(Exception):
    """Base exception for provider errors"""


class ProviderNotFoundError(ProviderError):
    """Provider not found or disabled"""


class AllProvidersFailedError(ProviderError):
    """All providers failed for a generation type"""
