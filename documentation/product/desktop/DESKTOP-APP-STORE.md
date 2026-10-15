# Магазин приложений на рабочем столе (техническая справка)

Канон для разработчиков и операторов: как устроен каталог приложений в **desktop shell**, где лежит код, как подгружаются данные и медиа, какие применены оптимизации производительности.

**Пользовательские инструкции** (без стека): `product/handbook-user-docs/05-magazin-prilozheniy.md`, статья для KB: `product/handbook-kb-articles/kb-magazin-prilozheniy.md`.

## Назначение

- Каталог приложений с установкой/удалением, фильтрами, поиском, сортировкой, детальной карточкой («Подробнее»).
- На рабочем столе основной сценарий — **модальное окно** витрины и **оверлей детали** поверх shell, без отдельной полноэкранной страницы `#/desktop/store` как единственного входа (legacy hash может нормализоваться в `desktop` + открытие магазина — см. `DesktopWorkspaceContent`, `pageRouting`).

## Архитектура встраивания


| Слой                                | Роль                                                                                                                                                                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DesktopWorkspaceContent.tsx`       | Подключает `DesktopWorkspaceAppStoreLayer`, передаёт `storeApps`, обработчики install/uninstall, toast-обёртки (`useCallback`).                                                                                                          |
| `DesktopWorkspaceAppStoreLayer.tsx` | `AnimatePresence`: при открытой витрине и выбранном `appStoreDetailId` — модалка с **lazy**-`AppStoreCard`; иначе — `AppStore` со списком. `memo` на слое, prefetch чанка `AppStoreCard` через `requestIdleCallback` при `showAppStore`. |
| `AppStore.tsx`                      | Оркестратор витрины: modal/page variant, filter state, main scroll; сайдбар — `appStore/AppStoreCatalogSidebar`, hero/mobile bar — `appStore/AppStoreHeroSearchCluster`, сетка — `appStore/AppStoreCatalogSections`, modal shell — `appStore/AppStoreModalShell`.                                                                                                                                                 |
| `AppStoreCatalogCard.tsx`           | Карточка строки каталога: `memo` + сравнение пропсов по полям приложения и флагам установки.                                                                                                                                             |
| `AppStoreCard.tsx`                  | Тонкий оркестратор детали (lazy-чанк): shell class → `useAppStoreDetailController` → `AppStoreDetailStateViews` / `AppStoreDetailBody`.                                                                                                                                                                                     |
| `useDesktopInstalledApps.ts`        | `getStore` + `getInstalled`, нормализация `installed` в списке витрины, `installApp` / `uninstallApp` с инвалидацией кэша.                                                                                                               |


## Данные и TanStack Query

- Ключи: `['desktop', 'store']`, `['desktop', 'installed']` (и при необходимости `['desktop', 'ew-wallet']` для баннера баланса).
- Политика кэша (актуально для витрины): `**staleTime` ~45 с**, `**gcTime` ~5 мин**, `**refetchOnMount: true`** — без агрессивного `refetchOnMount: 'always'`; после install/uninstall и sync-событий список обновляется через `**invalidateQueries**`.
- Источник флага «установлено» для UI — согласование с `/desktop/installed`, см. комментарии в `useDesktopInstalledApps.ts`.
- Legacy visible copy from store/API passes through exact-match normalization in `desktopDefaultAppUserFacingCopy.ts` (legacy labels only). **Display names:** `desktop_app_catalog.name` / `description` are SSOT; FE `localizeDefaultDesktopAppCatalog*` does **not** overwrite non-empty store strings with `appStore.defaultApps` i18n. Desktop icon shortcuts sync name via API `reconcile_desktop_app_item_names_from_catalog` on `GET /items` / config bootstrap. See `DESKTOP-API-AND-APPS.md` §app display names.
- **Catalog description authoring (2026-09-13):** EN copy is agent-authored in `locales/en/appStore.json` (`defaultApps.<id>.description`) and is **not** yet Mode 1 STRICT (copywriter residual). RU is Gemma `ui-ru` into `locales/ru/appStore.json` and into `desktop_app_catalog.description` via migration (RU-first live SSOT). **`ui-ru` = Mode 1 STRICT UI ENGINE** (`eliteew-localization-engine`). Offline seed `DEFAULT_APPS` mirrors the RU strings. Do not invent RU product copy by hand. Live apply: first rewrite `20260913_01` is already in prod-core `schema_migrations`. Mode 1 VALUES follow-up SoT is `shared/api/migrations/applied/20260915_01_desktop_app_catalog_descriptions_mode1.sql` (`20260915_01` / `desktop_app_catalog_descriptions_mode1`) via `apply-eliteew-migrations.sh`. Do not keep a twin under `pending/`. Idempotent `IS DISTINCT FROM` — safe if live rows already match. Migration SQL updates catalog rows only; FE-only locale keys (`app-dashboard-favorites`, `app-local-service`, `app-widget-shelf`, `desktop-shell-settings`) stay in `appStore.json` / seeds and are not catalog `UPDATE` targets.

## Медиа (иконки и превью)

- Общие хелперы и компоненты: `shared/web/frontend/src/pages/Desktop/utils/storeAppMedia.tsx` (`storeIconUrls`, `storePreviewUrls`, `StoreAppMediaImage`, полоса превью в списке, hero в детали).
- Поля каталога в API: `icon_url`, `icon_url_2x`, `preview_url`, `preview_url_2x` — внешние URL; для прод-nginx и CSP см. `**documentation/platform/FRONTEND-SECURITY-NGINX-STATIC.md**` (`CSP_IMG_EXTRA` и т.д.).
- При ошибке загрузки удалённой картинки — откат на градиент/встроенную иконку (`AppStoreCatalogBadge`, превью в списке/детали).

## Состояние фильтров в сессии

- Ключ `**sessionStorage`:** `eliteew-desktop-app-store-filters` (`APP_STORE_FILTERS_SESSION_KEY` в `appStore/appStoreFiltersSession.ts`).
- Сохраняются: категория, фильтр «все/установленные/доступные», строка поиска, режим сортировки — чтобы после перезагрузки или remount не сбрасывать контекст витрины без необходимости.
- Подсказки по категориям: **`desktopUi.appCategoryHints`** (те же ключи, что у Пуска «По категориям») — под заголовком секции в основной колонке; при выборе одной категории на **`lg`** — ещё и полоса в сайдбаре (`AppStoreCatalogSidebar`, `StoreSectionHeading`).

## Производительность (сводка)

Ниже — намеренные приёмы (живые модули в `pages/Desktop/components/appStore/`).


| Область                 | Что сделано                                                                                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Чанки                   | `AppStoreCard` — **React.lazy** + **Suspense**; **prefetch** того же модуля при открытии витрины (idle или сразу).                                                                                                                                |
| Карточка списка         | `AppStoreCatalogCard` — **memo** с явным сравнением полей `StoreAppResponse` и флагов busy/ошибки; внутренние **useCallback** для кликов.                                                                                                         |
| Слой shell              | `DesktopWorkspaceAppStoreLayer` — **memo**; стабильные колбэки на панели детали (`stopPropagation`).                                                                                                                                              |
| Родитель                | `DesktopWorkspaceContent` — **useCallback** для error/success/open installed у слоя витрины.                                                                                                                                                      |
| Список / оболочка       | `content-visibility: auto` + `contain-intrinsic-size` на оболочке карточки; **memo** для `StoreCatalogCardPreviewStrip`, hero, бейджа каталога, заголовков секций (`StoreSectionHeading`).                                                        |
| Запросы                 | Кэш store/installed и EW-кошелька — см. раздел «Данные» выше.                                                                                                                                                                                     |
| Обработчики             | В `appStore/useAppStoreInstallFlow`: install/uninstall state, `handleInstall`, card busy/error/feedback; в `appStore/useAppStoreCatalogCardRenderer` — stable `renderAppCard`; в `AppStore`: **useCallback** для модалки (backdrop / stop propagation), поиска, фильтров, сортировки, навигации по категориям (**один** обработчик + `data-store-category`), «полный экран».               |
| Сводка по каталогу      | Один `**useMemo`** по массиву `apps`: карта «приложений по категориям» для навигации и одновременно числа **установлено** / **доступно** для сводки (без трёх отдельных проходов по списку).                                                      |
| Деталь (`AppStoreCard`) | State/handlers в `appStore/useAppStoreDetailController` (`fetchDetailFromApi`, `handleOpenInstalled`, `handleCopyDeepLink`); early UI — `AppStoreDetailStateViews` + `DesktopProductStatePanel`.                                                                                                                                     |
| Framer Motion / типы    | `**useReducedMotion()**` из `framer-motion` имеет тип `**boolean | null**`; в проп `**AppStoreCatalogCard**` (`reduceMotion: boolean`) передаётся `**useReducedMotion() ?? false**` (неизвестное предпочтение трактуем как «анимации разрешены»). |


Ограничение: при активной установке на одной карточке глобальный «busy» может требовать обновления кнопок на других карточках — это ожидаемо; виртуализация всей сетки не внедрялась (сложности с Framer Motion и раскладкой).

## Оформление интерфейса (актуальный слой UX)

Сводка для диффов и поддержки; пользовательский тон — в статьях handbook/KB (см. шапку документа).


| Область                                                        | Что сделано                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Витрина** (`AppStore.tsx` + `appStore/`)                                   | Сайдбар (`AppStoreCatalogSidebar`): поиск и блок «фильтр + сортировка»; hero/mobile bar (`AppStoreHeroSearchCluster`); без отдельного product header / EW wallet banner (убраны в UI cleanup 2026-07); заголовки секций каталога — счётчик в «пилле»; пустое состояние и скелетон — панели с фоном/ring; основная сетка — увеличенный `gap` на `md+`; модалка витрины — градиент в шапке, глубина тени.                                                                          |
| **Карточка списка** (`AppStoreCatalogCard.tsx`)                | Нижняя зона кнопок — лёгкий вертикальный градиент под разделителем (визуальное отделение от описания).                                                                                                                                                                                                                                                                                                                                                                                       |
| **Слой shell с деталью** (`DesktopWorkspaceAppStoreLayer.tsx`) | Модалка детали: тонкая акцентная полоса сверху, ring + `backdrop-blur`, скелетон `Suspense` в рамках с бордером.                                                                                                                                                                                                                                                                                                                                                                             |
| **Деталь приложения** (`AppStoreCard.tsx` + `appStore/AppStoreDetail*`) | Оркестратор ≤~300 LOC; body ≤~520 LOC (Wave N10: `AppStoreDetailDisclosures` + `AppStoreDetailActionBar`); loading/error/empty — `DesktopProductStatePanel` (notFound = empty). Акцентная полоса; скелетон hero+поля; биллинг/техблок inset; action bar на всю ширину. |
| **Premium wave 2026-05-28**                                    | Витрина получила desktop-native hero с метриками «установлено/доступно/категории», CTA на поиск и категории, а карточки/деталь используют `--as-premium-*` bridge tokens поверх `--desktop-*`/`--mc-*`. Контракт данных, install/uninstall handlers, `sessionStorage` фильтров и modal/page варианты не менялись.                                                                                                                                                                                |
| **Premium polish 2026-08-05**                                  | Storefront hero KPI labels: sentence-case `appStorePremiumMetricLabelClass` (`shellMeta10`) — **не** `labelOverline` shout (УСТАНОВЛЕНО…). Hero lead muted; title weight/tracking softened; top sheen on desktop hero. Lock: `AppStoreHeroSearchCluster.test.tsx` + compact-card token assert. |
| **Rail polish 2026-08-05**                                     | Sidebar: sentence-case `appStoreRailOverlineLabel*` / `appStoreMetaCaptionClass` (Клавиши / Сводка — не КЛАВИШИ/СВОДКА); category counts as soft pills; `.as-meta-caption` no longer forces uppercase. Locks: `AppStoreCatalogSidebar.test.tsx`, `AppStoreKeyboardHints.test.tsx`, `appStoreCompactCardUi.test.ts`. |


**Прокрутка левого rail (категории):** у `aside` задано `overflow-hidden`; обёртка списка категорий — **flex-колонка** `flex flex-1 min-h-0 flex-col overflow-hidden` (раньше не было `flex`, из‑за этого `flex-1` на `nav` не срабатывал, высота не ограничивалась и **вертикальный скролл** списка категорий на широком экране не появлялся). Внутри `nav` на `lg:` — `lg:flex-1 lg:min-h-0 lg:overflow-y-auto`.

Публикация новостей пользователям в ленту EWDesk — **вручную** из админки (раздел EWDesk); агент не вызывает API постов без токена оператора.

## Карта файлов (фронтенд)


| Путь (от `shared/web/frontend/`)                                | Назначение                                                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/pages/Desktop/components/appStore/AppStoreCatalogSidebar.tsx` | Left rail: search, view/sort filters, category nav, summary, keyboard hints. |
| `src/pages/Desktop/components/appStore/AppStoreHeroSearchCluster.tsx` | Premium hero metrics/CTA + sticky mobile catalog/search bar. |
| `src/pages/Desktop/components/appStore/useAppStoreInstallFlow.ts` | Install/uninstall state, handlers, card busy/error props. |
| `src/pages/Desktop/components/appStore/useAppStoreCatalogCardRenderer.tsx` | Stable catalog card renderer callback (install props from flow). |
| `src/pages/Desktop/components/appStore/AppStoreCatalogSections.tsx` | Loading skeleton, empty state, featured/recent rows, category grids. |
| `src/pages/Desktop/components/appStore/AppStoreModalShell.tsx` | Modal variant: backdrop, dialog panel, toolbar header (`aria-labelledby`). |
| `src/pages/Desktop/components/appStore/AppStoreInstallProgress.tsx` | Catalog status bar + sidebar busy hint (i18n). |
| `src/pages/Desktop/components/appStore/AppStoreInstallStatusBar.tsx` | Sticky progress banner during install/remove. |
| `src/pages/Desktop/components/appStore/useAppStoreDetailController.ts` | Detail fetch/install/deep-link state + derived flags (Wave N7). |
| `src/pages/Desktop/components/appStore/AppStoreDetailStateViews.tsx` | Loading / error(+retry) / not-found empty via `DesktopProductStatePanel`. |
| `src/pages/Desktop/components/appStore/AppStoreDetailBody.tsx` | Happy-path detail shell (hero → tags → related); wires disclosures + action bar (Wave N10 ≤~520 LOC). |
| `src/pages/Desktop/components/appStore/AppStoreDetailDisclosures.tsx` | Billing + technical `<details>` progressive disclosure (Wave N10). |
| `src/pages/Desktop/components/appStore/AppStoreDetailActionBar.tsx` | Installed status chips + open/install/uninstall CTAs (Wave N10). |
| `src/pages/Desktop/components/AppStore.tsx`                      | Оркестратор витрины: filter state, main scroll, modal/page shell wiring.                                              |
| `src/pages/Desktop/components/AppStoreCatalogCard.tsx`           | Карточка каталога (memo).                                                       |
| `src/pages/Desktop/components/AppStoreCard.tsx`                  | Тонкий оркестратор детали (lazy-чанк, Wave N7).                                                  |
| `src/pages/Desktop/components/AppStoreCatalogBadge.tsx`          | Иконка в списке (remote + fallback).                                            |
| `src/pages/Desktop/components/DesktopWorkspaceAppStoreLayer.tsx` | Модалка shell: список + деталь, lazy, prefetch.                                 |
| `src/pages/Desktop/DesktopWorkspaceContent.tsx`                  | Пропсы слоя витрины, toast после установки.                                     |
| `src/pages/Desktop/hooks/useDesktopInstalledApps.ts`             | Store/installed, install/uninstall.                                             |
| `src/pages/Desktop/services/desktopApi.ts`                       | `getStore`, `getInstalled`, `installApp`, `ew-wallet`, типы `StoreAppResponse`. |
| `src/pages/Desktop/utils/storeAppMedia.tsx`                      | URL медиа, изображения, memo-компоненты превью.                                 |
| `src/pages/Desktop/utils/desktopDefaultAppUserFacingCopy.ts`     | Exact-match нормализация legacy visible copy для встроенных desktop/store apps. |
| `src/pages/Desktop/utils/appStoreInstallError.ts`                | Локализованные сообщения об ошибках install/uninstall (402/403/404/409/410/5xx → `appStore.error.*`; без сырого API English). |
| `src/pages/Desktop/hooks/useDesktopWorkspaceOverlayState.ts`     | `showAppStore`, `appStoreDetailId`, `openAppStore` / `closeAppStoreModal`.      |


