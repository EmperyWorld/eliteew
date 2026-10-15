# Модуль · `amka_run_snapshot.py`

## Расположение

`shared/api/services/marketing_cabinet/amka_run_snapshot.py`

## Назначение

**Единый снимок** для планирования и исполнения: health, merged project context + RAG, extras (IMC, diagnostic, dashboards, counts), source catalog, section entities, operator config, дайджест AMKA, режимы `run_mode`, каталог типов ИМК.

## Ключевые функции

| Функция | Роль |
|---------|------|
| `fetch_project_extras` | SQL + RAG/vault counters |
| `fetch_amka_imc_types_catalog_for_plan` | Активные типы из `generation_types` |
| `build_run_snapshot` | Сборка полного dict; поддержка **`reuse_static`**, **`reuse_merged_project_context`** |

## RAG

Дефолтный запрос `build_marketing_rag_query(...)` под AMKA-аудит; `merge_project_context_text_with_rag` с **limit=16**, **min_score=0.22** (если не reuse).

## Связь

Потребители: **`run_plan_background`**, **`run_execute_section_step`** (опционально свежий snapshot).
