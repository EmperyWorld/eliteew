# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   ACE Step 1.5: финализация tags (BPM, EDM-маркеры, XL Base dedupe/compress/cap секций).
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""
ACE Step 1.5: дополнение поля tags (BPM, [build up]/[drop] для электронных пресетов).
Вынесено из music_generator.py для лёгких unit-тестов без импорта всего роутера.
"""

from __future__ import annotations

import re

# Лимит длины tags (совпадает с music_generator.MAX_TAGS_LENGTH для роутера).
MAX_TAGS_LENGTH = 2000
XL_BASE_TAGS_MAX_LEN = 1600
XL_BASE_TAGS_SECTION_CAP = 10

# Длинные «литературные» вставки из LLM плохо парсятся ACE; убираем типичные хвосты.
ACE_STEP_TAG_VOCAB_HINT_EN = """
ACE TAG VOCABULARY (concise — use sparingly, comma-separated):
- Order: BPM + genre flavor + vocal (e.g. female vocal with emotional delivery), then [intro] … [verse] … [chorus] … with concrete instruments per section.
- Vocals: lead vocal, backing vocal, vocal harmonies, breathy vocal, powerful vocal, whisper vocal — not abstract mood adjectives alone.
- Drums: kick drum, snare drum, hi-hat, four on the floor, 808, breakbeat, drum machine.
- Guitars: clean guitar, distorted guitar, guitar riff, bass guitar.
- Keys/synth: piano, rhodes, synth pad, synth lead, supersaw, pluck synth, arpeggio.
- Strings/brass: orchestral strings, violin, brass section.
- Mix/FX: sidechain compression, reverb, delay, wide stereo, clean mix, saturation.
- Syntax: use commas between cues; never use backtick characters; keep sections as [intro], [verse], [chorus] in lowercase.
- Mood must match the lyrics theme AND the genre preset (no genre whiplash).
""".strip()


_TAG_LITERARY_PHRASES: tuple[str, ...] = (
    "to reflect the emotional depth and mystical theme",
    "to reflect the emotional depth",
    "with a touch of ethereal synths to reflect the emotional depth",
    "with ethereal synths to reflect",
    "Tying arrangement to emotional theme",
    "Tying arrangement to the emotional theme",
    "Journey of self-discovery",
    "mirroring the inner turmoil",
    "showcased through dynamic contrast",
    "for added dynamics",
    "creating movement without losing intensity",
    "evoke a sense of wonder",
    "evoke a sense of",
    "evoking a sense of",
    "End with a short English phrase tying arrangement",
)


def strip_backticks_from_ace_tags(tags: str) -> str:
    """
    LLM иногда вставляет обратные кавычки вместо запятых — ломает разбор ACE.
    Удаляем все ` и нормализуем пробелы.
    """
    t = (tags or "").strip()
    if not t or "`" not in t:
        return t
    t = t.replace("`", " ")
    t = re.sub(r"\s{2,}", " ", t)
    t = re.sub(r"\s*,\s*", ", ", t)
    return t.strip(" ,")


def substitute_first_bpm_token_in_text(text: str, bpm: int) -> str:
    """Первое вхождение «NNN BPM» (2–3 цифры + BPM) заменяет на bpm; для брифа Style/жанра."""
    t = (text or "").strip()
    if not t:
        return t
    bpm_clamped = max(10, min(300, int(bpm)))
    if not re.search(r"\b\d{2,3}\s*BPM\b", t, flags=re.I):
        return t
    return re.sub(r"\b\d{2,3}\s*BPM\b", f"{bpm_clamped} BPM", t, count=1, flags=re.I)


def align_first_bpm_in_tags_to_value(tags: str, bpm: int) -> tuple[str, bool]:
    """
    Первое вхождение «NNN BPM» в строке tags приводит к bpm из запроса (40–320),
    если отличается — чтобы совпадать с полем формы и с Comfy.
    """
    t = (tags or "").strip()
    if not t:
        return t, False
    bpm_clamped = max(40, min(320, int(bpm)))
    m = re.search(r"\b(\d{2,3})\s*BPM\b", t, flags=re.I)
    if not m:
        return t, False
    try:
        current = int(m.group(1))
    except ValueError:
        return t, False
    if current == bpm_clamped:
        return t, False
    new_t = t[: m.start()] + f"{bpm_clamped} BPM" + t[m.end() :]
    return new_t, True


def simplify_tags_for_ace(tags: str, *, max_len: int | None = None) -> str:
    """
    Сжимает verbose LLM-описание: убирает литературные хвосты, лишние пробелы.
    Не трогает маркеры [section] и BPM, кроме как при обрезке по длине.
    """
    t = strip_backticks_from_ace_tags((tags or "").strip())
    if not t:
        return t
    limit = max_len if max_len is not None else MAX_TAGS_LENGTH
    for phrase in _TAG_LITERARY_PHRASES:
        t = re.sub(re.escape(phrase), "", t, flags=re.I)
    # Общие «отражающие тему» хвосты после запятой
    t = re.sub(r",\s*to reflect[^,\[\]]{0,120}(?=,|\[|$)", "", t, flags=re.I)
    t = re.sub(r",\s*mirroring[^,\[\]]{0,120}(?=,|\[|$)", "", t, flags=re.I)
    t = re.sub(r",\s*showcased through[^,\[\]]{0,120}(?=,|\[|$)", "", t, flags=re.I)
    t = re.sub(r"\s{2,}", " ", t)
    t = re.sub(r",\s*,+", ", ", t)
    t = re.sub(r"\s+,", ",", t)
    t = t.strip(" ,")
    if len(t) > limit:
        t = t[:limit].rstrip(" ,;")
    return t


# Паттерн: кусок тега заканчивается словом секции (LLM пишет «… intro» вместо «[intro] …»).
_ACE_PROSE_SECTION_TAIL = re.compile(
    r"^(?P<body>.+?)\s+(?P<sec>intro|verse|chorus|bridge|outro|pre-chorus|pre chorus|build up|buildup)\s*$",
    re.IGNORECASE | re.DOTALL,
)

