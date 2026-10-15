# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Resolve emotional mood for Music Generator lyrics across Turbo / XL Base / V3 / companion.
# Avoids LLM defaulting to sad heartbreak when the user did not ask for grief.
# Invariants:
# - Explicit mood in theme or request wins over random pick.
# - Random mood uses stable seed when provided (same run → same mood).
# Related:
# - api/routers/music_generator.py, api/services/music_generator_v3/prompts.py
# ---
"""Song mood palette and randomization for lyrics generation."""

from __future__ import annotations

import hashlib
import random
import re
from dataclasses import dataclass
from typing import Literal

SongMoodSource = Literal["explicit_theme", "explicit_request", "random"]


@dataclass(frozen=True, slots=True)
class SongMoodVariant:
    mood_id: str
    label_ru: str
    label_en: str
    directive_ru: str
    directive_en: str
    detect_words: tuple[str, ...]
    weight: int = 3


@dataclass(frozen=True, slots=True)
class SongMoodPick:
    mood_id: str
    label_ru: str
    label_en: str
    source: SongMoodSource
    directive_ru: str
    directive_en: str


_SONG_MOOD_VARIANTS: tuple[SongMoodVariant, ...] = (
    SongMoodVariant(
        "joyful",
        "радость и подъём",
        "joyful uplift",
        "Настроение песни — радость, лёгкость, азарт, смех, победное тепло. Не трагедия и не тоска; "
        "герой живёт, движется, празднует, смеётся или заново находит силу.",
        "Mood is joyful uplift: laughter, warmth, momentum, celebration, or renewed strength — not grief.",
        ("радост", "счаст", "весел", "сме", "ликова", "joy", "happy", "euphor", "celebr"),
    ),
    SongMoodVariant(
        "playful",
        "игра и ирония",
        "playful wit",
        "Настроение — игра, подмигивание, ирония, озорство или абсурдный юмор. Можно сатира и бытовой комизм; "
        "не обязательно «смешно в каждой строке», но тон живой, не страдальческий.",
        "Mood is playful wit: irony, teasing, absurd humor or satire — lively, not mournful.",
        ("шут", "ирони", "смеш", "игр", "озор", "playful", "witty", "humor", "absurd"),
    ),
    SongMoodVariant(
        "desire",
        "вожделение и притяжение",
        "desire and sensual pull",
        "Настроение — вожделение, притяжение, телесное напряжение, флирт, страсть или соблазн. "
        "Конкретные жесты и близость; не абстрактная «боль любви».",
        "Mood is desire: attraction, flirtation, sensual tension, temptation — embodied, not abstract heartache.",
        ("желан", "страст", "вождел", "соблаз", "флирт", "desire", "lust", "seduc", "passion"),
    ),
    SongMoodVariant(
        "intrigue",
        "интрига и тайна",
        "intrigue and mystery",
        "Настроение — интрига, тайна, недосказанность, шпионский или ночной нерв, скрытый мотив. "
        "Вопросы важнее исповеди; финал может открыть секрет или оставить загадку.",
        "Mood is intrigue: secrets, hidden motives, mystery, suspense — questions over confession.",
        ("интриг", "тайн", "секрет", "загад", "шпион", "intrigue", "mystery", "secret", "noir"),
    ),
    SongMoodVariant(
        "triumphant",
        "триумф и победа",
        "triumphant victory",
        "Настроение — победа, прорыв, гордость, выход из боя, доказательство силы. "
        "Кульминация — не слёзы, а взлёт, решимость, «я дошёл».",
        "Mood is triumph: breakthrough, pride, victory, earned power — climax is ascent, not tears.",
        ("побед", "триумф", "герой", "сил", "прорыв", "triumph", "victory", "win", "power"),
    ),
    SongMoodVariant(
        "rebellious",
        "бунт и свобода",
        "rebellious freedom",
        "Настроение — бунт, свобода, несогласие, дерзость, «я не такой как все». "
        "Может быть злость, но направленная в действие, не в бесконечную жалобу.",
        "Mood is rebellion: freedom, defiance, refusal to obey — anger as action, not endless complaint.",
        ("бунт", "свобод", "дерз", "против", "rebel", "freedom", "defian", "rage"),
    ),
    SongMoodVariant(
        "romantic_tender",
        "нежная романтика",
        "tender romance",
        "Настроение — нежная романтика, тепло, забота, близость без обязательной трагедии. "
        "Может быть грусть расставания, но не default «всё потеряно навсегда» без темы.",
        "Mood is tender romance: warmth, care, closeness — bittersweet only if the theme requires it.",
        ("роман", "нежн", "любов", "ласк", "romantic", "tender", "love"),
        weight=2,
    ),
    SongMoodVariant(
        "nostalgic_warm",
        "тёплая ностальгия",
        "warm nostalgia",
        "Настроение — тёплая ностальгия, память, «как было», без депрессивного финала. "
        "Светлая грусть допустима, но не страдание ради страдания.",
        "Mood is warm nostalgia: memory and gentle longing — soft, not depressive.",
        ("носталь", "памят", "было", "детств", "nostalg", "memory", "remember"),
        weight=2,
    ),
    SongMoodVariant(
        "calm_peaceful",
        "спокойствие и ясность",
        "calm clarity",
        "Настроение — спокойствие, ясность, тишина, принятие, медленное дыхание. "
        "Не драма и не слёзы; образы простые и устойчивые.",
        "Mood is calm clarity: peace, stillness, acceptance — simple steady images.",
        ("спокой", "тишин", "ясн", "медит", "calm", "peace", "still", "quiet"),
    ),
    SongMoodVariant(
        "epic_cinematic",
        "эпик и масштаб",
        "epic cinematic scale",
        "Настроение — эпический масштаб, путь, судьба, шторм, полёт, большие решения. "
        "Не обязательно грустный финал — может быть открытый горизонт.",
        "Mood is epic scale: journey, fate, storm, horizon — not mandatory sadness.",
        ("эпик", "судьб", "шторм", "путь", "epic", "cinematic", "destiny", "journey"),
    ),
    SongMoodVariant(
        "social_satire",
        "сатира и нерв города",
        "social satire",
        "Настроение — бытовая или социальная сатира, городской нерв, наблюдение, колкость. "
        "Герой комментирует мир, а не страдает в вакууме.",
        "Mood is social satire: urban nerve, observation, sharp commentary — not vacuum grief.",
        ("сатир", "город", "офис", "быт", "satire", "urban", "irony"),
    ),
    SongMoodVariant(
        "melancholic",
        "меланхолия и грусть",
        "melancholic sadness",
        "Настроение — меланхолия, грусть, потеря или одиночество. Используй только если это задано темой или настроением; "
        "не превращай каждый куплет в бесконечную жалобу.",
        "Mood is melancholic sadness: loss or loneliness — only when requested; avoid endless whining.",
        ("меланхол", "груст", "печаль", "тоск", "страдан", "одинок", "слез", "sad", "melanchol", "grief", "loss"),
        weight=1,
    ),
    SongMoodVariant(
        "dark_intense",
        "тьма и напряжение",
        "dark intensity",
        "Настроение — тёмное напряжение, угроза, холод, парanoia или жёсткий конфликт. "
        "Не pop-ballad sadness — скорее thriller или noir.",
        "Mood is dark intensity: threat, cold, conflict — thriller/noir, not pop heartbreak.",
        ("тьм", "мрак", "угроз", "холод", "dark", "noir", "threat", "fear"),
        weight=2,
    ),
)

