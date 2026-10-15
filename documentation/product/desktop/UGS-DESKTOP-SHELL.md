# UGS в desktop shell

Краткая карта: как Unified Generation System попадает в окна рабочего стола EliteEW.

## Разбор цели (`UGSDesktopDeepLink`)

Источник правды по строкам/хешам: [`ugsDesktopDeepLink.ts`](../../../shared/web/frontend/src/pages/Desktop/utils/ugsDesktopDeepLink.ts) — `resolveUgsDesktopDeepLink`, `storeUgsDesktopDeepLink`, `consumeUgsDesktopDeepLink`, ключ `UGS_DESKTOP_DEEPLINK_STORAGE_KEY`, событие `UGS_DESKTOP_DEEPLINK_EVENT`.

- Страницы вида `ugs-hub`, `ugs`, `ugs-analytics`, `ugs-admin`, а также workflow builder — маппятся в `view` и опционально `workflowId`.

## Какое окно открыть (Hub vs Studio)

Чистая логика без React: [`desktopUgsOpen.ts`](../../../shared/web/frontend/src/pages/Desktop/utils/desktopUgsOpen.ts) — `resolveUgsDesktopWindowOpen`.

- **Только хаб** (view `hub` без workflow): окно приложения `UGSHubApp`, если есть в списке ярлыков или в `DEFAULT_APPS`.
- Иначе по умолчанию **UGS Studio** (`appComponent: 'UGS'`), если хаб недоступен — fallback на хаб.
- **Admin**, **дашборд** и **конструктор workflow** без прав UGS admin: в `UGSDesktopContainer` принудительно **hub**; deep link `view: dashboard` в [`desktopUgsOpen.ts`](../../../shared/web/frontend/src/pages/Desktop/utils/desktopUgsOpen.ts) также сбрасывается в **hub** (как для `admin`). API workflow — только админы (`require_ugs_admin_user` на `/api/v1/ugs/workflows*`).

Хук обёртки: [`useDesktopUgsOpenWindow.ts`](../../../shared/web/frontend/src/pages/Desktop/hooks/useDesktopUgsOpenWindow.ts) — вызывает `handleOpenWindow` с `initialPayload.ugsView` / `ugsWorkflowId`.

## Когда срабатывает открытие

1. **После coercion на `#/desktop`** — в sessionStorage может лежать очередь `consumePendingDesktopOpen` с `kind: 'ugs'`; тогда хук **`useLegacyPendingDesktopOpenEffect`** вызывает `storeUgsDesktopDeepLink(rawTarget)` (см. [`pendingDesktopOpen.ts`](../../../shared/web/frontend/src/pages/Desktop/utils/pendingDesktopOpen.ts)). Это должно выполняться **до** чтения deep link из session в первом эффекте **`useDesktopUgsDeepLinkEffects`** (порядок хуков в `DesktopWorkspaceContent`: legacy **перед** UGS). Иначе `consume` сработает с пустым session; отдельно событие `UGS_DESKTOP_DEEPLINK_EVENT` после `store` может «подстраховать» открытие, но сессионный путь должен оставаться корректным.

2. **`useDesktopUgsDeepLinkEffects`** — читает `consumeUgsDesktopDeepLink()` или `resolveUgsDesktopDeepLink(currentPage)`, открывает окно, при необходимости переводит shell на `desktop` и синхронизирует hash.

3. **Событие `UGS_DESKTOP_DEEPLINK_EVENT`** — то же открытие, когда `storeUgsDesktopDeepLink` диспатчит событие (например сразу после п.1).

4. **Навигация из embedded-приложений** — `onNavigate` в `DesktopAppPropsProvider` реализован хуком **`useDesktopShellOnNavigate`**: `resolveUgsDesktopDeepLink(target)` и `openUgsDesktopApp` (см. `DesktopWorkspaceContent`).

## Dashboard и Analytics (вкладки UGS Studio)

**Toolbar IA:** primary tablist = **Hub** + **Analytics** (`ugs-desktop-primary-tabs`). For UGS admins, a secondary tablist (`ugs-desktop-operator-tabs`) holds **Dashboard**, **Admin**, and **Builder** when a workflow is open — operator tools are not equal-weight rivals to Hub.

