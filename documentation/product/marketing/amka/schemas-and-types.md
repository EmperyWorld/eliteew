# AMKA · схемы и типы (Pydantic)

## Файлы

| Путь | Содержание |
|------|------------|
| `shared/api/schemas/marketing_cabinet/amka.py` | Статусы run/step, `AmkaSectionKey`, `AmkaStageKind`, DTO run/step/plan/operations, `AmkaStartRequest`, approve/resume bodies |
| `shared/api/schemas/marketing_cabinet/amka_operator_config.py` | `AmkaOperatorConfigV1` (дерево настроек конструктора), bundle ответа |
| `shared/api/schemas/marketing_cabinet/amka_preset.py` | CRUD пресетов, шаблоны |

## Ключевые литералы (`amka.py`)

- **`AmkaRunStatus`:** `planning`, `awaiting_approval`, `awaiting_step_approval`, `queued`, `running`, `completed`, `failed`, `cancelled`.
- **`AmkaStepStatus`:** `pending`, `running`, `completed`, `failed`, `skipped`.
- **`AmkaStageKind`:** `section_audit`, `master_plan`, `execute_section`, `final_assessment`.
- **`AmkaSectionKey`:** полный перечень секций кабинета в API (см. также [AMKA-REFERENCE.md](../AMKA-REFERENCE.md) § ключи разделов).
- **`AmkaRunMode`:** `auto` | `semi_auto`.
- **`AmkaScopeKey`:** сейчас фактически `all_visible`.

## Валидация старта (`AmkaStartRequest`)

- `auto_cycle_count` **запрещён** при `semi_auto`.
- `per_step_execution` **только** с `semi_auto`.
- `section_keys` — дедупликация на входе.

## Операции в ответе API

`AmkaOperationOut` отражает нормализованную операцию плана: `kind`, `entity_type`, `destructive`, `source_refs`, снимки до/после (для review и трассы).

## Связь с БД

Схемы **не** дублируют колонки Postgres дословно: `AmkaRunOut` — нормализованное представление строки `marketing_amka_runs` + JSON полей.
