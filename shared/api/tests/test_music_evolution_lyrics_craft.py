# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for Music Evolution lyrics craft, morphology blocks, and stricter gates.
# Invariants:
# - Tests assert contract-level lyrics gates, not subjective taste scoring.
# - Atya regressions cover real weak generated phrases before XL Base dispatch.
# Related:
# - api/services/music_evolution_lyrics_craft.py
# ---

from __future__ import annotations

from api.services.music_evolution_lyrics_craft import (
    MUSIC_EVOLUTION_MIN_CYRILLIC_SUNG_LINES,
    MUSIC_EVOLUTION_MIN_SUNG_LINES,
    evolution_lyrics_errors_retryable,
    evolution_lyrics_retry_user_message,
    evolution_lyrics_system_craft_block,
    polish_evolution_lyrics,
    validate_music_evolution_lyrics_substance,
)


def test_evolution_lyrics_system_craft_includes_morphology_for_ru() -> None:
    block = evolution_lyrics_system_craft_block(language="ru", soloist_id="vera")
    assert "МОРФОЛОГИЯ" in block.upper() or "морфолог" in block.lower()
    assert str(MUSIC_EVOLUTION_MIN_SUNG_LINES) in block


def test_validate_music_evolution_rejects_short_skeleton() -> None:
    lyrics = "[Verse 1]\nОдна\n[Chorus]\nДве\n[Verse 2]\nТри"
    errors = validate_music_evolution_lyrics_substance(lyrics, language="ru")
    codes = {e["code"] for e in errors}
    assert "lyrics_skeleton_only" in codes or "lyrics_insufficient_russian_content" in codes


def test_validate_music_evolution_accepts_rich_ru_lyrics() -> None:
    lines = [
        "[Verse 1]",
        "Первая строка куплета с образом",
        "Вторая строка про город ночью",
        "Третья строка про тишину",
        "[Chorus]",
        "Припев про тему песни здесь",
        "Ещё одна строка припева",
        "[Verse 2]",
        "Четвёртая строка развития",
        "Пятая строка с деталью",
        "Шестая строка с выводом",
        "Седьмая строка перед мостом",
        "[Bridge]",
        "Мостовая строка один",
        "Мостовая строка два",
    ]
    lyrics = "\n".join(lines)
    errors = validate_music_evolution_lyrics_substance(lyrics, language="ru")
    assert errors == []


def test_polish_evolution_lyrics_gender_consistency() -> None:
    raw = "[Verse 1]\nЯ пошёл один в ночной туман\n[Chorus]\nЯ ждала тебя"
    out = polish_evolution_lyrics(raw, vocal_effective="female", language="ru")
    low = out.lower()
    assert "пошёла" in low or "пошла" in low
    assert "ждала" in low


def test_evolution_lyrics_errors_retryable() -> None:
    assert evolution_lyrics_errors_retryable([{"code": "lyrics_skeleton_only"}]) is True
    assert evolution_lyrics_errors_retryable([{"code": "lyrics_atya_broken_russian_phrase"}]) is True
    assert evolution_lyrics_errors_retryable([{"code": "lyrics_empty"}]) is False


def test_evolution_thresholds_stricter_than_studio() -> None:
    assert MUSIC_EVOLUTION_MIN_SUNG_LINES >= 10
    assert MUSIC_EVOLUTION_MIN_CYRILLIC_SUNG_LINES >= 8


