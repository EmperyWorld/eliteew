#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock Wave F1–F3 council_transcript accumulator shape and SSE event payload.
# Invariants:
# - version=1; turns append-only; closing set via append_closing (Wave F3).
# Related:
# - archive/legacy_freeform/council_transcript.py
# - archive/legacy_freeform/council_finalize.py
# ---
"""Wave F1/F3: council transcript persist contract."""

from __future__ import annotations

from api.services.desktop_chat_ensemble.archive.legacy_freeform.council_transcript import (
    CouncilTranscriptAccumulator,
    opening_orchestrator_brief_text,
)


def test_opening_orchestrator_brief_includes_mode_and_roster() -> None:
    text = opening_orchestrator_brief_text(
        reason="Нужен единый реестр модулей",
        huddle_lines=["Сначала UX", "Потом система"],
        speakers=["max_safin", "viktor_engineer"],
        mode="joint_document",
    )
    assert "совместный документ" in text
    assert "Макс Бериевич" in text
    assert "реестр" in text.casefold() or "Нужен" in text
    assert "Сначала UX" in text


def test_accumulator_builds_persistable_transcript_and_sse() -> None:
    acc = CouncilTranscriptAccumulator(mode="discussion", roster=["max_safin", "elena_valeryevna"])
    open_turn = acc.append_orchestrator_brief("Открываем круг", index=0)
    assert open_turn.kind == "orchestrator_brief"
    mid = acc.append_orchestrator_brief("Ход 2 из 2", index=2)
    reply = acc.append_speaker_reply(
        hero_id="max_safin",
        text="1. Калькулятор\n2. Календарь",
        index=0,
        title="User Experience & MVP",
    )
    assert "## User Experience & MVP" not in reply.text
    assert "Калькулятор" in reply.text
    assert reply.document_text is not None
    assert "## User Experience & MVP" in reply.document_text

    payload = acc.to_dict()
    assert payload["version"] == 1
    assert payload["mode"] == "discussion"
    assert payload["closing"] is None
    assert len(payload["turns"]) == 3
    assert payload["turns"][0]["kind"] == "orchestrator_brief"
    assert payload["turns"][-1]["kind"] == "speaker_reply"
    assert payload["turns"][-1]["hero_id"] == "max_safin"

    sse = acc.sse_council_turn_event(mid)
    assert sse["event"] == "council_turn"
    assert sse["turns_count"] == 3
    assert sse["turn"]["kind"] == "orchestrator_brief"


def test_append_closing_sets_metadata_and_sse() -> None:
    acc = CouncilTranscriptAccumulator(mode="joint_document", roster=["max_safin"])
    acc.append_speaker_reply(hero_id="max_safin", text="body " * 30, index=0, title="A")
    turn = acc.append_closing("Итог ok", decision="ok")
    assert turn.kind == "closing"
    payload = acc.to_dict()
    assert payload["closing"] == {"decision": "ok"}
    assert payload["turns"][-1]["kind"] == "closing"
    sse = acc.sse_council_turn_event(turn)
    assert sse["closing"] == {"decision": "ok"}
    assert sse["turn"]["kind"] == "closing"


def test_empty_brief_not_appended() -> None:
    acc = CouncilTranscriptAccumulator(mode="joint_document", roster=["max_safin"])
    turn = acc.append_orchestrator_brief("   ")
    assert turn.text == ""
    assert acc.to_dict()["turns"] == []
