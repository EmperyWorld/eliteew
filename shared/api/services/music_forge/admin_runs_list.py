# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pure helpers for MusicForge admin runs list (filters + row mapping).
# Invariants:
# - SQL fragments use named params only; no string interpolation of user input.
# Related:
# - api/routers/music_forge_admin.py
# - api/schemas/music_forge_admin.py
# ---
"""Admin MusicForge runs list helpers."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from uuid import UUID

from api.schemas.music_forge_admin import MusicForgeAdminRunListItem

_IDEA_TRUNCATE_LEN = 120
_SEARCH_MAX_LEN = 120


def truncate_admin_run_idea(idea: str, *, max_len: int = _IDEA_TRUNCATE_LEN) -> str:
    text = (idea or "").strip()
    if len(text) <= max_len:
        return text
    return f"{text[: max_len - 3]}..."


def result_track_name_from_payload(payload: Mapping[str, Any] | None) -> str | None:
    if not payload:
        return None
    for key in ("name", "title"):
        raw = payload.get(key)
        if isinstance(raw, str) and raw.strip():
            return raw.strip()
    return None


def admin_run_list_item_from_row(row: Mapping[str, Any]) -> MusicForgeAdminRunListItem:
    normalized = dict(row.get("normalized_input") or {})
    result_payload = dict(row.get("result_payload") or {})
    idea = truncate_admin_run_idea(str(row.get("idea") or ""))
    style_hint = row.get("style_hint")
    language = row.get("language")
    progress_current = row.get("progress_current")
    progress_total = row.get("progress_total")
    return MusicForgeAdminRunListItem(
        id=UUID(str(row["id"])),
        user_id=UUID(str(row["user_id"])),
        status=str(row["status"]),  # type: ignore[arg-type]
        idea=idea,
        duration_seconds=int(row.get("duration_seconds") or 0),
        language=str(language) if language else None,
        style_hint=str(style_hint).strip() if isinstance(style_hint, str) and style_hint.strip() else None,
        result_track_name=result_track_name_from_payload(result_payload),
        progress_current=int(progress_current) if progress_current is not None else None,
        progress_total=int(progress_total) if progress_total is not None else None,
        model_lane=str(normalized.get("model_lane")) if normalized.get("model_lane") else None,
        mode_key=str(normalized.get("mode_key")) if normalized.get("mode_key") else None,
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def build_admin_runs_list_filters(
    *,
    status: str | None = None,
    q: str | None = None,
    mode_key: str | None = None,
    model_lane: str | None = None,
) -> tuple[list[str], dict[str, Any]]:
    """Return SQL WHERE fragments and bind params for admin runs list."""
    filters = ["1=1"]
    params: dict[str, Any] = {}
    if status and status.strip():
        filters.append("status = :status")
        params["status"] = status.strip()
    if q and q.strip():
        needle = q.strip()[:_SEARCH_MAX_LEN]
        filters.append("idea ILIKE :q_pattern")
        params["q_pattern"] = f"%{needle}%"
    if mode_key and mode_key.strip():
        filters.append("normalized_input->>'mode_key' = :mode_key")
        params["mode_key"] = mode_key.strip()
    if model_lane and model_lane.strip():
        filters.append("normalized_input->>'model_lane' = :model_lane")
        params["model_lane"] = model_lane.strip()
    return filters, params