# Минимальный скелет для Luna, если после конвертации всё ещё нет секций.
_LUNA_FALLBACK_SECTIONS = (
    "[intro] atmospheric pads with subtle strings, "
    "[verse] clean mix with soft synths and intimate vocals, "
    "[chorus] emotional lift with supersaw lead and vocal harmonies, "
    "[bridge] ethereal dreamy with piano focus, "
    "[outro] gradual fade with reverb tails"
)


def format_ace_tags_prose_to_sections(tags: str) -> str:
    """
    Превращает хвосты вида «… pads intro», «… synths verse» в «[intro] …», «[verse] …».
    Сегменты, которые уже начинаются с «[», не трогаем.
    """
    t = (tags or "").strip()
    if not t:
        return t
    parts = [p.strip() for p in re.split(r",\s*", t) if p.strip()]
    if len(parts) < 2:
        m = _ACE_PROSE_SECTION_TAIL.match(t)
        if m:
            sec = m.group("sec").lower().replace(" ", "-")
            if sec == "buildup":
                sec = "build-up"
            body = m.group("body").strip()
            return f"[{sec}] {body}"
        return t
    out: list[str] = []
    for p in parts:
        if p.startswith("["):
            out.append(p)
            continue
        m = _ACE_PROSE_SECTION_TAIL.match(p)
        if m:
            sec = m.group("sec").lower().replace(" ", "-")
            if sec == "buildup":
                sec = "build-up"
            body = m.group("body").strip()
            out.append(f"[{sec}] {body}")
        else:
            out.append(p)
    return ", ".join(out)


def _luna_section_marker_count(tags: str) -> int:
    low = tags.lower()
    keys = ("[intro]", "[verse]", "[chorus]", "[bridge]", "[outro]")
    return sum(1 for k in keys if k in low)


def ensure_luna_ace_section_tags(tags: str) -> str:
    """
    Для пресета luna: если нет ни одного маркера — дописывает полный скелет.
    Если маркеры уже есть (частично), не дублируем весь блок — только prose→sections выше.
    """
    t = (tags or "").strip()
    if not t:
        return t
    t2 = format_ace_tags_prose_to_sections(t)
    n = _luna_section_marker_count(t2)
    if n >= 3:
        return t2
    if n > 0:
        return t2
    prefix = t2.rstrip(" ,")
    if len(prefix) + len(_LUNA_FALLBACK_SECTIONS) + 4 > MAX_TAGS_LENGTH:
        return t2
    return prefix.rstrip(" ,") + ", " + _LUNA_FALLBACK_SECTIONS


def luna_append_signature_production(tags: str) -> str:
    """Типичные для Luna/ACE элементы, если модель их опустила."""
    t = (tags or "").strip().rstrip(" ,")
    if not t:
        return t
    low = t.lower()
    adds: list[str] = []
    if "supersaw" not in low:
        adds.append("supersaw lead in chorus")
    if "sidechain" not in low:
        adds.append("sidechain compression on kick")
    if "modern production" not in low and "human touch" not in low:
        adds.append("modern production with human touch")
    if not adds:
        return t
    extra = ", " + ", ".join(adds)
    if len(t) + len(extra) > MAX_TAGS_LENGTH:
        return t[: MAX_TAGS_LENGTH - 1].rstrip(" ,")
    return t + extra


def soften_luna_ace_tags(tags: str) -> str:
    """
    Пресет luna: заменить агрессивный EDM-[drop] на эмоциональный подъём в припеве; смягчить типовой build-up хвост из finalize.
    """
    t = tags or ""
    replacements: tuple[tuple[str, str], ...] = (
        (
            "[drop] with heavy bass and energy peak",
            "[chorus] energetic peak with supersaw lift",
        ),
        ("[drop] with heavy bass", "[chorus] energetic lift"),
        (
            "[build up] with riser and tension build",
            "[build up] soft riser into [chorus] lift",
        ),
    )
    low = t.lower()
    for old, new in replacements:
        if old.lower() in low:
            t = re.sub(re.escape(old), new, t, flags=re.I)
            low = t.lower()
    return t


# Типичный BPM по ключу пресета стиля (подсказка для ACE Step / поле tags).
ACE_STEP_TYPICAL_BPM_BY_STYLE: dict[str, int] = {
    "drum and bass": 174,
    "dubstep": 140,
    "electronic": 128,
    "house": 128,
    "techno": 130,
    "trance": 138,
    "pop": 120,
    "rock": 120,
    "ballad": 72,
    "hip_hop": 92,
    "lofi_chill": 82,
    "rnb_classic_female": 88,
    "classical": 80,
    "folk": 100,
    "luna": 118,
    "noir_cabaret": 76,
    "edm": 128,
    "hardstyle": 150,
    "chillout": 95,
    "jazz": 112,
    "chicago_blues": 104,
    "ambient_instrumental": 68,
    "post_rock_instrumental": 112,
    "cinematic_instrumental": 82,
    "bossa_instrumental": 126,
    "funk_instrumental": 104,
    "celtic_instrumental": 108,
    "metal": 152,
    "indie_rock": 115,
    "grunge": 92,
    "soul": 96,
    "latin_pop": 96,
    "disco": 118,
    "amapiano": 115,
    "bollywood_pop": 110,
    "mandopop": 118,
    "drill": 140,
    "reggae": 78,
    "baile_funk": 132,
    "punjabi_pop": 98,
    "neo_soul": 88,
    "gospel_soul": 100,
    "indie_folk_pop": 108,
    "boogie_funk": 112,
    "trap": 140,
    "punk_rock": 172,
    "shoegaze": 96,
    "darkwave": 122,
    "eurodance": 138,
    "uk_garage": 132,
    "flamenco_pop": 98,
    "city_pop": 112,
    "electro_swing": 120,
    "singer_songwriter": 95,
    "art_pop": 112,
    "dance_pop": 124,
    "tropical_house": 118,
    "future_bass": 150,
    "indie_electropop": 116,
    "french_chanson": 90,
    "power_ballad": 68,
    "progressive_rock": 112,
    "ska_punk": 160,
    "new_romantic": 120,
    "middle_eastern_pop": 100,
    "moombahton": 108,
    "trip_hop": 88,
    "vaporwave": 92,
    "glam_rock": 124,
}

