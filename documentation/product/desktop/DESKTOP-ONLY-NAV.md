# Desktop-only navigation (shell)

## Summary

Full-screen product routes (`#/dashboard`, `#/ugs`, …) are **coerced** to the desktop shell (`#/desktop`) with a **pending window open** (sessionStorage) or UGS deep link storage. The top-level router (`AppRouter`) only renders:

- `desktop` — `DesktopWorkspace`
- `desktop/store` — `DesktopWorkspace` with the **app store modal** opened (витрина в `DesktopWorkspaceAppStoreLayer`, отдельной страницы `DesktopAppStorePage` в коде нет)
- `login` — login screen
- `admin` / `desktop-admin` — `UnifiedAdminPage`
- `default` — `DesktopWorkspace` (defensive)

## 2026-03 shell contract refresh

- `StartMenu` is the catalog surface for installed apps, pinned entries and desktop-level system entry points.
- `QuickSearch` is the launcher surface for recents, files and find-as-you-type; it shares recent-app state with Start via `useDesktopRecentApps`.
- `CommandPalette` is reserved for system/power actions and **does not** duplicate the app catalog (**P12**, 2026-07-28): no Apps / Open-{name} group from `displayItems`; role gate `launcherSurfaceAllowsAppCatalog` is Start-only.
- `Taskbar` is the single surface for active and pinned windows; same-app windows are grouped to keep dense multi-window workflows readable.
- `Win+1..9` now follows the pinned app order from the desktop/taskbar mental model, not the raw desktop icon order.
- Profile jumps from desktop shortcuts/widgets prime `SOCIAL_HUB_INITIAL_TAB_KEY`, so `SocialHubApp` can open directly on the profile tab inside the desktop shell.

## Implementation map

| Area | Role |
|------|------|
| [desktopOnlyLegacyRoutes.ts](../../../shared/web/frontend/src/pages/Desktop/utils/desktopOnlyLegacyRoutes.ts) | `SYSTEM_FULL_PAGE_ROUTES`, legacy page → `appComponent` / UGS |
| [desktopOnlyNavigation.ts](../../../shared/web/frontend/src/pages/Desktop/utils/desktopOnlyNavigation.ts) | `coercePageToDesktopShell`, `replaceHashWithDesktop` |
| [pendingDesktopOpen.ts](../../../shared/web/frontend/src/pages/Desktop/utils/pendingDesktopOpen.ts) | Queue peeked after mount; cleared on accept / terminal miss (**P8**: wait while `installedAppsLoading`) |
| [pageRouting.ts](../../../shared/web/frontend/src/utils/pageRouting.ts) | `resolveInitialPage`, `applyNavigationCoercion` / **`navigateDesktopShell`** (alias, reducer + импорт из UI), `syncLocationHashToPage`, `applyWidgetHashNavigation` |
| [DesktopWorkspaceContent.tsx](../../../shared/web/frontend/src/pages/Desktop/DesktopWorkspaceContent.tsx) | Legacy pending via `useLegacyPendingDesktopOpenEffect` (`peekPendingDesktopOpen`); UGS via `storeUgsDesktopDeepLink` |
| [useDesktopUrlLaunchEffects.ts](../../../shared/web/frontend/src/pages/Desktop/hooks/useDesktopUrlLaunchEffects.ts) | Открытие по URL: `?doc=` (DocEditor), параметры маркетингового кабинета в query |
| [useDesktopUgsOpenWindow.ts](../../../shared/web/frontend/src/pages/Desktop/hooks/useDesktopUgsOpenWindow.ts) / [useDesktopUgsDeepLinkEffects.ts](../../../shared/web/frontend/src/pages/Desktop/hooks/useDesktopUgsDeepLinkEffects.ts) | UGS: открытие Hub/Studio по deep link, session, событию после `storeUgsDesktopDeepLink` |
| [UGS-DESKTOP-SHELL.md](UGS-DESKTOP-SHELL.md) | Обзор потока UGS в desktop shell |

**Shell state (окна и виртуальные столы):** при авторизованном пользователе снимок открытых окон и набор виртуальных столов хранится в `desktop_configs.shell_state` (ключи `windows_snapshot`, `virtual_desktops`), см. `GET/PATCH /api/v1/desktop/shell-state` и [`DESKTOP-IMPLEMENTED-VS-STUB.md`](DESKTOP-IMPLEMENTED-VS-STUB.md) (раздел «Виртуальные рабочие столы и окна»). Подробный pipeline: [`DESKTOP-STATE-PERSISTENCE.md`](DESKTOP-STATE-PERSISTENCE.md).

