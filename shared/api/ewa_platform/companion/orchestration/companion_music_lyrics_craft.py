# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Companion music lyrics: singable Russian craft, validation, and ACE Turbo vocal prep (no production lines in Comfy).
# Invariants:
# - ``prepare_companion_vocal_lyrics_for_comfy`` strips (Arrangement:)/(Voice:) — production lives in tags only.
# - Validation gates retry in ``/lyrics`` when ``ewa_companion_context`` is present.
# Related:
# - api/routers/music_generator.py
# - api/services/studio_comfy_workflows.py
# - documentation/product/ewa/EWA-COMPANION-MUSIC-GENERATION.md
# ---

from __future__ import annotations

import re
from typing import Any

from api.routers.music_lyrics_validation import (
    _SECTION_HEADER_RE,
    normalize_lyrics_sections_for_ace_comfy,
)
from api.services.music_generator_xl_base_pipeline import count_sung_content_lines

COMPANION_LYRICS_MARKUP_SIMPLE_RU = (
    "Правила разметки (EWA companion / ACE vocal, обязательно):\n"
    "— Заголовки секций только простые, на отдельной строке: [Intro], [Verse 1], [Verse 2], [Pre-Chorus], [Chorus], [Bridge], [Outro].\n"
    "— Без двоеточия и без английского внутри [ ] — никаких [Verse: 75 BPM feel, piano].\n"
    "— Не пиши строки (Arrangement: …) и (Voice: …) — аранжировка и вокал только в tags, не в lyrics.\n"
    "— Между заголовками — только строки для пения на языке песни."
)

COMPANION_LYRICS_SINGABILITY_RU = (
    "\n\nПЕВУЧЕСТЬ ДЛЯ ACE (строго, русский):\n"
    "— Строка 4–8 слов; если не поётся на одном дыхании — укороти.\n"
    "— Разговорный песенный русский, не журналистика и не канцелярит из лонгрида (без «инвестиционный», «девелопмент», «урбанистика»).\n"
    "— Буква «ё» везде, где нужна для ударения: всё, ещё, идёт, несёт, твоё, моё, приём, ударён.\n"
    "— Естественный порядок слов; не ломай фразу ради рифмы; рифма вторична относительно певучести.\n"
    "— Прочитай каждую строку вслух: если звучит коряво или с не тем ударением — перепиши проще.\n"
    "— Не копируй длинные предложения из исходника — перескажи короткими образами."
)

COMPANION_LYRICS_SECTION_LINES_RU = (
    "\n\nФормат секций: только [Verse 1], [Chorus] и т.д. без BPM/английского в скобках. "
    "Каждая секция — минимум 2 строки для пения."
)

COMPANION_LYRICS_USER_FOOTER_RU = (
    "Напиши полный текст песни с простыми заголовками [Verse]/[Chorus] — только слова для пения, "
    "без (Arrangement:), без английского в секциях. Строки короткие, певучие, с правильной «ё». "
    "Не журналистский пересказ — песня от первого лица или образами, которые легко пропеть."
)

COMPANION_MAX_WORDS_PER_SUNG_LINE = 10
COMPANION_MIN_SUNG_LINES = 8
COMPANION_MIN_CYRILLIC_SUNG_LINES = 8

_ARRANGEMENT_LINE_RE = re.compile(r"^\s*\(Arrangement:", re.I)
_VOICE_LINE_RE = re.compile(r"^\s*\(Voice:", re.I)

_BUREAUCRATIC_WORD_RE = re.compile(
    r"(?i)(?:"
    r"инвестицион|девелопмент|урбанистик|канцеляр|логистическ(?:ий|ая|ое)|"
    r"инфраструктур|девелопер|экосистем|синерг|оптимизац"
    r")"
)

