# AMKA Audit Workflow

**Полный справочник AMKA** (API, фазы, снимок, исполнение, мутации): **[AMKA-REFERENCE.md](AMKA-REFERENCE.md)**.  
Фаза аудита разделов (baseline → LLM, RAG): **[amka/modules/module-amka-phase-audit.md](amka/modules/module-amka-phase-audit.md)**.  
**Не путать с EWA:** `/api/v1/ewa/*`, `ewa_platform`, окно **EwaApp** — см. [../ewa/EWA-VS-AMKA-TAXONOMY.md](../ewa/EWA-VS-AMKA-TAXONOMY.md).

`AMKA` — раздел **маркетингового кабинета** для staged-аудита проекта. Он не заменяет обычный `autofill` и не является ещё одним `imc_rag_*` типом: AMKA собирает аудит разделов, строит общий план, ждёт одно подтверждение оператора и затем выполняет шаги автоматически, сохраняя отчёт по каждому этапу.

## Что делает AMKA

1. Снимает состояние почти всех видимых разделов кабинета.
2. Формирует по каждому разделу audit artifact: текущее состояние, пробелы, зависимости, что делать дальше.
3. Собирает единый master plan по зависимостям между разделами.
4. После подтверждения запускает пошаговое выполнение.
5. После завершения делает финальную переоценку `before/after`.

Служебные разделы `AI Studio`, `Контекстный чат` и `Источники RAG` в baseline AMKA не входят.

## Persistence и API

- Таблицы: `marketing_amka_runs`, `marketing_amka_run_steps`
- Именованные пресеты проекта «АМКА-{имя}»: `marketing_amka_presets` (JSONB `config` v1: `extra_plan_tasks` — дополнительные задачи `master_plan.tasks` после сборки плана), колонка `marketing_amka_runs.preset_id` (FK, `ON DELETE SET NULL`), миграция `shared/api/migrations/applied/20260430_marketing_amka_presets.sql`
- Глобальные переопределения оператора (конструктор AMKA): `marketing_amka_operator_config` (singleton `id = default`, JSONB `config`), миграция `shared/api/migrations/applied/20260429_marketing_amka_operator_config.sql`
- Базовый контур AMKA (runs/steps): `shared/api/migrations/applied/20260416_marketing_amka.sql`
- Роутер: `shared/api/routers/marketing_cabinet/amka.py`
- Сервис: `shared/api/services/marketing_cabinet/amka_service.py` (жизненный цикл run: `amka_run_lifecycle.py`); merge с env: `amka_operator_config.py`, схема `schemas/marketing_cabinet/amka_operator_config.py`
- Фронт: `shared/web/frontend/src/features/amka/AmkaView.tsx` (вход `MarketingCabinetAmkaView`; конструктор → `AmkaBuilderView.tsx`; pages re-export — legacy)
- Вспомогательный модуль оркестрации (константы, нормализация строк run/step, rate-limit backoff, фоновые задачи): `shared/api/services/marketing_cabinet/amka_service_support.py`; фасад сервиса: `amka_service.py` (`AmkaService`).

### Структура модулей AMKA (бэкенд)

- **Фасад:** `shared/api/services/marketing_cabinet/amka_service.py` — оркестрация и тонкие делегаты; тяжёлая логика в модулях ниже.
- **Жизненный цикл run (список/деталь/create/approve/resume/cancel, auto-cycle):** `amka_run_lifecycle.py`.
- **Дайджест прогонов и bias аудита:** `amka_service_digest.py` (`load_recent_amka_runs_digest`, `apply_entity_edit_bias_to_audits`).
- **План без LLM:** `amka_plan_candidates.py` — эвристические кандидаты задач/операций, нормализация `plan_tasks` / `operation_payloads` / `source_refs`.
- **Снимок run:** `amka_run_snapshot.py` — `build_run_snapshot`, контекст проекта + RAG, `fetch_project_extras` (IMC/дашборды/diagnostic и т.д.).
- **Persistence run/step:** `amka_run_store.py` — выборка/обновление run и шагов, сброс failed/running, `fetch_run_value` (whitelist колонок).
- **Markdown-отчёты:** `amka_markdown_render.py` — чистые функции рендера аудита, плана, autofill, fallback-итога, operation trail; `describe_operation_snapshot`.
- **Исполнение вне основного section-step:** `amka_phase_execute_misc.py` — сводка для заказчика (client interaction), `marketing_tool_agent` по разделу. Импортируется из фасада **лениво** (внутри методов), чтобы не тянуть тяжёлые зависимости роутеров при простом `import amka_service`.
- **Фазы:** `amka_phase_plan.py`, `amka_phase_audit.py`, `amka_phase_execute.py`, `amka_phase_execute_section.py`, `amka_phase_finalize.py`; единая точка импорта: `amka_phases/__init__.py`.
- **Async / дочерние задачи / ИМК:** `amka_execute_async_helpers.py` — ожидание `marketing_ai_run`, цепочка `project_generate_async`, poll `imc_research_runs`.
- **LLM:** `amka_llm_runtime.py` (JSON/текст в Llama-compat), `amka_llm_plan.py` (промпт и разбор master plan).
- **Источники операций:** `amka_execute_operation_sources.py` — materialize для `import_analysis_artifact`.
- **Прочее:** `amka_mutation_service.py`, `amka_strategy_graph_reconcile.py`, `amka_source_resolver.py`, `amka_logging.py`, `amka_operator_config.py`, пресеты — по смыслу в названии.

Основные endpoints:

