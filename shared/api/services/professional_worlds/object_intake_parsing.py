# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Resilient parsing of Realtor object-intake JSON from UGS/model text (markdown fences, embedded JSON).
# Invariants:
# - Object-intake previews surface parse fallbacks via warnings rather than silently showing template defaults.
# Related:
# - api/services/professional_worlds/service.py
# ---

from __future__ import annotations

import json
import logging
import re
from collections.abc import Mapping
from typing import Any

logger = logging.getLogger(__name__)

_WARN_MODEL_NON_JSON = "[model_returned_non_json]"
_WARN_INTAKE_FALLBACK = "[intake_parse_fallback]"


def _strip_markdown_code_fences(text: str) -> str:
    """Remove a single leading fenced block (```lang ... ```) if present."""
    s = text.strip()
    if not s.startswith("```"):
        return s
    match = re.match(r"^```[a-zA-Z0-9_-]*\s*\r?\n(.*)\r?\n```\s*$", s, re.DOTALL)
    if match:
        return match.group(1).strip()
    s = re.sub(r"^```[a-zA-Z0-9_-]*\r?\n?", "", s)
    s = re.sub(r"\r?\n?```\s*$", "", s)
    return s.strip()


def _first_balanced_json_object(text: str) -> str | None:
    """Return the first top-level `{ ... }` slice with naive string/escape awareness, or None."""
    start = text.find("{")
    if start < 0:
        return None
    depth = 0
    in_string = False
    escape = False
    quote: str | None = None
    for i in range(start, len(text)):
        ch = text[i]
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif quote and ch == quote:
                in_string = False
                quote = None
            continue
        if ch in {'"', "'"}:
            in_string = True
            quote = ch
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


def _parse_json_with_intake_fallbacks(text_out: str) -> tuple[Any | None, str]:
    """Parse model output into a JSON value; strategy label is for logs/diagnostics."""
    raw = (text_out or "").strip()
    if not raw:
        return None, "empty"
    blob = _strip_markdown_code_fences(raw)
    primary_label = "fenced" if blob != raw else "direct"
    ordered: list[tuple[str, str]] = [(primary_label, blob)]
    brace = _first_balanced_json_object(blob)
    if brace and brace != blob:
        ordered.append(("substring", brace))
    for label, candidate in ordered:
        try:
            return json.loads(candidate), label
        except json.JSONDecodeError:
            continue
    if blob != raw:
        try:
            return json.loads(raw), "raw_outer"
        except json.JSONDecodeError:
            pass
        brace_raw = _first_balanced_json_object(raw)
        if brace_raw and brace_raw != blob:
            try:
                return json.loads(brace_raw), "substring_raw"
            except json.JSONDecodeError:
                pass
    return None, "failed"


def _lift_intake_property_wrapper(obj: Any) -> Any:
    """If UGS wrapped the intake object, unwrap stringified JSON or nested dicts with `property`."""
    if isinstance(obj, dict) and "property" in obj:
        return obj
    if not isinstance(obj, dict):
        return obj
    for value in obj.values():
        if not isinstance(value, str):
            continue
        chunk = value.strip()
        if not chunk.startswith("{"):
            continue
        try:
            inner = json.loads(chunk)
        except json.JSONDecodeError:
            inner = None
        if isinstance(inner, dict) and "property" in inner:
            return inner
    return obj


def _property_block_has_signals(prop: Mapping[str, Any]) -> bool:
    """True if the model supplied substantive fields beyond empty/null shells."""
    if not prop:
        return False
    title = str(prop.get("title") or "").strip()
    if title and title.casefold() != "новый объект".casefold():
        return True
    city_raw = prop.get("city")
    if city_raw is not None and str(city_raw).strip():
        cs = str(city_raw).strip()
        if cs.casefold() != "владивосток".casefold():
            return True
    for key in ("district", "address", "view"):
        val = prop.get(key)
        if val is None:
            continue
        if isinstance(val, str) and val.strip():
            return True
    if prop.get("price") not in (None, "", 0, 0.0):
        return True
    if prop.get("area_m2") not in (None, "", 0, 0.0):
        return True
    if prop.get("rooms") not in (None, "", 0):
        return True
    if prop.get("floor") not in (None, "", 0):
        return True
    if prop.get("total_floors") not in (None, "", 0):
        return True
    infra = prop.get("infrastructure")
    if isinstance(infra, list) and len(infra) > 0:
        return True
    facts = prop.get("facts")
    return bool(isinstance(facts, Mapping) and facts)


def extract_object_intake_text_from_ugs_result(result: Any, result_preview: Any | None = None) -> str:
    """Pick the best string blob for `parse_object_intake_result` from a heterogeneous UGS result."""
    if isinstance(result, str) and result.strip():
        return result.strip()
    if isinstance(result, dict):
        for key in ("text", "content", "result", "output", "message", "response"):
            val = result.get(key)
            if isinstance(val, str) and val.strip():
                return val.strip()
        for val in result.values():
            if not isinstance(val, str):
                continue
            chunk = val.strip()
            if not chunk.startswith("{"):
                continue
            if '"property"' not in chunk and "'property'" not in chunk:
                continue
            try:
                loaded = json.loads(chunk)
            except json.JSONDecodeError:
                continue
            if isinstance(loaded, dict) and "property" in loaded:
                return chunk
        if "property" in result:
            return json.dumps(result, ensure_ascii=False, default=str)
        return json.dumps(result, ensure_ascii=False, default=str)
    if isinstance(result_preview, str) and result_preview.strip():
        return result_preview.strip()
    return ""


