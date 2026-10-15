# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for desktop prompt composition and prompt provenance metadata.
# Invariants:
# - Mode-specific contracts and tool blocks are deterministic.
# - Prompt metadata carries hero prompt version provenance when hero profile is resolved.
# Related:
# - api/services/desktop_chat/prompt_compose.py
# - api/services/desktop_chat_ensemble/settings.py
# ---

from __future__ import annotations

from api.routers.desktop_ai_chat import _merge_patched_chat_settings
from api.services.desktop_chat.prompt_compose import (
    compose_desktop_system_prompt,
    compose_desktop_system_prompt_with_meta,
    hash_desktop_prompt_text,
)
from api.services.desktop_chat_ensemble.heroes_prompt_data import get_hero_prompt_version
from api.services.desktop_chat_ensemble.settings import (
    ALLOWED_DESKTOP_HERO_IDS,
    ENSEMBLE_MAX_ROSTER_HEROES,
    ENSEMBLE_MIN_ROSTER_HEROES,
    get_ensemble_roster,
    sanitize_desktop_chat_settings_payload,
)


def test_compose_solo_hero_kernel() -> None:
    out, meta = compose_desktop_system_prompt_with_meta(
        hero_id="likiy_sorrento",
        mode="solo",
        defaults={"default_system_prompt": "fallback"},
        use_tools=False,
    )
    assert "Ликий Соренто" in out
    assert "Я-позиция и агентность" in out
    assert "fallback" not in out
    assert meta["desktop_prompt_mode"] == "solo"
    assert meta["desktop_hero_prompt_version"] == get_hero_prompt_version("likiy_sorrento")
    assert meta["desktop_prompt_hash"] == hash_desktop_prompt_text(out)


def test_prompt_hash_is_stable_for_same_compose_inputs() -> None:
    kwargs = {
        "hero_id": "likiy_sorrento",
        "mode": "solo",
        "defaults": {"default_system_prompt": "fallback"},
        "use_tools": False,
    }
    first, first_meta = compose_desktop_system_prompt_with_meta(**kwargs)
    second, second_meta = compose_desktop_system_prompt_with_meta(**kwargs)
    assert first == second
    assert first_meta["desktop_prompt_hash"] == second_meta["desktop_prompt_hash"]


def test_chat_override_wins() -> None:
    out, meta = compose_desktop_system_prompt_with_meta(
        hero_id="likiy_sorrento",
        mode="solo",
        defaults={},
        chat_override="CUSTOM",
    )
    assert out.startswith("CUSTOM")
    assert meta["desktop_prompt_source"] == "chat_override"


def test_blueprint_prompt_and_short_prompt_share_kernel_invariants() -> None:
    bp, bp_meta = compose_desktop_system_prompt_with_meta(
        hero_id="akimbo",
        mode="blueprint",
        defaults={},
        use_tools=False,
    )
    short, short_meta = compose_desktop_system_prompt_with_meta(
        hero_id="akimbo",
        mode="ensemble_short",
        defaults={},
        use_tools=False,
    )
    assert "соавтор структурированного делового документа" in bp
    assert "коротком ходе" in short
    assert "Правда:" in bp and "Правда:" in short
    assert "Запрещено по умолчанию" in bp and "Запрещено по умолчанию" in short
    assert bp_meta["desktop_prompt_source"] == "hero_blueprint_prompt"
    assert short_meta["desktop_prompt_source"] == "hero_ensemble_short_prompt"


def test_tool_flags_append_expected_instructions() -> None:
    plain, plain_meta = compose_desktop_system_prompt_with_meta(
        hero_id="arlyqueen",
        mode="solo",
        defaults={"tools_image_enabled": True},
        use_tools=False,
    )
    with_tools, with_tools_meta = compose_desktop_system_prompt_with_meta(
        hero_id="arlyqueen",
        mode="solo",
        defaults={"tools_image_enabled": True},
        use_tools=True,
    )
    post_tool, post_tool_meta = compose_desktop_system_prompt_with_meta(
        hero_id="arlyqueen",
        mode="solo",
        defaults={"tools_image_enabled": True},
        use_tools=True,
        post_tool=True,
    )
    assert "инструменты eliteew" in plain.lower()
    assert plain_meta.get("desktop_tools_prompt_applied") is None
    assert "Контекст: вложения этого чата" in with_tools
    assert with_tools_meta["desktop_tools_prompt_applied"] is True
    assert "Инструменты EliteEW уже выполнены сервером" in post_tool
    assert post_tool_meta["desktop_post_tool_prompt"] is True


def test_compose_wrapper_keeps_backward_string_contract() -> None:
    out = compose_desktop_system_prompt(
        hero_id="max_safin",
        mode="solo",
        defaults={"default_system_prompt": "fallback"},
    )
    assert isinstance(out, str)
    assert out.strip()


