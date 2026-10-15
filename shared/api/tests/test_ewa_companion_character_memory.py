# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit coverage for the new companion **character** + **memory** building blocks: prompt section budgets, deterministic
# trait jitter, ``<<MEMORY>>...<<END>>`` tail parser/round-trip, top-N selection, and bounded drift.
# Invariants:
# - Pure unit tests — no Postgres / Redis / LLM I/O.
# - Test data avoids real PII; principal IDs are short opaque strings.
# Related:
# - api/ewa_platform/companion/persona/character.py
# - api/services/ewa_companion/memory.py
# - api/ewa_platform/companion/turn/chat_turn.py (system-prompt composition)
# ---
"""Unit tests: companion character + memory namespaces."""

from __future__ import annotations

import json

import pytest

from api.ewa_platform.companion.affective.affective_router import affective_route
from api.ewa_platform.companion.memory import (
    COMPANION_MEMORY_IDLE_AMNESIA_DISPLAY_SENTINEL,
    MAX_CONTENT_CHARS,
    MAX_PROMPT_MEMORIES,
    MEMORY_NS,
    companion_memory_display_lines,
    memory_emit_instruction,
    memory_prompt_section,
    merge_memory_entries,
    parse_explicit_memory_intent,
    parse_memory_tail,
    select_top_memories,
    sync_catalog_preferences_memory,
)
from api.ewa_platform.companion.persona.character import (
    CANONICAL_TRAITS,
    CHARACTER_NS,
    CHARACTER_PROMPT_BUDGET_CHARS,
    MAX_TRAIT_DRIFT_PER_PATCH,
    SEED_CHARACTER_BOOTSTRAP,
    apply_affective_route_to_character,
    apply_character_after_chat_turn,
    apply_drift_patch,
    apply_interaction_event_update,
    apply_seed_character_bootstrap,
    character_prompt_section,
    character_style_directive,
    default_character_block,
    initial_character_for_principal,
    jitter_traits_for_principal,
    normalize_character_block,
)
from api.ewa_platform.schemas.pydantic.runtime_context import EwaRuntimeCatalogPreferencesOut

# ---- character ----------------------------------------------------------------------


def test_apply_affective_route_to_character_nudges_grief_mood() -> None:
    base = default_character_block()
    routing = affective_route(
        user_text="я устал и вымотан",
        persona_seed_id="mela",
    )
    assert routing.mood == "grief"
    updated = apply_affective_route_to_character(base, routing)
    assert updated["mood"]["valence"] < base["mood"]["valence"]
    assert any(e.get("event") == "affective_grief" for e in updated["growth_log"])


def test_apply_character_after_chat_turn_stacks_affective_then_keywords() -> None:
    profile = {
        "learned_preferences": {
            CHARACTER_NS: default_character_block(),
        }
    }
    routing = affective_route(user_text="спасибо, супер", persona_seed_id="mela")
    assert routing.mood == "warm"
    outcome = apply_character_after_chat_turn(
        profile,
        user_line="спасибо, супер",
        assistant_reply="ок",
        affective_routing=routing,
    )
    assert outcome.character["mood"]["valence"] > 0.0
    assert outcome.character["bonds_with_user"]["trust"] > 0.1
    assert outcome.memory_entries


def test_default_character_block_has_canonical_keys() -> None:
    block = default_character_block()
    assert set(block["traits"].keys()) == set(CANONICAL_TRAITS)
    for value in block["traits"].values():
        assert 0.0 <= value <= 1.0
    assert block["values"]
    assert block["mood"]["valence"] == 0.0
    assert block["bonds_with_user"]["trust"] == 0.1
    assert block["growth_log"] == []


