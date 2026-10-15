# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Runtime maintenance-window state for safe restarts: Redis for live API state and static JSON for API-down fallback.
# Invariants:
# - Redis failures must degrade to the static frontend file; planned downtime UX must not depend on DB availability.
# - Completed/cancelled windows are never returned as active by the public status helper.
# - Deploy tooling may clear only deploy-owned windows (never admin-scheduled foreign sources).
# Related:
# - api/schemas/maintenance.py
# - api/routers/system_maintenance.py
# - api/scripts/maintenance_deploy_ctl.py
# - documentation/platform/USER-SAFE-RESTARTS-AND-MAINTENANCE.md
# ---
"""Maintenance state storage and normalization."""

from __future__ import annotations

import json
import logging
import os
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal
from uuid import uuid4

from api.core.database_manager import DatabaseConnectionError, get_database_manager
from api.schemas.maintenance import (
    MaintenancePhase,
    MaintenanceStatus,
    MaintenanceWindow,
    MaintenanceWindowUpsert,
)

logger = logging.getLogger(__name__)

_DEFAULT_STATE_FILE = "/app/frontend-dist/maintenance-state.json"
_REDIS_KEY = "eliteew:maintenance:window:v1"
_DEFAULT_REDIS_TTL_SECONDS = 7 * 24 * 60 * 60

# Sources written by stack0 release / eliteew deploy helpers (not admin UI).
DEPLOY_OWNED_SOURCES: frozenset[str] = frozenset(
    {
        "stack0-baked-deploy",
        "eliteew-stack0-baked",
        # Compat: windows opened before rename wave (2026-08-15).
        "dewa-ops-stack0-baked",
        "dewa-ops",
    }
)

ClearOwnedResult = Literal[
    "cleared",
    "skipped_missing",
    "skipped_foreign",
    "skipped_id_mismatch",
    "skipped_phase",
]


def is_deploy_owned_source(source: str | None) -> bool:
    """True when the window was created by stack0 release tooling."""
    return (source or "").strip() in DEPLOY_OWNED_SOURCES


def _decode_redis_value(raw: Any) -> str | None:
    if raw is None:
        return None
    if isinstance(raw, bytes):
        return raw.decode("utf-8", errors="replace")
    return str(raw)


def _state_file_path() -> Path:
    raw = os.environ.get("ELITEEW_MAINTENANCE_STATE_FILE", _DEFAULT_STATE_FILE).strip()
    return Path(raw or _DEFAULT_STATE_FILE)


def _redis_key() -> str:
    return os.environ.get("ELITEEW_MAINTENANCE_REDIS_KEY", _REDIS_KEY).strip() or _REDIS_KEY


def _redis_ttl_seconds(window: MaintenanceWindow) -> int:
    env_raw = os.environ.get("ELITEEW_MAINTENANCE_REDIS_TTL_SECONDS", "").strip()
    if env_raw.isdigit():
        return max(60, int(env_raw))
    if window.expected_ends_at:
        remaining = int(window.expected_ends_at.timestamp() - time.time())
        return max(60, remaining + 24 * 60 * 60)
    return _DEFAULT_REDIS_TTL_SECONDS


def normalize_maintenance_payload(payload: Any, *, source: str | None = None) -> MaintenanceWindow | None:
    """Coerce loose JSON from Redis/static files into the canonical window model."""
    if not isinstance(payload, dict):
        return None
    raw_window = payload.get("window") if isinstance(payload.get("window"), dict) else payload
    if not isinstance(raw_window, dict):
        return None
    if raw_window.get("active") is False and not raw_window.get("phase"):
        return None

    shaped: dict[str, Any] = dict(raw_window)
    shaped.setdefault("id", f"maintenance-{uuid4().hex[:12]}")
    shaped.setdefault("source", source)
    try:
        window = MaintenanceWindow.model_validate(shaped)
    except Exception as exc:
        logger.warning("maintenance_state_invalid source=%s error=%s", source or "unknown", exc)
        return None
    if source and not window.source:
        window.source = source
    return window


def maintenance_status_payload(window: MaintenanceWindow | None) -> dict[str, Any]:
    """Serialize a public maintenance status response."""
    status = MaintenanceStatus(active=bool(window and window.is_effective), window=window if window else None)
    return status.model_dump(mode="json")