- `POST /api/v1/marketing-cabinet/amka/runs`
- `GET /api/v1/marketing-cabinet/amka/project/{project_id}/runs` — в ответе также **`poll_after_ms`**: рекомендуемый интервал опроса (мс), если среди элементов есть незавершённые запуски (**`0`**, если все в терминальном статусе); UI списка прогонов использует то же значение, что и деталь run при активном статусе.
- `GET /api/v1/marketing-cabinet/amka/runs/{run_id}`
- `GET /api/v1/marketing-cabinet/amka/runs/{run_id}/export.md` — **серверный** markdown-отчёт по прогону (паритет с клиентской сборкой в `marketingCabinetAmkaExport`); UI при скачивании сначала запрашивает этот endpoint, при ошибке — локальная сборка из уже загруженных `run`/`steps`.
- `GET /api/v1/marketing-cabinet/amka/runs/{run_id}/events` — **SSE** (`text/event-stream`): лёгкий снимок `status` / `current_stage` / `progress` / `progress_message` и активного шага (~каждые 2 с). UI (`useAmkaRunDetail` внутри открывает SSE для активного run и при живом потоке отключает параллельный polling; при обрыве остаётся `poll_after_ms` / `refetchInterval`). Частые обрывы у клиента за reverse proxy — см. раздел **Деплой SSE** ниже (таймауты nginx / `X-Accel-Buffering`).
- `POST /api/v1/marketing-cabinet/amka/runs/{run_id}/approve`
- `POST /api/v1/marketing-cabinet/amka/runs/{run_id}/resume` (тело опционально: `skip_section_keys`, **`skip_step_ids`** (UUID шагов), `skip_operation_keys`; в `awaiting_step_approval` эквивалентно `continue-step`)
- `POST /api/v1/marketing-cabinet/amka/runs/{run_id}/continue-step`
- `POST /api/v1/marketing-cabinet/amka/runs/{run_id}/cancel`
- `GET /api/v1/marketing-cabinet/amka/operator-config` — сохранённый JSON + **effective** (после клампа с `unified_settings` / `AMKA_FINAL_PROMPT_MAX_CHARS`) + **env_caps** для подсказок в UI
- `PUT /api/v1/marketing-cabinet/amka/operator-config` — обновить JSON (только пользователь с **`users.is_trusted`**)
- `GET /api/v1/marketing-cabinet/amka/presets?project_id=` — список пресетов проекта (доступ к проекту на чтение)
- `POST /api/v1/marketing-cabinet/amka/presets?project_id=` — создать пресет (тело: `display_name`, опционально `slug`, `config`)
- `GET /api/v1/marketing-cabinet/amka/preset-templates` — системные шаблоны пресетов (таблица `marketing_amka_preset_templates`, миграции в `shared/api/migrations/applied/`: `20260431_marketing_amka_preset_templates.sql`, `20260414_marketing_amka_preset_templates_category.sql` — поле `category`); в ответе есть `category` (ключ группы для UI); строки валидируются тем же `validate_amka_preset_config_v1`, что и при сохранении пресета
- `GET/PUT /api/v1/marketing-cabinet/amka/presets/{preset_id}` — получить / обновить (мутации — см. матрицу прав)
- `DELETE /api/v1/marketing-cabinet/amka/presets/{preset_id}` — мягкое удаление (`deleted_at`), ответ **204**
- Запуск с пресетом: в теле `POST .../amka/runs` поле **`preset_id`** (UUID); пресет должен принадлежать тому же `project_id`, иначе **400**

### Пресеты (фаза A, MVP)

- Базовый пайплайн фаз и логика аудита/исполнения **не перезаписываются** из JSON пресета.
- Пресет задаёт только **вставки** в массив задач плана: элементы `extra_plan_tasks[]` с полем `insert_after_section_key` (последний шаг с таким `section_key`) или добавление в конец, если якорь не найден.
- Каждая вставка — объект **`task`** в форме задачи master plan: допустимые `section_key` и `execution_mode` валидируются так же, как при сохранении пресета и при планировании (`validate_amka_preset_config_v1`, merge в `amka_phase_plan.run_plan_background` после `build_master_plan`).
- **Права:** CRUD пресетов — **`projects.created_by`** для проекта **или** **`users.is_trusted`**, плюс обычная проверка доступа к проекту (`assert_marketing_amka_preset_editor`). Старт AMKA с `preset_id` — любой пользователь с правом мутации на проект (как и без пресета).

### Конструктор v1 (ограничения)

- Не редактируется граф зависимостей разделов (`AMKA_SECTION_DEPENDENCIES`) — он остаётся в коде.
- Полная замена системных промптов из UI не поддерживается: только **дополнения** в конец инструкций и **флаги** (отключить LLM аудита разделов / LLM плана / LLM итога), числовые **тайминги** и **потолок** итогового промпта, верхняя граница **ожидания** шагов async/IMC — с клампом по переменным окружения.
- Конфиг **глобальный на контур** (не per-project).

## Оптимизация снимка при исполнении

При цепочке **`execute_section`** / **`final_assessment`** каждый шаг нуждается в актуальном `health`, каталоге источников и списке сущностей проекта. Повторно подтягиваются из БД **операторский effective-конфиг** и **дайджест последних AMKA** по проекту только на первом шаге исполнения; на следующих шагах одного run эти поля **переиспользуются** (`reuse_static` в `build_run_snapshot` / `amka_run_snapshot.py`), чтобы снизить число запросов без изменения семантики плана.

Опционально (по умолчанию выкл., env **`AMKA_EXECUTE_REUSE_MERGED_CONTEXT`**): между шагами execute можно переиспользовать **`project_context_text`** (без повторного `merge_project_context_text_with_rag`), пока предыдущий шаг не менял данные (`applied_entities` / `applied_count` / `imported_sources_count` / `tool_agent_completed`). После мутации кэш сбрасывается.

### Autofill в мутациях AMKA (устойчивость и отчёт)

- Парсинг JSON ответа LLM для `project_autofill`: генерация через **`amka_llm_json_raw`** (`json_format=True` → stack0 **`httpx_compat_generate_json`**, chat path + llama.cpp **`format=json`** / OpenAI `json_object`; не legacy `/v1/completions`). Далее **`extract_json_payload`** (fenced-блок, баланс скобок, JSONC). При полном провале — лог с хэшем (`document_autofill.json_extract_failed`). UGS type_key **`document_structured_extract`** для document autofill gate — см. **`STACK0-LLM-OVERVIEW.md`** §8.2.
- До **3** повторов генерации при «невалидный JSON» и shape-failure (`no_preview`, `empty items`, target mismatch) с укороченным контекстом и более низкой температурой (`amka_mutation_service._execute_autofill_operation`, лог `amka.autofill_json_retry`). Для `funnel` принимаются обёртки `funnel` / `funnels` и alias-поля `stages` / `funnel_steps` / `steps`; при обновлении существующей воронки AMKA предпочитает `update` со `stages`, а не destructive `replace`. Если LLM-preview воронки окончательно пустой, AMKA применяет deterministic skeleton только для бедной существующей воронки (меньше 3 этапов), сохраняя имя/status/primary goal.
- `operation_trail.result.status` теперь машинно различает `applied`, `failed`, `no_preview`, `no_saved_entities`, `retry_exhausted`; эти статусы попадают в markdown-трассу, метрики run и карточки деталей шага в UI. Пустой preview больше не выглядит как обычный `completed`.
- Для generated preview payload перед сохранением применяется sanitization частых LLM-дублей (`Когда Когда`, `я хочу я хочу`, `чтобы чтобы` и близкие маркеры), включая вложенные metadata/evidence у задач, алертов, сегментов и JTBD.
- При **replace** сегмента, если модель не вернула связи, в черновик подмешиваются существующие `linked_job_story` / competitor из заменяемой строки (`_merge_segment_autofill_preview_links`).
- **Direct create/update сегмента** (`_resolve_segment_mutation_payload`): связи резолвятся через БД проекта — предпочтительно **`linked_job_story_titles`** / **`linked_competitor_names`**, как в document autofill; сырые **`linked_*_ids`** от LLM принимаются только после verify в `job_stories` / `competitors` / `unified_content`. NBSP и прочий мусор в UUID не доходят до `SegmentUpdateRequest`. На **update** битые id не затирают существующие связи.
- **Direct create/update конкурента**: операция с **`autofill_target`** без `mode` уходит в autofill; иначе `_normalize_competitor_mutation_payload` мапит title/company_name → **`name`**.
- Финальная сводка: backend хранит `canonical_facts_markdown` и `model_commentary_markdown` отдельно и собирает единый `final_summary_markdown` через `_compose_final_summary_markdown`; экспорт и клиентский fallback показывают финал один раз под «Итоговые факты и комментарий», без дубля `report_markdown` у шага `final_assessment`. В блоке **Сверка связей стратегии** уточнено, что счётчики VP/сегментов/кампаний — пост-фактум донастройка графа в БД, а не «применено сущностей» на шаге.
- Текст результата ИМК в отчёте шага: дедуп повторяющихся секций `##`; в brief запроса к ИМК добавлена политика цитирования для региональных утверждений.
- Execute-step evidence: для autofill-capable разделов (`jtbd`, `value`, `analysis`, `evidence`, `segments`, `campaigns`, `funnel`, `tasks`, `alerts`) результат шага получает `metrics_before.count_before`, `metrics_after.count_before`, `metrics_after.count_after`, `metrics_after.count_delta`. Если async child jobs завершились ошибкой, parent report payload содержит `child_job_errors`, а `metrics_after` — `child_failed_count` и короткий список `child_error_messages`.

