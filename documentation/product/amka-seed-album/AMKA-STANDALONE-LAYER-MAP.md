# AMKA · standalone layer map

Статус: рабочая карта миграции.

Карта показывает, как текущий код **маркетинговой AMKA** раскладывается на самостоятельный компонент (core / driver / adapter). Она не отменяет `AMKA-REFERENCE.md`: справочник маркетинга остаётся каноном **маркетинговых прогонов**. Различение контуров **AMKA vs EWA** — **[AMKA-CONTOURS.md](AMKA-CONTOURS.md)**. UI/HTTP **EWA** (`features/ewa/`, `/api/v1/ewa/*`) в эту карту **не входят**.

## 1. Целевая форма

| Слой | Что живёт здесь | Правило |
|------|------------------|---------|
| Core | lifecycle, statuses, policy, traces, artifacts, pulse | Не импортирует marketing, FastAPI routers, SQL helpers домена. |
| Driver contract | Read / Plan / Act / Observe / Policy / Pulse | Один контракт для маркетинга, desktop, документов, UGS-only сценариев. |
| Domain profile | section/entity/health graph конкретного домена | Данные остаются у домена. |
| Integration adapter | RAG, IMC, UGS, async jobs, mutation services | Побочные эффекты только здесь. |
| API facade | Стабильные маршруты клиента | Можно быть legacy-совместимым wrapper. |
| UI shell | Run launcher, timeline, approval, export | Не должен знать SQL/driver internals. |

## 2. Backend map

| Текущий файл | Целевой слой | Комментарий |
|--------------|--------------|-------------|
| `amka_service.py` | API/service facade | Пока фасад делегатов; постепенно должен тончать до вызовов core + marketing driver. |
| `amka_core/projection.py` | Core artifact projection | Переносимый projection из `AmkaRunResult` без PG/marketing imports. |
| `amka_core/driver_catalog.py` | Core metadata catalog | JSON-ready карта известных driver/profile; не runtime registry и не factory. |
| `amka_core/run_store.py` | Core store contract | Нейтральный `AmkaRunStore` + in-memory reference store; production PG остаётся adapter-уровнем. |
| `amka_run_lifecycle.py` | Core candidate + legacy facade | Create/list/detail/approve/resume/cancel сейчас смешаны с PG. В core уйдёт state machine, в driver/store — persistence. |
| `amka_run_store.py` | Store adapter | Сейчас PG-store для marketing tables; позже интерфейс `RunStore`. |
| `amka_run_snapshot.py` | Marketing driver Read | Project context, RAG, source catalog, operator config и IMC catalog остаются доменными. |
| `amka_phase_audit.py` | Marketing driver Plan/Audit | Секционный аудит знает marketing sections и health. |
| `amka_phase_plan.py` | Core candidate + Marketing Plan | Общая последовательность plan/persist близка к core, но LLM prompt и candidates доменные. |
| `amka_plan_candidates.py` | Marketing domain profile | Кандидаты завязаны на section keys и сущности кабинета. |
| `amka_phase_execute.py` | Core candidate + legacy execute runner | Очередь шагов станет core runner; конкретные действия останутся в driver. |
| `amka_phase_execute_section.py` | Marketing driver Act | Ветки IMC, tool-agent, mutation, autofill, client interaction — доменные actions. |
| `amka_phase_execute_misc.py` | Marketing integration adapter | Customer summary и tool-agent — не core. |
| `amka_execute_async_helpers.py` | Marketing integration adapter | IMC/UGS/project-generate ожидание и child jobs. |
| `amka_mutation_service.py` | Marketing Act adapter | Safe write-back в сущности кабинета; autofill routing по `autofill_target`; segment/competitor payload → DB lookup / verify (`_resolve_segment_mutation_payload`, `_normalize_competitor_mutation_payload`). |
| `amka_execute_operation_sources.py` | Marketing Act adapter | Materialize source refs перед операциями. |
| `amka_plan_import_sanitize.py` | Marketing policy/preflight | Проверка import-analysis операций перед записью в план. |
| `amka_strategy_graph_reconcile.py` | Marketing finalization adapter | Пост-фактум связность стратегии. |
| `amka_phase_finalize.py` | Core final candidate + Marketing summary | Compact final можно обобщать; health и markdown пока маркетинговые. |
| `amka_final_prompt_compact.py` | Artifact/prompt adapter | Полезный паттерн для core artifacts, но структура health доменная. |
| `amka_markdown_render.py` | Artifact renderer | Можно разделить на generic renderer + marketing blocks. |
| `amka_run_export_markdown.py` | API artifact exporter | Первый кандидат на расширение `pulse` в export. |
| `amka_logging.py` | Observability adapter | `[AMKA]` остаётся каноном логов; core trace дополняет его. |
| `amka_operator_config.py` | Policy config adapter | Сейчас global marketing config; дальше policy profile per driver/project. |
| `amka_preset_service.py` | Marketing profile config | Presets проекта, не core. |
| `amka_preset_merge.py` | Marketing Plan adapter | Merge extra tasks в доменный plan. |
| `amka_source_resolver.py` | Marketing Read/Plan adapter | Каталог источников домена. |
| `amka_section_mapping.py` | Marketing domain profile | section → autofill target и default execution mode. |
| `amka_analysis_registry.py` | Marketing domain profile | Registry execution modes для prompt/normalization. |
| `amka_llm_plan.py`, `amka_llm_runtime.py`, `amka_llm_json.py` | LLM adapter | Core не должен знать конкретный LLM provider; driver получает capability. |
| `amka_service_support.py` | Split in progress | Constants, DAG, normalizers, helpers; **`amka_background_tasks.py`** (spawn registry); **`amka_background_task_keys.py`** (ключи); **`amka_imc_auto_heuristic.py`** (IMC type в run_mode=auto). |
| `amka_imc_auto_heuristic.py` | Core-safe helper module | Чистая эвристика `imc_type_key` + haystack для auto; без БД. |
| `amka_phases/__init__.py` | Legacy import package | Останется до завершения миграции фаз. |

