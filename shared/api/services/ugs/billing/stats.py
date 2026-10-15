# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Usage counters and aggregated billing statistics for UGS generation requests.
# Invariants:
# - Daily/monthly sums use SQL date_trunc to avoid timezone drift on naive timestamps.
# Related:
# - api.services.ugs.billing_service.BillingService
# - api.services.ugs.billing.credits.CreditsMixin
# ---

from __future__ import annotations

import logging
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import and_, func, select, text  # type: ignore[import-not-found]

from api.models.database_models import GenerationRequest, GenerationType, User
from api.services.ugs.billing.credits import CreditsMixin

logger = logging.getLogger(__name__)


class StatsMixin(CreditsMixin):
    """Daily/monthly/active counters and usage statistics (inherits credit balance reads)."""

    default_limits: dict[str, int]

    async def get_daily_usage(self, user_id: str) -> int:
        """
        Получить использование кредитов за сегодня

        Args:
            user_id: ID пользователя

        Returns:
            int: Количество использованных кредитов за день
        """
        # Use SQL date_trunc to get today's start (handles timezone correctly)
        # This avoids timezone issues with TIMESTAMP WITHOUT TIME ZONE columns
        stmt = select(func.sum(GenerationRequest.credits_used)).where(
            and_(
                GenerationRequest.user_id == user_id,
                func.date_trunc("day", GenerationRequest.created_at) == func.date_trunc("day", func.now()),
                GenerationRequest.status.in_(["success", "completed"]),
            )
        )
        result = await self.db.execute(stmt)
        daily_sum = result.scalar()
        return int(daily_sum) if daily_sum is not None else 0

    async def get_monthly_usage(self, user_id: str) -> int:
        """
        Получить использование кредитов за текущий месяц

        Args:
            user_id: ID пользователя

        Returns:
            int: Количество использованных кредитов за месяц
        """
        # Use SQL date functions to avoid timezone issues with TIMESTAMP WITHOUT TIME ZONE
        # Use SQL date_trunc to get month start (handles timezone correctly)
        stmt = select(func.sum(GenerationRequest.credits_used)).where(
            and_(
                GenerationRequest.user_id == user_id,
                func.date_trunc("month", GenerationRequest.created_at) == func.date_trunc("month", func.now()),
                GenerationRequest.status.in_(["success", "completed"]),
            )
        )
        result = await self.db.execute(stmt)
        monthly_sum = result.scalar()
        return int(monthly_sum) if monthly_sum is not None else 0

    async def get_active_requests_count(self, user_id: str) -> int:
        """
        Получить количество активных запросов пользователя

        Args:
            user_id: ID пользователя

        Returns:
            int: Количество активных запросов
        """
        stmt = (
            select(func.count())
            .select_from(GenerationRequest)
            .where(
                and_(
                    GenerationRequest.user_id == user_id,
                    GenerationRequest.status.in_(["pending", "processing"]),
                )
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar() or 0

    async def get_usage_stats(self, user_id: str) -> dict[str, Any]:
        """
        Получить статистику использования для пользователя

        Args:
            user_id: ID пользователя

        Returns:
            dict[str, Any] with statistics
        """
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()
        if not user:
            return {"error": "User not found"}

        def _to_float(value: Any | None) -> float:  # noqa: ANN401
            if value is None:
                return 0.0
            if isinstance(value, Decimal):
                return float(value)
            return float(value)

        available_credits = await self.get_available_credits(user_id)
        daily_used = await self.get_daily_usage(user_id)
        monthly_used = await self.get_monthly_usage(user_id)
        active_requests = await self.get_active_requests_count(user_id)

        # Общее использование за все время
        total_usage_stmt = select(func.sum(GenerationRequest.credits_used)).where(
            and_(
                GenerationRequest.user_id == user_id,
                GenerationRequest.status.in_(["success", "completed"]),
            )
        )
        total_usage_result = await self.db.execute(total_usage_stmt)
        total_used = int(total_usage_result.scalar() or 0)

        # Дополнительные метрики для фронтенда
        top_generation_types: list[dict[str, Any]] = []
        try:
            top_stmt = (
                select(
                    GenerationType.type_key,
                    GenerationType.display_name,
                    func.sum(GenerationRequest.credits_used).label("credits_used"),
                    func.avg(GenerationRequest.credits_used).label("avg_cost"),
                )
                .join(GenerationType, GenerationRequest.type_id == GenerationType.id)
                .where(
                    GenerationRequest.user_id == user_id,
                    GenerationRequest.status.in_(["success", "completed"]),
                )
                .group_by(GenerationType.type_key, GenerationType.display_name)
                .order_by(func.sum(GenerationRequest.credits_used).desc())
                .limit(5)
            )

            top_result = await self.db.execute(top_stmt)
            for row in top_result:
                mapping = row._mapping  # noqa: SLF001
                credits_used = _to_float(mapping.get("credits_used"))
                avg_cost = mapping.get("avg_cost")
                top_generation_types.append(
                    {
                        "type_key": mapping.get("type_key"),
                        "display_name": mapping.get("display_name") or mapping.get("type_key"),
                        "credits_used": credits_used,
                        "cost_per_unit": _to_float(avg_cost) if avg_cost else None,
                    }
                )
        except (OSError, ValueError, TypeError) as exc:
            logger.warning("Failed to compute top generation types for user %s: %s", user_id, exc)

        recent_transactions: list[dict[str, Any]] = []
        try:
            transactions_query = text("""
                SELECT id, transaction_type, amount, description, created_at
                FROM user_credit_transactions
                WHERE user_id = :user_id
                ORDER BY created_at DESC
                LIMIT 5
            """)
            txn_result = await self.db.execute(transactions_query, {"user_id": user_id})
            for row in txn_result:
                mapping = row._mapping  # noqa: SLF001
                recent_transactions.append(
                    {
                        "id": str(mapping.get("id")),
                        "type": mapping.get("transaction_type"),
                        "amount": _to_float(mapping.get("amount")),
                        "timestamp": mapping.get("created_at"),
                        "description": mapping.get("description"),
                    }
                )
        except (OSError, ValueError, TypeError) as exc:
            logger.warning("Failed to fetch recent transactions for user %s: %s", user_id, exc)

        # Use naive datetime for timestamp (no timezone)
        timestamp = datetime.now(UTC)
        daily_limit_value = user.daily_credit_limit or self.default_limits["daily_credits"]
        monthly_limit_value = user.monthly_credit_limit or self.default_limits["monthly_credits"]
        concurrent_limit = user.concurrent_requests_limit or self.default_limits["concurrent_requests"]

        monthly_spend = round(_to_float(monthly_used), 2)
        daily_average = round(_to_float(monthly_used) / max(1, timestamp.day), 2)

        return {
            "user_id": user_id,
            "available_credits": _to_float(available_credits),
            "daily_used": _to_float(daily_used),
            "daily_limit": daily_limit_value,
            "monthly_used": _to_float(monthly_used),
            "monthly_limit": monthly_limit_value,
            "total_used": _to_float(total_used),
            "active_requests": active_requests,
            "concurrent_limit": concurrent_limit,
            "timestamp": timestamp.isoformat(),
            "credits_remaining": _to_float(available_credits),
            "total_credits_used": _to_float(total_used),
            "monthly_spend": monthly_spend,
            "daily_average": daily_average,
            "top_generation_types": top_generation_types,
            "recent_transactions": recent_transactions,
        }
