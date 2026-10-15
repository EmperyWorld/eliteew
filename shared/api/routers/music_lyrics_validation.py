# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Проверка и санитизация текста песни перед генерацией музыки (в т.ч. XL Base ACE Step:
#   отсечение CoT/planning из lyrics, нормализация секций для Comfy).
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""
Проверка текста песни перед генерацией музыки: пустые секции, «каракули», длинные (),
продакшн-заголовки в lyrics (контракт: аранжировка в поле tags, не в тексте песни).

Используется эндпоинтом POST /music-generator/validate-lyrics и при POST /generate
(если не передан skip_lyrics_validation).
"""

from __future__ import annotations

import re
from typing import Any

_SECTION_HEADER_RE = re.compile(r"^\s*\[([^\]]+)]\s*$")
# Любая метка в квадратных скобках (в т.ч. внутри строки) — для запрета [Drop]/[Build Up] в lyrics.
_BRACKET_LABEL_RE = re.compile(r"\[([^\]]+)\]")
# Повтор одного и того же фрагмента 2–12 символов минимум 3 раза подряд (слоги, «КаяиЯиЯ»)
_REPEAT_GIBBERISH_RE = re.compile(r"(.{2,12})\1{2,}", re.DOTALL)
# Слишком длинное «слово» без пробелов с низкой уникальностью букв
_LOW_DIVERSITY_WORD_RE = re.compile(r"[^\s]{18,}")

# Строки вида [Intro], [Verse 1] — только заголовок секции (для outline тегов стиля)
_STYLE_SECTION_LINE_RE = re.compile(r"^\s*\[([^\]]+)\]\s*$", re.MULTILINE)
_SECTION_BPM_RE = re.compile(r"\b(?P<bpm>\d{2,3})\s*BPM(?:\s*feel)?\b", re.IGNORECASE)

# Эвристика для 1-го лица в русском тексте: пары «женская форма» -> «мужская форма».
_RU_SELFREF_FEM_TO_MASC_PAIRS: tuple[tuple[str, str], ...] = (
    ("я была одна", "я был один"),
    ("я была", "я был"),
    ("я устала", "я устал"),
    ("я ушла", "я ушёл"),
    ("я пришла", "я пришёл"),
    ("я нашла", "я нашёл"),
    ("я рада", "я рад"),
    ("я готова", "я готов"),
    ("я согласна", "я согласен"),
    ("я одна", "я один"),
    ("я влюблена", "я влюблён"),
    ("я свободна", "я свободен"),
    ("я должна", "я должен"),
    ("я жива", "я жив"),
    ("я сильна", "я силён"),
)

_RU_SELFREF_MASC_TO_FEM_PAIRS: tuple[tuple[str, str], ...] = tuple((m, f) for f, m in _RU_SELFREF_FEM_TO_MASC_PAIRS)

_RU_FIRST_PERSON_FEM_PAST_RE = re.compile(
    r"\b(?P<prefix>я\s+(?:не\s+)?)"
    r"(?P<stem>[а-яё-]{1,}?)"
    r"(?P<suffix>лась|ла)\b",
    flags=re.IGNORECASE,
)
_RU_FIRST_PERSON_MASC_PAST_RE = re.compile(
    r"\b(?P<prefix>я\s+(?:не\s+)?)"
    r"(?P<stem>[а-яё-]{1,}?)"
    r"(?P<suffix>лся|л)\b",
    flags=re.IGNORECASE,
)

_FORBIDDEN_META_MUSIC_WORD_PATTERNS_RU: tuple[tuple[str, str], ...] = (
    (r"\bв\s+ритме\s+ночи\b", "в этой ночи"),
    (r"\bв\s+ритме\s+танца\b", "пока мы рядом"),
    (r"\bпод\s+ритм\s+ночи\b", "под дыхание ночи"),
    (r"\bпод\s+ритм\s+танца\b", "пока держишь ладонь"),
    (r"\bритм\s+ночи\b", "дыхание ночи"),
    (r"\bритм\s+танца\b", "движение тела"),
    (r"\bритмы\s+сердца\b", "стук сердца"),
    (r"\bв\s+такт\b", "в лад"),
    (r"\bритм(?:ы|а|у|е|ом|ов)?\b", "пульс"),
    (r"\bзвук(?:и|а|у|е|ом|ов)?\b", "голос"),
    (r"\bтакт(?:ы|а|у|е|ом|ов)?\b", "шаг"),
)


def _split_section_name_and_hint(raw: str) -> tuple[str, str]:
    """[Section: hint] -> ('Section', 'hint'); [Section] -> ('Section', '')."""
    core = raw.strip()
    if core.startswith("[") and core.endswith("]"):
        core = core[1:-1].strip()
    if ":" not in core:
        return core, ""
    name, hint = core.split(":", 1)
    return name.strip(), hint.strip()


def _case_aware_sub_replacement(src: str, replacement: str) -> str:
    if src.isupper():
        return replacement.upper()
    if src and src[0].isupper():
        return replacement[:1].upper() + replacement[1:]
    return replacement


def _replace_phrase_case_aware(text: str, old: str, new: str) -> tuple[str, bool]:
    changed = False

    def repl(m: re.Match[str]) -> str:
        nonlocal changed
        changed = True
        return _case_aware_sub_replacement(m.group(0), new)

    pat = re.compile(rf"\b{re.escape(old)}\b", flags=re.IGNORECASE)
    return pat.sub(repl, text), changed


def _replace_regex_case_aware(text: str, pattern: str, replacement: str) -> tuple[str, int]:
    count = 0

    def repl(m: re.Match[str]) -> str:
        nonlocal count
        count += 1
        return _case_aware_sub_replacement(m.group(0), replacement)

    out = re.sub(pattern, repl, text, flags=re.IGNORECASE)
    return out, count


def scrub_forbidden_meta_music_words(lyrics: str, *, language: str | None = None) -> tuple[str, bool, list[str]]:
    """
    Убирает из текста песни штампы про «ритмы/звуки/такты» и самые частые клише:
    - используется в авто-генерации как принудительная чистка;
    - возвращает (text, changed, replaced_tokens).
    """
    text = (lyrics or "").strip()
    if not text:
        return text, False, []
    lang = (language or "").strip().lower()
    if lang and not lang.startswith("ru"):
        return text, False, []
    out = text
    changed = False
    replaced: list[str] = []
    for pat, repl in _FORBIDDEN_META_MUSIC_WORD_PATTERNS_RU:
        out, n = _replace_regex_case_aware(out, pat, repl)
        if n > 0:
            changed = True
            replaced.extend([pat] * n)
    return out, changed, replaced


def _rewrite_ru_first_person_past_forms(text: str, *, to_vocal: str) -> tuple[str, bool]:
    """
    Generic rewrite for first-person Russian past tense:
    - male -> female: "я делал" -> "я делала", "я боялся" -> "я боялась"
    - female -> male: "я делала" -> "я делал", "я боялась" -> "я боялся"
    """
    changed = False

    def repl_to_female(m: re.Match[str]) -> str:
        nonlocal changed
        changed = True
        stem = m.group("stem")
        suffix = m.group("suffix").lower()
        src = f"{stem}{m.group('suffix')}"
        dst = f"{stem}{'лась' if suffix == 'лся' else 'ла'}"
        return f"{m.group('prefix')}{_case_aware_sub_replacement(src, dst)}"

    def repl_to_male(m: re.Match[str]) -> str:
        nonlocal changed
        changed = True
        stem = m.group("stem")
        suffix = m.group("suffix").lower()
        src = f"{stem}{m.group('suffix')}"
        dst = f"{stem}{'лся' if suffix == 'лась' else 'л'}"
        return f"{m.group('prefix')}{_case_aware_sub_replacement(src, dst)}"

    if to_vocal == "female":
        return _RU_FIRST_PERSON_MASC_PAST_RE.sub(repl_to_female, text), changed
    if to_vocal == "male":
        return _RU_FIRST_PERSON_FEM_PAST_RE.sub(repl_to_male, text), changed
    return text, False


def enforce_lyrics_vocal_gender_consistency(
    lyrics: str, *, vocal: str | None, language: str | None = None
) -> tuple[str, bool]:
    """
    Мягкая пост-обработка для auto-lyrics:
    - male: заменяет типичные «я ...а» формы на мужские;
    - female: заменяет типичные «я ...» мужские формы на женские.
    Для duet/unknown или не-ru языка возвращает исходный текст.
    """
    text = (lyrics or "").strip()
    if not text:
        return text, False
    v = (vocal or "").strip().lower()
    if v not in ("male", "female"):
        return text, False
    lang = (language or "").strip().lower()
    if lang and not lang.startswith("ru"):
        return text, False
    pairs = _RU_SELFREF_FEM_TO_MASC_PAIRS if v == "male" else _RU_SELFREF_MASC_TO_FEM_PAIRS
    out = text
    changed_any = False
    for old, new in pairs:
        out, changed = _replace_phrase_case_aware(out, old, new)
        changed_any = changed_any or changed
    out, changed_generic = _rewrite_ru_first_person_past_forms(out, to_vocal=v)
    changed_any = changed_any or changed_generic
    return out, changed_any


def infer_lyrics_first_person_gender(lyrics: str, *, language: str | None = None) -> str | None:
    """
    Эвристика для suggest-production-params:
    - возвращает 'male' / 'female' при явном перевесе форм первого лица;
    - иначе None.
    """
    text = (lyrics or "").strip()
    if not text:
        return None
    lang = (language or "").strip().lower()
    if lang and not lang.startswith("ru"):
        return None
    low = text.lower()
    fem_hits = 0
    masc_hits = 0
    for fem, masc in _RU_SELFREF_FEM_TO_MASC_PAIRS:
        fem_hits += len(re.findall(rf"\b{re.escape(fem)}\b", low))
        masc_hits += len(re.findall(rf"\b{re.escape(masc)}\b", low))
    fem_hits += len(_RU_FIRST_PERSON_FEM_PAST_RE.findall(low))
    masc_hits += len(_RU_FIRST_PERSON_MASC_PAST_RE.findall(low))
    if fem_hits == masc_hits:
        return None
    if fem_hits >= masc_hits + 2 or (fem_hits >= 2 and masc_hits == 0):
        return "female"
    if masc_hits >= fem_hits + 2 or (masc_hits >= 2 and fem_hits == 0):
        return "male"
    return None


def parse_music_section_header(raw: str) -> dict[str, Any] | None:
    """
    Parse section header in legacy/enriched formats:
    - [Verse]
    - [Verse: Atmospheric Breakbeat, 87 BPM feel]
    """
    m = _SECTION_HEADER_RE.match((raw or "").strip())
    if not m:
        return None
    raw_inner = m.group(1).strip()
    section_name_raw, arrangement_hint = _split_section_name_and_hint(raw_inner)
    section_name = _normalize_section_outline_key(section_name_raw)
    bpm_hint: int | None = None
    if arrangement_hint:
        bpm_match = _SECTION_BPM_RE.search(arrangement_hint)
        if bpm_match:
            try:
                bpm_hint = int(bpm_match.group("bpm"))
            except ValueError:
                bpm_hint = None
    return {
        "raw_inner": raw_inner,
        "section_name_raw": section_name_raw,
        "section_name": section_name,
        "arrangement_hint": arrangement_hint or None,
        "bpm_hint": bpm_hint,
        "is_enriched": bool(arrangement_hint),
    }


def _normalize_ru_section_key(s: str) -> str:
    t = s.strip().lower()
    t = t.replace("—", "-").replace("–", "-")
    return re.sub(r"\s+", " ", t)


def _map_russian_section_bracket_to_english(inner: str) -> str:
    """
    Русские заголовки в [] → стандартные английские метки для ACE (структура, не лирика).
    Неизвестные кириллические метки — в [Verse], чтобы не блокировать генерацию.
    """
    section_name_raw, arrangement_hint = _split_section_name_and_hint(inner)
    raw = section_name_raw.strip()
    if not any("\u0400" <= c <= "\u04ff" for c in raw):
        return inner.strip()
    key = _normalize_ru_section_key(raw)

    exact: dict[str, str] = {
        "переход": "Bridge",
        "пауза": "Bridge",
        "нарастание": "Pre-Chorus",
        "крик": "Hook",
        "финал": "Outro",
        "затухание": "Outro",
        "сдвиг": "Bridge",
        "цифровой шум": "Bridge",
        "вступление": "Intro",
        "припев": "Chorus",
        "куплет": "Verse",
        "интро": "Intro",
        "аутро": "Outro",
        "бридж": "Bridge",
        "брейк": "Bridge",
    }
    mapped = ""
    if key in exact:
        mapped = exact[key]
    elif "джаз" in key and ("вступ" in key or key.startswith("джаз")):
        mapped = "Intro"
    elif "габбер" in key:
        if "втор" in key or " 2" in key or "2-й" in raw.lower():
            mapped = "Verse 2"
        elif "перв" in key or " 1" in key or "1-й" in raw.lower():
            mapped = "Verse 1"
        else:
            mapped = "Verse"
    elif "вступ" in key or key.endswith("интро"):
        mapped = "Intro"
    elif "припев" in key:
        mapped = "Chorus"
    elif "финал" in key or "конец" in key:
        mapped = "Outro"
    elif "шум" in key or "цифров" in key:
        mapped = "Bridge"
    else:
        mapped = "Verse"
    if arrangement_hint:
        return f"{mapped}: {arrangement_hint}"
    return mapped


_BARE_SECTION_LINE_RE = re.compile(
    r"^\s*(Intro|Verse(?:\s+\d+)?|Pre-Chorus(?:\s+\d+)?|Pre\s+Chorus(?:\s+\d+)?|"
    r"Chorus(?:\s+\d+)?|Bridge(?:\s+\d+)?|Outro|Hook)\s*$",
    re.I,
)


def _format_bare_section_label(raw: str) -> str:
    s = re.sub(r"\s+", " ", (raw or "").strip())
    low = re.sub(r"\bpre\s+chorus\b", "pre-chorus", s.lower())
    exact = {"intro": "Intro", "outro": "Outro", "hook": "Hook", "bridge": "Bridge"}
    if low in exact:
        return exact[low]
    m = re.match(r"^(verse|chorus|bridge|pre-chorus)\s*(\d+)?$", low)
    if m:
        base_map = {"verse": "Verse", "chorus": "Chorus", "bridge": "Bridge", "pre-chorus": "Pre-Chorus"}
        base = base_map[m.group(1)]
        num = m.group(2)
        return f"{base} {num}" if num else base
    return s.title()


def brace_bare_section_headers_for_ace(text: str) -> str:
    """LLM часто печатает ``Verse 1`` без скобок; ACE enrich и Comfy требуют ``[Verse 1]``."""
    if not (text or "").strip():
        return text or ""
    out: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if _SECTION_HEADER_RE.match(stripped):
            out.append(line)
            continue
        m = _BARE_SECTION_LINE_RE.match(stripped)
        if m:
            out.append(f"[{_format_bare_section_label(m.group(1))}]")
            continue
        out.append(line)
    return "\n".join(out)


def normalize_russian_ace_section_headers(text: str) -> str:
    """Строки-заголовки [ … ] с кириллицей заменяются на [Intro]/[Verse]/… перед валидацией и Comfy."""
    if not (text or "").strip():
        return text or ""
    lines = text.splitlines()
    out: list[str] = []
    for line in lines:
        m = _SECTION_HEADER_RE.match(line.strip())
        if not m:
            out.append(line)
            continue
        inner = m.group(1).strip()
        name_part, _hint = _split_section_name_and_hint(inner)
        if not any("\u0400" <= c <= "\u04ff" for c in name_part):
            out.append(line)
            continue
        en = _map_russian_section_bracket_to_english(inner)
        out.append(f"[{en}]")
    return "\n".join(out)


def _normalize_section_outline_key(raw: str) -> str:
    lab = raw.strip().lower()
    return re.sub(r"\s+", " ", lab)


def lyrics_section_labels_ordered_exact(lyrics: str) -> list[str]:
    """Exact section labels from lyrics in playback order, e.g. Intro, Verse 1, Pre-Chorus, Chorus."""
    from api.services.music_evolution_vocal import _capitalize_ace_style_section_label

    labels: list[str] = []
    for line in (lyrics or "").splitlines():
        m = _STYLE_SECTION_LINE_RE.match(line.strip())
        if not m:
            continue
        parsed = parse_music_section_header(f"[{m.group(1)}]")
        raw_name = parsed["section_name_raw"] if parsed else m.group(1).strip()
        labels.append(_capitalize_ace_style_section_label(raw_name))
    return labels


def lyrics_section_outline_for_style_prompt(lyrics: str) -> str:
    """
    Секции из текста [Intro], [Verse 1], … в порядке следования (включая повторы).
    Используется в POST /generate-style: описание звучания в tags следует этому порядку.
    Повторы одной и той же метки: [chorus], [chorus 2], [chorus 3] (ACE, без «occurrence»).
    """
    labels = _STYLE_SECTION_LINE_RE.findall(lyrics)
    if not labels:
        return ""
    counts: dict[str, int] = {}
    parts: list[str] = []
    for raw in labels:
        parsed = parse_music_section_header(f"[{raw}]")
        if not parsed:
            continue
        key = parsed["section_name"]
        hint = parsed["arrangement_hint"] or ""
        counts[key] = counts.get(key, 0) + 1
        n = counts[key]
        outline_label = key if n <= 1 else f"{key} {n}"
        if hint:
            parts.append(f"[{outline_label}: {hint}]")
        elif parsed["bpm_hint"] is not None:
            parts.append(f"[{outline_label}: {parsed['bpm_hint']} BPM]")
        else:
            parts.append(f"[{outline_label}]")
    return " → ".join(parts)


def _canonical_vocal_section_from_header(label: str) -> str | None:
    """Нормализует заголовок секции к роли вокала для подсказки tags (intro/verse/chorus/…)."""
    name_part, _hint = _split_section_name_and_hint(label)
    s = name_part.strip().lower()
    s = re.sub(r"\s+", " ", s)
    s = s.replace("–", "-").replace("—", "-")
    if re.match(r"^intro\b", s):
        return "intro"
    if re.match(r"^outro\b", s):
        return "outro"
    if re.match(r"^verse\b", s):
        return "verse"
    if re.match(r"^chorus\b", s):
        return "chorus"
    if re.match(r"^bridge\b", s):
        return "bridge"
    if re.match(r"^pre-chorus\b", s) or re.match(r"^pre chorus\b", s) or re.match(r"^prechorus\b", s):
        return "pre-chorus"
    return None


def lyrics_track_structure_canonical_for_style_prompt(lyrics: str) -> str:
    """
    Цепочка вокальных секций в каноническом виде для ACE tags (порядок как в тексте).
    Пустая строка, если нет распознанных вокальных заголовков.
    """
    labels = _STYLE_SECTION_LINE_RE.findall(lyrics)
    slots: list[str] = []
    for raw in labels:
        canon = _canonical_vocal_section_from_header(raw)
        if canon:
            slots.append(f"[{canon}]")
    if not slots:
        return ""
    return "Track structure from lyrics (vocal sections only; mirror in tags with production): " + " → ".join(slots)


def lyrics_section_music_hints_for_style_prompt(lyrics: str) -> str:
    """
    Extended per-section hints from enriched headers for style prompt context.
    Example: [intro: atmospheric breakbeat, 87 bpm feel]
    """
    labels = _STYLE_SECTION_LINE_RE.findall(lyrics)
    if not labels:
        return ""
    rows: list[str] = []
    section_seen = 0
    for raw in labels:
        parsed = parse_music_section_header(f"[{raw}]")
        if not parsed:
            continue
        section_seen += 1
        if section_seen > 14:
            break
        section = parsed["section_name"]
        hint = parsed["arrangement_hint"]
        bpm_hint = parsed["bpm_hint"]
        if hint and bpm_hint is not None:
            rows.append(f"- [{section}] -> {hint} (bpm hint: {bpm_hint})")
        elif hint:
            rows.append(f"- [{section}] -> {hint}")
        elif bpm_hint is not None:
            rows.append(f"- [{section}] -> bpm hint: {bpm_hint}")
    if not rows:
        return ""
    return "Per-section music hints from lyrics headers:\n" + "\n".join(rows)


# Англ. фразы продакшна в теле строки (ошибка — перенести в теги звучания)
_PRODUCTION_PHRASES_EN: tuple[str, ...] = (
    "white noise sweep",
    "impact hit",
    "vocal chop",
    "reverse cymbal",
    "sub bass boom",
    "tape stop effect",
    "white noise",
    "downlifter",
    "filter sweep",
    "bass booster",
)

# Русские намёки на микс/аранжировку в тексте песни (предупреждение)
_ARRANGEMENT_HINTS_RU: tuple[str, ...] = (
    "сайдчейн",
    "сайд-чейн",
    "sidechain",
    "стереоширина",
    "стерео ширин",
    "агрессивные ударные",
    "бас бьёт",
    "бас бьет",
    "бит тяжёлый",
    "бит тяжелый",
    "реверберация в миксе",
)


# Хвостовые дисклеймеры модели после текста песни (не должны попадать в пайплайн)
_TRAILING_DISCLAIMER_PATTERNS = (
    r"(?:\r?\n)+(?:\*{1,2}\s*)?Примечание\b[:\s].*$",
    r"(?:\r?\n)+(?:\*{1,2}\s*)?Note\b[:\s].*$",
    r"(?:\r?\n)+(?:\*{1,2}\s*)?Disclaimer\b[:\s].*$",
    r"(?:\r?\n)+(?:\*{1,2}\s*)?P\.?\s*S\.?\s*[:\s].*$",
    r"(?:\r?\n)+(?:\*{1,2}\s*)?Этот текст песни\b.*$",
    r"(?:\r?\n)+(?:\*{1,2}\s*)?В тексте песни\b.*$",
    r"(?:\r?\n)+(?:\*{0,2}\s*)?Голос исполнител(?:я|ьницы)\b.*$",
    r"(?:\r?\n)+(?:\*{0,2}\s*)?Все прилагательные,\s*глаголы\s*и\s*формы\b.*$",
    r"(?:\r?\n)+(?:\*{0,2}\s*)?Использован[аоы]?\s+экспериментальн\w+\s+подход\b.*$",
    r"(?:\r?\n)+(?:\*{0,2}\s*)?Текст песни избегает табу-лексики\b.*$",
)


def _is_trailing_meta_commentary_line(line: str) -> bool:
    low = (line or "").strip().lower().strip("\"'` ,.;:")
    if not low:
        return False
    if "голос исполнитель" in low:
        return True
    if "все прилагательные" in low and "формы согласованы" in low:
        return True
    if "эксперименталь" in low and "пресета luna" in low:
        return True
    return "текст песни избегает табу-лексики" in low


def _is_meta_instruction_line(line: str) -> bool:
    """Строки-инструкции от LLM в начале «текста песни», не куплет (иначе gibberish_line)."""
    raw = line.strip()
    if len(raw) < 8:
        return False
    low = raw.lower()
    # Длинная преамбула «Тема песни не содержит… / я буду следовать контракту…» (не куплет)
    if low.startswith("тема песни") and (
        len(low) > 45 or "не содержит" in low[:120] or "контракт" in low or "пресет стиля" in low
    ):
        return True
    if any(
        low.startswith(p)
        for p in (
            "тема:",
            "theme:",
            "пресет:",
            "preset:",
            "язык:",
            "language:",
            "инструкции",
            "instructions:",
        )
    ):
        return True
    if "текст песни должен" in low[:200]:
        return True
    if low.startswith("начинаю создание"):
        return True
    if low.startswith("в данной задаче") and (
        "необходимо написать текст песни" in low[:260] or "тема песни" in low[:260]
    ):
        return True
    if low in ("текст песни:", "lyrics:", "song lyrics:"):
        return True
    if "в данном тексте песни использовался" in low[:220]:
        return True
    if "в тексте песни использованы" in low[:220]:
        return True
    if "создан в соответствии с заданной темой" in low and "пресет" in low:
        return True
    return "создан в соответствии с заданными параметрами" in low


def strip_leading_music_lyrics_meta_lines(text: str) -> str:
    """Убирает из начала ответа LLM служебные строки (тема/пресет/инструкции), пока не начнётся текст песни."""
    lines = (text or "").splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if not stripped:
            i += 1
            continue
        if _is_meta_instruction_line(stripped):
            i += 1
            continue
        if stripped in ("---", "***", "___"):
            i += 1
            continue
        break
    return "\n".join(lines[i:]).strip()


def strip_trailing_ai_disclaimers(text: str) -> str:
    """Убирает примечания вроде «*Примечание: …» / «Note: …» в конце ответа LLM."""
    s = (text or "").rstrip()
    for _ in range(5):
        changed = False
        for pat in _TRAILING_DISCLAIMER_PATTERNS:
            s2 = re.sub(pat, "", s, flags=re.DOTALL | re.IGNORECASE)
            if s2 != s:
                s = s2.rstrip()
                changed = True
        # Дополнительный guard: иногда LLM дописывает «оценку качества» в последних строках.
        # Удаляем только явно служебные хвосты, чтобы не трогать поэтический текст.
        lines = s.splitlines()
        while lines and _is_trailing_meta_commentary_line(lines[-1]):
            lines.pop()
            changed = True
            while lines and not lines[-1].strip():
                lines.pop()
        while lines and re.fullmatch(r"[\s\"'`,.;:!?]+", lines[-1]):
            lines.pop()
            changed = True
        if changed:
            s = "\n".join(lines).rstrip()
        if not changed:
            break
    return s


def _extract_song_body_from_fenced_block(text: str) -> str:
    """
    Если модель завернула песню в ```...``` после преамбулы, достаём содержимое блока.
    Берём первый fenced-блок, где есть секционные заголовки [Verse]/[Intro]/...
    """
    s = (text or "").strip()
    if "```" not in s:
        return s
    candidates = re.findall(r"```(?:[a-zA-Z0-9_-]+)?\s*\n([\s\S]*?)\n```", s)
    if not candidates:
        return s
    for body in candidates:
        if re.search(r"^\s*\[[^\]\n]{2,}\]\s*$", body, flags=re.MULTILINE):
            return body.strip()
    return s


def strip_forbidden_production_bracket_labels(text: str) -> str:
    """
    Backward-compatible normalizer for bracket labels.
    Раньше удалял [Drop]/[Build Up]/[Breakdown], но enriched-контракт разрешает музыкальные
    подсказки прямо в секциях lyrics (например [Drop: Drum & Bass, 174 BPM]).
    Поэтому функция больше не вырезает секции, только чистит пробелы/пустые строки.
    """
    s = text or ""
    s = re.sub(r"[ \t]+\n", "\n", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    s = re.sub(r" {2,}", " ", s)
    return s.strip()


def sanitize_lyrics_ai_output(text: str) -> str:
    """Снять ```, хвостовые примечания, затем продакшн-метки [Drop]/[Build Up]/… — единая точка для lyrics/improve."""
    s = strip_markdown_fences_copy(text)
    s = _extract_song_body_from_fenced_block(s)
    s = strip_leading_music_lyrics_meta_lines(s)
    s = strip_trailing_ai_disclaimers(s)
    s = strip_forbidden_production_bracket_labels(s)
    s = normalize_russian_ace_section_headers(s)
    return brace_bare_section_headers_for_ace(s)


def strip_markdown_fences_copy(text: str) -> str:
    """Копия логики снятия ``` без циклического импорта из music_generator."""
    s = (text or "").strip()
    for _ in range(6):
        if not s.startswith("```"):
            break
        lines = s.splitlines()
        if len(lines) < 2 or lines[-1].strip() != "```":
            break
        if not lines[0].lstrip().startswith("```"):
            break
        s = "\n".join(lines[1:-1]).strip()
    return s


_ARRANGEMENT_NESTED_VOICE_RE = re.compile(
    r"^\(Arrangement:\s*(.+?),\s*\(Voice:\s*([^)]+)\)\s*\)\s*$",
    re.I,
)

_REPEATABLE_SECTION_BASES = frozenset({"intro", "verse", "pre-chorus", "chorus", "bridge", "outro"})


def _section_header_base_key(section_name: str) -> str | None:
    s = _normalize_section_outline_key(section_name)
    if s in _REPEATABLE_SECTION_BASES:
        return s
    for base in _REPEATABLE_SECTION_BASES:
        if s.startswith(f"{base} "):
            return base
    if s.startswith("pre chorus") or s.startswith("prechorus"):
        return "pre-chorus"
    return None


def split_voice_from_nested_arrangement_lines(text: str) -> str:
    """(Arrangement: …, (Voice: …)) → две строки; Voice не вкладывается в Arrangement."""
    lines: list[str] = []
    for line in (text or "").splitlines():
        stripped = line.strip()
        m = _ARRANGEMENT_NESTED_VOICE_RE.match(stripped)
        if not m:
            lines.append(line)
            continue
        arr = m.group(1).strip().rstrip(",")
        voice_hint = m.group(2).strip()
        lines.append(f"(Arrangement: {arr})")
        if voice_hint.lower().startswith(("female", "male", "duet")):
            lines.append(f"(Voice: {voice_hint})")
        else:
            lines.append(f"(Voice: female, {voice_hint})")
    return "\n".join(lines)


def renumber_repeated_lyrics_section_headers(text: str) -> str:
    """Второй [Chorus] без номера → [Chorus 2] (и аналогично verse/bridge)."""
    counts: dict[str, int] = {}
    out: list[str] = []
    for line in (text or "").splitlines():
        stripped = line.strip()
        m = _SECTION_HEADER_RE.match(stripped)
        if not m:
            out.append(line)
            continue
        parsed = parse_music_section_header(stripped)
        if not parsed:
            out.append(line)
            continue
        base = _section_header_base_key(parsed["section_name_raw"])
        if not base or re.search(r"\d", parsed["section_name_raw"]):
            out.append(line)
            continue
        counts[base] = counts.get(base, 0) + 1
        n = counts[base]
        if n <= 1:
            out.append(line)
            continue
        label_map = {
            "intro": "Intro",
            "verse": "Verse",
            "pre-chorus": "Pre-Chorus",
            "chorus": "Chorus",
            "bridge": "Bridge",
            "outro": "Outro",
        }
        out.append(f"[{label_map.get(base, base.title())} {n}]")
    return "\n".join(out)


def normalize_lyrics_sections_for_ace_comfy(lyrics: str) -> str:
    """
    Перед Comfy (ACE): заголовок секции на отдельной строке; [Verse] в середине строки — вынести.
    Если есть [Verse]/[Chorus], но нет [Intro] — добавить пустой [Intro] в начало.
    """
    text = (lyrics or "").strip()
    if not text:
        return text
    text = brace_bare_section_headers_for_ace(text)
    text = split_voice_from_nested_arrangement_lines(text)
    lines = text.splitlines()
    out: list[str] = []
    for line in lines:
        s = line.strip()
        if not s:
            out.append("")
            continue
        if s.startswith("["):
            close = s.find("]")
            if close == -1:
                out.append(s)
                continue
            header = s[: close + 1]
            rest = s[close + 1 :].strip()
            parsed = parse_music_section_header(header)
            if parsed:
                out.append(f"[{parsed['section_name_raw']}]")
                if parsed["arrangement_hint"]:
                    out.append(f"(Arrangement: {parsed['arrangement_hint']})")
            else:
                out.append(header)
            if rest:
                out.append(rest)
            continue
        m = re.search(r"(\[[^\]]+\])", s)
        if m and m.start() > 0:
            before = s[: m.start()].strip()
            sec = m.group(1).strip()
            rest = s[m.end() :].strip()
            if before:
                out.append(before)
            out.append(sec)
            if rest:
                out.append(rest)
            continue
        out.append(s)
    result = "\n".join(out)
    low = result.lower()
    has_intro = bool(re.search(r"\[\s*intro(?:\s*:[^\]]*)?\]", low))
    has_verse_or_chorus = bool(re.search(r"\[\s*(verse|chorus)(?:\s+\d+)?(?:\s*:[^\]]*)?\]", low))
    if not has_intro and has_verse_or_chorus:
        result = "[Intro]\n\n" + result
    return renumber_repeated_lyrics_section_headers(result)


_XL_BASE_SECTION_START_RE = re.compile(
    r"^\s*\[(?:Intro|Verse(?:\s+\d+)?|Pre-Chorus|Chorus(?:\s+\d+)?|Bridge|Outro)(?:\s*:[^\]]*)?\]\s*$",
    re.I,
)

_XL_BASE_PLANNING_SIGNAL_RE = re.compile(
    r"(Self-Correction|Let's refine|Let's check|The prompt says|Looking at my draft|"
    r"Wait, let me double-check|Female \(all first-person|Support, sisterhood|"
    r"\* \*(?:Intro|Verse|Chorus|Bridge|Outro|Pre-Chorus)\s*:\*\*|Final Text Check|"
    r"One last check|chain-of-thought|K-pop \(structure)",
    re.I,
)

_XL_BASE_PLANNING_LINE_RE = re.compile(
    r"(?i)^(?:"
    r"\*+\s*(?:Self-Correction|Wait,?|Let's|Looking at|The prompt says|Theme:|Better:|Correction:|"
    r"Final (?:check|Polish|Text Check))"
    r"|(?:Female|Male)\s+\(all first-person"
    r"|Support,\s+sisterhood"
    r"|K-pop\s*\("
    r"|Russian\.\s*Female"
    r"|Strict\s*$"
    r"|No \"\w"
    r"|\* \*(?:Intro|Verse|Chorus|Bridge|Outro|Pre-Chorus)\s*:"
    r"|(?:Checked|Good)\.\s*$"
    r"|(?:One last check|Let's ensure|Let's refine|Actually, it says)"
    r"|(?:Инструкции поняты|Начинаю создание)"
    r")",
)


def _strip_xl_base_planning_lines(text: str) -> str:
    """Убрать явные строки LLM-планирования, не трогая секции песни."""
    kept: list[str] = []
    for line in (text or "").splitlines():
        stripped = line.strip()
        if stripped and _XL_BASE_PLANNING_LINE_RE.match(stripped):
            continue
        kept.append(line)
    return "\n".join(kept).strip()


def _extract_xl_base_song_from_planning_leak(text: str) -> str | None:
    """
    Если модель «протекла» chain-of-thought в поле lyrics, вытащить блок с секциями и кириллицей.
    """
    lines = (text or "").splitlines()
    start_idx: int | None = None
    for i, ln in enumerate(lines):
        if _XL_BASE_SECTION_START_RE.match(ln):
            start_idx = i
            break
        if re.match(r"^\s*\[Intro(?:\s*:[^\]]*)?\]", ln, re.I):
            start_idx = i
            break
    if start_idx is None:
        for i, ln in enumerate(lines):
            if re.match(r"^\s*\(Arrangement:", ln, re.I) and i > 0:
                prev = lines[i - 1].strip()
                if prev.startswith("["):
                    start_idx = i - 1
                    break
    if start_idx is None:
        return None

    kept: list[str] = []
    for ln in lines[start_idx:]:
        stripped = ln.strip()
        if stripped and _XL_BASE_PLANNING_LINE_RE.match(stripped):
            if len(kept) >= 8 and any(re.search(r"[\u0400-\u04ff]{4,}", k) for k in kept):
                break
            continue
        if stripped.startswith("*") and not stripped.startswith("[") and len(kept) >= 8:
            low = stripped.lower()
            if any(x in low for x in ("wait", "let's", "check", "correction", "good).", "checked")):
                break
        kept.append(ln)

    body = "\n".join(kept).strip()
    if not body:
        return None
    cyr_lines = sum(1 for ln in body.splitlines() if re.search(r"[\u0400-\u04ff]{4,}", ln))
    if cyr_lines < 4:
        return None
    return body


def sanitize_lyrics_for_xl_base_comfy(text: str) -> str:
    """
    XL Base / XL SFT: lyrics для TextEncodeAceStepAudio1.5 — только песня, без CoT/planning.
    """
    s = sanitize_lyrics_ai_output(text or "")
    if not s:
        return s
    signals = len(_XL_BASE_PLANNING_SIGNAL_RE.findall(s))
    cyr_lines = sum(1 for ln in s.splitlines() if re.search(r"[\u0400-\u04ff]{4,}", ln))
    if signals >= 2 or (signals >= 1 and cyr_lines < 8):
        extracted = _extract_xl_base_song_from_planning_leak(s)
        s = extracted if extracted else _strip_xl_base_planning_lines(s)
    elif signals >= 1:
        s = _strip_xl_base_planning_lines(s)
    s = normalize_lyrics_sections_for_ace_comfy(s)
    return s.strip()


def coerce_enriched_arrangement_bpm_lines(lyrics: str, bpm: int) -> str:
    """
    Согласовать текст лирики с полем bpm, которое уходит в Comfy (узел 94).

    Иначе LLM часто пишет в enriched-заголовках «70 BPM feel», а пользователь/пресет
    задают другой темп — ACE ориентируется на текст, и слышно «залипание» на одном BPM.

    Обрабатываем:
    - строки «(Arrangement: … NNN BPM …)»;
    - целые строки-заголовки «[Section: … NNN BPM …]» (контракт enriched sections).
    """
    b = max(10, min(300, int(bpm)))
    lines: list[str] = []
    for line in (lyrics or "").splitlines():
        if re.match(r"^\s*\(Arrangement:", line, re.I):
            line = re.sub(r"\b\d{2,3}\s*BPM\b", f"{b} BPM", line, flags=re.I)
        elif _SECTION_HEADER_RE.match(line.strip()) and _SECTION_BPM_RE.search(line):
            line = _SECTION_BPM_RE.sub(f"{b} BPM feel", line)
        lines.append(line)
    return "\n".join(lines)


def _line_is_section_header(line: str) -> bool:
    return bool(_SECTION_HEADER_RE.match(line.strip()))


def _line_is_music_annotation(line: str) -> bool:
    """
    Rich lyrics allow short parenthetical notes after section headers:
    (Voice: female, dreamy, light reverb)
    """
    s = line.strip()
    if not (s.startswith("(") and s.endswith(")")):
        return False
    inner = s[1:-1].strip().lower()
    if not inner:
        return False
    if inner.startswith("voice:") or inner.startswith("vocal:"):
        return True
    music_markers = (
        " bpm",
        "reverb",
        "delay",
        "sidechain",
        "breakbeat",
        "drum",
        "bass",
        "pad",
        "synth",
        "transition",
        "fx",
    )
    return any(m in inner for m in music_markers)


def _line_is_latin_prose_with_enough_words(raw: str) -> bool:
    """
    Англ. строка из нескольких слов часто даёт низкую «уникальность букв» без пробелов
    (поэтика, повторы слогов вроде I've / I am / I'll) — это не гиббериш.
    """
    if len(raw) < 24:
        return False
    letters = [c for c in raw if c.isalpha()]
    if len(letters) < 18:
        return False
    latin = sum(1 for c in letters if "a" <= c.lower() <= "z")
    if latin / len(letters) < 0.85:
        return False
    parts = [p for p in re.split(r"\s+", raw) if p.strip()]
    if len(parts) < 6:
        return False
    # Отсекаем «ka ka ka ka ka ka» — слишком короткие «слова».
    return sum(1 for p in parts if len(re.sub(r"[^A-Za-z']+", "", p)) >= 2) >= 5


def _line_looks_like_gibberish(line: str) -> bool:
    """Эвристика «строка похожа на бессмысленные слоги / повторы», без NLP."""
    raw = line.strip()
    if len(raw) < 12:
        return False
    if _line_is_section_header(raw):
        return False
    if _line_is_music_annotation(raw):
        return False
    if raw.startswith("(") and raw.endswith(")"):
        return len(raw) > 160
    # Обычная кириллическая фраза из нескольких слов: низкая «уникальность букв» — норма, не гиббериш.
    cyr = sum(1 for c in raw if "\u0400" <= c <= "\u04ff")
    if cyr >= 18 and raw.count(" ") >= 3 and len(raw) >= 28:
        return False
    if _line_is_latin_prose_with_enough_words(raw):
        return False
    compact = re.sub(r"\s+", "", raw)
    if len(compact) < 14:
        return False
    if _REPEAT_GIBBERISH_RE.search(compact):
        return True
    ratio = len(set(compact.lower())) / len(compact)
    if len(compact) >= 20 and ratio < 0.34:
        return True
    # Одно «слово» на всю строку, очень длинное и однообразное
    for m in _LOW_DIVERSITY_WORD_RE.finditer(raw):
        w = m.group(0)
        if len(w) >= 18 and len(set(w.lower())) / len(w) < 0.38:
            return True
    return False


def validate_lyrics_for_music(lyrics: str) -> dict[str, Any]:
    """
    Возвращает ok=True если нет blocking errors.
    errors — блокируют генерацию; warnings — только предупреждение в UI.
    Всегда возвращает normalized_lyrics (после sanitize) и lyrics_were_normalized.
    """
    raw_for_compare = (lyrics or "").strip()
    text = sanitize_lyrics_ai_output(lyrics or "")
    lyrics_were_normalized = text != raw_for_compare
    lines = text.splitlines()
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []

    # Пустые секции; два одинаковых заголовка подряд (без текста между)
    for i, line in enumerate(lines):
        stripped = line.strip()
        m = _SECTION_HEADER_RE.match(stripped)
        if not m:
            continue
        parsed = parse_music_section_header(stripped)
        sec = parsed["section_name_raw"] if parsed else m.group(1).strip()
        j = i + 1
        while j < len(lines) and not lines[j].strip():
            j += 1
        if j >= len(lines):
            warnings.append(
                {
                    "code": "empty_section_at_eof",
                    "line": i + 1,
                    "message": f"Секция [{sec}] в конце текста без строк под ней.",
                }
            )
            continue
        nxt = lines[j].strip()
        nxt_m = _SECTION_HEADER_RE.match(nxt)
        if nxt_m:
            nxt_parsed = parse_music_section_header(nxt)
            nsec = nxt_parsed["section_name_raw"] if nxt_parsed else nxt_m.group(1).strip()
            sec_key = _normalize_section_outline_key(sec)
            nsec_key = _normalize_section_outline_key(nsec)
            if nsec_key == sec_key:
                warnings.append(
                    {
                        "code": "duplicate_section_header",
                        "line": j + 1,
                        "message": f"Два заголовка [{sec}] подряд без текста между — удалите лишний или добавьте строки.",
                    }
                )
            else:
                warnings.append(
                    {
                        "code": "empty_section",
                        "line": i + 1,
                        "message": f"Секция [{sec}] без текста: сразу идёт [{nsec}].",
                    }
                )

    # ACE Step: метки [section] — латинские имена структуры; кириллица внутри [] читается как текст, не как слот секции.
    for i, line in enumerate(lines):
        stripped = line.strip()
        m = _SECTION_HEADER_RE.match(stripped)
        if not m:
            continue
        parsed = parse_music_section_header(stripped)
        sec_name = parsed["section_name_raw"] if parsed else m.group(1).strip()
        if any("\u0400" <= c <= "\u04ff" for c in sec_name):
            errors.append(
                {
                    "code": "section_header_not_english",
                    "line": i + 1,
                    "message": (
                        f"В метке «[{sec_name}]» есть кириллица. Для генерации музыки заголовки секций только на английском: "
                        "[Intro], [Verse], [Chorus], [Bridge], [Outro], [Hook] — смысл пишите в строках ниже."
                    ),
                }
            )

    # Строки-каракули
    for i, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        if _line_is_section_header(line):
            continue
        if _line_looks_like_gibberish(line):
            preview = line.strip()[:100]
            errors.append(
                {
                    "code": "gibberish_line",
                    "line": i,
                    "message": "Строка похожа на бессмысленные слоги или механические повторы — замените на нормальные слова.",
                    "preview": preview,
                }
            )

    # Длинная сценическая ремарка в ()
    for i, line in enumerate(lines, start=1):
        s = line.strip()
        if s.startswith("(") and s.endswith(")") and len(s) > 130:
            warnings.append(
                {
                    "code": "long_parenthetical",
                    "line": i,
                    "message": "Очень длинный текст в круглых скобках — модель может прочитать как длинный бэк-вокал; сократите или вынесите в [ ].",
                }
            )

    # Англ. фразы продакшна в строках текста (не заголовки секций)
    for i, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        if _line_is_section_header(line):
            continue
        if _line_is_music_annotation(line):
            continue
        low = line.lower()
        for ph in _PRODUCTION_PHRASES_EN:
            if ph in low:
                errors.append(
                    {
                        "code": "sound_effect_in_lyrics",
                        "line": i,
                        "message": (f"В тексте фраза продакшна («{ph}») — перенесите в теги звучания, не в lyrics."),
                        "preview": line.strip()[:120],
                    }
                )
                break

    # Намёки на описание микса по-русски — предупреждение
    for i, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        if _line_is_section_header(line):
            continue
        if _line_is_music_annotation(line):
            continue
        low = line.lower()
        for hint in _ARRANGEMENT_HINTS_RU:
            if hint in low:
                warnings.append(
                    {
                        "code": "arrangement_hint_in_lyrics",
                        "line": i,
                        "message": (
                            f"Похоже на описание микса («{hint}»). Обычно это в поле тегов звучания, не в тексте песни."
                        ),
                    }
                )
                break

    # Слова-штампы про «ритмы/звуки/такты» (предупреждение; в auto-пайплайне чистятся post-process).
    for i, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        if _line_is_section_header(line):
            continue
        if _line_is_music_annotation(line):
            continue
        low = line.lower()
        for pat, _repl in _FORBIDDEN_META_MUSIC_WORD_PATTERNS_RU:
            if re.search(pat, low, flags=re.IGNORECASE):
                warnings.append(
                    {
                        "code": "forbidden_meta_music_word",
                        "line": i,
                        "message": (
                            "В тексте есть штамп про «ритмы/звуки/такты». Замените на сюжетные слова и действия героя."
                        ),
                        "preview": line.strip()[:120],
                    }
                )
                break

    ok = len(errors) == 0
    return {
        "ok": ok,
        "errors": errors,
        "warnings": warnings,
        "errors_count": len(errors),
        "warnings_count": len(warnings),
        "normalized_lyrics": text,
        "lyrics_were_normalized": lyrics_were_normalized,
    }