## 3. API map

| Файл | Целевой слой | Комментарий |
|------|--------------|-------------|
| `routers/marketing_cabinet/amka.py` | Marketing API facade | Сохраняет `/api/v1/marketing-cabinet/amka/*`; позже делегирует в core/driver. |
| `schemas/marketing_cabinet/amka.py` | Client contract | Не ломать; нейтральные core schemas появятся отдельно только после второго драйвера. |
| `schemas/marketing_cabinet/amka_operator_config.py` | Marketing policy config | Сейчас trusted-only global config. |
| `schemas/marketing_cabinet/amka_preset.py` | Marketing profile config | Project presets остаются клиентским контрактом кабинета. |

## 4. Frontend map (маркетинговая AMKA)

EWA desktop / companion: **`src/features/ewa/`**, **`src/services/ewa/`** — см. [AMKA-CONTOURS.md](AMKA-CONTOURS.md); не дублировать в таблице ниже.

| Текущий файл | Целевой слой | Комментарий |
|--------------|--------------|-------------|
| `features/amka/` | Marketing AMKA feature boundary | UI прогонов кабинета и standalone-артефактов AMKA; **без** кода EWA. |
| `features/amka/AmkaView.tsx` | Composition shell | Основной layout кабинета (`AmkaView`); cabinet API/UI импорты через `services/amka/marketingCabinetAmkaBridge`. |
| `pages/MarketingCabinet/views/AmkaView.tsx` | Legacy re-export | `export { AmkaView } from '@/features/amka/AmkaView'`. |
| `features/amka/MarketingCabinetAmkaView.tsx` | Thin bridge | Реэкспорт `AmkaView` из feature boundary. Только **маркетинговые прогоны** (cabinet API). |
| `features/amka/AmkaEntrypointNotice.tsx` | Standalone readiness UI | Подсказка о текущем входе AMKA через Marketing Cabinet и внутренней готовности standalone-слоя. |
| `features/amka/AmkaProjectionSummary.tsx` | Standalone projection UI | Отдельный feature-компонент для projection summary, stage/status counters и будущих AMKA shells. |
| `features/amka/amkaTypes.ts` | Standalone artifact types | Типы `pulse` / `standalone_projection` принадлежат AMKA feature, а Marketing Cabinet API их переэкспортирует. |
| `features/amka/amkaProjectionModel.ts` | Core UI model candidate | Pure helpers для `standalone_projection`: stage order, trace count, safe empty handling. |
| `features/amka/amkaViewUtils.ts` | Core UI helpers | Статусы, даты, snapshot helpers; canonical расположение; `pages/.../amkaViewUtils.ts` — thin re-export. |
| `hooks/api/useAmka.ts` | AMKA client hooks | Уже фактически feature-level; экспортируется через `features/amka`. |
| `services/api/amkaQueryKeys.ts` | AMKA cache boundary | Оставить независимым от конкретного view. |
| `services/amka/marketingCabinetAmkaBridge.ts` | Marketing adapter choke point | Типы, deep links, preset constants, cabinet UI chunks, **`marketingCabinetApi`**, export download, section keys — для `features/amka/*` без прямых импортов `pages/MarketingCabinet/*` в компонентах. |
| `features/amka/AmkaBuilderView.tsx` | Policy/profile UI | Builder; пресеты — `AmkaPresetsPanel`, стадии — `AmkaBuilderStageForm`. |
| `features/amka/AmkaPipelineTimeline.tsx` | Core UI candidate | Timeline читает generic trace/stage model. |
| `features/amka/AmkaStepDetailBody.tsx` | Artifact viewer | Generic artifact shell + marketing-specific payload blocks. |
| `features/amka/AmkaRunQualityHints.tsx` | Pulse/quality | Pulse / эвристика / audit stress hints. |
| `features/amka/AmkaOnboardingIntro.tsx` | Onboarding | Вводный блок и entrypoint notice. |
| `marketingCabinetAmkaExport.ts` | Artifact export | Добавить pulse block после backend support. |
| `marketingCabinetAmkaDeepLink.ts` | Marketing profile | Deep links к section keys остаются доменными. |

