# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Шаблоны и сборка tags/lyrics для режима «Неожиданные переходы» (chaotic_transitions).
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""
Шаблоны и сборка tags/lyrics для режима «Неожиданные переходы» (chaotic_transitions).
Теги: стандартные секции ([intro], [transition], [drop], [breakdown], [build up], [outro]);
первое «NNN BPM» в строке совпадает с основным bpm для UGS (align_first_bpm_in_tags_to_value).

Автотекст песни (если пользователь не ввёл свой): структура как в референсных треках —
заголовки секций на английском в квадратных скобках с жанром и BPM, строки (Voice: …),
куплет/припев и капс-строки в «тяжёлых» частях. Заголовки без кириллицы внутри [] (требование
валидации). Точные метки [Drop] / [Breakdown] без пояснения не используются — только
варианты вида [Drop: Gabber Hardcore, 233 BPM].
"""

from __future__ import annotations

import random
import re
import secrets
from typing import Any, Literal

from api.routers.music_generator_tag_finalize import MAX_TAGS_LENGTH, strip_backticks_from_ace_tags

ChaoticPace = Literal["sharp", "gradual", "sudden"]

CHAOTIC_TRANSITION_TEMPLATES: dict[str, dict[str, Any]] = {
    "classical_to_dnb": {
        "description": "Классика → драм-н-бейс",
        "bpm_start": 60,
        "bpm_end": 174,
        "genre_start": "classical orchestra",
        "genre_end": "aggressive drum and bass",
        "vocal_start": "operatic soprano",
        "vocal_end": "distorted scream",
        "transition_effect": "tape stop and vinyl scratch",
        "instruments_start": ["string quartet", "piano", "timpani"],
        "instruments_end": ["neurofunk bass", "amen break", "snare rolls"],
    },
    "jazz_to_gabber": {
        "description": "Джаз → габбер",
        "bpm_start": 120,
        "bpm_end": 220,
        "genre_start": "smooth jazz",
        "genre_end": "gabber hardcore",
        "vocal_start": "scat singing",
        "vocal_end": "harsh vocal",
        "transition_effect": "record scratch and siren",
        "instruments_start": ["saxophone", "upright bass", "brush drums"],
        "instruments_end": ["distorted 808", "gabber kick", "noise sweeps"],
    },
    "ambient_to_speedcore": {
        "description": "Амбиент → спидкор",
        "bpm_start": 70,
        "bpm_end": 250,
        "genre_start": "atmospheric ambient",
        "genre_end": "speedcore",
        "vocal_start": "whisper",
        "vocal_end": "high pitched shout",
        "transition_effect": "system error tones",
        "instruments_start": ["pads", "field recordings", "wind chimes"],
        "instruments_end": ["blast beats", "bitcrush noise", "distorted kick"],
    },
    "folk_to_industrial": {
        "description": "Фолк → индастриал",
        "bpm_start": 90,
        "bpm_end": 180,
        "genre_start": "Russian folk",
        "genre_end": "industrial metal",
        "vocal_start": "folk choir style",
        "vocal_end": "aggressive shout",
        "transition_effect": "machine noise and metal hits",
        "instruments_start": ["balalaika", "accordion", "folk percussion"],
        "instruments_end": ["distorted guitar", "factory ambience", "metal percussion"],
    },
    "opera_to_trap": {
        "description": "Опера → трэп-метал",
        "bpm_start": 80,
        "bpm_end": 140,
        "genre_start": "opera",
        "genre_end": "trap metal",
        "vocal_start": "opera tenor",
        "vocal_end": "autotune aggressive lead",
        "transition_effect": "record skip and glitch stutter",
        "instruments_start": ["orchestra", "choir", "harp"],
        "instruments_end": ["808 bass", "trap hi-hats", "guitar distortion"],
    },
}

CHAOTIC_TEMPLATE_KEYS: tuple[str, ...] = tuple(CHAOTIC_TRANSITION_TEMPLATES.keys())


def _pick_tuple(rng: random.Random, variants: tuple[tuple[str, ...], ...]) -> tuple[str, ...]:
    return variants[rng.randrange(len(variants))]


# Варианты интро/дропов: более "нормальные" тексты с понятными сюжетами
_JAZZ_INTRO_RU: tuple[tuple[str, str, str, str], ...] = (
    (
        "Вечерний дождь стучит по крышам города,",
        "В баре играет старый джаз, знакомый мотив.",
        "Ты заказал виски, я — кофе со льдом,",
        "И эта ночь казалась бесконечной, как река.",
    ),
    (
        "Дым сигарет смешался с запахом кофе,",
        "Саундтреком был джаз, что лился из колонок.",
        "Мы говорили о мечтах, что остались в прошлом,",
        "И о будущем, что ждало за дверью бара.",
    ),
    (
        "Тихий зал, свечи горят на столиках,",
        "Контрабас играет медленную мелодию.",
        "Ты рассказывал о путешествиях в далёкие страны,",
        "А я слушала, представляя себя рядом с тобой.",
    ),
)
_JAZZ_INTRO_EN: tuple[tuple[str, str, str, str], ...] = (
    (
        "Evening rain taps on the city roofs,",
        "Old jazz plays in the bar, a familiar tune.",
        "You ordered whiskey, I got iced coffee,",
        "And this night seemed endless, like a river.",
    ),
    (
        "Cigarette smoke mixed with coffee scent,",
        "The soundtrack was jazz flowing from speakers.",
        "We talked about dreams left in the past,",
        "And the future waiting outside the bar.",
    ),
    (
        "Quiet hall, candles burn on tables,",
        "Double bass plays a slow melody.",
        "You spoke of travels to distant lands,",
        "And I listened, imagining myself by your side.",
    ),
)
_JAZZ_DROP_CAPS_RU: tuple[tuple[str, str, str, str], ...] = (
    (
        "ТЫ ЛГАЛ МНЕ ВСЕ ЭТИ ГОДА!",
        "КАЖДОЕ СЛОВО БЫЛО ЛОЖЬЮ!",
        "Я ВЫРВУ ЭТУ БОЛЬ ИЗ СЕРДЦА!",
        "И СТАНУ СИЛЬНЕЕ, ЧЕМ БЫЛА!",
    ),
    (
        "ВСЁ КОНЧЕНО! НЕТ ПУТИ НАЗАД!",
        "СЕРДЦЕ РАЗБИТО, НО Я ЕЩЁ ЖИВА!",
        "ЭТА МУЗЫКА — МОЙ НОВЫЙ ГОЛОС!",
        "Я КРИЧУ, ЧТОБЫ ТЕБЯ НЕ СЛЫШАТЬ!",
    ),
    (
        "БОЛЬ ПРЕВРАТИЛАСЬ В СИЛУ!",
        "СЛЁЗЫ СТАЛИ ТОПЛИВОМ!",
        "Я ВОССТАНУ ИЗ ПЕПЛА!",
        "И ЗАБУДУ ТВОЁ ИМЯ!",
    ),
)
_JAZZ_DROP_CAPS_EN: tuple[tuple[str, str, str, str], ...] = (
    (
        "YOU LIED TO ME ALL THESE YEARS!",
        "EVERY WORD WAS A LIE!",
        "I'LL TEAR THIS PAIN FROM MY HEART!",
        "AND BECOME STRONGER THAN BEFORE!",
    ),
    (
        "IT'S OVER! NO WAY BACK!",
        "HEART IS BROKEN, BUT I'M STILL ALIVE!",
        "THIS MUSIC IS MY NEW VOICE!",
        "I SCREAM SO I WON'T HEAR YOU!",
    ),
    (
        "PAIN TURNED INTO STRENGTH!",
        "TEARS BECAME FUEL!",
        "I'LL RISE FROM THE ASHES!",
        "AND FORGET YOUR NAME!",
    ),
)

_CLASSICAL_INTRO_RU: tuple[tuple[str, str, str, str], ...] = (
    (
        "Утро в старом парке, туман над прудом,",
        "Скрипка играет где-то вдалеке.",
        "Мы шли по аллее, держась за руки,",
        "И мир казался совершенным, как симфония.",
    ),
    (
        "Концерт в филармонии, свечи горят,",
        "Оркестр играет Моцарта или Баха.",
        "Ты сидел рядом, и в твоих глазах",
        "Я видела отражение музыки и счастья.",
    ),
    (
        "Дождь за окном, а в комнате — тишина,",
        "И только фортепиано звучит так нежно.",
        "Ты перелистывал ноты, я слушала,",
        "И время остановилось в этом моменте.",
    ),
)
_CLASSICAL_INTRO_EN: tuple[tuple[str, str, str, str], ...] = (
    (
        "Morning in the old park, fog over the pond,",
        "A violin plays somewhere in the distance.",
        "We walked along the alley, holding hands,",
        "And the world seemed perfect, like a symphony.",
    ),
    (
        "Concert at the philharmonic, candles burn,",
        "The orchestra plays Mozart or Bach.",
        "You sat next to me, and in your eyes",
        "I saw the reflection of music and happiness.",
    ),
    (
        "Rain outside, but in the room — silence,",
        "And only the piano sounds so tender.",
        "You turned the pages, I listened,",
        "And time stopped in this moment.",
    ),
)
_CLASSICAL_DROP_CAPS_RU: tuple[tuple[str, str, str, str], ...] = (
    (
        "МИР РАЗЛЕТЕЛСЯ НА ОСКОЛКИ!",
        "МУЗЫКА СТАЛА ОРУЖИЕМ!",
        "Я БЕГУ ОТ ПРОШЛОГО В БУДУЩЕЕ!",
        "И НИЧТО МЕНЯ НЕ ОСТАНОВИТ!",
    ),
    (
        "СКРИПКИ ПРЕВРАТИЛИСЬ В СИРЕНЫ!",
        "БАРАБАНЫ БЬЮТ КАК СЕРДЦЕ!",
        "Я ВЫРЫВАЮСЬ ИЗ КЛЕТКИ!",
        "И ЛЕТАЮ В НОВОМ РИТМЕ!",
    ),
    (
        "ПРОШЛОЕ СГОРЕЛО В ОГНЕ!",
        "НАСТОЯЩЕЕ — ЭТО БИТ!",
        "Я СОЗДАЮ СВОЙ МИР!",
        "ГДЕ МУЗЫКА — МОЙ ЗАКОН!",
    ),
)
_CLASSICAL_DROP_CAPS_EN: tuple[tuple[str, str, str, str], ...] = (
    (
        "THE WORLD SHATTERED INTO PIECES!",
        "MUSIC BECAME A WEAPON!",
        "I RUN FROM PAST TO FUTURE!",
        "AND NOTHING CAN STOP ME!",
    ),
    (
        "VIOLINS TURNED INTO SIRENS!",
        "DRUMS BEAT LIKE A HEART!",
        "I BREAK OUT OF THE CAGE!",
        "AND FLY IN NEW RHYTHM!",
    ),
    (
        "PAST BURNED IN THE FIRE!",
        "PRESENT IS THE BEAT!",
        "I CREATE MY OWN WORLD!",
        "WHERE MUSIC IS MY LAW!",
    ),
)

_AMBIENT_INTRO_RU: tuple[tuple[str, str, str, str], ...] = (
    (
        "Ночь в горах, только звёзды и тишина,",
        "Я сижу у костра и смотрю на огонь.",
        "Мысли текут медленно, как горный ручей,",
        "И кажется, что время здесь не имеет значения.",
    ),
    (
        "Дождь за окном, я включил ambient-плейлист,",
        "Звуки природы смешались с электроникой.",
        "Ты спала рядом, а я думал о жизни,",
        "О том, как всё меняется, но остаётся тем же.",
    ),
    (
        "Рассвет в лесу, туман стелется по земле,",
        "Птицы поют свою утреннюю песню.",
        "Я шёл по тропинке, слушая тишину,",
        "И чувствовал, как мир просыпается вокруг.",
    ),
)
_AMBIENT_INTRO_EN: tuple[tuple[str, str, str, str], ...] = (
    (
        "Night in the mountains, only stars and silence,",
        "I sit by the fire and watch the flames.",
        "Thoughts flow slowly, like a mountain stream,",
        "And it seems time has no meaning here.",
    ),
    (
        "Rain outside, I turned on ambient playlist,",
        "Nature sounds mixed with electronics.",
        "You slept nearby, and I thought about life,",
        "About how everything changes but stays the same.",
    ),
    (
        "Dawn in the forest, fog spreads on the ground,",
        "Birds sing their morning song.",
        "I walked along the path, listening to silence,",
        "And felt the world waking up around me.",
    ),
)
_AMBIENT_DROP_CAPS_RU: tuple[tuple[str, str, str, str], ...] = (
    (
        "ТИШИНА ВЗОРВАЛАСЬ ГРОМОМ!",
        "СПОКОЙСТВИЕ СТАЛО БУРЕЙ!",
        "Я ПРОСЫПАЮСЬ ОТ СНА!",
        "И ВИЖУ МИР ПО-НОВОМУ!",
    ),
    (
        "МЕДИТАЦИЯ СТАЛА ВОЙНОЙ!",
        "ДЫХАНИЕ ПРЕВРАТИЛОСЬ В КРИК!",
        "Я ВЫХОЖУ ИЗ ТЕНИ!",
        "И СТАНОВЛЮСЬ СВЕТОМ!",
    ),
    (
        "ПОКОЙ РАЗРУШЕН НАВСЕГДА!",
        "ТИШИНА УМЕРЛА ВО МНЕ!",
        "Я РОЖДАЮСЬ ЗАНОВО!",
        "В ОГНЕ И ШУМЕ!",
    ),
)
_AMBIENT_DROP_CAPS_EN: tuple[tuple[str, str, str, str], ...] = (
    (
        "SILENCE EXPLODED WITH THUNDER!",
        "CALM BECAME A STORM!",
        "I WAKE FROM SLEEP!",
        "AND SEE THE WORLD ANEW!",
    ),
    (
        "MEDITATION BECAME WAR!",
        "BREATH TURNED INTO SCREAM!",
        "I STEP OUT OF SHADOW!",
        "AND BECOME THE LIGHT!",
    ),
    (
        "PEACE DESTROYED FOREVER!",
        "SILENCE DIED WITHIN ME!",
        "I AM REBORN!",
        "IN FIRE AND NOISE!",
    ),
)

_FOLK_INTRO_RU: tuple[tuple[str, str, str, str], ...] = (
    (
        "Деревня в горах, дым из труб поднимается,",
        "Бабушка поёт старую народную песню.",
        "Мы сидели на крыльце, слушая её голос,",
        "И казалось, что время здесь течёт иначе.",
    ),
    (
        "Праздник в селе, все в народных костюмах,",
        "Гармонь играет, люди водят хоровод.",
        "Ты взял меня за руку, мы закружились,",
        "И забыли о городе, о проблемах, о всём.",
    ),
    (
        "Вечер у костра, гитара звучит тихо,",
        "Мы пели песни, которые знали с детства.",
        "Звёзды над головой, запах хвои и дыма,",
        "И чувство, что здесь — настоящая жизнь.",
    ),
)
_FOLK_INTRO_EN: tuple[tuple[str, str, str, str], ...] = (
    (
        "Village in the mountains, smoke rises from chimneys,",
        "Grandmother sings an old folk song.",
        "We sat on the porch, listening to her voice,",
        "And it seemed time flowed differently here.",
    ),
    (
        "Festival in the village, everyone in folk costumes,",
        "Accordion plays, people dance in a circle.",
        "You took my hand, we started spinning,",
        "And forgot about the city, problems, everything.",
    ),
    (
        "Evening by the fire, guitar sounds softly,",
        "We sang songs we knew since childhood.",
        "Stars above, smell of pine and smoke,",
        "And the feeling that here — is real life.",
    ),
)
_FOLK_DROP_CAPS_RU: tuple[tuple[str, str, str, str], ...] = (
    (
        "ДЕРЕВНЯ СТАЛА ЗАВОДОМ!",
        "ПЕСНИ ПРЕВРАТИЛИСЬ В РЁВ!",
        "Я ЛОМАЮ СТАРЫЕ СТЕНЫ!",
        "И СТРОЮ НОВЫЙ МИР!",
    ),
    (
        "ТРАДИЦИИ СГОРЕЛИ В ПЛАМЕНИ!",
        "НОВОЕ РОЖДАЕТСЯ В ШУМЕ!",
        "Я НЕСУ ОГОНЬ ПЕРЕМЕН!",
        "И ЖГУ ПРОШЛОЕ ДО ТЛА!",
    ),
    (
        "НАРОДНАЯ — СТАЛА ИНДУСТРИАЛЬНОЙ!",
        "МЕЛОДИЯ — СТАЛА УДАРОМ!",
        "Я ПРЕОБРАЖАЮСЬ В БИТЕ!",
        "И СТАНОВЛЮСЬ СИЛЬНЕЕ!",
    ),
)
_FOLK_DROP_CAPS_EN: tuple[tuple[str, str, str, str], ...] = (
    (
        "VILLAGE BECAME A FACTORY!",
        "SONGS TURNED INTO ROAR!",
        "I BREAK OLD WALLS!",
        "AND BUILD NEW WORLD!",
    ),
    (
        "TRADITIONS BURNED IN FLAMES!",
        "NEW IS BORN IN NOISE!",
        "I CARRY FIRE OF CHANGE!",
        "AND BURN PAST TO ASHES!",
    ),
    (
        "FOLK BECAME INDUSTRIAL!",
        "MELODY BECAME A BEAT!",
        "I TRANSFORM IN THE RHYTHM!",
        "AND BECOME STRONGER!",
    ),
)

_OPERA_INTRO_RU: tuple[tuple[str, str, str, str], ...] = (
    (
        "Театр, занавес, ожидание в зале,",
        "Оркестр настраивает инструменты.",
        "Мы сидели в ложе, ждали начала,",
        "И волнение витало в воздухе.",
    ),
    (
        "Опера «Кармен» или «Травиата»,",
        "Солисты выходят на сцену.",
        "Ты смотрел на меня, а я на сцену,",
        "И музыка заполняла всё пространство.",
    ),
    (
        "Репетиция в консерватории,",
        "Студенты разучивают партии.",
        "Ты пел тенором, а я слушала,",
        "И казалось, что это навсегда.",
    ),
)
_OPERA_INTRO_EN: tuple[tuple[str, str, str, str], ...] = (
    (
        "Theater, curtain, anticipation in the hall,",
        "Orchestra tunes instruments.",
        "We sat in the box, waiting for the start,",
        "And excitement hung in the air.",
    ),
    (
        "Opera «Carmen» or «La Traviata»,",
        "Soloists enter the stage.",
        "You looked at me, and I at the stage,",
        "And music filled all the space.",
    ),
    (
        "Rehearsal at the conservatory,",
        "Students learn their parts.",
        "You sang tenor, and I listened,",
        "And it seemed this would last forever.",
    ),
)
_OPERA_DROP_CAPS_RU: tuple[tuple[str, str, str, str], ...] = (
    (
        "ОПЕРА СТАЛА ТРЭПОМ!",
        "АРИЯ — АВТОТЬЮНОМ!",
        "Я ЛОМАЮ СЦЕНУ!",
        "И СОЗДАЮ НОВЫЙ ЗВУК!",
    ),
    (
        "КЛАССИКА УМЕРЛА!",
        "РОДИЛСЯ НОВЫЙ СТИЛЬ!",
        "Я СМЕШИВАЮ ВЕКА!",
        "И ПОЮ НОВУЮ ПЕСНЮ!",
    ),
    (
        "ТЕАТР СТАЛ КЛУБОМ!",
        "ПУБЛИКА — ТОЛПОЙ!",
        "Я КРИЧУ НОВЫЕ СЛОВА!",
        "В СТАРОМ РИТМЕ СЕРДЦА!",
    ),
)
_OPERA_DROP_CAPS_EN: tuple[tuple[str, str, str, str], ...] = (
    (
        "OPERA BECAME TRAP!",
        "ARIA — AUTOTUNE!",
        "I BREAK THE STAGE!",
        "AND CREATE NEW SOUND!",
    ),
    (
        "CLASSICAL DIED!",
        "NEW STYLE IS BORN!",
        "I MIX CENTURIES!",
        "AND SING NEW SONG!",
    ),
    (
        "THEATER BECAME CLUB!",
        "AUDIENCE — A CROWD!",
        "I SCREAM NEW WORDS!",
        "IN OLD HEART RHYTHM!",
    ),
)


def resolve_chaotic_template_key(raw: str | None) -> str:
    """Возвращает ключ шаблона; при «random» или невалидном — случайный."""
    key = (raw or "random").strip().lower()
    if key == "random" or key not in CHAOTIC_TRANSITION_TEMPLATES:
        n = len(CHAOTIC_TEMPLATE_KEYS)
        return CHAOTIC_TEMPLATE_KEYS[secrets.randbelow(n)]
    return key


def _chaos_multiplier(chaos_level: int) -> float:
    return 1.0 + (chaos_level / 10.0) * 0.12


def chaotic_sampler_params(chaos_level: int) -> dict[str, float | int]:
    """
    chaos_level 1–10 → temperature (~0.88–1.0), cfg_scale (~3.3–4.0), KSampler steps (4–8).
    Укладывается в clamp узлов кодирования и сэмплера в music_generator и studio_comfy_workflows.
    """
    cl = max(1, min(10, chaos_level))
    temperature = 0.88 + (cl - 1) / 9.0 * 0.12
    cfg_scale = min(4.0, 3.3 + (cl - 1) / 9.0 * 0.7)
    steps = 4 + int(round((cl - 1) / 9.0 * 4))
    return {
        "temperature": round(min(1.0, temperature), 3),
        "cfg_scale": round(min(4.0, cfg_scale), 3),
        "steps": max(4, min(8, steps)),
    }


def _pace_words(pace: ChaoticPace | None) -> str:
    p = pace or "sharp"
    if p == "gradual":
        return "long crossfade, tempo ramp, filter opens slowly"
    if p == "sudden":
        return "hard cut, mute hit, instant tempo jump"
    return "short riser then hard switch, snare fill into impact"


def _shorten_comma_list(text: str, max_items: int = 3) -> str:
    parts = [p.strip() for p in text.split(",") if p.strip()]
    if len(parts) <= max_items:
        return ", ".join(parts)
    return ", ".join(parts[:max_items])


def normalize_chaotic_ace_section_markers(tags: str) -> str:
    """Приводит нестандартные маркеры секций к канону для UGS."""
    t = tags
    pairs: list[tuple[str, str]] = [
        (r"\[pre_drop\]", "[build up]"),
        (r"\[finale\]", "[chorus]"),
        (r"\[Glitch\s+transition\]", "[transition]"),
        (r"\[glitch\s+transition\]", "[transition]"),
        (r"\[break\s*\d+\]", "[breakdown]"),
        (r"\[pause\s*\d+\]", "[breakdown]"),
        (r"\[pause\]", "[breakdown]"),
        (r"\[build\s*\d+\]", "[build up]"),
        (r"\[rise\s*\d+\]", "[build up]"),
        (r"\[drop\s*\d+\]", "[drop]"),
        (r"\[second\s+drop\]", "[drop]"),
        (r"\[Noise\s*\d+\]", "[breakdown]"),
        (r"\[Glitch\s*\d+\]", "[transition]"),
        (r"\[Bridge\s*\d+\]", "[bridge]"),
    ]
    for pat, repl in pairs:
        t = re.sub(pat, repl, t, flags=re.IGNORECASE)
    return t


def generate_chaotic_transition_tags(
    template: dict[str, Any],
    *,
    chaos_level: int,
    pace: ChaoticPace | None,
    add_glitch: bool,
    add_silence: bool,
    add_scream: bool,
    rng: random.Random | None = None,
) -> str:
    """
    Первое вхождение «NNN BPM» — целевой темп (bpm_end * chaos), как в build_chaotic_bundle,
    чтобы align_first_bpm_in_tags_to_value не ломал задумку.
    """
    rng = rng or random.Random()
    m = _chaos_multiplier(chaos_level)
    bpm_a = int(template["bpm_start"])
    bpm_b = min(320, int(int(template["bpm_end"]) * m))
    bpm_c = min(320, int(bpm_b * 1.08))
    gs = template["genre_start"]
    ge = template["genre_end"]
    vs = template["vocal_start"]
    ve = template["vocal_end"]
    te = template["transition_effect"]
    ins_a = _shorten_comma_list(", ".join(template["instruments_start"][:3]), 3)
    ins_b = _shorten_comma_list(", ".join(template["instruments_end"][:3]), 3)
    pace_bit = _shorten_comma_list(_pace_words(pace), 3)
    trans_body = _shorten_comma_list(f"{te}, {pace_bit}", 3)

    parts: list[str] = [
        f"CHAOTIC TRANSITION: {bpm_b} BPM {ge}, {vs} to {ve}, ",
        f"from {gs} opening (earlier {bpm_a} BPM feel), ",
        f"[intro] {ins_a}, sparse mix, ",
        f"[transition] {trans_body}, ",
    ]
    if chaos_level >= 7:
        parts.append("[bridge] brief contrast bar, ")
    parts.append(f"[drop] {_shorten_comma_list(f'{ge} with {ins_b}', 3)}, aggressive energy, ")
    if add_silence:
        parts.append("[breakdown] near-silence gap, breath room, ")
    else:
        parts.append("[breakdown] heartbeat pulse, room to breathe, ")
    if chaos_level >= 6:
        parts.append("[build up] tension, filtered drums, ")
    parts.append(f"[drop] heavier energy at {bpm_c} BPM, ")
    parts.append("[breakdown] sparse hats, wide stereo, ")
    if add_glitch:
        parts.append("[transition] digital glitch, bitcrush bursts, ")
    parts.append("[outro] fade, tape noise, ")
    if add_scream:
        parts.append("harsh vocal peaks in drops, ")
    mix_word = rng.choice(("wide", "tight", "deep", "dry", "wet", "crushing"))
    parts.append(f"PRODUCTION: {mix_word} mix, extreme dynamics, stereo movement")

    tags = "".join(parts)
    tags = strip_backticks_from_ace_tags(tags)
    tags = normalize_chaotic_ace_section_markers(tags)
    if len(tags) > MAX_TAGS_LENGTH:
        tags = tags[:MAX_TAGS_LENGTH].rstrip(" ,")
    return tags


def _chaotic_title_case_genre(s: str) -> str:
    return " ".join(w[:1].upper() + w[1:] if w else w for w in str(s).strip().split())


def _chaotic_lyrics_jazz_to_gabber(
    *,
    rng: random.Random,
    ru: bool,
    gs: str,
    ge: str,
    bpm_a: int,
    bpm_b: int,
    bpm_c: int,
    te: str,
    add_silence: bool,
    add_scream: bool,
    add_glitch: bool,
    chaos_level: int,
) -> list[str]:
    if ru:
        jr1, jr2, jr3, jr4 = _pick_tuple(rng, _JAZZ_INTRO_RU)
        jd1, jd2, jd3, jd4 = _pick_tuple(rng, _JAZZ_DROP_CAPS_RU)
        lines = [
            f"[Intro: {_chaotic_title_case_genre(gs)}, {bpm_a} BPM]",
            "(Voice: бархатный, томный, близко к микрофону, лёгкая хрипотца)",
            jr1,
            jr2,
            jr3,
            jr4,
            "",
            "[Verse 1]",
            "Мы встречались каждый вечер в том баре,",
            "Где джаз лился как вино из бокала.",
            "Ты рассказывал истории из жизни,",
            "А я верила каждому твоему слову.",
            "",
            "[Chorus]",
            "Но всё изменилось в один миг,",
            "Когда правда вышла наружу.",
            "Ты был не тем, кем казался,",
            "И наша любовь оказалась ложью.",
            "",
            f"[Transition: {te}]",
            "(Voice: резко обрывается, холодный, предупреждающий)",
            "Игра закончена. Слышишь этот звук?",
            "Это не джаз больше. Это вой.",
            "Вой боли, что ты оставил в моём сердце.",
            "",
            f"[Drop: {_chaotic_title_case_genre(ge)}, {bpm_b} BPM]",
            "(Voice: яростный шёпот поверх бита, дисторшн на дублях)",
            jd1,
            jd2,
            jd3,
            jd4,
            "",
            f"[Breakdown: {'Near-silence gap' if add_silence else 'Heartbeat pulse'}]",
            "(Voice: снова близко, прерывистый, уставший)",
            "Вот он... этот стук...",
            "Пустота... на месте сердца...",
            "Тишина... после взрыва...",
            "Но я... ещё жива...",
            "",
            "[Build up: tension, filtered drums]",
            "(Voice: напряжение, без истерики)",
            "Собирается волна... ещё одна...",
            "Боль превращается в силу...",
            "",
            f"[Second Drop: Heavier, {bpm_c} BPM]",
            "(Voice: плотнее, быстрее; ритм врезается в сетку)",
            "БОЛЬШЕ НЕ БУДУ ТВОЕЙ ЖЕРТВОЙ!",
            "Я СОБИРАЮ ОСКОЛКИ СЕБЯ!",
            "НИКАКОЙ ПОЩАДЫ! НИКАКОЙ ПЕЧАЛИ!",
            "Я — ЭТА ЯРОСТЬ! Я — ЭТОТ ФИНАЛ!",
        ]
    else:
        je1, je2, je3, je4 = _pick_tuple(rng, _JAZZ_INTRO_EN)
        jde1, jde2, jde3, jde4 = _pick_tuple(rng, _JAZZ_DROP_CAPS_EN)
        lines = [
            f"[Intro: {_chaotic_title_case_genre(gs)}, {bpm_a} BPM]",
            "(Voice: smooth, close-mic, jazzy delivery, light grit)",
            je1,
            je2,
            je3,
            je4,
            "",
            "[Verse 1]",
            "We met every evening in that bar,",
            "Where jazz flowed like wine from a glass.",
            "You told stories from your life,",
            "And I believed every word you said.",
            "",
            "[Chorus]",
            "But everything changed in one moment,",
            "When the truth came to light.",
            "You were not who you seemed to be,",
            "And our love turned out to be a lie.",
            "",
            f"[Transition: {te}]",
            "(Voice: cuts hard, cold warning)",
            "The game is over. Hear that sound?",
            "It's not jazz anymore. It's a howl.",
            "A howl of pain you left in my heart.",
            "",
            f"[Drop: {_chaotic_title_case_genre(ge)}, {bpm_b} BPM]",
            "(Voice: furious whisper on the beat, distortion on doubles)",
            jde1,
            jde2,
            jde3,
            jde4,
            "",
            f"[Breakdown: {'Near-silence gap' if add_silence else 'Heartbeat pulse'}]",
            "(Voice: close again, broken, tired)",
            "There it is... that knock...",
            "Hollow... where the heart was...",
            "Quiet... after the blast...",
            "But I... am still alive...",
            "",
            "[Build up: tension, filtered drums]",
            "(Voice: tension without hysteria)",
            "Another wave is building...",
            "Pain turns into strength...",
            "",
            f"[Second Drop: Heavier, {bpm_c} BPM]",
            "(Voice: denser, faster; rhythm locks to the grid)",
            "NO LONGER YOUR VICTIM!",
            "I GATHER THE SHARDS OF ME!",
            "NO MERCY! NO SORROW!",
            "I AM THIS FURY! I AM THIS END!",
        ]

    if add_scream:
        lines.extend(
            [
                "",
                "[Hook: emotional peak]",
                "(Voice: raw, emotional release)",
                "WHY?! WHY DID YOU LIE?!" if not ru else "ЗАЧЕМ?! ЗАЧЕМ ТЫ ЛГАЛ?!",
            ]
        )
    if add_glitch:
        lines.extend(
            [
                "",
                "[Bridge: digital glitch stutter]",
                "Broken... trust... shattered... dreams..."
                if not ru
                else "Разбитое... доверие... сломанные... мечты...",
            ]
        )
    if chaos_level >= 8:
        lines.extend(
            [
                "",
                "[Bridge: tempo change]",
                "Everything speeds up, can't keep up..." if not ru else "Всё ускоряется, не успеваю...",
            ]
        )

    lines.extend(
        [
            "",
            "[Outro: Fade, tape noise]",
            "(Voice: calm, resolved)",
            "I'll be okay... I'll move on..." if not ru else "Всё будет хорошо... Я справлюсь...",
            "The music fades... but I remain..." if not ru else "Музыка стихает... но я остаюсь...",
            "[Fade to silence]",
        ]
    )
    return lines


def _chaotic_lyrics_classical_to_dnb(
    *,
    rng: random.Random,
    ru: bool,
    gs: str,
    ge: str,
    bpm_a: int,
    bpm_b: int,
    bpm_c: int,
    te: str,
    add_silence: bool,
    add_scream: bool,
    add_glitch: bool,
    chaos_level: int,
) -> list[str]:
    if ru:
        cr1, cr2, cr3, cr4 = _pick_tuple(rng, _CLASSICAL_INTRO_RU)
        cd1, cd2, cd3, cd4 = _pick_tuple(rng, _CLASSICAL_DROP_CAPS_RU)
        lines = [
            f"[Intro: {_chaotic_title_case_genre(gs)}, {bpm_a} BPM]",
            "(Voice: женский, задумчивый, воздушный, лёгкий реверб)",
            cr1,
            cr2,
            cr3,
            cr4,
            "",
            "[Verse 1]",
            "Мы ходили в филармонию каждое воскресенье,",
            "Слушали классику, мечтали о будущем.",
            "Ты держал мою руку во время концерта,",
            "И я думала, что так будет всегда.",
            "",
            "[Chorus]",
            "Но жизнь внесла свои коррективы,",
            "И наши пути разошлись.",
            "Ты ушёл в свой мир, а я осталась",
            "С музыкой, что стала моим убежищем.",
            "",
            f"[Transition: {te}]",
            "(Voice: напряжение нарастает)",
            "Слышишь? Темп меняется. Музыка ломается.",
            "Старое умирает, рождается новое.",
            "Я больше не та девочка из филармонии.",
            "",
            f"[Drop: {_chaotic_title_case_genre(ge)}, {bpm_b} BPM]",
            "(Voice: уверенный, ритмичный)",
            cd1,
            cd2,
            cd3,
            cd4,
            "",
            f"[Breakdown: {'Near-silence gap' if add_silence else 'Atmospheric pads, heartbeat sub-bass'}]",
            "(Voice: очень близко, шёпот)",
            "Чувствуешь? Пространство между ударами?",
            "Там я нашла себя. Там я свободна.",
            "Просто дыши... и слушай...",
            "",
            "[Build up: snare fills, rising pitch]",
            "(Voice: напряжение, без истерики)",
            "Собирается энергия... готовься...",
            "",
            f"[Second Drop: Heavier, {bpm_c} BPM]",
            "(Voice: эйфория, энергия)",
            "СМОТРИ, КАК МИР МЕНЯЕТСЯ ВБЕГ!",
            "МИЛЛИОН ВОЗМОЖНОСТЕЙ ОТКРЫВАЮТСЯ!",
            "НЕ БОЙСЯ ИЗМЕНЕНИЙ — ПРИНЯ ИХ!",
            "ЭТО НАЧАЛО НОВОЙ ЖИЗНИ!",
        ]
    else:
        ce1, ce2, ce3, ce4 = _pick_tuple(rng, _CLASSICAL_INTRO_EN)
        cde1, cde2, cde3, cde4 = _pick_tuple(rng, _CLASSICAL_DROP_CAPS_EN)
        lines = [
            f"[Intro: {_chaotic_title_case_genre(gs)}, {bpm_a} BPM]",
            "(Voice: female, pensive, dreamy, light reverb)",
            ce1,
            ce2,
            ce3,
            ce4,
            "",
            "[Verse 1]",
            "We went to the philharmonic every Sunday,",
            "Listened to classical music, dreamed about the future.",
            "You held my hand during concerts,",
            "And I thought it would always be like this.",
            "",
            "[Chorus]",
            "But life made its adjustments,",
            "And our paths diverged.",
            "You went into your world, and I stayed",
            "With music that became my refuge.",
            "",
            f"[Transition: {te}]",
            "(Voice: tension builds)",
            "Listen... the tempo is changing. The music is breaking.",
            "The old is dying, the new is being born.",
            "I'm no longer that girl from the philharmonic.",
            "",
            f"[Drop: {_chaotic_title_case_genre(ge)}, {bpm_b} BPM]",
            "(Voice: confident, rhythmic)",
            cde1,
            cde2,
            cde3,
            cde4,
            "",
            f"[Breakdown: {'Near-silence gap' if add_silence else 'Atmospheric pads, heartbeat sub-bass'}]",
            "(Voice: close, breathy, intimate)",
            "Do you feel it? The space between the beats?",
            "That's where I found myself. That's where I'm free.",
            "Just breathe... and listen...",
            "",
            "[Build up: snare fills, rising pitch]",
            "(Voice: tension without hysteria)",
            "Energy is building... get ready...",
            "",
            f"[Second Drop: Heavier, {bpm_c} BPM]",
            "(Voice: euphoric, energetic)",
            "WATCH HOW THE WORLD CHANGES IN A MOMENT!",
            "A MILLION POSSIBILITIES OPEN UP!",
            "DON'T FEAR CHANGE — EMBRACE IT!",
            "THIS IS THE START OF A NEW LIFE!",
        ]

    if add_scream:
        lines.extend(
            [
                "",
                "[Hook: emotional release]",
                "(Voice: powerful, cathartic)",
                "I'M FREE! I'M ALIVE!" if not ru else "Я СВОБОДНА! Я ЖИВА!",
            ]
        )
    if add_glitch:
        lines.extend(
            [
                "",
                "[Bridge: digital glitch]",
                "Transformation... evolution..." if not ru else "Трансформация... эволюция...",
            ]
        )
    if chaos_level >= 8:
        lines.extend(
            [
                "",
                "[Bridge: rhythm break]",
                "Everything shifts, then locks back in." if not ru else "Всё смещается, затем возвращается.",
            ]
        )

    lines.extend(
        [
            "",
            "[Outro: Fade on atmospheric pads]",
            "(Voice: peaceful, content)",
            "And so the journey continues..." if not ru else "И так продолжается путешествие...",
            "With music as my guide..." if not ru else "С музыкой как проводником...",
            "[Fade to gentle rain and distant strings]",
        ]
    )
    return lines


def _chaotic_lyrics_ambient_to_speedcore(
    *,
    rng: random.Random,
    ru: bool,
    gs: str,
    ge: str,
    bpm_a: int,
    bpm_b: int,
    bpm_c: int,
    te: str,
    add_silence: bool,
    add_scream: bool,
    add_glitch: bool,
    chaos_level: int,
) -> list[str]:
    if ru:
        ar1, ar2, ar3, ar4 = _pick_tuple(rng, _AMBIENT_INTRO_RU)
        ad1, ad2, ad3, ad4 = _pick_tuple(rng, _AMBIENT_DROP_CAPS_RU)
        lines = [
            f"[Intro: {_chaotic_title_case_genre(gs)}, {bpm_a} BPM]",
            "(Voice: шёпот, спокойный, медитативный)",
            ar1,
            ar2,
            ar3,
            ar4,
            "",
            "[Verse 1]",
            "Я искал покой в горах и лесах,",
            "Слушал тишину, наблюдал за природой.",
            "Думал, что найду ответы в спокойствии,",
            "Но нашёл только больше вопросов.",
            "",
            "[Chorus]",
            "И тогда я понял — покой не в тишине,",
            "А в принятии шума внутри себя.",
            "Не в бегстве от мира, а в слиянии с ним,",
            "Даже если этот мир громкий и быстрый.",
            "",
            f"[Transition: {te}]",
            "(Voice: напряжение, электронные помехи)",
            "Система перегружена. Переход неизбежен.",
            "Тишина взрывается изнутри.",
            "Готовься к переменам.",
            "",
            f"[Drop: {_chaotic_title_case_genre(ge)}, {bpm_b} BPM]",
            "(Voice: цифровой, агрессивный, но контролируемый)",
            ad1,
            ad2,
            ad3,
            ad4,
            "",
            f"[Breakdown: {'Near-silence gap' if add_silence else 'Heartbeat pulse'}]",
            "(Voice: спокойный, осознанный)",
            "Вот он... момент между...",
            "Между тишиной и шумом...",
            "Между прошлым и будущим...",
            "Здесь я нахожу баланс...",
            "",
            "[Build up: noise ramp, BPM climb]",
            "(Voice: решительный)",
            "Пришло время... действовать...",
            "Превратить мысли в движение...",
            "",
            f"[Second Drop: Heavier, {bpm_c} BPM]",
            "(Voice: быстрый, энергичный)",
            "МЫСЛИ СТАЛИ ДЕЙСТВИЯМИ!",
            "СПОКОЙСТВИЕ СТАЛО СИЛОЙ!",
            "Я НЕ БЕГУ ОТ ШУМА — Я ЕГО ЧАСТЬ!",
            "Я — ЭНЕРГИЯ В ЧИСТОМ ВИДЕ!",
        ]
    else:
        ae1, ae2, ae3, ae4 = _pick_tuple(rng, _AMBIENT_INTRO_EN)
        ade1, ade2, ade3, ade4 = _pick_tuple(rng, _AMBIENT_DROP_CAPS_EN)
        lines = [
            f"[Intro: {_chaotic_title_case_genre(gs)}, {bpm_a} BPM]",
            "(Voice: whisper, calm, meditative)",
            ae1,
            ae2,
            ae3,
            ae4,
            "",
            "[Verse 1]",
            "I searched for peace in mountains and forests,",
            "Listened to silence, watched nature.",
            "Thought I'd find answers in calmness,",
            "But found only more questions.",
            "",
            "[Chorus]",
            "And then I understood — peace isn't in silence,",
            "But in accepting the noise within.",
            "Not in escaping the world, but merging with it,",
            "Even if this world is loud and fast.",
            "",
            f"[Transition: {te}]",
            "(Voice: tension, electronic interference)",
            "System overload. Transition inevitable.",
            "Silence explodes from within.",
            "Prepare for changes.",
            "",
            f"[Drop: {_chaotic_title_case_genre(ge)}, {bpm_b} BPM]",
            "(Voice: digital, aggressive but controlled)",
            ade1,
            ade2,
            ade3,
            ade4,
            "",
            f"[Breakdown: {'Near-silence gap' if add_silence else 'Heartbeat pulse'}]",
            "(Voice: calm, aware)",
            "Here it is... the moment between...",
            "Between silence and noise...",
            "Between past and future...",
            "Here I find balance...",
            "",
            "[Build up: noise ramp, BPM climb]",
            "(Voice: determined)",
            "Time to... act...",
            "Turn thoughts into motion...",
            "",
            f"[Second Drop: Heavier, {bpm_c} BPM]",
            "(Voice: fast, energetic)",
            "THOUGHTS BECAME ACTIONS!",
            "CALM BECAME STRENGTH!",
            "I DON'T RUN FROM NOISE — I'M PART OF IT!",
            "I AM ENERGY IN PURE FORM!",
        ]

    if add_scream:
        lines.extend(
            ["", "[Hook: release]", "(Voice: cathartic shout)", "YES! THIS IS ME!" if not ru else "ДА! ЭТО Я!"]
        )
    if add_glitch:
        lines.extend(
            [
                "",
                "[Bridge: digital transformation]",
                "Becoming... evolving... transforming..."
                if not ru
                else "Становлюсь... эволюционирую... преобразуюсь...",
            ]
        )
    if chaos_level >= 8:
        lines.extend(
            [
                "",
                "[Bridge: tempo chaos]",
                "Losing control to find true control." if not ru else "Теряю контроль, чтобы найти истинный контроль.",
            ]
        )

    lines.extend(
        [
            "",
            "[Outro: Digital fade]",
            "(Voice: peaceful, transformed)",
            "The noise becomes music..." if not ru else "Шум становится музыкой...",
            "And I become the composer..." if not ru else "И я становлюсь композитором...",
            "[Fade to synthesized nature sounds]",
        ]
    )
    return lines


def _chaotic_lyrics_folk_to_industrial(
    *,
    rng: random.Random,
    ru: bool,
    gs: str,
    ge: str,
    bpm_a: int,
    bpm_b: int,
    bpm_c: int,
    te: str,
    add_silence: bool,
    add_scream: bool,
    add_glitch: bool,
    chaos_level: int,
) -> list[str]:
    if ru:
        fr1, fr2, fr3, fr4 = _pick_tuple(rng, _FOLK_INTRO_RU)
        fd1, fd2, fd3, fd4 = _pick_tuple(rng, _FOLK_DROP_CAPS_RU)
        lines = [
            f"[Intro: {_chaotic_title_case_genre(gs)}, {bpm_a} BPM]",
            "(Voice: народный, тёплый, с улыбкой)",
            fr1,
            fr2,
            fr3,
            fr4,
            "",
            "[Verse 1]",
            "Вырос в деревне, среди полей и лесов,",
            "Пел народные песни с детства.",
            "Дед учил играть на гармони,",
            "Бабушка — печь пироги и верить в чудеса.",
            "",
            "[Chorus]",
            "Но время идёт, и мир меняется,",
            "Деревни пустеют, молодёжь уезжает.",
            "Традиции забываются, песни стихают,",
            "И только память остаётся в сердце.",
            "",
            f"[Transition: {te}]",
            "(Voice: резкий, решительный)",
            "Хватит ностальгии! Пора двигаться вперёд!",
            "Традиции не должны умирать — они должны эволюционировать!",
            "Старое в новом, народное в современном!",
            "",
            f"[Drop: {_chaotic_title_case_genre(ge)}, {bpm_b} BPM]",
            "(Voice: агрессивный, но с народными интонациями)",
            fd1,
            fd2,
            fd3,
            fd4,
            "",
            f"[Breakdown: {'Near-silence gap' if add_silence else 'Heartbeat pulse'}]",
            "(Voice: тёплый, но решительный)",
            "Слышишь? Бой сердца...",
            "Тот же ритм, что и в народных песнях...",
            "Только теперь он сильнее... громче...",
            "",
            "[Build up: metal impacts stacking]",
            "(Voice: энергичный)",
            "Собираем старое и новое...",
            "Создаём будущее из прошлого...",
            "",
            f"[Second Drop: Heavier, {bpm_c} BPM]",
            "(Voice: мощный, объединяющий)",
            "НАРОДНАЯ МУДРОСТЬ В СТАЛЬНОЙ ОПРАВЕ!",
            "ТРАДИЦИИ ЖИВУТ В НОВОМ ВЕКЕ!",
            "МЫ НЕ ЗАБЫВАЕМ КОРНИ — МЫ РАСТЁМ ВВЕРХ!",
            "ЭТО НАША КУЛЬТУРА, НАША СИЛА!",
        ]
    else:
        fe1, fe2, fe3, fe4 = _pick_tuple(rng, _FOLK_INTRO_EN)
        fde1, fde2, fde3, fde4 = _pick_tuple(rng, _FOLK_DROP_CAPS_EN)
        lines = [
            f"[Intro: {_chaotic_title_case_genre(gs)}, {bpm_a} BPM]",
            "(Voice: folk, warm, with a smile)",
            fe1,
            fe2,
            fe3,
            fe4,
            "",
            "[Verse 1]",
            "Grew up in a village, among fields and forests,",
            "Sang folk songs since childhood.",
            "Grandfather taught to play accordion,",
            "Grandmother — to bake pies and believe in miracles.",
            "",
            "[Chorus]",
            "But time passes, and the world changes,",
            "Villages empty, youth leaves.",
            "Traditions are forgotten, songs fade,",
            "And only memory remains in the heart.",
            "",
            f"[Transition: {te}]",
            "(Voice: sharp, determined)",
            "Enough nostalgia! Time to move forward!",
            "Traditions shouldn't die — they should evolve!",
            "Old in new, folk in modern!",
            "",
            f"[Drop: {_chaotic_title_case_genre(ge)}, {bpm_b} BPM]",
            "(Voice: aggressive but with folk intonations)",
            fde1,
            fde2,
            fde3,
            fde4,
            "",
            f"[Breakdown: {'Near-silence gap' if add_silence else 'Heartbeat pulse'}]",
            "(Voice: warm but determined)",
            "Hear? The heartbeat...",
            "Same rhythm as in folk songs...",
            "Only now it's stronger... louder...",
            "",
            "[Build up: metal impacts stacking]",
            "(Voice: energetic)",
            "Collecting old and new...",
            "Creating future from past...",
            "",
            f"[Second Drop: Heavier, {bpm_c} BPM]",
            "(Voice: powerful, unifying)",
            "FOLK WISDOM IN STEEL SETTING!",
            "TRADITIONS LIVE IN NEW AGE!",
            "WE DON'T FORGET ROOTS — WE GROW UPWARD!",
            "THIS IS OUR CULTURE, OUR STRENGTH!",
        ]

    if add_scream:
        lines.extend(
            [
                "",
                "[Hook: powerful shout]",
                "(Voice: tribal, powerful)",
                "FOR THE ANCESTORS! FOR THE FUTURE!" if not ru else "ЗА ПРЕДКОВ! ЗА БУДУЩЕЕ!",
            ]
        )
    if add_glitch:
        lines.extend(
            [
                "",
                "[Bridge: mechanical folk]",
                "Old melodies... new machines..." if not ru else "Старые мелодии... новые машины...",
            ]
        )
    if chaos_level >= 8:
        lines.extend(
            [
                "",
                "[Bridge: cultural fusion]",
                "East meets West, past meets future."
                if not ru
                else "Восток встречает Запад, прошлое встречает будущее.",
            ]
        )

    lines.extend(
        [
            "",
            "[Outro: Fade to folk instruments with industrial effects]",
            "(Voice: proud, content)",
            "The circle continues..." if not ru else "Круг продолжается...",
            "Old becomes new, new honors old..." if not ru else "Старое становится новым, новое чтит старое...",
            "[Fade to accordion with factory sounds]",
        ]
    )
    return lines


def _chaotic_lyrics_opera_to_trap(
    *,
    rng: random.Random,
    ru: bool,
    gs: str,
    ge: str,
    bpm_a: int,
    bpm_b: int,
    bpm_c: int,
    te: str,
    add_silence: bool,
    add_scream: bool,
    add_glitch: bool,
    chaos_level: int,
) -> list[str]:
    if ru:
        or1, or2, or3, or4 = _pick_tuple(rng, _OPERA_INTRO_RU)
        od1, od2, od3, od4 = _pick_tuple(rng, _OPERA_DROP_CAPS_RU)
        lines = [
            f"[Intro: {_chaotic_title_case_genre(gs)}, {bpm_a} BPM]",
            "(Voice: оперный тенор, театральная декламация)",
            or1,
            or2,
            or3,
            or4,
            "",
            "[Verse 1]",
            "Учился в консерватории, мечтал о сцене,",
            "О партиях в операх, о аплодисментах.",
            "Но мир изменился, и музыка тоже,",
            "И классика уступила место чему-то новому.",
            "",
            "[Chorus]",
            "И я понял — искусство не стоит на месте,",
            "Оно развивается, меняется, растёт.",
            "Нельзя цепляться за прошлое,",
            "Нужно идти в ногу со временем.",
            "",
            f"[Transition: {te}]",
            "(Voice: голос ломается, появляется автотюн)",
            "Старые правила больше не работают.",
            "Новая эра требует нового звука.",
            "Готовься к революции.",
            "",
            f"[Drop: {_chaotic_title_case_genre(ge)}, {bpm_b} BPM]",
            "(Voice: автотюн-агрессия, ритмичный рэп)",
            od1,
            od2,
            od3,
            od4,
            "",
            f"[Breakdown: {'Near-silence gap' if add_silence else 'Heartbeat pulse'}]",
            "(Voice: чистый, без эффектов)",
            "Вот он... момент истины...",
            "Когда понимаешь, кто ты на самом деле...",
            "Не оперный певец, не рэпер...",
            "Просто музыкант, который ищет свой путь...",
            "",
            "[Build up: 808 slides, hi-hat rolls]",
            "(Voice: напряжение, переход)",
            "Собираю всё, что знал...",
            "И создаю что-то совершенно новое...",
            "",
            f"[Second Drop: Heavier, {bpm_c} BPM]",
            "(Voice: уверенный, объединяющий стили)",
            "КЛАССИКА ВСТРЕЧАЕТСЯ С СОВРЕМЕННОСТЬЮ!",
            "ОПЕРА СЛИВАЕТСЯ С ТРЭПОМ!",
            "Я НЕ ИЗМЕНЯЮ ИСКУССТВУ — Я РАЗВИВАЮ ЕГО!",
            "ЭТО НОВАЯ ГЛАВА В ИСТОРИИ МУЗЫКИ!",
        ]
    else:
        oe1, oe2, oe3, oe4 = _pick_tuple(rng, _OPERA_INTRO_EN)
        ode1, ode2, ode3, ode4 = _pick_tuple(rng, _OPERA_DROP_CAPS_EN)
        lines = [
            f"[Intro: {_chaotic_title_case_genre(gs)}, {bpm_a} BPM]",
            "(Voice: operatic tenor, theatrical declamation)",
            oe1,
            oe2,
            oe3,
            oe4,
            "",
            "[Verse 1]",
            "Studied at conservatory, dreamed of stage,",
            "Of opera parts, of applause.",
            "But the world changed, and music too,",
            "And classical gave way to something new.",
            "",
            "[Chorus]",
            "And I understood — art doesn't stand still,",
            "It develops, changes, grows.",
            "Can't cling to the past,",
            "Need to keep up with the times.",
            "",
            f"[Transition: {te}]",
            "(Voice: voice breaks, autotune appears)",
            "Old rules don't work anymore.",
            "New era demands new sound.",
            "Prepare for revolution.",
            "",
            f"[Drop: {_chaotic_title_case_genre(ge)}, {bpm_b} BPM]",
            "(Voice: autotune aggression, rhythmic rap)",
            ode1,
            ode2,
            ode3,
            ode4,
            "",
            f"[Breakdown: {'Near-silence gap' if add_silence else 'Heartbeat pulse'}]",
            "(Voice: clean, no effects)",
            "Here it is... the moment of truth...",
            "When you understand who you really are...",
            "Not an opera singer, not a rapper...",
            "Just a musician searching for his path...",
            "",
            "[Build up: 808 slides, hi-hat rolls]",
            "(Voice: tension, transition)",
            "Collecting everything I knew...",
            "And creating something completely new...",
            "",
            f"[Second Drop: Heavier, {bpm_c} BPM]",
            "(Voice: confident, merging styles)",
            "CLASSICAL MEETS MODERN!",
            "OPERA MERGES WITH TRAP!",
            "I'M NOT BETRAYING ART — I'M DEVELOPING IT!",
            "THIS IS A NEW CHAPTER IN MUSIC HISTORY!",
        ]

    if add_scream:
        lines.extend(
            [
                "",
                "[Hook: powerful vocal]",
                "(Voice: operatic power with distortion)",
                "THE FUTURE IS NOW!" if not ru else "БУДУЩЕЕ НАСТУПИЛО!",
            ]
        )
    if add_glitch:
        lines.extend(
            [
                "",
                "[Bridge: style collision]",
                "Baroque patterns... trap beats..." if not ru else "Барокко... трэп-биты...",
            ]
        )
    if chaos_level >= 8:
        lines.extend(
            [
                "",
                "[Bridge: genre bending]",
                "Breaking all boundaries, creating new ones." if not ru else "Ломаю все границы, создаю новые.",
            ]
        )

    lines.extend(
        [
            "",
            "[Outro: Classical fade with modern effects]",
            "(Voice: satisfied, accomplished)",
            "The journey continues..." if not ru else "Путешествие продолжается...",
            "Always learning, always growing..." if not ru else "Всегда учусь, всегда расту...",
            "[Fade to orchestral hits with 808 tail]",
        ]
    )
    return lines


def generate_chaotic_lyrics(
    template: dict[str, Any],
    template_key: str,
    *,
    chaos_level: int,
    language: str,
    add_glitch: bool,
    add_silence: bool,
    add_scream: bool,
    rng: random.Random | None = None,
) -> str:
    """
    Если пользователь не ввёл текст — богатая структура (реф. song.md): [Intro: Genre, BPM],
    (Voice: …), куплетные строки, капс в дропах, Second Drop / Second Breakdown, Outro.
    Заголовки в [] только на латинице (проверка validate_lyrics_for_music).
    """
    rng = rng or random.Random(secrets.randbits(64))
    lang = (language or "ru").strip().lower()
    ru = lang.startswith("ru")

    gs_en = str(template["genre_start"]).strip()
    ge_en = str(template["genre_end"]).strip()

    m = _chaos_multiplier(chaos_level)
    bpm_a = int(template["bpm_start"])
    bpm_b = min(320, int(int(template["bpm_end"]) * m))
    bpm_c = min(320, int(bpm_b * 1.08))
    te = str(template["transition_effect"]).strip()

    key = template_key if template_key in CHAOTIC_TRANSITION_TEMPLATES else "jazz_to_gabber"
    if key == "classical_to_dnb":
        lines = _chaotic_lyrics_classical_to_dnb(
            rng=rng,
            ru=ru,
            gs=gs_en,
            ge=ge_en,
            bpm_a=bpm_a,
            bpm_b=bpm_b,
            bpm_c=bpm_c,
            te=te,
            add_silence=add_silence,
            add_scream=add_scream,
            add_glitch=add_glitch,
            chaos_level=chaos_level,
        )
    elif key == "jazz_to_gabber":
        lines = _chaotic_lyrics_jazz_to_gabber(
            rng=rng,
            ru=ru,
            gs=gs_en,
            ge=ge_en,
            bpm_a=bpm_a,
            bpm_b=bpm_b,
            bpm_c=bpm_c,
            te=te,
            add_silence=add_silence,
            add_scream=add_scream,
            add_glitch=add_glitch,
            chaos_level=chaos_level,
        )
    elif key == "ambient_to_speedcore":
        lines = _chaotic_lyrics_ambient_to_speedcore(
            rng=rng,
            ru=ru,
            gs=gs_en,
            ge=ge_en,
            bpm_a=bpm_a,
            bpm_b=bpm_b,
            bpm_c=bpm_c,
            te=te,
            add_silence=add_silence,
            add_scream=add_scream,
            add_glitch=add_glitch,
            chaos_level=chaos_level,
        )
    elif key == "folk_to_industrial":
        lines = _chaotic_lyrics_folk_to_industrial(
            rng=rng,
            ru=ru,
            gs=gs_en,
            ge=ge_en,
            bpm_a=bpm_a,
            bpm_b=bpm_b,
            bpm_c=bpm_c,
            te=te,
            add_silence=add_silence,
            add_scream=add_scream,
            add_glitch=add_glitch,
            chaos_level=chaos_level,
        )
    else:
        lines = _chaotic_lyrics_opera_to_trap(
            rng=rng,
            ru=ru,
            gs=gs_en,
            ge=ge_en,
            bpm_a=bpm_a,
            bpm_b=bpm_b,
            bpm_c=bpm_c,
            te=te,
            add_silence=add_silence,
            add_scream=add_scream,
            add_glitch=add_glitch,
            chaos_level=chaos_level,
        )

    return "\n".join(lines).strip()


def build_chaotic_bundle(
    *,
    template_key: str,
    chaos_level: int,
    pace: ChaoticPace | None,
    add_glitch: bool,
    add_silence: bool,
    add_scream: bool,
    language: str,
) -> dict[str, Any]:
    """Собирает tags, lyrics, bpm и параметры сэмплера для chaotic_transitions."""
    rng = random.Random(secrets.randbits(64))
    tpl = CHAOTIC_TRANSITION_TEMPLATES[template_key]
    cl = max(1, min(10, chaos_level))
    tags = generate_chaotic_transition_tags(
        tpl,
        chaos_level=cl,
        pace=pace,
        add_glitch=add_glitch,
        add_silence=add_silence,
        add_scream=add_scream,
        rng=rng,
    )
    lyrics = generate_chaotic_lyrics(
        tpl,
        template_key,
        chaos_level=cl,
        language=language,
        add_glitch=add_glitch,
        add_silence=add_silence,
        add_scream=add_scream,
        rng=rng,
    )
    samp = chaotic_sampler_params(cl)
    temp = float(samp["temperature"])
    cfg = float(samp["cfg_scale"])
    steps = int(samp["steps"])
    temp = round(min(1.0, max(0.0, temp + rng.uniform(-0.028, 0.028))), 3)
    cfg = round(min(4.0, max(0.0, cfg + rng.uniform(-0.12, 0.12))), 3)
    steps = max(4, min(8, steps + rng.randint(-1, 1)))
    bpm = min(320, max(40, int(int(tpl["bpm_end"]) * _chaos_multiplier(cl))))
    return {
        "tags": tags,
        "lyrics": lyrics,
        "bpm": bpm,
        "temperature": temp,
        "cfg_scale": cfg,
        "steps": steps,
        "resolved_template_key": template_key,
    }
