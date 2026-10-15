# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Sanitize companion task_run payloads when unified_content references point at deleted/missing rows (A-09).
# Invariants:
# - Schema-compatible: original id fields remain; availability tombstones are additive only.
# - Read-only guard at HTTP delivery — no DB cleanup or payload mutation in Postgres.
# Related:
# - api/ewa_platform/gateways/routers/companion_chat.py
# - documentation/product/ewa/EWA-COMPANION-CHAT-TURN-PHASES.md
# ---

from __future__ import annotations

import logging
import re
from collections.abc import Mapping, MutableMapping
from typing import Any
from uuid import UUID

logger = logging.getLogger(__name__)

CONTENT_STATUS_MISSING = "missing"
CONTENT_STATUS_AVAILABLE = "available"
CONTENT_AVAILABILITY_KEY = "unified_content_availability"

_PRIMARY_CONTENT_ID_KEYS = (
    "unified_content_id",
    "unifiedContentId",
    "content_id",
    "contentId",
)
_SECONDARY_CONTENT_ID_KEYS = (
    "source_unified_content_id",
    "source_content_id",
    "created_unified_content_id",
)
_ALL_CONTENT_ID_KEYS = _PRIMARY_CONTENT_ID_KEYS + _SECONDARY_CONTENT_ID_KEYS

_DOWNLOAD_PATH_RE = re.compile(r"/api/v1/content/([0-9a-f-]{36})/download", re.I)


def _as_dict(raw: Any) -> dict[str, Any]:
    return dict(raw) if isinstance(raw, Mapping) else {}


def _normalize_uuid(raw: Any) -> str | None:
    text = str(raw or "").strip()
    if not text:
        return None
    try:
        return str(UUID(text))
    except ValueError:
        return None


def collect_unified_content_ids_from_mapping(payload: Mapping[str, Any]) -> dict[str, str]:
    """Return ``field_name -> normalized uuid`` for known content-id keys in one mapping."""

    found: dict[str, str] = {}
    for key in _ALL_CONTENT_ID_KEYS:
        cid = _normalize_uuid(payload.get(key))
        if cid:
            found[key] = cid
    return found


def collect_unified_content_ids_from_task_run(run: Mapping[str, Any]) -> dict[str, str]:
    """Collect content ids from ``result_payload`` and step ``output_payload`` rows."""

    merged: dict[str, str] = {}
    merged.update(collect_unified_content_ids_from_mapping(_as_dict(run.get("result_payload"))))
    steps_raw = run.get("steps")
    if isinstance(steps_raw, list):
        for step in steps_raw:
            if not isinstance(step, Mapping):
                continue
            merged.update(collect_unified_content_ids_from_mapping(_as_dict(step.get("output_payload"))))
    return merged


