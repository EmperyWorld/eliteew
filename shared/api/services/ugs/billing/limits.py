# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pre-generation limit checks and stale in-flight request cleanup for UGS billing.
# Invariants:
# - release_stale_requests must run before slot checks; text types use shorter timeout.
# Related:
# - api.services.ugs.billing_service.BillingService
# - api.services.ugs.billing.stats.StatsMixin
# ---

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import and_, select  # type: ignore[import-not-found]

from api.models.database_models import GenerationRequest, GenerationType, User
from api.services.ugs.billing.stats import StatsMixin
from api.services.ugs.queue_manager_service import QueueManagerService

logger = logging.getLogger(__name__)


class LimitsMixin(StatsMixin):
    """Limit enforcement and stale request release (inherits stats + credits)."""

    default_limits: dict[str, int]

    async def check_limits(
        self,
        user_id: str,
        generation_type: GenerationType,
        *,
        credit_amount: float | None = None,
    ) -> dict[str, Any]:
        """
        Проверить лимиты пользователя перед генерацией

        Args:
            user_id: ID пользователя
            generation_type: Тип генерации

        Returns:
            dict[str, Any] with check result

        Raises:
            ValueError: если лимиты превышены
        """
        # Получить пользователя
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()
        if not user:
            msg = f"User {user_id} not found"
            raise ValueError(msg)

        # Очистить зависшие запросы до проверки лимитов (короче для текстовых задач)
        max_stale_age = 15
        category = (generation_type.category or "").lower() if generation_type else ""
        if category in {"text", "chat", "llm", "conversation"}:
            max_stale_age = 5

        await self.release_stale_requests(user_id, max_age_minutes=max_stale_age)

        # Проверить доступные кредиты
        available_credits = await self.get_available_credits(user_id)
        # In runtime, generation_type.cost_credits is a Decimal value, not Column
        if credit_amount is not None:
            cost_credits_value = float(credit_amount)
        else:
            cost_credits_value = (
                float(generation_type.cost_credits) if generation_type.cost_credits is not None else 0.0
            )  # type: ignore[arg-type]

        if available_credits < cost_credits_value:
            msg = f"Insufficient credits. Required: {cost_credits_value}, Available: {available_credits}"
            raise ValueError(msg)

        # Проверить дневной лимит
        daily_usage = await self.get_daily_usage(user_id)
        # In runtime, user.daily_credit_limit is an int value, not Column
        daily_limit_value = user.daily_credit_limit
        daily_limit = (
            float(daily_limit_value) if daily_limit_value is not None else float(self.default_limits["daily_credits"])
        )  # type: ignore[arg-type]

        if daily_usage + cost_credits_value > daily_limit:  # type: ignore[operator]
            msg = f"Daily limit exceeded. Used: {daily_usage}, Limit: {daily_limit}, Required: {cost_credits_value}"
            raise ValueError(msg)

        # Проверить месячный лимит
        monthly_usage = await self.get_monthly_usage(user_id)
        # In runtime, user.monthly_credit_limit is an int value, not Column
        monthly_limit_value = user.monthly_credit_limit
        monthly_limit = (
            float(monthly_limit_value)
            if monthly_limit_value is not None
            else float(self.default_limits["monthly_credits"])
        )  # type: ignore[arg-type]

        if monthly_usage + cost_credits_value > monthly_limit:  # type: ignore[operator]
            msg = (
                f"Monthly limit exceeded. Used: {monthly_usage}, Limit: {monthly_limit}, Required: {cost_credits_value}"
            )
            raise ValueError(msg)

        # Проверить лимит одновременных запросов
        active_requests = await self.get_active_requests_count(user_id)
        # In runtime, user.concurrent_requests_limit is an int value, not Column
        concurrent_limit_value = user.concurrent_requests_limit
        concurrent_limit = (
            int(concurrent_limit_value)
            if concurrent_limit_value is not None
            else int(self.default_limits["concurrent_requests"])
        )  # type: ignore[arg-type]

        if active_requests >= concurrent_limit:  # type: ignore[operator]
            msg = f"Concurrent requests limit exceeded. Active: {active_requests}, Limit: {concurrent_limit}"
            raise ValueError(msg)

        return {
            "allowed": True,
            "available_credits": available_credits,
            "daily_used": daily_usage,
            "daily_limit": daily_limit,
            "monthly_used": monthly_usage,
            "monthly_limit": monthly_limit,
            "active_requests": active_requests,
            "concurrent_limit": concurrent_limit,
        }

    async def release_stale_requests(self, user_id: str, max_age_minutes: int = 15) -> int:
        """Release stale requests blocking concurrent generation limit."""
        # Use naive datetime for TIMESTAMP WITHOUT TIME ZONE
        cutoff = datetime.now(UTC) - timedelta(minutes=max_age_minutes)
        # Remove timezone info to ensure naive datetime
        cutoff = cutoff.replace(tzinfo=None)

        stmt = select(GenerationRequest).where(
            and_(
                GenerationRequest.user_id == user_id,
                GenerationRequest.status.in_(["pending", "processing"]),
                GenerationRequest.updated_at < cutoff,
            )
        )
        result = await self.db.execute(stmt)
        stale_requests = list(result.scalars().all())

        if not stale_requests:
            return 0

        released = 0
        # Use naive datetime for TIMESTAMP WITHOUT TIME ZONE
        now = datetime.now(UTC).replace(tzinfo=None)

        stale_ids = [str(request.id) for request in stale_requests]

        for request in stale_requests:
            # Update status and add error message
            request.status = "failed"  # type: ignore[assignment]
            request.error_message = "Automatic completion: request exceeded timeout"  # type: ignore[assignment]
            request.completed_at = now  # type: ignore[assignment]
            request.updated_at = now  # type: ignore[assignment]

        released = len(stale_ids)

        if released:
            queue_manager = QueueManagerService(self.db)
            removed = await queue_manager.remove_many_from_queue(stale_ids)

            if removed != released:
                # Queue entries were already absent, ensure request updates are persisted.
                await self.db.commit()

            logger.warning(
                "Released %s stale generation requests for user %s (older than %s minutes)",
                released,
                user_id,
                max_age_minutes,
            )
        else:
            await self.db.commit()

        return released
