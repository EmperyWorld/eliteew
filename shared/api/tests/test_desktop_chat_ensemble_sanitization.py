"""Sanitization helpers for noisy ensemble output."""

from __future__ import annotations

from api.services.desktop_chat_ensemble.heroes import (
    blueprint_prompt_for_hero,
    hero_ids_cued_by_text,
)
from api.services.desktop_chat_ensemble.speaker_output import sanitize_ensemble_model_output


def test_sanitize_ensemble_model_output_strips_gemma_channel_thought_leak() -> None:
    """Prod blueprint leak: channel markers before section headings (even mid-document)."""
    text = (
        "<|channel>thought <channel|>## Ценность\n\n"
        "ICP для научной группы.\n\n"
        "<|channel>thought\n<channel|>## Доказательства\n\n"
        "Два проверяемых факта."
    )
    out = sanitize_ensemble_model_output(
        text,
        hero_id="arlyqueen",
        roster_hero_ids=["likiy_sorrento", "arlyqueen"],
    )
    assert "<|channel" not in out
    assert "<channel|" not in out
    assert "## Ценность" in out
    assert "ICP для научной группы" in out
    assert "## Доказательства" in out


def test_scrub_ensemble_channel_leak_matches_prod_audit_export() -> None:
    """Prod chat 0559a93c: channel prefill survived into joint export and memory."""
    from api.services.desktop_chat_ensemble.speaker_output import scrub_ensemble_channel_leak

    raw = "<|channel>thought\n<channel|>## Финансовый аудит проекта\n\nЯ не сторонник пустых обсуждений."
    out = scrub_ensemble_channel_leak(raw)
    assert "<|channel" not in out
    assert "<channel|" not in out
    assert out.startswith("## Финансовый аудит проекта")
    assert "пустых обсуждений" in out

    text = """
Реплика участника «Ликий Соренто»:
#
[label=pl1.txt]
Короткая полезная мысль.
""".strip()
    out = sanitize_ensemble_model_output(
        text,
        hero_id="likiy_sorrento",
        roster_hero_ids=["likiy_sorrento", "arlyqueen", "akimbo"],
    )
    assert out == "Короткая полезная мысль."


def test_sanitize_ensemble_model_output_strips_rituals_and_editorial_footer() -> None:
    text = """
Готова к партнерству на 95% честности. Уровень остроты языковых настроений на 7 из 10. Если нужно изменить настройки, дай знать. Полезная мысль по делу.

С уважением,
Арли Квиновна

**Примечание:** Ответ основан на ограниченном количестве доступных данных.
""".strip()
    out = sanitize_ensemble_model_output(
        text,
        hero_id="arlyqueen",
        roster_hero_ids=["likiy_sorrento", "arlyqueen", "akimbo"],
    )
    assert out == "Полезная мысль по делу."


def test_blueprint_prompt_for_hero_is_compact_not_roleplay_greeting() -> None:
    prompt = blueprint_prompt_for_hero("arlyqueen")
    assert prompt is not None
    assert "Готова к партнерству" not in prompt
    assert "соавтор структурированного делового документа" in prompt
    assert "приветственные формулы" in prompt.casefold()


def test_hero_ids_cued_by_text_detects_akimbo_nlp_cue() -> None:
    out = hero_ids_cued_by_text(
        "Сделайте маркетинговый бриф и посмотрите через НЛП призму",
        ["likiy_sorrento", "arlyqueen", "akimbo"],
    )
    assert out == ["arlyqueen", "akimbo"]


def test_sanitize_ensemble_model_output_strips_hero_prefix_and_editorial_block() -> None:
    text = """
Арли Квиновна: Короткая полезная мысль.

**Удалено:** служебный блок
""".strip()
    out = sanitize_ensemble_model_output(
        text,
        hero_id="arlyqueen",
        roster_hero_ids=["likiy_sorrento", "arlyqueen", "akimbo"],
    )
    assert out == "Короткая полезная мысль."


def test_sanitize_strips_bold_history_echo_and_inline_label_parenthetical() -> None:
    text = """
**Реплика участника «Ликий Соренто»:**

Шаг с (label: pl1.txt, fragment: 1) по сути запроса.
""".strip()
    out = sanitize_ensemble_model_output(
        text,
        hero_id="likiy_sorrento",
        roster_hero_ids=["likiy_sorrento", "arlyqueen", "akimbo"],
    )
    assert "Реплика" not in out
    assert "pl1.txt" not in out
    assert "по сути запроса" in out


def test_sanitize_ensemble_model_output_strips_simplification_note() -> None:
    text = """
Полезный абзац по делу.

Текст был упрощен и структурирован для устранения дублирования и улучшения читаемости, при этом были сохранены все ключевые пункты и разделы.
""".strip()
    out = sanitize_ensemble_model_output(
        text,
        hero_id="likiy_sorrento",
        roster_hero_ids=["likiy_sorrento", "arlyqueen", "akimbo"],
    )
    assert out == "Полезный абзац по делу."


def test_sanitize_ensemble_model_output_strips_joint_history_preamble_echo() -> None:
    """Wave E lock: per-speaker sanitize strips joint history preamble (incl. bold)."""
    text = (
        "**Совместный ответ участников [Ликий Соренто, Арли Квиновна]:**\n\n"
        "## Реестр модулей\n\n"
        "1. Модуль A — назначение.\n"
        "2. Модуль B — назначение."
    )
    out = sanitize_ensemble_model_output(
        text,
        hero_id="likiy_sorrento",
        roster_hero_ids=["likiy_sorrento", "arlyqueen", "akimbo"],
    )
    assert "Совместный ответ участников" not in out
    assert out.startswith("## Реестр модулей")
    assert "Модуль A" in out


def test_sanitize_strips_team_formed_lead_after_joint_preamble() -> None:
    text = (
        "Совместный ответ участников [Макс, Виктор]:\n"
        "Команда сформировала расширенный перечень пунктов по запросу.\n"
        "## MVP backlog\n\n"
        "- Пункт 1"
    )
    out = sanitize_ensemble_model_output(
        text,
        hero_id="max",
        roster_hero_ids=["max", "victor"],
    )
    assert "Совместный ответ участников" not in out
    assert "Команда сформировала" not in out
    assert "## MVP backlog" in out
    assert "Пункт 1" in out
