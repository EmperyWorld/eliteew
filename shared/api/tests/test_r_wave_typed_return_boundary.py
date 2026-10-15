# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock B6 follow-up R1 boundary helpers: companion profile shapers return Pydantic Outs,
# not bare dicts (basedpyright reportReturnType hygiene).
# Invariants:
# - _shape_profile / _shape_story_rows return CompanionProfileOut / list[CompanionStoryRowOut].
# Related:
# - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md §B6 follow-up
# - api/ewa_platform/gateways/routers/companion_profile.py
# ---
from __future__ import annotations

from api.ewa_platform.gateways.routers.companion_profile import _shape_profile, _shape_story_rows
from api.ewa_platform.schemas.pydantic.companion import CompanionProfileOut, CompanionStoryRowOut


def test_shape_profile_returns_companion_profile_out() -> None:
    row = {
        "principal_id": "user-1",
        "schema_version": "companion_profile_v1",
        "seed_persona_id": "mela",
        "baseline": {},
        "learned_preferences": {},
        "style_parameters": {},
        "companion_revision": 1,
        "updated_at": "2026-08-06T00:00:00Z",
    }
    out = _shape_profile(row)
    assert isinstance(out, CompanionProfileOut)
    assert out.principal_id == "user-1"
    assert out.seed_persona_id == "mela"
    assert isinstance(out.memory_display, list)


def test_shape_story_rows_returns_story_out_list() -> None:
    memory = [
        {
            "kind": "story",
            "content": "First day",
            "importance": 0.5,
            "valence": 0.1,
            "since_ts": "2026-01-01T00:00:00Z",
            "last_used_ts": "2026-01-02T00:00:00Z",
            "content_hash": "abc",
        },
        {"kind": "fact", "content": "ignored"},
    ]
    rows = _shape_story_rows(memory)
    assert len(rows) == 1
    assert isinstance(rows[0], CompanionStoryRowOut)
    assert rows[0].content == "First day"
    assert rows[0].content_hash == "abc"


def test_marketing_cabinet_has_no_builtin_model_validate_wraps() -> None:
    """Codemod must not wrap ``-> object`` / ``-> str`` validators as ``object.model_validate``."""
    from pathlib import Path

    root = Path(__file__).resolve().parents[1] / "routers" / "marketing_cabinet"
    banned = ("object.model_validate", "str.model_validate", "int.model_validate", "bool.model_validate")
    offenders: list[str] = []
    for path in sorted(root.glob("*.py")):
        text = path.read_text(encoding="utf-8")
        for token in banned:
            if token in text:
                offenders.append(f"{path.name}:{token}")
    assert offenders == []
