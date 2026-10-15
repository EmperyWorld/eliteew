# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Tests for unified music companion creative context (deictic + user intent + tool slots).
# Related:
# - api/ewa_platform/companion/orchestration/companion_music_creative_context.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.orchestration.companion_deictic_turn_context import DeicticTurnContext
from api.ewa_platform.companion.orchestration.companion_music_creative_context import (
    build_music_companion_creative_context,
    companion_context_has_deictic_source_material,
    companion_deictic_wizard_theme,
    companion_music_deictic_style_guard_from_context,
    companion_music_tone_balance_block,
    normalize_music_source_body,
    strip_deictic_music_preset_tail,
)
from api.routers.music_generator_constants import MAX_EWA_COMPANION_CONTEXT_CHARS


def test_strip_deictic_music_preset_tail() -> None:
    raw = "на эту тему — возьми тему и контекст из моего последнего ответа спутника и запусти генерацию в фоне."
    assert strip_deictic_music_preset_tail(raw) == "на эту тему"


def test_build_music_companion_creative_context_includes_deictic_and_mood() -> None:
    deictic = DeicticTurnContext(
        topic="Почему море меняет город",
        extra_context="Во Владивостоке набережная — не декор, а экономика.",
    )
    ctx = build_music_companion_creative_context(
        user_line="Сделай песню на эту тему",
        args={"mood": "тепло, надежда", "style": "ballad"},
        profile={"seed_persona_id": "parent"},
        deictic=deictic,
        ru=True,
    )
    assert "Запрос пользователя" in ctx
    assert "набережная" in ctx
    assert "тепло, надежда" in ctx
    assert "Persona спутника" in ctx
    assert "Исходный материал для текста песни (PRIMARY)" in ctx
    assert "Только заголовок" in ctx
    assert len(ctx) <= MAX_EWA_COMPANION_CONTEXT_CHARS


def test_normalize_music_source_body_strips_emoji_and_bold() -> None:
    raw = "🏙 **Бизнес-центр К7** — новый стандарт"
    assert normalize_music_source_body(raw) == "Бизнес-центр К7 — новый стандарт"


def test_companion_deictic_wizard_theme_adds_business_hint() -> None:
    deictic = DeicticTurnContext(
        topic="Бизнес-центр К7: как во Владивостоке появляется новый стандарт класса «А»",
        extra_context="Бизнес-центр К7 — это не просто очередное здание в городской застройке.",
    )
    theme = companion_deictic_wizard_theme(deictic, ru=True)
    assert "урбанистик" in theme.lower() or "деловая" in theme.lower()
    assert "К7" in theme


def test_companion_context_has_deictic_source_material() -> None:
    ctx = build_music_companion_creative_context(
        user_line="на эту тему",
        args={},
        profile=None,
        deictic=DeicticTurnContext(topic="Тема", extra_context="Длинный исходный материал для песни " * 5),
        ru=True,
    )
    assert companion_context_has_deictic_source_material(ctx)


def test_companion_music_deictic_style_guard_for_business() -> None:
    ctx = build_music_companion_creative_context(
        user_line="создай песню на эту тему",
        args={},
        profile=None,
        deictic=DeicticTurnContext(
            topic="Бизнес-центр К7",
            extra_context="Бизнес-центр класса А во Владивостоке — новая застройка.",
        ),
        ru=True,
    )
    guard = companion_music_deictic_style_guard_from_context(ctx, ru=True)
    assert "STYLE GUARD" in guard
    assert "sultry" in guard.lower() or "R&B" in guard


def test_build_music_companion_creative_context_omits_condensed_when_deictic() -> None:
    profile = {
        "seed_persona_id": "parent",
        "learned_preferences": {
            "companion_chat_condensed_v1": {
                "paragraphs": ["Акустический институт: OCR и морская акустика."],
            },
        },
    }
    deictic = DeicticTurnContext(
        topic="ИИ как соавтор",
        extra_context="ИИ уже переписывает правила игры в повседневных процессах.",
    )
    ctx = build_music_companion_creative_context(
        user_line="сделай песню на эту тему",
        args={"dialog_context": "устаревший контекст роутера"},
        profile=profile,
        deictic=deictic,
        ru=True,
    )
    assert "Акустическ" not in ctx
    assert "устаревший контекст роутера" not in ctx
    assert "переписывает правила" in ctx


def test_build_music_companion_creative_context_omits_condensed_without_deictic() -> None:
    profile = {
        "seed_persona_id": "parent",
        "learned_preferences": {
            "companion_chat_condensed_v1": {
                "paragraphs": ["Акустический институт: OCR и морская акустика."],
            },
        },
    }
    ctx = build_music_companion_creative_context(
        user_line="снова по последней теме",
        args={"theme": "Владивосток"},
        profile=profile,
        deictic=None,
        ru=True,
    )
    assert "Акустическ" not in ctx


def test_infer_subject_hint_no_false_positive_on_scenarii() -> None:
    deictic = DeicticTurnContext(
        topic="Владивостокская осень",
        extra_context="Осень — это не про грустный сентябрь, а про сценарии выживания и городской вайб.",
    )
    theme = companion_deictic_wizard_theme(deictic, ru=True)
    assert "Технологии и ИИ" not in theme
    assert "урбан" in theme.lower() or "сезон" in theme.lower() or "город" in theme.lower()


def test_companion_music_tone_balance_block_for_autumn_vibe() -> None:
    body = "Почему это не про грустный сентябрь, а про особый вайб и выживание"
    block = companion_music_tone_balance_block(body, ru=True)
    assert "траур" in block.lower()
    assert "припев" in block.lower()