**Assistant:** окно `EwaApp` / `EwaCompanionChatPanel` — продуктовый канон [`../ewa/README.md`](../ewa/README.md); idle GPU / presence — [`DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md`](DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md).

## System routes (full page)

`desktop`, `desktop/store`, `login`, `admin`, `desktop-admin` — not coerced to desktop-only shell.

## Legacy routes

All other `PageType` values in hash / localStorage are normalized and coerced: hash becomes `#/desktop`, optional `PendingDesktopOpen` or UGS deep link is stored for the desktop shell to open the window.

**Removed hash id:** `ui-showcase` is no longer a valid `VALID_PAGES` entry (unused UI showcase bundle). Old bookmarks fall through normalization like any unknown segment; they must not map to a misleading app open.

**Removed hash id (2026-07-28):** `workflow-builder` is retired. Old bookmarks now fall through normalization as unknown segments and must not open a UGS window or legacy editor surface.

## Programmatic navigation

`navigateDesktopShell` in `pageRouting.ts` (alias of `applyNavigationCoercion`) is what `SET_CURRENT_PAGE` calls in `useAppState`. Use `actions.setCurrentPage()` as before; legacy targets are rewritten to `desktop` and pending opens are queued automatically.

## Profile return (`sessionStorage`)

- Key: `PROFILE_RETURN_TO_SESSION_KEY` in [`storageKeys.ts`](../../../shared/web/frontend/src/constants/storageKeys.ts) (string value `profile_return_to`).
- [`App.tsx`](../../../shared/web/frontend/src/App.tsx) stores the current **`ShellPageType`** before navigating to `user-profile`.
- [`DesktopWorkspaceContent`](../../../shared/web/frontend/src/pages/Desktop/DesktopWorkspaceContent.tsx) sets `desktop` when opening profile from the desktop `onNavigate` path.
- [`UserProfile.tsx`](../../../shared/web/frontend/src/components/UserProfile.tsx) reads the key, accepts only shell routes (legacy `dashboard` → `desktop`), and uses **`getPageLabel`** for the back button when not on desktop.

## Shell persistence keys ([`storageKeys.ts`](../../../shared/web/frontend/src/constants/storageKeys.ts))

| Constant | Storage | String value | Role |
|----------|---------|--------------|------|
| `PROFILE_RETURN_TO_SESSION_KEY` | session | `profile_return_to` | Возврат из профиля |
| `INTENDED_PAGE_SESSION_KEY` | session | `intended_page` | Возврат после Keycloak login |
| `LAST_VISITED_PAGE_LOCAL_KEY` | local | `lastVisitedPage` | Восстановление маршрута при F5 (`SET_CURRENT_PAGE` в `useAppState`, не `login`) |

## Post-login return (`intended_page`)

- Key: **`INTENDED_PAGE_SESSION_KEY`** in [`storageKeys.ts`](../../../shared/web/frontend/src/constants/storageKeys.ts) (string `intended_page`).
- Запись: [`KeycloakInit.tsx`](../../../shared/web/frontend/src/components/KeycloakInit.tsx), [`services/api/client.ts`](../../../shared/web/frontend/src/services/api/client.ts), [`services/keycloak.ts`](../../../shared/web/frontend/src/services/keycloak.ts), [`utils/authRedirect.ts`](../../../shared/web/frontend/src/utils/authRedirect.ts).
- Чтение / одноразовое потребление: [`consumeIntendedPage`](../../../shared/web/frontend/src/utils/pageRouting.ts), [`readStoredPreferredPage`](../../../shared/web/frontend/src/utils/pageRouting.ts) (в т.ч. из [`App.tsx`](../../../shared/web/frontend/src/App.tsx) после логина).

## Appendix: Hash routing touchpoints (inventory)

Сводка по кодовой базе: где трогают hash / History API и зачем. **Единственная запись в `window.location.hash` в проде** (кроме тестов) — внутри [`syncLocationHashToPage`](../../../shared/web/frontend/src/utils/pageRouting.ts) в `pageRouting.ts`.

### Canonical helpers ([`pageRouting.ts`](../../../shared/web/frontend/src/utils/pageRouting.ts))