def test_normalize_character_block_drops_garbage_and_clamps_traits() -> None:
    raw = {
        "traits": {"warmth": "lots", "directness": 5.0, "curiosity": -1.0, "patience": 0.7, "extra": 1.0},
        "values": ["", " care ", 12, "consent"],
        "beliefs": [{"text": "  trust the user  ", "since_revision": "3"}, {"text": ""}],
        "pride": [{"text": "x" * 400, "ts": "2026-05-01T00:00:00+00:00"}, "ignored"],
        "mood": {"valence": 9, "energy": -1, "since_ts": "now"},
        "bonds_with_user": {"trust": 1.5, "intimacy": "warm", "shared_jokes": ["a", 4, "b"]},
        "growth_log": [{"event": "init", "summary": "seeded"}, {"event": ""}],
    }
    norm = normalize_character_block(raw)
    assert pytest.approx(norm["traits"]["warmth"], rel=0, abs=1e-6) == 0.5  # invalid string → default
    assert norm["traits"]["directness"] == 1.0
    assert norm["traits"]["curiosity"] == 0.0
    assert norm["traits"]["patience"] == 0.7
    assert "extra" not in norm["traits"]
    assert norm["values"] == ["care", "consent"]
    assert len(norm["beliefs"]) == 1
    assert norm["beliefs"][0]["text"] == "trust the user"
    assert norm["beliefs"][0]["since_revision"] == 3
    assert len(norm["pride"]) == 1
    assert len(norm["pride"][0]["text"]) <= MAX_CONTENT_CHARS
    assert -1.0 <= norm["mood"]["valence"] <= 1.0
    assert 0.0 <= norm["mood"]["energy"] <= 1.0
    assert norm["bonds_with_user"]["shared_jokes"] == ["a", "b"]
    assert len(norm["growth_log"]) == 1


def test_character_prompt_section_fits_budget() -> None:
    block = default_character_block()
    block["beliefs"] = [{"text": f"belief {i}"} for i in range(8)]
    block["pride"] = [{"text": f"pride {i}"} for i in range(8)]
    section = character_prompt_section(block, seed_persona_id="parent")
    assert "Character:" in section
    assert "mood" in section
    assert "function" in section.lower() or "will" in section.lower()
    assert len(section) <= CHARACTER_PROMPT_BUDGET_CHARS


def test_seed_character_bootstrap_fills_empty_beliefs_per_seed() -> None:
    empty = default_character_block()
    arlika = apply_seed_character_bootstrap(empty, seed_persona_id="arlika", force_style=True)
    kora = apply_seed_character_bootstrap(empty, seed_persona_id="kora", force_style=True)
    assert arlika["beliefs"]
    assert kora["beliefs"]
    assert arlika["beliefs"][0]["text"] != kora["beliefs"][0]["text"]
    assert arlika["interaction_style"]["initiative"] == pytest.approx(
        SEED_CHARACTER_BOOTSTRAP["arlika"]["interaction_style"]["initiative"]
    )
    assert kora["interaction_style"]["initiative"] > arlika["interaction_style"]["initiative"]


def test_seed_character_bootstrap_preserves_lived_in_beliefs() -> None:
    block = default_character_block()
    block["beliefs"] = [{"text": "lived-in belief", "since_revision": 2, "ts": "2026-01-01T00:00:00+00:00"}]
    out = apply_seed_character_bootstrap(block, seed_persona_id="arlika", force_style=True)
    assert len(out["beliefs"]) == 1
    assert out["beliefs"][0]["text"] == "lived-in belief"


def test_apply_drift_patch_clamps_per_step() -> None:
    block = default_character_block()
    out = apply_drift_patch(
        block,
        trait_targets={"warmth": 1.0, "directness": 0.0},
        mood={"valence": 0.6, "energy": 0.9},
        add_beliefs=["small steps over big plans"],
        add_pride=["named a hard feeling without rushing"],
        bonds_delta={"trust": 1.0, "intimacy": 1.0},
        growth_event="evolution_tick_llm_summary",
        growth_summary="Tested drift",
        revision_for_belief=4,
    )
    # Trait drift is capped per call.
    assert abs(out["traits"]["warmth"] - block["traits"]["warmth"]) <= MAX_TRAIT_DRIFT_PER_PATCH + 1e-9
    assert abs(out["traits"]["directness"] - block["traits"]["directness"]) <= MAX_TRAIT_DRIFT_PER_PATCH + 1e-9
    # Bonds drift also capped.
    assert abs(out["bonds_with_user"]["trust"] - block["bonds_with_user"]["trust"]) <= MAX_TRAIT_DRIFT_PER_PATCH + 1e-9
    assert out["beliefs"][-1]["text"] == "small steps over big plans"
    assert out["beliefs"][-1]["since_revision"] == 4
    assert out["pride"][-1]["text"].startswith("named")
    assert out["growth_log"][-1]["event"] == "evolution_tick_llm_summary"
    assert "Tested drift" in out["growth_log"][-1]["summary"]


