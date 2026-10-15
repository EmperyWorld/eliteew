#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock Wave F3 council closing decision + transcript→document assembly.
# Invariants:
# - ok when roster covered with non-thin unique sections; else supplement + notes.
# - Document draft prefers speaker_reply turns (transcript SoT).
# Related:
# - archive/legacy_freeform/council_finalize.py
# - archive/legacy_freeform/council_transcript.py
# ---
"""Wave F3: council closing + assemble from transcript."""

from __future__ import annotations

from api.services.desktop_chat_ensemble.archive.legacy_freeform.council_finalize import (
    apply_council_closing,
    assemble_markdown_from_council_transcript,
    decide_council_closing,
    required_sections_from_council_transcript,
)
from api.services.desktop_chat_ensemble.archive.legacy_freeform.council_transcript import (
    CouncilTranscriptAccumulator,
)


def _fat(text: str) -> str:
    return text + (" " + "факт" * 20)


def test_closing_ok_when_roster_covered_with_distinct_sections() -> None:
    acc = CouncilTranscriptAccumulator(
        mode="joint_document",
        roster=["max_safin", "viktor_engineer"],
    )
    acc.append_speaker_reply(
        hero_id="max_safin",
        text=_fat("Калькулятор и календарь для MVP."),
        index=0,
        title="User Experience & MVP",
    )
    acc.append_speaker_reply(
        hero_id="viktor_engineer",
        text=_fat("Очередь задач и деплой."),
        index=1,
        title="Architecture & Delivery",
    )
    decision, text, notes = decide_council_closing(acc)
    assert decision == "ok"
    assert notes is None
    assert "кворум" in text.casefold() or "Закрытие" in text

    turn, decided = apply_council_closing(acc)
    assert decided == "ok"
    assert turn.kind == "closing"
    payload = acc.to_dict()
    assert payload["closing"] == {"decision": "ok"}
    assert payload["turns"][-1]["kind"] == "closing"


def test_closing_supplement_on_missing_speaker_or_duplicate_titles() -> None:
    acc = CouncilTranscriptAccumulator(
        mode="discussion",
        roster=["max_safin", "viktor_engineer"],
    )
    acc.append_speaker_reply(
        hero_id="max_safin",
        text=_fat("Первый взгляд на UX."),
        index=0,
        title="Goals",
    )
    # Second speaker repeats the same ## zone → supplement
    acc.append_speaker_reply(
        hero_id="viktor_engineer",
        text=_fat("Повтор зоны goals."),
        index=1,
        title="Goals",
    )
    decision, _text, notes = decide_council_closing(acc)
    assert decision == "supplement"
    assert notes and "повторяющиеся зоны" in notes

    thin = CouncilTranscriptAccumulator(mode="joint_document", roster=["max_safin", "elena_valeryevna"])
    thin.append_speaker_reply(hero_id="max_safin", text="ок", index=0, title="A")
    d2, _t2, n2 = decide_council_closing(thin)
    assert d2 == "supplement"
    assert n2 and ("не высказались" in n2 or "короткие" in n2)


def test_assemble_document_from_transcript_speaker_replies() -> None:
    acc = CouncilTranscriptAccumulator(mode="joint_document", roster=["max_safin", "viktor_engineer"])
    acc.append_orchestrator_brief("Открываем")
    acc.append_speaker_reply(
        hero_id="max_safin",
        text="Пункты UX",
        index=0,
        title="UX",
    )
    acc.append_speaker_reply(
        hero_id="viktor_engineer",
        text="Пункты системы",
        index=1,
        title="System",
    )
    apply_council_closing(acc)
    md = assemble_markdown_from_council_transcript(acc)
    assert "## UX" in md
    assert "## System" in md
    assert "Пункты UX" in md
    assert "Закрытие" not in md  # closing is Process-only, not Document body
    assert "---" in md
    sections = required_sections_from_council_transcript(acc)
    assert sections == ["UX", "System"]
