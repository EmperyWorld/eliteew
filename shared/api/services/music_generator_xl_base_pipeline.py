# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   Серверная подготовка XL Base (v2_base): lyrics/tags перед Comfy, жёсткие инварианты контента;
#   assess + retry nudge для POST /music-generator/lyrics; tags pipeline; UGS observability (Phase 4).
# Invariants:
#   - Без достаточного sung-текста между секциями — ValueError (блок generate), не «пустой» Comfy.
#   - Seed в Comfy: wire ["109",0] → PrimitiveInt node 109; значение в inputs.value.
# Related:
#   - api/services/studio_comfy_workflows.py
#   - api/routers/music_lyrics_validation.py
# ---

from __future__ import annotations

import logging
import re
from typing import Any

from api.routers.music_lyrics_validation import (
    normalize_lyrics_sections_for_ace_comfy,
    parse_music_section_header,
    sanitize_lyrics_for_xl_base_comfy,
)

logger = logging.getLogger(__name__)

XL_BASE_MIN_SUNG_LINES = 6
XL_BASE_MIN_CYRILLIC_SUNG_LINES = 4

_SECTION_HEADER_LINE_RE = re.compile(r"^\s*\[([^\]]+)]\s*$", re.M)

_LLM_REWRITE_TAIL_RE = re.compile(
    r'^\s*["\u201c].*?\s*->\s*["\u201c].*?(?:\(Better\)|\(Correction\)|\(Wait\))\.?\s*$',
    re.I | re.S,
)

_LLM_REWRITE_TAIL_LOOSE_RE = re.compile(
    r"\s*->\s*[\"'].+?(?:\(Better\)|\(Correction\))\.\s*$",
    re.I | re.S,
)


def extract_comfy_seed_from_workflow(workflow: dict[str, Any]) -> int | None:
    """Реальный seed для KSampler/TextEncode: prompt.109.inputs.value (не wire id 109)."""
    node = workflow.get("109") if isinstance(workflow, dict) else None
    if not isinstance(node, dict):
        return None
    raw = node.get("inputs", {}).get("value")
    try:
        return int(raw) if raw is not None else None
    except (TypeError, ValueError):  # fmt: skip
        return None


def strip_llm_rewrite_tail_from_lyrics(text: str) -> str:
    """Убрать хвосты вида «"строка" -> "лучше" (Better).» из lyrics."""
    lines = (text or "").splitlines()
    while lines:
        tail = lines[-1].strip()
        if not tail:
            lines.pop()
            continue
        if _LLM_REWRITE_TAIL_RE.match(tail):
            lines.pop()
            continue
        cleaned = _LLM_REWRITE_TAIL_LOOSE_RE.sub("", tail).strip()
        if cleaned != tail:
            if cleaned:
                lines[-1] = cleaned
            else:
                lines.pop()
            continue
        break
    return "\n".join(lines).strip()


def _line_is_meta_lyrics_line(line: str) -> bool:
    s = (line or "").strip()
    if not s:
        return True
    if _SECTION_HEADER_LINE_RE.match(s):
        return True
    low = s.lower()
    if s.startswith("(") and s.endswith(")"):
        inner = low[1:-1].strip()
        if inner.startswith(("voice:", "vocal:", "arrangement:", "аранжировка:")):
            return True
    return False


def count_sung_content_lines(lyrics: str, *, language: str = "ru") -> tuple[int, int]:
    """
    Строки с текстом для пения (не заголовки / Voice / Arrangement).
    Returns (total_sung_lines, cyrillic_sung_lines).
    """
    lang = (language or "ru").strip().lower()
    total = 0
    cyr = 0
    for line in (lyrics or "").splitlines():
        if _line_is_meta_lyrics_line(line):
            continue
        s = line.strip()
        if len(s) < 3:
            continue
        total += 1
        if lang.startswith("ru") and re.search(r"[\u0400-\u04ff]{3,}", s):
            cyr += 1
    return total, cyr


def count_lyrics_section_headers(lyrics: str) -> int:
    """Count ACE section headers like ``[Verse 1]`` (for duration heuristics)."""
    return len(_SECTION_HEADER_LINE_RE.findall(lyrics or ""))


