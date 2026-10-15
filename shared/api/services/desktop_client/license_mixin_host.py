# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Typing host for desktop-client license mixins — declares composed attributes.
# Invariants:
# - Not instantiated alone; DesktopClientLicenseService implements the surface.
# Related:
# - license_enroll.py, license_ops.py, license_runtime.py, license_service.py
# ---

from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg

from api.services.desktop_client.limits import ChallengeStore, SlidingTokenBucket


class LicenseMixinHost:
    """Declared host surface for license mixins (implemented on the facade)."""

    _pool: asyncpg.Pool
    _rate: SlidingTokenBucket
    _challenges: ChallengeStore

    @staticmethod
    async def _audit(
        conn: asyncpg.Connection,
        *,
        event: str,
        license_id: UUID | None,
        device_id: UUID | None,
        client_ip: str | None,
        detail: dict[str, Any],
    ) -> None: ...
