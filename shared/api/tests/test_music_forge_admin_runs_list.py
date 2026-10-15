# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Admin runs list filters and row mapping (Songs tab Wave 2).
# Related:
# - api/services/music_forge/admin_runs_list.py
# ---

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from api.services.music_forge.admin_runs_list import (
    admin_run_list_item_from_row,
    build_admin_runs_list_filters,
    result_track_name_from_payload,
    truncate_admin_run_idea,
)


def test_truncate_admin_run_idea() -> None:
    short = "hello"
    assert truncate_admin_run_idea(short) == short
    long = "x" * 130
    out = truncate_admin_run_idea(long)
    assert len(out) == 120
    assert out.endswith("...")


def test_build_admin_runs_list_filters_composes_params() -> None:
    filters, params = build_admin_runs_list_filters(
        status="failed",
        q="night",
        mode_key="turbo_xl",
        model_lane="turbo_xl",
    )
    assert "status = :status" in filters
    assert "idea ILIKE :q_pattern" in filters
    assert "normalized_input->>'mode_key' = :mode_key" in filters
    assert params["q_pattern"] == "%night%"
    assert params["mode_key"] == "turbo_xl"


def test_admin_run_list_item_from_row_maps_song_fields() -> None:
    run_id = uuid4()
    user_id = uuid4()
    now = datetime.now(UTC)
    item = admin_run_list_item_from_row(
        {
            "id": run_id,
            "user_id": user_id,
            "status": "completed",
            "idea": "Coastal night drive",
            "language": "en",
            "style_hint": "synthwave",
            "duration_seconds": 220,
            "normalized_input": {"mode_key": "turbo_xl", "model_lane": "turbo_xl"},
            "result_payload": {"name": "Night Coast"},
            "progress_current": 9,
            "progress_total": 9,
            "created_at": now,
            "updated_at": now,
        }
    )
    assert item.id == run_id
    assert item.language == "en"
    assert item.style_hint == "synthwave"
    assert item.result_track_name == "Night Coast"
    assert item.mode_key == "turbo_xl"
    assert item.progress_current == 9


def test_result_track_name_from_payload_title_fallback() -> None:
    assert result_track_name_from_payload({"title": "Alt title"}) == "Alt title"