**Тема UI:** весь контур UGS (Hub, Dashboard, Analytics, Admin v1/v2, Workflows, Builder) использует CSS-переменные рабочего стола (`--desktop-surface-*`, `--desktop-text-*`, `--desktop-border-*`, `--desktop-accent-rgb`) из `#desktop-main[data-theme]`. Общие классы — [`ugsDesktopUi.ts`](../../../shared/web/frontend/src/features/ugs/shared/ugsDesktopUi.ts), Hub-токены — [`ugsHubThemeTokens.ts`](../../../shared/web/frontend/src/components/UGS/hub/ugsHubThemeTokens.ts). Провайдер темы — [`UgsHubShellThemeProvider`](../../../shared/web/frontend/src/components/UGS/hub/ugsHubShellThemeContext.ts) в [`UGSDesktopContainer`](../../../shared/web/frontend/src/pages/Desktop/components/UGSDesktopContainer.tsx) (и дублируется в Hub/Workspace для standalone-маршрутов).

- **Дашборд** — [`UGSDashboard.tsx`](../../../shared/web/frontend/src/components/UGSDashboard.tsx), view `dashboard`, **admin-only**: KPI из `GET /api/v1/ugs/stats` и `GET /api/v1/ugs/metrics`, все каналы `/providers/status`, превью активных задач, популярные типы, быстрые переходы. Chrome — [`UgsWorkspaceShell`](../../../shared/web/frontend/src/components/UGS/workspace/UgsWorkspaceShell.tsx); KPI/скелетон загрузки — [`UgsMetricCard`](../../../shared/web/frontend/src/components/UGS/workspace/UgsMetricCard.tsx), [`UgsWorkspaceLoading`](../../../shared/web/frontend/src/components/UGS/workspace/UgsWorkspaceLoading.tsx); семантика success/warning/danger и chart tooltip — [`ugsDesktopUi.ts`](../../../shared/web/frontend/src/features/ugs/shared/ugsDesktopUi.ts) (`UGS_WORKSPACE_SEMANTIC`, `ugsDesktopChartTooltipStyle`).
- **Аналитика** — [`UGSAnalytics.tsx`](../../../shared/web/frontend/src/pages/UGSAnalytics.tsx), view `analytics`, все авторизованные: 24 ч user-scoped `GET /api/v1/ugs/analytics` — KPI, stacked bar OK/Fail по типам, pie классов ошибок, таблица breakdown (`UGS_DESKTOP_TABLE`), recent errors. Подписи типов из `/types`; трансформы — [`ugsAnalyticsData.ts`](../../../shared/web/frontend/src/components/UGS/workspace/ugsAnalyticsData.ts). i18n: namespace `ugsAnalytics`.

## UI theme и shared tokens (2026-06)

**Инвариант:** UGS в desktop shell **не** использует изолированный slate/violet chrome. Все поверхности читают CSS-переменные `#desktop-main[data-theme]`: `--desktop-surface-*`, `--desktop-text-*`, `--desktop-border-*`, `--desktop-accent-rgb`, `--desktop-radius*`, `--desktop-shadow-*`.

**Провайдер темы:** [`UgsHubShellThemeProvider`](../../../shared/web/frontend/src/components/UGS/hub/ugsHubShellThemeContext.ts) в [`UGSDesktopContainer`](../../../shared/web/frontend/src/pages/Desktop/components/UGSDesktopContainer.tsx) (дублируется в standalone Hub/Workspace).

