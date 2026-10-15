# Модуль · `amka_operator_config.py`

## Расположение

`shared/api/services/marketing_cabinet/amka_operator_config.py`

## Назначение

Загрузка **singleton**-конфига из **`marketing_amka_operator_config`** (`id = default`), **merge** с переменными окружения и `unified_settings` (клампы), подготовка **effective** конфига для UI и рантайма.

## Ключевые операции

| Функция | Назначение |
|---------|------------|
| `fetch_stored_operator_config` | Чтение JSONB из БД |
| `merge_effective_operator_config` | Итоговый `AmkaOperatorConfigV1` с ограничениями env |
| `load_operator_config_bundle` | triplet для **`GET /operator-config`**: stored, effective, caps, метаданные обновления |
| `upsert_operator_config` | `PUT` от trusted-оператора |

## Связь со схемой

Pydantic-модель: `schemas/marketing_cabinet/amka_operator_config.py` — вложенные секции `section_llm_audit`, `master_plan`, `execute`, финальный промпт и т.д.

## Инварианты

- Конфиг **глобальный** (не per-project).
- Поля вроде `AMKA_FINAL_PROMPT_MAX_CHARS` не могут быть превышены effective JSON из UI — кламп на сервере.
