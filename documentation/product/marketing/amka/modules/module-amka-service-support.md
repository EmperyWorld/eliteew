# Модуль · `amka_service_support.py`

## Расположение

`shared/api/services/marketing_cabinet/amka_service_support.py`

## Назначение

**Общий каркас** AMKA без доменных фаз: константы секций (`AMKA_SCOPE_ALL_VISIBLE`, `AMKA_AUDIT_ONLY_SECTIONS`, зависимости `AMKA_SECTION_DEPENDENCIES`), нормализация строк run/step, **терминальные статусы**, **poll** интервалы, **rate-limit backoff** (`_wait_marketing_ai_rate_limit_backoff`), **фоновые задачи** `_spawn_background` / реестр `AMKA_BACKGROUND_TASKS`, форматирование дайджеста AMKA, **IMC auto haystack** (`build_imc_auto_cabinet_haystack`, `_heuristic_imc_type_key_for_amka_auto`), маппинг integrity issues → зависимостей, JSON-хелперы, нормализация процентов.

## Объём

Один из самых больших файлов поддержки; при добавлении секции или режима исполнения обычно правят **здесь** и в `amka_section_mapping.py`.

## Связь

Импортируется почти всеми `amka_*` модулями; изменения в публичных константах — high-impact.
