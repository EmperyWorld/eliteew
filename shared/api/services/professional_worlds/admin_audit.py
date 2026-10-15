# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Audit logging mixin for Professional Worlds admin mutations.
# Invariants:
# - Admin mutations are audit-logged with before/after payloads.
# Related:
# - api/services/professional_worlds/admin_service.py
# ---

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.services.professional_worlds.admin_common import _json, _rows


class ProfessionalWorldsAdminAuditMixin:
    """Audit trail helpers for admin configuration changes."""

    db: AsyncSession

    async def _audit(
        self,
        *,
        admin_user_id: UUID | None,
        action: str,
        entity_type: str,
        entity_key: str,
        before_data: dict[str, Any] | None,
        after_data: dict[str, Any] | None,
        risk_level: str | None = None,
    ) -> None:
        await self.db.execute(
            text(
                """
                INSERT INTO professional_admin_audit_log (
                    admin_user_id, action, entity_type, entity_key, before_data, after_data, risk_level
                )
                VALUES (
                    :admin_user_id, :action, :entity_type, :entity_key,
                    CAST(:before_data AS jsonb), CAST(:after_data AS jsonb), :risk_level
                )
                """
            ),
            {
                "admin_user_id": admin_user_id,
                "action": action,
                "entity_type": entity_type,
                "entity_key": entity_key,
                "before_data": _json(before_data or {}),
                "after_data": _json(after_data or {}),
                "risk_level": risk_level,
            },
        )

    async def list_audit(
        self,
        entity_type: str | None = None,
        risk_level: str | None = None,
        admin_user_id: UUID | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """List admin audit events."""
        clauses: list[str] = []
        params: dict[str, Any] = {"limit": limit}
        if entity_type:
            clauses.append("entity_type = :entity_type")
            params["entity_type"] = entity_type
        if risk_level:
            clauses.append("risk_level = :risk_level")
            params["risk_level"] = risk_level
        if admin_user_id:
            clauses.append("admin_user_id = :admin_user_id")
            params["admin_user_id"] = admin_user_id
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        result = await self.db.execute(
            text(
                f"""
                SELECT id, admin_user_id, action, entity_type, entity_key, risk_level, before_data, after_data, created_at
                FROM professional_admin_audit_log
                {where}
                ORDER BY created_at DESC
                LIMIT :limit
                """
            ),
            params,
        )
        return _rows(list(result.mappings().all()))
