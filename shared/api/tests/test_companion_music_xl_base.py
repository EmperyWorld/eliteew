# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for EWA companion XL Base autonomous music tool (triggers, turbo exclusion, registry).
# Invariants:
# - Autonomous XL Base phrases must not match turbo ``music_generation`` regex gate.
# Related:
# - api/ewa_platform/companion/orchestration/companion_music_xl_base.py
# ---

from __future__ import annotations

import asyncio
from typing import cast
from unittest.mock import MagicMock

from api.ewa_platform.companion.orchestration import tool_registry as reg
from api.ewa_platform.companion.orchestration.companion_music_xl_base import (
    INTERACTIVE_XL_BASE_START_MARKER,
    build_xl_base_companion_creative_context,
    parse_interactive_xl_base_slots,
    user_line_requests_music_xl_base_autonomous,
    user_line_requests_music_xl_base_interactive,
)
from api.ewa_platform.companion.orchestration.tool_registry import (
    ToolContext,
    _user_line_requests_music_creation,
)


def test_xl_base_autonomous_trigger_ru() -> None:
    assert user_line_requests_music_xl_base_autonomous("напиши сама текст песни")
    assert user_line_requests_music_xl_base_autonomous("Напиши текст песни сама, в стиле Хип Хоп")
    assert user_line_requests_music_xl_base_autonomous("сделай по своему настроению песню")
    assert user_line_requests_music_xl_base_autonomous("compose a song from your mood")


def test_xl_base_interactive_trigger_opens_wizard_not_generation() -> None:
    line = "давай интерактивный запуск XL Base песни"
    assert user_line_requests_music_xl_base_interactive(line)
    assert not user_line_requests_music_xl_base_interactive(f"{INTERACTIVE_XL_BASE_START_MARKER}\nТема: город")


def test_xl_base_interactive_final_slots_parse() -> None:
    slots = parse_interactive_xl_base_slots(
        "\n".join(
            [
                "Запусти XL Base",
                INTERACTIVE_XL_BASE_START_MARKER,
                "Тема: ночной город и вера в себя",
                "Стиль: рок",
                "Вокал: duet",
                "Язык: русский",
            ]
        )
    )
    assert slots == {
        "theme": "ночной город и вера в себя",
        "style": "rock",
        "vocal": "duet",
        "language": "ru",
    }


def test_xl_base_autonomous_excludes_turbo_creation_gate() -> None:
    line = "напиши сама текст — хочу что-то тёплое про вечер"
    assert user_line_requests_music_xl_base_autonomous(line)
    assert not _user_line_requests_music_creation(line)


def test_turbo_still_matches_generic_create() -> None:
    assert _user_line_requests_music_creation("сгенерируй песню про лето")
    assert not user_line_requests_music_xl_base_autonomous("сгенерируй песню про лето")


def test_xl_base_does_not_match_file_opinion_deictic() -> None:
    profile = {
        "learned_preferences": {
            "companion_file_focus_v1": {
                "stack": [{"unified_content_id": "a" * 36, "name": "x.md", "source": "t", "ts": 1}],
            },
        },
    }
    line = "что ты думаешь о нём?"
    assert not user_line_requests_music_xl_base_autonomous(line, profile)


def test_registry_exposes_music_generation_xl_base() -> None:
    assert "music_generation_xl_base" in reg.known_tool_names()
    assert "music_xl_base_interactive" in reg.known_tool_names()
    desc = reg.tool_descriptor("music_generation_xl_base")
    assert desc is not None
    assert desc.name == "music_generation_xl_base"


