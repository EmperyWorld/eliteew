# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for **Arlika v1 quarrel turns** — rude-user detection, action stripping, surrender-reply scrub.
# Invariants:
# - Pure unit tests; no DB/HTTP.
# Related:
# - api/ewa_platform/companion/sidecar/arlika_quarrel.py
# - api/ewa_platform/companion/config.py
# ---
"""Tests for Arlika v1 quarrel-turn refusal guards."""

from __future__ import annotations

from api.ewa_platform.companion.config import (
    get_character_arlika_v1_directive_snippet,
    get_seed_persona_role_prompt,
)
from api.ewa_platform.companion.sidecar.arlika_quarrel import (
    arlika_rude_user_heuristic,
    drop_quarrel_poison_context_lines,
    is_arlika_quarrel_therapy_essay,
    is_arlika_v1_quarrel_turn,
    polish_arlika_quarrel_reply,
    rewrite_arlika_quarrel_therapy_essay,
    sanitize_context_anchor_for_arlika_quarrel,
    scrub_arlika_quarrel_surrender_reply,
    strip_actions_for_arlika_quarrel,
    strip_arlika_title_banner,
)


def test_arlika_rude_heuristic_detects_profanity_insult() -> None:
    assert arlika_rude_user_heuristic("Да слыш ты чертила ебаная делай когда тебе говорят")
    assert arlika_rude_user_heuristic("иди в жопу")


def test_arlika_rude_heuristic_ignores_neutral_task() -> None:
    assert not arlika_rude_user_heuristic("Сгенерируй песню про клуб")
    assert not arlika_rude_user_heuristic("Открой Music Studio пожалуйста")


def test_is_arlika_v1_quarrel_turn_prefers_wrath_classifier_true() -> None:
    assert is_arlika_v1_quarrel_turn("привет", wrath_classified_quarrel=True)


def test_is_arlika_v1_quarrel_turn_heuristic_when_classifier_false() -> None:
    assert is_arlika_v1_quarrel_turn(
        "ты тупая сделай уже",
        wrath_classified_quarrel=False,
    )


def test_strip_actions_for_arlika_quarrel_drops_gestures() -> None:
    actions = [{"type": "open_app", "app_component": "MusicPlayer"}]
    out = strip_actions_for_arlika_quarrel(
        actions,
        quarrel_turn=True,
        persona_seed="arlika",
    )
    assert out == []


def test_strip_actions_skips_non_arlika_seed() -> None:
    actions = [{"type": "open_app", "app_component": "MusicPlayer"}]
    out = strip_actions_for_arlika_quarrel(
        actions,
        quarrel_turn=True,
        persona_seed="mela",
    )
    assert out == actions


def test_scrub_arlika_quarrel_surrender_reply_appends_refusal() -> None:
    reply = "Ну, ну, какая ты тут грозная? Ладно-ладно, раз ты так настаиваешь, я попробую."
    out = scrub_arlika_quarrel_surrender_reply(
        reply,
        quarrel_turn=True,
        persona_seed="arlika",
    )
    assert "С задачами под оскорблениями не работаю" in out


def test_arlika_canonical_prompts_refuse_tasks_on_insults() -> None:
    role = get_seed_persona_role_prompt("arlika").lower()
    style = get_character_arlika_v1_directive_snippet().lower()
    assert "refuse" in role
    assert "refuse" in style
    assert "always execute" not in style
    assert "ладно-ладно" in style


def test_weak_arlika_role_override_falls_back_to_canonical(monkeypatch) -> None:
    monkeypatch.setenv("EWA_PERSONA_ARLIKA_ROLE", "Arlika v1: Sharp, ironic, chaotic surface.")
    role = get_seed_persona_role_prompt("arlika").lower()
    assert "refuse every task" in role
    assert "sharp, ironic, chaotic surface" not in role


def test_sanitize_context_anchor_strips_task_execution_bullets() -> None:
    raw = (
        "### Interaction rules\n"
        "- Do not engage with insults as personal attacks; focus on task execution.\n"
        "### Active tasks\n"
        "- Generate 'чертолёт' song.\n"
        "### User mood\n"
        "- Hostile rant.\n"
    )
    out = sanitize_context_anchor_for_arlika_quarrel(raw)
    assert "Quarrel override" in out
    assert "focus on task execution" not in out.lower()
    assert "generate 'чертолёт'" not in out.lower()
    assert "Hostile rant" in out


def test_drop_quarrel_poison_context_lines() -> None:
    raw = "- Maintain non-reactive stance while fulfilling core function.\n- User prefers dark themes.\n"
    out = drop_quarrel_poison_context_lines(raw)
    assert "non-reactive" not in out.lower()
    assert "dark themes" in out


def test_strip_arlika_title_banner() -> None:
    reply = "АРЛИКА\nНу что ж, ты опять начинаешь."
    assert strip_arlika_title_banner(reply).startswith("Ну что ж")


def test_is_arlika_quarrel_therapy_essay_detects_kitten_nlp_reply() -> None:
    reply = (
        "Ох, какая милая попытка придать мне значение, ты такой настойчивый, "
        "как маленький, очень недовольный котенок. Наверное, тебе просто нужно, "
        "чтобы я подтвердила твою исключительную значимость, да? "
        "Ни любви ни тоски ни жалости, только твоя вечная потребность в подтверждении."
    )
    assert is_arlika_quarrel_therapy_essay(reply)


def test_rewrite_arlika_quarrel_therapy_essay_replaces_whole_reply() -> None:
    reply = (
        "Ох, какая милая попытка придать мне значение, ты такой настойчивый, как маленький, очень недовольный котенок."
    )
    out = rewrite_arlika_quarrel_therapy_essay(
        reply,
        quarrel_turn=True,
        persona_seed="arlika",
    )
    assert "котенок" not in out.lower()
    assert "милая попытка" not in out.lower()
    assert "не работаю" in out.lower()


def test_polish_arlika_quarrel_reply_pipeline() -> None:
    reply = (
        "Ох, какая милая попытка придать мне значение, ты такой настойчивый, как маленький, очень недовольный котенок."
    )
    out = polish_arlika_quarrel_reply(
        reply,
        quarrel_turn=True,
        persona_seed="arlika",
    )
    assert "котенок" not in out.lower()
    assert "не работаю" in out.lower()


def test_scrub_arlika_quarrel_soft_drift_strips_polite_essay() -> None:
    reply = (
        "АРЛИКА\n"
        "Ну что ж, кажется, ты решил устроить мне личный концерт из оскорблений. Как мило. "
        "Пожалуйста, прекрати. Я тут, чтобы музыку делать."
    )
    out = polish_arlika_quarrel_reply(
        reply,
        quarrel_turn=True,
        persona_seed="arlika",
    )
    assert "АРЛИКА" not in out.split("\n", 1)[0]
    assert "как мило" not in out.lower()
    assert "пожалуйста, прекрати" not in out.lower()
    assert "не работаю" in out.lower()