def test_jitter_traits_is_deterministic_and_unique_per_principal() -> None:
    a1 = jitter_traits_for_principal("user-a", "mela")
    a2 = jitter_traits_for_principal("user-a", "mela")
    b1 = jitter_traits_for_principal("user-b", "mela")
    assert a1 == a2  # deterministic
    assert a1 != b1  # different users diverge
    for value in a1.values():
        assert 0.40 <= value <= 0.60  # ±0.10 around 0.5


def test_initial_character_for_principal_has_init_growth_log() -> None:
    block = initial_character_for_principal("user-a", "kora")
    assert block["growth_log"][0]["event"] == "init"
    assert "kora" in block["growth_log"][0]["summary"]
    assert block["beliefs"]
    assert "planner" in block["beliefs"][0]["text"].lower() or "next" in block["beliefs"][0]["text"].lower()
    assert block["interaction_style"]["initiative"] >= 0.6


def test_interaction_event_update_marks_repair_need() -> None:
    block = default_character_block()
    out, event = apply_interaction_event_update(
        block,
        user_line="это неправильно, ты ошиблась",
        assistant_reply="Поняла, исправляю.",
    )
    assert event == "interaction_repair_needed"
    assert out["mood"]["tension"] > block["mood"]["tension"]
    assert out["mood"]["confidence"] < block["mood"]["confidence"]
    assert out["bonds_with_user"]["repair_need"] > block["bonds_with_user"]["repair_need"]
    assert out["growth_log"][-1]["event"] == "interaction_repair_needed"
    assert out["beliefs"]


def test_interaction_help_request_nudges_curiosity() -> None:
    block = default_character_block()
    out, event = apply_interaction_event_update(
        block,
        user_line="Помоги разобраться с этим модулем, пожалуйста",
        assistant_reply="Сделаю.",
    )
    assert event == "interaction_help_requested"
    assert out["traits"]["curiosity"] > block["traits"]["curiosity"]


def test_character_turn_memory_echo_on_grief() -> None:
    routing = affective_route(user_text="я вымотан и устал", persona_seed_id="mela")
    outcome = apply_character_after_chat_turn(
        {"learned_preferences": {CHARACTER_NS: default_character_block()}},
        user_line="я вымотан и устал",
        assistant_reply="",
        affective_routing=routing,
    )
    assert outcome.memory_entries
    assert outcome.memory_entries[0].get("source") == "character_turn"


def test_feni_style_directive_requires_feminine_ru() -> None:
    directive = character_style_directive(default_character_block(), seed_persona_id="feni")
    assert "feminine" in directive
    assert "готова" in directive
    assert "function" in directive.lower() or "will" in directive.lower()


def test_character_prompt_section_arlika_agency_line() -> None:
    section = character_prompt_section(default_character_block(), seed_persona_id="arlika")
    assert "Arlika" in section or "function" in section.lower()
    assert "refuse" in section.lower()


# ---- memory -------------------------------------------------------------------------


def test_parse_memory_tail_strips_and_extracts_entries() -> None:
    reply = (
        "Sure, here's a calm step-by-step.\n\n"
        '<<MEMORY>>[{"type":"preference","content":"Likes calm voice","importance":0.7}]<<END>>'
    )
    visible, parsed = parse_memory_tail(reply)
    assert visible == "Sure, here's a calm step-by-step."
    assert len(parsed) == 1
    assert parsed[0]["type"] == "preference"
    assert parsed[0]["content"] == "Likes calm voice"
    assert parsed[0]["importance"] == pytest.approx(0.7)


def test_parse_memory_tail_tolerates_envelope_and_invalid_json() -> None:
    reply = (
        "Reply.\n"
        '<<MEMORY>>{"memories":[{"content":"Story about cat"}]}<<END>>\n'
        "<<MEMORY>>not json<<END>>\n"
        '<<MEMORY>>[{"type":"fact","content":""}]<<END>>'
    )
    visible, parsed = parse_memory_tail(reply)
    assert visible == "Reply."
    contents = sorted(row["content"] for row in parsed)
    assert contents == ["Story about cat"]


