# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
#   Shared helpers for UGS Admin HTTP routes (model mapping, UUID parsing, payload normalization).
# Invariants:
#   - No route definitions; pure helpers only.
# Related:
#   - api/routers/ugs_admin/__init__.py
#   - api/schemas/ugs_admin.py
# ---

from __future__ import annotations

from typing import Any
from uuid import UUID

from api.models.database_models import User as UserModel
from api.schemas.ugs_admin import AdminUserResponse


def model_to_response(model: Any, response_cls: type[Any]) -> Any:
    return response_cls.model_validate(model.to_dict())


def parse_uuid(value: str | UUID | None) -> UUID | None:
    if not value:
        return None
    if isinstance(value, UUID):
        return value
    try:
        return UUID(str(value))
    except ValueError:
        return None


def humanize_admin_detail(detail: str) -> str:
    normalized = detail.strip()
    lower_value = normalized.lower()

    if "insufficient permissions" in lower_value:
        return "Недостаточно прав для выполнения операции."
    if "access allowed only to ugs administrators" in lower_value:
        return "Доступ разрешён только администраторам UGS."
    if "user not found" in lower_value:
        return "Пользователь не найден."
    if "failed to top up balance" in lower_value:
        return "Не удалось пополнить баланс пользователя."
    if "provider not found" in lower_value:
        return "Провайдер не найден."
    if "provider with this name already exists" in lower_value:
        return "Провайдер с таким именем уже существует."
    if "generation type not found" in lower_value:
        return "Тип генерации не найден."
    if "already exists" in lower_value and "generation type" in lower_value:
        return "Тип генерации с таким ключом уже существует."
    if "workflow not found" in lower_value:
        return "Воркфлоу не найден."
    if "slug is already in use" in lower_value:
        return "Этот slug уже занят."
    if "setting already exists" in lower_value:
        return "Такая настройка уже существует. Используйте обновление."
    if "setting not found" in lower_value:
        return "Настройка не найдена."
    if "base_url is required" in lower_value:
        return "Укажите base_url."
    if "base_url must be http or https" in lower_value:
        return "base_url должен начинаться с http:// или https://."

    return normalized


def normalize_generation_provider_payload(
    data: dict[str, Any],
    *,
    provider_name_hint: str | None = None,
    provider_type_hint: str | None = None,
) -> dict[str, Any]:
    """Keep DB provider rows consistent for runtime health checks."""
    normalized = dict(data)
    dlabel = normalized.get("display_label")
    if isinstance(dlabel, str):
        normalized["display_label"] = dlabel.strip() or None
    elif "display_label" in normalized and dlabel is not None:
        normalized["display_label"] = None

    provider_name = str(normalized.get("provider_name") or provider_name_hint or "").strip().lower()
    provider_type = str(normalized.get("provider_type") or provider_type_hint or "").strip().lower()

    base_url_value = normalized.get("base_url")
    if isinstance(base_url_value, str):
        normalized["base_url"] = base_url_value.strip().rstrip("/") or None

    health_endpoint_value = normalized.get("health_endpoint")
    health_endpoint = health_endpoint_value.strip() if isinstance(health_endpoint_value, str) else health_endpoint_value

    if (provider_name == "comfyui" or provider_type == "comfyui") and health_endpoint in (None, "", "/"):
        normalized["health_endpoint"] = "/system_stats"
        return normalized

    if isinstance(health_endpoint, str):
        normalized["health_endpoint"] = health_endpoint or None

    return normalized


def user_to_admin_response(user_obj: UserModel) -> AdminUserResponse:
    return AdminUserResponse(
        id=user_obj.id,  # type: ignore[arg-type]
        email=str(user_obj.email),
        username=str(user_obj.username),
        full_name=str(user_obj.full_name) if user_obj.full_name is not None else None,
        role=str(user_obj.role),
        is_trusted=bool(getattr(user_obj, "is_trusted", False)),
        admin_badge_label=getattr(user_obj, "admin_badge_label", None),
        admin_badge_hint=getattr(user_obj, "admin_badge_hint", None),
        is_system_account=bool(getattr(user_obj, "is_system_account", False)),
        credits=float(user_obj.credits) if user_obj.credits is not None else 0.0,  # type: ignore[arg-type]
        daily_credit_limit=int(user_obj.daily_credit_limit) if user_obj.daily_credit_limit is not None else None,  # type: ignore[arg-type]
        monthly_credit_limit=int(user_obj.monthly_credit_limit) if user_obj.monthly_credit_limit is not None else None,  # type: ignore[arg-type]
        concurrent_requests_limit=int(user_obj.concurrent_requests_limit)  # type: ignore[arg-type]
        if user_obj.concurrent_requests_limit is not None
        else None,
        created_at=user_obj.created_at if user_obj.created_at else None,  # type: ignore[arg-type]
        updated_at=user_obj.updated_at if user_obj.updated_at else None,  # type: ignore[arg-type]
    )