## Admin UI (operator App Store)

Отдельная поверхность от shell chrome (таскбар / окна / Settings comfort). Public import: `pages/Desktop/DesktopAppStoreAdminPage.tsx` (thin barrel) → `pages/Desktop/DesktopAppStoreAdmin/*`.

| Module | Responsibility |
|--------|----------------|
| `DesktopAppStoreAdminPage.tsx` | Tab shell / nav |
| `StorefrontAdminTab.tsx` / `MaintenanceAdminTab.tsx` | Showcase + maintenance |
| `CatalogTab.tsx` + catalog forms / `BulkGroupModal` | Catalog CRUD |
| `AccessGroupsTab.tsx` + group forms | Access groups |
| `adminChrome.ts` / `adminHelpers.tsx` / `types.ts` | Shared tokens, helpers, tab ids |

Vitest: `DesktopAppStoreAdminPage.a11y.test.tsx`, `DesktopAppStoreAdminPage.atomization.contract.test.ts`. Residual UX (operator density / progressive IA) is follow-up — do not fold into shell atomization waves.

## Связанные документы

- Навигация shell и hash: `product/desktop/DESKTOP-ONLY-NAV.md` (актуализировать отсылки: витрина в первую очередь как модалка в `DesktopWorkspace`).
- Безопасность статики и CSP: `platform/FRONTEND-SECURITY-NGINX-STATIC.md`.
- Общий вход фронтенда: `product/FRONTEND-DEVELOPER-ENTRY.md`.
- Access / entitlement: `product/desktop/DESKTOP-APP-STORE-ACCESS.md`.