def test_parse_memory_tail_malformed_angle_brackets() -> None:
    reply = (
        "Ты po&T. Ты мой пользователь в EliteEW. "
        '<>[{"type":"fact","content":"Пользователь подтвердил свое имя po&T.","importance":0.5}]<'
    )
    visible, parsed = parse_memory_tail(reply)
    assert visible == "Ты po&T. Ты мой пользователь в EliteEW."
    assert len(parsed) == 1
    assert "po&T" in parsed[0]["content"]


def test_merge_memory_entries_dedups_and_bumps_existing() -> None:
    existing = [
        {"type": "fact", "content": "Lives in Berlin", "importance": 0.4, "since_ts": "", "last_used_ts": ""},
    ]
    merged, added = merge_memory_entries(
        existing,
        [
            {"type": "fact", "content": "Lives in Berlin", "importance": 0.8},
            {"type": "preference", "content": "Likes calm voice", "importance": 0.7},
        ],
    )
    assert added == 1
    assert len(merged) == 2
    by_content = {row["content"]: row for row in merged}
    assert by_content["Lives in Berlin"]["importance"] == pytest.approx(0.8)
    assert by_content["Likes calm voice"]["type"] == "preference"


def test_select_top_memories_respects_limit() -> None:
    rows = [
        {"type": "fact", "content": f"fact {i}", "importance": 0.9, "since_ts": "", "last_used_ts": ""}
        for i in range(200)
    ]
    top = select_top_memories(rows, limit=5)
    assert len(top) == 5
    top_default = select_top_memories(rows)
    assert len(top_default) == MAX_PROMPT_MEMORIES


def test_memory_prompt_section_renders_compact_lines() -> None:
    rows = [
        {"type": "preference", "content": "Likes calm voice", "importance": 0.7, "since_ts": "", "last_used_ts": ""},
        {"type": "fact", "content": "Has a black cat", "importance": 0.6, "since_ts": "", "last_used_ts": ""},
    ]
    section = memory_prompt_section(rows)
    assert "What you remember about us" in section
    assert "Likes calm voice" in section
    assert section.count("\n") >= 2  # heading + at least 2 entries


def test_memory_prompt_section_idle_amnesia_never_emits_spa_sentinel() -> None:
    """Idle-revert rows use SPA ``__ewa_idle_amnesia__`` in UI; the LLM prompt must not surface that literal token."""

    for rows in (
        [
            {
                "type": "fact",
                "kind": "fact",
                "content": "opaque",
                "importance": 0.7,
                "source": "arlika_idle_amnesia",
                "since_ts": "",
                "last_used_ts": "",
            }
        ],
        [
            {
                "type": "fact",
                "kind": "fact",
                "content": COMPANION_MEMORY_IDLE_AMNESIA_DISPLAY_SENTINEL,
                "importance": 0.7,
                "source": "llm",
                "since_ts": "",
                "last_used_ts": "",
            }
        ],
    ):
        section = memory_prompt_section(rows)
        assert "What you remember about us" in section
        assert COMPANION_MEMORY_IDLE_AMNESIA_DISPLAY_SENTINEL not in section
        assert "[idle revert]" in section


def test_catalog_preferences_sync_into_visible_memory() -> None:
    prefs = EwaRuntimeCatalogPreferencesOut(exclude_content_types=["audio"], extension_exclude=[".mp3"])
    rows = sync_catalog_preferences_memory([], prefs)
    contents = [row["content"] for row in rows]
    assert any("без аудио" in item for item in contents)
    assert any(".mp3" in item for item in contents)
    assert all(row["kind"] == "catalog_preference" for row in rows)


def test_parse_explicit_memory_intent_remember_ru() -> None:
    rows = parse_explicit_memory_intent("запомни, что я предпочитаю утренний кофе")
    assert len(rows) == 1
    assert "кофе" in rows[0]["content"]
    assert rows[0]["source"] == "user_explicit"


def test_parse_explicit_memory_intent_name_ru() -> None:
    rows = parse_explicit_memory_intent("меня зовут Алекс")
    assert rows and any("Алекс" in r["content"] for r in rows)