def validate_xl_base_lyrics_substance(
    lyrics: str,
    *,
    language: str = "ru",
) -> list[dict[str, Any]]:
    """Blocking errors для XL Base: skeleton-only lyrics, LLM rewrite tail."""
    errors: list[dict[str, Any]] = []
    text = (lyrics or "").strip()
    if not text:
        errors.append({"code": "lyrics_empty", "message": "Текст песни пустой."})
        return errors

    if _LLM_REWRITE_TAIL_RE.search(text) or re.search(r"\(Better\)\.\s*$", text, re.I | re.M):
        errors.append(
            {
                "code": "llm_rewrite_tail_in_lyrics",
                "message": "В lyrics остались служебные правки LLM («-> … (Better)»). Перегенерируйте или удалите вручную.",
            }
        )

    sung_total, sung_cyr = count_sung_content_lines(text, language=language)
    section_count = len(_SECTION_HEADER_LINE_RE.findall(text))
    if section_count >= 2 and sung_total < XL_BASE_MIN_SUNG_LINES:
        errors.append(
            {
                "code": "lyrics_skeleton_only",
                "message": (
                    f"Только заголовки секций и (Voice/Arrangement), без строк для пения "
                    f"({sung_total} sung lines, нужно ≥{XL_BASE_MIN_SUNG_LINES}). "
                    "Перегенерируйте lyrics или допишите куплеты."
                ),
            }
        )
    lang = (language or "ru").strip().lower()
    if lang.startswith("ru") and section_count >= 2 and sung_cyr < XL_BASE_MIN_CYRILLIC_SUNG_LINES:
        errors.append(
            {
                "code": "lyrics_insufficient_russian_content",
                "message": (
                    f"Мало русских строк песни ({sung_cyr}, нужно ≥{XL_BASE_MIN_CYRILLIC_SUNG_LINES}). "
                    "Модель получит пустой вокальный контент."
                ),
            }
        )

    # Пустые секции между заголовками — blocking для XL Base
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
            # meta-only block then next section
            k = j
            has_sung = False
            while k < len(lines):
                probe = lines[k].strip()
                if _SECTION_HEADER_LINE_RE.match(probe):
                    break
                if not _line_is_meta_lyrics_line(probe) and len(probe) >= 3:
                    has_sung = True
                    break
                k += 1
            if not has_sung:
                sec_low = (sec or "").strip().lower()
                if sec_low.startswith("intro") and sung_total >= XL_BASE_MIN_SUNG_LINES:
                    continue
                errors.append(
                    {
                        "code": "empty_section_xl_base",
                        "line": i + 1,
                        "message": f"Секция [{sec}] без текста для пения (XL Base блокирует generate).",
                    }
                )
    return errors


def prepare_xl_base_lyrics_for_comfy(
    lyrics: str,
    *,
    language: str = "ru",
    strict: bool = True,
) -> str:
    """
    Санитизация + нормализация lyrics для v2_base. strict=True → ValueError при skeleton/CoT.
    """
    s, errs, ok = assess_xl_base_lyrics_pipeline(lyrics, language=language)
    if strict and not ok:
        msg = "; ".join(e["message"] for e in errs[:3])
        raise ValueError(msg)
    return s


def assess_xl_base_lyrics_pipeline(
    lyrics: str,
    *,
    language: str = "ru",
) -> tuple[str, list[dict[str, Any]], bool]:
    """
    Нормализация lyrics для v2_base без raise.
    Returns (prepared_text, errors, ok_for_comfy).
    """
    s = sanitize_lyrics_for_xl_base_comfy(lyrics or "")
    s = strip_llm_rewrite_tail_from_lyrics(s)
    s = normalize_lyrics_sections_for_ace_comfy(s)
    s = s.strip()
    errs = validate_xl_base_lyrics_substance(s, language=language)
    return s, errs, len(errs) == 0


XL_BASE_LYRICS_RETRY_NUDGE_RU = (
    "КРИТИЧНО (XL Base): предыдущий черновик отклонён сервером — "
    "между секциями [Intro]/[Verse]/[Chorus] обязательны строки для пения на языке песни, "
    f"не менее {XL_BASE_MIN_SUNG_LINES} осмысленных строк; не только (Voice:) и (Arrangement:). "
    "Без служебных правок «-> … (Better)». Перепиши полный текст песни целиком."
)


def xl_base_lyrics_retry_user_message(errors: list[dict[str, Any]]) -> str:
    """User-turn для повторного вызова LLM после skeleton/CoT."""
    codes = {str(e.get("code") or "") for e in errors}
    parts = [XL_BASE_LYRICS_RETRY_NUDGE_RU]
    if "lyrics_skeleton_only" in codes:
        parts.append(
            f"Добавь куплеты и припев: минимум {XL_BASE_MIN_SUNG_LINES} строк текста для пения, не мета-описания."
        )
    if "lyrics_insufficient_russian_content" in codes:
        parts.append(
            f"Для русского языка нужно ≥{XL_BASE_MIN_CYRILLIC_SUNG_LINES} строк с кириллицей (слова для пения)."
        )
    if "llm_rewrite_tail_in_lyrics" in codes:
        parts.append("Убери хвосты вида «строка -> строка (Better)» — только финальный текст песни.")
    if "empty_section_xl_base" in codes:
        parts.append("В каждой секции между заголовком [Section] и следующей секцией должны быть строки для пения.")
    return "\n\n".join(parts)


