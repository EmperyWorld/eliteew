# AMKA · пакет `amka_phases`

## Путь

`shared/api/services/marketing_cabinet/amka_phases/__init__.py`

## Назначение

Единая **точка реэкспорта** публичных entrypoint’ов фаз, которые дергает **`AmkaService`**, без необходимости импортировать длинный список модулей из роутеров и тестов.

## Экспорт (`__all__`)

| Символ | Источник | Роль |
|--------|----------|------|
| `amka_build_master_plan` | `amka_phase_plan.build_master_plan` | LLM/эвристика master plan |
| `amka_build_section_audits` | `amka_phase_audit.build_section_audits` | Аудит + LLM обогащение |
| `amka_build_section_audits_baseline` | `amka_phase_audit.build_section_audits_baseline` | Только baseline |
| `amka_enrich_section_audits_with_llm` | `amka_phase_audit.enrich_section_audits_with_llm` | Пакетное LLM |
| `amka_enrich_single_section_audit_llm` | `amka_phase_audit.enrich_single_section_audit_llm` | Одна секция |
| `merge_section_audit_payload` | `amka_phase_audit.merge_section_audit_payload` | Слияние baseline + LLM |
| `run_plan_background` | `amka_phase_plan.run_plan_background` | Фон планирования |
| `run_execute_background` | `amka_phase_execute.run_execute_background` | Фон исполнения |
| `run_execute_section_step` | `amka_phase_execute_section.run_execute_section_step` | Один execute-шаг |
| `run_final_assessment` | `amka_phase_finalize.run_final_assessment` | Финальный шаг |

## Инварианты

- Пакет **не** содержит бизнес-логики — только импорты.
- Новые фазы добавляют сюда символы только если они вызываются с фасада сервиса.