_MOOD_BY_ID: dict[str, SongMoodVariant] = {v.mood_id: v for v in _SONG_MOOD_VARIANTS}

_LYRICS_ANTI_DEFAULT_SADNESS_RU = (
    "\n\nНАСТРОЕНИЕ ПЕСНИ (обязательно):\n"
    "— Не выбирай по умолчанию страдание, разрыв, слёзы и «боль в душе», если тема или директива настроения этого не требуют.\n"
    "— Радость, ирония, вожделение, интрига, победа, бунт, сатира и тёплая память — такие же допустимые опоры, как грусть.\n"
    "— Если задано настроение ниже — держись его в каждом куплете и припеве; не подменяй на меланхолию «по привычке модели»."
)

_LYRICS_ANTI_DEFAULT_SADNESS_EN = (
    "\n\nSONG MOOD (required):\n"
    "— Do not default to heartbreak, tears and suffering unless the theme or mood directive requires it.\n"
    "— Joy, wit, desire, intrigue, victory, rebellion, satire and warm memory are equally valid.\n"
    "— When a mood is assigned below, keep every verse and chorus aligned with it; do not drift into generic sadness."
)


def _normalize_explicit_mood(raw: str | None) -> str | None:
    if not raw or not str(raw).strip():
        return None
    key = re.sub(r"[\s\-]+", "_", str(raw).strip().lower())
    aliases = {
        "joy": "joyful",
        "happy": "joyful",
        "fun": "playful",
        "humor": "playful",
        "lust": "desire",
        "passion": "desire",
        "mystery": "intrigue",
        "secret": "intrigue",
        "victory": "triumphant",
        "win": "triumphant",
        "rebel": "rebellious",
        "love": "romantic_tender",
        "romantic": "romantic_tender",
        "nostalgia": "nostalgic_warm",
        "calm": "calm_peaceful",
        "peace": "calm_peaceful",
        "epic": "epic_cinematic",
        "satire": "social_satire",
        "sad": "melancholic",
        "grief": "melancholic",
        "melancholy": "melancholic",
        "dark": "dark_intense",
        "warm": "nostalgic_warm",
    }
    key = aliases.get(key, key)
    return key if key in _MOOD_BY_ID else None