# Клубные EDM-пресеты: в tags дописываются [build up] и [drop] (ACE Step 1.5), если их нет.
# «electronic» сюда НЕ входит: в UI это широкий dance/synth-pop/house — не обязан иметь фестивальный [drop]
# (в отличие от techno/house/trance/edm как явных клубных направлений в API).
# «luna» не входит: русский инди electro-pop — подъём в [chorus], не обязателен агрессивный [drop].
ELECTRONIC_STYLES_REQUIRING_DROP: frozenset[str] = frozenset(
    {
        "drum and bass",
        "dubstep",
        "techno",
        "house",
        "trance",
        "edm",
        "hardstyle",
        "eurodance",
        "electro_swing",
    }
)
# Дополнительный [breakdown] в хвосте — только для тяжёлых танцевальных пресетов (не раздувать tags у всех).
ACE_STEP_BREAKDOWN_EXTRA_HINTS: frozenset[str] = frozenset({"drum and bass", "dubstep"})

_DNB_DIRTY_MARKERS: tuple[str, ...] = (
    "aggressive",
    "dirty",
    "grime",
    "gritty",
    "distorted",
    "muddy",
    "dark atmosphere",
    "heavy synth riser",
    "punchy drums",
    "heavy breakbeat",
    "neuro",
)

_DNB_GENERIC_DROP_SNIPPET = "[drop] with heavy bass and energy peak"
_DNB_CLEAN_DROP_SNIPPET = (
    "[drop] classic liquid DnB drop, rolling reese sub-bass, amen break, crisp hats, clean polished club mix"
)
_DNB_CLEAN_BUILD_SNIPPET = "[build up] snare rolls, filter sweep, rising atmosphere"
_DNB_CLEAN_BREAKDOWN_SNIPPET = "[breakdown] sparse pads, ghost snares, warm sub tail"


def polish_drum_and_bass_ace_tags(tags: str) -> str:
    """
    Classic clean liquid DnB: amen break, rolling sub, crisp mix — без грязи/aggressive по умолчанию.
    """
    t = (tags or "").strip()
    if not t:
        return t
    low = t.lower()
    replacements = {
        _DNB_GENERIC_DROP_SNIPPET.lower(): _DNB_CLEAN_DROP_SNIPPET,
        "[drop] with heavy bass and energy peak": _DNB_CLEAN_DROP_SNIPPET,
        "[build up] with riser and tension build": _DNB_CLEAN_BUILD_SNIPPET,
        "[breakdown] atmospheric with sparse elements": _DNB_CLEAN_BREAKDOWN_SNIPPET,
    }
    for old, new in replacements.items():
        if old in low:
            t = re.sub(re.escape(old), new, t, count=1, flags=re.I)
            low = t.lower()
    for marker in _DNB_DIRTY_MARKERS:
        if marker in low:
            t = re.sub(re.escape(marker), "", t, flags=re.I)
            low = t.lower()
    t = re.sub(r"\s{2,}", " ", t)
    t = re.sub(r",\s*,+", ", ", t).strip(" ,")
    anchors = (
        "amen-style breakbeat",
        "rolling sub-bass",
        "crisp hi-hats",
        "clean polished club mix",
        "liquid drum and bass",
    )
    for anchor in anchors:
        if anchor not in low:
            t = f"{t.rstrip(' ,')}, {anchor}" if t else anchor
            low = t.lower()
    return t.strip(" ,")


# Краткие англ. формулировки жанра для замены ошибочного «drum and bass» в тегах.
_GENRE_FLAVOR_ENGLISH: dict[str, str] = {
    "pop": "modern pop",
    "rock": "alternative rock",
    "electronic": "modern electronic",
    "ballad": "intimate piano ballad",
    "hip_hop": "hip-hop",
    "classical": "orchestral cinematic",
    "folk": "acoustic folk",
    "lofi_chill": "lo-fi chill",
    "rnb_classic_female": "classic R&B soul",
    "noir_cabaret": "noir jazz cabaret",
    "luna": "Russian indie electro-pop",
    "reggaeton": "reggaeton Latin urban",
    "afrobeats": "Afrobeats",
    "phonk": "phonk",
    "hyperpop": "hyperpop",
    "bedroom_pop": "bedroom pop",
    "synthwave": "synthwave",
    "emo_rap": "emo rap",
    "country_pop": "country pop",
    "kpop": "K-pop",
    "edm": "EDM",
    "techno": "techno",
    "house": "house",
    "trance": "trance",
    "hardstyle": "hardstyle",
    "dubstep": "dubstep",
    "drum and bass": "drum and bass",
    "chillout": "downtempo chillout",
    "jazz": "modern jazz",
    "chicago_blues": "Chicago electric blues",
    "ambient_instrumental": "ambient instrumental",
    "post_rock_instrumental": "post-rock instrumental",
    "cinematic_instrumental": "cinematic orchestral instrumental",
    "bossa_instrumental": "bossa nova instrumental",
    "funk_instrumental": "funk instrumental",
    "celtic_instrumental": "Celtic folk instrumental",
    "metal": "heavy metal",
    "indie_rock": "indie rock",
    "grunge": "grunge alt-rock",
    "soul": "classic soul",
    "latin_pop": "Latin pop",
    "disco": "disco nu-disco",
    "amapiano": "South African amapiano",
    "bollywood_pop": "Bollywood Indian film pop",
    "mandopop": "Mandopop C-pop",
    "drill": "drill hip-hop",
    "reggae": "roots reggae one-drop",
    "baile_funk": "Brazilian baile funk",
    "punjabi_pop": "Punjabi bhangra pop",
    "neo_soul": "neo-soul warm soul",
    "gospel_soul": "gospel-tinged uplifting soul",
    "indie_folk_pop": "indie folk pop stomp-folk",
    "boogie_funk": "70s boogie funk",
    "trap": "modern trap",
    "punk_rock": "punk rock",
    "shoegaze": "shoegaze dream rock",
    "darkwave": "darkwave coldwave",
    "eurodance": "Eurodance",
    "uk_garage": "UK garage 2-step",
    "flamenco_pop": "flamenco pop Spanish fusion",
    "city_pop": "Japanese city pop",
    "electro_swing": "electro swing club EDM with vintage swing brass",
    "singer_songwriter": "intimate acoustic singer-songwriter",
    "art_pop": "art pop avant-pop experimental pop",
    "dance_pop": "radio dance pop four-on-the-floor hook",
    "tropical_house": "tropical house melodic house",
    "future_bass": "future bass melodic EDM supersaw drop",
    "indie_electropop": "indie electropop synth-driven",
    "french_chanson": "French chanson cabaret vocal storytelling",
    "power_ballad": "power ballad slow epic chorus",
    "progressive_rock": "progressive rock shifting meters",
    "ska_punk": "ska punk offbeat brass fast",
    "new_romantic": "80s new wave synth romantic",
    "middle_eastern_pop": "Middle Eastern pop maqam percussion",
    "moombahton": "moombahton dembow reggaeton hybrid",
    "trip_hop": "trip-hop downtempo dusty samples",
    "vaporwave": "vaporwave chillwave lo-fi nostalgia",
    "glam_rock": "glam rock arena rock big backing vocals",
}

