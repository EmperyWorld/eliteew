# Модуль · `amka_mutation_service.py`

## Расположение

`shared/api/services/marketing_cabinet/amka_mutation_service.py`

Тесты контракта payload (узкий набор):

- `shared/api/tests/test_amka_mutation_segment_links.py`
- `shared/api/tests/test_amka_mutation_competitor_payload.py`

## Назначение

**Единый адаптер операций** master plan: выполнение списка нормализованных dict’ов с полями `kind`, `entity_type`, `payload`, `replacement_payload`, `source_refs`, деструктивность, трасса для UI.

Перед записью в роутеры кабинета AMKA **нормализует** часть LLM-payload (конкуренты, связи сегментов). Публичные REST-схемы (`SegmentUpdateRequest`, `CompetitorCreateRequest`) не расширялись — алиасы и резолв живут только в mutation-слое.

## Класс `AmkaMutationService`

### Публичный метод

`execute_operations(project_id, user_id, operations, project_context_text, llm_text) -> dict`

Возвращает `operation_trail`, `applied_entities`, `metrics_after`, счётчики.

### Поддерживаемые `kind` (ориентир)

| kind | Назначение |
|------|------------|
| `create`, `update`, `replace`, `delete`, `archive`, `status_transition` | CRUD / статусы сущностей кабинета |
| `project_autofill` (явный `mode` **или** только `autofill_target`) | `_execute_autofill_operation` — JSON preview, retry, apply |
| `import_analysis_artifact` | Импорт артефакта в контент проекта |
| `attach_content_source` | Вкл/выкл `marketing_rag_included` у `unified_content` |
| `reindex_marketing_rag_content` | Переиндексация документа в маркетинговый RAG |

### Прямые CRUD

Делегирование в роутерные функции: `job_stories`, `value_propositions`, `swot`, `competitors`, `segments`, `campaigns`, `funnels`, `tasks`, `alerts`, `research`, … (см. импорты в начале файла).

## Маршрутизация autofill vs direct create

`_is_project_autofill_operation(payload, replacement_payload)` возвращает `true`, если:

- в payload или `replacement_payload` есть `mode: "project_autofill"`, **или**
- задан непустой **`autofill_target`** (даже без `mode`).

Иначе `kind: create` с `{autofill_target: "competitors"}` ошибочно шёл в `_create_direct` и падал на `CompetitorCreateRequest name Field required`.

## Нормализация payload: конкуренты

`_normalize_competitor_mutation_payload` (create/update direct):

- снимает мета-ключи autofill: `mode`, `autofill_target`, `project_id`;
- мапит алиасы **`title`**, **`company_name`**, **`competitor_name`**, **`headline`** → **`name`**;
- при create без имени — fallback **`Конкурент (AMKA)`**.

## Нормализация payload: связи сегмента (direct create/update)

`_resolve_segment_mutation_payload(db_pool, project_id, payload, for_create=…)` — **не передаёт сырые строки LLM** в `SegmentCreateRequest` / `SegmentUpdateRequest`.

### Предпочтительный контракт для плана и LLM

| Поле в operation payload | Резолв |
|--------------------------|--------|
| `linked_job_story_titles`, `job_story_titles`, `job_story_names` | lookup JTBD по проекту |
| `linked_competitor_names`, `competitor_names` | lookup конкурентов по проекту |
| `linked_job_story_ids`, `linked_competitor_ids`, `linked_content_ids` | только после парсинга UUID **и** `_filter_ids_for_project` |

Lookup по названиям — те же индексы, что в document autofill: `_build_lookup_indexes` + `_resolve_linked_ids` (`document_autofill.py`). Нормализация ключей: `_normalize_lookup_key` (lower, сжатие пробелов, уборка пунктуации).

### Проверка UUID в БД

`_filter_ids_for_project` проверяет, что id существует в проекте и не удалён:

| entity | Таблица |
|--------|---------|
| `jobs` | `job_stories` |
| `competitors` | `competitors` |
| `content` | `unified_content` |

`_try_parse_uuid` удаляет NBSP (`\xa0`), zero-width и прочие пробельные символы перед `UUID(...)`. Структурно валидный, но **отсутствующий в проекте** id отбрасывается.

### Поведение create vs update

| Ситуация | create | update |
|----------|--------|--------|
| Есть titles/names | записать объединение title-resolved + verified ids | то же |
| Только `linked_*_ids`, все битые/чужие | `[]` | **поле опускается** — существующие связи не затираются |
| Явный `[]` в payload | очистить связи | очистить связи |
| Часть id прошла verify | только verified | только verified |

Autofill preview по-прежнему использует titles в draft items; `_merge_segment_autofill_preview_links` подмешивает titles из заменяемого сегмента при пустых связях модели на **replace**.

## Прочие вспомогательные функции

- `_merge_segment_autofill_preview_links` — сохранить связи при replace сегмента
- `_execute_autofill_operation` — **`amka_llm_json_raw`** → `httpx_compat_generate_json(json_format=True)` → stack2 chat path + `format=json`; до **3** retry при невалидном JSON; укороченный контекст; sanitization preview
- `_sanitize_generated_preview_payload` — дедуп LLM-маркеров в preview

## Env и миграции

**Новых переменных окружения и SQL-миграций для этого контракта нет.** Поведение полностью в коде mutation-сервиса и существующих таблицах (`job_stories`, `competitors`, `unified_content`, `marketing_segments`).

## Инварианты

- `supports_operation` отсекает неизвестные пары kind/entity до вызова.
- REST PATCH сегмента по-прежнему принимает только `linked_*_ids` (UUID[]); titles — контракт **operation payload** AMKA и autofill, не публичного OpenAPI сегмента.

## Связанная документация

- [AMKA-REFERENCE.md](../../AMKA-REFERENCE.md) §9
- [AMKA-AUDIT-WORKFLOW.md](../../AMKA-AUDIT-WORKFLOW.md) § Autofill в мутациях, § Обзор и граф стратегии
- [MARKETING-CABINET-PROMPTS-REFERENCE.md](../../MARKETING-CABINET-PROMPTS-REFERENCE.md) — master plan и autofill prompts
