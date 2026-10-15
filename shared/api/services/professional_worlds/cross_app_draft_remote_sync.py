# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Resolve Professional Worlds cross-app draft lifecycle from client reports and destination remote state.
# Invariants:
# - published/cancelled are terminal; refresh never downgrades lifecycle.
# - Remote polling uses explicit remote_tracking ids only — no implicit publish inference.
# Related:
# - api/services/professional_worlds/cross_app_drafts_service.py
# - documentation/product/PROFESSIONAL-WORLDS.md
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from uuid import UUID

from sqlalchemy import select  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.models.desktop import UserSiteInstance
from api.models.ewrp import EwrpJob
from api.services.professional_worlds.cross_app_draft_constants import (
    DRAFT_LIFECYCLE_CANCELLED,
    DRAFT_LIFECYCLE_CREATED,
    DRAFT_LIFECYCLE_OPENED,
    DRAFT_LIFECYCLE_PUBLISHED,
    DRAFT_LIFECYCLE_STALE,
    DRAFT_LIFECYCLE_UPDATED,
)

REMOTE_TRACKING_KEY = "remote_tracking"

TERMINAL_LIFECYCLE_STATES: frozenset[str] = frozenset(
    {
        DRAFT_LIFECYCLE_PUBLISHED,
        DRAFT_LIFECYCLE_CANCELLED,
    }
)

CLIENT_REPORTABLE_STATES: frozenset[str] = frozenset(
    {
        DRAFT_LIFECYCLE_OPENED,
        DRAFT_LIFECYCLE_UPDATED,
        DRAFT_LIFECYCLE_PUBLISHED,
        DRAFT_LIFECYCLE_CANCELLED,
    }
)


def read_remote_tracking(external_ref: Mapping[str, Any] | None) -> dict[str, Any]:
    if not external_ref:
        return {}
    raw = external_ref.get(REMOTE_TRACKING_KEY)
    return dict(raw) if isinstance(raw, dict) else {}


def merge_remote_tracking(
    external_ref: Mapping[str, Any] | None,
    patch: Mapping[str, Any] | None,
) -> dict[str, Any]:
    merged = dict(external_ref or {})
    if not patch:
        return merged
    current = read_remote_tracking(merged)
    for key, value in patch.items():
        if value is None:
            continue
        text = str(value).strip()
        if text:
            current[key] = text
    merged[REMOTE_TRACKING_KEY] = current
    return merged


def remote_tracking_patch(
    external_ref: Mapping[str, Any] | None, patch: Mapping[str, Any] | None
) -> dict[str, Any] | None:
    if not patch:
        return None
    merged = merge_remote_tracking(external_ref, patch)
    tracking = read_remote_tracking(merged)
    return {REMOTE_TRACKING_KEY: tracking} if tracking else None


def map_ewrp_job_status(status: str | None) -> str | None:
    normalized = (status or "").strip().lower()
    if normalized == "completed":
        return DRAFT_LIFECYCLE_PUBLISHED
    if normalized in {"failed", "cancelled"}:
        return DRAFT_LIFECYCLE_CANCELLED
    if normalized in {
        "queued",
        "generating_content",
        "generating_images",
        "building_pdf",
    }:
        return DRAFT_LIFECYCLE_UPDATED
    return None


def map_site_publication_state(publication_state: str | None) -> str | None:
    if (publication_state or "").strip().lower() == "open":
        return DRAFT_LIFECYCLE_PUBLISHED
    return None


def normalize_client_report_lifecycle(current: str, requested: str) -> str | None:
    req = (requested or "").strip().lower()
    cur = (current or DRAFT_LIFECYCLE_CREATED).strip().lower()
    if req not in CLIENT_REPORTABLE_STATES:
        return None
    if cur in TERMINAL_LIFECYCLE_STATES:
        return None
    if req in TERMINAL_LIFECYCLE_STATES:
        return req
    if req == DRAFT_LIFECYCLE_OPENED:
        if cur == DRAFT_LIFECYCLE_CREATED:
            return DRAFT_LIFECYCLE_OPENED
        return None
    if req == DRAFT_LIFECYCLE_UPDATED:
        if cur in {
            DRAFT_LIFECYCLE_CREATED,
            DRAFT_LIFECYCLE_OPENED,
            DRAFT_LIFECYCLE_UPDATED,
            DRAFT_LIFECYCLE_STALE,
        }:
            return DRAFT_LIFECYCLE_UPDATED if cur != DRAFT_LIFECYCLE_UPDATED else None
        return None
    return req if req != cur else None


async def fetch_ewrp_job_status(
    db: AsyncSession,
    *,
    user_id: UUID,
    job_id: str,
) -> str | None:
    try:
        parsed = UUID(str(job_id).strip())
    except TypeError, ValueError:
        return None
    result = await db.execute(select(EwrpJob.status).where(EwrpJob.id == parsed, EwrpJob.user_id == user_id))
    row = result.scalar_one_or_none()
    return str(row) if row is not None else None


async def fetch_user_site_publication_state(
    db: AsyncSession,
    *,
    user_id: UUID,
    instance_id: str,
) -> str | None:
    try:
        parsed = UUID(str(instance_id).strip())
    except TypeError, ValueError:
        return None
    result = await db.execute(
        select(UserSiteInstance.publication_state).where(
            UserSiteInstance.id == parsed,
            UserSiteInstance.user_id == user_id,
        )
    )
    row = result.scalar_one_or_none()
    return str(row) if row is not None else None


async def resolve_remote_lifecycle_from_tracking(
    db: AsyncSession,
    user_id: UUID,
    link_row: Mapping[str, Any],
) -> str | None:
    current_state = str(link_row.get("lifecycle_state") or DRAFT_LIFECYCLE_CREATED)
    if current_state in TERMINAL_LIFECYCLE_STATES:
        return None

    tracking = read_remote_tracking(dict(link_row.get("external_ref") or {}))

    ewrp_job_id = tracking.get("ewrp_job_id")
    if ewrp_job_id:
        status = await fetch_ewrp_job_status(db, user_id=user_id, job_id=str(ewrp_job_id))
        mapped = map_ewrp_job_status(status)
        if mapped and mapped != current_state:
            return mapped

    site_instance_id = tracking.get("site_instance_id")
    if site_instance_id:
        publication = await fetch_user_site_publication_state(
            db,
            user_id=user_id,
            instance_id=str(site_instance_id),
        )
        mapped = map_site_publication_state(publication)
        if mapped and mapped != current_state:
            return mapped

    return None
