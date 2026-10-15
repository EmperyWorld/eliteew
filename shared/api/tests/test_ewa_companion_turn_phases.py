# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for Phase 5.1 turn phase helpers (catalog prefetch, memory merge, defer, terminal payload).
# Related:
# - api/ewa_platform/companion/turn/phases/catalog_prefetch.py
# - api/ewa_platform/companion/turn/phases/memory_merge.py
# - api/ewa_platform/companion/turn/phases/orchestration_terminal_persist.py
# - api/ewa_platform/companion/turn/phases/main_llm_prepare.py
# - api/ewa_platform/companion/turn/phases/main_llm_persist.py
# - api/ewa_platform/companion/turn/phases/main_llm_finalize.py
# - api/ewa_platform/companion/turn/phases/main_llm_post_extract.py
# - api/ewa_platform/companion/turn/phases/main_llm_stream_llm.py
# - api/ewa_platform/companion/turn/phases/turn_bootstrap.py
# - api/ewa_platform/companion/turn/phases/orchestration_terminal_shortcircuit.py
# ---

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import AsyncMock

import pytest

from api.ewa_platform.companion.storage.catalog_find import CompanionCatalogFindBundle
from api.ewa_platform.companion.turn.phases.catalog_prefetch import prefetch_catalog_find_bundle_for_turn
from api.ewa_platform.companion.turn.phases.memory_merge import merge_memory_section_append
from api.ewa_platform.companion.turn.phases.orchestration_defer import parse_orchestration_defer_state
from api.ewa_platform.companion.turn.phases.orchestration_terminal import (
    build_orchestration_terminal_final_payload,
)


@pytest.mark.unit
def test_merge_memory_section_append_appends_or_returns_base() -> None:
    assert merge_memory_section_append("base", None) == "base"
    assert merge_memory_section_append(None, "extra") == "extra"
    assert merge_memory_section_append("base", "extra") == "base\n\nextra"


@pytest.mark.unit
def test_prefetch_catalog_find_bundle_for_turn_skips_on_discuss_intent(monkeypatch: pytest.MonkeyPatch) -> None:
    called = {"n": 0}

    async def fake_maybe(*_a: object, **_k: object) -> object:
        called["n"] += 1
        return object()

    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.catalog_prefetch.maybe_prefetch_catalog_find_bundle",
        fake_maybe,
    )
    out = asyncio.run(
        prefetch_catalog_find_bundle_for_turn(
            "прочитай notes.md",
            content_catalog_user_id="uid",
            oauth2_sub_for_content_alternate=None,
            profile=None,
            orchestrated_memory_append=None,
            orchestration_branch=None,
        ),
    )
    assert out is None
    assert called["n"] == 0


@pytest.mark.unit
def test_prefetch_catalog_find_bundle_for_turn_delegates_when_not_skipped(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.gateways.runtime_gateway.runtime_context import normalize_catalog_filters

    bundle = CompanionCatalogFindBundle(
        browse_all=False,
        keyword_query="hello",
        filters=normalize_catalog_filters(),
        preferences=None,
        collected_rows=(),
        appendix="facts",
    )
    fake_maybe = AsyncMock(return_value=bundle)
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.catalog_prefetch.maybe_prefetch_catalog_find_bundle",
        fake_maybe,
    )
    out = asyncio.run(
        prefetch_catalog_find_bundle_for_turn(
            "hello",
            content_catalog_user_id="uid",
            oauth2_sub_for_content_alternate=None,
            profile=None,
            orchestrated_memory_append=None,
            orchestration_branch=None,
        ),
    )
    assert out is bundle
    fake_maybe.assert_awaited_once()


@pytest.mark.unit
def test_parse_orchestration_defer_state_returns_none_without_continue() -> None:
    assert parse_orchestration_defer_state(None) is None
    assert parse_orchestration_defer_state({"reply": "hi"}) is None
    assert parse_orchestration_defer_state({"continue_main_llm": False}) is None