## История изменений (кратко)

- **2026-08-05** — Sidebar rail: sentence-case shortcuts/summary captions; category count pills; `.as-meta-caption` without uppercase.
- **2026-08-05** — Storefront hero KPI labels: sentence-case `appStorePremiumMetricLabelClass` (no `labelOverline` shout); hero lead muted; desktop hero top sheen.
- **2026-07-14** — Wave N10: detail body split → `AppStoreDetailDisclosures` + `AppStoreDetailActionBar`; `AppStoreDetailBody` ≤~520 LOC; Vitest action-bar install/uninstall gates.
- **2026-06-30** — UI audit 9/20: install error mapper (402/403/404/409/410/5xx → i18n), embedded catalog polish (compact hero metrics, hide featured/recent), `aria-busy` on catalog during install, embedded install errors inline-only (no duplicate toast); Vitest contract in `appStore/__tests__/`.
- **2026-06-30** — App Store slice 3: catalog grid (`AppStoreCatalogSections`, `useAppStoreCatalogCardRenderer`) and modal shell (`AppStoreModalShell`) extracted to `components/appStore/`; `AppStore.tsx` orchestrator only; install flow unchanged.
- **2026-06-30** — App Store slice 2: install flow extracted to `components/appStore/` (`useAppStoreInstallFlow`, progress UI); catalog modal busy/escape contract unchanged.
- **2026-06-08** — App Store wave 19: detail inset/collapsible panels, quick facts, loading skeleton frames, action bar; shell Suspense parity; detail loading a11y.
- **2026-06-08** — App Store wave 18: rail overline labels, install status bar, detail expansion/system/factory status, wallet balance, modal `aria-labelledby`.
- **2026-06-08** — App Store wave 17: detail tags/badges, error/note panels, modal title и catalog install error на shared tokens (`appStoreCompactCardUi`).
- **2026-06-08** — App Store wave 16: shell typography tokens (`appStoreNavTitleClass`, hero lead, page header, section headings, detail section titles); Related row installed badge parity.
- **2026-06-08** — App Store wave 15: общие status badge классы (`appStoreCompactCardUi`), catalog card title/badge parity, Featured «New», `AppStoreViewStack` aria-label, `AppStoreCatalogBadge` typography header.
- **2026-06-08** — App Store wave 14: catalog card actions, detail description toggle, admin preview, wallet banner, detail modal skeleton a11y.
- **2026-06-08** — App Store wave 13: общие классы compact horizontal cards (`appStoreCompactCardUi`), Featured/Recent/Related rows, category jump, search input.
- **2026-06-08** — App Store wave 12: типографика экрана детали (`AppStoreCard`), EW wallet banner, active filters bar.
- **2026-06-08** — App Store wave 11: общий `AppStoreKbd`, premium hero и sidebar/summary на `DESKTOP_TYPOGRAPHY`.
- **2026-06-08** — App Store wave 10: подсказки Esc (очистка поиска / закрытие модалки), типографика карточек каталога на `DESKTOP_TYPOGRAPHY`.
- **2026-05-29** — legacy строки App Store для `app-ewa`, `app-desktop-ai-chat`, `app-marketing-cabinet`, `app-professional-worlds`, site-app ярлыков нормализуются в human-facing copy (`Ассистент`, `Ассистент`, `Студия сайтов`, `Контроль сайтов`, чистые описания без `CRM-lite` / `AI-инструменты` / `worker/jobs/runtime`) без смены technical ids.
- **2026-08-05** — `app-desktop-ai-chat` window/taskbar chrome: exact legacy titles `Чат Экспертов` и `AI Чат (Ollama)` → **«Ассистент»** (рядом с уже известным `AI Чат`); кастомные подписи не трогаются.
- **2026-04-07** — раздел «Оформление интерфейса», таблица по компонентам витрины и детали.

Хронология волн — changelog в этом файле выше; chronology иначе — `git log` по `appStore/`.