## Метрики в логах и ответах

- В ключевых событиях добавлены поля **`phase`** (`plan` \| `audit` \| `execute` \| `finalize`) и **`elapsed_ms`** где уместно (`ops.planning_done`, `ops.execute_done`, `final_assessment.done`, отмена/ошибки плана и execute).
- Аудит по разделам: **`audit.per_section_done`** / **`audit.section_fallback`** с `phase=audit`; при завершении плана в **`ops.planning_done`** передаётся **`audit_llm_fallback`** (из `audit_llm_stats`).
- Разбор ответа LLM для master plan: событие **`plan.llm_parse`** с полями **`plan_llm_status`**, **`parse_reason`**, **`response_chars`**, **`retried`**, **`repair_attempted`**, **`repaired`**, **`structure_ok`** (и при исключении до разбора — **`plan.llm_fallback`**). Перед нормализацией задач выполняется **проверка структуры** (`section_key` только из кандидатов; для разделов **кроме `imc`** — не более одной задачи на ключ; для **`imc`** — у **каждой** задачи обязателен валидный **`imc_type_key`**, все ключи **уникальны**; при отсутствии ключа в JSON дозаполнение из текста **`plan_summary`** — событие **`plan.imc_type_enriched_from_summary`**; лимит числа задач); при провале — **`plan_llm_status=parse_error`** до отката на эвристику. Статусы **`plan_llm_status`** в API/UI: `ok` \| `empty` \| `parse_error` \| `error` \| `disabled` \| `not_applicable` \| **`heuristic_fallback`** (ответ LLM не прошёл нормализацию задач — итоговый план взят из эвристических кандидатов).
- Опционально (effective **`master_plan.repair_json_on_parse_failure`** или env **`AMKA_MASTER_PLAN_REPAIR_JSON`**): один узкий вызов **repair** по сырому тексту ответа — событие **`plan.llm_repair`** (`ok` / причина сбоя). Repair получает compact `candidate_tasks`, может реконструировать JSON из markdown/прозы без JSON-сегмента (`parse_reason=no_json_segment`) и возвращает только объект `{plan_summary, tasks}`; при несоответствии схеме после всех попыток — **`plan.structure_invalid`** с кратким списком кодов ошибок.
- Событие **`plan.normalize_fallback`**: откат на кандидатов после пустой нормализации при ненулевом сыром `tasks` от LLM; в **`context_payload`** и API также **`plan_used_llm_tasks`** (`true`/`false`), при необходимости **`plan_structure_errors`**, **`plan_llm_repair_attempted`**, **`plan_llm_repaired`**.
- **`ops.planning_done`** (фаза `plan`): помимо суммарного **`elapsed_ms`**, в лог пишутся подметрики **`snapshot_build_ms`**, **`audit_phase_ms`**, **`master_plan_ms`**, **`persist_steps_ms`**, **`master_plan_llm_ms`** (только вызовы LLM внутри `build_master_plan`), **`normalize_plan_ms`** (нормализация задач), а также **`plan_llm_status`**, **`plan_source`**, **`plan_used_llm_tasks`**, **`plan_llm_repaired`**.
- В **`final_assessment`** (payload шага и колонка run) добавлен блок **`amka_metrics`**: `elapsed_ms`, `prompt_too_large`, `llm_used`, `llm_disabled_by_operator`.
- Потолок секционного контекста в промпте LLM-аудита: **`AMKA_SECTION_AUDIT_CONTEXT_MAX_CHARS`** (по умолчанию 6000).

## Матрица прав (AMKA API)

Канон зависимостей FastAPI — `shared/api/routers/marketing_cabinet/amka.py` + `common.py`.

| Действие | Зависимость |
|----------|-------------|
| OAuth2 + разрешение JWT | `require_oauth2_user` → `get_marketing_user_id` (разрешение DB UUID пользователя) |
| Список/деталь run, старт, approve, resume, continue-step, cancel, чтение operator-config / preset-templates / presets | `get_marketing_user_id`; доступ к проекту проверяет сервис (`get_accessible_project`, `for_mutation` где нужно) |
| SSE `/runs/{id}/events` | как у `GET .../runs/{id}` (`get_marketing_user_id`) |
| `PUT .../operator-config` | `require_marketing_trusted_operator` (`users.is_trusted`) |
| `POST/PUT/DELETE .../presets` | `assert_marketing_amka_preset_editor`: руководитель проекта (`projects.created_by`) **или** `users.is_trusted`, плюс мутация на проект |

## Несколько шагов ИМК (`imc`) в одном прогоне

