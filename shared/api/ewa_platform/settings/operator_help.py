# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Operator-facing help for EWA platform settings (admin «Настройки» tab).
# Invariants:
# - Keys match ``GENERATED_CATALOG`` / ``ewa_platform_setting.setting_key``.
# - Plain-language copy in ``operator_help_plain.PLAIN`` wins over generic templates.
# Related:
# - api/scripts/generate_ewa_platform_settings_catalog.py
# - documentation/product/ewa/EWA-PLATFORM-SETTINGS-DB.md
# ---

from __future__ import annotations

import re

from .operator_help_plain import PLAIN


class SettingHelpText:
    """Operator-facing labels and descriptions for one setting key."""

    __slots__ = (
        "title_ru",
        "title_en",
        "description_ru",
        "description_en",
        "affects_ru",
        "affects_en",
    )

    def __init__(
        self,
        title_ru: str,
        title_en: str,
        description_ru: str,
        description_en: str,
        affects_ru: str,
        affects_en: str,
    ) -> None:
        self.title_ru = title_ru.strip()
        self.title_en = title_en.strip()
        self.description_ru = description_ru.strip()
        self.description_en = description_en.strip()
        self.affects_ru = affects_ru.strip()
        self.affects_en = affects_en.strip()


_PERSONA_LABELS: dict[str, tuple[str, str]] = {
    "PARENT": ("EWA (основная)", "EWA (parent)"),
    "MELA": ("Mela", "Mela"),
    "ZERA": ("Zera", "Zera"),
    "KORA": ("Kora", "Kora"),
    "TALA": ("Tala", "Tala"),
    "FENI": ("Feni", "Feni"),
    "ARLIKA": ("Arlika", "Arlika"),
    "ARLIKA_V2": ("Arlika v2", "Arlika v2"),
}

_PERSONA_PARAM: dict[str, tuple[str, str, str, str, str, str]] = {
    "ROLE": (
        "Роль и тон персоны",
        "Persona role and tone",
        "Текст «кто говорит» в начале ответов. Пусто — стандарт из матрицы сидов. "
        "Не вставляйте пароли и личные данные.",
        "Opening voice block. Empty = seed matrix default. No secrets or PII.",
        "System prompt, первый абзац.",
        "System prompt opening block.",
    ),
    "DIRECTNESS": (
        "Прямолинейность",
        "Directness",
        "0 — мягче и длиннее; 1 — короче и прямее. Пусто — из матрицы сидов.",
        "0 = softer; 1 = blunter. Empty = seed default.",
        "Стиль формулировок.",
        "Phrasing style.",
    ),
    "PLAYFULNESS": (
        "Игривость",
        "Playfulness",
        "0 — серьёзнее; 1 — больше шуток и лёгкости. Пусто — из матрицы.",
        "0 = serious; 1 = playful. Empty = seed default.",
        "Тон шуток и иронии.",
        "Humor and teasing.",
    ),
    "VALENCE_BIAS": (
        "Эмоциональный тон",
        "Emotional valence",
        "Настрой «позитивнее / нейтральнее / мрачнее». Пусто — из матрицы (у Arlika — ниже).",
        "Positive vs neutral vs darker tone. Empty = seed default.",
        "Общий фон реплик.",
        "Overall reply mood.",
    ),
    "RECENCY_BIAS": (
        "Вес свежих реплик",
        "Recency weight",
        "Насколько сильно последние сообщения пользователя влияют на стиль. 0–1, пусто — из матрицы.",
        "How much recent user text steers style. 0–1, empty = seed default.",
        "Affective-слой.",
        "Affective layer.",
    ),
    "OPEN_APP": (
        "Склонность открывать приложения",
        "Open-app tendency",
        "Выше — чаще предлагает или открывает программы на столе. 0–1, пусто — из матрицы.",
        "Higher = more app open suggestions. 0–1, empty = seed default.",
        "open_app, ambient.",
        "open_app, ambient.",
    ),
    "PATCH_DESKTOP_CONFIG": (
        "Склонность менять тему",
        "Theme-change tendency",
        "Выше — чаще меняет тему/акцент без явной просьбы. 0–1, пусто — из матрицы.",
        "Higher = more unsolicited theme tweaks. 0–1, empty = seed default.",
        "theme_set, inference.",
        "theme_set, inference.",
    ),
    "AMBIENT_ADJUST": (
        "Чувствительность к фону",
        "Ambient sensitivity",
        "Выше — сильнее реагирует фоновыми коррекциями персоны. 0–1, пусто — из матрицы.",
        "Higher = stronger ambient persona tweaks. 0–1, empty = seed default.",
        "Ambient actions.",
        "Ambient actions.",
    ),
}


def _humanize_key_title(key: str) -> tuple[str, str]:
    """Fallback title from ENV key when PLAIN has no entry."""
    stem = key
    for prefix in (
        "EWA_COMPANION_",
        "EWA_ORCH_",
        "EWA_PERSONA_",
        "EWA_ATOM_",
        "EWA_HEALTH_",
        "EWA_QDRANT_",
        "EWA_DESKTOP_ORCH_",
        "EWA_",
    ):
        if stem.startswith(prefix):
            stem = stem[len(prefix) :]
            break
    words = stem.lower().replace("_", " ").split()
    ru = " ".join(words).capitalize() if words else key
    en = ru
    return ru, en