| Слой | Модуль | Назначение |
|------|--------|------------|
| Общий | [`ugsDesktopUi.ts`](../../../shared/web/frontend/src/features/ugs/shared/ugsDesktopUi.ts) | `UGS_DESKTOP_*` (root, form, table, btn, tabs), KPI/shortcut tiles, semantic badges, queue-ops и workflow execution badges |
| Hub | [`ugsHubThemeTokens.ts`](../../../shared/web/frontend/src/components/UGS/hub/ugsHubThemeTokens.ts) | Фильтры, chips, progress, meta badges (вынесено из `ugsHubSharedUi`) |
| Hub chrome | [`ugsHubSharedUi.tsx`](../../../shared/web/frontend/src/components/UGS/hub/ugsHubSharedUi.tsx) | Modal frame, loading panels, layout helpers |
| Admin v2 | [`ugsAdminV2Ui.tsx`](../../../shared/web/frontend/src/features/ugs/admin-v2/ugsAdminV2Ui.tsx) | Section/table/search/footer для v2 tabs |
| Workflows tab | [`ugsWorkflowsSharedUi.ts`](../../../shared/web/frontend/src/components/UGS/workflows/ugsWorkflowsSharedUi.ts) | Toolbar, cards, quick execute, filter chips |
| Workspace | [`components/UGS/workspace/*`](../../../shared/web/frontend/src/components/UGS/workspace/) | `UgsWorkspaceShell`, `UgsMetricCard`, `UgsWorkspaceLoading` |
| Builder | Retired 2026-07-28 | Legacy visual editor moved to soft-retired under `trash/` (id 20260728-135649); no active shell/theme owner remains in `src/` |

### Hub (view `hub`)

- **Layout width** — [`UGSHub.tsx`](../../../shared/web/frontend/src/components/UGSHub.tsx): content column `w-full` (no `max-w-7xl`); horizontal padding only (`px-4` / `sm:px-6` / `lg:px-8`).
- **Shell header** — [`UgsHubShellHeader.tsx`](../../../shared/web/frontend/src/components/UGS/hub/shell/UgsHubShellHeader.tsx): счётчик каналов OK/total, раскрытие provider list, degraded banner; secondary **Analytics** under refresh (not Dashboard). Quick Launch — type tiles only ([`UgsHubQuickLaunchSection.tsx`](../../../shared/web/frontend/src/components/UGS/hub/shell/UgsHubQuickLaunchSection.tsx)).
- **Фильтры задач** — [`UGSTaskFilters.tsx`](../../../shared/web/frontend/src/components/UGS/UGSTaskFilters.tsx): active filter chips + «Сбросить».
- **Список задач** — [`UgsHubTaskRow.tsx`](../../../shared/web/frontend/src/components/UGS/hub/UgsHubTaskRow.tsx), empty — [`UgsHubEmptyState.tsx`](../../../shared/web/frontend/src/components/UGS/hub/UgsHubEmptyState.tsx).
- **Queue snapshot** — [`UgsHubQueueOpsStrip`](../../../shared/web/frontend/src/components/UGS/hub/UgsHubQueueOpsStrip.tsx) (workflows tab, admin); full [`UgsHubQueueOpsPanel`](../../../shared/web/frontend/src/components/UGS/hub/UgsHubQueueOpsPanel.tsx) is not on Overview.
- **Результат задачи** — [`UgsHubResultContent.tsx`](../../../shared/web/frontend/src/components/UGS/hub/results/UgsHubResultContent.tsx): превью без scale-hover.

### Admin v2 (view `admin`)

Overview, Providers, Types, Workflows, Models, Settings — [`features/ugs/admin-v2/tabs/*`](../../../shared/web/frontend/src/features/ugs/admin-v2/tabs/). Card admin under `features/ugs/admin/` removed; shared desktop tokens live in `ugsAdminUi.tsx` / `ugsAdminV2Ui.tsx`.

- **Types** — row click / Bulk edit → [`TypesBulkEditModal`](../../../shared/web/frontend/src/features/ugs/admin-v2/components/TypesBulkEditModal.tsx) (full `GenerationTypeUpdate` via `type.patch`).
- **Workflows** — row click → full `ComfyUIWorkflowUpdate` editor in [`WorkflowsTabV2`](../../../shared/web/frontend/src/features/ugs/admin-v2/tabs/WorkflowsTabV2.tsx) (`json_body`, metadata, deps).

### Workflows tab