- В `master_plan.tasks` допускается **несколько** объектов с `section_key: "imc"`, если у каждого свой **`imc_type_key`** из актуального каталога (активные типы `imc_rag_*` в `generation_types`, см. снимок плана **`imc_types_catalog`**), и все ключи **попарно различны**. Повтор одного и того же типа в одном плане отклоняется при валидации.
- Эвристическое расширение IMC не выходит за активный каталог, если он непустой: при exhaustion дополнительных типов новые IMC-шаги не добавляются вместо дублирования последнего ключа.
- Для остальных разделов по-прежнему **не более одной** задачи на `section_key`.
- После нормализации у каждой задачи есть **`plan_task_uid`** (UUID).
- В **`plan_summary`** ожидается явная связь каждого запланированного `imc_type_key` с пробелом или риском аудита; те же ключи должны стоять в **`tasks[].imc_type_key`** (при несоответствии до валидации выполняется дозаполнение из текста сводки, см. **`plan.imc_type_enriched_from_summary`**).
- **`run_mode=auto`**: у **каждого** шага `imc` в JSON плана обязателен **`imc_type_key`**. Если ключ всё же отсутствует (например, план без LLM или старый артефакт), сервер может подобрать тип **эвристикой** по тексту аудита (`build_imc_auto_cabinet_haystack` + **`_heuristic_imc_type_key_for_amka_auto`**): метрики вида «Сигналов внимания» нормализуются, чтобы не ошибочно выбирать **`imc_rag_trends_signals`**. Уже использованные типы на завершённых/пропущенных шагах ИМК этого run исключаются (по `ordinal`).
- **История проекта (опционально):** в операторском конфиге **`execute.exclude_recent_imc_type_keys`** и **`execute.exclude_recent_imc_type_keys_limit`** — подмешивание последних успешных **`type_key`** из **`imc_research_runs`** в тот же пул исключений для эвристики в auto (событие **`execute.imc.exclude_merged_project_history`**).
- Markdown сводного плана: для шагов `imc` выводятся **`imc_type_key`** и **`imc_focus`**; **`plan_summary`** в отчёте форматируется читаемо (не сырой `repr` dict).
- Run detail UI показывает `imc_type_key` в карточке execute-step, чтобы оператор видел, какой тип исследования реально ушёл в выполнение.
- Дубликаты операций **`reindex_marketing_rag_content`** с одним **`content_id`** в нормализованном плане схлопываются (**`plan.reindex_deduped`**).
- При подтверждении плана: **`skip_section_keys`** по-прежнему помечает все pending-шаги с данным разделом; дополнительно **`skip_step_ids`** позволяет пропустить конкретные шаги `execute_section` (актуально для нескольких `imc`).
- В финальном промпте в compact-шагах для `imc` передаются **`imc_type_key`**, **`imc_focus`**, **`rationale`** из плана шага.

## Как AMKA переиспользует существующий контур

- Для project context и RAG: `build_project_context`, `format_project_context_for_prompt`, `merge_project_context_text_with_rag`
- Для safe write-back в разделы: project-only autofill helpers из `document_autofill.py`
- Для итоговых markdown-отчётов и планирующих шагов: тот же LLM контур, что и маркетинговый кабинет (`LLAMA_URL` / `LLAMA_MODEL_MARKETING`)
- Для финальной оценки: `build_project_health`

## Как теперь строится аудит разделов

- Сначала AMKA собирает baseline по `build_project_health`, count-метрикам и связям между разделами.
- Baseline **выровнен с сигналами Overview по целостности**: для разделов с `strategy_integrity_issues` (те же `code` / `target_view`, что в обзоре) в `report_payload` попадают краткие строки в `work_needed`, при необходимости **снимается завышение score** (раньше «пол» 60 маскировало 0% по связям при ненулевом числе сущностей), **расширяются `dependencies`** по статической карте issue→предшественники и опционально **`integrity_issue_codes`** для трассировки и планирования.
- Затем baseline не отдаётся пользователю как final truth: поверх него запускается **отдельный LLM-вызов на каждый раздел** с **секционным** запросом в RAG (`merge_project_context_text_with_rag` + `build_marketing_rag_query` по названию раздела и фокусу оператора). В промпте требуется, чтобы пункты **`work_needed`** содержали короткую дословную цитату из видимого контекста во французских кавычках «…»; строки без подтверждённой цитаты **отбрасываются** перед merge, но если после фильтра не осталось ни одной строки — сохраняются исходные пункты модели (`audit_llm_parse_reason` с суффиксом `_work_needed_quotes_relaxed`). Лимит контекста: **`AMKA_SECTION_AUDIT_CONTEXT_MAX_CHARS`** (дефолт 10 000); для **`project_rag`**, **`evidence`**, **`analysis`** добавляется +4000 символов. Если контекст усечён, в **`report_payload`** — флаг **`audit_context_truncated`**. После слияния baseline и LLM список **`work_needed`** дополнительно **дедуплицируется** по нормализованному тексту.
- Пауза между вызовами по умолчанию **450 ms** (`AMKA_AUDIT_LLM_DELAY_MS`), опционально **параллелизм** `AMKA_AUDIT_LLM_PARALLELISM` (семафор).
- При **HTTP 429** или **таймаутах** httpx к LLM при обогащении секции накапливается дополнительная пауза перед следующими вызовами (**`audit.backoff`**, поля `reason=rate_limited|timeout`, `extra_ms`); затем по-прежнему срабатывает fallback секции при необходимости.
- При ошибке LLM по разделу используется **только baseline этого раздела**; в лог пишется **`event=audit.section_fallback`** (префикс `[AMKA]`, поле `run_id`). Если модель вернула `sections` с единственным объектом, но ошиблась в `section_key` (например локализовала ключ), AMKA принимает этот объект как override текущей секции и сохраняет `audit_llm_parse_reason=section_key_coerced_single_result`. Если модель вернула прямой объект секции без обёртки `sections`, но с `score/current_state/work_needed/dependencies`, AMKA также принимает его как override и сохраняет `audit_llm_parse_reason=direct_section_object`. Если `sections` пришёл **объектом** (не массивом) или картой `section_key → объект`, AMKA коерсит в массив (`sections_dict_coerced` / `sections_map_coerced`); ключи `section` / `audit_section` / `result` на корне JSON тоже принимаются. Настоящие fallback получают `audit_llm_parse_reason` (`sections_not_list`, `sections_empty`, `section_key_mismatch` и т.п.).
- Цель второго шага — не считать раздел `healthy` только потому, что в нём есть несколько записей; модель может понизить score и добавить `work_needed`, если содержание выглядит поверхностным, слабо связанным с evidence или непрактичным.
- Если LLM-контур временно недоступен, AMKA откатывается на baseline-аудит и пишет fallback в server logs.

Раньше весь baseline всех разделов уходил в **один** mega-prompt; теперь контракт сознательно выровнен с идеей «раздельных запросов», как у кнопки **«Все разделы»** в шапке кабинета (`MarketingProjectGenerateAllAiButton.tsx` — последовательные `generate-from-project/async` с паузой и своим `idempotency_key`).

## Соответствие разделов AMKA и автозаполнения

Источник правды в коде: `api/services/marketing_cabinet/amka_section_mapping.py`.

