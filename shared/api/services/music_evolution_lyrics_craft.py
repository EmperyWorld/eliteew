# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Russian lyrics craft blocks, Evolution-specific length gates, and post-LLM scrub for Music Evolution.
# Invariants:
# - Evolution min sung lines are stricter than studio XL Base defaults; studio thresholds unchanged.
# - Morphology rules reuse studio canon without duplicating prose.
# Related:
# - api/services/music_evolution_prompts.py
# - api/services/music_evolution_pipeline.py
# - api/routers/music_lyrics_validation.py
# ---
"""Lyrics craft and validation for Music Evolution XL Base."""

from __future__ import annotations

import re
from typing import Any

from api.routers.music_generator import (
    LYRICS_ABSOLUTE_TABOO_WORDS_RU,
    LYRICS_MORPHOLOGY_AND_STRESS_RU,
    LYRICS_NO_CLICHE_PHRASES_RU,
    LYRICS_NO_META_ABOUT_WRITING_RU,
)
from api.routers.music_lyrics_validation import (
    enforce_lyrics_vocal_gender_consistency,
    parse_music_section_header,
    scrub_forbidden_meta_music_words,
)
from api.services.music_evolution_soloists import resolve_soloist_id
from api.services.music_generator_xl_base_pipeline import (
    _LLM_REWRITE_TAIL_RE,
    _SECTION_HEADER_LINE_RE,
    XL_BASE_MIN_CYRILLIC_SUNG_LINES,
    XL_BASE_MIN_SUNG_LINES,
    count_sung_content_lines,
    strip_llm_rewrite_tail_from_lyrics,
)

MUSIC_EVOLUTION_MIN_SUNG_LINES = 10
MUSIC_EVOLUTION_MIN_CYRILLIC_SUNG_LINES = 8

_RETRYABLE_CODES = frozenset(
    {
        "lyrics_skeleton_only",
        "lyrics_insufficient_russian_content",
        "lyrics_atya_broken_russian_phrase",
        "lyrics_atya_weak_cliche_phrase",
        "lyrics_atya_missing_children_choir",
        "lyrics_atya_weak_children_choir",
        "lyrics_atya_forced_reference_hook",
        "lyrics_atya_hook_overrepeat",
        "lyrics_atya_choir_duplicates_hook",
        "lyrics_atya_duplicate_section_block",
        "lyrics_atya_json_leak",
        "lyrics_lula_weak_cliche_phrase",
        "lyrics_lula_copied_reference_phrase",
        "lyrics_lula_missing_scene_detail",
        "lyrics_lula_hook_overrepeat",
        "lyrics_lula_duplicate_section_block",
    }
)

ATYA_REFERENCE_HOOK_PHRASE = "нас больше не будет"

_LULA_SCENE_DETAIL_RE = re.compile(
    r"(ноч|неон|комнат|окн|стекл|зеркал|балкон|подъезд|лифт|такси|санатор|коридор|"
    r"кассет|магнитофон|лента|плёнк|пленк|радио|кухн|дым|пепел|ламп|штор|простын|город|улиц)",
    re.I,
)
_LULA_WEAK_CLICHE_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\bмоя\s+душа\s+(летит|парит|горит)\b", re.I), "абстрактная строка без сцены"),
    (re.compile(r"\bсердце\s+бь[её]тся\s+в\s+такт\b", re.I), "поп-клише вместо личной детали"),
    (re.compile(r"\bкрылья\s+за\s+спиной\b", re.I), "мотивационное клише"),
    (re.compile(r"\bдорог[ауы]\s+к\s+мечт[еы]\b", re.I), "лозунг вместо интимной сцены"),
    (re.compile(r"\bв\s+свет\s+своей\s+мечт[ыа]\b", re.I), "абстрактная мотивационная формула"),
    (re.compile(r"\bмы\s+летим\s+к\s+мечт[еы]\b", re.I), "generic pop uplift"),
    (re.compile(r"\bя\s+сильн[аый]\s+и\s+свободн[аый]\b", re.I), "прямой лозунг без образа"),
)
_LULA_COPIED_REFERENCE_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\bя\s+королева\s+миров\b", re.I), "не копировать известную референсную строку"),
    (re.compile(r"\bfree\s+love\b", re.I), "не вставлять название референсного трека"),
    (re.compile(r"\bостров\s+свобод[ыа]\b", re.I), "не копировать название/образ референсного альбома"),
)