class MaintenanceService:
    """Read/write maintenance windows from Redis, with static JSON as fallback."""

    async def get_current_window(self, *, include_inactive: bool = False) -> MaintenanceWindow | None:
        """Return current effective window, preferring Redis over static frontend JSON."""
        redis_window = await self._read_redis_window()
        window = redis_window or self._read_static_window()
        if window is None:
            return None
        if include_inactive or window.is_effective:
            return window
        return None

    async def get_status(self) -> dict[str, Any]:
        """Return the public status payload."""
        return maintenance_status_payload(await self.get_current_window())

    async def upsert_window(
        self,
        body: MaintenanceWindowUpsert,
        *,
        source: str = "redis",
    ) -> MaintenanceWindow:
        """Persist a maintenance window in Redis."""
        now = datetime.now(UTC)
        resolved_source = (source or "redis").strip() or "redis"
        window = MaintenanceWindow(
            id=body.id or f"maintenance-{now.strftime('%Y%m%d%H%M%S')}",
            kind=body.kind,
            phase=body.phase,
            active=True,
            starts_at=body.starts_at,
            expected_ends_at=body.expected_ends_at,
            notice_before_seconds=body.notice_before_seconds,
            retry_after_seconds=body.retry_after_seconds,
            title=body.title,
            message=body.message,
            affected_services=body.affected_services,
            user_impact=body.user_impact,
            suppress_error_toasts=body.suppress_error_toasts,
            block_new_long_jobs=body.block_new_long_jobs,
            allow_operator_bypass=body.allow_operator_bypass,
            updated_at=now,
            source=resolved_source,
            metadata=body.metadata,
        )
        await self._write_redis_window(window)
        return window

    async def set_phase(self, phase: str) -> MaintenanceWindow | None:
        """Update the phase of the current window."""
        current = await self.get_current_window(include_inactive=True)
        if current is None:
            return None
        data = current.model_dump()
        data["phase"] = phase
        data["active"] = phase not in ("completed", "cancelled")
        data["updated_at"] = datetime.now(UTC)
        window = MaintenanceWindow.model_validate(data)
        if window.is_effective:
            await self._write_redis_window(window)
        else:
            await self.clear_window()
        return window

    async def clear_window(self) -> None:
        """Remove runtime maintenance state from Redis."""
        try:
            manager = await get_database_manager()
            redis = await manager.get_redis_client()
            await redis.delete(_redis_key())
        except (DatabaseConnectionError, OSError, RuntimeError, TypeError, ValueError) as exc:
            logger.debug("maintenance_redis_clear_skipped error=%s", exc)

    async def clear_window_if_owned(
        self,
        *,
        window_id: str | None = None,
        require_phase: frozenset[MaintenancePhase] | None = None,
    ) -> ClearOwnedResult:
        """Delete Redis window only when it is deploy-owned (optional id/phase match)."""
        current = await self.get_current_window(include_inactive=True)
        if current is None:
            return "skipped_missing"
        if not is_deploy_owned_source(current.source):
            return "skipped_foreign"
        expected_id = (window_id or "").strip()
        if expected_id and current.id != expected_id:
            return "skipped_id_mismatch"
        if require_phase is not None and current.phase not in require_phase:
            return "skipped_phase"
        await self.clear_window()
        return "cleared"

    async def clear_stale_deploy_window_after_api_start(self) -> ClearOwnedResult:
        """
        After a successful API boot, drop orphaned deploy windows left in active/recovering.

        Leaves admin windows and deploy warning/scheduled (mid-notice) untouched.
        """
        return await self.clear_window_if_owned(
            require_phase=frozenset(
                {
                    MaintenancePhase.ACTIVE,
                    MaintenancePhase.RECOVERING,
                }
            ),
        )

    async def _read_redis_window(self) -> MaintenanceWindow | None:
        try:
            manager = await get_database_manager()
            redis = await manager.get_redis_client()
            raw = _decode_redis_value(await redis.get(_redis_key()))
        except (DatabaseConnectionError, OSError, RuntimeError, TypeError, ValueError) as exc:
            logger.debug("maintenance_redis_read_skipped error=%s", exc)
            return None
        if not raw:
            return None
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as exc:
            logger.warning("maintenance_redis_json_invalid error=%s", exc)
            return None
        return normalize_maintenance_payload(payload, source="redis")

    def _read_static_window(self) -> MaintenanceWindow | None:
        path = _state_file_path()
        try:
            if not path.is_file():
                return None
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            logger.debug("maintenance_static_read_skipped path=%s error=%s", path, exc)
            return None
        return normalize_maintenance_payload(payload, source="static")

    async def _write_redis_window(self, window: MaintenanceWindow) -> None:
        manager = await get_database_manager()
        redis = await manager.get_redis_client()
        payload = maintenance_status_payload(window)
        await redis.setex(_redis_key(), _redis_ttl_seconds(window), json.dumps(payload, ensure_ascii=False))


_maintenance_service: MaintenanceService | None = None


def get_maintenance_service() -> MaintenanceService:
    """Return the singleton maintenance service."""
    global _maintenance_service
    if _maintenance_service is None:
        _maintenance_service = MaintenanceService()
    return _maintenance_service