| AMKA `section_key` | `AutofillTarget` / API (`target_section`) |
|--------------------|---------------------------------------------|
| `jtbd` | `jtbd` |
| `value` | `value_propositions` (не `value`) |
| `analysis` | `swot`, `competitors` (два последовательных шага) |
| `evidence` | `researches` |
| `segments` | `segments` |
| `campaigns` | `campaigns` |
| `funnel` | `funnels` |
| `tasks` | `tasks` |
| `alerts` | `alerts` |

## Планирование и исполнение

- Планировщик LLM получает **сжатый** срез сущностей (до 2 карточек на раздел), аудит и кандидатов; полный `project_context_text` в промпт плана **не подмешивается**.
- В промпт master plan дополнительно попадают **топ `strategy_integrity_issues`**, **рёбра DAG зависимостей** по кандидатам (в терминах «A → B»), краткий **`issue_remediation`** из health (если есть). Модель может вернуть у задач опциональное поле **`addresses_issue_codes`** (только известные коды из текущего health); неизвестные коды отбрасываются при нормализации. **Порядок `depends_on` в задачах должен уважать этот DAG** и базовый граф разделов.
- В `context_payload` и в шаге master plan сохраняется **`plan_source`**: `heuristic` | `llm` (если LLM не вернул задач — остаются эвристические кандидаты). Для `plan_source=heuristic` + `run_mode=auto` эвристика не создаёт destructive `replace` поверх существующих non-funnel сущностей; такие разделы остаются `report_only`, пока их не подтвердит LLM-план или оператор.
- Перед валидацией LLM-плана нормализуется частый ошибочный паттерн старых section keys `execute_imc*`: при однозначном соответствии задача переводится в `section_key: "imc"` с валидным `imc_type_key`, `execution_mode` и `write_policy`; если структура всё равно невалидна, в detail/export остаются `plan_structure_errors`, `plan_llm_parse_reason` и `plan_used_llm_tasks=false`.
- У шага выполнения в `plan_payload` есть **`execution_mode`**: `mutation_service` (импорт evidence, replace через mutation service), `project_generate_async` (тот же путь, что `POST .../autofill/generate-from-project/async`, см. `document_project_generate_service.py`) или **`imc_research`** (запуск ИМК через `ImcService.run_research` с теми же лимитами/идемпотентностью, что и UI ИМК).
- Для async-цепочки разделов кабинета AMKA ждёт завершения дочерних записей **`marketing_ai_runs`**, в `report_payload` шага пишется **`child_jobs`** (`kind`, `external_id`, `status`, `target_section`). Для **`imc_research`** дочерняя сущность — запись **`imc_research_runs`** (`kind`: `imc_research_run`, опционально `ugs_request_id`); ожидание терминального статуса ограничено **`AMKA_PROJECT_GENERATE_STEP_MAX_WAIT_SEC`**. В метаданных дочернего marketing AI-run при необходимости есть **`amka_run_id`** / **`amka_step_id`** для трассировки.
- Итоговый markdown после прогона начинается с **блока фактов по шагам** (пайплайн аудита/плана, сколько шагов реально дали изменения в данных или успешный ИМК), затем отдельный блок комментария модели. В JSON **`final_assessment`** добавляются компактные **`execute_facts`** / **`pipeline`**, `canonical_facts_markdown` и `model_commentary_markdown`, чтобы UI и оператор не путали «рассказ модели» с подтверждёнными метриками шагов.

### Финальный LLM и лимит контекста

Полный ответ **`build_project_health`** (и удвоенный снимок «до/после») плюс сырые **`report_payload`** с **`operation_trail`** легко превышают контекст сервера (десятки тысяч токенов после крупного ИМК). Поэтому во вход финальной сводки попадает только **компактный срез**: `shared/api/services/marketing_cabinet/amka_final_prompt_compact.py` (`compact_project_health_for_amka_final_llm`, `build_compact_execute_steps_for_final_prompt` — сводки шагов и trail без snapshot’ов). В БД и в **`metrics_after`** run по-прежнему сохраняется **полный** health; обрезка только для промпта. Если промпт всё ещё длиннее **`AMKA_FINAL_PROMPT_MAX_CHARS`**, LLM не вызывается, используется fallback-markdown и лог `[WRN] amka.final_assessment.prompt_too_large`. В SQL ленты активности overview (`_fetch_activity_feed`) описания исследований и VP усечены (**`LEFT(..., 720)`**), чтобы превью ленты не тащило мегабайты `result_summary`.

## Переменные окружения (AMKA)

| Переменная | Смысл |
|------------|--------|
| `AMKA_AUDIT_LLM_DELAY_MS` | Пауза между LLM-аудитами по разделам (по умолчанию **450**; кламп 0–60000 в `unified_settings`) |
| `AMKA_AUDIT_LLM_PARALLELISM` | Параллельные LLM-вызовы аудита по разделам (по умолчанию **1**; кламп 1–8). Перекрывается effective-значением **`section_llm_audit.parallelism`** из конструктора AMKA (если задано). Для мощного stack2 можно поднять до 2–4 и снизить общее время аудита; следить за нагрузкой на Llama и **429** |
| `AMKA_MASTER_PLAN_RETRY_ON_PARSE` | Если **`true`** — глобально разрешить один retry LLM master plan при пустом/непарсящемся JSON (логическое **ИЛИ** с полем конструктора **`master_plan.retry_on_parse_failure`**; итог в effective-конфиге в `retry_on_parse_failure`) |
| `AMKA_MASTER_PLAN_REPAIR_JSON` | Если **`true`** — глобально разрешить один вызов **repair** по сырому ответу модели (логическое **ИЛИ** с **`master_plan.repair_json_on_parse_failure`** в конструкторе; итог в effective в `repair_json_on_parse_failure`) |
| `AMKA_PROJECT_GENERATE_STEP_MAX_WAIT_SEC` | Таймаут ожидания дочернего `marketing_ai_run` на шаге async-генерации и терминального статуса **`imc_research_runs`** на шаге ИМК (по умолчанию **900** с; кламп 30–7200 в `unified_settings`; фактический потолок шага также ограничивается операторским конфигом `execute.max_wait_seconds`) |
| `MARKETING_CABINET_AI_RATE_LIMIT_PER_MIN` | Лимит AI-запросов кабинета на пользователя в минуту (по умолчанию **30**); AMKA делает много вызовов подряд — при узком лимите возможны backoff’ы, см. логи `amka.rate_limit.backoff` |
| LLM маркетинга | `LLAMA_URL`, `LLAMA_MODEL_MARKETING` (и связанные настройки stack2) — без рабочего контура аудит/план/итог уходят в baseline или fallback |

