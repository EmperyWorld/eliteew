# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pure helpers to coerce LLM-shaped dicts before Pydantic validation in marketing autofill.
# Invariants:
# - Funnel aliases are normalized before router-level Pydantic validation.
# Related:
# - api/routers/marketing_cabinet/document_autofill.py
# ---
"""Pure helpers to coerce LLM-shaped dicts before Pydantic validation (marketing autofill)."""

from __future__ import annotations

from typing import Any, overload


def _coerce_nonneg_int(value: object, *, default: int = 0) -> int:
    """LLM JSON often has null for funnel counters; Pydantic expects int ge=0."""
    if value is None:
        return default
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return max(0, value)
    if isinstance(value, float):
        return max(0, int(value))
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return default
        try:
            return max(0, int(float(s.replace(",", "."))))
        except ValueError:
            return default
    return default


def _coerce_single_funnel_stage_dict(entry: dict[str, Any]) -> dict[str, Any]:
    stage_row = dict(entry)
    if not str(stage_row.get("stage_name") or "").strip():
        for alt in ("name", "title", "label", "stage"):
            alt_val = stage_row.get(alt)
            if str(alt_val or "").strip():
                stage_row["stage_name"] = str(alt_val).strip()
                break
    for key in ("visitors", "conversions", "stage_order"):
        stage_row[key] = _coerce_nonneg_int(stage_row.get(key), default=0)
    return stage_row


def ensure_dict_name_from_aliases(
    item: dict[str, Any],
    *,
    alternate_keys: tuple[str, ...],
) -> dict[str, Any]:
    """Модели часто кладут название в title/label; превью и shape-фильтр ожидают name."""
    out = dict(item)
    if str(out.get("name") or "").strip():
        return out
    for key in alternate_keys:
        raw = out.get(key)
        if str(raw or "").strip():
            out["name"] = str(raw).strip()
            break
    return out


@overload
def normalize_funnel_draft_stages_field(data: dict[str, Any]) -> dict[str, Any]: ...


@overload
def normalize_funnel_draft_stages_field(data: object) -> object: ...


def normalize_funnel_draft_stages_field(data: object) -> object:
    """LLMs often return one stage object or use name/title instead of stage_name."""
    if not isinstance(data, dict):
        return data
    raw_stages = data.get("stages")
    if raw_stages is None:
        for key in ("funnel_steps", "steps", "funnelStages", "funnel_stages"):
            if data.get(key) is not None:
                raw_stages = data.get(key)
                break
    if raw_stages is None:
        return data
    out = dict(data)
    if isinstance(raw_stages, dict):
        out["stages"] = [_coerce_single_funnel_stage_dict(raw_stages)]
    elif isinstance(raw_stages, list):
        normalized_stages: list[dict[str, Any]] = []
        for entry in raw_stages:
            if not isinstance(entry, dict):
                continue
            normalized_stages.append(_coerce_single_funnel_stage_dict(entry))
        out["stages"] = normalized_stages
    else:
        out["stages"] = []
    return out