_COMMON_YO_WRONG_RE: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"(?<![а-яё])(?:все)(?![а-яё])", re.I), "всё"),
    (re.compile(r"(?<![а-яё])(?:eще|ещe)(?![а-яё])", re.I), "ещё"),
    (re.compile(r"(?<![а-яё])(?:идет)(?![а-яё])", re.I), "идёт"),
    (re.compile(r"(?<![а-яё])(?:несет)(?![а-яё])", re.I), "несёт"),
    (re.compile(r"(?<![а-яё])(?:твoe|твоe)(?![а-яё])", re.I), "твоё"),
    (re.compile(r"(?<![а-яё])(?:moё|mоё|мoe)(?![а-яё])", re.I), "моё"),
)


def _is_meta_lyrics_line(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return True
    if _SECTION_HEADER_RE.match(stripped):
        return True
    if _ARRANGEMENT_LINE_RE.match(stripped) or _VOICE_LINE_RE.match(stripped):
        return True
    return stripped.startswith("(") and stripped.endswith(")")


def validate_companion_russian_singability(
    lyrics: str,
    *,
    language: str = "ru",
) -> list[dict[str, Any]]:
    """Heuristic gate: lines too long / bureaucratic / missing ё — triggers LLM retry."""
    lang = (language or "ru").strip().lower()
    if not lang.startswith("ru"):
        return []
    text = (lyrics or "").strip()
    if not text:
        return [{"code": "lyrics_empty", "message": "Текст песни пустой."}]
    errors: list[dict[str, Any]] = []
    sung_total, sung_cyr = count_sung_content_lines(text, language=language)
    section_count = len(_SECTION_HEADER_RE.findall(text))
    if section_count >= 2 and sung_total < COMPANION_MIN_SUNG_LINES:
        errors.append(
            {
                "code": "companion_lyrics_too_few_sung_lines",
                "message": f"Мало строк для пения ({sung_total}, нужно ≥{COMPANION_MIN_SUNG_LINES}).",
            }
        )
    if section_count >= 2 and sung_cyr < COMPANION_MIN_CYRILLIC_SUNG_LINES:
        errors.append(
            {
                "code": "companion_lyrics_insufficient_russian",
                "message": f"Мало русских строк ({sung_cyr}, нужно ≥{COMPANION_MIN_CYRILLIC_SUNG_LINES}).",
            }
        )
    if _ARRANGEMENT_LINE_RE.search(text, re.M) or _VOICE_LINE_RE.search(text, re.M):
        errors.append(
            {
                "code": "companion_lyrics_production_lines",
                "message": "Убери (Arrangement:)/(Voice:) — в companion lyrics только слова для пения.",
            }
        )
    if re.search(r"\[[^\]]*:\s*[^\]]*(?:BPM|bpm|drums|piano|whisper)", text):
        errors.append(
            {
                "code": "companion_lyrics_enriched_headers",
                "message": "Используй простые [Verse 1]/[Chorus] без BPM и английского внутри [ ].",
            }
        )
    for line_no, raw in enumerate(text.splitlines(), start=1):
        if _is_meta_lyrics_line(raw):
            continue
        line = raw.strip()
        if len(line) < 3:
            continue
        words = [w for w in re.split(r"\s+", line) if w]
        if len(words) > COMPANION_MAX_WORDS_PER_SUNG_LINE:
            errors.append(
                {
                    "code": "companion_lyrics_line_too_long",
                    "line": line_no,
                    "fragment": line[:120],
                    "message": (
                        f"Строка {line_no} слишком длинная для пения ({len(words)} слов, "
                        f"макс. {COMPANION_MAX_WORDS_PER_SUNG_LINE})."
                    ),
                }
            )
        if len(words) >= 6 and line.count(",") >= 2:
            errors.append(
                {
                    "code": "companion_lyrics_line_too_clauses",
                    "line": line_no,
                    "fragment": line[:120],
                    "message": f"Строка {line_no} перегружена запятыми — разбей на две короткие.",
                }
            )
        low = line.lower().replace("ё", "е")
        if _BUREAUCRATIC_WORD_RE.search(low):
            errors.append(
                {
                    "code": "companion_lyrics_bureaucratic_word",
                    "line": line_no,
                    "fragment": line[:120],
                    "message": f"Строка {line_no}: канцелярит/журнализм — замени на разговорные слова.",
                }
            )
        for pattern, _yo in _COMMON_YO_WRONG_RE:
            if pattern.search(line):
                errors.append(
                    {
                        "code": "companion_lyrics_missing_yo",
                        "line": line_no,
                        "fragment": line[:120],
                        "message": f"Строка {line_no}: добавь «ё» где нужно ударение (всё, ещё, идёт…).",
                    }
                )
                break
        if sum(1 for e in errors if e.get("code") == "companion_lyrics_line_too_long") >= 4:
            break
    return errors[:12]


def companion_lyrics_errors_retryable(errors: list[dict[str, Any]]) -> bool:
    retryable = {
        "companion_lyrics_line_too_long",
        "companion_lyrics_line_too_clauses",
        "companion_lyrics_bureaucratic_word",
        "companion_lyrics_missing_yo",
        "companion_lyrics_production_lines",
        "companion_lyrics_enriched_headers",
        "companion_lyrics_too_few_sung_lines",
        "companion_lyrics_insufficient_russian",
    }
    return any(str(e.get("code") or "") in retryable for e in errors)


def companion_lyrics_retry_user_message(errors: list[dict[str, Any]]) -> str:
    codes = {str(e.get("code") or "") for e in errors}
    parts = [
        "КРИТИЧНО (EWA companion / ACE vocal): предыдущий текст плохо поётся — "
        "перепиши целиком. Только простые [Verse]/[Chorus], строки 4–8 слов, "
        "разговорный русский с «ё», без (Arrangement:)/(Voice:) и без английского в [ ]."
    ]
    if "companion_lyrics_line_too_long" in codes or "companion_lyrics_line_too_clauses" in codes:
        parts.append("Укороти каждую строку: одна мысль, одно дыхание, без длинных перечислений.")
    if "companion_lyrics_bureaucratic_word" in codes:
        parts.append("Убери канцелярит из лонгрида — перескажи простыми словами, как в песне.")
    if "companion_lyrics_missing_yo" in codes:
        parts.append("Проверь «ё»: всё, ещё, идёт, несёт, твоё, моё.")
    if "companion_lyrics_production_lines" in codes or "companion_lyrics_enriched_headers" in codes:
        parts.append("Никакого продакшна в lyrics — только слова для пения.")
    return "\n\n".join(parts)


def prepare_companion_vocal_lyrics_for_comfy(lyrics: str, *, language: str = "ru") -> str:
    """ACE Turbo companion: vocal encode gets sung lines + simple section headers only."""
    s = normalize_lyrics_sections_for_ace_comfy(lyrics or "")
    out: list[str] = []
    for line in s.splitlines():
        stripped = line.strip()
        if _ARRANGEMENT_LINE_RE.match(stripped) or _VOICE_LINE_RE.match(stripped):
            continue
        if (
            stripped.startswith("(")
            and stripped.endswith(")")
            and re.search(
                r"(?i)bpm|reverb|drums|bass|pad|whisper|vocal",
                stripped,
            )
        ):
            continue
        out.append(line)
    result = re.sub(r"\n{3,}", "\n\n", "\n".join(out)).strip()
    return result


__all__ = (
    "COMPANION_LYRICS_MARKUP_SIMPLE_RU",
    "COMPANION_LYRICS_SECTION_LINES_RU",
    "COMPANION_LYRICS_SINGABILITY_RU",
    "COMPANION_LYRICS_USER_FOOTER_RU",
    "companion_lyrics_errors_retryable",
    "companion_lyrics_retry_user_message",
    "prepare_companion_vocal_lyrics_for_comfy",
    "validate_companion_russian_singability",
)