def test_settings_sanitizer_sets_hero_prompt_version_from_catalog() -> None:
    out = sanitize_desktop_chat_settings_payload(
        {
            "desktop_chat_mode": "solo",
            "desktop_hero_id": "arlekino_pravoz",
        }
    )
    assert out["desktop_hero_id"] == "arlekino_pravoz"
    assert out["desktop_hero_prompt_version"] == get_hero_prompt_version("arlekino_pravoz")


def test_ensemble_roster_caps_match_product_contract() -> None:
    assert ENSEMBLE_MIN_ROSTER_HEROES == 3
    assert ENSEMBLE_MAX_ROSTER_HEROES == 6
    assert len(ALLOWED_DESKTOP_HERO_IDS) >= ENSEMBLE_MAX_ROSTER_HEROES


def test_settings_sanitizer_truncates_ensemble_ids_to_max_roster() -> None:
    ids = list(ALLOWED_DESKTOP_HERO_IDS)[: ENSEMBLE_MAX_ROSTER_HEROES + 2]
    out = sanitize_desktop_chat_settings_payload(
        {
            "desktop_chat_mode": "ensemble",
            "desktop_ensemble_ids": ids,
        }
    )
    cleaned = out["desktop_ensemble_ids"]
    assert len(cleaned) == ENSEMBLE_MAX_ROSTER_HEROES
    assert cleaned == ids[:ENSEMBLE_MAX_ROSTER_HEROES]


def test_get_ensemble_roster_honors_max_and_preserves_order() -> None:
    ids = list(ALLOWED_DESKTOP_HERO_IDS)[:6]
    roster = get_ensemble_roster(
        {
            "desktop_chat_mode": "ensemble",
            "desktop_ensemble_ids": ids,
            "desktop_ensemble_all": False,
        }
    )
    assert roster == ids
    assert len(get_ensemble_roster({"desktop_ensemble_all": True})) == ENSEMBLE_MAX_ROSTER_HEROES


def test_settings_sanitizer_removes_solo_prompt_provenance_in_ensemble_mode() -> None:
    out = sanitize_desktop_chat_settings_payload(
        {
            "desktop_chat_mode": "ensemble",
            "desktop_hero_id": "likiy_sorrento",
            "desktop_ensemble_ids": ["arlyqueen", "akimbo"],
        }
    )
    assert out["desktop_chat_mode"] == "ensemble"
    assert "desktop_hero_id" not in out
    assert "desktop_hero_prompt_version" not in out


def test_settings_sanitizer_preserves_amka_ephemeral_keys() -> None:
    out = sanitize_desktop_chat_settings_payload(
        {
            "desktop_chat_mode": "ensemble",
            "desktop_ensemble_ids": ["arlyqueen"],
            "amka_ephemeral": True,
            "amka_run_id": "run-abc",
            "amka_step_id": "step-1",
            "amka_forced_blueprint_template_id": "marketing_brief_v1",
            "amka_suppress_research_plan_heuristic": True,
        }
    )
    assert out.get("amka_ephemeral") is True
    assert out.get("amka_run_id") == "run-abc"
    assert out.get("amka_step_id") == "step-1"
    assert out.get("amka_forced_blueprint_template_id") == "marketing_brief_v1"
    assert out.get("amka_suppress_research_plan_heuristic") is True


def test_merge_patched_settings_drops_stale_prompt_version_on_ensemble_switch() -> None:
    old = {
        "desktop_chat_mode": "solo",
        "desktop_hero_id": "likiy_sorrento",
        "desktop_hero_prompt_version": get_hero_prompt_version("likiy_sorrento"),
    }
    patch = {
        "desktop_chat_mode": "ensemble",
        "desktop_ensemble_ids": ["arlyqueen", "akimbo"],
    }
    out = _merge_patched_chat_settings(old, patch)
    assert out["desktop_chat_mode"] == "ensemble"
    assert "desktop_hero_id" not in out
    assert "desktop_hero_prompt_version" not in out


def test_merge_patched_settings_refreshes_prompt_version_when_hero_changes() -> None:
    old = {
        "desktop_chat_mode": "solo",
        "desktop_hero_id": "likiy_sorrento",
        "desktop_hero_prompt_version": get_hero_prompt_version("likiy_sorrento"),
    }
    patch = {"desktop_hero_id": "arlekino_pravoz"}
    out = _merge_patched_chat_settings(old, patch)
    assert out["desktop_chat_mode"] == "solo"
    assert out["desktop_hero_id"] == "arlekino_pravoz"
    assert out["desktop_hero_prompt_version"] == get_hero_prompt_version("arlekino_pravoz")
