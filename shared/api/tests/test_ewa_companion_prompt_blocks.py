# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for companion prompt-block canon, loader fallback, and tool-catalog markdown.
# ---
"""Prompt blocks unit tests (no EWA PG required)."""

from __future__ import annotations

from api.ewa_platform.companion.prompt_blocks.canon import PROMPT_BLOCK_CANON, list_prompt_block_canon
from api.ewa_platform.companion.prompt_blocks.service import clear_prompt_block_cache, get_prompt_block
from api.ewa_platform.companion.prompt_blocks.tool_catalog_md import format_server_tool_catalog_markdown
from api.ewa_platform.companion.turn.phases.main_llm_prepare import build_companion_system_prompt

_WAVE3_REQUIRED_KEYS = frozenset(
    {
        "sidecar.trust_classify",
        "sidecar.arlika_wrath_classify",
        "workflow.evolution_summary",
        "workflow.anchor_compose",
        "workflow.chat_condense",
        "workflow.doceditor_translate",
        "workflow.social_post.identity",
        "workflow.social_post.format_rules",
        "workflow.reflect_week.task",
        "workflow.reflect_week.output_rules_ru",
        "workflow.reflect_week.output_rules_en",
    }
)

_WIRED_MODULES_MUST_CALL_LOADER = (
    "ewa_platform/companion/sidecar/trust_classify.py",
    "ewa_platform/companion/sidecar/arlika_wrath_classify.py",
    "ewa_platform/companion/persona/evolution_summary.py",
    "ewa_platform/companion/context/anchor_compose.py",
    "ewa_platform/companion/memory/chat_condense.py",
    "ewa_platform/companion/storage/doceditor_translate_body.py",
    "ewa_platform/companion/orchestration/companion_social_post_compose.py",
    "ewa_platform/companion/workflows/chat/runner.py",
    "ewa_platform/companion/sidecar/tool_router.py",
    "ewa_platform/companion/sidecar/intent_planner.py",
)


def test_prompt_block_canon_has_persona_roles_and_system_keys() -> None:
    keys = set(PROMPT_BLOCK_CANON)
    assert "persona.parent.role" in keys
    assert "persona.zera.role" in keys
    assert "system.action_fulfillment_rules" in keys
    assert "system.tool_catalog_capability_rule" in keys
    assert "sidecar.tool_router" in keys
    assert "sidecar.intent_planner" in keys
    assert "emit.memory" in keys
    assert _WAVE3_REQUIRED_KEYS <= keys
    for spec in list_prompt_block_canon():
        assert spec.body_text.strip(), spec.block_key


def test_prompt_block_canon_matches_prod_operator_overlays() -> None:
    """Lock: 2026-08-09 poet DB overlays pulled into code canon (reseed/fallback parity)."""

    kora = PROMPT_BLOCK_CANON["persona.kora.role"].body_text
    assert "execution specialist" in kora
    assert "Decomposition" in kora
    assert len(PROMPT_BLOCK_CANON["emit.memory"].body_text) > 1200
    assert "Context Anchor" in PROMPT_BLOCK_CANON["workflow.anchor_compose"].body_text
    assert "high-density factual recap" in PROMPT_BLOCK_CANON["workflow.chat_condense"].body_text
    guard = PROMPT_BLOCK_CANON["persona.global.companion_output_guard"].body_text
    assert "Never claim to be an algorithm" in guard
    actions = PROMPT_BLOCK_CANON["emit.actions_template"].body_text
    assert "patch_desktop_config" in actions
    assert "{components}" in actions, "runtime allowlist injection requires {components}"


def test_get_prompt_block_falls_back_to_canon_without_cache() -> None:
    clear_prompt_block_cache()
    body = get_prompt_block("persona.zera.role")
    assert "Zera" in body


def test_server_tool_catalog_markdown_lists_registry_tools() -> None:
    md = format_server_tool_catalog_markdown()
    assert "Server_tool_catalog" in md
    assert "`file_rewrite`" in md or "`file_create`" in md


def test_build_system_prompt_includes_tool_catalog_and_capability_rule() -> None:
    clear_prompt_block_cache()
    prompt = build_companion_system_prompt(
        {"seed_persona_id": "zera", "style_parameters": {}},
        None,
    )
    assert "Server_tool_catalog" in prompt
    assert "do **not** invent" in prompt.lower() or "do not invent" in prompt.lower()


def test_inventory_call_sites_use_prompt_block_loader() -> None:
    """Contract gate: Wave 2/3 assemblers must resolve prose via get_prompt_block."""
    from pathlib import Path

    root = Path(__file__).resolve().parents[1]
    for rel in _WIRED_MODULES_MUST_CALL_LOADER:
        text = (root / rel).read_text(encoding="utf-8")
        assert "get_prompt_block" in text, rel
