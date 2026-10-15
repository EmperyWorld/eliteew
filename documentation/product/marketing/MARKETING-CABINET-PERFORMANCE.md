# Маркетинговый кабинет — производительность и загрузка данных

**Статус:** канон (2026-05-27)  
**Связь:** [MARKETING-CABINET.md](MARKETING-CABINET.md) (продукт и API). Исходный behavioral audit (2026-05-26) и session summaries — soft-retired с `worklog/` → `trash/`; хронология в `git log`.

Полное описание программы оптимизации MC: **волны 2–25** (2026-05-27), паттерны TanStack Query, gating-модули, новые API, smoke и деплой.

---

## 1. Исходная точка (аудит 2026-05-26)

| Наблюдение | Следствие для программы |
|------------|-------------------------|
| Fluidity **6/10** | Переключение вкладок ощущается как «сеть», не «кэш» |
| `MARKETING_LIVE_QUERY_OPTIONS` без долгого `staleTime` на всём | Позже: `staleTime` 15 с, `gcTime` 5 мин на live-запросах |
| Фоновые запросы на неактивных вкладках (`content`, dashboard layout, AI/IMC rail) | Gating по `activeView` + engage по hover |
| Списки без `limit` / без виртуализации | API default 200 + `total`; UI `VirtualVariableList` при > 25 |
| SSE чат без abort при unmount | `AbortController` + abort при смене контекста и уходе с `chat` |
| Нет real-time co-editing | Вне scope; REST + TanStack Query |

---

## 2. Архитектура решения

### 2.1. Принципы

1. **Запрос только там, где UI нужен сейчас** — `enabled` в `useQuery` завязан на `activeView` и/или явный **engage** (hover, focus, open popover).
2. **Один источник правды для кэша** — общие `queryKey` (foundation projects, segments/VP в кампаниях, `live-jobs-summary`).
3. **Лёгкие COUNT вместо тяжёлых list** — badge Job Center и rail через `live-jobs-summary`.
4. **Code-splitting** — тяжёлые section/view chunks через `React.lazy`; prefetch по hover в сайдбаре (дашборд, AMKA).
5. **Документация как код** — gating вынесен в `marketingCabinet*Gating.ts` + Vitest.

### 2.2. Карта gating-модулей (фронт)

| Модуль | Файл | Назначение |
|--------|------|------------|
| Dashboard bundle | `marketingCabinetDashboardGating.ts` | `project-dashboard`, layout, poll AI/IMC rail |
| Foundation | `marketingCabinetFoundationGating.ts` | `listCompanies`, `listProjects`, stub company/project |
| Toolbar content | `marketingCabinetToolbarContentGating.ts` | `listProjectContent` в тулбаре |
| Client interaction | `marketingCabinetClientInteractionGating.ts` | docs/shares/lead content по вкладкам CI |
| Live jobs counts | `utils/marketingCabinetLiveJobsCounts.ts` | poll interval из summary |
| Prefetch | `marketingCabinetModulePrefetch.ts` | AMKA chunk + `self-profile` |

### 2.3. Ключевые хуки

| Хук | Ответственность |
|-----|----------------|
| `useMarketingCabinetFoundationQueries` | companies, projects, team members, self-profile, stubs |
| `useMarketingCabinetProjectEntityQueries` | JTBD, VP, SWOT, competitors, researches, content, live-jobs-summary |
| `useMarketingCabinetDashboardBundle` | active layout + `project-dashboard` |
| `useMarketingCabinetChatController` | SSE чат, abort, history |
| `useMarketingCabinetDashboardChrome` | rail signals (в т.ч. из live-jobs-summary) |

### 2.4. Константы (`constants.ts`)