- **Каталог** — thin shell [`UGSWorkflowsTab.tsx`](../../../shared/web/frontend/src/components/UGS/UGSWorkflowsTab.tsx); orchestration [`useUgsWorkflowsTabController.ts`](../../../shared/web/frontend/src/components/UGS/workflows/useUgsWorkflowsTabController.ts); UI [`UgsWorkflowsToolbar.tsx`](../../../shared/web/frontend/src/components/UGS/workflows/UgsWorkflowsToolbar.tsx) / [`UgsWorkflowsListSection.tsx`](../../../shared/web/frontend/src/components/UGS/workflows/UgsWorkflowsListSection.tsx); filter helpers [`ugsWorkflowsFilterUtils.ts`](../../../shared/web/frontend/src/components/UGS/workflows/ugsWorkflowsFilterUtils.ts); cards [`WorkflowCard.tsx`](../../../shared/web/frontend/src/components/UGS/workflows/WorkflowCard.tsx). Toolbar/list/loading, toasts, `card*`, and estimate/runtime helpers: `ugsHub.workflows.*` (RU/EN; helpers take `TFunction`).
- **Быстрый запуск** — [`QuickExecuteModal.tsx`](../../../shared/web/frontend/src/components/UGS/workflows/QuickExecuteModal.tsx); copy: `ugsHub.workflows.quick*` (RU/EN).
- **Retired surface (2026-07-28)** — legacy visual Workflow Builder removed from active frontend/runtime and moved to soft-retired under `trash/` (id 20260728-135649). UGS Workflows no longer expose create/open-builder CTAs, and desktop deep links ignore the legacy `workflow-builder` hash.

### Env / миграции (этот UI-проход)

Новых env keys и SQL-миграций **нет**. Контракт API и OpenAPI pilot без изменений схем от UI polish; правки TypeScript guards в `services/api/ugs/schemas.ts` и `queueOps.ts` — только типизация/generated alignment.

### Проверка (Vitest, узкий набор)

```bash
cd shared/web/frontend
pnpm exec vitest run src/components/UGS src/features/ugs src/services/api/ugs
# ожидание: 17 files, 55 tests — pass (2026-06-21)
```

## Связанные документы