def _persona_help(key: str) -> SettingHelpText | None:
    m = re.match(
        r"^EWA_PERSONA_([A-Z0-9_]+)_(ROLE|DIRECTNESS|PLAYFULNESS|VALENCE_BIAS|RECENCY_BIAS|OPEN_APP|PATCH_DESKTOP_CONFIG|AMBIENT_ADJUST)$",
        key,
    )
    if not m:
        return None
    token, param = m.group(1), m.group(2)
    persona_ru, persona_en = _PERSONA_LABELS.get(token, (token, token))
    t_ru, t_en, d_ru, d_en, a_ru, a_en = _PERSONA_PARAM[param]
    title_ru = f"{t_ru} · {persona_ru}"
    title_en = f"{t_en} · {persona_en}"
    desc_ru = f"{persona_ru}: {d_ru}"
    desc_en = f"{persona_en}: {d_en}"
    if param != "ROLE":
        if "0–1" not in desc_ru:
            desc_ru = f"{desc_ru} Диапазон 0–1."
        if "0–1" not in desc_en and "0-1" not in desc_en:
            desc_en = f"{desc_en} Range 0–1."
    return SettingHelpText(title_ru, title_en, desc_ru, desc_en, a_ru, a_en)


def _generic_bool(
    key: str,
    short_ru: str,
    short_en: str,
    ar: str,
    ae: str,
) -> SettingHelpText:
    title_ru, title_en = _humanize_key_title(key)
    return SettingHelpText(
        title_ru,
        title_en,
        f"{short_ru} Значения: 0 — выключено; 1 — включено. "
        "После «Сохранить» применяется сразу, перезапуск сервера не нужен. "
        "Факт изменения хранится в Postgres (таблица ewa_platform_setting).",
        f"{short_en} Values: 0 = off; 1 = on. Applies immediately after Save.",
        ar,
        ae,
    )


def _generic_int(
    key: str,
    short_ru: str,
    short_en: str,
    ar: str,
    ae: str,
    allowed: str,
) -> SettingHelpText:
    title_ru, title_en = _humanize_key_title(key)
    return SettingHelpText(
        title_ru,
        title_en,
        f"{short_ru} Число ({allowed}). Обычно больше — щедрее лимит; меньше — строже или быстрее отказ.",
        f"{short_en} Number ({allowed}). Higher = wider limit; lower = stricter.",
        ar,
        ae,
    )


def _generic_float(
    key: str,
    short_ru: str,
    short_en: str,
    ar: str,
    ae: str,
    allowed: str,
) -> SettingHelpText:
    title_ru, title_en = _humanize_key_title(key)
    return SettingHelpText(
        title_ru,
        title_en,
        f"{short_ru} Дробное число ({allowed}). Ниже порога — срабатывает запасной сценарий без этого действия.",
        f"{short_en} Float ({allowed}). Below threshold — fallback path.",
        ar,
        ae,
    )


def _generic_string(
    key: str,
    short_ru: str,
    short_en: str,
    ar: str,
    ae: str,
    allowed: str,
) -> SettingHelpText:
    title_ru, title_en = _humanize_key_title(key)
    return SettingHelpText(
        title_ru,
        title_en,
        f"{short_ru} Текстовое значение ({allowed}). Пустая строка — взять настройку по умолчанию с сервера.",
        f"{short_en} Text ({allowed}). Empty = server default.",
        ar,
        ae,
    )


def enrich_setting_help(
    key: str,
    *,
    value_type: str,
    short_ru: str,
    short_en: str,
    affects_ru: str,
    affects_en: str,
    allowed_values: str,
) -> SettingHelpText:
    """Return operator-facing help; prefers PLAIN/persona, else readable generic templates."""
    if key in PLAIN:
        t_ru, t_en, d_ru, d_en = PLAIN[key]
        return SettingHelpText(t_ru, t_en, d_ru, d_en, affects_ru, affects_en)
    persona = _persona_help(key)
    if persona:
        return persona
    vtype = value_type.strip().lower()
    if vtype == "bool":
        return _generic_bool(key, short_ru, short_en, affects_ru, affects_en)
    if vtype == "int":
        return _generic_int(key, short_ru, short_en, affects_ru, affects_en, allowed_values)
    if vtype == "float":
        return _generic_float(key, short_ru, short_en, affects_ru, affects_en, allowed_values)
    if vtype in {"string", "csv", "secret"}:
        return _generic_string(key, short_ru, short_en, affects_ru, affects_en, allowed_values)
    t_ru, t_en = _humanize_key_title(key)
    return SettingHelpText(t_ru, t_en, short_ru, short_en, affects_ru, affects_en)


__all__ = ["SettingHelpText", "PLAIN", "enrich_setting_help"]