| Константа | Значение | Смысл |
|-----------|----------|--------|
| `MARKETING_SECTION_LIST_FETCH_LIMIT` | 200 | Списки разделов (API max) |
| `MARKETING_CONTENT_LIST_FETCH_LIMIT` | 80 | Документы проекта в MC |
| `MARKETING_FOUNDATION_LIST_FETCH_LIMIT` | 200 | Компании / проекты в тулбаре |
| `MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD` | 25 | Порог `VirtualVariableList` |
| `MARKETING_AI_RUNS_PANEL_LIMIT` | 50 | История в AI Studio |
| `MARKETING_LIVE_QUERY_OPTIONS` | stale 15 s, gc 5 min | «Живые» entity-запросы |

**Query keys:**

- `marketingCabinetFoundationProjectsQueryKey(companyId)` → `['marketing','projects', companyId, 200]`
- `marketingCabinetContentQueryKey(projectId, companyId)` → `['content','marketing', projectId, companyId, 80]`
- `['marketing','project-live-jobs-summary', projectId]`
- `['marketing','company-live-jobs-summary', companyId]`

---

## 3. API (бэкенд, волны 2–19)

### 3.1. Списки с `limit` / `offset` / `total`

Эндпоинты маркетингового кабинета (и связанные): campaigns, segments, funnels, tasks, alerts, JTBD, VP, researches, competitors, SWOT — без `limit` на API отдаёт **≤ 200** строк и поле **`total`**.

### 3.2. Live jobs summary (волны 18–19)

| Метод | Путь | Ответ |
|-------|------|--------|
| GET | `/api/v1/marketing-cabinet/projects/{project_id}/live-jobs-summary` | `{ ai_active_total, imc_active_total }` |
| GET | `/api/v1/marketing-cabinet/companies/{company_id}/live-jobs-summary` | то же для компании |

**Код:** `api/routers/marketing_cabinet/projects.py`, `live_jobs_summary.py`, `ai.py` (`count_active_marketing_ai_runs`), `imc_service.py` (COUNT).

**Фронт:** `dashboardApiSlice.ts` — `getProjectLiveJobsSummary` / `getCompanyLiveJobsSummary`; Zod в `marketingCabinetApiZod.ts`; pilot `openapi/pilot/live-jobs-summary.openapi.json`, скрипт `pnpm run openapi:pilot:live-jobs-summary`.

**Заменяет:** два list-запроса AI runs (limit 80) + IMC researches (limit 80) для badge/rail на рабочих вкладках.

### 3.3. Foundation read-by-id (волна 22)

| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/api/v1/companies/{company_id}` | Подпись в тулбаре без `listCompanies` |
| GET | `/api/v1/projects/{project_id}` | Подпись проекта на вкладке «Компании» |

Клиент: `cabinetOrganizationsApiSlice.ts` — `getCompany`, `getProject`.

### 3.4. Участники проекта (волна 10)

`GET /api/v1/projects/{id}/members` → `{ items, total }`; UI — `useInfiniteQuery`, «Загрузить ещё».

---

## 4. Программа волн (2026-05-27)

Хронология волн: `git log` по путям кабинета (session summaries soft-retired с `worklog/`).

### 4.1. Волны 2–16 (сводка)

| Wave | Тема |
|------|------|
| 2 | API limit+total tasks/alerts/segments; truncation i18n; layout query gating |
| 3 | Funnels limit+total; FunnelView/Imc/Chat virtualization |
| 4 | JTBD/VP/researches/competitors API default limit+total |
| 5 | SWOT limit; content 80; Evidence virtualization |
| 6 | Companies/projects nav virtualization; foundation limit 200 |
| 7 | Content pick list virtual; unified content query key |
| 8 | Team member list virtual |
| 9 | Virtual threshold constant; autofill draft windowing |
| 10 | Project members paginated API + infinite UI |
| 11 | Team infinite members; friends list gated |
| 12 | Segments virtual; dashboard bundle skip; self-profile only amka |
| 13 | Dashboard skip views; AI/IMC poll off chat/rag/amka; checkbox pick lists |
| 14 | Client-interaction tab gating; RAG catalog virtual |
| 15 | Dashboard allow-list overview only; Job Center lists on popover |
| 16 | Job Center badge dedup; IMC rag-hints/sources gating |

### 4.2. Волны 17–25 (детально, текущая сессия Cursor)

| Wave | Изменения | Файлы (ключевые) |
|------|-----------|------------------|
| **17** | Нет `listProjects` на вкладке `companies`; lazy `project-dashboard` для autofill «Сводка клиента» | `marketingCabinetFoundationGating.ts`, `CustomerFacingSummaryEditor.tsx` |
| **18** | `GET .../projects/{id}/live-jobs-summary`; один TanStack query вместо dual rail-active lists | `projects.py`, `ai.py`, `imc_service.py`, `useMarketingCabinetProjectEntityQueries.ts`, `MarketingAiJobCenter.tsx` |
| **19** | `GET .../companies/{id}/live-jobs-summary`; OpenAPI pilot `live-jobs-summary` | `live_jobs_summary.py`, `domains/marketing.py`, `dashboardApiSlice.ts` |
| **20** | Deferred `listCompanies`; CI docs/shares только на вкладках документов/презентаций; engage тулбара foundation | `marketingCabinetClientInteractionGating.ts`, `MarketingCabinetToolbar.tsx` |
| **21** | Кампании: общие query keys сегментов/VP; presets/templates дашборда только при развёрнутом тулбаре | `CampaignsView.tsx`, `OverviewInteractiveDashboard.tsx` |
| **22** | Stub GET company/project; `onOpen` селектов → engage foundation | `useMarketingCabinetFoundationQueries.ts`, `MarketingCabinetSelect.tsx` |
| **23** | Deferred `listProjectContent`; engage документов; сохранение `mc_content` | `marketingCabinetToolbarContentGating.ts`, `DocumentAutofillAction.tsx` |
| **24** | Единый `marketingCabinetFoundationProjectsQueryKey`; AI Studio `projectsForCompany`; abort SSE при уходе с `chat` | `constants.ts`, `AIStudioView.tsx`, `useMarketingCabinetChatController.ts` |
| **25** | Lazy Companies/Projects/Team/JTBD/Value/Analysis sections; prefetch AMKA на hover сайдбара | `MarketingCabinetPage.tsx`, `marketingCabinetModulePrefetch.ts`, `MarketingCabinetSidebar.tsx` |

Канон поведения — этот файл и [MARKETING-CABINET.md](MARKETING-CABINET.md); отдельный session-summary файл не требуется.

---

## 5. Поведение по контурам (оператор)

### 5.1. Foundation (компания / проект)

| Ситуация | Сеть |
|----------|------|
| JTBD + `mc_company` + `mc_project` в URL, без hover тулбара | `GET /companies/{id}`, `GET /projects/{id}` (stub), `GET /projects?…` при рабочей вкладке |
| Hover / focus блок «Компания → проект» или открытие селекта | `GET /companies?limit=200` (если ещё не в кэше) |
| Вкладка «Компании» | Нет `listProjects` |
| Вкладка setup (`companies`/`projects`/`team`) | Полные списки сразу |

### 5.2. Документы в тулбаре

| Ситуация | Сеть |
|----------|------|
| JTBD, сегменты, кампании… | Нет `GET /api/content` до engage |
| Evidence, overview, AI Studio, IMC | `listProjectContent` (limit 80) по умолчанию |
| Hover документов / open select / «Из документа» | Включение fetch + сохранение `mc_content` |

### 5.3. Job Center и rail

| Ситуация | Сеть |
|----------|------|
| Рабочая вкладка + проект | Poll `.../projects/{id}/live-jobs-summary` (не два list по 80) |
| Только компания | `.../companies/{id}/live-jobs-summary` |
| Popover Job Center закрыт | Полные списки runs/IMC **не** грузятся |
| Popover открыт | Lists с limit 40/30, poll пока есть active |

### 5.4. Дашборд

| Ситуация | Сеть |
|----------|------|
| Не overview / не overview_dashboard | Нет `project-dashboard`, нет active layout fetch |
| overview_dashboard + свёрнутый тулбар | Нет presets / layout-templates до разворота |
| Hover «Открыть дашборд» | Prefetch layout + dashboard bundle (K.107) |

### 5.5. Чат

- SSE с `AbortSignal`.
- Смена company/project — сброс timeline + abort.
- Уход с вкладки `chat` — abort in-flight stream.

### 5.6. Code-splitting

- Первый вход в JTBD не тянет chunk Analysis/Companies/… .
- Hover **AMKA** в сайдбаре — prefetch JS + `self-profile`.

---

## 6. i18n (новые ключи, волны 20–23)

| Ключ | Назначение |
|------|------------|
| `toolbar.hoverToLoadDocuments` | Документы отложены |
| `toolbar.documentContextActive` | `mc_content` без загруженного списка |
| `customerFacingSummary.hoverToLoadDashboard` | Autofill dashboard (wave 17) |

---

## 7. Тесты и верификация

| Слой | Что прогонять |
|------|----------------|
| A | Ruff: `shared/api/routers/marketing_cabinet/`, `imc_service.py`; Biome: `src/pages/MarketingCabinet/**` |
| B | Трассировка gating: вход `activeView` → `enabled` → отсутствие лишнего HTTP |
| C | Vitest: `marketingCabinetFoundationGating`, `ToolbarContentGating`, `DashboardGating`, `ClientInteractionGating`, `LiveJobsCounts`, `Stream`, `ApiZod` |
| API | `pytest api/tests/test_marketing_live_jobs_summary_schema.py` |

После правок API: `docker restart stack0-eliteew-api-prod` + health, затем focused pytest в контейнере.

После правок фронта: `pnpm run build:react-compiler` + `node scripts/verify-app-build-id.mjs`; recreate stack0 при prod.

---

## 8. Performance dashboard (2026-05-28)

Маркетинговый обзор получил отдельный финансовый срез поверх нормализованных фактов. Это не часть прежнего индекса готовности: блок отвечает на вопросы маркетолога про расходы, выручку, ROMI/ROI, CPA/CPL, лиды, конверсии, когорты и эффективность кампаний.

| Область | Контракт |
|---------|----------|
| API | `GET /api/v1/marketing-cabinet/projects/{project_id}/performance-dashboard` |
| Фильтры | `date_from`, `date_to`, `window_days`, `campaign_ids`, `sources`, `geos` |
| БД | `marketing_performance_spend_facts`, `marketing_performance_lead_facts`, `marketing_performance_revenue_facts` |
| Backend | `ProjectPerformanceService` → `ProjectPerformanceRepository`; ingestion: `project_performance_sync.py` |
| Frontend | `MarketingPerformanceDashboardPanel` + `useMarketingPerformanceDashboard` |

Инварианты:

- Ключ short-cache включает `user_id`, `project_id`, namespace и полный набор фильтров.
- Деление на ноль не превращается в HTTP 500: `cpl`, `cpa`, `roi`, `romi`, `conversion_rate` могут быть `null`.
- Если миграция фактов ещё не применена, API отдаёт пустой отчёт с `diagnostics[].code = performance_schema_missing`.
- После create/update/delete кампании или воронки backend запускает best-effort sync `sync_marketing_performance_facts(project_id)`. Сервис удаляет и пересобирает только строки с `metadata.source = cabinet_entity_sync`; будущие внешние факты не трогает.
- Sync-зерно MVP:
  - `marketing_campaigns.budget` → daily spend facts: при валидном `start_date`/`end_date` бюджет равномерно распределяется по дням кампании; без полной даты пишется один факт на `updated_at`/`created_at`/today с `sync_rule = single_day_updated_at_fallback`.
  - `marketing_funnel_stages`: первый этап `visitors` → `leads_count`, последний этап `conversions` → `conversions_count`; это proxy, в metadata пишется `lead_proxy = first_stage_visitors`, а `campaign_id` остаётся `NULL`.
  - `marketing_campaigns.actual_metric` → revenue facts только при явно revenue-like `target_metric_name`; пустое/непонятное имя метрики не считается выручкой.
- Projection fallback включается только когда под выбранные фильтры **нет matching fact rows**. Нулевые fact rows больше не заменяются приблизительной projection. Диагностика: `performance_projection_from_cabinet_entities`.
- Любой sync инвалидирует short-cache namespace `performance-dashboard` по project_id.
- Legacy `GET .../dashboard` сохранён и переведён за сервисный фасад `ProjectDashboardService`; JSON-контракт не менялся.

Проверка UI:

1. Открыть Marketing Cabinet → проект → «Обзор».
2. В блоке **Marketing performance** переключить окно 7/30/90 дней.
3. Ввести `sources` / `geos` через запятую.
4. Ожидание: меняются только запросы performance dashboard; вся страница не перезагружается.
5. После изменения `budget` кампании или stages воронки обновить блок: факты должны обновиться без ожидания TTL cache; при наличии matching facts диагностик projection быть не должно.

---

## 9. UX simplification guardrail (2026-05-28)

Маркетологи жаловались на перегрузку кабинета: плоское меню, внутренние аббревиатуры, смешение пользовательских и технических терминов. Для основной навигации введён grouped sidebar (`MARKETING_SIDEBAR_GROUPS`) без изменения `MarketingView` ids и backend-контрактов.

Инварианты:

- Интерактивный дашборд (`OverviewInteractiveDashboard`, `dashboard-widgets/**`) не входит в эту волну.
- Primary UI говорит простым бизнес-языком: `Задачи клиентов`, `Предложение`, `Рынок и конкуренты`, `Аудитории`, `Путь к заявке`, `Риски`, `Материалы для ИИ`.
- `project_rag`, `ai_studio`, `overview_dashboard` остаются доступными, но визуально уходят в группу **Ещё инструменты**.
- Deep links (`mc_view`) и права (`cabinet_modules`, `mc_module:*`) не переименовываются.
- Follow-up copy sweep: вторичные панели (`С заказчиком`, `Аудит проекта`, `Исследования с ИИ`, автозаполнение из документа, help blocks, notices/forms) также не должны выводить внутренние аббревиатуры как основной пользовательский текст. Исключение этой волны — тексты интерактивного дашборда и `dashboard-widgets/**`.

Smoke:

1. Открыть Marketing Cabinet с выбранным проектом.
2. Раскрыть левое меню.
3. Проверить группы: **Старт**, **Настройка**, **Позиционирование**, **Аудитория**, **Продвижение**, **Работа**, **Материалы**, **ИИ-помощники**, **Ещё инструменты**.
4. Проверить, что old deep link `mc_view=project_rag` открывает раздел, даже если он не в primary-группах.

---

## 10. Smoke-чеклист (регресс перф)

1. **JTBD** + проект: Network без `/api/content`, без `listCompanies?limit=200`, без AMKA chunk.
2. **Hover** компания в тулбаре → `listCompanies`.
3. **Кампании** после **Сегменты**: пикеры без повторного fetch (общий query key).
4. **Job Center** на JTBD: один `live-jobs-summary`; lists только при открытом popover.
5. **Компания без проекта**: company `live-jobs-summary`.
6. **Чат** → стрим → переход JTBD: стрим обрывается.
7. **Обзор** → hover **Дашборд** → prefetch; открыть дашборд → свернуть тулбар → F5 → нет presets до разворота.
8. **Hover AMKA** в сайдбаре → chunk; открыть AMKA быстрее.
9. **Из документа** на JTBD: после open — content + projects (foundation key).

---

## 11. Открытые хвосты

| Item | Действие |
|------|----------|
| OpenAPI export | `pnpm run openapi:export` при поднятом API → `openapi:refresh-pilots` для `live-jobs-summary` |
| Prefetch IMC / Project RAG | Тот же паттерн, что `marketingCabinetModulePrefetch.ts` |
| Fluidity re-score | Повторный браузерный прогон после деплоя (не в scope волн) |
| `openapi:export` в CI | Синхронизация `documentation/api/eliteew-openapi-export.json` |

---

## 12. Связанные пути (индекс изменённого кода)

### API

- `shared/api/routers/marketing_cabinet/projects.py`
- `shared/api/services/marketing_cabinet/project_dashboard_service.py`
- `shared/api/services/marketing_cabinet/project_dashboard_cache.py`
- `shared/api/services/marketing_cabinet/project_performance_service.py`
- `shared/api/services/marketing_cabinet/project_performance_repository.py`
- `shared/api/schemas/marketing_cabinet/performance.py`
- `shared/api/migrations/applied/20260528_01_marketing_performance_facts.sql`
- `shared/api/routers/marketing_cabinet/live_jobs_summary.py`
- `shared/api/routers/marketing_cabinet/ai.py`
- `shared/api/services/imc/imc_service.py`
- `shared/api/schemas/marketing_cabinet/__init__.py`
- `shared/api/domains/marketing.py`
- `shared/api/tests/test_marketing_live_jobs_summary_schema.py`

### Frontend (ядро)

- `shared/web/frontend/src/pages/MarketingCabinet/MarketingCabinetPage.tsx`
- `shared/web/frontend/src/pages/MarketingCabinet/constants.ts`
- `shared/web/frontend/src/pages/MarketingCabinet/shell/MarketingCabinetSidebar.tsx`
- `shared/web/frontend/src/pages/MarketingCabinet/help/blocks.ru.json`
- `shared/web/frontend/src/i18n/locales/ru/marketing.json`
- `shared/web/frontend/src/pages/MarketingCabinet/marketingCabinet*Gating.ts`
- `shared/web/frontend/src/pages/MarketingCabinet/marketingCabinetModulePrefetch.ts`
- `shared/web/frontend/src/pages/MarketingCabinet/hooks/useMarketingCabinet*.ts`
- `shared/web/frontend/src/pages/MarketingCabinet/hooks/useMarketingPerformanceDashboard.ts`
- `shared/web/frontend/src/pages/MarketingCabinet/components/MarketingPerformanceDashboardPanel.tsx`
- `shared/web/frontend/src/pages/MarketingCabinet/marketingPerformanceDashboard.ts`
- `shared/web/frontend/src/pages/MarketingCabinet/components/MarketingCabinetToolbar.tsx`
- `shared/web/frontend/src/pages/MarketingCabinet/components/MarketingAiJobCenter.tsx`
- `shared/web/frontend/src/pages/MarketingCabinet/components/MarketingCabinetSelect.tsx`
- `shared/web/frontend/src/pages/MarketingCabinet/components/DocumentAutofillAction.tsx`
- `shared/web/frontend/src/pages/MarketingCabinet/shell/MarketingCabinetSidebar.tsx`
- `shared/web/frontend/src/pages/MarketingCabinet/views/CampaignsView.tsx`
- `shared/web/frontend/src/pages/MarketingCabinet/views/OverviewInteractiveDashboard.tsx`
- `shared/web/frontend/src/pages/MarketingCabinet/views/AIStudioView.tsx`
- `shared/web/frontend/src/pages/MarketingCabinet/marketingCabinetApi/dashboardApiSlice.ts`
- `shared/web/frontend/src/pages/MarketingCabinet/marketingCabinetApi/cabinetOrganizationsApiSlice.ts`
- `shared/web/frontend/openapi/pilot/live-jobs-summary.openapi.json`

### Документация

- `documentation/product/marketing/MARKETING-CABINET.md` (§ перф, ссылка сюда)
- `documentation/product/marketing/README.md` (хаб; граница с EWA)
