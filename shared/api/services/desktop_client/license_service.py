# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Facade for desktop-client license domain: redeem/prove, ops inventory, preflight/heartbeat.
# Invariants:
# - Public import path api.services.desktop_client.license_service is stable.
# - HTTP/auth contracts live in routers; this module does not change URL shape.
# Related:
# - license_models.py, license_mixin_host.py, license_enroll.py, license_ops.py, license_runtime.py
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# ---

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

import asyncpg

from api.services.desktop_client.crypto_util import (
    challenge_proof,
    hash_license_key,
)
from api.services.desktop_client.license_enroll import LicenseEnrollMixin
from api.services.desktop_client.license_models import (
    BoundLicenseView,
    DesktopClientError,
    IssuedLicenseView,
    LicenseCapabilitiesView,
    LicenseDeviceItem,
    LicenseInventoryItem,
    LicensePreflightView,
    SessionAssertView,
)
from api.services.desktop_client.license_ops import LicenseOpsMixin
from api.services.desktop_client.license_runtime import LicenseRuntimeMixin
from api.services.desktop_client.limits import (
    ChallengeStore,
    SlidingTokenBucket,
    challenge_store,
    redeem_rate_limiter,
)

logger = logging.getLogger(__name__)


class DesktopClientLicenseService(LicenseEnrollMixin, LicenseOpsMixin, LicenseRuntimeMixin):
    def __init__(
        self,
        pool: asyncpg.Pool,
        *,
        rate_limiter: SlidingTokenBucket | None = None,
        challenges: ChallengeStore | None = None,
    ) -> None:
        self._pool = pool
        self._rate = rate_limiter or redeem_rate_limiter
        self._challenges = challenges or challenge_store

    @staticmethod
    async def _audit(
        conn: asyncpg.Connection,
        *,
        event: str,
        license_id: UUID | None,
        device_id: UUID | None,
        client_ip: str | None,
        detail: dict[str, Any],
    ) -> None:
        await conn.execute(
            """
            INSERT INTO desktop_client_audit (event, license_id, device_id, client_ip, detail)
            VALUES ($1, $2, $3, $4, $5::jsonb)
            """,
            event,
            license_id,
            device_id,
            client_ip,
            json.dumps(detail),
        )
        logger.info(
            "[STEP] desktop_client_audit event=%s license_id=%s device_id=%s",
            event,
            license_id,
            device_id,
        )


# Re-export for tests / issue script
__all__ = [
    "BoundLicenseView",
    "DesktopClientError",
    "DesktopClientLicenseService",
    "IssuedLicenseView",
    "LicenseCapabilitiesView",
    "LicenseDeviceItem",
    "LicenseInventoryItem",
    "LicensePreflightView",
    "SessionAssertView",
    "challenge_proof",
    "hash_license_key",
]
