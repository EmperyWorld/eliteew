# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Credit balance reads, deductions, refunds, and usage recording for UGS billing.
# Invariants:
# - deduct_credits_without_commit leaves commit/rollback to the caller (atomic complete path).
# Related:
# - api.services.ugs.billing_service.BillingService
# - api.services.ugs.billing.user_write.UserWriteMixin
# ---

from __future__ import annotations

import contextlib
import logging
from typing import TYPE_CHECKING, Any

from sqlalchemy import select  # type: ignore[import-not-found]

from api.models.database_models import GenerationType, User
from api.services.ugs.billing.user_write import UserWriteMixin

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

logger = logging.getLogger(__name__)


class CreditsMixin(UserWriteMixin):
    """Credit balance mutations and usage recording."""

    db: AsyncSession

    async def record_usage(
        self,
        user_id: str,
        generation_type: GenerationType,
        metadata: dict[str, Any] | None = None,  # noqa: ARG002
        *,
        credit_amount: int | None = None,
    ) -> bool:
        """
        Record credit usage

        Args:
            user_id: User ID
            generation_type: Generation type
            metadata: Additional metadata (unused, kept for API compatibility)

        Returns:
            bool: True if successfully recorded
        """
        # Списать кредиты
        if credit_amount is not None:
            cost_credits = int(credit_amount)
        else:
            # Convert cost_credits to int safely (handles float, Decimal, etc.)
            # In runtime, generation_type.cost_credits is a Decimal value, not Column
            cost_credits_value = generation_type.cost_credits
            cost_credits = (
                0 if cost_credits_value is None else int(float(cost_credits_value))  # type: ignore[arg-type]
            )
        try:
            success = await self.deduct_credits(user_id, cost_credits)
        except Exception as billing_error:
            with contextlib.suppress(Exception):
                await self.db.rollback()
            logger.warning("Failed to deduct credits for user %s: %s", user_id, billing_error)
            return False
        if not success:
            logger.error("Failed to deduct credits for user %s", user_id)
            return False

        # Записать статистику использования
        # (можно добавить отдельную таблицу для детальной статистики)

        logger.info(
            "Recorded usage: user=%s, type=%s, cost=%s",
            user_id,
            generation_type.type_key,
            cost_credits,
        )
        return True

    async def refund_credits(
        self,
        user_id: str,
        generation_type: GenerationType,
        percentage: float = 1.0,
        *,
        credit_amount: int | None = None,
    ) -> bool:
        """
        Вернуть кредиты (при отмене генерации)

        Args:
            user_id: ID пользователя
            generation_type: Тип генерации
            percentage: Процент возврата (0.0-1.0)

        Returns:
            bool: True если успешно возвращено
        """
        if credit_amount is not None:
            refund_amount = int(credit_amount * percentage)
        else:
            # Convert cost_credits to int safely (handles float, Decimal, etc.)
            # In runtime, generation_type.cost_credits is a Decimal value, not Column
            cost_credits_value = generation_type.cost_credits
            refund_amount = (
                0 if cost_credits_value is None else int(float(cost_credits_value) * percentage)  # type: ignore[arg-type]
            )

        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()
        if not user:
            return False

        user.credits = (user.credits or 0) + refund_amount  # type: ignore[assignment]
        await self._commit_user_write()

        logger.info("Refunded %s credits to user %s", refund_amount, user_id)
        if refund_amount > 0:
            try:
                from api.core.database_manager import get_asyncpg_pool
                from api.gaf_chat.system_notifications import notify_user_energy_credits_changed

                pool = await get_asyncpg_pool()
                credits_after = user.credits
                new_bal = float(credits_after) if credits_after is not None else float(refund_amount)
                await notify_user_energy_credits_changed(
                    pool,
                    str(user_id),
                    new_balance=new_bal,
                    delta=float(refund_amount),
                    change_kind="refund",
                )
            except Exception:
                logger.warning(
                    "GAF notify after credit refund failed user=%s",
                    user_id,
                    exc_info=True,
                )
        return True

    async def get_available_credits(self, user_id: str) -> int:
        """
        Получить доступное количество кредитов

        Args:
            user_id: ID пользователя

        Returns:
            int: Количество доступных кредитов
        """
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()
        if not user:
            return 0

        # In runtime, user.credits is a Decimal value, not Column
        credits_value = user.credits
        if credits_value is None:
            return 0
        # Convert Decimal to int safely
        # In runtime, credits_value is Decimal, not Column
        return int(float(credits_value))  # type: ignore[arg-type]

    async def deduct_credits(self, user_id: str, amount: int) -> bool:
        """
        Списать кредиты

        Args:
            user_id: ID пользователя
            amount: Количество кредитов для списания

        Returns:
            bool: True если успешно списано
        """
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()
        if not user:  # type: ignore[truthy-bool]
            return False

        # Get current credits value and convert to float for comparison
        # In runtime, user.credits is a Decimal value, not Column
        current_credits_value = user.credits
        # In runtime, current_credits_value is Decimal, not Column
        current_credits = float(current_credits_value) if current_credits_value is not None else 0.0  # type: ignore[arg-type]

        if current_credits < float(amount):
            return False

        # Update credits (SQLAlchemy will handle the conversion)
        new_credits = current_credits - float(amount)
        user.credits = new_credits  # type: ignore[assignment]
        await self._commit_user_write()

        return True

    async def deduct_credits_without_commit(self, user_id: str, amount: int) -> bool:
        """
        Списать кредиты без commit (одна транзакция с другими UPDATE в вызывающем коде).

        Вызывающий обязан сделать commit/rollback сессии.
        """
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()
        if not user:  # type: ignore[truthy-bool]
            return False

        current_credits_value = user.credits
        current_credits = float(current_credits_value) if current_credits_value is not None else 0.0  # type: ignore[arg-type]

        if current_credits < float(amount):
            return False

        new_credits = current_credits - float(amount)
        user.credits = new_credits  # type: ignore[assignment]
        await self._prepare_user_write_transaction()
        await self.db.flush()
        return True

    async def add_credits(self, user_id: str, amount: int) -> bool:
        """
        Добавить кредиты пользователю

        Args:
            user_id: ID пользователя
            amount: Количество кредитов для добавления

        Returns:
            bool: True если успешно добавлено
        """
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()
        if not user:
            return False

        user.credits = (user.credits or 0) + amount  # type: ignore[assignment]
        await self._commit_user_write()

        logger.info("Added %s credits to user %s", amount, user_id)
        return True
