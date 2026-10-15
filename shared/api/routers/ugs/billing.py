# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   UGS billing HTTP surface: usage stats, admin credit grants, packages, purchase, history.
# Invariants:
#   - Service ``{"error": ...}`` dicts never become ``BillingStatsResponse``; map to 404/500.
# Related:
#   - api/services/ugs/billing_service.py
# ---
"""UGS billing routes."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query  # type: ignore[import-untyped]

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.routers.ugs.common import _is_non_critical_error
from api.routers.ugs.deps import get_billing_service, logger, require_admin_user
from api.schemas.ugs import BillingStatsResponse
from api.services.ugs.billing_service import BillingService


def register_billing_routes(router: APIRouter) -> None:

    # ========================================
    # BILLING ENDPOINTS
    # ========================================

    @router.get(
        "/billing/stats",
        response_model=BillingStatsResponse,
        summary="Get Billing Statistics",
        description="Get user's current billing statistics and usage",
    )
    async def get_billing_stats(
        user: User = Depends(require_oauth2_user),  # noqa: B008
        billing_service: BillingService = Depends(get_billing_service),  # noqa: B008
    ) -> BillingStatsResponse:
        """
        🔥 GET BILLING STATISTICS 🔥

        Get comprehensive billing and usage statistics for the current user.
        """
        try:
            stats = await billing_service.get_usage_stats(str(user.id))
            if isinstance(stats, dict) and stats.get("error"):
                err_detail = stats.get("error")
                if err_detail == "User not found":
                    raise HTTPException(status_code=404, detail=str(err_detail))
                logger.warning(
                    "Unexpected billing stats payload for user %s: %s",
                    user.id,
                    err_detail,
                )
                raise HTTPException(status_code=500, detail="Internal server error")
            return BillingStatsResponse(**stats)

        except (OSError, RuntimeError) as e:
            error_msg = str(e)
            error_type = type(e).__name__

            # Handle non-critical errors (RabbitMQ channel/connection) gracefully
            if _is_non_critical_error(e):
                logger.warning(
                    "Non-critical error in get_billing_stats (RabbitMQ/connection): %s. Billing stats retrieval from database should still work.",
                    error_msg,
                )
                # Return empty stats instead of raising error for non-critical issues
                return BillingStatsResponse(
                    available_credits=0.0,
                    daily_used=0.0,
                    daily_limit=0.0,
                    monthly_used=0.0,
                    monthly_limit=0.0,
                    total_used=0.0,
                    active_requests=0,
                    concurrent_limit=0,
                    timestamp=None,
                    credits_remaining=None,
                    total_credits_used=None,
                    monthly_spend=None,
                    daily_average=None,
                    top_generation_types=None,
                    recent_transactions=None,
                )

            logger.exception(
                "Billing stats retrieval failed for user %s",
                user.id,
                extra={"user_id": str(user.id), "error_type": error_type},
            )
            raise HTTPException(status_code=500, detail="Internal server error") from e

    @router.post(
        "/billing/credits/add",
        summary="Add Credits (Admin)",
        description="Add credits to a user account (admin only)",
    )
    async def add_credits(
        user_id: UUID,
        amount: int = Query(..., description="Amount of credits to add", gt=0),
        admin_user: User = Depends(require_admin_user),  # noqa: ARG001, B008
        billing_service: BillingService = Depends(get_billing_service),  # noqa: B008
    ) -> dict[str, str]:
        """
        🔥 ADD CREDITS 🔥

        Add credits to a user account. Requires admin privileges.

        - **user_id**: Target user ID
        - **amount**: Amount of credits to add
        """
        try:
            success = await billing_service.add_credits(str(user_id), int(amount))

            if not success:
                msg = "Пользователь не найден."
                raise HTTPException(status_code=404, detail=msg)  # noqa: TRY301
            return {"message": f"Пользователю {user_id} начислено {amount} кредитов."}  # noqa: TRY300

        except HTTPException:
            raise
        except (OSError, RuntimeError) as e:
            logger.exception("Credit addition failed")
            raise HTTPException(status_code=500, detail="Internal server error") from e

    @router.get(
        "/billing/packages",
        summary="Get Credit Packages",
        description="Get all available credit packages for purchase",
    )
    async def get_credit_packages(
        billing_service: BillingService = Depends(get_billing_service),  # noqa: B008
    ) -> dict[str, list[dict[str, Any]]]:
        """
        🔥 GET CREDIT PACKAGES 🔥

        Retrieve all available credit packages that users can purchase.
        """
        try:
            packages = await billing_service.get_credit_packages()
            return {"packages": packages}  # noqa: TRY300

        except (OSError, RuntimeError) as e:
            logger.exception("Failed to retrieve credit packages")
            raise HTTPException(status_code=500, detail="Internal server error") from e

    @router.post(
        "/billing/packages/{package_name}/purchase",
        summary="Purchase Credit Package",
        description="Purchase a credit package and add credits to user account",
    )
    async def purchase_credit_package(
        package_name: str,
        payment_method: str = Query("stripe", description="Payment method (stripe, paypal, etc.)"),
        payment_id: str = Query(None, description="External payment system ID"),
        user: User = Depends(require_oauth2_user),  # noqa: B008
        billing_service: BillingService = Depends(get_billing_service),  # noqa: B008
    ) -> dict[str, Any]:
        """
        🔥 PURCHASE CREDIT PACKAGE 🔥

        Purchase a credit package and immediately add credits to the user's account.

        In a production environment, this would integrate with payment processors
        like Stripe, PayPal, etc. For now, it simulates successful payment.

        - **package_name**: Name of the credit package to purchase
        - **payment_method**: Payment method used (default: stripe)
        - **payment_id**: External payment system transaction ID
        """
        try:
            result = await billing_service.purchase_credit_package(
                user_id=str(user.id),
                package_name=package_name,
                payment_method=payment_method,
                payment_id=payment_id,
            )

            return {"message": "Credit package purchased successfully", "purchase_details": result}  # noqa: TRY300

        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        except (OSError, RuntimeError) as e:
            logger.exception("Credit package purchase failed")
            raise HTTPException(status_code=500, detail="Internal server error") from e

    @router.get(
        "/billing/purchase-history",
        summary="Get Purchase History",
        description="Get user's credit purchase history",
    )
    async def get_purchase_history(
        limit: int = Query(50, description="Maximum number of records to return", le=100),
        user: User = Depends(require_oauth2_user),  # noqa: B008
        billing_service: BillingService = Depends(get_billing_service),  # noqa: B008
    ) -> dict[str, list[dict[str, Any]]]:
        """
        🔥 GET PURCHASE HISTORY 🔥

        Retrieve the user's credit purchase history.

        - **limit**: Maximum number of records to return (default: 50, max: 100)
        """
        try:
            history = await billing_service.get_purchase_history(str(user.id), limit)
            return {"purchase_history": history}  # noqa: TRY300

        except (OSError, RuntimeError) as e:
            logger.exception("Failed to retrieve purchase history")
            raise HTTPException(status_code=500, detail="Internal server error") from e