@pytest.mark.unit
def test_parse_orchestration_defer_state_extracts_fields() -> None:
    state = parse_orchestration_defer_state(
        {
            "continue_main_llm": True,
            "memory_section_append": " block ",
            "orchestration_sidecar_actions": [{"type": "open_app", "app": "DocEditor"}],
            "catalog_appendix": "cat",
            "orchestration_branch": "compound_file_chain",
            "turn_plan_hint": "hint",
            "turn_plan_next_tool": "file_open",
            "turn_plan_source": "compound_discuss_then_open",
        },
    )
    assert state is not None
    assert state.memory_append == "block"
    assert len(state.sidecar_actions) == 1
    assert state.catalog_appendix == "cat"
    assert state.branch == "compound_file_chain"
    assert state.turn_plan_hint == "hint"
    assert state.turn_plan_next_tool == "file_open"
    assert state.turn_plan_source == "compound_discuss_then_open"


@pytest.mark.unit
def test_resolve_orchestration_post_bootstrap_terminal_vs_defer_vs_none() -> None:
    from api.ewa_platform.companion.turn.phases.orchestration_defer import (
        resolve_orchestration_post_bootstrap,
    )

    defer = resolve_orchestration_post_bootstrap({"continue_main_llm": True, "orchestration_branch": "workflow"})
    assert defer.kind == "defer"
    assert defer.defer.branch_defer == "workflow"

    terminal = resolve_orchestration_post_bootstrap({"reply": "done", "actions": []})
    assert terminal.kind == "terminal"
    assert terminal.defer.sidecar_actions == []

    none = resolve_orchestration_post_bootstrap(None)
    assert none.kind == "none"