_ATYA_STORM_ANCHOR_RE = re.compile(
    r"(ветер|шторм|бур[яи]|гром|неб[ао]|ураган|волна|ток|разряд|выше|рв[её]т|"
    r"wind|storm|thunder|sky|above|higher|cloud|rain)",
    re.I,
)
_ATYA_JSON_LEAK_LINE_RE = re.compile(r'^\s*[\[\{].*["\'].*[\]\}]\s*$')
_ATYA_BROKEN_RU_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\bвс[её]\s+внутри\s+меня\s+так\s+не\s+хотел", re.I), "сломанное согласование желания"),
    (re.compile(r"\bпусту[а-яё]*\s+страх\b", re.I), "несогласованный род/падеж со словом «страх»"),
    (re.compile(r"\bм[её]ртву[а-яё]*\s+[^\n]{0,24}\bстрах\b", re.I), "несогласованный образ со словом «страх»"),
    (re.compile(r"\bповозк[а-яё]*\b", re.I), "случайный предмет вне storm/DnB образа Ати"),
    (re.compile(r"\bи\s+нам\s+не\s+будет\b", re.I), "обрыв фразы без грамматического завершения"),
    (re.compile(r"\bв\s+меня\s+влилась\b", re.I), "неестественное управление глагола"),
)
_ATYA_WEAK_CLICHE_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\bвот\s+так,\s*вот\s+так\b", re.I), "пустой заполнитель вместо hook"),
    (re.compile(r"\bпыль\s+и\s+прах\b", re.I), "избитое клише без конкретного действия"),
    (re.compile(r"\bнебесн[а-яё]*\s+покров\b", re.I), "архаичный штамп вместо клубного storm-образа"),
    (re.compile(r"\bфундамент\s+дал\b", re.I), "канцелярская метафора вместо живой строки"),
)


def evolution_lyrics_length_prompt_block(*, language: str) -> str:
    """Length/structure requirements for Evolution lyrics generation."""
    lang = (language or "ru").strip().lower()
    base = (
        f" Минимум {MUSIC_EVOLUTION_MIN_SUNG_LINES} осмысленных строк для пения; "
        "структура: 2 куплета + припев + опциональный bridge. "
        "Строки по 5–10 слов, певучие, не односложные. "
        "Развивай образ между куплетами, не повторяй один припев дословно больше двух раз."
    )
    if lang.startswith("ru"):
        base += f" Для русского языка — не менее {MUSIC_EVOLUTION_MIN_CYRILLIC_SUNG_LINES} строк с кириллицей."
    return base


def evolution_lyrics_system_craft_block(*, language: str, soloist_id: str | None) -> str:
    """Morphology/cliche craft appended to lyrics system prompt."""
    lang = (language or "ru").strip().lower()
    sid = resolve_soloist_id(soloist_id)
    blocks = [evolution_lyrics_length_prompt_block(language=language)]
    if lang.startswith("ru"):
        blocks.extend(
            [
                LYRICS_MORPHOLOGY_AND_STRESS_RU,
                LYRICS_NO_CLICHE_PHRASES_RU,
                LYRICS_NO_META_ABOUT_WRITING_RU,
                LYRICS_ABSOLUTE_TABOO_WORDS_RU,
            ]
        )
    if sid == "tempest":
        blocks.append(
            " Дуэт Шторм: drum and bass 170–176 BPM. Чередуй (Male) и (Female) строки в куплетах; "
            "в припеве (Both) на «мы». Rolling breakbeat, reese bass; без детского хора как lead."
        )
    if sid == "nebula":
        blocks.append(
            " Солистка Туманность (Nebula): Luna dream lane — vaporwave lo-fi haze, trip-hop pulse, "
            "и psychedelic melancholy, "
            "а не набором красивых слов. Пиши простыми фразами как близкий полушёпот у микрофона: интимно, сонно, "
            "меланхолично, слегка отстранённо. Обязательна конкретная ночная/домашняя 90s-сцена: комната, окно, стекло, "
            "подъезд, лифт, такси, санаторный коридор, кассета, магнитофон, неон, дым, лампа — выбери 2–4 детали и развивай их. "
            "Арка: [Verse 1] показывает сцену, [Pre-Chorus] — внутреннее качание, [Chorus] — короткая наивная мантра свободы "
            "из темы пользователя, [Verse 2] меняет взгляд/решение, [Bridge] — тихий ночной поворот. "
            "Запрещены пустые лозунги и абстрактный поп: «моя душа летит», «сердце бьётся в такт», «крылья за спиной», "
            "«мы летим к мечте», «я сильная и свободная» без конкретной сцены. "
            "Не копируй реальные строки/названия референсов вроде «Я королева миров», Free Love, «Остров свободы». "
            "Строки (Arrangement: …) и (Voice: …) сервер добавит сам — не пиши их в ответе LLM."
        )
    return "".join(blocks)


