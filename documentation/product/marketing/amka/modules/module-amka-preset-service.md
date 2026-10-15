# Модуль · `amka_preset_service.py`

## Расположение

`shared/api/services/marketing_cabinet/amka_preset_service.py`

## Назначение

CRUD **проектных** пресетов `marketing_amka_presets`, загрузка **системных шаблонов** `marketing_amka_preset_templates`, проверка принадлежности пресета проекту (`assert_preset_belongs_to_project`), выборка `fetch_preset_config_for_planning` для фазы плана.

## Типичные функции

- `list_presets`, `get_preset`, `create_preset`, `update_preset`, `delete_preset` (мягкое `deleted_at`).
- `list_preset_templates` — read-only каталог для UI конструктора.

## Валидация

`validate_amka_preset_config_v1` (или эквивалент в модуле) — единый вход для API пресетов и шаблонов.

## Права

На уровне роутера: `assert_marketing_amka_preset_editor` — владелец проекта или `is_trusted`.