def test_validate_atya_rejects_broken_latest_generation_phrases() -> None:
    lyrics = "\n".join(
        [
            "[Verse 1]",
            "Тишина сжимает в этой клетке",
            "Стены давят, воздух стал тяжел",
            "Я жду разряд, что ломает берег",
            "Всё внутри меня так не хотел",
            "[Pre-Chorus]",
            "Сквозь бетон пробивается ток",
            "Всё, что было, рвётся в пыль и прах",
            "Приходит мощный, неудержимый шок",
            "Сквозь эту мёртвую, пустую страх",
            "[Chorus]",
            "Ураган рвёт небесный покров",
            "Ветер бьёт, и нас больше не будет",
            "Сквозь этот грохот, сквозь этот зов",
            "Нас больше не будет, и нам не будет",
            "[Verse 2]",
            "Я вижу трещины в самой основе",
            "Где фундамент дал острую трещину",
            "Мне больше не нужна эта повозка",
            "Всё сгорит в этой яростной волне",
            "[Bridge]",
            "Гром разрывает плотную ткань",
            "(Children choir: громче, выше, рвёт)",
            "Пусть вся эта сила в меня влилась",
            "Нас больше не будет, вот так, вот так",
            "(Children choir: свобода, вечность, нас)",
        ]
    )

    errors = validate_music_evolution_lyrics_substance(
        lyrics,
        language="ru",
        soloist_id="atya",
        theme="Ветер",
    )
    codes = {error["code"] for error in errors}
    fragments = {str(error.get("fragment") or "") for error in errors}
    retry = evolution_lyrics_retry_user_message(errors)

    assert "lyrics_atya_broken_russian_phrase" in codes
    assert "lyrics_atya_weak_cliche_phrase" in codes
    assert "lyrics_atya_forced_reference_hook" in codes
    assert any("повозка" in fragment for fragment in fragments)
    assert "КРИТИЧНО для Ати" in retry
    assert "Нас больше не будет" in retry


def test_validate_atya_accepts_tight_storm_lyrics_with_choir() -> None:
    lyrics = "\n".join(
        [
            "[Verse 1]",
            "Тихий город держит вдох",
            "Я вхожу в холодный ток",
            "Ветер режет сонный свет",
            "Мне назад дороги нет",
            "[Pre-Chorus]",
            "Гром под кожей набирает ход",
            "Небо ниже, сердце выше",
            "[Chorus]",
            "Ветер рвёт мой голос",
            "Шторм не спрашивает нас",
            "(Children choir: выше неба, ветер рвёт)",
            "Ветер рвёт мой голос",
            "[Verse 2]",
            "Волны бьют в ночной бетон",
            "Я держу последний тон",
            "Шторм во мне ломает лёд",
            "И меня несёт вперёд",
            "[Bridge]",
            "Громче небо, ближе свет",
            "(Children choir: выше нас, выше гроз)",
        ]
    )

    errors = validate_music_evolution_lyrics_substance(
        lyrics,
        language="ru",
        soloist_id="atya",
        theme="Ветер",
    )

    assert errors == []


def test_lula_lyrics_craft_teaches_scene_and_half_whisper_identity() -> None:
    block = evolution_lyrics_system_craft_block(language="ru", soloist_id="lula")
    assert "psychedelic melancholy" in block
    assert "полушёпот" in block
    assert "90s-сцена" in block
    assert "комната" in block
    assert "Я королева миров" in block


def test_validate_lula_rejects_abstract_pop_cliches_and_reference_copy() -> None:
    lyrics = "\n".join(
        [
            "[Verse 1]",
            "Моя душа летит туда, где свет",
            "Сердце бьётся в такт красивой мечте",
            "Я королева миров в этой тишине",
            "[Pre-Chorus]",
            "Мы летим к мечте, не зная преград",
            "Я сильная и свободная, слышишь мой взгляд",
            "[Chorus]",
            "Свет моей души",
            "Свет моей души",
            "Свет моей души",
            "[Verse 2]",
            "Всё будет хорошо, я верю в рассвет",
            "Крылья за спиной мне дают ответ",
        ]
    )

    errors = validate_music_evolution_lyrics_substance(lyrics, language="ru", soloist_id="lula", theme="Свобода")
    codes = {error["code"] for error in errors}
    retry = evolution_lyrics_retry_user_message(errors)

    assert "lyrics_lula_weak_cliche_phrase" in codes
    assert "lyrics_lula_copied_reference_phrase" in codes
    assert "lyrics_lula_missing_scene_detail" in codes
    assert "lyrics_lula_hook_overrepeat" in codes
    assert "КРИТИЧНО для Lula" in retry
    assert "комната" in retry