Потолок длины промпта финальной сводки: константа **`AMKA_FINAL_PROMPT_MAX_CHARS`** в `api/services/marketing_cabinet/amka_final_prompt_compact.py` (по умолчанию 100000 символов), в API ответе `operator-config` отдаётся **effective** значение после merge с операторским JSON.

## Симптомы и рычаги (runbook)

| Симптом в UI / у оператора | Куда крутить | Ориентир в логах / данных |
|----------------------------|--------------|---------------------------|
| План часто **эвристика**, в детали **`heuristic_fallback`** | Конструктор: **retry** и **repair** master plan; увеличить **`max_tokens`**; env **`AMKA_MASTER_PLAN_RETRY_ON_PARSE`** / **`AMKA_MASTER_PLAN_REPAIR_JSON`** | **`plan.normalize_fallback`**, **`plan.llm_parse`** (`plan_llm_status`, `parse_reason`, `response_sha256` при наличии ответа) |
| **`parse_error`** / **`plan.structure_invalid`** | Проверить, что модель не дублирует `section_key` и не выдумывает разделы; при необходимости упростить **`extra_prompt_instruction`** плана | **`plan.structure_invalid`**, **`plan.llm_repair`** |
| Пустой или обрезанный JSON плана | Поднять **`max_tokens`**, включить repair; проверить таймауты прокси до Llama | **`plan.llm_parse`**, **`plan.llm_fallback`** |
| Много **`audit.section_fallback`** | Stack2/Llama, **`MARKETING_CABINET_AI_RATE_LIMIT_PER_MIN`**, **`AMKA_AUDIT_LLM_PARALLELISM`** (не завышать без стабильности) | **`audit.section_fallback`**, **`audit.backoff`** |
| Рост **`audit.backoff`** (`rate_limited` / `timeout`) | Уменьшить parallelism или увеличить **`AMKA_AUDIT_LLM_DELAY_MS`** | **`audit.backoff`**, **`audit.per_section_done`** |
| После LLM-аудита **пустой `work_needed`**, baseline «молчит» | Модель не ставит французские **«…»** или цитата не из видимого блока; поднять **`AMKA_SECTION_AUDIT_CONTEXT_MAX_CHARS`**; при слабой модели в конструкторе снять **`section_llm_audit.require_work_needed_quotes`** (тогда фильтр цитат отключён) | В шаге **`section_audit`** может быть **`audit_context_truncated`**; см. блок ниже |
| Контекст секции усечён | Увеличить **`AMKA_SECTION_AUDIT_CONTEXT_MAX_CHARS`** (осторожно с размером промпта) | **`report_payload.audit_context_truncated`** на шаге аудита |

**Если все пункты `work_needed` от LLM отфильтрованы:** ответ проверяет, что подстрока в **«…»** встречается **буквально** в блоке контекста, попавшем в промпт (после усечения до **`AMKA_SECTION_AUDIT_CONTEXT_MAX_CHARS`**). Имеет смысл убедиться, что модель использует именно символы **«** и **»**, а цитата не длиннее 220 символов. Для диагностики без изменения политики качества временно отключите обязательность цитат в конструкторе (**`require_work_needed_quotes`: off**).

## Чеклист оператора и чтение логов

**Перед длинным прогоном:**

1. Убедиться, что stack2 (Llama) и маркетинговая модель отвечают; при необходимости — `podman logs` контейнеров stack2/stack0.
2. Проверить `MARKETING_CABINET_AI_RATE_LIMIT_PER_MIN` и ожидаемое число LLM-вызовов: полный аудит ≈ один вызов на видимый раздел + план + итог (плюс опциональные вызовы reconcile/tool-agent/IMC).
3. Для ускорения аудита на мощном железе: поднять `AMKA_AUDIT_LLM_PARALLELISM` (например 2–4) и при необходимости чуть уменьшить `AMKA_AUDIT_LLM_DELAY_MS` (не ниже разумного для стабильности Llama).

**Логи API (хост):**

```bash
podman logs --tail 400 stack0-eliteew-api-prod 2>&1 | rg '\[AMKA\]|amka\.'
```

или файл: eliteew-api.log *[runtime under docker/logs/stack0/eliteew-api-prod/]* — те же фильтры. Сообщения имеют префикс **`[AMKA]`** и поля **`event=...`**, **`run_id=`**, при исполнении шагов — **`step_id=`** (где доступно в контексте), для удобной склейки трассировки одного прогона.

**Прогресс в UI:** для активных статусов run деталь и список опрашиваются по **`poll_after_ms`** (нижняя граница интервала опроса на фронте согласована, см. **`useAmka.ts`**). Хук **`useAmkaRunDetail`** открывает **`GET .../runs/{id}/events`** (SSE): при успешном соединении деталь инвалидируется по событиям, **параллельный** таймер опроса детали отключается; при обрыве или ошибке остаётся опрос, возможен **один** повторное подключение к SSE с короткой задержкой. В потоке перед каждым снимком отправляется **комментарий SSE** (`: ping`), чтобы прокси реже обрывали «тихие» интервалы во время долгого `get_run_progress_snapshot`.

### Деплой SSE (nginx / stack0)

- В ответе роутера уже выставлены **`Cache-Control: no-cache`**, **`Connection: keep-alive`**, **`X-Accel-Buffering: no`** — для nginx за reverse proxy это отключает буферизацию тела ответа на этом location.
- Если поток всё же обрывается: проверить **`proxy_read_timeout`** / **`proxy_send_timeout`** на location API (значения ниже ожидаемой длительности прогона или дефолты «узкого» ingress дают обрыв без ошибки в приложении).
- В логах клиентский обрыв обычно не ошибка AMKA; смотреть **`podman logs stack0-eliteew-api-prod`** на исключения внутри генератора событий и отдельно сетевой путь до клиента.

### Прогон pytest (AMKA-тесты)

Полный импорт `api` тянет зависимости образа API. Имеет смысл запускать точечные тесты **внутри контейнера** `stack0-eliteew-api-prod` (или host venv **`.venv`**, совпадающий с `shared/api/requirements.txt`):

```bash
podman exec stack0-eliteew-api-prod sh -lc \
  'cd /app && python -m pytest tests/test_marketing_amka_service.py -q --tb=short'
```

На хосте из **`.venv`** (если установлены те же зависимости, что в образе):

```bash
cd shared/api
PYTHONPATH=.. ../.venv/bin/python -m pytest tests/test_amka_llm_plan_parse.py tests/test_amka_phase_plan_master.py tests/test_amka_quality_plan_audit.py tests/test_marketing_amka_service.py -q --tb=short
```

(`/app` — рабочий каталог кода API в образе stack0; host venv — **`.venv`**, не `api/.venv`.)

## Матрица «раздел → действие»

