# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# MusicForge billing и квоты перед созданием run: preflight кредитов UGS и лимиты completed-run.
# Invariants:
# - HTTP 402 при нехватке кредитов; 429 при превышении day/month budget; admin bypass для budget.
# Related:
# - api/services/music_forge/pipeline.py
# - api/services/music_forge/config/
# ---
"""MusicForge billing and run-budget gate before run creation."""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.services.music_forge.algorithm import (
    MUSIC_FORGE_BLUEPRINT_TYPE_KEY,
    MUSIC_FORGE_LYRICS_TYPE_KEY,
    MUSIC_FORGE_STYLE_TYPE_KEY,
)
from api.services.music_forge.config import MusicForgeConfigGateway
from api.services.music_forge.pipeline_repository import MusicForgeRunRepository
from api.services.ugs.billing_service import BillingService
from api.services.ugs.generation_type_service import GenerationTypeService


class MusicForgeBillingGate:
    """Preflight credits and optional completed-run quotas for MusicForge."""

    def __init__(self, db: AsyncSession, *, repo: MusicForgeRunRepository) -> None:
        self.db = db
        self.repo = repo
        self._config = MusicForgeConfigGateway(db)

    async def preflight_credits(self, *, user_id: str, audio_type_key: str) -> None:
        type_keys = (
            MUSIC_FORGE_BLUEPRINT_TYPE_KEY,
            MUSIC_FORGE_LYRICS_TYPE_KEY,
            MUSIC_FORGE_STYLE_TYPE_KEY,
            audio_type_key,
        )
        type_service = GenerationTypeService(self.db)
        total_credits = 0.0
        primary_type = None
        for type_key in type_keys:
            generation_type = await type_service.get_by_key(type_key)
            if generation_type is None:
                raise HTTPException(
                    status_code=503,
                    detail=f"music forge generation type missing: {type_key}",
                )
            total_credits += float(generation_type.cost_credits or 0)
            if type_key == audio_type_key:
                primary_type = generation_type
        if primary_type is None:
            raise HTTPException(status_code=503, detail="music forge audio generation type missing")
        billing = BillingService(self.db)
        try:
            await billing.check_limits(user_id, primary_type, credit_amount=total_credits)
        except ValueError as exc:
            raise HTTPException(status_code=402, detail=str(exc)) from exc

    async def enforce_run_budget(self, *, user_id: str, user_role: str | None) -> None:
        """Enforce optional per-user completed-run quotas from active product settings.

        Admin users (`admin`, `emperyworld_admin`) bypass run budget checks.
        """
        if user_role in ("admin", "emperyworld_admin"):
            return
        config = await self._config.get_active()
        day_limit = config.product.get("max_completed_runs_per_day")
        month_limit = config.product.get("max_completed_runs_per_month")
        if day_limit is not None:
            day_count = await self.repo._count_completed_runs_for_user(user_id=user_id, window_hours=24)
            if day_count >= int(day_limit):
                raise HTTPException(
                    status_code=429,
                    detail="music_forge daily completed-run limit exceeded",
                )
        if month_limit is not None:
            month_count = await self.repo._count_completed_runs_for_user(user_id=user_id, window_hours=24 * 30)
            if month_count >= int(month_limit):
                raise HTTPException(
                    status_code=429,
                    detail="music_forge monthly completed-run limit exceeded",
                )