# (label, keywords ru/en) — только подсказка для LLM и логов, не единственный источник правды.
_LYRICS_MOOD_LEXICON: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        "joyful_uplift",
        ("радост", "счаст", "весел", "сме", "ликова", "joy", "happy", "euphor", "celebr"),
    ),
    (
        "playful_wit",
        ("шут", "ирони", "смеш", "игр", "озор", "playful", "witty", "humor", "absurd"),
    ),
    (
        "desire_sensual",
        ("желан", "страст", "вождел", "соблаз", "флирт", "desire", "lust", "seduc", "passion"),
    ),
    (
        "intrigue_mystery",
        ("интриг", "тайн", "секрет", "загад", "шпион", "intrigue", "mystery", "secret", "noir"),
    ),
    (
        "triumphant_victory",
        ("побед", "триумф", "герой", "прорыв", "triumph", "victory", "win"),
    ),
    (
        "rebellious_freedom",
        ("бунт", "свобод", "дерз", "против", "rebel", "freedom", "defian"),
    ),
    (
        "melancholic",
        (
            "меланхол",
            "груст",
            "печаль",
            "тоск",
            "одинок",
            "пустот",
            "потер",
            "слез",
            "страдан",
            "sad",
            "melanchol",
            "loss",
            "alone",
            "grief",
        ),
    ),
    (
        "fantasy_whimsical",
        ("фея", "волшеб", "сказк", "гриб", "лес", "чудес", "звезд", "fairy", "magic", "enchant", "forest"),
    ),
    ("romantic", ("любов", "сердц", "нежн", "роман", "kiss", "love", "heart")),
    ("energetic_dance", ("танц", "клуб", "бас", "дроп", "энерг", "dance", "club", "drop")),
    ("calm_intimate", ("тишин", "ноч", "тих", "дожд", "туман", "quiet", "still", "soft")),
    ("angry_dark", ("злоб", "крик", "тьм", "rage", "dark", "hate")),
)

_CLUB_DROP_SNIPPETS_NON_EDM: tuple[str, ...] = (
    "[build up] with riser and tension build",
    "[drop] with heavy bass and energy peak",
)


def lyrics_mood_hints_for_style_prompt(lyrics: str) -> str:
    """
    Короткая строка для user-prompt generate-style: настроение по ключевым словам (RU/EN).
    Не заменяет жанр из UI — только подталкивает модель к согласованности.
    """
    raw = (lyrics or "").strip()
    if len(raw) < 8:
        return ""
    low = raw.lower()
    scores: list[tuple[str, int]] = []
    for label, words in _LYRICS_MOOD_LEXICON:
        n = sum(low.count(w) for w in words)
        if n:
            scores.append((label, n))
    scores.sort(key=lambda x: -x[1])
    top = [k for k, _ in scores[:3]]
    if not top:
        return ""
    return (
        "Heuristic mood/theme cues from lyrics (infer arrangement; do not quote lines): "
        + ", ".join(top)
        + ". Tags must match this mood AND the genre preset from the user."
    )


def ensure_intro_section_tag_if_lyrics_have_intro(tags: str, lyrics: str) -> str:
    """
    Если в lyrics есть intro-секция (legacy [Intro] или enriched [Intro: ...]),
    а в tags нет [intro] — вставить intro-блок перед первой [verse]/[chorus].
    """
    t = (tags or "").strip()
    lyr = lyrics or ""
    if not t or not lyr.strip():
        return t
    if not re.search(r"\[\s*intro(?:\s*:[^\]]*)?\]", lyr, re.I):
        return t
    if re.search(r"\[intro\]", t, re.I):
        return t
    m = re.search(r"(?i)\[(verse|chorus)(\s+\d+)?\]", t)
    if not m:
        return t
    return t[: m.start()] + "[intro] soft pads, atmospheric opening, " + t[m.start() :]