| Раздел | Тип шага |
|--------|-----------|
| `evidence` | `mutation_service`: импорт ИМК / привязка документов к RAG |
| `jtbd`, `value`, `analysis`, `segments`, `campaigns`, `funnel`, `tasks`, `alerts` | `project_generate_async` при не-report_only (очередь как у «Все разделы») |
| `client_interaction` | Сводка заказчика через отдельный LLM JSON → `marketing_customer_facing_summary` (если сводки ещё нет) |
| `imc` | **`imc_research`**: запуск ИМК (по умолчанию `imc_rag_jtbd`), зависимость плана от **`evidence`**; при `write_policy=report_only` — только отчёт без запуска |
| `overview`, `companies`, `projects`, `team` | Только аудит / отчёт |

AMKA не использует `marketing_ai_runs` как primary state store для собственного run, но **дочерние** AI-run создаёт при async-генерации разделов; для ИМК основной след выполнения — **`imc_research_runs`** и связанный UGS-request.

## Осторожность записи

В первой версии AMKA пишет автоматически только туда, где риск перезаписи минимален:

- пустые или почти пустые стратегические разделы через project-only autofill;
- задачи и алерты как добавляемые сущности;
- сводку для кабинета заказчика, если она ещё не существует.

Если раздел уже заполнен и автоматическая перезапись небезопасна, шаг остаётся report-only: отчёт показывается, но данные не перетираются.

## Operation-based runtime

Теперь master plan хранит не только текстовые задачи, но и список конкретных `operations` для каждого шага:

- `create`, `update`, `replace`, `delete`, `archive`, `status_transition`;
- `import_analysis_artifact` для подтягивания артефактов ИМК/анализов в project content;
- `attach_content_source` для привязки уже существующих документов как доказательной базы;
- project-only autofill как отдельный mutation path, а не как единственный способ записи.

Каждая операция нормализуется ещё на этапе планирования и получает:

- `entity_type` и при необходимости `entity_id`;
- `destructive`-флаг;
- `source_refs` с указанием, на какие IMC/doc артефакты она опирается;
- `reason` и `expected_effect` для UI review.

Во время выполнения AMKA сначала materialize-ит нужные источники, затем запускает mutation adapter по соответствующему разделу кабинета. Результат каждой операции сохраняется в `operation_trail` шага вместе с `before_snapshot`, `after_snapshot`, `mutated_entity_ids` и служебным `result`.

## Источники для планирования и записи

AMKA использует единый source catalog, собранный из двух типов данных:

- IMC/analyse runs, которые можно импортировать в проект как контент-источник;
- уже существующие project/company documents с извлечённым текстом.

Этот каталог попадает и в prompt планирования, и в runtime мутаций, поэтому модель видит не абстрактное «есть документы», а конкретные доступные источники, которые можно приложить к действию.

**Импорт ИМК в материалы проекта (RAG):** критерий готовности текста результата к `upsert_imc_run_as_project_rag_content` вынесен в `imc_run_row_ready_for_project_rag_upsert` ([`marketing_project_rag_sources_service.py`](../../../shared/api/services/marketing_project_rag_sources_service.py)) и совпадает с порогом `MIN_EXTRACTED_TEXT_CHARS` в [`marketing_project_rag_service.py`](../../../shared/api/services/marketing_project_rag_service.py). Список **`pending_imports`** в каталоге строится с тем же порогом (не только «completed и непустой текст»). Перед записью шагов плана выполняется префлайт [`sanitize_amka_plan_import_analysis_operations`](../../../shared/api/services/marketing_cabinet/amka_plan_import_sanitize.py): операции `import_analysis_artifact` для `imc_run` без достаточного `result_text` удаляются из плана с логом `plan.import_op_pruned`. После успешного шага `execute_section` с `imc` сервер дополнительно пытается выполнить upsert в RAG (`execute.imc.rag_upsert` / при отказе `execute.imc.rag_upsert_skipped`), чтобы снизить дублирование отдельного импорта на evidence.

## Review перед запуском

Над timeline Marketing Cabinet показывает **AMKA Control Center**: fallback ratio аудита, источник и статус плана, количество destructive operations, failed/no-save operations, zero-save sections и кандидатов reconcile. Эти числа строятся из `master_plan`, шагов `execute_section` и `final_assessment.strategy_graph_reconcile`, поэтому оператор видит риск до `approve` и пост-фактум после `resume`.

Перед `approve` UI показывает:

- сколько pending operations запланировано;
- сколько из них destructive;
- какие именно источники будет использовать каждый шаг;
- какой operation trail уже успел выполниться в прошлых шагах или retry;
- **снимок обзора проекта** (`overview_health_preview` в ответе `GET .../amka/runs/{run_id}`): те же метрики, что виджет Overview / `build_project_health`, чтобы было видно разрывы по **связям в БД**, а не только по тексту карточек.
- skip-toggle для конкретного `execute_section` (`skip_step_ids`) рядом с прежним пропуском всего раздела / операции.

## Обзор кабинета и граф стратегии в БД

Показатели обзора (покрытие JTBD→VP, «VP без JTBD», сегменты, кампании) считаются из **массивов UUID и счётчиков** в PostgreSQL. Если AMKA или autofill обновили только текст, но не проставили эти поля, проценты обзора не меняются.

Перед финальной оценкой run AMKA вызывает **`reconcile_marketing_strategy_graph_for_project`** (`shared/api/services/marketing_cabinet/amka_strategy_graph_reconcile.py`): эвристики и при необходимости LLM проставляют недостающие связи там, где это безопасно. Fuzzy-связи разделены по confidence: автозапись только от `_AUTO_FUZZY_THRESHOLD` (0.62), диапазон `_REVIEW_FUZZY_THRESHOLD` (0.42)–0.62 сохраняется как `candidate` для ручной проверки. Сегменты дополнительно могут получить evidence-связи в `linked_content_ids`; matcher для content sources использует не только generic title (`JTBD — RAG`, `SWOT — RAG`), но и короткий excerpt из `description` / `extracted_text`, иначе новые IMC-RAG материалы с общими заголовками не дают candidates для segment evidence. Для segment→content кандидатов в review-диапазоне AMKA может выполнить узкий LLM-confirm: если модель явно подтверждает, что content описывает/доказывает сегмент, связь записывается как `applied` с reason `llm_confirmed_low_confidence_fuzzy`; если нет — остаётся `candidate` для оператора.

| Ориентир метрики обзора | Поля таблиц |
|-------------------------|-------------|
| JTBD ↔ VP | `value_propositions.addressed_job_ids` |
| Сегменты и JTBD / evidence | `marketing_segments.linked_job_story_ids`, `linked_content_ids` |
| Кампании ↔ сегменты / VP | `marketing_campaigns.linked_segment_ids`, `linked_value_prop_ids` |

