#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave F4 program lock — one smoke chain across F0–F3 council helpers
# (parallel off, speech-only peer context, transcript persist, closing, Document lane).
# Invariants:
# - Does not call LLM; pure helpers only.
# - Complements per-wave unit files; entrypoint for Council Protocol regression.
# Related:
# - tests/test_desktop_chat_council_brief.py
# - tests/test_desktop_chat_council_transcript.py
# - tests/test_desktop_chat_council_finalize.py
# - documentation/product/DESKTOP-LLAMA-CHAT.md (Council Protocol F0–F4)
# ---
"""Wave F4: Council Protocol end-to-end helper smoke."""

from __future__ import annotations

from api.services.desktop_chat_ensemble.archive.legacy_freeform.council_brief import (
    council_speaker_brief_block,
)
from api.services.desktop_chat_ensemble.archive.legacy_freeform.council_finalize import (
    apply_council_closing,
    assemble_markdown_from_council_transcript,
)
from api.services.desktop_chat_ensemble.archive.legacy_freeform.council_speech import (
    council_speech_transcript_message,
    format_council_speech_line,
)
from api.services.desktop_chat_ensemble.archive.legacy_freeform.council_transcript import (
    CouncilTranscriptAccumulator,
    opening_orchestrator_brief_text,
)
from api.services.desktop_chat_ensemble.archive.legacy_freeform.joint_parallel import (
    joint_parallel_sections_enabled,
)


def test_council_protocol_f0_to_f3_helper_chain() -> None:
    assert joint_parallel_sections_enabled({}, speaker_count=4) is False

    speakers = ["max_safin", "viktor_engineer"]
    open_text = opening_orchestrator_brief_text(
        reason="Нужен единый реестр",
        huddle_lines=["Сначала UX"],
        speakers=speakers,
        mode="joint_document",
    )
    assert "совместный документ" in open_text

    acc = CouncilTranscriptAccumulator(mode="joint_document", roster=list(speakers))
    acc.append_orchestrator_brief(open_text, index=0)

    brief1 = council_speaker_brief_block(
        index=0,
        speakers=speakers,
        mode="joint_document",
        hero_id="max_safin",
    )
    assert "ход 1 из 2" in brief1

    body1 = (
        "1. Калькулятор — быстрые расчёты для пользователя.\n"
        "2. Календарь — расписание и напоминания.\n"
        "3. Заметки — защищённый контур данных."
    )
    acc.append_speaker_reply(
        hero_id="max_safin",
        text="Я оставляю в MVP только критический пользовательский путь.",
        index=0,
        title=None,
        document_text=f"## User Experience & MVP\n\n{body1}",
    )

    peer = council_speech_transcript_message(
        [
            format_council_speech_line(
                hero_id="max_safin",
                speech="Я оставляю в MVP только критический пользовательский путь.",
            )
        ]
    )
    assert "критический пользовательский путь" in peer["content"]
    assert "Калькулятор — быстрые расчёты" not in peer["content"]

    brief2 = council_speaker_brief_block(
        index=1,
        speakers=speakers,
        mode="joint_document",
        hero_id="viktor_engineer",
    )
    assert "ход 2 из 2" in brief2
    assert "последний" in brief2.casefold()

    body2 = (
        "1. Очередь задач и деплой без простоев.\n"
        "2. Наблюдаемость и алерты на сбои.\n"
        "3. Резервное копирование критичных данных."
    )
    acc.append_speaker_reply(
        hero_id="viktor_engineer",
        text="Сначала проверю границы интеграции и отказоустойчивость.",
        index=1,
        title=None,
        document_text=f"## Architecture & Delivery\n\n{body2}",
    )

    closing_turn, decision = apply_council_closing(acc, expected_speakers=speakers)
    assert closing_turn.kind == "closing"
    assert decision == "ok"

    payload = acc.to_dict()
    assert payload["closing"] == {"decision": "ok"}
    kinds = [t["kind"] for t in payload["turns"]]
    assert kinds[0] == "orchestrator_brief"
    assert "speaker_reply" in kinds
    assert kinds[-1] == "closing"

    document = assemble_markdown_from_council_transcript(acc)
    assert "## User Experience & MVP" in document
    assert "## Architecture & Delivery" in document
    assert "Калькулятор" in document
    assert "Закрытие" not in document