def coerce_tags_to_genre_preset(tags: str, genre: str) -> str:
    """
    Исправляет «протечки» drum & bass / 174 BPM и клубных хвостов, когда пресет UI — не DnB/не EDM.
    Для genre=drum and bass почти не трогает текст (кроме [intro] — вызывается отдельно).
    """
    t = (tags or "").strip()
    g = (genre or "pop").strip().lower() or "pop"
    if not t:
        return t
    flavor = _GENRE_FLAVOR_ENGLISH.get(g, "modern pop")
    tb = typical_bpm_for_music_style(g)
    tl = t.lower()

    if g not in ELECTRONIC_STYLES_REQUIRING_DROP:
        for snippet in _CLUB_DROP_SNIPPETS_NON_EDM:
            if snippet.lower() in tl:
                t = re.sub(re.escape(snippet), "", t, flags=re.I)
                tl = t.lower()
        t = re.sub(r"\s{2,}", " ", t).strip(" ,")

    # Явный drum and bass при другом пресете — переписать открытие и фразу жанра
    if g != "drum and bass" and ("drum and bass" in tl or "drum & bass" in tl):
        t2 = re.sub(
            r"\b\d{2,3}\s*BPM\s*,?\s*drum\s+and\s+bass\b",
            f"{tb} BPM {flavor}",
            t,
            count=1,
            flags=re.I,
        )
        if t2 == t:
            t2 = re.sub(
                r"\b\d{2,3}\s*BPM\s*,?\s*drum\s*&\s*bass\b",
                f"{tb} BPM {flavor}",
                t,
                count=1,
                flags=re.I,
            )
        t = t2
        tl = t.lower()
        if "drum and bass" in tl:
            t = re.sub(r"\bdrum\s+and\s+bass\b", flavor, t, count=1, flags=re.I)
            tl = t.lower()
        if "drum & bass" in tl:
            t = re.sub(r"\bdrum\s*&\s*bass\b", flavor, t, count=1, flags=re.I)

    # 174 BPM почти всегда DnB — если пресет не DnB, заменить на типичный для жанра
    if g != "drum and bass":
        mopen = re.match(r"^\s*174\s*BPM\b", t, re.I)
        if mopen:
            t = re.sub(r"^\s*174\s*BPM\b", f"{tb} BPM", t, count=1, flags=re.I)

    if len(t) > MAX_TAGS_LENGTH:
        t = t[:MAX_TAGS_LENGTH].rstrip(" ,;")
    return t


def _ace_workflow_is_v2_base(ace_workflow: str | None) -> bool:
    return (ace_workflow or "").strip().lower() == "v2_base"


def _ace_workflow_is_xl_base_or_sft(ace_workflow: str | None) -> bool:
    w = (ace_workflow or "").strip().lower()
    return w in ("v2_base", "v2_sft")


def typical_bpm_for_music_style(style_key: str) -> int:
    s = (style_key or "").strip().lower()
    return ACE_STEP_TYPICAL_BPM_BY_STYLE.get(s, 120)


def _tags_have_build_cue(tags_lower: str) -> bool:
    tl = tags_lower or ""
    if any(x in tl for x in ("[build up]", "[build-up]", "[buildup]")):
        return True
    if re.search(r"\bbuild[\s-]?up\b", tl):
        return True
    if re.search(r"\b(?:rising\s+snare|riser|crescendo)\b", tl) and re.search(r"\b(?:tension|build|pre-chorus)\b", tl):
        return True
    return bool(re.search(r"\[pre-chorus[^\]]*\][^[\[]*\b(?:build|riser|rising)\b", tl))


def _tags_have_drop_cue(tags_lower: str) -> bool:
    tl = tags_lower or ""
    if "[drop]" in tl:
        return True
    if re.search(
        r"\[(?:intro|verse|pre-chorus|chorus|bridge|outro)(?:\s+\d+)?[^\]]*\][^[\[]*\bdrop\b",
        tl,
    ):
        return True
    return bool(re.search(r"\bdrop\b[^,\[]*(?:bass|energy|heavy|breakbeat|peak)", tl))


def _tags_have_breakdown_cue(tags_lower: str) -> bool:
    tl = tags_lower or ""
    return "[breakdown]" in tl or bool(re.search(r"\bbreakdown\b", tl))


def _strip_trailing_orphan_edm_markers(tags: str) -> str:
    """
    Убрать глобальные [build up]/[drop]/[breakdown], дописанные ПОСЛЕ [outro], если они дублируют секции.
    """
    t = (tags or "").strip()
    if not t:
        return t
    low = t.lower()
    outro_idx = low.rfind("[outro]")
    if outro_idx < 0:
        return t
    prefix_low = low[:outro_idx]
    if not (_tags_have_build_cue(prefix_low) or _tags_have_drop_cue(prefix_low)):
        return t
    for _ in range(8):
        m = re.search(
            r",\s*\[(?:build[\s-]?up|drop|breakdown)\][^,\[]*$",
            t,
            re.I,
        )
        if not m or m.start() <= outro_idx:
            break
        t = t[: m.start()].rstrip(" ,")
        low = t.lower()
    return t


def finalize_ace_step_style_tags(
    tags: str,
    *,
    genre: str,
    ace_workflow: str | None = None,
) -> str:
    """
    Добавить типичный BPM; для электронных пресетов — недостающие [build up]/[drop] (и опционально [breakdown] для DnB/dubstep).
    Lyrics остаются только для вокала; arrangement — в tags (ACE Step 1.5).
    """
    t = (tags or "").strip()
    g = (genre or "").strip().lower()
    bpm = typical_bpm_for_music_style(g)
    if bpm and "bpm" not in t.lower():
        t = f"{bpm} BPM, " + t
    if g in ELECTRONIC_STYLES_REQUIRING_DROP:
        tl = t.lower()
        additions: list[str] = []
        has_build = _tags_have_build_cue(tl)
        has_drop = _tags_have_drop_cue(tl)
        has_breakdown = _tags_have_breakdown_cue(tl)
        if not has_build:
            additions.append("[build up] with riser and tension build")
        if not has_drop:
            additions.append("[drop] with heavy bass and energy peak")
        if g in ACE_STEP_BREAKDOWN_EXTRA_HINTS and not has_breakdown:
            additions.append("[breakdown] atmospheric with sparse elements")
        if additions:
            t = t.rstrip(" ,;") + ", " + ", ".join(additions)
    if g == "drum and bass":
        t = polish_drum_and_bass_ace_tags(t)
    if _ace_workflow_is_xl_base_or_sft(ace_workflow):
        t = _strip_trailing_orphan_edm_markers(t)
    if len(t) > MAX_TAGS_LENGTH:
        t = t[:MAX_TAGS_LENGTH]
    return t