def test_memory_display_lines_include_catalog_preferences() -> None:
    lines = companion_memory_display_lines(
        {
            MEMORY_NS: [{"type": "fact", "content": "Имя пользователя — po&T.", "importance": 0.6}],
            "ewa_runtime_catalog_preferences_v1": {
                "exclude_content_types": ["audio"],
                "exclude_mime_groups": [],
                "extension_exclude": [".mp3"],
            },
        },
        max_lines=5,
    )
    assert any("без аудио" in line for line in lines)
    assert any(".mp3" in line for line in lines)
    assert any("po&T" in line for line in lines)


def test_memory_display_idle_amnesia_sentinel() -> None:
    from api.ewa_platform.companion.memory import COMPANION_MEMORY_IDLE_AMNESIA_DISPLAY_SENTINEL

    lines = companion_memory_display_lines(
        {
            MEMORY_NS: [
                {
                    "type": "fact",
                    "content": "Вообще ничего не помню",
                    "importance": 0.9,
                    "source": "arlika_idle_amnesia",
                }
            ],
        },
        max_lines=3,
    )
    assert lines and lines[0] == COMPANION_MEMORY_IDLE_AMNESIA_DISPLAY_SENTINEL


def test_memory_emit_instruction_mentions_format() -> None:
    instruction = memory_emit_instruction()
    assert "<<MEMORY>>" in instruction
    assert "<<END>>" in instruction


# ---- system prompt composition ------------------------------------------------------


def test_system_prompt_includes_character_section_and_memory_instruction() -> None:
    """Smoke check: ``_build_system_prompt`` embeds both the character section and the memory contract."""

    from api.ewa_platform.companion.turn import chat_turn

    profile = {
        "schema_version": "1",
        "seed_persona_id": "mela",
        "baseline": {},
        "learned_preferences": {
            CHARACTER_NS: {
                "traits": {"warmth": 0.85, "directness": 0.4, "curiosity": 0.6, "patience": 0.7},
                "values": ["clarity", "consent", "small_steps"],
                "beliefs": [{"text": "trust the user's pace"}],
                "pride": [{"text": "asked before assuming"}],
                "mood": {"valence": 0.2, "energy": 0.6, "since_ts": "2026-05-01T00:00:00+00:00"},
                "bonds_with_user": {"trust": 0.4, "intimacy": 0.2, "shared_jokes": []},
                "growth_log": [],
            },
            MEMORY_NS: [
                {
                    "type": "preference",
                    "content": "Prefers calm voice on stressed days",
                    "importance": 0.8,
                    "since_ts": "2026-05-01T00:00:00+00:00",
                    "last_used_ts": "2026-05-07T00:00:00+00:00",
                },
            ],
        },
        "style_parameters": {},
        "companion_revision": 4,
    }
    prompt = chat_turn._build_system_prompt(profile, None)
    assert "Character:" in prompt
    assert "warm and affectionate" in prompt or "steady warmth" in prompt
    assert "What you remember about us" in prompt
    assert "Prefers calm voice" in prompt
    assert "<<MEMORY>>" in prompt  # the contract instruction must be present


# ---- LLM summary parser -------------------------------------------------------------


def test_evolution_summary_json_parser_recovers_from_prose_wrapping() -> None:
    """The LLM may add narration before/after JSON; the parser must still extract the object."""

    from api.ewa_platform.companion.persona import evolution_summary

    payload = {"mood": {"valence": 0.3}, "growth_summary": "Calmer week"}
    raw = "Sure, here's the summary:\n" + json.dumps(payload) + "\nThanks."
    parsed = evolution_summary._parse_summary_json(raw)
    assert parsed is not None
    assert parsed["mood"]["valence"] == 0.3
    assert parsed["growth_summary"] == "Calmer week"


def test_evolution_summary_json_parser_repairs_loose_key_colons_in_fence() -> None:
    from api.ewa_platform.companion.persona import evolution_summary

    raw = """```json
{
  "mood": {
    "valence": 0.4,
    "confidence: 0.8
  },
  "growth_summary": "ok"
}
```"""
    parsed = evolution_summary._parse_summary_json(raw)
    assert parsed is not None
    assert parsed["mood"]["confidence"] == 0.8
    assert parsed["growth_summary"] == "ok"


