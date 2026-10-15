# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock the adaptive expert-document contract across solo prompt composition and legacy freeform ensemble replies.
# Invariants:
# - Short conversational replies are not forced into document chrome.
# - Substantive replies receive conditional Markdown, table, and diagram guidance plus provenance metadata.
# Related:
# - api/services/desktop_chat/ux/expert_reply_contract.py
# - api/services/desktop_chat/prompt_compose.py
# - api/services/desktop_chat_ensemble/archive/legacy_freeform/stream_turn.py
# ---

from __future__ import annotations

from api.services.desktop_chat.prompt_compose import compose_desktop_system_prompt_with_meta
from api.services.desktop_chat.ux.expert_reply_contract import (
    EXPERT_REPLY_CONTRACT_VERSION,
    expert_reply_contract_enabled,
    expert_reply_contract_instruction,
)
from api.services.desktop_chat_ensemble.archive.legacy_freeform.stream_turn import (
    _expert_reply_metadata,
    _reply_contract_block,
)


def test_expert_reply_contract_defaults_on_with_explicit_off_switches(monkeypatch) -> None:
    monkeypatch.delenv("DESKTOP_AI_CHAT_STRUCTURED_REPLY", raising=False)
    assert expert_reply_contract_enabled({}) is True
    assert expert_reply_contract_enabled({"desktop_chat_structured_reply_enabled": False}) is False

    monkeypatch.setenv("DESKTOP_AI_CHAT_STRUCTURED_REPLY", "off")
    assert expert_reply_contract_enabled({}) is False


def test_solo_contract_is_adaptive_and_uses_semantic_visuals_only() -> None:
    contract = expert_reply_contract_instruction(mode="solo")

    assert "1–4 естественных предложения" in contract
    assert "`##`" in contract and "`###`" in contract
    assert "Таблицу используй только" in contract
    assert "GFM" in contract
    assert "2–4 колонки" in contract
    assert "`\\|`" in contract
    assert "один валидный fenced-блок `mermaid`" in contract
    assert "не рисуй декоративную схему" in contract
    assert "chain-of-thought" in contract
    assert "`Цель ответа`" in contract


def test_joint_contract_preserves_outer_document_heading_ownership() -> None:
    contract = expert_reply_contract_instruction(mode="joint")

    assert "не добавляй `#` или `##`" in contract
    assert "только `###`" in contract


def test_solo_prompt_records_expert_contract_provenance() -> None:
    prompt, meta = compose_desktop_system_prompt_with_meta(
        hero_id="likiy_sorrento",
        mode="solo",
        defaults={},
        structured_reply=True,
    )

    assert "[Контракт экспертного ответа]" in prompt
    assert meta["desktop_structured_reply_prompt"] is True
    assert meta["desktop_expert_reply_contract"] == EXPERT_REPLY_CONTRACT_VERSION


def test_legacy_freeform_applies_contract_only_to_substantive_turns() -> None:
    standard = _reply_contract_block("standard", is_joint=False)
    assessment = _reply_contract_block("assessment", is_joint=False)
    joint = _reply_contract_block("standard", is_joint=True)
    joint_assessment = _reply_contract_block("assessment", is_joint=True)
    ack = _reply_contract_block("ack", is_joint=False)

    assert "[Контракт экспертного ответа]" in standard
    assert "[Контракт экспертной оценки]" in assessment
    assert "[Контракт экспертной секции]" in joint
    assert "не добавляй `#` или `##`" in joint_assessment
    assert "[Контракт экспертного ответа]" not in ack
    assert _expert_reply_metadata("standard") == {"desktop_expert_reply_contract": EXPERT_REPLY_CONTRACT_VERSION}
    assert _expert_reply_metadata("ack") == {}