def normalize_vocal_token_in_tags(tags: str, vocal: str) -> str:
    """
    Оставляет в tags один согласованный маркер male/female/duet vocal.
    Убирает противоречивые «female vocal» / «male vocal» от модели при выборе другого голоса.
    """
    v = (vocal or "female").strip().lower()
    if v not in ("male", "female", "duet"):
        v = "female"
    t = (tags or "").strip()
    if not t:
        return t
    tl = t.lower()
    # Инструментальные брифы: не вставляем lead vocal, только чистим противоречивые маркеры.
    if "no lead vocal" in tl or "no sung lyrics" in tl or "strictly no lead vocal" in tl:
        patterns = (
            r"\bfemale\s+lead\s+vocal\b",
            r"\bmale\s+lead\s+vocal\b",
            r"\bduet\s+lead\s+vocals\b",
            r"\bduet\s*\(male\s+and\s+female\)\s+vocal\b",
            r"\bduet\s+vocal\b",
            r"\b(emotional\s+)?female\s+vocal\s+with\s+emotional\s+delivery\b",
            r"\b(emotional\s+)?male\s+vocal\s+with\s+emotional\s+delivery\b",
            r"\b(emotional\s+)?female\s+vocal\b",
            r"\b(emotional\s+)?male\s+vocal\b",
            r"\bdominant\s+female\s+vocal\b",
            r"\bdominant\s+male\s+vocal\b",
        )
        for pat in patterns:
            t = re.sub(pat, "", t, flags=re.I)
        t = re.sub(r",\s*,", ",", t)
        t = re.sub(r"\s{2,}", " ", t).strip(" ,")
        return t
    patterns = (
        r"\bfemale\s+lead\s+vocal\b",
        r"\bmale\s+lead\s+vocal\b",
        r"\bduet\s+lead\s+vocals\b",
        r"\bduet\s*\(male\s+and\s+female\)\s+vocal\b",
        r"\bduet\s+vocal\b",
        r"\b(emotional\s+)?female\s+vocal\s+with\s+emotional\s+delivery\b",
        r"\b(emotional\s+)?male\s+vocal\s+with\s+emotional\s+delivery\b",
        r"\b(emotional\s+)?female\s+vocal\b",
        r"\b(emotional\s+)?male\s+vocal\b",
        r"\bdominant\s+female\s+vocal\b",
        r"\bdominant\s+male\s+vocal\b",
    )
    for pat in patterns:
        t = re.sub(pat, "", t, flags=re.I)
    t = re.sub(r",\s*,", ",", t)
    t = re.sub(r"\s{2,}", " ", t).strip(" ,")
    insert = f"{v} vocal"
    if insert.lower() not in t.lower():
        m = re.search(r"^\s*\d{2,3}\s*BPM\b", t, re.I)
        if m:
            head = m.group(0).strip()
            tail = t[m.end() :].lstrip()
            if tail.startswith(","):
                t = f"{head}, {insert}{tail}"
            else:
                t = f"{head}, {insert}, {tail}" if tail else f"{head}, {insert}"
        else:
            t = f"{insert}, {t}" if t else insert
    return t


def default_ace_tags_for_comfy(style_key: str, bpm_hint: int | None, *, vocal: str = "female") -> str:
    """Короткий fallback для ACE, если входные tags безнадёжно битые."""
    b = bpm_hint if bpm_hint is not None else typical_bpm_for_music_style(style_key)
    sk = (style_key or "pop").strip().lower() or "pop"
    vv = vocal if vocal in ("male", "female", "duet") else "female"
    if sk == "luna":
        return (
            f"{b} BPM Russian indie electro-pop, {vv} vocal, "
            "[intro] atmospheric pads, [verse] clean mix with synth bass, "
            "[chorus] supersaw stack with harmonies, [bridge] piano melody, [outro] fade with reverb, "
            "sidechain compression, modern production"
        )
    if sk == "drum and bass":
        return (
            f"{b} BPM liquid drum and bass, {vv} vocal, "
            "amen-style breakbeat, rolling sub-bass, crisp hi-hats, clean polished club mix, "
            "[intro] airy pads and filter sweep, "
            "[verse] tight breakbeat groove with warm sub, "
            "[build up] snare rolls and rising atmosphere, "
            "[drop] classic liquid DnB drop with rolling reese bass and punchy clean drums, "
            "[breakdown] sparse pads and ghost snares, "
            "[outro] fade with reverb tail"
        )
    return (
        f"{b} BPM {sk.replace('_', ' ')}, {vv} vocal, "
        "[intro] atmospheric, [verse] main section, [chorus] full mix, [outro] fade"
    )


def _score_ace_tag_segment(seg: str) -> int:
    low = seg.lower()
    score = 0
    if re.search(r"\d+\s*bpm", low):
        score += 4
    for m in ("[intro]", "[verse]", "[chorus]", "[bridge]", "[outro]", "[pre-chorus]"):
        if m in low:
            score += 2
    if _tags_have_build_cue(low):
        score += 3
    if _tags_have_drop_cue(low):
        score += 3
    if low.count("style:") > 1:
        score -= 4
    if 80 <= len(seg) <= 1600:
        score += 1
    return score


