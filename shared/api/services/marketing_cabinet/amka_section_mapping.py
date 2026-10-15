"""
Соответствие AMKA `section_key` ↔ строки `AutofillTarget` (как в document autofill / «Все разделы»).

AMKA использует ключ `value` для ценностного предложения; API автозаполнения — `value_propositions`.
Раздел `analysis` в AMKA покрывает два таргета: `swot` и `competitors`.
"""

from __future__ import annotations

# Ключ раздела AMKA → значения AutofillTarget (StrEnum .value)
AMKA_SECTION_TO_AUTOFILL_TARGET_VALUES: dict[str, tuple[str, ...]] = {
    "jtbd": ("jtbd",),
    "value": ("value_propositions",),
    "analysis": ("swot", "competitors"),
    "evidence": ("researches",),
    "segments": ("segments",),
    "campaigns": ("campaigns",),
    "funnel": ("funnels",),
    "tasks": ("tasks",),
    "alerts": ("alerts",),
}


def autofill_target_values_for_section(section_key: str) -> list[str]:
    return list(AMKA_SECTION_TO_AUTOFILL_TARGET_VALUES.get(section_key, ()))


def default_execution_mode_for_section(section_key: str) -> str:
    """mutation_service — CRUD/evidence; project_generate_async — тот же путь, что generate-from-project/async."""
    if section_key == "evidence":
        return "mutation_service"
    if section_key == "project_rag":
        return "mutation_service"
    if section_key == "imc":
        return "imc_research"
    if section_key in AMKA_SECTION_TO_AUTOFILL_TARGET_VALUES:
        return "project_generate_async"
    return "mutation_service"
