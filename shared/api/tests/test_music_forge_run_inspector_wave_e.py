# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave E lock: run_out_from_rows exposes config provenance for Run Inspector.
# Invariants:
# - config_revision_id / config_version / config_generation mapped when present.
# Related:
# - api/services/music_forge/pipeline_repository.py
# ---

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from api.services.music_forge.pipeline_repository import run_out_from_rows


def test_run_out_from_rows_includes_config_provenance() -> None:
    revision_id = uuid4()
    run_id = uuid4()
    now = datetime.now(UTC)
    out = run_out_from_rows(
        {
            "id": run_id,
            "status": "failed",
            "idea": "x",
            "language": "en",
            "style_hint": None,
            "constraints": None,
            "duration_seconds": 180,
            "progress_current": 2,
            "progress_total": 9,
            "normalized_input": {"mode_key": "turbo_xl", "model_lane": "turbo_xl"},
            "song_blueprint": {},
            "lyrics_payload": {},
            "style_capsule": {},
            "render_payload": {},
            "result_payload": {},
            "error_payload": {"message": "boom", "stage": "audio_render"},
            "content_id": None,
            "ugs_request_id": None,
            "config_revision_id": revision_id,
            "config_version": "draft-v1",
            "config_generation": 7,
            "started_at": now,
            "completed_at": now,
            "cancelled_at": None,
            "created_at": now,
            "updated_at": now,
        },
        [
            {
                "id": uuid4(),
                "step_index": 1,
                "step_kind": "intent_normalize",
                "title": "normalize",
                "status": "completed",
                "input_payload": {},
                "output_payload": {},
                "error_payload": {},
                "started_at": now,
                "completed_at": now,
                "duration_ms": 10,
            }
        ],
    )
    assert out.config_revision_id == revision_id
    assert out.config_version == "draft-v1"
    assert out.config_generation == 7
    assert out.normalized_input["mode_key"] == "turbo_xl"
    assert len(out.steps) == 1
    assert out.error_payload["message"] == "boom"
