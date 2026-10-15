# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Persist and refresh cross-app draft link rows keyed by artifacts & destinations; staleness checks vs property digest.
# Invariants:
# - Rows scoped by authenticated user_id; integrations never implied as sent/published solely by inserting a row.
# Related:
# - api/models/professional_worlds.py ProfessionalCrossAppDraftLink
# - api/services/professional_worlds/cross_app_draft_constants.py
# ---

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping
from typing import Any
from uuid import UUID

from sqlalchemy import text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.services.professional_worlds.cross_app_draft_constants import (
    CANONICAL_DRAFT_LIFECYCLE_STATES,
    DRAFT_LIFECYCLE_CREATED,
    DRAFT_LIFECYCLE_OPENED,
    DRAFT_LIFECYCLE_UPDATED,
)


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str, sort_keys=True)


def compute_property_digest(property_row: Mapping[str, Any]) -> str:
    """Stable digest for realtor property rows to highlight stale drafts after edits."""
    keys = [
        "title",
        "price",
        "area_m2",
        "deal_type",
        "property_type",
        "city",
        "address",
        "status",
        "facts",
        "jtbd_context",
    ]
    snap = {k: property_row.get(k) for k in keys}
    blob = _json(snap).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()


class ProfessionalCrossAppDraftsService:
    """CRUD-lite for professional_cross_app_draft_links."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_link_row(
        self,
        *,
        user_id: UUID,
        draft_kind: str,
        artifact_id: UUID,
        vertical_slug: str,
        external_ref: dict[str, Any],
        source_digest: str | None = None,
    ) -> dict[str, Any]:
        res = await self.db.execute(
            text(
                """
                INSERT INTO professional_cross_app_draft_links (
                    user_id, vertical_slug, draft_kind, artifact_id,
                    external_ref, lifecycle_state, source_digest
                )
                VALUES (
                    :user_id, :vertical_slug, :draft_kind, :artifact_id,
                    CAST(:external_ref AS jsonb), :lifecycle_state, :source_digest
                )
                RETURNING id, user_id, vertical_slug, draft_kind, artifact_id,
                          external_ref, lifecycle_state, stale_reason, source_digest,
                          created_at, updated_at
                """
            ),
            {
                "user_id": user_id,
                "vertical_slug": vertical_slug,
                "draft_kind": draft_kind[:80],
                "artifact_id": artifact_id,
                "external_ref": _json(external_ref),
                "lifecycle_state": DRAFT_LIFECYCLE_CREATED,
                "source_digest": source_digest,
            },
        )
        await self.db.commit()
        return dict(res.mappings().one())

    async def list_links_for_user(
        self,
        user_id: UUID,
        *,
        artifact_id: UUID | None = None,
        vertical_slug: str | None = None,
    ) -> list[dict[str, Any]]:
        filt = ""
        params: dict[str, Any] = {"user_id": user_id}
        if artifact_id is not None:
            filt += " AND artifact_id = :artifact_id "
            params["artifact_id"] = artifact_id
        if vertical_slug is not None:
            filt += " AND vertical_slug = :vertical_slug "
            params["vertical_slug"] = vertical_slug
        res = await self.db.execute(
            text(
                f"""
                SELECT id, user_id, vertical_slug, draft_kind, artifact_id,
                       external_ref, lifecycle_state, stale_reason, source_digest,
                       created_at, updated_at
                FROM professional_cross_app_draft_links
                WHERE user_id = :user_id {filt}
                ORDER BY updated_at DESC
                LIMIT 200
                """
            ),
            params,
        )
        return [dict(row) for row in res.mappings().all()]

    async def get_link(self, user_id: UUID, link_id: UUID) -> dict[str, Any] | None:
        res = await self.db.execute(
            text(
                """
                SELECT id, user_id, vertical_slug, draft_kind, artifact_id,
                       external_ref, lifecycle_state, stale_reason, source_digest,
                       created_at, updated_at
                FROM professional_cross_app_draft_links
                WHERE id = :lid AND user_id = :uid
                """
            ),
            {"lid": link_id, "uid": user_id},
        )
        row = res.mappings().one_or_none()
        return dict(row) if row else None

    async def mark_lifecycle_state(
        self,
        user_id: UUID,
        link_id: UUID,
        *,
        lifecycle_state: str,
        stale_reason: str | None = None,
        merge_external_patch: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        if lifecycle_state not in CANONICAL_DRAFT_LIFECYCLE_STATES:
            raise ValueError("Unknown lifecycle_state")
        current = await self.get_link(user_id, link_id)
        if current is None:
            return None
        ext_ref = dict(current.get("external_ref") or {})
        if merge_external_patch:
            ext_ref.update(merge_external_patch)
        res = await self.db.execute(
            text(
                """
                UPDATE professional_cross_app_draft_links
                SET lifecycle_state = :st,
                    stale_reason = COALESCE(:reason, stale_reason),
                    external_ref = CAST(:ext AS jsonb),
                    updated_at = now()
                WHERE id = :lid AND user_id = :uid
                RETURNING id, user_id, vertical_slug, draft_kind, artifact_id,
                          external_ref, lifecycle_state, stale_reason, source_digest,
                          created_at, updated_at
                """
            ),
            {
                "st": lifecycle_state,
                "reason": stale_reason,
                "ext": _json(ext_ref),
                "lid": link_id,
                "uid": user_id,
            },
        )
        await self.db.commit()
        row = res.mappings().one_or_none()
        return dict(row) if row else None

    async def refresh_link_status_placeholder(self, user_id: UUID, link_id: UUID) -> dict[str, Any] | None:
        """Bump lifecycle to opened/updated when no remote evidence is available."""
        current = await self.get_link(user_id, link_id)
        if current is None:
            return None
        if current.get("lifecycle_state") == DRAFT_LIFECYCLE_CREATED:
            return await self.mark_lifecycle_state(user_id, link_id, lifecycle_state=DRAFT_LIFECYCLE_OPENED)
        return await self.mark_lifecycle_state(user_id, link_id, lifecycle_state=DRAFT_LIFECYCLE_UPDATED)

    async def refresh_link_with_remote_sync(self, user_id: UUID, link_id: UUID) -> dict[str, Any] | None:
        """Poll destination remote state, then fall back to bookkeeping bump."""
        from api.services.professional_worlds.cross_app_draft_remote_sync import (
            TERMINAL_LIFECYCLE_STATES,
            resolve_remote_lifecycle_from_tracking,
        )

        current = await self.get_link(user_id, link_id)
        if current is None:
            return None

        remote_state = await resolve_remote_lifecycle_from_tracking(self.db, user_id, current)
        if remote_state:
            updated = await self.mark_lifecycle_state(
                user_id,
                link_id,
                lifecycle_state=remote_state,
            )
            if updated and remote_state in TERMINAL_LIFECYCLE_STATES:
                return updated
            current = updated or current

        current_state = str(current.get("lifecycle_state") or DRAFT_LIFECYCLE_CREATED)
        if current_state in TERMINAL_LIFECYCLE_STATES:
            return current

        return await self.refresh_link_status_placeholder(user_id, link_id)

    async def report_client_lifecycle(
        self,
        user_id: UUID,
        link_id: UUID,
        *,
        lifecycle_state: str,
        remote_tracking: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        """Apply destination-app lifecycle report and optional remote_tracking patch."""
        from api.services.professional_worlds.cross_app_draft_remote_sync import (
            normalize_client_report_lifecycle,
            remote_tracking_patch,
        )

        current = await self.get_link(user_id, link_id)
        if current is None:
            return None

        ext_ref = dict(current.get("external_ref") or {})
        tracking_merge = remote_tracking_patch(ext_ref, remote_tracking)
        current_state = str(current.get("lifecycle_state") or DRAFT_LIFECYCLE_CREATED)
        next_state = normalize_client_report_lifecycle(current_state, lifecycle_state)

        if next_state is None and tracking_merge is None:
            return current

        target_state = next_state or current_state
        return await self.mark_lifecycle_state(
            user_id,
            link_id,
            lifecycle_state=target_state,
            merge_external_patch=tracking_merge,
        )

    async def recompute_staleness_vs_property_row(
        self,
        *,
        link_row: dict[str, Any],
        property_row: dict[str, Any],
    ) -> tuple[bool, str | None]:
        """Return (`is_stale`, reason) comparing stored digest vs current canonical digest."""
        stored = link_row.get("source_digest")
        if not stored:
            return False, None
        current_d = compute_property_digest(property_row)
        if current_d != stored:
            return True, "Property facts changed after draft creation"
        return False, None
