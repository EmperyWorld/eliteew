"""AMKA ↔ Desktop AI Chat ensemble mapping and SSE parsing."""

from __future__ import annotations

from api.schemas.marketing_cabinet.amka_preset import AmkaPresetConfigV1, AmkaPresetExtraPlanTaskIn
from api.services.marketing_cabinet.amka_ensemble_core import parse_desktop_chat_sse_lines
from api.services.marketing_cabinet.amka_ensemble_mapping import (
    build_amka_ensemble_user_prompt,
    sanitize_amka_ensemble_hero_ids,
    suggest_desktop_ensemble_execution_mode,
)
from api.services.marketing_cabinet.amka_preset_merge import validate_amka_preset_config_v1


def test_suggest_desktop_ensemble_for_report_only_analysis() -> None:
    mode = suggest_desktop_ensemble_execution_mode(
        "analysis",
        write_policy="report_only",
        work_needed=["Нужен конкурентный обзор"],
        operations=[],
    )
    assert mode == "desktop_ensemble"


def test_suggest_desktop_ensemble_skips_when_operations_present() -> None:
    mode = suggest_desktop_ensemble_execution_mode(
        "analysis",
        write_policy="operation_based",
        work_needed=["исследование"],
        operations=[{"kind": "replace_entity"}],
    )
    assert mode is None


def test_sanitize_amka_ensemble_hero_ids_defaults_by_section() -> None:
    heroes = sanitize_amka_ensemble_hero_ids(None, section_key="evidence")
    assert heroes == ["likiy_sorrento", "arlyqueen", "viktor_engineer"]


def test_build_amka_ensemble_user_prompt_includes_template_phrase() -> None:
    prompt = build_amka_ensemble_user_prompt(
        section_key="evidence",
        title="Evidence",
        rationale="Нужен план исследования",
        user_instruction="",
        audit_payload={"work_needed": ["Собрать гипотезы"]},
        template_hint="research_plan_v1",
    )
    assert "план исследования" in prompt.casefold()
    assert "research_plan_v1" in prompt
    assert "evidence" in prompt.casefold()


def test_parse_desktop_chat_sse_lines_collects_tokens_and_done() -> None:
    lines = [
        'data: {"event":"token","delta":"# Title\\n"}\n\n',
        'data: {"event":"token","delta":"Body"}\n\n',
        'data: {"event":"done","ensemble":true,"duration_ms":100}\n\n',
    ]
    md, meta, err = parse_desktop_chat_sse_lines(lines)
    assert md == "# Title\nBody"
    assert meta.get("ensemble") is True
    assert err is None


def test_validate_amka_preset_accepts_desktop_ensemble() -> None:
    cfg = AmkaPresetConfigV1(
        extra_plan_tasks=[
            AmkaPresetExtraPlanTaskIn(
                insert_after_section_key="evidence",
                task={
                    "section_key": "evidence",
                    "execution_mode": "desktop_ensemble",
                    "title": "Expert synthesis",
                    "ensemble_template_hint": "research_plan_v1",
                    "ensemble_hero_ids": ["likiy_sorrento"],
                },
            )
        ]
    )
    validate_amka_preset_config_v1(cfg)
