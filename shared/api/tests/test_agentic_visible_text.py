# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock sanitize_agentic_visible_text against channel/thought control leakage.
# Related:
# - api/ewa_platform/agentic/kernel/visible_text.py
# ---

from __future__ import annotations

from api.ewa_platform.agentic.kernel.visible_text import sanitize_agentic_visible_text


def test_sanitize_strips_channel_thought_markup() -> None:
    raw = "<|channel>thought\nInternal plan\n<channel|>\nPublic summary of the poem."
    out = sanitize_agentic_visible_text(raw)
    assert "<|channel>" not in out
    assert "<channel|" not in out
    assert "Public summary of the poem." in out


def test_sanitize_strips_orphan_thought_line() -> None:
    raw = "thought\nUseful answer for the journal."
    out = sanitize_agentic_visible_text(raw)
    assert out.startswith("Useful answer")
    assert "thought\n" not in out


def test_sanitize_respects_max_chars() -> None:
    out = sanitize_agentic_visible_text("abcdefghij", max_chars=6)
    assert out.endswith("…")
    assert len(out) == 6


def test_user_facing_expert_reply_hides_research_plan_scaffold() -> None:
    from api.ewa_platform.agentic.kernel.visible_text import user_facing_expert_chat_reply

    raw = (
        "## Фокус\n\n**Контекст решения**\n\nРезультатом исследования должен стать выбор.\n\n"
        "## Research Questions\n\n1. Какие сегменты?\n"
    )
    out = user_facing_expert_chat_reply(raw)
    assert "## Фокус" not in out
    assert "Контекст решения" not in out
    assert "завершено" in out.lower()


def test_user_facing_expert_reply_hides_result_methodology_umbrella() -> None:
    from api.ewa_platform.agentic.kernel.visible_text import (
        laconic_agentic_act_summary,
        user_facing_expert_chat_reply,
    )

    raw = (
        "## Результат\n\n### План анализа\n\n**Методика обработки данных**\n"
        "* Кодирование и тематический анализ: …\n"
        "Матрица доказательств (Evidence Table): …\n"
    )
    out = user_facing_expert_chat_reply(raw)
    assert "Методика" not in out
    assert "План анализа" not in out
    assert "завершено" in out.lower()
    laconic = laconic_agentic_act_summary(raw)
    assert "Методика" not in laconic
    assert len(laconic) < 200


def test_user_facing_expert_reply_keeps_findings_section() -> None:
    from api.ewa_platform.agentic.kernel.visible_text import user_facing_expert_chat_reply

    raw = "## Фокус\n\n**Контекст решения**\n\nПлан.\n\n## Выводы\n\nТоп-3 ниши: idle RPG, PvP arena, social farm.\n"
    out = user_facing_expert_chat_reply(raw)
    assert "Топ-3 ниши" in out