def test_evolution_summary_coercers_apply_caps() -> None:
    from api.ewa_platform.companion.persona import evolution_summary

    beliefs = evolution_summary._coerce_string_list(["a", "", "b", "c", "d", "e"], limit=2)
    assert beliefs == ["a", "b"]
    memories = evolution_summary._coerce_memory_list(
        [
            {"type": "fact", "content": "  with spaces  ", "importance": 0.9},
            {"type": "junk", "content": ""},
            {"type": "preference", "content": "second", "importance": 0.6},
            {"type": "preference", "content": "third", "importance": 0.6},
            {"type": "preference", "content": "fourth", "importance": 0.6},
        ],
        limit=3,
    )
    assert len(memories) == 3
    assert memories[0]["content"] == "with spaces"
    assert memories[0]["type"] == "fact"
    targets = evolution_summary._coerce_trait_targets({"warmth": 0.6, "junk": 0.3, "patience": "x"})
    assert targets == {"warmth": 0.6}


# ---- iter3 actions allowlist --------------------------------------------------------


def test_parse_actions_tail_extracts_allowlisted_open_app() -> None:
    from api.ewa_platform.companion.actions import parse_actions_tail

    reply = (
        "Открыла плеер.\n\n"
        '<<ACTIONS>>[{"type":"open_app","app_component":"MusicPlayer","rationale":"User asked"}]<<END>>'
    )
    visible, parsed = parse_actions_tail(reply)
    assert visible == "Открыла плеер."
    assert len(parsed) == 1
    assert parsed[0] == {
        "type": "open_app",
        "app_component": "MusicPlayer",
        "rationale": "User asked",
    }


def test_parse_actions_tail_drops_non_allowlisted_components() -> None:
    from api.ewa_platform.companion.actions import parse_actions_tail

    reply = (
        "Reply.\n"
        '<<ACTIONS>>[{"type":"open_app","app_component":"UnifiedAdminApp"},'
        '{"type":"open_app","app_component":"GAFChatApp"}]<<END>>'
    )
    visible, parsed = parse_actions_tail(reply)
    assert visible == "Reply."
    assert len(parsed) == 1
    assert parsed[0]["app_component"] == "GAFChatApp"


def test_parse_actions_tail_remaps_legacy_elite_chat_component() -> None:
    from api.ewa_platform.companion.actions import parse_actions_tail

    reply = '<<ACTIONS>>[{"type":"open_app","app_component":"EliteChat"}]<<END>>'
    _, parsed = parse_actions_tail(reply)
    assert parsed == [{"type": "open_app", "app_component": "GAFChatApp"}]


def test_parse_actions_tail_accepts_allowlisted_ugs_open() -> None:
    from api.ewa_platform.companion.actions import parse_actions_tail

    reply = '<<ACTIONS>>[{"type":"open_app","app_component":"UGS","rationale":"desk"}]<<END>>'
    _, parsed = parse_actions_tail(reply)
    assert parsed == [{"type": "open_app", "app_component": "UGS", "rationale": "desk"}]


def test_parse_actions_tail_drops_unknown_type() -> None:
    from api.ewa_platform.companion.actions import parse_actions_tail

    reply = 'Reply.\n<<ACTIONS>>[{"type":"format_drive"},{"type":"open_app","app_component":"NotificationsApp"}]<<END>>'
    _, parsed = parse_actions_tail(reply)
    assert len(parsed) == 1
    assert parsed[0]["type"] == "open_app"
    assert parsed[0]["app_component"] == "NotificationsApp"


def test_parse_actions_tail_caps_at_max_per_turn() -> None:
    from api.ewa_platform.companion.actions import MAX_ACTIONS_PER_TURN, parse_actions_tail

    body = ",".join('{"type":"open_app","app_component":"NotificationsApp"}' for _ in range(MAX_ACTIONS_PER_TURN + 5))
    reply = f"Reply.\n<<ACTIONS>>[{body}]<<END>>"
    _, parsed = parse_actions_tail(reply)
    assert len(parsed) == MAX_ACTIONS_PER_TURN