_NEGATED_SADNESS_RE = re.compile(
    r"(?:"
    r"не\s+(?:про\s+)?[«\"']?груст"
    r"|не\s+груст"
    r"|без\s+груст"
    r"|не\s+(?:про\s+)?(?:тоск|печал|меланхол)"
    r"|not\s+(?:about\s+)?(?:sad|grief|melanchol)"
    r")",
    flags=re.IGNORECASE,
)

_UPLIFT_WHEN_NOT_SAD: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("triumphant", ("выживан", "перемен", "будущ", "побед", "сила", "rise", "triumph")),
    ("joyful", ("вайб", "радост", "золот", "солн", "улыб", "joy", "fun", "warm")),
    ("rebellious", ("бунт", "ночн", "шум", "rebel")),
    ("epic_cinematic", ("масштаб", "горизонт", "океан", "километр", "epic", "journey")),
    ("social_satire", ("ирон", "сатира", "офис", "быт", "satire")),
    ("playful", ("озор", "шут", "легк", "playful")),
)


def source_text_negates_sadness(text: str) -> bool:
    """True when the source explicitly rejects grief/melancholy as the song's core."""
    low = (text or "").strip().lower()
    if not low:
        return False
    return bool(_NEGATED_SADNESS_RE.search(low))


def detect_mood_from_text(text: str) -> str | None:
    """Return mood_id from theme and/or companion source when emotional tone is explicit."""
    low = (text or "").strip().lower()
    if len(low) < 4:
        return None
    negates_sadness = source_text_negates_sadness(low)
    if negates_sadness:
        for mood_id, words in _UPLIFT_WHEN_NOT_SAD:
            if any(w in low for w in words):
                return mood_id
        return "joyful"
    best_id: str | None = None
    best_score = 0
    skip_moods = frozenset({"melancholic", "dark_intense"}) if negates_sadness else frozenset()
    for variant in _SONG_MOOD_VARIANTS:
        if variant.mood_id in skip_moods:
            continue
        score = sum(low.count(w) for w in variant.detect_words)
        if score > best_score:
            best_score = score
            best_id = variant.mood_id
    return best_id if best_score > 0 else None


def detect_mood_from_theme(theme: str) -> str | None:
    """Return mood_id if theme explicitly names an emotional tone."""
    return detect_mood_from_text(theme)


def _seed_int(seed: str | None) -> int:
    if not seed:
        return random.SystemRandom().randint(0, 2**31 - 1)
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    return int(digest[:16], 16)