def _score_tag_clause(clause: str) -> int:
    low = (clause or "").lower()
    score = 0
    if re.search(r"\d{2,3}\s*bpm", low):
        score += 10
    if re.search(r"\b(?:male|female|duet)\s+vocal\b", low):
        score += 8
    if "style:" in low:
        score += 6
    for m in ("[intro]", "[verse]", "[chorus]", "[pre-chorus]", "[bridge]", "[outro]"):
        if m in low:
            score += 5
    if _tags_have_build_cue(low):
        score += 7
    if _tags_have_drop_cue(low):
        score += 7
    if _tags_have_breakdown_cue(low):
        score += 4
    if any(p in low for p in ("emotional depth", "mirroring", "journey of self")):
        score -= 3
    score += min(3, len(clause) // 80)
    return score


def _split_ace_tags_clauses(tags: str) -> list[str]:
    """Разбить tags по запятым верхнего уровня (не внутри [...])."""
    t = (tags or "").strip()
    if not t:
        return []
    clauses: list[str] = []
    buf: list[str] = []
    depth = 0
    for ch in t:
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth = max(0, depth - 1)
        if ch == "," and depth == 0:
            part = "".join(buf).strip()
            if part:
                clauses.append(part)
            buf = []
        else:
            buf.append(ch)
    tail = "".join(buf).strip()
    if tail:
        clauses.append(tail)
    return clauses


def _is_protected_tag_clause(clause: str, *, index: int) -> bool:
    low = (clause or "").lower()
    if index == 0 and (re.search(r"\d{2,3}\s*bpm", low) or "style:" in low):
        return True
    if re.search(r"\d{2,3}\s*bpm", low):
        return True
    if re.search(r"\b(?:male|female|duet)\s+vocal\b", low):
        return True
    if _tags_have_build_cue(low) or _tags_have_drop_cue(low):
        return True
    return bool(re.search(r"\[(?:build[\s-]?up|drop|breakdown)\]", low, re.I))


def compress_ace_tags_by_score(tags: str, *, limit: int = XL_BASE_TAGS_MAX_LEN) -> str:
    """
    Score-based сжатие XL Base tags: сохраняет BPM, vocal, build/drop и секции с высоким score.
    """
    t = (tags or "").strip()
    if len(t) <= limit:
        return t
    clauses = _split_ace_tags_clauses(t)
    if len(clauses) <= 1:
        return t[:limit].rstrip(" ,;")

    keep_set = {i for i, c in enumerate(clauses) if _is_protected_tag_clause(c, index=i)}
    optional = [(i, c, _score_tag_clause(c)) for i, c in enumerate(clauses) if i not in keep_set]
    optional.sort(key=lambda x: x[2])

    while True:
        result = ", ".join(c for i, c in enumerate(clauses) if i in keep_set)
        if len(result) <= limit or not optional:
            break
        drop_i, _drop_c, _drop_sc = optional.pop(0)
        keep_set.discard(drop_i)

    result = ", ".join(c for i, c in enumerate(clauses) if i in keep_set)
    if len(result) > limit:
        result = result[:limit].rstrip(" ,;")
    return result


def dedupe_style_prefix_vs_inline_genre(tags: str, *, style_key: str = "") -> str:
    """
    Убрать дубль жанра: «Style: Pop. 120 BPM pop, …» → без повторного pop после BPM.
    """
    t = (tags or "").strip()
    if not t or "style:" not in t.lower():
        return t

    style_part = ""
    rest = t
    m = re.match(r"^\s*Style\s*:\s*([^.]+)\.\s*(.+)$", t, re.I | re.S)
    if m:
        style_part = m.group(1).strip()
        rest = m.group(2).strip()
    else:
        m2 = re.match(r"^\s*Style\s*:\s*([^,\[]+),\s*(.+)$", t, re.I | re.S)
        if m2:
            style_part = m2.group(1).strip()
            rest = m2.group(2).strip()
        else:
            return t

    genres: set[str] = set()
    sk = (style_key or "").strip().lower().replace("_", " ")
    if sk:
        genres.add(sk)
    style_norm = style_part.lower().replace("_", " ")
    if style_norm:
        genres.add(style_norm)
        for w in re.findall(r"[a-z]{4,}", style_norm):
            if w not in ("with", "style", "feel"):
                genres.add(w)

    bpm_m = re.match(r"^(\d{2,3}\s*BPM\s*,?\s*)", rest, re.I)
    head = bpm_m.group(1) if bpm_m else ""
    tail = rest[bpm_m.end() :] if bpm_m else rest

    for g in sorted(genres, key=len, reverse=True):
        if not g or len(g) < 3:
            continue
        tail = re.sub(rf"^\s*{re.escape(g)}\s*,?\s*", "", tail, count=1, flags=re.I)
        tail = re.sub(rf",\s*{re.escape(g)}\s*,", ", ", tail, count=1, flags=re.I)

    prefix = f"Style: {style_part}."
    merged = f"{prefix} {head}{tail}".strip() if head or tail else prefix
    merged = re.sub(r"\s{2,}", " ", merged)
    merged = re.sub(r",\s*,+", ", ", merged)
    return merged.strip(" ,")


def _dedupe_bpm_token(t: str) -> str:
    m = re.search(r"(\d{2,3}\s*BPM)", t, re.I)
    if not m:
        return t
    token = m.group(1)
    tail = t[m.end() :]
    tail2 = re.sub(re.escape(token) + r"\s*,?\s*", "", tail, count=1, flags=re.I)
    return t[: m.end()] + tail2


def _flatten_nested_ace_section_markers(tags: str) -> str:
    """«[pre-chorus] [build up] …» → «[pre-chorus] build up, …» (без двойных [] подряд)."""
    t = tags or ""
    pairs = (
        ("pre-chorus", r"build[\s-]?up|buildup"),
        ("bridge", r"breakdown"),
        ("chorus", r"drop"),
    )
    for section, nested in pairs:
        t = re.sub(
            rf"(\[{section}\])\s*\[(?:{nested})\]\s*",
            r"\1 ",
            t,
            flags=re.I,
        )
    return t


def _merge_consecutive_duplicate_section_markers(tags: str) -> str:
    """«[intro] a, [intro] b» → «[intro] a, b» (один блок на повторяющуюся метку подряд)."""
    t = tags
    for _ in range(48):
        prev = t
        t = re.sub(
            r"(\[[^\]]+\])([^,\[]*),\s*\1\s*([^,\[]*)",
            r"\1\2, \3",
            t,
            flags=re.I,
        )
        if t == prev:
            break
    return t


def _lowercase_ace_bracket_markers(tags: str) -> str:
    """Маркеры секций ACE — в нижнем регистре: [Chorus 2] → [chorus 2]."""

    def repl(m: re.Match[str]) -> str:
        return f"[{m.group(1).strip().lower()}]"

    return re.sub(r"\[([^\]]+)\]", repl, tags)


def _trim_to_first_n_bracket_sections(tags: str, n: int = 8) -> str:
    """Оставляет текст до начала (n+1)-го маркера [...] (счёт всех квадратных меток)."""
    markers = list(re.finditer(r"\[[^\]]+\]", tags))
    if len(markers) <= n:
        return tags
    return tags[: markers[n].start()].rstrip(" ,;")


def final_clean_ace_tags_for_comfy(
    tags: str,
    *,
    max_len: int | None = None,
    ace_workflow: str | None = None,
    style_key: str = "",
) -> str:
    """
    Последний проход перед Comfy: хвосты «литературы», (occurrence), склейка дублей [intro],
    lowercase меток, усечение по числу секций и по длине.
    """
    if max_len is not None:
        limit = max_len
    elif _ace_workflow_is_xl_base_or_sft(ace_workflow):
        limit = 1600
    else:
        limit = MAX_TAGS_LENGTH
    t = (tags or "").strip()
    if not t:
        return t
    t = re.sub(r"\(\s*occurrence\s+\d+\s*\)", "", t, flags=re.I)
    t = re.sub(r"\([^)]*occurrence[^)]*\)", "", t, flags=re.I)
    for phrase in _TAG_LITERARY_PHRASES:
        t = re.sub(re.escape(phrase), "", t, flags=re.I)
    t = re.sub(r",\s*to reflect[^,\[\]]{0,120}(?=,|\[|$)", "", t, flags=re.I)
    t = re.sub(r",\s*mirroring[^,\[\]]{0,120}(?=,|\[|$)", "", t, flags=re.I)
    t = re.sub(r",\s*showcased through[^,\[\]]{0,120}(?=,|\[|$)", "", t, flags=re.I)
    t = _lowercase_ace_bracket_markers(t)
    t = _flatten_nested_ace_section_markers(t)
    t = _merge_consecutive_duplicate_section_markers(t)
    if _ace_workflow_is_v2_base(ace_workflow):
        section_cap = XL_BASE_TAGS_SECTION_CAP
    elif _ace_workflow_is_xl_base_or_sft(ace_workflow):
        section_cap = 12
    else:
        section_cap = 8
    t = _trim_to_first_n_bracket_sections(t, section_cap)
    if _ace_workflow_is_xl_base_or_sft(ace_workflow):
        t = _strip_trailing_orphan_edm_markers(t)
    if _ace_workflow_is_v2_base(ace_workflow):
        t = dedupe_style_prefix_vs_inline_genre(t, style_key=style_key)
    t = re.sub(r"\s{2,}", " ", t)
    t = re.sub(r",\s*,+", ", ", t)
    t = t.strip(" ,")
    if _ace_workflow_is_v2_base(ace_workflow) and len(t) > limit:
        t = compress_ace_tags_by_score(t, limit=limit)
    elif len(t) > limit:
        t = t[:limit].rstrip(" ,;")
    return t


def clean_and_merge_ace_tags_for_comfy(
    tags: str,
    *,
    style_key: str = "pop",
    bpm_hint: int | None = None,
    ace_workflow: str | None = None,
) -> str:
    """
    Перед Comfy: убрать склейки «..», несколько «Style:», дубли BPM.
    Повторные секции [verse 2], [chorus 2] не схлопываются в безномерные — нужен ACE.
    Роутер уже добавляет один «Style: …»; второй префикс в build_ace_music_workflow убран.
    """
    t = (tags or "").strip()
    if not t:
        return default_ace_tags_for_comfy(style_key, bpm_hint)

    if ".." in t:
        parts = [p.strip() for p in t.split("..") if p.strip()]
        if parts:
            t = max(parts, key=_score_ace_tag_segment)

    if t.lower().count("style:") > 1:
        chunks = re.split(r"(?i)\bstyle\s*:\s*", t)
        chunks = [c.strip(" ,.;") for c in chunks if c.strip()]
        if len(chunks) > 1:
            t = max(chunks, key=_score_ace_tag_segment)

    if not _ace_workflow_is_xl_base_or_sft(ace_workflow):
        m = re.search(
            r"(\d{2,3}\s*BPM.+?(?:\[intro\]|\[verse\]|\[chorus\]).+)",
            t,
            re.I | re.DOTALL,
        )
        if m and len(m.group(1)) >= 40:
            t = m.group(1).strip()

    t = _dedupe_bpm_token(t)
    t = re.sub(r"\s{2,}", " ", t)
    t = re.sub(r",\s*,+", ", ", t).strip(" ,.;")
    if _ace_workflow_is_v2_base(ace_workflow):
        t = dedupe_style_prefix_vs_inline_genre(t, style_key=style_key)

    if len(t) < 25:
        return default_ace_tags_for_comfy(style_key, bpm_hint)
    if len(t) > MAX_TAGS_LENGTH:
        t = t[:MAX_TAGS_LENGTH].rstrip(" ,;")
    return t


# Алиасы для совместимости с music_generator.py
_finalize_ace_step_style_tags = finalize_ace_step_style_tags
_typical_bpm_for_music_style = typical_bpm_for_music_style
