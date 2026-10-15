# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   Shared FastAPI dependencies for UGS HTTP routes (DB sessions, UGS services, idempotency key parsing).
# Invariants:
#   - Optional ContentStorageService attachment must never take down unrelated routes on failure.
# Related:
#   - api/routers/ugs/__init__.py (router assembly)
#   - api/services/ugs/unified_generation_service.py
# ---
"""UGS router dependencies and idempotency helpers."""

from __future__ import annotations

import logging
from collections.abc import AsyncGenerator

from fastapi import Depends  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.database_manager import get_postgres_session
from api.services.ugs.admin_access import require_ugs_admin_user
from api.services.ugs.billing_service import BillingService
from api.services.ugs.generation_type_service import GenerationTypeService
from api.services.ugs.provider_manager_service_v2 import ProviderManagerServiceV2
from api.services.ugs.unified_generation_service import UnifiedGenerationService

require_admin_user = require_ugs_admin_user

logger = logging.getLogger(__name__)

_IDEMPOTENCY_KEY_MAX = 220


def _idempotency_key_from_body_or_headers(body_key: str | None, http_request: object) -> str | None:
    """Prefer JSON ``idempotency_key``; else ``Idempotency-Key`` / ``X-Idempotency-Key`` headers."""
    if body_key and str(body_key).strip():
        return str(body_key).strip()[:_IDEMPOTENCY_KEY_MAX]
    headers = getattr(http_request, "headers", None)
    if headers is None:
        return None
    h = headers.get("Idempotency-Key") or headers.get("X-Idempotency-Key")
    if h and str(h).strip():
        return str(h).strip()[:_IDEMPOTENCY_KEY_MAX]
    return None


async def get_ugs_service(
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> AsyncGenerator[UnifiedGenerationService]:
    """Get UGS service instance with ContentStorageService if available"""
    content_service = None
    try:
        from api.routers.unified_content import (  # noqa: PLC0415
            get_content_service,
        )

        content_service = await get_content_service()
        logger.debug(
            "ContentStorageService attached to UGS for this request (audio/transcription → unified content when used)"
        )
    except Exception as e:
        logger.warning(
            "ContentStorageService not available for UGS (%s): %s — UGS continues without unified content (audio/transcription not saved there)",
            type(e).__name__,
            e,
            exc_info=logger.isEnabledFor(logging.DEBUG),
        )
        content_service = None

    service = UnifiedGenerationService(db, content_service=content_service)
    try:
        yield service
    finally:
        await service.close()


def get_generation_type_service(
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> GenerationTypeService:
    """Get generation type service instance"""
    return GenerationTypeService(db)


async def get_provider_manager(
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> AsyncGenerator[ProviderManagerServiceV2]:
    """Get provider manager instance (DB-driven V2)"""
    provider_manager = ProviderManagerServiceV2(db)
    try:
        yield provider_manager
    finally:
        await provider_manager.close()


def get_billing_service(
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> BillingService:
    """Get billing service instance"""
    return BillingService(db)