_RANDOM_MOOD_BLOCKLIST: frozenset[str] = frozenset({"melancholic", "dark_intense"})


def _weighted_random_mood_id(rng: random.Random, *, allowed: set[str] | None = None) -> str:
    pool: list[str] = []
    for variant in _SONG_MOOD_VARIANTS:
        if allowed is not None and variant.mood_id not in allowed:
            continue
        pool.extend([variant.mood_id] * max(1, variant.weight))
    # Fallback: if filtering left the pool empty, use joyful
    if not pool:
        return "joyful"
    return rng.choice(pool)


def resolve_song_mood(
    *,
    theme: str,
    explicit_mood: str | None = None,
    randomize: bool = True,
    seed: str | None = None,
    companion_context: str | None = None,
) -> SongMoodPick:
    """Pick mood: explicit request > theme/companion keywords > weighted random."""
    requested = _normalize_explicit_mood(explicit_mood)
    if requested:
        variant = _MOOD_BY_ID[requested]
        return SongMoodPick(
            mood_id=variant.mood_id,
            label_ru=variant.label_ru,
            label_en=variant.label_en,
            source="explicit_request",
            directive_ru=variant.directive_ru,
            directive_en=variant.directive_en,
        )
    mood_probe = theme.strip()
    ctx = (companion_context or "").strip()
    if ctx:
        mood_probe = f"{mood_probe}\n{ctx[:8000]}"
    from_theme = detect_mood_from_text(mood_probe)
    if from_theme:
        variant = _MOOD_BY_ID[from_theme]
        return SongMoodPick(
            mood_id=variant.mood_id,
            label_ru=variant.label_ru,
            label_en=variant.label_en,
            source="explicit_theme",
            directive_ru=variant.directive_ru,
            directive_en=variant.directive_en,
        )
    if not randomize:
        variant = _MOOD_BY_ID["joyful"]
        return SongMoodPick(
            mood_id=variant.mood_id,
            label_ru=variant.label_ru,
            label_en=variant.label_en,
            source="random",
            directive_ru=variant.directive_ru,
            directive_en=variant.directive_en,
        )
    rng = random.Random(_seed_int(seed))
    allowed_moods = {v.mood_id for v in _SONG_MOOD_VARIANTS if v.mood_id not in _RANDOM_MOOD_BLOCKLIST}
    mood_id = _weighted_random_mood_id(rng, allowed=allowed_moods)
    variant = _MOOD_BY_ID[mood_id]
    return SongMoodPick(
        mood_id=variant.mood_id,
        label_ru=variant.label_ru,
        label_en=variant.label_en,
        source="random",
        directive_ru=variant.directive_ru,
        directive_en=variant.directive_en,
    )


def song_mood_prompt_blocks(
    pick: SongMoodPick,
    *,
    language: str = "ru",
) -> tuple[str, str]:
    """Return (system_append, user_append) for lyrics LLM messages."""
    lang = (language or "ru").strip().lower()
    if lang.startswith("en"):
        system = _LYRICS_ANTI_DEFAULT_SADNESS_EN
        user_line = (
            f"Assigned song mood for this generation: {pick.label_en} ({pick.mood_id}). "
            f"{pick.directive_en} Keep lyrics aligned with this mood unless the theme explicitly contradicts it."
        )
        return system, user_line
    system = _LYRICS_ANTI_DEFAULT_SADNESS_RU
    source_note = {
        "random": "случайно выбрано студией для разнообразия",
        "explicit_theme": "следует из темы",
        "explicit_request": "задано пользователем",
    }[pick.source]
    user_line = (
        f"Настроение этой песни ({source_note}): «{pick.label_ru}». "
        f"{pick.directive_ru} Держи текст в этом настроении, если тема прямо не противоречит."
    )
    return system, user_line


def song_mood_public_dict(pick: SongMoodPick) -> dict[str, str]:
    return {
        "id": pick.mood_id,
        "label_ru": pick.label_ru,
        "label_en": pick.label_en,
        "source": pick.source,
    }