| Symbol | Role |
|--------|------|
| `normalizePageCandidate`, `VALID_PAGES`, aliases | Разбор сегмента hash → имя маршрута |
| `applyNavigationCoercion` | Coercion legacy → shell + `replaceHashWithDesktop` при необходимости |
| `navigateDesktopShell` | То же, что `applyNavigationCoercion`; используется в редьюсере `useAppState` и в тестах |
| `syncLocationHashToPage` | Выравнивание URL с маршрутом shell; `desktop/store` + «сырой» hash для подпутей |
| `applyWidgetHashNavigation` | Fallback виджетов без `onNavigate`: нормализация + `syncLocationHashToPage` |

### Shell: [`App.tsx`](../../../shared/web/frontend/src/App.tsx) + [`AppRouter.tsx`](../../../shared/web/frontend/src/components/AppRouter.tsx)

- **`hashchange`** (и раз на mount): пустой hash / OAuth-фрагмент → fallback + синхронизация; иначе нормализация → `setCurrentPage`; UGS deep link → `desktop` + `syncLocationHashToPage('desktop')`.
- **`handlePageChange`**: UGS vs обычная страница, `setCurrentPage`, затем `syncLocationHashToPage(targetPage, rawTarget)`; для `user-profile` — `PROFILE_RETURN_TO_SESSION_KEY` + текущая страница (см. раздел Profile return выше).
- После логина: `consumeIntendedPage` / hash / fallback; при UGS deep link — хранилище + desktop; при OAuth-callback hash — аккуратный `syncLocationHashToPage(restoredPage)`.
- **`AppRouter`**: ветки `desktop`, `desktop/store`, `admin`, `desktop-admin`, `login`, `default` → везде shell-страницы; при `login` + уже авторизован — `onPageChange('desktop')`.

**`main.tsx`**: `HashRouter` / `createHashRouter` не используются; hash-роутинг — кастомный (см. выше).

### Desktop ([`pages/Desktop/`](../../../shared/web/frontend/src/pages/Desktop))

- **Магазин приложений:** витрина и деталь приложения — [`DesktopWorkspaceAppStoreLayer`](../../../shared/web/frontend/src/pages/Desktop/components/DesktopWorkspaceAppStoreLayer.tsx) внутри [`DesktopWorkspaceContent`](../../../shared/web/frontend/src/pages/Desktop/DesktopWorkspaceContent.tsx); открытие по `openAppStore` / legacy `desktop/store` (см. эффекты в `DesktopWorkspaceContent`, `parseDesktopStoreAppIdFromHashFragment`). Техническая сводка: [`DESKTOP-APP-STORE.md`](DESKTOP-APP-STORE.md).
- **Корневые страницы:** [`DesktopWorkspaceContent`](../../../shared/web/frontend/src/pages/Desktop/DesktopWorkspaceContent.tsx) — `replaceState` для «чистого» URL (pathname + hash), вызовы `syncLocationHashToPage` из taskbar / модалок / `onNavigate`. [`DesktopAppStoreAdminPage`](../../../shared/web/frontend/src/pages/Desktop/DesktopAppStoreAdminPage.tsx) — «Назад» через `syncLocationHashToPage('desktop')`.
- **[`utils/desktopOnlyNavigation.ts`](../../../shared/web/frontend/src/pages/Desktop/utils/desktopOnlyNavigation.ts):** `replaceHashWithDesktop()` — `history.replaceState` на `#/desktop` без лишней записи в history.
- **[`utils/desktopOnlyLegacyRoutes.ts`](../../../shared/web/frontend/src/pages/Desktop/utils/desktopOnlyLegacyRoutes.ts):** матрица legacy full-page → desktop + pending / UGS.
- **[`utils/desktopDeepLink.ts`](../../../shared/web/frontend/src/pages/Desktop/utils/desktopDeepLink.ts):** межприложенческие ссылки на контент; чтение hash, при необходимости `replaceState` на `#unified-content?…`.
- **[`utils/ugsDesktopDeepLink.ts`](../../../shared/web/frontend/src/pages/Desktop/utils/ugsDesktopDeepLink.ts):** разбор/хранение UGS deep link, custom event для потребления на десктопе.

### Auth return URL (`INTENDED_PAGE_SESSION_KEY`)