В JSON **`final_assessment.strategy_graph_reconcile`** сохраняется краткий отчёт (сколько сущностей обновлено, флаг использования LLM, первые строки лога) и `structured_details[]` с `link_kind`, `status=applied|candidate`, score/confidence и reason. UI финальной оценки раскрывает эти детали отдельным блоком «Сверка связей стратегии». На шаге **`value`** в `metrics_before` / `metrics_after` шага добавляются **`value_props_with_jtbd_count`** и **`value_props_gained_jtbd_links`** (сколько VP получили непустые `addressed_job_ids` после шага).

Автозаполнение VP (`document_autofill`) принимает в драфте **`job_story_ids`** (предпочтительно) наряду с **`job_story_titles`**; PATCH **value proposition** поддерживает **`job_story_ids`** → запись в `addressed_job_ids`.

Autofill и direct mutation для **сегментов** принимают **`linked_job_story_titles`** / **`linked_competitor_names`**; AMKA mutation (`_resolve_segment_mutation_payload`) перед PATCH резолвит titles в UUID по проекту. Явные **`linked_*_ids`** в operation payload проходят только DB-verify; REST PATCH сегмента по-прежнему ожидает UUID[].

Планировщик master plan инструктируется добавлять **`update`** со **связями** (titles или проверенные UUID), когда аудит фиксирует разрыв цепочки, а не только правку текста. Для **segment** предпочтительны **`linked_job_story_titles`** и **`linked_competitor_names`** (как в autofill prompt), а не «сырые» UUID от модели — mutation-слой всё равно verify-ит id в БД.

Подтверждение запуска остаётся единым на весь run. Дополнительно оператор может **исключить отдельные операции** по стабильному `operation_key` в теле `POST .../approve` (`skip_operation_keys`), пропустить целые разделы (`skip_section_keys`), либо **конкретные шаги** по UUID (`skip_step_ids` — из детали run, полезно при нескольких `imc`). Для API `POST .../resume` в статусе `awaiting_approval` принимает те же поля, что и approve.

## Пошаговое согласование

При старте с `per_step_execution: true` (только вместе с `run_mode: semi_auto`) после каждого завершённого `execute_section` run переходит в `awaiting_step_approval` до `POST .../continue-step` (или `resume` в этом статусе). Финальная переоценка выполняется в том же прогоне, когда очередь execute-шагов исчерпана.

## UI: блок «Этапы и отчёты»

Пока выполняется шаг с индексом N, панель по умолчанию показывает шаг N−1 (где обычно уже есть отчёт); для первого шага (N=0) остаётся он же. Над телом отчёта — строка «Сейчас выполняется» с ординалом и заголовком текущего этапа. При смене текущего running-шага или длины списка шагов вид снова подстраивается под правило выше (следующий этап стартовал → внизу предыдущий с данными). Ручной выбор шага сохраняется до следующей смены running / выбранного run / числа шагов.

## ИМК при `run_mode: auto`

- В снимок для master plan попадает **`run_mode`** и **`imc_types_catalog`** (активные `imc_rag_*` из БД). В **auto** промпт допускает **отсутствие** `imc_type_key` только если в плане **ровно один** шаг `imc`; при **нескольких** шагах `imc` у каждого должен быть явный уникальный ключ из каталога.
- Для `execute_section` с `section_key: imc` порядок такой: валидный `imc_type_key` из задачи плана (если LLM/нормализация его задали); иначе (только при одном шаге `imc` в валидном плане) эвристика по тексту шага (`rationale`, `title`, `work_needed` аудита раздела `imc`) плюс **агрегированный срез аудита всех разделов** из `context_payload.section_audits` (до ~10k символов: `work_needed` и укороченный `current_state` по секциям), с **исключением** типов уже выполненных в этом run шагов ИМК, затем запасной `imc_rag_jtbd`. Правила совпадения по ключевым словам — в `build_imc_auto_cabinet_haystack` / `_heuristic_imc_type_key_for_amka_auto` в `amka_service_support.py`.
- В логах при автоподборе: событие **`execute.imc.auto_type_key`** с полями **`type_key`**, **`haystack_chars`**, **`haystack_source`** (`cabinet_wide` | `single_section` | `empty_cabinet`), **`haystack_sections`** (число разделов, давших непустой вклад в агрегат).
- Значение `imc_type_key` из тела старта run в **auto** по-прежнему **не** подмешивается в этот fallback (в **semi_auto**: план → иначе дефолт из контекста старта). Оператор может **зафиксировать** тип, задав поле при старте — оно попадёт в контекст и используется в **semi_auto**; в **auto** для явного выбора типа ИМК задавайте `imc_type_key` в задаче плана или полагайтесь на эвристику/LLM. Опционально в задаче плана: `imc_focus` (`global` | `rf` | `mixed`).
- Перед `ImcService.run_research` execute подменяет **deprecated** ключи из плана/контекста на RAG-successor (`imc_legacy_type_successors.py`, `resolve_amka_imc_type_key_for_execution`); в логах — **`execute.imc.legacy_type_remapped`** (`from_key` → `to_key`). Старые планы с `imc_rag_deep_market_showcase` и прочими снятыми типами **не** падают с `deprecated_type_key`, а идут в successor (например `imc_rag_cabinet_analysis`).

## Ассистент «Команда» (`execution_mode: desktop_ensemble`)

- AMKA вызывает **ensemble** headlessly: ephemeral-чат на проект с `use_project_rag=true`, blueprint, roster 1–3 героев.
- Поля задачи: `ensemble_hero_ids`, `ensemble_template_hint` → принудительный blueprint (`amka_forced_blueprint_template_id`).
- Операторский конфиг execute: **`desktop_ensemble_enabled`** (default true), **`ensemble_fallback_to_tool_agent`** (default true) — при ошибке ensemble шаг не валит весь run, а идёт в tool-agent.
- Логи: **`execute.ensemble.start`**, **`execute.ensemble.done`**, **`execute.ensemble.fallback_tool_agent`**, **`execute.ensemble.stream_failed`**.
- Код: `amka_ensemble_core.py`, `amka_ensemble_mapping.py`. См. [AMKA-REFERENCE.md](AMKA-REFERENCE.md) §8.2.

## Экспорт отчёта

- **Сервер:** `GET /api/v1/marketing-cabinet/amka/runs/{run_id}/export.md` — сборка в `build_amka_run_export_markdown` (паритет с клиентским экспортом).
- **Клиент:** при ошибке сервера UI может собрать markdown локально из уже загруженных `run` / `steps` (см. код экспорта кабинета).
- Финальный блок экспортируется как единый «Итоговые факты и комментарий»: канонические факты и комментарий модели не дублируются в `final_assessment.report_markdown`.
