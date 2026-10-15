#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock blueprint council speech/document separation at the SSE and persisted
# transcript boundary without calling the external LLM.
# Invariants:
# - Council turn text is speech-only while document_text keeps the full step body.
# - Blueprint completion emits a deterministic closing turn.
# - Blueprint finalize logs [METRIC] ensemble_council_budget with parallel=0.
# Related:
# - services/desktop_chat_ensemble/blueprint/stream_step_loop.py
# - documentation/product/DESKTOP-LLAMA-CHAT.md
# ---
"""Blueprint council behavioral regression tests."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import AsyncIterator
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

pytest.importorskip("sqlalchemy")

from api.services.desktop_chat_ensemble.archive.legacy_freeform.council_transcript import (
    CouncilTranscriptAccumulator,
)
from api.services.desktop_chat_ensemble.blueprint.artifact_finalizer import (
    ArtifactFinalizationResult,
)
from api.services.desktop_chat_ensemble.blueprint.assign import StepAssignment
from api.services.desktop_chat_ensemble.blueprint.catalog import (
    DocumentOutlineSection,
    PlanStep,
    PlanTemplate,
)
from api.services.desktop_chat_ensemble.blueprint.council import (
    generate_blueprint_council_speech,
)
from api.services.desktop_chat_ensemble.blueprint.stream_finalize import (
    blueprint_turn_error_sse,
    format_ensemble_council_budget_metric,
    iter_blueprint_finalize,
    log_blueprint_council_budget,
)
from api.services.desktop_chat_ensemble.blueprint.stream_planning import (
    BlueprintPlanningGate,
    BlueprintPlanReady,
)
from api.services.desktop_chat_ensemble.blueprint.stream_step_loop import (
    BlueprintStepLoopGate,
    BlueprintStepLoopResult,
    iter_blueprint_step_loop,
)
from api.services.desktop_chat_ensemble.blueprint.stream_turn import stream_blueprint_turn


def _event(line: str) -> dict[str, Any] | None:
    if not line.startswith("data: "):
        return None
    return json.loads(line.removeprefix("data: ").strip())


def _council_budget_metric(caplog: pytest.LogCaptureFixture) -> str:
    return next(rec.getMessage() for rec in caplog.records if "[METRIC] ensemble_council_budget" in rec.getMessage())


@pytest.mark.asyncio
async def test_blueprint_speech_repairs_document_like_first_response() -> None:
    llama = AsyncMock()
    llama.__aenter__.return_value = llama
    llama.__aexit__.return_value = False
    llama.chat = AsyncMock(
        side_effect=[
            {"text": json.dumps({"speech": "1. App A\n2. App B\n3. App C"})},
            {
                "text": json.dumps(
                    {"speech": "Коллеги, я сначала проверю ценность этих решений."},
                    ensure_ascii=False,
                )
            },
        ]
    )
    with (
        patch(
            "api.services.desktop_chat_ensemble.blueprint.council.LlamaService",
            return_value=llama,
        ),
        patch(
            "api.services.desktop_chat_ensemble.blueprint.council.ensemble_audit_log.log_stream_turn",
            new=AsyncMock(),
        ),
    ):
        speech = await generate_blueprint_council_speech(
            hero_id="max_safin",
            hero_prompt="Product lead profile.",
            block_title="MVP",
            block_objective="Choose the product core.",
            position=1,
            total=2,
            prior_speech_lines=[],
            base_system="Base.",
            history=[],
            user_text="Discuss the MVP.",
            enriched_user_content="Discuss the MVP.",
            roster=["max_safin", "elena_valeryevna"],
            model="test-model",
            defaults={},
            is_shared=False,
            owner_id=uuid4(),
            speaker_labels={},
        )

    assert speech == "Коллеги, я сначала проверю ценность этих решений."
    assert llama.chat.await_count == 2
    retry_messages = llama.chat.await_args_list[1].args[0]
    assert "похож на документ или список" in retry_messages[-1]["content"]
    assert "максимум один короткий пример" in retry_messages[-1]["content"]


@pytest.mark.asyncio
async def test_blueprint_step_loop_keeps_speeches_out_of_document_sections() -> None:
    steps = [
        PlanStep(
            step_id="s1",
            title="Product",
            instruction_for_model="Write the product section.",
        ),
        PlanStep(
            step_id="s2",
            title="Economics",
            instruction_for_model="Write the economics section.",
        ),
    ]
    template = PlanTemplate(
        id="test_blueprint",
        title="Test document",
        steps=steps,
        document_outline=[
            DocumentOutlineSection(heading="Product", step_ids=["s1"]),
            DocumentOutlineSection(heading="Economics", step_ids=["s2"]),
        ],
    )
    assignments = [
        StepAssignment(step=steps[0], hero_id="max_safin", fallback=False, slot_distance=0),
        StepAssignment(step=steps[1], hero_id="elena_valeryevna", fallback=False, slot_distance=0),
    ]
    plan = BlueprintPlanReady(
        enriched="User evidence and current request.",
        rag_ctx={},
        roster=["max_safin", "elena_valeryevna"],
        model="test-model",
        tpl=template,
        assignments=assignments,
        quality_status={"status": "draft"},
        quality_guard="Keep facts honest.",
        deferred=[],
        stream_t0=time.monotonic(),
        planning_ms=0,
        is_shared=False,
        speaker_labels={},
        use_web_search=False,
    )
    chat = SimpleNamespace(
        id=uuid4(),
        user_id=uuid4(),
        project_id=None,
        use_project_rag=False,
        settings={},
        system_prompt_override=None,
    )
    document_messages: list[list[dict[str, Any]]] = []

    async def _document_stream(**kwargs: object):
        messages = kwargs["messages"]
        assert isinstance(messages, list)
        document_messages.append(messages)
        yield f"Document section {len(document_messages)} with full structured details. " * 4

    speeches = [
        "Коллеги, начнём с пользовательской ценности и уберём лишнее.",
        "Макс, ценность принимаю, но без диапазона затрат решение преждевременно.",
    ]
    gate = BlueprintStepLoopGate()
    with (
        patch(
            "api.services.desktop_chat_ensemble.blueprint.stream_step_loop.action_gate_enabled",
            return_value=False,
        ),
        patch(
            "api.services.desktop_chat_ensemble.blueprint.stream_step_loop.blueprint_prompt_for_hero",
            side_effect=lambda hero_id: f"Profile for {hero_id}",
        ),
        patch(
            "api.services.desktop_chat_ensemble.blueprint.stream_step_loop.generate_blueprint_council_speech",
            new=AsyncMock(side_effect=speeches),
        ),
        patch(
            "api.services.desktop_chat_ensemble.blueprint.stream_step_loop.desktop_stream_chat_completion",
            side_effect=_document_stream,
        ),
        patch(
            "api.services.desktop_chat_ensemble.blueprint.stream_step_loop.ensemble_audit_log.log_stream_turn",
            new=AsyncMock(),
        ),
    ):
        lines = [
            line
            async for line in iter_blueprint_step_loop(
                AsyncMock(),
                chat=chat,
                user_id=chat.user_id,
                history=[],
                user_text="Discuss, then create one document.",
                defaults={},
                kbsew_dpa_block="",
                plan=plan,
                gate=gate,
            )
        ]

    events = [event for line in lines if (event := _event(line)) is not None]
    council_events = [event for event in events if event.get("event") == "council_turn"]
    assert [event["turn"]["kind"] for event in council_events] == [
        "speaker_reply",
        "speaker_reply",
        "closing",
    ]
    assert [event["turn"]["text"] for event in council_events[:2]] == speeches
    assert all("Document section" not in event["turn"]["text"] for event in council_events[:2])
    assert all(messages[-1]["content"].startswith("Теперь создай только секцию") for messages in document_messages)

    assert gate.result is not None
    assert gate.result.council_transcript is not None
    transcript = gate.result.council_transcript.to_dict()
    speaker_turns = [turn for turn in transcript["turns"] if turn["kind"] == "speaker_reply"]
    assert len(speaker_turns) == 2
    assert all("Document section" in turn["document_text"] for turn in speaker_turns)
    assert transcript["closing"] == {"decision": "ok"}


@pytest.mark.asyncio
async def test_step_loop_aclose_after_speech_keeps_transcript_for_budget(
    caplog: pytest.LogCaptureFixture,
) -> None:
    plan, _steps = _product_plan_and_steps(
        roster=["max_safin"],
        replies=[],
    )
    chat = SimpleNamespace(
        id=uuid4(),
        user_id=uuid4(),
        project_id=None,
        use_project_rag=False,
        settings={},
        system_prompt_override=None,
    )

    async def _hang_document(**_kwargs: object):
        yield "partial document token "
        await asyncio.sleep(60)
        yield "never"

    gate = BlueprintStepLoopGate()
    with (
        patch(
            "api.services.desktop_chat_ensemble.blueprint.stream_step_loop.action_gate_enabled",
            return_value=False,
        ),
        patch(
            "api.services.desktop_chat_ensemble.blueprint.stream_step_loop.blueprint_prompt_for_hero",
            return_value="Profile for max_safin",
        ),
        patch(
            "api.services.desktop_chat_ensemble.blueprint.stream_step_loop.generate_blueprint_council_speech",
            new=AsyncMock(return_value="Сначала проверим ценность."),
        ),
        patch(
            "api.services.desktop_chat_ensemble.blueprint.stream_step_loop.desktop_stream_chat_completion",
            new=_hang_document,
        ),
        patch(
            "api.services.desktop_chat_ensemble.blueprint.stream_step_loop.persist_assistant_message_isolated",
            new=AsyncMock(side_effect=AssertionError("aclose must not persist")),
        ),
        patch(
            "api.services.desktop_chat_ensemble.blueprint.stream_step_loop.ensemble_audit_log.log_stream_turn",
            new=AsyncMock(),
        ),
    ):
        agen = iter_blueprint_step_loop(
            AsyncMock(),
            chat=chat,
            user_id=chat.user_id,
            history=[],
            user_text="Build product.",
            defaults={},
            kbsew_dpa_block="",
            plan=plan,
            gate=gate,
        )
        saw_reply = False
        saw_doc_token = False
        async for line in agen:
            event = _event(line)
            if event and event.get("event") == "council_turn" and event.get("turn", {}).get("kind") == "speaker_reply":
                saw_reply = True
            if event and event.get("event") == "token" and "partial document" in str(event.get("delta") or ""):
                saw_doc_token = True
                await agen.aclose()
                break
    assert saw_reply
    assert saw_doc_token
    assert gate.result is not None
    assert gate.result.council_transcript is not None
    replies = [turn for turn in gate.result.council_transcript.turns if turn.kind == "speaker_reply"]
    assert len(replies) == 1
    with caplog.at_level(logging.INFO):
        log_blueprint_council_budget(plan=plan, steps=gate.result, status="cancelled")
    metric = _council_budget_metric(caplog)
    assert "status=cancelled" in metric
    assert "speakers=1" in metric
    assert "last_reply_at_ms=" in metric
    last_ms = int(metric.split("last_reply_at_ms=")[1].split()[0])
    assert last_ms >= 0


@pytest.mark.asyncio
async def test_blueprint_finalize_persists_and_emits_full_council_transcript(
    caplog: pytest.LogCaptureFixture,
) -> None:
    step = PlanStep(
        step_id="s1",
        title="Product",
        instruction_for_model="Write product.",
    )
    template = PlanTemplate(
        id="test_blueprint",
        title="Test document",
        steps=[step],
        document_outline=[DocumentOutlineSection(heading="Product", step_ids=["s1"])],
    )
    assignment = StepAssignment(
        step=step,
        hero_id="max_safin",
        fallback=False,
        slot_distance=0,
    )
    plan = BlueprintPlanReady(
        enriched="request",
        rag_ctx={},
        roster=["max_safin"],
        model="test-model",
        tpl=template,
        assignments=[assignment],
        quality_status={"status": "draft"},
        quality_guard="",
        deferred=[],
        stream_t0=time.monotonic(),
        planning_ms=0,
        is_shared=False,
        speaker_labels={},
        use_web_search=False,
    )
    council = CouncilTranscriptAccumulator(
        mode="joint_document",
        roster=["max_safin"],
    )
    council.append_speaker_reply(
        hero_id="max_safin",
        text="Сначала проверим ценность.",
        index=0,
        document_text="Document section with enough detail for the final artifact.",
    )
    council.append_closing("Кворум собран.", decision="ok")
    steps = BlueprintStepLoopResult(
        bodies={"s1": "Document section with enough detail for the final artifact."},
        contributors=["max_safin"],
        quality_status={"status": "draft"},
        council_transcript=council,
    )
    chat = SimpleNamespace(id=uuid4())
    persisted_id = uuid4()
    persist = AsyncMock(return_value=SimpleNamespace(id=persisted_id))
    finalization = ArtifactFinalizationResult(
        markdown="## Product\n\nDocument section with enough detail for the final artifact.",
        status="verified",
        violations=(),
        repair_attempted=False,
        fallback_used=False,
    )
    with (
        patch(
            "api.services.desktop_chat_ensemble.blueprint.stream_finalize.finalize_artifact",
            new=AsyncMock(return_value=finalization),
        ),
        patch(
            "api.services.desktop_chat_ensemble.blueprint.stream_finalize.persist_assistant_message_isolated",
            new=persist,
        ),
        patch(
            "api.services.desktop_chat_ensemble.blueprint.stream_finalize.record_desktop_chat_turn_memory",
            new=AsyncMock(),
        ),
        patch(
            "api.services.desktop_chat_ensemble.blueprint.stream_finalize.ensemble_audit_log.log_stitched_markdown",
            new=AsyncMock(),
        ),
    ):
        with caplog.at_level(logging.INFO):
            lines = [
                line
                async for line in iter_blueprint_finalize(
                    chat=chat,
                    user_id=uuid4(),
                    user_text="Build product.",
                    defaults={"ensemble_blueprint_polish_enabled": False},
                    plan=plan,
                    steps=steps,
                )
            ]

    persisted_meta = persist.call_args.kwargs["message_metadata"]
    assert persisted_meta["council_transcript"]["turns"][0]["text"] == "Сначала проверим ценность."
    events = [event for line in lines if (event := _event(line)) is not None]
    replacement = next(event for event in events if event.get("event") == "assistant_document_replace")
    done = next(event for event in events if event.get("event") == "done")
    assert replacement["council_transcript"]["closing"] == {"decision": "ok"}
    assert done["council_transcript"] == replacement["council_transcript"]
    metric = _council_budget_metric(caplog)
    assert "speakers=1" in metric
    assert "interludes=0" in metric
    assert "duration_ms=" in metric
    assert "last_reply_at_ms=" in metric
    assert "parallel=0" in metric
    assert "mode=joint_document" in metric
    assert "engine=blueprint" in metric
    assert "status=ok" in metric


def test_format_ensemble_council_budget_metric_tags_engine_and_last_reply() -> None:
    line = format_ensemble_council_budget_metric(
        speakers=3,
        interludes=2,
        duration_ms=12000,
        last_reply_at_ms=4000,
        planning_ms=800,
        speech_ms=2500,
        document_ms=6100,
        mode="joint_document",
        status="ok",
    )
    assert line == (
        "[METRIC] ensemble_council_budget speakers=3 interludes=2 "
        "duration_ms=12000 last_reply_at_ms=4000 "
        "planning_ms=800 speech_ms=2500 document_ms=6100 "
        "parallel=0 mode=joint_document engine=blueprint status=ok"
    )


def test_blueprint_turn_error_sse_maps_oserror_to_unreachable() -> None:
    line = blueprint_turn_error_sse(OSError("Temporary failure in name resolution"))
    assert "Upstream temporarily unreachable" in line


def _product_plan_and_steps(
    *,
    roster: list[str],
    replies: list[tuple[str, str]],
    bodies: dict[str, str] | None = None,
    outline: bool = True,
) -> tuple[BlueprintPlanReady, BlueprintStepLoopResult]:
    step = PlanStep(
        step_id="s1",
        title="Product",
        instruction_for_model="Write product.",
    )
    template = PlanTemplate(
        id="test_blueprint",
        title="Test document",
        steps=[step],
        document_outline=[DocumentOutlineSection(heading="Product", step_ids=["s1"])] if outline else [],
    )
    assignment = StepAssignment(
        step=step,
        hero_id=roster[0],
        fallback=False,
        slot_distance=0,
    )
    plan = BlueprintPlanReady(
        enriched="request",
        rag_ctx={},
        roster=roster,
        model="test-model",
        tpl=template,
        assignments=[assignment],
        quality_status={"status": "draft"},
        quality_guard="",
        deferred=[],
        stream_t0=time.monotonic(),
        planning_ms=0,
        is_shared=False,
        speaker_labels={},
        use_web_search=False,
    )
    council = CouncilTranscriptAccumulator(mode="joint_document", roster=roster)
    for index, (hero_id, text) in enumerate(replies):
        council.append_speaker_reply(
            hero_id=hero_id,
            text=text,
            index=index,
            document_text="Document section with enough detail for the final artifact.",
        )
    if replies:
        council.append_closing("Кворум собран.", decision="ok")
    steps = BlueprintStepLoopResult(
        bodies=bodies if bodies is not None else {"s1": "Document section with enough detail for the final artifact."},
        contributors=list(roster),
        quality_status={"status": "draft"},
        council_transcript=council,
    )
    return plan, steps


@pytest.mark.asyncio
async def test_blueprint_finalize_metric_counts_unique_speakers(
    caplog: pytest.LogCaptureFixture,
) -> None:
    plan, steps = _product_plan_and_steps(
        roster=["max_safin", "anna_volkova"],
        replies=[
            ("max_safin", "Сначала проверим ценность."),
            ("anna_volkova", "Добавлю риск по срокам."),
        ],
    )
    persist = AsyncMock(return_value=SimpleNamespace(id=uuid4()))
    finalization = ArtifactFinalizationResult(
        markdown="## Product\n\nDocument section with enough detail for the final artifact.",
        status="verified",
        violations=(),
        repair_attempted=False,
        fallback_used=False,
    )
    with (
        patch(
            "api.services.desktop_chat_ensemble.blueprint.stream_finalize.finalize_artifact",
            new=AsyncMock(return_value=finalization),
        ),
        patch(
            "api.services.desktop_chat_ensemble.blueprint.stream_finalize.persist_assistant_message_isolated",
            new=persist,
        ),
        patch(
            "api.services.desktop_chat_ensemble.blueprint.stream_finalize.record_desktop_chat_turn_memory",
            new=AsyncMock(),
        ),
        patch(
            "api.services.desktop_chat_ensemble.blueprint.stream_finalize.ensemble_audit_log.log_stitched_markdown",
            new=AsyncMock(),
        ),
    ):
        with caplog.at_level(logging.INFO):
            async for _ in iter_blueprint_finalize(
                chat=SimpleNamespace(id=uuid4()),
                user_id=uuid4(),
                user_text="Build product.",
                defaults={"ensemble_blueprint_polish_enabled": False},
                plan=plan,
                steps=steps,
            ):
                pass
    metric = _council_budget_metric(caplog)
    assert "speakers=2" in metric
    assert "interludes=1" in metric
    assert "engine=blueprint" in metric
    assert "status=ok" in metric
    assert "parallel=0" in metric


@pytest.mark.asyncio
async def test_blueprint_finalize_logs_budget_when_document_empty(
    caplog: pytest.LogCaptureFixture,
) -> None:
    plan, steps = _product_plan_and_steps(
        roster=["max_safin"],
        replies=[("max_safin", "Сначала проверим ценность.")],
        bodies={},
        outline=False,
    )
    with caplog.at_level(logging.INFO):
        lines = [
            line
            async for line in iter_blueprint_finalize(
                chat=SimpleNamespace(id=uuid4()),
                user_id=uuid4(),
                user_text="Build product.",
                defaults={"ensemble_blueprint_polish_enabled": False},
                plan=plan,
                steps=steps,
            )
        ]
    events = [event for line in lines if (event := _event(line)) is not None]
    assert events[0]["event"] == "error"
    assert events[0]["message"] == "ensemble_blueprint_empty"
    metric = _council_budget_metric(caplog)
    assert "status=empty" in metric
    assert "engine=blueprint" in metric
    assert "parallel=0" in metric


@pytest.mark.asyncio
async def test_blueprint_finalize_logs_budget_when_persist_fails(
    caplog: pytest.LogCaptureFixture,
) -> None:
    plan, steps = _product_plan_and_steps(
        roster=["max_safin"],
        replies=[("max_safin", "Сначала проверим ценность.")],
    )
    finalization = ArtifactFinalizationResult(
        markdown="## Product\n\nDocument section with enough detail for the final artifact.",
        status="verified",
        violations=(),
        repair_attempted=False,
        fallback_used=False,
    )
    with (
        patch(
            "api.services.desktop_chat_ensemble.blueprint.stream_finalize.finalize_artifact",
            new=AsyncMock(return_value=finalization),
        ),
        patch(
            "api.services.desktop_chat_ensemble.blueprint.stream_finalize.persist_assistant_message_isolated",
            new=AsyncMock(side_effect=RuntimeError("persist boom")),
        ),
        patch(
            "api.services.desktop_chat_ensemble.blueprint.stream_finalize.ensemble_audit_log.log_stitched_markdown",
            new=AsyncMock(),
        ),
    ):
        with caplog.at_level(logging.INFO), pytest.raises(RuntimeError, match="persist boom"):
            async for _ in iter_blueprint_finalize(
                chat=SimpleNamespace(id=uuid4()),
                user_id=uuid4(),
                user_text="Build product.",
                defaults={"ensemble_blueprint_polish_enabled": False},
                plan=plan,
                steps=steps,
            ):
                pass
    metric = _council_budget_metric(caplog)
    assert "status=error" in metric
    assert "engine=blueprint" in metric
    assert "parallel=0" in metric


def test_log_blueprint_council_budget_without_steps_uses_roster(
    caplog: pytest.LogCaptureFixture,
) -> None:
    plan, _steps = _product_plan_and_steps(
        roster=["max_safin", "anna_volkova"],
        replies=[],
    )
    with caplog.at_level(logging.INFO):
        log_blueprint_council_budget(plan=plan, steps=None, status="aborted", duration_ms=12)
    metric = _council_budget_metric(caplog)
    assert "speakers=2" in metric
    assert "status=aborted" in metric
    assert "engine=blueprint" in metric


@pytest.mark.asyncio
async def test_blueprint_finalize_aclose_logs_cancelled(
    caplog: pytest.LogCaptureFixture,
) -> None:
    plan, steps = _product_plan_and_steps(
        roster=["max_safin"],
        replies=[("max_safin", "Сначала проверим ценность.")],
    )

    async def _hang(*_args: object, **_kwargs: object) -> str:
        await asyncio.sleep(60)
        return "x"

    with (
        patch(
            "api.services.desktop_chat_ensemble.blueprint.stream_finalize.polish_joint_concat",
            new=_hang,
        ),
        patch(
            "api.services.desktop_chat_ensemble.blueprint.stream_finalize.ensemble_audit_log.log_stitched_markdown",
            new=AsyncMock(),
        ),
    ):
        agen = iter_blueprint_finalize(
            chat=SimpleNamespace(id=uuid4()),
            user_id=uuid4(),
            user_text="Build product.",
            defaults={"ensemble_blueprint_polish_enabled": True},
            plan=plan,
            steps=steps,
        )
        with caplog.at_level(logging.INFO):
            first = await agen.__anext__()
            assert "ensemble_joint_polish_start" in first
            await agen.aclose()
    metric = _council_budget_metric(caplog)
    assert "status=cancelled" in metric
    assert "engine=blueprint" in metric


@pytest.mark.asyncio
async def test_stream_blueprint_turn_logs_budget_when_step_loop_aborts_empty(
    caplog: pytest.LogCaptureFixture,
) -> None:
    plan, steps = _product_plan_and_steps(
        roster=["max_safin"],
        replies=[("max_safin", "Сначала проверим ценность.")],
        bodies={},
        outline=False,
    )

    async def fake_planning(
        *_args: object,
        gate: BlueprintPlanningGate,
        **_kwargs: object,
    ) -> AsyncIterator[str]:
        gate.ready = plan
        if False:
            yield ""

    async def fake_steps(
        *_args: object,
        gate: BlueprintStepLoopGate,
        **_kwargs: object,
    ) -> AsyncIterator[str]:
        gate.aborted_empty = True
        gate.result = steps
        if False:
            yield ""

    with (
        patch(
            "api.services.desktop_chat_ensemble.blueprint.stream_turn.iter_blueprint_planning",
            new=fake_planning,
        ),
        patch(
            "api.services.desktop_chat_ensemble.blueprint.stream_turn.iter_blueprint_step_loop",
            new=fake_steps,
        ),
    ):
        with caplog.at_level(logging.INFO):
            async for _ in stream_blueprint_turn(
                AsyncMock(),
                chat=SimpleNamespace(id=uuid4()),
                user_id=uuid4(),
                history=[],
                user_text="Build product.",
                defaults={},
            ):
                pass
    metric = _council_budget_metric(caplog)
    assert "status=empty" in metric
    assert "engine=blueprint" in metric
    assert "parallel=0" in metric