| File | Role |
|------|------|
| [`KeycloakInit.tsx`](../../../shared/web/frontend/src/components/KeycloakInit.tsx) | Не дергать `login()` пока в hash OAuth `code`/`state`; перед `login()` сохранить сегмент hash в `sessionStorage` под **`INTENDED_PAGE_SESSION_KEY`** (path до `?`). |
| [`services/api/client.ts`](../../../shared/web/frontend/src/services/api/client.ts) | 401 / неавторизован: hash → сегмент страницы → тот же ключ; `redirectUri` без hash. |
| [`services/keycloak.ts`](../../../shared/web/frontend/src/services/keycloak.ts) | При провале refresh токена — запись под тем же ключом перед `logout`. |
| [`utils/authRedirect.ts`](../../../shared/web/frontend/src/utils/authRedirect.ts) | `redirect_uri` для Keycloak **без** fragment; hash только в `sessionStorage` под **`INTENDED_PAGE_SESSION_KEY`** для возврата в SPA. |

### Marketing Cabinet

[`useMarketingCabinetNavigation.ts`](../../../shared/web/frontend/src/pages/MarketingCabinet/hooks/useMarketingCabinetNavigation.ts): синхронизация query `mc_*` через `replaceState`, **сохранение существующего `url.hash`**; при уже «съеденном» desktop deep link — отключение записи URL.

### Admin

[`UnifiedAdminPage.tsx`](../../../shared/web/frontend/src/pages/Admin/UnifiedAdminPage.tsx): якорь `href="#desktop"` для «На рабочий стол», если нет `onNavigate`.

### Site Studio (embedded admin)

[`features/site-studio/desktop/SiteStudioAdminShell.tsx`](../../../shared/web/frontend/src/features/site-studio/desktop/SiteStudioAdminShell.tsx) + [`AdminEmbeddedRouter.tsx`](../../../shared/web/frontend/src/features/site-studio/admin/AdminEmbeddedRouter.tsx): в режиме **desktop-embedded** — **`MemoryRouter`** и синтетический `location` в контексте, **не** hash-SPA в адресной строке.

### Компоненты с **отдельной** семантикой hash (не дублируют shell)

| Area | Role |
|------|------|
| [`UltimateDocEditorInner.tsx`](../../../shared/web/frontend/src/components/UltimateDocEditor/UltimateDocEditorInner.tsx) | Параметр `thread=` внутри fragment (`document-editor?thread=…`); `hashchange`; `replaceState` для очистки query без лишних шагов history. Логика в [`threadHashLink.ts`](../../../shared/web/frontend/src/components/UltimateDocEditor/utils/threadHashLink.ts) — **`new URL()`, не `window.location.hash =`**. Публичный вход — [`UltimateDocEditor.tsx`](../../../shared/web/frontend/src/components/UltimateDocEditor/UltimateDocEditor.tsx) (провайдер). |
### Виджеты дашборда

[`dashboard-widgets/widgets/*`](../../../shared/web/frontend/src/pages/MarketingCabinet/dashboard-widgets/widgets/): при отсутствии `onNavigate` — только **`applyWidgetHashNavigation`** из `pageRouting.ts` (не прямой `location.hash`).

### Прочее

- **`src/hooks/`**, **`src/contexts/`**: прямых обращений к `location.hash` / `hashchange` / `replaceState` нет (проверка grep).
- Тесты: настройка `window.location.hash` в [`pageRoutingShellReturn.test.ts`](../../../shared/web/frontend/src/utils/__tests__/pageRoutingShellReturn.test.ts), [`DesktopAppStorePage.hash.test.ts`](../../../shared/web/frontend/src/pages/Desktop/__tests__/DesktopAppStorePage.hash.test.ts) — только для сценариев тестов.

### Дополнительный инвентарь (параллельный скан каталогов)

| Область | Hash / History API |
|--------|---------------------|
| `providers/` (`QueryProvider` only) | Нет |
| `lib/` (`index.ts`, `utils.ts`) | Нет |
| `notifications/`, `voice-core/` | Нет |
| `pages/*` вне `Desktop/` | Совпадений по hash API нет (всё под `pages/Desktop/`) |
| `components/UnifiedContent/` | Нет `location.hash` / `hashchange` / `href="#` (есть поля «content hash» в DuplicateFinder — не URL) |
| `services/` кроме `api/client`, `keycloak` | Нет `location.hash` / `INTENDED_PAGE_SESSION_KEY` |
| `types/` | Слово `hash` только в типах/комментариях (`contentTags`), не роутинг |
| `index.html`, `vite.config.ts` | `base: '/'`, без `<base href>`; хеши в именах чанков — кэш, не режим маршрута |
| Файлы `*router*` / `*routes*` | `HashRouter` / `createHashRouter` / `BrowserRouter` в `src` не используются (см. основной текст) |