def _is_sung_line(line: str) -> bool:
    stripped = line.strip()
    return bool(
        stripped
        and not _SECTION_HEADER_LINE_RE.match(stripped)
        and not (stripped.startswith("(") and stripped.endswith(")"))
    )


def _append_atya_quality_error(
    errors: list[dict[str, Any]],
    *,
    code: str,
    line_no: int,
    line: str,
    reason: str,
) -> None:
    if sum(1 for error in errors if error.get("code") == code) >= 4:
        return
    errors.append(
        {
            "code": code,
            "line": line_no,
            "fragment": line[:120],
            "message": f"Атя: {reason}; перепиши строку естественным русским языком.",
        }
    )


def _theme_mentions_atya_reference_hook(theme: str) -> bool:
    return ATYA_REFERENCE_HOOK_PHRASE in (theme or "").lower().replace("ё", "е")


def _extract_labeled_section_blocks(text: str) -> list[tuple[str, str]]:
    blocks: list[tuple[str, str]] = []
    current_label = ""
    current: list[str] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        header = _SECTION_HEADER_LINE_RE.match(line)
        if header:
            if current_label and current:
                blocks.append((current_label, "\n".join(current).strip()))
            parsed = parse_music_section_header(line)
            current_label = str(parsed["section_name_raw"] if parsed else line.strip("[]"))
            current = []
            continue
        if line:
            current.append(line)
    if current_label and current:
        blocks.append((current_label, "\n".join(current).strip()))
    return [(label, block) for label, block in blocks if block]