@pytest.mark.unit
def test_complete_orchestration_terminal_short_circuit_delegates_phases(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.ewa_platform.companion.turn.phases.orchestration_terminal_persist import (
        OrchestrationTerminalPersistResult,
        OrchestrationTerminalRevisionOutcome,
    )
    from api.ewa_platform.companion.turn.phases.orchestration_terminal_prepare import (
        OrchestrationTerminalPrepareResult,
    )
    from api.ewa_platform.companion.turn.phases.orchestration_terminal_shortcircuit import (
        complete_orchestration_terminal_short_circuit,
    )

    prep = OrchestrationTerminalPrepareResult(
        branch="catalog_file_list",
        parsed_actions=[{"type": "noop"}],
        desktop_config_patch_applied=True,
        audit_actions=[],
        reply="terminal reply",
    )
    persist = OrchestrationTerminalPersistResult(
        outcome=OrchestrationTerminalRevisionOutcome.OK,
        patched={"companion_revision": 4},
        patch_succeeded=True,
        companion_revision=4,
        memories_added=0,
        catalog_preferences_changed=False,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.orchestration_terminal_shortcircuit.prepare_orchestration_terminal_reply_and_actions",
        AsyncMock(return_value=prep),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.orchestration_terminal_shortcircuit.persist_orchestration_terminal_turn",
        AsyncMock(return_value=persist),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.orchestration_terminal_shortcircuit.build_enriched_orchestration_terminal_final_payload",
        lambda *_a, **_k: {"reply": "terminal reply", "companion_revision": 4},
    )

    result = asyncio.run(
        complete_orchestration_terminal_short_circuit(
            AsyncMock(),
            orchestrated={"reply": "terminal reply"},
            user_line="hi",
            shell_norm=None,
            principal_id="p1",
            intent_plan=None,
            profile={"seed_persona_id": "parent"},
            lp={},
            history=[{"role": "user", "content": "hi"}],
            bearer_token=None,
            auth_user=None,
            arlika_hostile=False,
            skip_heavy_steps=True,
            transformed_this_turn=False,
            transform_event_kind=None,
            companion_turn_routing_for_ambient=None,
            trust_delta=None,
            execution_reports=[],
            revision_conflict_mode="fail",
            audit_action="chat_message_task_orchestrated_stream",
            actions_log_source="task_orchestrator_stream",
        ),
    )
    assert result.prep.reply == "terminal reply"
    assert result.final_payload["companion_revision"] == 4


@pytest.mark.unit
def test_build_orchestration_terminal_final_payload_core_fields() -> None:
    payload = build_orchestration_terminal_final_payload(
        {"task_run": {"id": "run-1"}},
        reply="ok",
        companion_revision=7,
        parsed_actions=[{"type": "open_app", "app": "DocEditor"}],
        desktop_config_patch_applied=True,
        transformed_this_turn=False,
        transform_event_kind=None,
    )
    assert payload["reply"] == "ok"
    assert payload["companion_revision"] == 7
    assert payload["actions"] == [{"type": "open_app", "app": "DocEditor", "task_run_id": "run-1"}]
    assert payload["task_run"] == {"id": "run-1"}
    assert payload["desktop_config_patch_applied"] is True
    assert payload["transformed_this_turn"] is False
    assert payload["transform_event_kind"] is None
    assert "turn_plan_hint" not in payload
    assert "output_surface" not in payload


@pytest.mark.unit
def test_build_orchestration_terminal_final_payload_turn_plan_and_surface() -> None:
    payload = build_orchestration_terminal_final_payload(
        {
            "turn_plan_hint": " hint ",
            "turn_plan_next_tool": " file_open ",
            "turn_plan_source": " compound ",
            "output_surface": {"mode": "file_list", "items": []},
        },
        reply="list",
        companion_revision=1,
        parsed_actions=[],
        desktop_config_patch_applied=False,
        transformed_this_turn=True,
        transform_event_kind="arlika",
    )
    assert payload["turn_plan_hint"] == "hint"
    assert payload["turn_plan_next_tool"] == "file_open"
    assert payload["turn_plan_source"] == "compound"
    assert payload["output_surface"] == {"mode": "file_list", "items": []}
    assert payload["transformed_this_turn"] is True
    assert payload["transform_event_kind"] == "arlika"


@pytest.mark.unit
def test_sanitize_orchestration_terminal_actions_strips_musicplayer_on_chit_chat() -> None:
    from api.ewa_platform.companion.turn.phases.orchestration_terminal_prepare import (
        sanitize_orchestration_terminal_actions,
    )

    actions = [
        {"type": "open_app", "app_component": "MusicPlayer"},
        {"type": "open_app", "app_component": "DocEditor"},
    ]
    out = sanitize_orchestration_terminal_actions("привет", actions, principal_id="p1")
    assert out == [{"type": "open_app", "app_component": "DocEditor"}]


@pytest.mark.unit
def test_prepare_orchestration_terminal_reply_and_actions(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.companion.turn.phases.orchestration_terminal_prepare import (
        prepare_orchestration_terminal_reply_and_actions,
    )

    async def fake_apply(
        actions: list[dict[str, Any]],
        *,
        bearer_token: str | None,
        auth_user: object | None,
    ) -> tuple[list[dict[str, Any]], bool]:
        _ = bearer_token, auth_user
        return actions, False

    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.orchestration_terminal_prepare.companion_apply_patch_desktop_config_actions",
        fake_apply,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.orchestration_terminal_prepare.coerce_visible_reply_for_turn",
        lambda raw, **kwargs: str(raw or "fallback"),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.orchestration_terminal_prepare.merge_visible_reply_catalog_appendix",
        lambda visible, appendix: f"{visible}|{appendix}".strip("|"),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.orchestration_terminal_prepare.enforce_arlika_hostile_tone_guard",
        lambda reply, **kwargs: reply,
    )

    result = asyncio.run(
        prepare_orchestration_terminal_reply_and_actions(
            {
                "reply": "hello",
                "orchestration_branch": "catalog_file_list",
                "catalog_appendix": "facts",
                "actions": [],
            },
            user_line="привет",
            shell_norm=None,
            principal_id="p1",
            intent_plan=None,
            profile={"seed_persona_id": "parent"},
            bearer_token=None,
            auth_user=None,
        ),
    )
    assert result.branch == "catalog_file_list"
    assert result.reply == "hello|facts"
    assert result.desktop_config_patch_applied is False
    assert result.audit_actions == []


@pytest.mark.unit
def test_enforce_arlika_hostile_tone_guard_adds_edge_on_warm_small_talk() -> None:
    from api.ewa_platform.companion.turn.phases.visible_reply import enforce_arlika_hostile_tone_guard

    out = enforce_arlika_hostile_tone_guard(
        "Спасибо, рада помочь!",
        user_line="спасибо",
        actions=[],
        persona_seed="arlika",
    )
    assert "индульгенцией" in out.lower() or "absolution" in out.lower()


@pytest.mark.unit
def test_prepare_main_llm_turn_context_delegates_prefetch_and_builds_messages(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.ewa_platform.companion.turn.phases.main_llm_prepare import prepare_main_llm_turn_context

    fake_bundle = None
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_prepare.prefetch_catalog_find_bundle_for_turn",
        AsyncMock(return_value=fake_bundle),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_prepare.run_context_controller_for_turn",
        AsyncMock(return_value={}),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_prepare.compose_memory_for_chat_turn",
        AsyncMock(return_value=None),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_prepare.fetch_companion_ground_truth_markdown",
        AsyncMock(return_value=""),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_prepare.merged_anchor_for_prompt",
        lambda _p: ("", None),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_prepare.active_plan_prompt_block",
        AsyncMock(return_value=""),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_prepare.active_calendar_prompt_block",
        AsyncMock(return_value=""),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_prepare.active_task_runs_prompt_block",
        AsyncMock(return_value=""),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_prepare.companion_meta_prompt_block",
        lambda _p: "",
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_prepare.build_companion_system_prompt",
        lambda *a, **k: "SYS",
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_prepare.companion_llm_user_assistant_slice_for_http",
        lambda _profile, _history: [{"role": "user", "content": "hi"}],
    )

    result = asyncio.run(
        prepare_main_llm_turn_context(
            AsyncMock(),
            profile={"seed_persona_id": "parent", "companion_revision": 1},
            lp={},
            history=[{"role": "user", "content": "hi"}],
            principal_id="p1",
            user_line="hi",
            intent_plan=None,
            shell_norm=None,
            skip_heavy_steps=True,
            orchestrated_memory_append=None,
            orchestration_branch=None,
            content_catalog_user_id=None,
            oauth2_sub_for_content_alternate=None,
            arlika_quarrel_turn=False,
            vision_data_url=None,
            telemetry_channel="sync",
        ),
    )
    assert result.catalog_bundle is None
    assert result.system_prompt == "SYS"
    assert result.llm_messages[0]["content"] == "SYS"
    assert result.llm_messages[-1]["content"] == "hi"


@pytest.mark.unit
def test_build_main_llm_final_payload_includes_turn_plan_fields() -> None:
    from api.ewa_platform.companion.turn.phases.main_llm_persist import build_main_llm_final_payload

    payload = build_main_llm_final_payload(
        reply="ok",
        companion_revision=3,
        parsed_actions=[{"type": "noop"}],
        desktop_config_patch_applied=True,
        transformed_this_turn=False,
        transform_event_kind=None,
        orchestrated_turn_plan_hint="next",
        orchestrated_turn_plan_next_tool="music_generation",
        orchestrated_turn_plan_source="plan_v1",
        catalog_output_surface={"mode": "file_list"},
    )
    assert payload["reply"] == "ok"
    assert payload["companion_revision"] == 3
    assert payload["turn_plan_hint"] == "next"
    assert payload["output_surface"] == {"mode": "file_list"}


@pytest.mark.unit
def test_build_enriched_main_llm_final_payload_merges_persist(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.companion.turn.phases.main_llm_persist import (
        MainLlmPersistResult,
        MainLlmRevisionOutcome,
        build_enriched_main_llm_final_payload,
    )

    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_persist.enrich_turn_protocol_payload",
        lambda payload, **kwargs: payload.update({"enriched": True}) or payload,
    )
    persist = MainLlmPersistResult(
        outcome=MainLlmRevisionOutcome.OK,
        patched={"companion_revision": 7},
        companion_revision=7,
        lp={"desktop_friend_chat_v1": {"messages": []}},
        memories_added=0,
        catalog_preferences_changed=False,
    )
    out = build_enriched_main_llm_final_payload(
        reply="hi",
        persist=persist,
        parsed_actions=[],
        desktop_config_patch_applied=False,
        transformed_this_turn=False,
        transform_event_kind=None,
        execution_reports=None,
        orchestrated=None,
        shell_norm={
            "web_search_result": {
                "schema_version": 1,
                "query": "current rate",
                "result_count": 1,
                "results": [{"title": "Central bank", "url": "https://example.test"}],
            }
        },
        user_line="hello",
    )
    assert out["reply"] == "hi"
    assert out["companion_revision"] == 7
    assert out.get("enriched") is True
    assert out["web_search_result"]["results"][0]["title"] == "Central bank"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_persist_and_build_main_llm_final_attaches_surface_blocks_when_requested(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.ewa_platform.companion.turn.phases.main_llm_persist import (
        MainLlmPersistAndFinalResult,
        MainLlmPersistResult,
        MainLlmRevisionOutcome,
        persist_and_build_main_llm_final,
    )

    persist = MainLlmPersistResult(
        outcome=MainLlmRevisionOutcome.OK,
        patched={"companion_revision": 2},
        companion_revision=2,
        lp={"desktop_friend_chat_v1": {"messages": []}},
        memories_added=0,
        catalog_preferences_changed=False,
    )

    async def _fake_persist(*_args: object, **_kwargs: object) -> MainLlmPersistResult:
        return persist

    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_persist.persist_main_llm_turn",
        _fake_persist,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_persist.enrich_turn_protocol_payload",
        lambda payload, **kwargs: payload,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.surface_blocks.attach_surface_blocks_to_chat_payload",
        lambda payload: {**payload, "surface_blocks": ["x"]},
    )

    without = await persist_and_build_main_llm_final(
        AsyncMock(),
        reply="ok",
        user_line="hi",
        profile={"companion_revision": 2},
        lp={},
        history=[],
        parsed_memories=None,
        principal_id="p1",
        arlika_hostile=False,
        skip_heavy_steps=True,
        transformed_this_turn=False,
        desktop_config_patch_applied=False,
        intent_plan=None,
        companion_turn_routing_for_ambient=None,
        trust_delta=None,
        audit_actions=None,
        audit_action="chat_message",
        audit_action_retry="chat_message_retry",
        actions_log_source="sync_post",
        actions_log_source_retry="sync_post_retry",
        model_raw="raw",
        parsed_actions=[],
        transform_event_kind=None,
        execution_reports=None,
        orchestrated=None,
        shell_norm=None,
    )
    assert isinstance(without, MainLlmPersistAndFinalResult)
    assert without.persist.companion_revision == 2
    assert "surface_blocks" not in without.final_payload

    with_blocks = await persist_and_build_main_llm_final(
        AsyncMock(),
        reply="ok",
        user_line="hi",
        profile={"companion_revision": 2},
        lp={},
        history=[],
        parsed_memories=None,
        principal_id="p1",
        arlika_hostile=False,
        skip_heavy_steps=True,
        transformed_this_turn=False,
        desktop_config_patch_applied=False,
        intent_plan=None,
        companion_turn_routing_for_ambient=None,
        trust_delta=None,
        audit_actions=None,
        audit_action="chat_message_stream",
        audit_action_retry="chat_message_stream_retry",
        actions_log_source="stream",
        actions_log_source_retry="stream_retry",
        model_raw="raw",
        parsed_actions=[],
        transform_event_kind=None,
        execution_reports=None,
        orchestrated=None,
        shell_norm=None,
        attach_surface_blocks=True,
    )
    assert with_blocks.final_payload.get("surface_blocks") == ["x"]


@pytest.mark.unit
def test_build_enriched_orchestration_terminal_final_payload_merges_prep_and_persist() -> None:
    from api.ewa_platform.companion.turn.phases.orchestration_terminal_persist import (
        OrchestrationTerminalPersistResult,
        OrchestrationTerminalRevisionOutcome,
        build_enriched_orchestration_terminal_final_payload,
    )
    from api.ewa_platform.companion.turn.phases.orchestration_terminal_prepare import (
        OrchestrationTerminalPrepareResult,
    )

    prep = OrchestrationTerminalPrepareResult(
        branch="catalog_file_list",
        parsed_actions=[],
        desktop_config_patch_applied=False,
        audit_actions=[],
        reply="ok",
    )
    persist = OrchestrationTerminalPersistResult(
        outcome=OrchestrationTerminalRevisionOutcome.OK,
        patched={"companion_revision": 9},
        patch_succeeded=True,
        companion_revision=9,
        memories_added=0,
        catalog_preferences_changed=False,
    )
    payload = build_enriched_orchestration_terminal_final_payload(
        {"orchestration_branch": "catalog_file_list"},
        prep=prep,
        persist=persist,
        transformed_this_turn=False,
        transform_event_kind=None,
        execution_reports=None,
        learned_preferences={},
        shell_norm=None,
        user_line="hi",
    )
    assert payload["reply"] == "ok"
    assert payload["companion_revision"] == 9


def _patch_finalize_chat_turn_guards(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.turn_action_prelude.prepend_auto_ambient_from_affective",
        lambda actions, *_a, **_k: list(actions),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.turn_action_prelude.apply_arlika_quarrel_post_llm_guards",
        lambda visible, actions, **_k: (visible, list(actions)),
    )


@pytest.mark.unit
def test_finalize_main_llm_turn_sync_returns_reply_and_actions(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.companion.turn.phases.main_llm_finalize import finalize_main_llm_turn_after_llm

    _patch_finalize_chat_turn_guards(monkeypatch)
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_finalize.companion_apply_patch_desktop_config_actions",
        AsyncMock(return_value=([{"type": "noop"}], False)),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_finalize.self_correction_enabled",
        lambda: False,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_finalize.coerce_visible_reply_for_turn",
        lambda visible, **_k: visible.strip(),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_finalize.apply_companion_visible_reply_guards",
        lambda reply, **_k: reply,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_finalize.enforce_arlika_hostile_tone_guard",
        lambda reply, **_k: reply,
    )

    result = asyncio.run(
        finalize_main_llm_turn_after_llm(
            AsyncMock(),
            reply_visible_raw="  hello  ",
            parsed_actions=[{"type": "noop"}],
            user_line="привет",
            profile={"seed_persona_id": "parent"},
            shell_norm=None,
            intent_plan=None,
            principal_id="p1",
            model_raw="test-model",
            bearer_token=None,
            auth_user=None,
            companion_turn_routing_for_ambient=None,
            arlika_quarrel_turn=False,
            skip_heavy_steps=True,
            orchestrated_branch_defer=None,
            orchestrated_turn_plan_next_tool=None,
            catalog_appendix="",
            desktop_config_patch_applied=False,
            telemetry_channel="sync",
        ),
    )
    assert result.reply == "hello"
    assert result.parsed_actions == [{"type": "noop"}]
    assert result.sse_delta_chunks == ()


@pytest.mark.unit
def test_finalize_main_llm_turn_stream_emits_fallback_delta_on_blankish(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.companion.turn.phases.main_llm_finalize import finalize_main_llm_turn_after_llm

    _patch_finalize_chat_turn_guards(monkeypatch)
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_finalize.companion_apply_patch_desktop_config_actions",
        AsyncMock(return_value=([], False)),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_finalize.self_correction_enabled",
        lambda: False,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_finalize.coerce_visible_reply_for_turn",
        lambda visible, **_k: "",
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_finalize.apply_companion_visible_reply_guards",
        lambda reply, **_k: reply,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_finalize.enforce_arlika_hostile_tone_guard",
        lambda reply, **_k: reply,
    )

    result = asyncio.run(
        finalize_main_llm_turn_after_llm(
            AsyncMock(),
            reply_visible_raw="",
            parsed_actions=[],
            user_line="привет",
            profile={"seed_persona_id": "parent"},
            shell_norm=None,
            intent_plan=None,
            principal_id="p1",
            model_raw="test-model",
            bearer_token=None,
            auth_user=None,
            companion_turn_routing_for_ambient=None,
            arlika_quarrel_turn=False,
            skip_heavy_steps=True,
            orchestrated_branch_defer=None,
            orchestrated_turn_plan_next_tool=None,
            catalog_appendix="",
            desktop_config_patch_applied=False,
            telemetry_channel="stream",
        ),
    )
    assert result.reply
    assert len(result.sse_delta_chunks) == 1
    assert result.sse_delta_chunks[0] == result.reply


@pytest.mark.unit
def test_finalize_main_llm_turn_stream_json_envelope_buffered_delta(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.companion.turn.phases.main_llm_finalize import finalize_main_llm_turn_after_llm

    _patch_finalize_chat_turn_guards(monkeypatch)
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_finalize.companion_apply_patch_desktop_config_actions",
        AsyncMock(return_value=([], False)),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_finalize.self_correction_enabled",
        lambda: False,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_finalize.coerce_visible_reply_for_turn",
        lambda visible, **_k: visible,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_finalize.apply_companion_visible_reply_guards",
        lambda reply, **_k: reply,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_finalize.enforce_arlika_hostile_tone_guard",
        lambda reply, **_k: reply,
    )

    result = asyncio.run(
        finalize_main_llm_turn_after_llm(
            AsyncMock(),
            reply_visible_raw="visible",
            parsed_actions=[],
            user_line="hi",
            profile={"seed_persona_id": "parent"},
            shell_norm=None,
            intent_plan=None,
            principal_id="p1",
            model_raw="test-model",
            bearer_token=None,
            auth_user=None,
            companion_turn_routing_for_ambient=None,
            arlika_quarrel_turn=False,
            skip_heavy_steps=True,
            orchestrated_branch_defer=None,
            orchestrated_turn_plan_next_tool=None,
            catalog_appendix="",
            desktop_config_patch_applied=False,
            telemetry_channel="stream",
            sse_json_envelope_buffered=True,
        ),
    )
    assert result.reply == "visible"
    assert result.sse_delta_chunks == ("visible",)


@pytest.mark.unit
def test_should_use_nonstream_doc_replace_true_for_translate_intent(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.companion.turn.phases.main_llm_stream_llm import should_use_nonstream_doc_replace

    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_stream_llm.companion_doc_body_translate_enabled",
        lambda: True,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_stream_llm.companion_user_intent_translate_replace_editor",
        lambda _line: True,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_stream_llm.companion_doc_body_edit_enabled",
        lambda: False,
    )
    assert should_use_nonstream_doc_replace("переведи документ в редакторе", None) is True


@pytest.mark.unit
def test_consume_main_llm_stream_tokens_buffers_json_envelope(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.companion.turn.phases.main_llm_stream_llm import consume_main_llm_stream_tokens

    async def fake_stream(*_a: object, **_k: object):
        for piece in ('{"visible_reply":"', "Hi", '"}'):
            yield piece

    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_stream_llm.httpx_compat_chat_completion_stream",
        fake_stream,
    )

    accum = asyncio.run(
        consume_main_llm_stream_tokens(
            AsyncMock(),
            "http://llm",
            model="m",
            messages=[],
            options={},
            timeout=AsyncMock(),
        ),
    )
    assert accum.json_envelope_buffered is True
    assert accum.token_delta_chunks == ()
    assert accum.reply_raw.endswith("Hi" + '"}')


@pytest.mark.unit
def test_process_main_llm_raw_reply_delegates_extract_and_finalize(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.companion.turn.phases.main_llm_post_extract import process_main_llm_raw_reply

    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_post_extract.extract_visible_reply_memory_actions",
        lambda _raw: ("visible", [{"kind": "fact"}], [{"type": "noop"}]),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_post_extract.finalize_companion_actions",
        AsyncMock(return_value=([{"type": "noop"}], "cat-md")),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_post_extract.maybe_persist_companion_file_focus",
        AsyncMock(),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_post_extract.augment_translate_and_scrub_visible_reply_for_doc_body",
        AsyncMock(return_value=([{"type": "noop"}], "visible scrubbed")),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.main_llm_post_extract.merge_visible_reply_catalog_appendix_unless_surface",
        lambda visible, appendix, _surface: f"{visible}\n{appendix}",
    )

    result = asyncio.run(
        process_main_llm_raw_reply(
            AsyncMock(),
            AsyncMock(),
            base_url="http://llm",
            model_raw="m",
            timeout=AsyncMock(),
            reply_raw='{"visible_reply":"visible"}',
            user_line="hi",
            principal_id="p1",
            content_catalog_user_id=None,
            oauth2_sub_for_content_alternate=None,
            shell_norm=None,
            catalog_bundle=None,
            profile={"seed_persona_id": "parent"},
        ),
    )
    assert result.reply_visible_raw == "visible scrubbed\ncat-md"
    assert result.catalog_appendix == "cat-md"
    assert result.parsed_actions == [{"type": "noop"}]


@pytest.mark.unit
def test_normalize_companion_chat_history_truncates_tail() -> None:
    from api.ewa_platform.companion.turn.phases.turn_bootstrap import normalize_companion_chat_history

    rows = [{"role": "user", "content": f"m{i}"} for i in range(300)]
    out = normalize_companion_chat_history(rows)
    assert len(out) == 240
    assert out[0]["content"] == "m60"


@pytest.mark.unit
def test_skip_heavy_companion_steps_for_arlika_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.companion.turn.phases.turn_bootstrap import skip_heavy_companion_steps_for_turn

    monkeypatch.delenv("EWA_COMPANION_ARLIKA_HEAVY_STEPS", raising=False)
    assert skip_heavy_companion_steps_for_turn(user_line="hi", persona_seed="arlika") is True
    monkeypatch.setenv("EWA_COMPANION_ARLIKA_HEAVY_STEPS", "1")
    assert skip_heavy_companion_steps_for_turn(user_line="hi", persona_seed="arlika") is False


@pytest.mark.unit
def test_bootstrap_companion_turn_context_builds_history_and_skips_quarrel_orchestration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.ewa_platform.companion.sidecar.trust_turn import CompanionTrustClassifySignals
    from api.ewa_platform.companion.turn.phases.turn_bootstrap import bootstrap_companion_turn_context

    profile = {
        "seed_persona_id": "arlika",
        "learned_preferences": {"desktop_friend_chat_v1": {"messages": [{"role": "user", "content": "prev"}]}},
    }
    trust = CompanionTrustClassifySignals(trust_delta=0.0, abuse_at_peak=False, argumentative_quarrel=True)

    async def fake_trust(*_a: object, **_k: object):
        return profile, False, False, None, trust

    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.turn_bootstrap.ewa_companion_trust_pre_turn",
        fake_trust,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.turn_bootstrap.try_apply_arlika_v2_chat_mode_switch",
        AsyncMock(return_value=(profile, False, None)),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.turn_bootstrap.companion_recent_episode_snippets",
        AsyncMock(return_value=()),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.turn_bootstrap.affective_route",
        lambda **_k: object(),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.turn_bootstrap.fetch_companion_intent_plan",
        AsyncMock(return_value=None),
    )
    orch = AsyncMock()
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.turn_bootstrap.maybe_handle_companion_task_orchestration",
        orch,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.turn_bootstrap._companion_arlika_v1_hostile",
        lambda _p: True,
    )

    boot = asyncio.run(
        bootstrap_companion_turn_context(
            AsyncMock(),
            AsyncMock(),
            principal_id="p1",
            profile=profile,
            user_line="зачем ты так",
            shell_norm=None,
            base_url="http://llm",
            classify_model="m",
            timeout=AsyncMock(),
            content_catalog_user_id=None,
            oauth2_sub_for_content_alternate=None,
            bearer_token=None,
            auth_user=AsyncMock(),
            image_attachment=None,
            vision_data_url=None,
            telemetry_channel="sync",
        ),
    )
    assert boot.history[-1]["role"] == "user"
    assert boot.arlika_quarrel_turn is True
    assert boot.orchestrated is None
    orch.assert_not_awaited()


