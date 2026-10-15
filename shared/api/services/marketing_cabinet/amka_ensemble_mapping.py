# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Map AMKA sections to Desktop AI Chat ensemble roster, blueprint hints, and execution-mode heuristics.
# Invariants:
# - Hero ids must stay within ALLOWED_DESKTOP_HERO_IDS; roster capped at ENSEMBLE_MAX_ROSTER_HEROES.
# Related:
# - api/services/desktop_chat_ensemble/settings.py
# - documentation/product/marketing/AMKA-AUDIT-WORKFLOW.md
# ---

from __future__ import annotations

from typing import Any

from api.services.desktop_chat_ensemble.settings import (
    ALLOWED_DESKTOP_HERO_IDS,
    ENSEMBLE_ENGINE_BLUEPRINT,
    ENSEMBLE_MAX_ROSTER_HEROES,
    ENSEMBLE_ROUTING_BLUEPRINT_ONLY,
)
from api.services.marketing_cabinet.amka_service_support import AMKA_SECTION_LABELS, _trim_text

_ALLOWED = frozenset(ALLOWED_DESKTOP_HERO_IDS)

_DEFAULT_ROSTER: tuple[str, ...] = ("likiy_sorrento", "arlyqueen", "max_safin")

_SECTION_ROSTER: dict[str, tuple[str, ...]] = {
    "jtbd": ("arlyqueen", "max_safin", "akimbo"),
    "value": ("arlyqueen", "likiy_sorrento", "max_safin"),
    "analysis": ("likiy_sorrento", "arlyqueen", "dr_vereskov"),
    "evidence": ("likiy_sorrento", "arlyqueen", "viktor_engineer"),
    "segments": ("arlyqueen", "max_safin", "akimbo"),
    "campaigns": ("arlyqueen", "likiy_sorrento", "suno_songwriter"),
    "funnel": ("arlyqueen", "likiy_sorrento", "suno_songwriter"),
    "brand": ("arlyqueen", "likiy_sorrento", "arlekino_pravoz"),
    "imc": ("likiy_sorrento", "arlyqueen", "akimbo"),
    "client_interaction": ("arlyqueen", "likiy_sorrento", "suno_songwriter"),
}

_SECTION_TEMPLATE_HINT: dict[str, str] = {
    "jtbd": "marketing_brief_v1",
    "value": "marketing_brief_v1",
    "analysis": "business_plan_v1",
    "evidence": "research_plan_v1",
    "segments": "marketing_brief_v1",
    "campaigns": "campaign_plan_v1",
    "funnel": "campaign_plan_v1",
    "brand": "marketing_brief_v1",
    "imc": "research_plan_v1",
}

_TEMPLATE_USER_PHRASE: dict[str, str] = {
    "marketing_brief_v1": "Соберите маркетинговый бриф по материалам проекта.",
    "research_plan_v1": "Соберите план исследования и критерии решения по материалам проекта.",
    "campaign_plan_v1": "Соберите план кампании и каналов по материалам проекта.",
    "business_plan_v1": "Соберите стратегический business-plan outline по материалам проекта.",
}

_ENSEMBLE_SYNTHESIS_SECTIONS = frozenset(
    {
        "analysis",
        "evidence",
        "value",
        "jtbd",
        "segments",
        "brand",
        "campaigns",
        "funnel",
        "imc",
    }
)

_SYNTHESIS_KEYWORDS = (
    "исслед",
    "анализ",
    "гипотез",
    "план",
    "стратег",
    "позиц",
    "аудитор",
    "конкур",
    "сводк",
    "эксперт",
)


def sanitize_amka_ensemble_hero_ids(raw: Any, *, section_key: str = "") -> list[str]:
    items: list[str] = []
    if isinstance(raw, list):
        for item in raw:
            hid = str(item or "").strip()
            if hid in _ALLOWED and hid not in items:
                items.append(hid)
            if len(items) >= ENSEMBLE_MAX_ROSTER_HEROES:
                break
    if items:
        return items
    roster = _SECTION_ROSTER.get(section_key) or _DEFAULT_ROSTER
    return list(roster[:ENSEMBLE_MAX_ROSTER_HEROES])


def default_amka_ensemble_settings(section_key: str) -> dict[str, str]:
    hint = _SECTION_TEMPLATE_HINT.get(section_key, "marketing_brief_v1")
    return {
        "ensemble_engine": ENSEMBLE_ENGINE_BLUEPRINT,
        "ensemble_routing_mode": ENSEMBLE_ROUTING_BLUEPRINT_ONLY,
        "ensemble_template_hint": hint,
    }


def suggest_desktop_ensemble_execution_mode(
    section_key: str,
    *,
    write_policy: str,
    work_needed: list[str],
    operations: list[Any],
) -> str | None:
    if operations:
        return None
    if section_key not in _ENSEMBLE_SYNTHESIS_SECTIONS:
        return None
    if write_policy == "report_only":
        return "desktop_ensemble"
    hay = " ".join(str(item) for item in work_needed).casefold()
    if any(token in hay for token in _SYNTHESIS_KEYWORDS):
        return "desktop_ensemble"
    return None


def build_amka_ensemble_user_prompt(
    *,
    section_key: str,
    title: str,
    rationale: str,
    user_instruction: str,
    audit_payload: dict[str, Any],
    template_hint: str,
) -> str:
    label = AMKA_SECTION_LABELS.get(section_key, section_key)
    phrase = _TEMPLATE_USER_PHRASE.get(template_hint, _TEMPLATE_USER_PHRASE["marketing_brief_v1"])
    work_needed = [str(item).strip() for item in list(audit_payload.get("work_needed") or []) if str(item).strip()]
    current_state = _trim_text(str(audit_payload.get("current_state") or ""), 1200)
    parts = [
        "Задача AMKA: экспертная группа Desktop AI Chat («Команда») по маркетинговому проекту.",
        phrase,
        f"Раздел кабинета: {label} ({section_key}).",
        f"Название шага AMKA: {title or '—'}.",
        f"Обоснование шага: {rationale or '—'}.",
        f"Фокус оператора: {user_instruction or '—'}.",
    ]
    if work_needed:
        parts.append("Приоритеты аудита AMKA:\n- " + "\n- ".join(work_needed[:8]))
    if current_state:
        parts.append(f"Текущее состояние раздела (кратко):\n{current_state}")
    parts.append(f"Blueprint template_id (используй этот шаблон документа): `{template_hint}`.")
    parts.append(
        "Опирайся на материалы проекта (RAG) и явно отделяй факты от гипотез. "
        "Не выдумывай метрики, бюджеты и каналы без опоры на входные данные."
    )
    return "\n\n".join(parts)


def normalize_amka_ensemble_plan_fields(raw: dict[str, Any], *, section_key: str) -> dict[str, Any]:
    out: dict[str, Any] = {}
    heroes = sanitize_amka_ensemble_hero_ids(raw.get("ensemble_hero_ids"), section_key=section_key)
    out["ensemble_hero_ids"] = heroes
    engine = str(raw.get("ensemble_engine") or "").strip()
    if engine in ("blueprint", "legacy_freeform"):
        out["ensemble_engine"] = engine
    routing = str(raw.get("ensemble_routing_mode") or "").strip()
    if routing in ("auto", "semi", "chat_only", "blueprint_only"):
        out["ensemble_routing_mode"] = routing
    hint = _trim_text(raw.get("ensemble_template_hint"), 80)
    if hint:
        out["ensemble_template_hint"] = hint
    elif section_key in _SECTION_TEMPLATE_HINT:
        out["ensemble_template_hint"] = _SECTION_TEMPLATE_HINT[section_key]
    return out
