# Модуль · `amka_strategy_graph_reconcile.py`

## Расположение

`shared/api/services/marketing_cabinet/amka_strategy_graph_reconcile.py`

## Назначение

Перед финальной оценкой AMKA — **`reconcile_marketing_strategy_graph_for_project`**: эвристики и опционально LLM для проставления **массивов связей** в PostgreSQL (JTBD↔VP, сегменты↔jobs/content, кампании↔segments/VP), чтобы метрики Overview отражали фактический граф.

## Результат

Краткий отчёт в **`final_assessment.strategy_graph_reconcile`** (счётчики обновлений, использовался ли LLM).

## Связь

Таблицы и поля — см. [AMKA-AUDIT-WORKFLOW.md](../../AMKA-AUDIT-WORKFLOW.md) § «Обзор кабинета и граф стратегии».

## Инварианты

Не перетирать вручную заданные связи без эвристики «безопасно пусто / один кандидат»; см. код модуля.