@pytest.mark.unit
def test_bootstrap_companion_turn_context_skips_orchestration_for_vision(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.ewa_platform.companion.sidecar.trust_turn import CompanionTrustClassifySignals
    from api.ewa_platform.companion.turn.phases.turn_bootstrap import bootstrap_companion_turn_context

    profile = {
        "seed_persona_id": "parent",
        "learned_preferences": {"desktop_friend_chat_v1": {"messages": []}},
    }
    trust = CompanionTrustClassifySignals(trust_delta=0.0, abuse_at_peak=False, argumentative_quarrel=False)

    async def fake_trust(*_a: object, **_k: object):
        return profile, False, False, None, trust

    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.turn_bootstrap.ewa_companion_trust_pre_turn",
        fake_trust,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.turn_bootstrap.try_apply_arlika_v2_chat_mode_switch",
        AsyncMock(return_value=(profile, False, None)),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.turn_bootstrap.companion_recent_episode_snippets",
        AsyncMock(return_value=()),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.turn_bootstrap.affective_route",
        lambda **_k: object(),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.turn_bootstrap.fetch_companion_intent_plan",
        AsyncMock(return_value=None),
    )
    orch = AsyncMock()
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.turn_bootstrap.maybe_handle_companion_task_orchestration",
        orch,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.turn_bootstrap._companion_arlika_v1_hostile",
        lambda _p: False,
    )

    boot = asyncio.run(
        bootstrap_companion_turn_context(
            AsyncMock(),
            AsyncMock(),
            principal_id="p1",
            profile=profile,
            user_line="Что на этой картинке?",
            shell_norm=None,
            base_url="http://llm",
            classify_model="m",
            timeout=AsyncMock(),
            content_catalog_user_id=None,
            oauth2_sub_for_content_alternate=None,
            bearer_token=None,
            auth_user=AsyncMock(),
            image_attachment={"mime_type": "image/png", "data_base64": "iVBORw0KGgo="},
            vision_data_url="data:image/png;base64,abc",
            has_image_attachment=True,
            telemetry_channel="sync",
        ),
    )
    assert "[Изображение]" in boot.history[-1]["content"]
    assert boot.orchestrated is None
    orch.assert_not_awaited()