def test_validate_lula_accepts_concrete_nocturnal_song() -> None:
    lyrics = "\n".join(
        [
            "[Intro]",
            "В магнитофоне шепчет лента",
            "[Verse 1]",
            "Ночь сидит на краю моей кухни",
            "Окно держит город в холодном стекле",
            "Я молчу и считаю минуты",
            "[Pre-Chorus]",
            "Такси под подъездом мигает",
            "Я почти отпускаю вчерашний ответ",
            "[Chorus]",
            "Свобода тихо дышит во мне",
            "Я не бегу, я просто исчезаю в неоне",
            "[Verse 2]",
            "На пальцах остался запах кассеты",
            "Лифт увозит мой страх на первый этаж",
            "[Bridge]",
            "В санаторном коридоре гаснет лампа",
            "И мне хватает этого света",
        ]
    )

    errors = validate_music_evolution_lyrics_substance(lyrics, language="ru", soloist_id="lula", theme="Свобода")
    assert errors == []


def test_validate_lula_allows_repeated_chorus_manta_block() -> None:
    lyrics = "\n".join(
        [
            "[Intro]",
            "Неон дрожит на стекле",
            "[Verse 1]",
            "Комната держит мой тихий воздух",
            "Окно рисует город на руке",
            "Я улыбаюсь этому шуму",
            "[Pre-Chorus]",
            "Такси под подъездом моргает",
            "Мне некуда больше спешить",
            "[Chorus]",
            "Ночное рандеву со мной",
            "Я остаюсь и исчезаю",
            "[Verse 2]",
            "Кассета шуршит на кухне",
            "Лампа устала светить",
            "Я отпускаю чужое имя",
            "[Chorus]",
            "Ночное рандеву со мной",
            "Я остаюсь и исчезаю",
        ]
    )

    errors = validate_music_evolution_lyrics_substance(
        lyrics,
        language="ru",
        soloist_id="lula",
        theme="Ночное рандеву",
    )
    assert errors == []


def test_validate_atya_rejects_latest_peso_generation_garbage() -> None:
    lyrics = "\n".join(
        [
            "[Verse 1]",
            "Сквозь трещины в камне слышен гром",
            "Тихий шорох под холодным днём",
            "Я вижу, как песок кружится в вихре",
            "Где каждый шаг — небрежный, не искренний",
            "[Pre-Chorus]",
            "Нарастает давление в этой тишине",
            "Всё стремится прорвать барьер во мне",
            "Где спрятан твой холодный, старый взгляд",
            "Где вся правда — просто пустой набат",
            "[Chorus]",
            "Шторм берёт нас, песо — дурачёк",
            "Эхо силы, дурачёк, шторм",
            "Неудержимый этот взрыв",
            "(Children choir: выше неба, ветер рвёт)",
            "Нас больше не будет",
            "[Pre-Chorus 2]",
            "Нарастает давление в этой тишине",
            "Всё стремится прорвать барьер во мне",
            "Где спрятан твой холодный, старый взгляд",
            "Где вся правда — просто пустой набат",
            '["Эхо силы", "Неудержимый ритм", "песо", "дурачёк", "шторм"]',
        ]
    )

    errors = validate_music_evolution_lyrics_substance(
        lyrics,
        language="ru",
        soloist_id="atya",
        theme="Песо дурачёк жадина говядина",
    )
    codes = {error["code"] for error in errors}

    assert "lyrics_atya_forced_reference_hook" in codes
    assert "lyrics_atya_duplicate_section_block" in codes
    assert "lyrics_atya_json_leak" in codes
