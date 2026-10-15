# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# PII encryption key setup and commit helpers for user-row writes in UGS billing.
# Invariants:
# - SET SESSION encryption.pii_key before commits touching encrypted users rows.
# Related:
# - api.core.pii_session.ensure_encryption_pii_key
# - api.services.ugs.billing_service.BillingService
# ---

from __future__ import annotations

import contextlib
import logging
from typing import TYPE_CHECKING

from api.core.pii_session import ensure_encryption_pii_key

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

logger = logging.getLogger(__name__)


class UserWriteMixin:
    """Transaction helpers for encrypted user updates."""

    db: AsyncSession

    async def _prepare_user_write_transaction(self) -> None:
        """
        Set the PII key for the current transaction before updating `users`.

        AsyncSession can use a different pooled connection after intermediate
        commits, so the initial session bootstrap isn't always enough for later
        updates touching encrypted user rows.
        """
        await ensure_encryption_pii_key(self.db)

    async def _commit_user_write(self) -> None:
        """Commit user updates and clear broken transaction state on failure."""
        try:
            await self._prepare_user_write_transaction()
            await self.db.commit()
        except Exception:
            with contextlib.suppress(Exception):
                await self.db.rollback()
            raise