async def fetch_existing_unified_content_ids(pool: Any, content_ids: set[str]) -> set[str]:  # noqa: ANN401
    if not content_ids or pool is None:
        return set()
    uuid_list = sorted(content_ids)
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id::text AS id
            FROM unified_content
            WHERE id = ANY($1::uuid[])
              AND deleted_at IS NULL
            """,
            uuid_list,
        )
    return {str(row["id"]) for row in rows}


def _status_field_for(key: str) -> str:
    return f"{key}_status"


def _mark_missing_reference(payload: MutableMapping[str, Any], field: str, content_id: str) -> None:
    payload[_status_field_for(field)] = CONTENT_STATUS_MISSING
    if field in _PRIMARY_CONTENT_ID_KEYS:
        payload[CONTENT_AVAILABILITY_KEY] = CONTENT_STATUS_MISSING
    image_url = str(payload.get("image_url") or "").strip()
    if image_url:
        match = _DOWNLOAD_PATH_RE.search(image_url)
        if match and match.group(1).lower() == content_id.lower():
            payload["image_url"] = None


def _mark_available_primary(payload: MutableMapping[str, Any]) -> None:
    if CONTENT_AVAILABILITY_KEY not in payload:
        payload[CONTENT_AVAILABILITY_KEY] = CONTENT_STATUS_AVAILABLE


def sanitize_mapping_content_references(
    payload: Mapping[str, Any],
    *,
    missing_ids: set[str],
) -> dict[str, Any]:
    """Return a copy of ``payload`` with tombstone fields for missing unified_content ids."""

    if not missing_ids:
        out = dict(payload)
        if collect_unified_content_ids_from_mapping(out):
            _mark_available_primary(out)
        return out

    out: dict[str, Any] = dict(payload)
    for field, cid in collect_unified_content_ids_from_mapping(out).items():
        if cid in missing_ids:
            _mark_missing_reference(out, field, cid)
        elif field in _PRIMARY_CONTENT_ID_KEYS:
            _mark_available_primary(out)
    return out


def sanitize_task_run_content_references_sync(
    run: Mapping[str, Any],
    *,
    missing_ids: set[str],
) -> dict[str, Any]:
    """Pure sanitizer used by HTTP layer after batch existence lookup."""

    out = dict(run)
    result_payload = sanitize_mapping_content_references(_as_dict(run.get("result_payload")), missing_ids=missing_ids)
    out["result_payload"] = result_payload

    steps_raw = run.get("steps")
    if not isinstance(steps_raw, list):
        return out

    sanitized_steps: list[Any] = []
    for step in steps_raw:
        if not isinstance(step, Mapping):
            sanitized_steps.append(step)
            continue
        step_out = dict(step)
        step_out["output_payload"] = sanitize_mapping_content_references(
            _as_dict(step.get("output_payload")),
            missing_ids=missing_ids,
        )
        sanitized_steps.append(step_out)
    out["steps"] = sanitized_steps
    return out


async def sanitize_task_run_content_references(
    run: Mapping[str, Any],
    *,
    content_pool: Any | None,  # noqa: ANN401
) -> dict[str, Any]:
    """Verify unified_content ids against catalogue Postgres; tombstone missing refs."""

    if content_pool is None:
        return dict(run)

    id_by_field = collect_unified_content_ids_from_task_run(run)
    if not id_by_field:
        return dict(run)

    unique_ids = set(id_by_field.values())
    try:
        existing = await fetch_existing_unified_content_ids(content_pool, unique_ids)
    except Exception as exc:
        logger.debug(
            "[STEP] companion_content_guard_skip err=%s",
            exc,
            exc_info=True,
        )
        return dict(run)

    missing = unique_ids - existing
    if not missing:
        return sanitize_task_run_content_references_sync(run, missing_ids=set())

    return sanitize_task_run_content_references_sync(run, missing_ids=missing)


async def sanitize_task_runs_content_references(
    runs: list[Mapping[str, Any]],
    *,
    content_pool: Any | None,  # noqa: ANN401
) -> list[dict[str, Any]]:
    if not runs:
        return []
    if content_pool is None:
        return [dict(run) for run in runs]

    merged_ids: dict[str, str] = {}
    for run in runs:
        merged_ids.update(collect_unified_content_ids_from_task_run(run))
    if not merged_ids:
        return [dict(run) for run in runs]

    unique_ids = set(merged_ids.values())
    try:
        existing = await fetch_existing_unified_content_ids(content_pool, unique_ids)
    except Exception as exc:
        logger.debug(
            "[STEP] companion_content_guard_batch_skip err=%s",
            exc,
            exc_info=True,
        )
        return [dict(run) for run in runs]

    missing = unique_ids - existing
    return [sanitize_task_run_content_references_sync(run, missing_ids=missing) for run in runs]


__all__ = (
    "CONTENT_AVAILABILITY_KEY",
    "CONTENT_STATUS_AVAILABLE",
    "CONTENT_STATUS_MISSING",
    "collect_unified_content_ids_from_task_run",
    "sanitize_task_run_content_references",
    "sanitize_task_run_content_references_sync",
    "sanitize_task_runs_content_references",
)
