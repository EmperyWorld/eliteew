# Модуль · `amka_phase_audit.py`

## Расположение

`shared/api/services/marketing_cabinet/amka_phase_audit.py`

## Назначение

Фаза **аудита разделов**: baseline + LLM по каждой видимой секции, merge payload, статистика `audit_llm_stats`, обработка rate-limit/backoff.

## Публичные точки входа

- `build_section_audits_baseline` — синхронно, без LLM.
- `build_section_audits` — baseline затем опционально `enrich_section_audits_with_llm`.
- `enrich_single_section_audit_llm` / `enrich_section_audits_with_llm` — секционный промпт + RAG.
- `merge_section_audit_payload` — слияние LLM-ответа с baseline; фильтр цитат `work_needed`.

## Документация продукта

[AMKA-REFERENCE.md](../../AMKA-REFERENCE.md) § фаза аудита, [AMKA-AUDIT-WORKFLOW.md](../../AMKA-AUDIT-WORKFLOW.md) § аудит.

## Конфигурация

`unified_settings.amka_section_audit_context_max_chars`, `amka_audit_llm_delay_ms`, `amka_audit_llm_parallelism` и перекрытия из `operator_amka.section_llm_audit`.
