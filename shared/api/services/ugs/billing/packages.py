# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# User limit updates and credit package catalog/purchase flows for UGS billing.
# Invariants:
# - Purchase path uses DB add_credits function after simulated payment success.
# Related:
# - api.services.ugs.billing_service.BillingService
# - api.services.ugs.billing.user_write.UserWriteMixin
# ---

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from sqlalchemy import select, text  # type: ignore[import-not-found]

from api.models.database_models import User
from api.services.ugs.billing.user_write import UserWriteMixin

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

logger = logging.getLogger(__name__)


class PackagesMixin(UserWriteMixin):
    """Credit packages and user limit administration."""

    db: AsyncSession

    async def update_user_limits(self, user_id: str, limits: dict[str, Any]) -> bool:
        """
        Обновить лимиты пользователя

        Args:
            user_id: ID пользователя
            limits: Новые лимиты

        Returns:
            bool: True если успешно обновлено
        """
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()
        if not user:
            return False

        if "daily_credits" in limits:
            user.daily_credit_limit = limits["daily_credits"]
        if "monthly_credits" in limits:
            user.monthly_credit_limit = limits["monthly_credits"]
        if "concurrent_requests" in limits:
            user.concurrent_requests_limit = limits["concurrent_requests"]

        await self._commit_user_write()

        logger.info("Updated limits for user %s: %s", user_id, limits)
        return True

    async def get_credit_packages(self) -> list:
        """
        Get all available credit packages

        Returns:
            List of credit packages
        """
        query = text("""
            SELECT
                id,
                package_name,
                display_name,
                description,
                credits_amount,
                price_usd,
                currency,
                is_active,
                is_visible
            FROM credit_packages
            WHERE is_active = TRUE AND is_visible = TRUE
            ORDER BY credits_amount ASC
        """)

        result = await self.db.execute(query)
        packages: list[dict[str, Any]] = []
        for row in result:
            pkg = dict(row._mapping)  # noqa: SLF001
            credits = pkg.get("credits_amount")
            price = pkg.get("price_usd")
            try:
                credits_f = float(credits) if credits is not None else 0.0
                price_f = float(price) if price is not None else 0.0
            except TypeError, ValueError:
                credits_f = 0.0
                price_f = 0.0
            if credits_f > 0:
                pkg["price_per_1k_credits"] = round((price_f / credits_f) * 1000.0, 4)
            else:
                pkg["price_per_1k_credits"] = None
            packages.append(pkg)
        return packages

    async def purchase_credit_package(
        self,
        user_id: str,
        package_name: str,
        payment_method: str = "stripe",
        payment_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Purchase a credit package for a user

        Args:
            user_id: User ID
            package_name: Name of the package to purchase
            payment_method: Payment method used
            payment_id: External payment system ID

        Returns:
            (dict[str, Any]) with purchase result
        """
        # Get package details
        query = text("""
            SELECT id, package_name, display_name, credits_amount, price_usd, currency
            FROM credit_packages
            WHERE package_name = :package_name AND is_active = TRUE
        """)

        result = await self.db.execute(query, {"package_name": package_name})
        package = result.mappings().first()

        if not package:
            msg = f"Credit package '{package_name}' not found or not available"
            raise ValueError(msg)

        # Get user
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()
        if not user:
            msg = f"User {user_id} not found"
            raise ValueError(msg)

        # In a real implementation, you would:
        # 1. Process payment with external payment provider (Stripe, PayPal, etc.)
        # 2. Verify payment was successful
        # 3. Only then add credits

        # For now, we'll simulate successful payment and add credits
        logger.info(
            "Processing purchase: user=%s, package=%s, amount=%s",
            user_id,
            package_name,
            package["credits_amount"],
        )

        # Add credits using the database function
        add_query = text(
            "SELECT add_credits(:user_id, :amount, 'purchase', :package_id, NULL, :description, :payment_method, :payment_id)"
        )
        await self._prepare_user_write_transaction()
        await self.db.execute(
            add_query,
            {
                "user_id": user_id,
                "amount": package["credits_amount"],
                "package_id": str(package["id"]),
                "description": f"Purchased {package['display_name']} package",
                "payment_method": payment_method,
                "payment_id": payment_id,
            },
        )

        await self._commit_user_write()

        logger.info(
            "Successfully purchased %s credits for user %s",
            package["credits_amount"],
            user_id,
        )

        return {
            "success": True,
            "package_name": package["package_name"],
            "display_name": package["display_name"],
            "credits_added": package["credits_amount"],
            "price_paid": package["price_usd"],
            "currency": package["currency"],
            "payment_method": payment_method,
            "payment_id": payment_id,
            "new_balance": (user.credits or 0) + package["credits_amount"],
        }

    async def get_purchase_history(self, user_id: str, limit: int = 50) -> list:
        """
        Get user's credit purchase history

        Args:
            user_id: User ID
            limit: Maximum number of records to return

        Returns:
            List of purchase transactions
        """
        query = text("""
            SELECT
                t.id,
                t.transaction_type,
                t.amount,
                t.balance_after,
                t.created_at,
                p.package_name,
                p.display_name,
                t.payment_method,
                t.payment_id,
                t.description
            FROM user_credit_transactions t
            LEFT JOIN credit_packages p ON t.package_id = p.id
            WHERE t.user_id = :user_id AND t.transaction_type = 'purchase'
            ORDER BY t.created_at DESC
            LIMIT :limit
        """)

        result = await self.db.execute(query, {"user_id": user_id, "limit": limit})
        return [dict(row._mapping) for row in result]