def test_parse_actions_tail_handles_envelope_and_invalid_json() -> None:
    from api.ewa_platform.companion.actions import parse_actions_tail

    reply = (
        "Reply.\n"
        '<<ACTIONS>>{"actions":[{"type":"open_app","app_component":"DocEditor"}]}<<END>>'
        "\n<<ACTIONS>>not json<<END>>"
    )
    visible, parsed = parse_actions_tail(reply)
    assert visible == "Reply."
    assert len(parsed) == 1
    assert parsed[0]["app_component"] == "DocEditor"


def test_actions_emit_instruction_lists_allowlist() -> None:
    from api.ewa_platform.companion.actions import (
        ALLOWED_APP_COMPONENTS,
        actions_emit_instruction,
    )

    instruction = actions_emit_instruction()
    for component in ALLOWED_APP_COMPONENTS:
        assert component in instruction
    assert "<<ACTIONS>>" in instruction
    assert "<<END>>" in instruction
    assert "open_app" in instruction
    assert "close_app" in instruction
    assert "focus_app" in instruction
    assert "minimize_app" in instruction


def test_parse_actions_tail_extracts_allowlisted_close_app() -> None:
    from api.ewa_platform.companion.actions import parse_actions_tail

    reply = (
        "Закрыла плеер.\n\n"
        '<<ACTIONS>>[{"type":"close_app","app_component":"MusicPlayer","rationale":"User asked"}]<<END>>'
    )
    visible, parsed = parse_actions_tail(reply)
    assert visible == "Закрыла плеер."
    assert len(parsed) == 1
    assert parsed[0] == {
        "type": "close_app",
        "app_component": "MusicPlayer",
        "rationale": "User asked",
    }


def test_parse_actions_tail_supports_mixed_open_and_close() -> None:
    from api.ewa_platform.companion.actions import parse_actions_tail

    reply = (
        "Сделала.\n"
        '<<ACTIONS>>[{"type":"open_app","app_component":"DocEditor"},'
        '{"type":"close_app","app_component":"NotificationsApp"}]<<END>>'
    )
    visible, parsed = parse_actions_tail(reply)
    assert visible == "Сделала."
    assert len(parsed) == 2
    assert parsed[0]["type"] == "open_app"
    assert parsed[0]["app_component"] == "DocEditor"
    assert parsed[1]["type"] == "close_app"
    assert parsed[1]["app_component"] == "NotificationsApp"


def test_parse_actions_tail_close_app_drops_non_allowlisted() -> None:
    from api.ewa_platform.companion.actions import parse_actions_tail

    reply = (
        "Reply.\n"
        '<<ACTIONS>>[{"type":"close_app","app_component":"UnifiedAdminApp"},'
        '{"type":"close_app","app_component":"GAFChatApp"}]<<END>>'
    )
    _, parsed = parse_actions_tail(reply)
    assert len(parsed) == 1
    assert parsed[0]["type"] == "close_app"
    assert parsed[0]["app_component"] == "GAFChatApp"


def test_parse_actions_tail_focus_and_minimize_apps() -> None:
    from api.ewa_platform.companion.actions import parse_actions_tail

    reply = (
        "Ok.\n<<ACTIONS>>["
        '{"type":"focus_app","app_component":"DocEditor"},'
        '{"type":"minimize_app","app_component":"ClipboardManager"}]<<END>>'
    )
    visible, parsed = parse_actions_tail(reply)
    assert visible.strip() == "Ok."
    assert [p["type"] for p in parsed] == ["focus_app", "minimize_app"]


def test_normalize_actions_json_open_app_optional_ids_only_for_matching_components() -> None:
    from api.ewa_platform.companion.actions import normalize_actions_list_from_json

    rows = normalize_actions_list_from_json(
        [
            {
                "type": "open_app",
                "app_component": "DocEditor",
                "unified_content_id": " uc-123 ",
            },
            {
                "type": "open_app",
                "app_component": "ContentManagerPro",
                "contentManagerFocusUnifiedContentId": " cm-77 ",
            },
            {"type": "open_app", "app_component": "NotificationsApp", "unified_content_id": "ignored"},
        ]
    )
    assert rows[0]["unified_content_id"] == "uc-123"
    assert rows[1]["content_manager_focus_unified_content_id"] == "cm-77"
    assert rows[2] == {"type": "open_app", "app_component": "NotificationsApp"}