def prepare_xl_base_tags_for_comfy(
    tags: str,
    *,
    style_key: str = "pop",
    bpm_hint: int | None = None,
    ace_workflow: str = "v2_base",
) -> str:
    """
    XL Base tags перед Comfy: merge/clean, dedupe Style vs genre, cap секций, score-compress до 1600.
    """
    from api.routers.music_generator_tag_finalize import (
        clean_and_merge_ace_tags_for_comfy,
        final_clean_ace_tags_for_comfy,
    )

    wf = (ace_workflow or "v2_base").strip().lower()
    sk = (style_key or "pop").strip().lower() or "pop"
    t = clean_and_merge_ace_tags_for_comfy(
        tags or "",
        style_key=sk,
        bpm_hint=bpm_hint,
        ace_workflow=wf,
    )
    t = final_clean_ace_tags_for_comfy(t, ace_workflow=wf, style_key=sk)
    logger.info(
        "[STEP] xl_base_tags prepared len=%s workflow=%s style=%s",
        len(t),
        wf,
        sk,
    )
    return t


def build_xl_base_input_observability(
    lyrics: str,
    tags: str,
    *,
    language: str = "ru",
) -> dict[str, Any]:
    """Метрики для generation_requests.input_data и content metadata (до Comfy)."""
    sung, cyr = count_sung_content_lines(lyrics, language=language)
    tags_text = tags or ""
    tag_section_count = len(re.findall(r"\[[^\]]+\]", tags_text))
    alert_zero = sung == 0
    if alert_zero:
        logger.error(
            "[STEP] xl_base_gate ALERT sung_lines=0 tags_len=%s (generate should have blocked)",
            len(tags_text),
        )
    return {
        "xl_base_lyrics_sung_lines": sung,
        "xl_base_lyrics_cyrillic_lines": cyr,
        "xl_base_tags_len": len(tags_text),
        "xl_base_tags_section_count": tag_section_count,
        "xl_base_alert_sung_lines_zero": alert_zero,
    }


def stamp_xl_base_observability_on_input_data(input_data: dict[str, Any], obs: dict[str, Any]) -> None:
    """Записать observability-поля в UGS input_data (→ generation_requests.input_data)."""
    for key, value in obs.items():
        if value is not None:
            input_data[key] = value


def stamp_xl_base_seed_on_input_data(input_data: dict[str, Any], seed_applied: int | None) -> None:
    if seed_applied is not None:
        input_data["xl_base_seed_applied"] = seed_applied


def log_xl_base_gate_passed(
    *,
    sung_lines: int | None,
    tags_len: int | None,
    seed_applied: int | None = None,
    tags_sections: int | None = None,
) -> None:
    logger.info(
        "[STEP] xl_base_gate passed sung_lines=%s tags_len=%s seed_applied=%s tags_sections=%s",
        sung_lines,
        tags_len,
        seed_applied,
        tags_sections,
    )


def build_xl_base_output_observability(
    input_data: dict[str, Any],
    workflow: dict[str, Any],
) -> dict[str, Any]:
    """Метаданные после сборки workflow (seed из node 109)."""
    seed_applied = extract_comfy_seed_from_workflow(workflow)
    out: dict[str, Any] = {}
    if seed_applied is not None:
        out["xl_base_seed_applied"] = seed_applied
    for key in (
        "xl_base_lyrics_sung_lines",
        "xl_base_lyrics_cyrillic_lines",
        "xl_base_tags_len",
        "xl_base_tags_section_count",
        "xl_base_alert_sung_lines_zero",
    ):
        if key in input_data:
            out[key] = input_data[key]
    return out


def merge_xl_base_observability_into_result_metadata(
    result: dict[str, Any],
    xl_obs: dict[str, Any],
) -> None:
    if not xl_obs:
        return
    meta = result.get("metadata")
    if not isinstance(meta, dict):
        meta = {}
        result["metadata"] = meta
    meta.update(xl_obs)


def persist_xl_base_observability_on_generation_request(
    request_input_data: dict[str, Any],
    xl_obs: dict[str, Any],
) -> dict[str, Any]:
    """Слить seed/alert в копию input_data для UPDATE generation_requests."""
    merged = dict(request_input_data)
    for key, value in xl_obs.items():
        if value is not None:
            merged[key] = value
    return merged


def extract_xl_base_obs_from_ugs_response(ugs_result: dict[str, Any]) -> dict[str, Any]:
    """Достать xl_base_* из ответа UGS (output_data.metadata или result.metadata)."""
    found: dict[str, Any] = {}

    def _collect_from(obj: Any) -> None:
        if not isinstance(obj, dict):
            return
        for key, value in obj.items():
            if isinstance(key, str) and key.startswith("xl_base_") and value is not None:
                found[key] = value
        meta = obj.get("metadata")
        if isinstance(meta, dict):
            for key, value in meta.items():
                if isinstance(key, str) and key.startswith("xl_base_") and value is not None:
                    found[key] = value

    _collect_from(ugs_result)
    _collect_from(ugs_result.get("result"))
    if isinstance(ugs_result.get("result"), dict):
        _collect_from(ugs_result["result"].get("result"))
    if isinstance(ugs_result.get("metadata"), dict):
        _collect_from(ugs_result["metadata"])
    return found