- Уведомления UGS (блоки in-app / браузер ОС, профиль `notifications.ugs`): настройки в центре уведомлений рабочего стола; логика — [`useUgsTaskTransitionNotifications`](../../../shared/web/frontend/src/hooks/useUgsTaskTransitionNotifications.ts). Тосты срабатывают при смене статуса в `recent_transitions` из tray poll — **не** требуют открытого UGS Hub.
- Tray-поллинг UGS для shell (`TaskbarTrayGafCluster`/`useDesktopTrayItems`) — [`GET /api/v1/ugs/tasks/tray-summary`](../../../shared/api/routers/ugs/tasks_routes.py) через [`useUgsActiveTasksTray`](../../../shared/web/frontend/src/pages/Desktop/hooks/useUgsActiveTasksTray.ts): `active_count`, `active_tasks`, `recent_transitions`. Интервалы: **20 s** (active, foreground), **45 s** (active, фон вкладки), **90 s** (idle). Refetch при `focus` / `visibilitychange`.
- **«Зависшая» задача в UGS Hub** — [`useUgsStuckTaskAlerts`](../../../shared/web/frontend/src/hooks/useUgsStuckTaskAlerts.ts) (монтируется только в `UGSHub.tsx`): предупреждение после ~2× `estimated_time`, **без автоотмены** (с 2026-05); даты API — UTC через [`parseServerUtcIsoMs`](../../../shared/web/frontend/src/utils/parseServerUtcIso.ts). Для музыки минимум **600 s** нормы, если тип ещё не в справочнике Hub.
- **UGS admin queue snapshot в Hub:** на «Воркфлоу» — компактная полоска [`UgsHubQueueOpsStrip`](../../../shared/web/frontend/src/components/UGS/hub/UgsHubQueueOpsStrip.tsx) (клик → UGS Admin). Полный [`UgsHubQueueOpsPanel`](../../../shared/web/frontend/src/components/UGS/hub/UgsHubQueueOpsPanel.tsx) на «Обзор» **не** монтируется. Снимок `GET /api/v1/ugs/admin/queue-ops`; runbook — [`UGS-QUEUE-OPERATIONS-RUNBOOK.md`](../../platform/docker-re_doc/UGS-QUEUE-OPERATIONS-RUNBOOK.md).
- **Бесконечная лента задач Hub:** [`useUgsTasksInfinite`](../../../shared/web/frontend/src/hooks/api/useUgsTasksInfinite.ts) + scroll-sentinel [`useUgsTasksAutoLoadMore`](../../../shared/web/frontend/src/hooks/api/useUgsTasksAutoLoadMore.ts); при backlog в queue-ops UGS admin — proactive prefetch [`useUgsHubTasksBacklogPrefetch`](../../../shared/web/frontend/src/hooks/api/useUgsHubTasksBacklogPrefetch.ts) (до 3 страниц).
- **Генерация из чата спутника** — отдельная панель companion task runs, не UGS Hub: [EWA-COMPANION-OPERATIONS-PANEL.md](../ewa/EWA-COMPANION-OPERATIONS-PANEL.md).
- Уведомления GAF Chat (`notifications.gaf.incoming_message`): центр уведомлений; доставка — [`GAFChatProvider`](../../../shared/web/frontend/src/pages/Desktop/context/GAFChatProvider.tsx).
- **Доверенный пользователь:** `users.is_trusted` (выдаётся UGS-админом, `PATCH /api/v1/ugs/admin/users/{id}/trusted`); в профиле и GAF/друзьях бейдж [`TrustedUserBadge`](../../../shared/web/frontend/src/components/ui/TrustedUserBadge.tsx).
- **Системный пользователь GAF:** `users.is_system_account`, фиксированный UUID в [`gaf_chat/constants.py`](../../../shared/api/gaf_chat/constants.py) и миграции `20260410_users_trusted_system_gaf.sql`; вход через SSO отключён (`oauth2_auth`); поиск друзей и старт чата по username скрывают системного пользователя; сервисные сообщения (например изменение энергии UGS) — [`gaf_chat/system_notifications.py`](../../../shared/api/gaf_chat/system_notifications.py) и `GafChatService.send_service_message_to_user`.
- Тарифы типов в UGS Hub: модальное окно с группировкой по `type_metadata.product_area` (fallback — эвристика по `type_key` в [`ugsGenerationProductArea.ts`](../../../shared/web/frontend/src/utils/ugsGenerationProductArea.ts)); опциональная SQL-заполнение метаданных — `api/migrations/pending/20260403_generation_types_product_area_meta.sql`. В UI стоимость названа **энергия** (⚡); пересчёт `generation_types.cost_credits` и подписи провайдеров `generation_providers.display_label` — миграция `api/migrations/pending/20260403_ugs_energy_costs_and_provider_labels.sql`; публичные подписи каналов на фронте — [`ugsProviderDisplayLabel.ts`](../../../shared/web/frontend/src/utils/ugsProviderDisplayLabel.ts). Аналитика: `success_rate` в API нормализован к 0..1 в `unified_generation_service.get_analytics_summary` (метрики SQL в процентах).
- **Creative Studio (изображения / видео / музыка):** генерация через UGS по `type_key` в `generation_types`. **Image Studio** (Wave 2, 2026-09-02): типы `image_studio_*` идут через **очередь UGS + SSE** (`POST /api/v1/image-studio/*/stream`), без `skip_queue` — см. миграцию `api/migrations/applied/20260902_image_studio_queue_enabled.sql` и [`../IMAGE-STUDIO.md`](../IMAGE-STUDIO.md). Синхронные POST `/image-studio/*` без `/stream` возвращают **410** `image_studio_sync_retired`. Для остальных creative-типов `skip_queue` в метаданных по-прежнему отключает очередь (`unified_generation_service`). Списание — `cost_credits`; на основных кнопках студий показывается стоимость (⚡) из [`GET /api/v1/ugs/types`](../../../shared/api/routers/ugs/types_providers.py) и хука [`useCreativeStudioUgsCosts.ts`](../../../shared/web/frontend/src/hooks/useCreativeStudioUgsCosts.ts). Нехватка кредитов — **402** (`detail.code=insufficient_credits`). Миграция типов: `api/migrations/applied/20260403_creative_studio_ugs_types.sql`. Отдельное desktop-приложение **ComfyUI** (iframe) снято; голосовые алиасы «comfy» ведут в **Image Studio**.
- Аудит AI-маршрутов (UGS vs legacy): [`../UGS-AI-ROUTES-AUDIT.md`](../UGS-AI-ROUTES-AUDIT.md)
- Навигация shell: [`DESKTOP-ONLY-NAV.md`](DESKTOP-ONLY-NAV.md)
- Телеметрия UGS на store/consume: `emitUgsFrontendTelemetry` в `ugsDesktopDeepLink.ts`