def _validate_atya_lyrics_quality(text: str, errors: list[dict[str, Any]], *, theme: str = "") -> None:
    choir_lines: list[tuple[int, str]] = []
    sung_lines: list[tuple[int, str]] = []
    for line_no, raw_line in enumerate(text.splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue
        line_low = line.lower().replace("ё", "е")
        if _ATYA_JSON_LEAK_LINE_RE.match(line):
            _append_atya_quality_error(
                errors,
                code="lyrics_atya_json_leak",
                line_no=line_no,
                line=line,
                reason="в lyrics попал JSON/массив recipe вместо строк для пения",
            )
            continue
        if line.startswith("(") and line.endswith(")") and re.search(r"children\s+choir|детск\w*\s+хор", line, re.I):
            choir_lines.append((line_no, line))
            if not _ATYA_STORM_ANCHOR_RE.search(line_low):
                _append_atya_quality_error(
                    errors,
                    code="lyrics_atya_weak_children_choir",
                    line_no=line_no,
                    line=line,
                    reason="детский хор должен отвечать storm-образом, а не абстрактными словами",
                )
            if ATYA_REFERENCE_HOOK_PHRASE in line_low and not _theme_mentions_atya_reference_hook(theme):
                _append_atya_quality_error(
                    errors,
                    code="lyrics_atya_choir_duplicates_hook",
                    line_no=line_no,
                    line=line,
                    reason="детский хор не должен повторять чужую эталонную фразу adult hook",
                )
            continue
        if not _is_sung_line(line):
            continue
        sung_lines.append((line_no, line))
        for pattern, reason in _ATYA_BROKEN_RU_PATTERNS:
            if pattern.search(line_low):
                _append_atya_quality_error(
                    errors,
                    code="lyrics_atya_broken_russian_phrase",
                    line_no=line_no,
                    line=line,
                    reason=reason,
                )
                break
        for pattern, reason in _ATYA_WEAK_CLICHE_PATTERNS:
            if pattern.search(line_low):
                _append_atya_quality_error(
                    errors,
                    code="lyrics_atya_weak_cliche_phrase",
                    line_no=line_no,
                    line=line,
                    reason=reason,
                )
                break
    if not _theme_mentions_atya_reference_hook(theme):
        for line_no, line in sung_lines:
            if ATYA_REFERENCE_HOOK_PHRASE in line.lower().replace("ё", "е"):
                _append_atya_quality_error(
                    errors,
                    code="lyrics_atya_forced_reference_hook",
                    line_no=line_no,
                    line=line,
                    reason="чужая эталонная фраза не из темы пользователя",
                )
                break
    line_counts: dict[str, int] = {}
    for _line_no, line in sung_lines:
        key = line.lower().replace("ё", "е")
        line_counts[key] = line_counts.get(key, 0) + 1
    for line_no, line in sung_lines:
        if line_counts.get(line.lower().replace("ё", "е"), 0) >= 3:
            _append_atya_quality_error(
                errors,
                code="lyrics_atya_hook_overrepeat",
                line_no=line_no,
                line=line,
                reason="одна и та же строка повторяется слишком часто; варьируй припев",
            )
            break
    blocks = _extract_labeled_section_blocks(text)
    seen_blocks: dict[str, int] = {}
    for label, block in blocks:
        if label.strip().lower().startswith("chorus"):
            continue
        key = block.lower().replace("ё", "е")
        seen_blocks[key] = seen_blocks.get(key, 0) + 1
        if seen_blocks[key] >= 2 and len(block.splitlines()) >= 3:
            _append_atya_quality_error(
                errors,
                code="lyrics_atya_duplicate_section_block",
                line_no=1,
                line=block.splitlines()[0],
                reason="секции скопированы дословно; перепиши второй блок с новым развитием",
            )
            break
    if not choir_lines:
        errors.append(
            {
                "code": "lyrics_atya_missing_children_choir",
                "message": "Атя: нужен хотя бы один фоновый подпев детского хора в [Chorus] или [Bridge].",
            }
        )


def _append_lula_quality_error(
    errors: list[dict[str, Any]],
    *,
    code: str,
    line_no: int,
    line: str,
    reason: str,
) -> None:
    if sum(1 for error in errors if error.get("code") == code) >= 4:
        return
    errors.append(
        {
            "code": code,
            "line": line_no,
            "fragment": line[:120],
            "message": f"Lula: {reason}; перепиши строку конкретнее и интимнее.",
        }
    )


def _validate_lula_lyrics_quality(text: str, errors: list[dict[str, Any]]) -> None:
    sung_lines: list[tuple[int, str]] = []
    scene_hits = 0
    for line_no, raw_line in enumerate(text.splitlines(), start=1):
        line = raw_line.strip()
        if not line or not _is_sung_line(line):
            continue
        sung_lines.append((line_no, line))
        if _LULA_SCENE_DETAIL_RE.search(line):
            scene_hits += 1
        line_low = line.lower().replace("ё", "е")
        for pattern, reason in _LULA_COPIED_REFERENCE_PATTERNS:
            if pattern.search(line_low):
                _append_lula_quality_error(
                    errors,
                    code="lyrics_lula_copied_reference_phrase",
                    line_no=line_no,
                    line=line,
                    reason=reason,
                )
                break
        for pattern, reason in _LULA_WEAK_CLICHE_PATTERNS:
            if pattern.search(line_low):
                _append_lula_quality_error(
                    errors,
                    code="lyrics_lula_weak_cliche_phrase",
                    line_no=line_no,
                    line=line,
                    reason=reason,
                )
                break
    if len(sung_lines) >= MUSIC_EVOLUTION_MIN_SUNG_LINES and scene_hits < 2:
        errors.append(
            {
                "code": "lyrics_lula_missing_scene_detail",
                "message": (
                    "Lula: нужен минимум две конкретные 90s/night-scene детали "
                    "(комната/окно/стекло/подъезд/такси/кассета/неон и т.п.), а не абстракции."
                ),
            }
        )
    line_counts: dict[str, int] = {}
    for _line_no, line in sung_lines:
        key = re.sub(r"\s+", " ", line.lower().replace("ё", "е")).strip()
        line_counts[key] = line_counts.get(key, 0) + 1
    for line_no, line in sung_lines:
        key = re.sub(r"\s+", " ", line.lower().replace("ё", "е")).strip()
        if line_counts.get(key, 0) >= 3:
            _append_lula_quality_error(
                errors,
                code="lyrics_lula_hook_overrepeat",
                line_no=line_no,
                line=line,
                reason="одна строка повторяется слишком часто; Lula-хук должен быть мантрой, но не копипастой",
            )
            break
    blocks = _extract_labeled_section_blocks(text)
    seen_blocks: dict[str, int] = {}
    for label, block in blocks:
        if label.strip().lower().startswith("chorus"):
            continue
        key = block.lower().replace("ё", "е")
        seen_blocks[key] = seen_blocks.get(key, 0) + 1
        if seen_blocks[key] >= 2 and len(block.splitlines()) >= 3:
            _append_lula_quality_error(
                errors,
                code="lyrics_lula_duplicate_section_block",
                line_no=1,
                line=block.splitlines()[0],
                reason="секции скопированы дословно; второй куплет должен развивать смысл",
            )
            break


def _strip_atya_json_leak_lines(text: str) -> str:
    kept: list[str] = []
    for line in (text or "").splitlines():
        stripped = line.strip()
        if _ATYA_JSON_LEAK_LINE_RE.match(stripped):
            continue
        kept.append(line)
    return "\n".join(kept).strip()


def polish_evolution_lyrics(
    lyrics: str,
    *,
    vocal_effective: str,
    language: str,
    soloist_id: str | None = None,
) -> str:
    """Post-LLM scrub: gender consistency + forbidden meta words + rewrite tails."""
    text = strip_llm_rewrite_tail_from_lyrics(lyrics or "")
    if (soloist_id or "").strip().lower() in {"atya", "aurora"}:
        text = _strip_atya_json_leak_lines(text)
    v = (vocal_effective or "female").strip().lower()
    if v in {"female", "male"}:
        text, _ = enforce_lyrics_vocal_gender_consistency(text, vocal=v, language=language)
    text, _changed, _hits = scrub_forbidden_meta_music_words(text, language=language)
    return text.strip()


def validate_music_evolution_lyrics_substance(
    lyrics: str,
    *,
    language: str = "ru",
    soloist_id: str | None = None,
    theme: str | None = None,
) -> list[dict[str, Any]]:
    """Evolution-specific lyrics gate — stricter sung-line thresholds than studio XL Base."""
    errors: list[dict[str, Any]] = []
    text = (lyrics or "").strip()
    if not text:
        errors.append({"code": "lyrics_empty", "message": "Текст песни пустой."})
        return errors

    if _LLM_REWRITE_TAIL_RE.search(text) or re.search(r"\(Better\)\.\s*$", text, re.I | re.M):
        errors.append(
            {
                "code": "llm_rewrite_tail_in_lyrics",
                "message": "В lyrics остались служебные правки LLM («-> … (Better)»).",
            }
        )

    sung_total, sung_cyr = count_sung_content_lines(text, language=language)
    section_count = len(_SECTION_HEADER_LINE_RE.findall(text))
    if section_count >= 2 and sung_total < MUSIC_EVOLUTION_MIN_SUNG_LINES:
        errors.append(
            {
                "code": "lyrics_skeleton_only",
                "message": (
                    f"Слишком мало строк для пения ({sung_total}, нужно ≥{MUSIC_EVOLUTION_MIN_SUNG_LINES}). "
                    "Добавь куплеты и припев."
                ),
            }
        )
    lang = (language or "ru").strip().lower()
    if lang.startswith("ru") and section_count >= 2 and sung_cyr < MUSIC_EVOLUTION_MIN_CYRILLIC_SUNG_LINES:
        errors.append(
            {
                "code": "lyrics_insufficient_russian_content",
                "message": (f"Мало русских строк ({sung_cyr}, нужно ≥{MUSIC_EVOLUTION_MIN_CYRILLIC_SUNG_LINES})."),
            }
        )

    lines = text.splitlines()
    for i, line in enumerate(lines):
        if not _SECTION_HEADER_LINE_RE.match(line.strip()):
            continue
        parsed = parse_music_section_header(line.strip())
        sec = parsed["section_name_raw"] if parsed else line.strip()
        j = i + 1
        while j < len(lines) and not lines[j].strip():
            j += 1
        if j >= len(lines):
            continue
        nxt = lines[j].strip()
        if _SECTION_HEADER_LINE_RE.match(nxt) or (
            nxt.startswith("(")
            and nxt.endswith(")")
            and j + 1 < len(lines)
            and _SECTION_HEADER_LINE_RE.match(lines[j + 1].strip() if j + 1 < len(lines) else "")
        ):
            k = j
            has_sung = False
            while k < len(lines):
                probe = lines[k].strip()
                if _SECTION_HEADER_LINE_RE.match(probe):
                    break
                if (
                    not probe.startswith("[")
                    and not (probe.startswith("(") and probe.endswith(")"))
                    and len(probe) >= 3
                ):
                    has_sung = True
                    break
                k += 1
            if not has_sung:
                sec_low = (sec or "").strip().lower()
                if sec_low.startswith("intro") and sung_total >= MUSIC_EVOLUTION_MIN_SUNG_LINES:
                    continue
                errors.append(
                    {
                        "code": "empty_section_xl_base",
                        "line": i + 1,
                        "message": f"Секция [{sec}] без текста для пения.",
                    }
                )
    explicit_soloist_id = (soloist_id or "").strip().lower()
    resolved_soloist_id = resolve_soloist_id(explicit_soloist_id) if explicit_soloist_id else ""
    if lang.startswith("ru") and resolved_soloist_id == "nebula":
        _validate_lula_lyrics_quality(text, errors)
    if lang.startswith("ru") and explicit_soloist_id in {"atya", "aurora"}:
        _validate_atya_lyrics_quality(text, errors, theme=theme or "")
    return errors


def evolution_lyrics_errors_retryable(errors: list[dict[str, Any]]) -> bool:
    codes = {str(e.get("code") or "") for e in errors}
    return bool(codes & _RETRYABLE_CODES)


def evolution_lyrics_retry_user_message(errors: list[dict[str, Any]]) -> str:
    """Focused Evolution retry nudge for craft-quality lyrics failures."""
    codes = {str(e.get("code") or "") for e in errors}
    parts: list[str] = []
    if any(code.startswith("lyrics_atya_") for code in codes):
        bad_lines = [
            str(error.get("fragment") or "").strip()
            for error in errors
            if str(error.get("code") or "").startswith("lyrics_atya_") and error.get("fragment")
        ][:4]
        parts.append(
            "КРИТИЧНО для Ати: перепиши весь lyrics заново живым русским языком. "
            "Проверяй род, число, падеж и управление глаголов. Не используй случайные бытовые предметы, "
            "обрывы фразы и заполнители. Хук только из темы пользователя; не вставляй «Нас больше не будет», "
            "если этого нет в теме. Детский хор — короткая другая storm-фраза, не дословный повтор adult hook."
        )
        if bad_lines:
            parts.append("Запрещённые строки из прошлого черновика, не повторять: " + " / ".join(bad_lines))
        if "lyrics_atya_missing_children_choir" in codes or "lyrics_atya_weak_children_choir" in codes:
            parts.append(
                "Добавь в [Chorus] или [Bridge] строку вида «(Children choir: выше неба, ветер рвёт)» "
                "с образом ветра/шторма/неба, не абстрактный набор слов."
            )
    if any(code.startswith("lyrics_lula_") for code in codes):
        bad_lines = [
            str(error.get("fragment") or "").strip()
            for error in errors
            if str(error.get("code") or "").startswith("lyrics_lula_") and error.get("fragment")
        ][:4]
        parts.append(
            "КРИТИЧНО для Lula: перепиши lyrics как интимную русскую dream/synth-pop песню, "
            "а не абстрактный поп. Нужны 2–4 конкретные детали ночной 90s-сцены "
            "(комната, окно, стекло, подъезд, такси, кассета, неон, санаторный коридор), "
            "короткий мантровый припев из темы пользователя и развитие между куплетами. "
            "Не копируй референсные строки/названия и не используй лозунги про душу/свет/миры без сцены."
        )
        if bad_lines:
            parts.append("Запрещённые строки из прошлого черновика, не повторять: " + " / ".join(bad_lines))
    return "\n\n".join(parts)


def studio_thresholds_note() -> str:
    """Document delta vs studio for operators/tests."""
    return (
        f"Evolution: sung≥{MUSIC_EVOLUTION_MIN_SUNG_LINES}, cyr≥{MUSIC_EVOLUTION_MIN_CYRILLIC_SUNG_LINES}; "
        f"Studio XL Base: sung≥{XL_BASE_MIN_SUNG_LINES}, cyr≥{XL_BASE_MIN_CYRILLIC_SUNG_LINES}"
    )
