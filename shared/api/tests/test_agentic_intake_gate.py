# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Phase R0 regression tests for AgenticIntakeGate — anti-hijack routing authority.
# Related:
# - api/ewa_platform/agentic/intake/gate.py
# - api/ewa_platform/companion/turn/phases/turn_entry.py
# ---

from __future__ import annotations

import logging
from typing import Any
from unittest.mock import AsyncMock

import pytest

from api.ewa_platform.agentic.intake.gate import (
    ALL_FILE_SURFACE_DETERMINISTIC_BRANCHES,
    classify_companion_intake,
    intake_verdict_log_fields,
    log_companion_intake_verdict,
)
from tests.test_ewa_agentic_chaos import _kora_dvfu_prompt


def _irina_prompt() -> str:
    body = _kora_dvfu_prompt().replace("Кора", "Подруга", 1)
    return f"/agent {body}"


def _simple_file_rewrite_command() -> str:
    return "перепиши файл strategy.txt полностью замени содержимое на hello"


def test_simple_file_command_stays_deterministic_lane(caplog: pytest.LogCaptureFixture) -> None:
    line = _simple_file_rewrite_command()
    verdict = classify_companion_intake(line)

    with caplog.at_level(logging.INFO):
        log_companion_intake_verdict(line, verdict)

    assert verdict.lane == "deterministic"
    assert verdict.reason == "single_file_micro_intent"
    assert "file_rewrite" not in verdict.block_deterministic_branches

    fields = intake_verdict_log_fields(verdict)
    assert fields["lane"] == "deterministic"
    assert any("companion_intake_verdict" in rec.message for rec in caplog.records)
    assert any("lane=deterministic" in rec.message for rec in caplog.records)


def test_irina_prompt_is_agentic_mandatory(caplog: pytest.LogCaptureFixture) -> None:
    line = _irina_prompt()
    verdict = classify_companion_intake(line)

    with caplog.at_level(logging.INFO):
        log_companion_intake_verdict(line, verdict)

    assert verdict.lane == "agentic_mandatory"
    assert verdict.explicit_agent_prefix is True
    assert verdict.strategic_intent is True
    assert "file_rewrite" in verdict.block_deterministic_branches
    assert verdict.block_deterministic_branches == ALL_FILE_SURFACE_DETERMINISTIC_BRANCHES

    fields = intake_verdict_log_fields(verdict)
    assert fields["lane"] == "agentic_mandatory"
    assert "file_rewrite" in fields["blocked"]
    assert any("lane=agentic_mandatory" in rec.message for rec in caplog.records)


def test_complex_agent_prompt_blocks_file_rewrite_deterministic_path() -> None:
    line = "/agent Составь документ strategy.txt и дорожную карту EliteEW на 3 этапа."
    verdict = classify_companion_intake(line)

    assert verdict.lane == "agentic_mandatory"
    assert "file_rewrite" in verdict.block_deterministic_branches


@pytest.mark.asyncio
async def test_deterministic_router_skips_blocked_file_rewrite(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.companion.orchestration import deterministic_router as dr

    line = "/agent Create a file named strategy.txt and build a 3-part roadmap for EliteEW."
    verdict = classify_companion_intake(line)
    assert "file_rewrite" in verdict.block_deterministic_branches

    run_calls: list[str] = []

    async def _fake_run(branch: str, *, user_line: str, tool_ctx: object) -> dict[str, Any] | None:
        run_calls.append(branch)
        if branch == "file_rewrite":
            return {
                "reply": "hijacked",
                "orchestration_branch": "file_rewrite",
            }
        return None

    monkeypatch.setattr(dr, "_workflow_surface_response", AsyncMock(return_value=None))
    monkeypatch.setattr(dr, "_active_operations_response", AsyncMock(return_value=None))
    monkeypatch.setattr(dr, "_run_exact_tool_branch", _fake_run)
    monkeypatch.setenv("EWA_COMPANION_DETERMINISTIC_ROUTER", "1")

    out = await dr.maybe_route_deterministic_turn(
        object(),  # type: ignore[arg-type]
        principal_id="p-1",
        user_line=line,
        shell_norm=None,
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
        bearer_token=None,
        auth_user=None,
        profile={},
        blocked_branches=verdict.block_deterministic_branches,
    )

    assert out is None
    assert "file_rewrite" not in run_calls


@pytest.mark.asyncio
async def test_turn_entry_routes_irina_to_agentic_not_file_rewrite(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.companion.turn.phases import turn_entry

    line = _irina_prompt()
    agentic_payload = {
        "reply": "Запускаю автономную сессию.",
        "orchestration_branch": "agentic_session",
        "orchestrated": True,
        "task_run": {"id": "run-irina"},
        "intake_verdict": {"lane": "agentic_mandatory"},
    }

    monkeypatch.setenv("EWA_AGENTIC_INTAKE_GATE", "1")
    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.agentic_asyncpg.agentic_session_fetch_active_for_principal",
        AsyncMock(return_value=None),
    )
    monkeypatch.setattr(
        turn_entry,
        "resolve_agentic_intake_turn",
        AsyncMock(return_value=agentic_payload),
    )
    deterministic_mock = AsyncMock(return_value={"reply": "hijacked", "orchestration_branch": "file_rewrite"})
    monkeypatch.setattr(turn_entry, "maybe_route_deterministic_turn", deterministic_mock)

    msg_ctx = turn_entry.TurnMessageContext(
        shell_norm=None,
        user_line=line,
        vision_data_url=None,
    )
    profile = {"companion_revision": 1}

    out = await turn_entry._pre_llm_turn_route(
        object(),  # type: ignore[arg-type]
        principal_id="p-1",
        client_turn_id=None,
        profile=profile,
        msg_ctx=msg_ctx,
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
        bearer_token=None,
        auth_user=None,  # type: ignore[arg-type]
    )

    assert out is not None
    assert out["orchestration_branch"] == "agentic_session"
    assert out.get("task_run") == {"id": "run-irina"}
    deterministic_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_mandatory_intake_always_starts_session(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.agentic.intake.turn_resolver import resolve_agentic_intake_turn

    line = _irina_prompt().removeprefix("/agent ").strip()
    verdict = classify_companion_intake(line)
    assert verdict.lane == "agentic_mandatory"

    start_mock = AsyncMock(
        return_value={
            "ok": True,
            "reply": "Запускаю автономную задачу.",
            "task_run": {"id": "run-mandatory"},
        }
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.intake.turn_resolver.maybe_handle_agentic_companion_turn",
        AsyncMock(return_value=None),
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.intake.turn_resolver.agentic_substrate_enabled",
        lambda: True,
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.intake.turn_resolver.start_agentic_session",
        start_mock,
    )

    out = await resolve_agentic_intake_turn(
        object(),  # type: ignore[arg-type]
        principal_id="p-mandatory",
        user_line=line,
        verdict=verdict,
    )

    assert out.get("task_run") == {"id": "run-mandatory"}
    start_mock.assert_awaited_once()
