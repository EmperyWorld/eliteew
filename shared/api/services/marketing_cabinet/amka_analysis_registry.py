"""Реестр режимов исследования/исполнения AMKA для промптов и нормализации плана."""

from __future__ import annotations

# Режимы, которые LLM может указать в tasks[].execution_mode (согласовано с _normalize_plan_tasks).
AMKA_PLAN_EXECUTION_MODES: frozenset[str] = frozenset(
    {
        "mutation_service",
        "project_generate_async",
        "imc_research",
        "marketing_tool_agent",
        "desktop_ensemble",
    }
)

# Краткие описания для master-plan и подсказок исполнителю.
AMKA_ANALYSIS_REGISTRY_MARKDOWN = """
## Реестр execution_mode (исследования и применение)

- **mutation_service** — готовые операции import/attach/update/replace по сущностям кабинета; результат сразу в данных.
- **project_generate_async** — автозаполнение раздела через marketing document generate (UGS), как «Все разделы».
- **imc_research** — только для section_key=imc: запуск ИМК-исследования, ожидание терминального статуса, синхронизация в evidence.
- **marketing_tool_agent** — Llama router → whitelist-инструменты (RAG, сущности, конкуренты) → синтез через UGS; отчёт в markdown, без прямой мутации, если нет operations. Если в шаге есть operations — сначала отчёт, затем мутации.
- **desktop_ensemble** — Desktop AI Chat «Команда» (до 6 героев, blueprint): структурированный экспертный документ по материалам проекта (RAG vault); отчёт в markdown, без прямой мутации, если нет operations. Поля задачи: `ensemble_hero_ids` (до 6 id), опционально `ensemble_template_hint` (`marketing_brief_v1`, `research_plan_v1`, `campaign_plan_v1`, …), `ensemble_routing_mode` (`blueprint_only` по умолчанию).

Выбирай режим по задаче: для фактов и сводки «что в кабинете» без записи — `marketing_tool_agent`; для экспертного совета и структурированного артефакта (бриф, план исследования, кампания) — `desktop_ensemble`; для записи — `mutation_service` или `project_generate_async`; для глубокого ИМК-RAG — `imc_research` (раздел imc).
""".strip()
