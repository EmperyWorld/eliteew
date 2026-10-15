"""Язык авто-названия: русский только при языке песни ru; иначе — английский (en, fr, …)."""

from __future__ import annotations

from datetime import UTC, datetime


def language_wants_russian_title(language: str | None) -> bool:
    """True — название в русском: только явный язык песни ru (и типичные варианты)."""
    lc = (language or "").strip().lower()
    if not lc:
        return False
    if lc in ("ru", "rus", "russian"):
        return True
    return lc.startswith("ru-")


def language_wants_english_title(language: str | None) -> bool:
    """True, если авто-название трека должно быть на английском (все случаи, кроме русского)."""
    return not language_wants_russian_title(language)


def language_wants_french_title(language: str | None) -> bool:
    """Для обратной совместимости импорта: язык **текста** fr (не влияет на язык названия)."""
    lc = (language or "").strip().lower()
    return lc == "fr" or lc.startswith("fr-") or lc in ("french", "fra", "fre")


def fallback_auto_track_name(language: str | None) -> str:
    """Имя по умолчанию, если LLM не вернул название."""
    ts = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    if language_wants_russian_title(language):
        return f"Песня {ts}"
    return f"Song {ts}"
