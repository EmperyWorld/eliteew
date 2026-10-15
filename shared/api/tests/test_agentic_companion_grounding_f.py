# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for Wave F4 compact companion grounding + F2 policy content bind.
# Related:
# - api/ewa_platform/agentic/companion_grounding.py
# - api/ewa_platform/agentic/policy_content_bind.py
# - api/ewa_platform/agentic/kernel/prompt_builder.py
# ---

from __future__ import annotations

from api.ewa_platform.agentic.companion_grounding import (
    WM_COMPANION_GROUNDING_KEY,
    format_compact_companion_grounding,
    working_memory_with_companion_grounding,
)
from api.ewa_platform.agentic.kernel.prompt_builder import MARKER_COMPANION_GROUNDING, ThinkPromptBuilder
from api.ewa_platform.agentic.kernel.types import AgenticContext
from api.ewa_platform.agentic.policy_content_bind import policy_json_with_created_content
from api.ewa_platform.companion.context.anchor import CONTEXT_ANCHOR_LP_KEY
from api.ewa_platform.companion.memory.hcm_store import MEMORY_NS


def test_policy_json_with_created_content_sets_unified_id() -> None:
    out = policy_json_with_created_content({"auto_accept_tasks": True}, created_content_id="uid-1")
    assert out["unified_content_id"] == "uid-1"
    assert out["auto_accept_tasks"] is True
    assert policy_json_with_created_content(None, created_content_id="  ") == {}


def test_format_compact_companion_grounding_identity_and_anchor() -> None:
    profile = {
        "learned_preferences": {
            MEMORY_NS: [
                {"kind": "fact", "content": "Brand spelling is EliteEW", "importance": 0.9},
                {"kind": "story", "content": "long story ignored", "importance": 0.9},
            ],
            CONTEXT_ANCHOR_LP_KEY: {
                "schema_version": 1,
                "core_truths": ["Prefer EliteEW not ElitEW"],
                "updated_at_iso": "2026-08-16T00:00:00Z",
            },
        }
    }
    text = format_compact_companion_grounding(profile)
    assert "EliteEW" in text
    assert "Identity:" in text or "Context_anchor" in text
    wm = working_memory_with_companion_grounding({}, profile)
    assert WM_COMPANION_GROUNDING_KEY in wm
    assert "EliteEW" in str(wm[WM_COMPANION_GROUNDING_KEY])


def test_think_prompt_emits_companion_grounding_section() -> None:
    ctx = AgenticContext(
        session={
            "id": "s1",
            "status": "planning",
            "goal_json": {"text": "Write two docs"},
            "working_memory_json": {WM_COMPANION_GROUNDING_KEY: "Identity:\n- [fact] Brand is EliteEW"},
        },
        active_nodes=[],
        tree_summary={},
        checkpoints=[],
        inbound_messages=[],
        llm_messages=[],
    )
    blob = ThinkPromptBuilder.build(ctx, system_content="sys").sections.to_user_blob()
    assert MARKER_COMPANION_GROUNDING in blob
    assert "Brand is EliteEW" in blob