def build_object_intake_prompt(source_text: str) -> str:
    """Build structured object extraction prompt."""
    return f"""
Ты — EliteEW Professional Worlds AI intake для риэлтора Владивостока.

Разбери сырой текст объявления по схеме ниже.

Схема:
{{
  "property": {{
    "title": "string",
    "property_type": "apartment|house|commercial|land|other",
    "deal_type": "sale|rent",
    "city": "string",
    "district": "string|null",
    "address": "string|null",
    "price": "number|null",
    "area_m2": "number|null",
    "rooms": "integer|null",
    "floor": "integer|null",
    "total_floors": "integer|null",
    "view": "string|null",
    "infrastructure": ["string"],
    "facts": {{}}
  }},
  "confidence": {{"field": 0.0}},
  "warnings": ["string"]
}}

Правила:
- Не выдумывай отсутствующие данные.
- Любые обещания доходности, юридической чистоты, ипотеки и инвест-выгоды добавь в warnings.
- Если город не указан, используй "Владивосток".

Сырой текст:
{source_text.strip()}
""".strip()


def parse_object_intake_result(
    text_out: str,
    source_text: str,
    *,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    """Parse AI JSON result and normalize into preview shape."""
    trimmed_out = (text_out or "").strip()
    parsed, strategy = _parse_json_with_intake_fallbacks(trimmed_out)
    parse_failed = parsed is None
    payload_any = {} if parse_failed else _lift_intake_property_wrapper(parsed)
    payload = payload_any if isinstance(payload_any, dict) else {}
    had_property_key = "property" in payload
    raw_property_block = payload.get("property") if had_property_key else {}
    raw_property_dict = raw_property_block if isinstance(raw_property_block, dict) else {}
    structural_fallback = parse_failed or not had_property_key
    empty_property_signal = bool(had_property_key) and not _property_block_has_signals(raw_property_dict)

    inject_model_non_json = parse_failed
    inject_schema_fallback = (not parse_failed and not had_property_key) or empty_property_signal

    property_data: dict[str, Any] = dict(raw_property_dict) if structural_fallback else raw_property_dict

    normalized = {
        "title": str(property_data.get("title") or "Новый объект").strip()[:220],
        "property_type": str(property_data.get("property_type") or "apartment")[:80],
        "deal_type": str(property_data.get("deal_type") or "sale")[:80],
        "city": str(property_data.get("city") or "Владивосток")[:120],
        "district": property_data.get("district"),
        "address": property_data.get("address"),
        "price": property_data.get("price"),
        "area_m2": property_data.get("area_m2"),
        "rooms": property_data.get("rooms"),
        "floor": property_data.get("floor"),
        "total_floors": property_data.get("total_floors"),
        "view": property_data.get("view"),
        "infrastructure": property_data.get("infrastructure") or [],
        "jtbd_context": {},
        "facts": property_data.get("facts") or {},
        "status": "draft",
    }
    confidence = payload.get("confidence") if isinstance(payload, dict) else {}
    warnings = payload.get("warnings") if isinstance(payload, dict) else []

    synth: list[str] = []
    if inject_model_non_json:
        synth.append(
            f"{_WARN_MODEL_NON_JSON} Ответ модели не удалось распарсить как JSON после извлечения текста.",
        )
    if inject_schema_fallback:
        hint = (
            "в JSON не было блока property"
            if had_property_key is False and not parse_failed
            else (
                "блок property пустой или без содержательных полей"
                if had_property_key
                else "парсер не восстановил структуру intake"
            )
        )
        synth.append(f"{_WARN_INTAKE_FALLBACK} Превью может показывать шаблонные значения: {hint}.")

    source_lower = source_text.lower()
    risk_keywords = ("доходность", "гарант", "юридически чист", "ипотек", "инвест")
    auto_warnings = [f"Проверь утверждение: {word}" for word in risk_keywords if word in source_lower]

    merged_warnings = list(
        dict.fromkeys(
            [
                *synth,
                *(warnings if isinstance(warnings, list) else []),
                *auto_warnings,
            ],
        ),
    )

    intake_fallback = bool(inject_model_non_json or inject_schema_fallback)
    intake_diagnostics: dict[str, Any] = {
        "parse_failed": parse_failed,
        "had_property_key": had_property_key,
        "empty_property_signal": empty_property_signal,
        "json_strategy": strategy,
        "intake_fallback": intake_fallback,
    }
    logger.info(
        "[STEP] professional_worlds.object_intake_parse idempotency_key=%s source_text_len=%s "
        "result_text_len=%s parse_failed=%s json_strategy=%s had_property_key=%s "
        "empty_property_signal=%s intake_parse_fallback=%s",
        idempotency_key or "-",
        len(source_text or ""),
        len(trimmed_out),
        parse_failed,
        strategy,
        had_property_key,
        empty_property_signal,
        intake_fallback,
    )

    return {
        "property": normalized,
        "confidence": confidence if isinstance(confidence, dict) else {},
        "warnings": merged_warnings,
        "source_text": source_text,
        "intake_diagnostics": intake_diagnostics,
    }
