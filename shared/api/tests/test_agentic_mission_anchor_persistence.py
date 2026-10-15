# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Phase R1 regression — mission anchor survives replan, tool errors, and Think prompt trimming.
# Related:
# - api/ewa_platform/agentic/goal_json.py
# - api/ewa_platform/agentic/mission_anchor.py
# ---

from __future__ import annotations

import copy
from pathlib import Path
from typing import Any

from api.ewa_platform.agentic.goal_json import (
    anchor_from_goal_json,
    build_goal_json_v2,
    merge_goal_json_preserving_anchor,
    mission_anchor_from_goal_json,
)
from api.ewa_platform.agentic.kernel.context_budget import trim_prompt_sections
from api.ewa_platform.agentic.kernel.prompt_builder import (
    MARKER_MISSION_ANCHOR,
    ThinkPromptBuilder,
)
from api.ewa_platform.agentic.kernel.types import AgenticContext
from api.ewa_platform.agentic.mission_anchor import extract_mission_anchor

_FIXTURE = Path(__file__).resolve().parent / "fixtures" / "irina_acid_prompt.txt"


def _irina_prompt() -> str:
    return _FIXTURE.read_text(encoding="utf-8")


def test_extract_mission_anchor_from_irina_prompt() -> None:
    anchor = extract_mission_anchor(_irina_prompt())

    assert anchor.display_name == "Ирина"
    assert anchor.time_box == "2 ч"
    assert len(anchor.objectives) >= 3
    assert any("дорожн" in obj.lower() or "eliteew" in obj.lower() for obj in anchor.objectives)
    assert any("критическ" in c.lower() for c in anchor.constraints)


def test_build_goal_json_v2_has_immutable_anchor() -> None:
    goal = build_goal_json_v2(_irina_prompt())

    assert goal["schema_version"] == 2
    assert goal["text"]
    anchor = anchor_from_goal_json(goal)
    assert anchor is not None
    assert anchor["immutable"] is True
    assert anchor["display_name"] == "Ирина"
    assert anchor["time_box"] == "2 ч"


def test_merge_goal_json_preserving_anchor_blocks_identity_overwrite() -> None:
    goal = build_goal_json_v2(_irina_prompt())
    original = copy.deepcopy(goal["anchor"])

    merged = merge_goal_json_preserving_anchor(
        goal,
        {
            "text": "completely new goal text from replan hallucination",
            "anchor": {
                "display_name": "NotIrina",
                "objectives": ["erase mission"],
                "time_box": "99 ч",
                "constraints": [],
                "immutable": True,
            },
        },
    )

    assert merged["anchor"] == original
    assert merged["text"] == "completely new goal text from replan hallucination"


def test_mission_anchor_persists_across_simulated_replan_and_tool_errors() -> None:
    goal_json = build_goal_json_v2(_irina_prompt())
    original_anchor = copy.deepcopy(goal_json["anchor"])

    session: dict[str, Any] = {
        "id": "sess-r1",
        "principal_id": "p-1",
        "status": "executing",
        "session_revision": 1,
        "goal_json": goal_json,
        "plan_summary": "перестраиваю план",
        "policy_json": {},
        "working_memory_json": {
            "active_slice": {
                "acts": [{"tool": "file_create", "status": "error", "summary": "tool failed"}],
                "last_condense_seq": 0,
            },
            "circuit_breaker": {"replan_streak": 3},
        },
    }

    for revision in (5, 42, 100):
        session["session_revision"] = revision
        session["status"] = "replanning" if revision % 2 == 0 else "executing"
        session["plan_summary"] = f"replan wave {revision}"
        session["working_memory_json"]["active_slice"]["acts"].append(
            {"tool": "catalog_list", "status": "error", "summary": f"fail@{revision}"},
        )

        assert anchor_from_goal_json(session["goal_json"]) == original_anchor
        rebuilt = mission_anchor_from_goal_json(session["goal_json"])
        assert rebuilt is not None
        assert rebuilt.display_name == "Ирина"
        assert rebuilt.time_box == "2 ч"

        ctx = AgenticContext(
            session=session,
            active_nodes=[{"id": f"n-{revision}", "status": "pending", "tool_name": "catalog_list"}],
            tree_summary={"pending": 1},
            checkpoints=[{"seq": revision, "kind": "act", "summary": "x" * 400}],
            inbound_messages=[],
            llm_messages=[],
        )
        prompt = ThinkPromptBuilder.build(ctx, system_content="sys")
        blob = prompt.sections.to_user_blob()
        assert MARKER_MISSION_ANCHOR in blob
        assert "Identity: Ирина" in blob
        assert "Time box: 2 ч" in blob

        trimmed, meta = trim_prompt_sections(prompt.sections, max_user_utf8=2500)
        trimmed_blob = trimmed.to_user_blob()
        assert "Identity: Ирина" in trimmed_blob
        assert meta["preserved"]
        assert "mission_anchor" in meta["preserved"]


def test_think_prompt_includes_anchor_on_revision_100() -> None:
    goal_json = build_goal_json_v2(_irina_prompt())
    session = {
        "id": "sess-r1",
        "status": "replanning",
        "session_revision": 100,
        "goal_json": goal_json,
        "plan_summary": "wave 100",
        "policy_json": {},
    }
    ctx = AgenticContext(
        session=session,
        active_nodes=[],
        tree_summary={},
        checkpoints=[],
        inbound_messages=[],
        llm_messages=[],
    )
    blob = ThinkPromptBuilder.build(ctx, system_content="sys").sections.to_user_blob()

    assert "Mission anchor (immutable):" in blob
    assert "Identity: Ирина" in blob
    assert goal_json["text"][:40] in blob