def test_interactive_handler_returns_wizard_surface(monkeypatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_BACKEND_MUSIC_GENERATION", "1")
    ctx = ToolContext(
        principal_id="p1",
        user_line="открой интерактивный мастер XL Base для песни",
        content_catalog_user_id="u1",
        oauth2_sub_for_content_alternate=None,
    )
    out = asyncio.run(
        reg.dispatch_tool_by_name(
            "music_xl_base_interactive",
            {"user_line": ctx.user_line},
            ctx,
        )
    )
    assert out is not None
    surface = out.get("output_surface")
    assert isinstance(surface, dict)
    assert surface["mode"] == "music_xl_base_wizard"
    payload = surface.get("payload")
    assert isinstance(payload, dict)
    assert payload["ugs_workflow"] == "v2_base"


def test_creative_context_includes_persona_and_topic() -> None:
    ctx = ToolContext(
        principal_id="p1",
        user_line="по своему настроению песню",
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
        profile={"seed_persona_id": "parent"},
    )
    theme, extended = build_xl_base_companion_creative_context(
        "по своему настроению песню про дождь",
        {},
        ctx,
        ru=True,
    )
    assert theme
    assert "parent" in extended or "Persona" in extended or "спутник" in extended
    assert "XL Base" in extended or "xl base" in extended.lower()


def test_xl_base_handler_skips_when_env_disabled(monkeypatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_BACKEND_MUSIC_GENERATION", raising=False)
    ctx = ToolContext(
        principal_id="p1",
        user_line="напиши сама текст песни",
        content_catalog_user_id="u1",
        oauth2_sub_for_content_alternate=None,
    )
    out = asyncio.run(
        reg.dispatch_tool_by_name(
            "music_generation_xl_base",
            {"user_line": ctx.user_line},
            ctx,
        )
    )
    assert out is None


def test_xl_base_async_step_input_carries_worker_payload(monkeypatch) -> None:
    """Celery receives only opaque auth; durable step input must carry safe music worker fields."""

    monkeypatch.setenv("EWA_COMPANION_BACKEND_MUSIC_GENERATION", "1")
    monkeypatch.setenv("EWA_COMPANION_ASYNC_JOBS_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_ASYNC_MUSIC_ENABLED", "1")

    captured_step: dict[str, object] = {}

    async def fake_run_create(*_args: object, **kwargs: object) -> dict[str, object]:
        return {
            "id": "run-xl",
            "principal_id": kwargs["principal_id"],
            "status": kwargs["status"],
            "intent_kind": kwargs["intent_kind"],
        }

    async def fake_step_create(*_args: object, **kwargs: object) -> dict[str, object]:
        raw_payload = kwargs["input_payload"]
        assert isinstance(raw_payload, dict)
        captured_step.update(cast("dict[str, object]", raw_payload))
        return {"id": "step-xl"}

    def fake_enqueue(**_kwargs: object) -> str:
        return "celery-xl"

    monkeypatch.setattr("api.ewa_platform.companion.jobs.enqueue.enqueue_companion_run", fake_enqueue)
    monkeypatch.setattr(reg.companion_pg, "companion_task_run_create", fake_run_create)
    monkeypatch.setattr(reg.companion_pg, "companion_task_step_create", fake_step_create)

    ctx = ToolContext(
        principal_id="p1",
        user_line="напиши сама текст песни про дождь",
        content_catalog_user_id="u1",
        oauth2_sub_for_content_alternate=None,
        companion_pool=MagicMock(name="companion_pool"),
        bearer_token="tok-xl",
        auth_user=MagicMock(),
        profile={"seed_persona_id": "parent"},
    )

    out = asyncio.run(reg.dispatch_tool_by_name("music_generation_xl_base", {"user_line": ctx.user_line}, ctx))

    assert out is not None
    assert out["status"] == "accepted"
    assert captured_step["theme"]
    assert captured_step["theme_preview"]
    assert captured_step["style_key"] == captured_step["style"]
    assert captured_step["vocal_eff"] == captured_step["vocal"]
    assert captured_step["language_e"] == captured_step["language"]
    assert captured_step["ugs_wf"] == "v2_base"
    assert captured_step["billing_mode"] == "companion_xl_base"
    assert "XL Base" in str(captured_step["ewa_companion_context"])


def test_xl_base_deterministic_slots_from_user_line(monkeypatch) -> None:
    """When Tool Router is down, common RU slots in the user line still launch XL Base correctly."""

    monkeypatch.setenv("EWA_COMPANION_BACKEND_MUSIC_GENERATION", "1")
    monkeypatch.setenv("EWA_COMPANION_ASYNC_JOBS_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_ASYNC_MUSIC_ENABLED", "1")

    captured_step: dict[str, object] = {}

    async def fake_run_create(*_args: object, **kwargs: object) -> dict[str, object]:
        return {
            "id": "run-xl-slots",
            "principal_id": kwargs["principal_id"],
            "status": kwargs["status"],
            "intent_kind": kwargs["intent_kind"],
        }

    async def fake_step_create(*_args: object, **kwargs: object) -> dict[str, object]:
        raw_payload = kwargs["input_payload"]
        assert isinstance(raw_payload, dict)
        captured_step.update(cast("dict[str, object]", raw_payload))
        return {"id": "step-xl-slots"}

    def fake_enqueue(**_kwargs: object) -> str:
        return "celery-xl-slots"

    monkeypatch.setattr("api.ewa_platform.companion.jobs.enqueue.enqueue_companion_run", fake_enqueue)
    monkeypatch.setattr(reg.companion_pg, "companion_task_run_create", fake_run_create)
    monkeypatch.setattr(reg.companion_pg, "companion_task_step_create", fake_step_create)

    line = (
        "Напиши текст песни сама, в стиле Хип Хоп мужской вокал, "
        "самый быстрый темп в мире, на тему: вены дорог, дороги вен."
    )
    ctx = ToolContext(
        principal_id="p1",
        user_line=line,
        content_catalog_user_id="u1",
        oauth2_sub_for_content_alternate=None,
        companion_pool=MagicMock(name="companion_pool"),
        bearer_token="tok-xl",
        auth_user=MagicMock(),
    )

    out = asyncio.run(reg.dispatch_tool_by_name("music_generation_xl_base", {"user_line": line}, ctx))

    assert out is not None
    assert out["status"] == "accepted"
    assert captured_step["theme"] == "вены дорог, дороги вен"
    assert captured_step["style_key"] == "hip-hop"
    assert captured_step["vocal_eff"] == "male"
    assert captured_step["bpm_override"] == 220
