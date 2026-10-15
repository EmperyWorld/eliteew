# Модуль · `amka_section_mapping.py`

## Расположение

`shared/api/services/marketing_cabinet/amka_section_mapping.py`

## Назначение

Каноническое соответствие **`section_key` AMKA** ↔ **значения `AutofillTarget`** (как в document autofill / «Все разделы») и **дефолтный `execution_mode`** для секции.

## `AMKA_SECTION_TO_AUTOFILL_TARGET_VALUES`

| AMKA key | Кортеж таргетов |
|----------|-----------------|
| `jtbd` | `jtbd` |
| `value` | `value_propositions` |
| `analysis` | `swot`, `competitors` (два последовательных автозаполнения) |
| `evidence` | `researches` |
| `segments` | `segments` |
| `campaigns` | `campaigns` |
| `funnel` | `funnels` |
| `tasks` | `tasks` |
| `alerts` | `alerts` |

Функция **`autofill_target_values_for_section(section_key)`** возвращает список строк.

## `default_execution_mode_for_section`

| Условие | Режим |
|---------|--------|
| `evidence` | `mutation_service` |
| `project_rag` | `mutation_service` |
| `imc` | `imc_research` |
| Ключ ∈ таблице автозаполнения | `project_generate_async` |
| Иначе | `mutation_service` |

Используется в **`amka_phase_execute_section`** когда в `plan_payload` нет явного `execution_mode`.
