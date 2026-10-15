from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.database_models import UGSSetting


class UGSRuntimeSettingsService:
    """Small helper for DB-backed runtime knobs exposed in UGS admin."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_setting_value(self, key: str, default: dict[str, Any] | None = None) -> dict[str, Any]:
        result = await self.db.execute(
            select(UGSSetting).where(
                UGSSetting.key == key,
            )
        )
        setting = result.scalar_one_or_none()

        if setting is None:
            return default.copy() if default is not None else {}

        value = setting.value
        if isinstance(value, dict):
            return value
        return default.copy() if default is not None else {}

    async def get_comfyui_default_workflow_slug(self) -> str | None:
        runtime_defaults = await self.get_setting_value("comfyui_runtime_defaults")
        slug = runtime_defaults.get("default_workflow_slug")
        if isinstance(slug, str):
            normalized = slug.strip()
            return normalized or None
        return None

    async def get_bi_default_model(self) -> str | None:
        runtime_defaults = await self.get_setting_value("runtime_defaults")
        model_name = runtime_defaults.get("bi_default_model")
        if isinstance(model_name, str):
            normalized = model_name.strip()
            return normalized or None
        return None