`MarketingCabinetPage.tsx` теперь lazy-load AMKA через `src/features/amka/MarketingCabinetAmkaView.tsx`, чтобы новый импортный путь появился без переписывания экрана.

## 5. Storage plan

Первая волна сохраняет:

- `marketing_amka_runs`;
- `marketing_amka_run_steps`;
- `marketing_amka_operator_config`;
- `marketing_amka_presets`;
- `marketing_amka_preset_templates`.

Нейтральные таблицы `amka_runs` / `amka_run_steps` проектировать только после второго реального драйвера. До этого слишком велик риск заморозить маркетинговые допущения в «универсальной» схеме.

## 6. Extraction order

1. Документы и контракты: RFC + layer map.
2. `amka_core`: contracts, engine, reference mock.
3. Marketing driver descriptor over existing `AmkaService`.
4. Tests for core lifecycle and policy.
5. Frontend feature bridge.
6. Pulse artifact in code and docs.
7. Standalone projection for current persisted marketing runs.
8. Second read-only core driver (`StaticReadOnlyAmkaDriver`) to keep the contract honest outside marketing.
9. Entrypoint/readiness doc + UI note: **маркетинговые прогоны AMKA** открываются через Marketing Cabinet; окно **`EwaApp`** — контур **EWA** (`features/ewa/`), см. **`AMKA-CONTOURS.md`**.
10. Driver/profile metadata catalog (`amka_core/driver_catalog.py`) without heavy adapter imports.
11. Frontend projection model helpers under `features/amka/`.
12. Core projection builder from `AmkaRunResult`, so non-persisted drivers can expose the same artifact shape.
13. Entrypoint/readiness UI component under `features/amka/`.
14. JSON-ready driver catalog serialization for future API/UI use.
15. Debt pass: align core projection status fields with persisted `step_status_counts`, and move AMKA artifact frontend types into `features/amka/amkaTypes.ts`.
16. Core `AmkaRunStore` contract + in-memory reference store.
17. Standalone `AmkaProjectionSummary` component for feature-owned projection display.
18. Future waves: move one UI/component or backend phase at a time, keeping API stable.

## 7. Definition of done for a wave

- Existing AMKA behavior remains stable.
- New core code has unit tests not tied to marketing DB.
- Documentation states whether a file is core, domain profile, integration adapter, facade, or UI.
- Any destructive action remains visible to policy/approval.
- `pulse` can explain no-op, doubt, preserved agreements, and next safe step.
