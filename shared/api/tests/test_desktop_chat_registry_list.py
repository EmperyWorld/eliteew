#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock per-member registry orchestration + document sanitization for council turns.
# Related:
# - archive/legacy_freeform/orchestrator.py
# - archive/legacy_freeform/council_finalize.py
# - speaker_output.py
# ---
"""Per-member registry list contract tests."""

from __future__ import annotations

import json

from api.services.desktop_chat_ensemble.archive.legacy_freeform.council_finalize import (
    assemble_markdown_from_council_transcript,
)
from api.services.desktop_chat_ensemble.archive.legacy_freeform.council_transcript import (
    CouncilTranscriptAccumulator,
)
from api.services.desktop_chat_ensemble.archive.legacy_freeform.orchestrator import (
    apply_joint_latency_speaker_cap,
    parse_registry_list_count,
    user_requests_per_member_registry_list,
)
from api.services.desktop_chat_ensemble.archive.legacy_freeform.registry_list_json import (
    build_registry_document_and_preview,
    format_registry_items_markdown,
    registry_contribution_schema,
    registry_json_system_append,
)
from api.services.desktop_chat_ensemble.speaker_output import (
    dedupe_duplicate_h2_headings,
    sanitize_speaker_reply_body,
    strip_registry_boilerplate,
)
from api.tests.test_desktop_chat_joint_latency_budget import _plan

USER_REGISTRY_PROMPT = (
    "Давайте сделаем так чтобы каждый из вас внёс свой вклад. с каждого из команды по 10 приложений. повторяться нельзя"
)


def test_user_requests_per_member_registry_list_detects_team_prompt() -> None:
    assert user_requests_per_member_registry_list(USER_REGISTRY_PROMPT)
    assert parse_registry_list_count(USER_REGISTRY_PROMPT) == 10
    exact_prompt = "Каждый участник должен предложить ровно 3 разных приложения и не дублировать коллег."
    assert user_requests_per_member_registry_list(exact_prompt)
    assert parse_registry_list_count(exact_prompt) == 3
    assert parse_registry_list_count("С каждого по три приложения.") == 3
    assert not user_requests_per_member_registry_list("привет всем")


def test_apply_joint_latency_speaker_cap_skips_registry_turn() -> None:
    plan = _plan(["a", "b", "c", "d", "e", "f"])
    same = apply_joint_latency_speaker_cap(
        plan,
        defaults={"ensemble_joint_document_max_speakers": 4},
        user_excerpt=USER_REGISTRY_PROMPT,
    )
    assert same.speakers == plan.speakers


def test_sanitize_strips_duplicate_h2_and_boilerplate() -> None:
    raw = (
        "## MVP Функционал (UX)\n\n"
        "## MVP Функционал (UX)\n\n"
        "Я принял твое решение. Чтобы продукт не стал «пустой коробкой», нам нужно закрыть базовые потребности.\n\n"
        "1. **Калькулятор** — быстрые расчёты."
    )
    out = sanitize_speaker_reply_body(raw, canonical_title="MVP и UX")
    assert out.count("## MVP") == 0
    assert "Я принял" not in out
    assert "1. **Калькулятор**" in out


def test_dedupe_duplicate_h2_headings_keeps_first_block() -> None:
    raw = "## Strategic/High-Risk List\n\nПервый список.\n\n## Strategic/High-Risk List\n\nВторой список."
    out = dedupe_duplicate_h2_headings(raw)
    assert out.count("## Strategic/High-Risk List") == 1
    assert "Первый список" in out
    assert "Второй список" not in out


def test_assemble_document_drops_empty_duplicate_sections() -> None:
    acc = CouncilTranscriptAccumulator(mode="joint_document", roster=["max_safin", "viktor_engineer"])
    acc.append_speaker_reply(
        hero_id="max_safin",
        text="## MVP и UX\n\n1. **App** — ok",
        index=0,
        title="MVP и UX",
    )
    acc.append_speaker_reply(
        hero_id="viktor_engineer",
        text="## MVP и UX\n\n1. **Other** — ok",
        index=1,
        title="Система и интеграции",
    )
    md = assemble_markdown_from_council_transcript(acc)
    assert md.count("## MVP и UX") == 1
    assert "## Система и интеграции" in md
    assert "---" in md


def test_strip_registry_boilerplate_removes_participant_echo() -> None:
    raw = "(участник: Николас Алексеевич)\n\nЯ завершаю формирование реестра."
    out = strip_registry_boilerplate(raw)
    assert "участник:" not in out.casefold()
    assert "завершаю формирование" in out.casefold()


def test_registry_json_is_document_only() -> None:
    raw = json.dumps(
        {
            "items": [
                {"name": "Cloud Monitor", "description": "Расходы в реальном времени."},
                {"name": "SaaS Tracker", "description": "Аудит подписок."},
            ],
        },
        ensure_ascii=False,
    )
    document_md, preview = build_registry_document_and_preview(
        raw,
        zone_title="Операции и rollout",
        item_count=2,
    )
    assert document_md is not None
    assert preview is not None
    assert preview.startswith("Операции и rollout: 2 пунктов")
    assert "## Операции и rollout" in document_md
    assert "Cloud Monitor" in document_md
    assert "1. **Cloud Monitor**" in document_md


def test_registry_schema_and_prompt_never_request_speech() -> None:
    schema = registry_contribution_schema(3)
    assert schema["required"] == ["items"]
    assert "brief_reply" not in schema["properties"]
    append = registry_json_system_append(
        zone_title="Messaging",
        item_count=3,
        peer_item_names=["Cloud Monitor"],
    )
    assert "только items" in append
    assert "реплик" not in append.casefold()
    assert "Cloud Monitor" in append


def test_assemble_document_uses_document_text_not_council_preview() -> None:
    acc = CouncilTranscriptAccumulator(mode="joint_document", roster=["max_safin"])
    acc.append_speaker_reply(
        hero_id="max_safin",
        text="Короткая реплика для протокола.",
        index=0,
        title=None,
        document_text=format_registry_items_markdown(
            "MVP и UX",
            [{"name": "App", "description": "ok"}],
        ),
    )
    md = assemble_markdown_from_council_transcript(acc)
    assert "Короткая реплика" not in md
    assert "1. **App**" in md
