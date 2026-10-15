# Desktop: что реализовано, что заглушка

Краткая таблица по разделам рабочего стола. Обновлено **2026-08-19** (widgets A–E) по сверке с `pages/Desktop/` и `api/routers/desktop*.py`.

## Конфиг и оформление

| Раздел | Реализовано | Заглушка / пометка |
|--------|-------------|---------------------|
| Конфиг (тема, акцент, обои, сетка, размер иконок) | Сохранение в API (PATCH config), загрузка с сервера; UI читает эти поля как source of truth из `useDesktopStorage` | — |
| Обои (градиенты, кастом) | Выбор и сохранение в конфиге | — |
| Pointer parallax обоев | `useDesktopWallpaperParallax` на `#desktop-main`: `desktop_scene_depth` × `desktop_shell_parallax_*` × effective reduce motion; CSS vars `--desktop-wallpaper-parallax-*`. Crossfade transition **без** `background-position` (2026-07-28) | Отключается при effective reduce motion, low GPU, `desktop_shell_parallax_enabled=false` |
| Живые обои (particles) | Опция `live_wallpaper` в конфиге, `VisualEffects` | Не путать с pointer parallax |
| **Shell motion prefs** | Visual Studio → «Движение и подсказки»: `desktop_shell_reduce_motion`, parallax, morph, speed; резолвер `resolveDesktopShellMotion.ts`; runtime: Taskbar, Start Menu, окна, VD, Notification Hub | Нет отдельной БД/env; только `profile.ui` |
| Внешний вид (тема, обои) | Настройки рабочего стола и ПКМ → «Внешний вид» / `WallpaperPicker` | — |
| Настройки рабочего стола | Центр управления: Visual Studio (interactive preview + hotspots), обои, chrome, shell, performance deep-link на motion | Часть prefs только в `localStorage` (см. `documentation/product/FRONTEND_BROWSER_CACHE_MODEL.md` (localStorage/session inventory living there; former DATA-INTEGRITY-LOCALSTORAGE inventory not in tree)) |

## Элементы рабочего стола и контекстное меню

| Раздел | Реализовано | Заглушка / пометка |
|--------|-------------|---------------------|
| Элементы (иконки, папки, приложения) | CRUD через API, синхронизация, перетаскивание, привязка к сетке; `items` больше не дублируются в UI context | **Hover tooltip на иконках стола снят** (2026-07-30): нет TooltipV2 / native `title` / absolute overlay — имя только под глифом (`aria-label` для a11y). Pref `desktop_styled_tooltips` по-прежнему управляет chrome (таскбар, окна, App Store…), не canvas icons. **Имена приложений (2026-07-30):** SSOT = `desktop_app_catalog.name`; Пуск/магазин не перетирают store i18n; `desktop_items.name` для apps reconciles с каталогом |
| **System folder labels (display i18n)** | Подписи системных папок на иконках, в rail Файловый менеджер (explorer/filters/bulk-move/edit), breadcrumb/tree окна папки, **chrome title/taskbar** (`resolveDesktopWindowDisplayTitle` → display helper) — `resolveDesktopFolderDisplayName` + seed-name match для API `SYSTEM_FOLDER_NAMES` + `desktopUi.systemFolders.*` (RU/EN); API/`item.name`/`win.path` остаются каноном, без PATCH при смене locale | — |
| **Folder count badges on desktop icons** | Числовой badge только у **user** folders (`desktopFolderIconBadgePolicy`); системные library roots (`documents`/`images`/`content`/…) без count. App unread (GAF/EWDesk/friends) — отдельный `badgeCount`. `content` library total = `by_folder_item_id['content']`, не весь library `total` | — |
| **Hydrate sanitizer (stacked default anchors)** | После загрузки items `useDesktopWorkspaceIconInteractions` вызывает `sanitizeStackedDesktopIconPositions` (`desktopIconPositionSanitizer.ts`): если **два и более** root-иконок на дефолтном якоре `(20,20)` или `(0,0)`, они разводятся по сетке и позиции persist через `updateItemPosition` | Один icon на якоре не трогается; folder children и скрытые apps вне scope; fingerprint guard (не крутится во время drag / `groupDragState`); locks: `desktopIconPositionSanitizer.test.ts`, `useDesktopWorkspaceIconInteractions.hydrate.test.ts` |
| Контекстное меню (стол / иконки) | Один `EnhancedContextMenu` (без Shift-ветки): обновить, новая папка, вид, внешний вид, обои, настройки; open/delete/rename/pin; вставка/вырезать/копировать/переместить где применимо | Сортировка / «Упаковать значки» убраны из ПКМ пустого стола (2026-07-28). **Shift+ПКМ «расширенное» меню не реализовано** (2026-07-31). Архитектура / native leaks: `DESKTOP-CONTEXT-MENU-ARCHITECTURE.md` |
| Контекстное меню (окно / таскбар) | ПКМ заголовка/тела/resize → `DesktopWorkspaceWindowContextMenu`; таскбар win/Start/strip → `TaskbarShellContextMenus`; tray → `TaskbarIconContextMenu` | Shared chrome action IDs: `desktopWindowChromeActions.ts`. Окно: **«Поверх всех»**, **«Дублировать»**. Dead Enhanced `case 'window'` удалён |
| Папки и файлы | Открытие папки (контент из Content API), вложенные desktop shortcuts через `parentId`, перемещение root ↔ folder ↔ nested-folder с cycle/system-folder guard; partial batch move показывает пропущенные элементы | Unified Content file operations идут отдельным library path (`folder_item_id` / Content API); cross-source drag не смешивает desktop shortcut move и file-library move в один silent batch |

## Виджеты и панели

| Раздел | Реализовано | Заглушка / пометка |
|--------|-------------|---------------------|
| **Панель виджетов (Win+W в каноне горячих клавиш; вкл. в настройках)** | Слоты: **`assistant-plan`**, **`agenda`**, `notes`, `todos` (default off, scratch), **`favorites`**, `ewdesk`, `notifications`, `now-playing`, `project-shortcuts`, `recent-content`. Дефолт enabled: plan, agenda, notes, ewdesk, now-playing. Раскладка в `shell_state.widgets_layout`. Stacking: canvas z 40, window layer 100 (`desktopWidgetSurfacePolicy`). Live bodies; no expanded placeholder. Plan/agenda = `GET /api/v1/ewa/companion-plans/active` | **Слота `calendar` нет.** CalendarApp — отдельное окно + events API: [DESKTOP-CALENDAR-APP.md](DESKTOP-CALENDAR-APP.md). Legacy `widget-todos` API остаётся для scratch/полки, не как SoT плана. Подробно: [DESKTOP-WIDGETS-AND-AGENDA.md](DESKTOP-WIDGETS-AND-AGENDA.md) |
| **Заметки / задачи** | API `/widget-notes`, `/widget-todos`; виджет и окно «Заметки и задачи» (`DesktopWidgetShelfApp`) | При ошибке API — fallback в `localStorage` (`useWidgetNotesTodos.ts`); без demo-seed при пустом storage; видимая подсказка `workspace.localOnlyHint` («Сохранено только на этом устройстве») в панели виджетов и полном окне, `data-local-only="true"`, `workspace.localStorageWriteFailed` при сбое записи |
| **Dashboard favorites (ссылки)** | API `GET/POST/PATCH /desktop/favorites` (+ `PATCH /favorites/reorder`); слот **`favorites`** в панели (`DashboardFavoritesSlotBody`), окно `DesktopDashboardFavoritesApp` (drag reorder за ручку, plain empty/loading copy RU/EN), hook `useDashboardFavorites` (`reorderFavorites` → server PATCH when online); Vitest `useDashboardFavorites.test.tsx`, `DashboardFavoritesSlotBody.test.tsx`; opt-in E2E `e2e/desktop-favorites-widget-smoke.spec.ts` (region «Избранное» + Add) | При ошибке API — fallback `localStorage` (`STORAGE_KEYS.WIDGET_FAVORITES`), единая подсказка `workspace.localOnlyHint`, `data-local-only="true"`, `workspace.localStorageWriteFailed` при сбое записи. Drag reorder: local-only — `localStorage`; online — optimistic + `PATCH /favorites/reorder`. Offline→online merge **не** реализован (локальные правки не заливаются автоматически). **Не** calendar-слот |
| **Плавающий виджет (часы, профиль, now playing, perf strip)** | `DesktopWorkspaceFloatingWidget.tsx` — реальные данные (auth, credits, transport, notifications count) | Perf strip — read-only метрики клиента, не OS battery/WiFi |
| **Буфер обмена (Win+V / окно приложения)** | История в `shell_state.clipboard_history` (PATCH через coalesced writer, caps в `clipboardHistoryPersistence.ts`); polling системного буфера пока окно открыто | Однократная миграция legacy `localStorage` (`desktop-clipboard-history`) → shell_state; без входа/до hydrate — опора на локальный ключ; oversized image data URL может не попасть на сервер |
| **Голосовой Штаб — история команд** | Окно `VoiceCommand` на столе; replay/undo из drawer **«Журнал команд»** (`CommandHistoryPanel`); отдельно **лента сообщений** (trash / «очисти историю» → `clear_messages`) и **серверный аудит** (`VoiceAuditPanel`, GET `/api/v1/voice-commands/audit`) | **Только на устройстве** — ключ `voice_command_center_history` + макросы `voice_command_center_macros` в `localStorage`; hook `useVoiceCommandHistory` (`isLocalOnly` всегда `true`); i18n `desktopUi.voiceCommand.*` + баннер `workspace.localOnlyHint` / `localOnlyVoiceDetail`, `data-local-only="true"`. Очистка **журнала** — кнопка в drawer + `clearPersistedHistory()`; очистка **ленты** — trash / голос `clear_history` (не трогает журнал). **Нет** API sync / `shell_state` — не путать с Live Voice (`/api/v1/live-voice/history`). Audit — телеметрия поддержки, не восстановление журнала на другом устройстве |

## Панель задач и «system tray»

| Раздел | Реализовано | Заглушка / пометка |
|--------|-------------|---------------------|
| Пуск, VD, окна, закреплённые приложения | Полный runtime | — |
| **Правая зона таскбара** | **Громкость** — реальный slider + mute (`TaskbarRightToolbar`, `NowPlayingContext`); **часы**; **уведомления**; **сессия/устройство** — health по socket + `useSessionDeviceHealth` (`SessionDeviceTrayButton`) | — |
| **Трей фоновых процессов** | GAF (unread/minimized), UGS tray poll, music, friends incoming — `TaskbarTrayGafCluster` / portaled `TaskbarTrayPanel`; copy «Фоновые процессы»; exclusivity с NH/Start; badge = unread only (`desktopTraySurfacePolicy`) | — |
| **Декоративные OS-иконки (батарея / Wi‑Fi / «системный монитор»)** | — | **Снято:** `SystemMonitorWidget` в `LEGACY_HIDDEN_DESKTOP_APP_COMPONENTS`; в текущем taskbar **нет** Battery/WiFi заглушек и **`data-local-only` на tray** |

## Виртуальные рабочие столы и окна

| Раздел | Реализовано | Заглушка / пометка |
|--------|-------------|---------------------|
| Виртуальные столы | Переключение; при авторизации — JSON в `desktop_configs.shell_state.virtual_desktops` (PATCH merge через API). Одноразовая миграция из legacy `localStorage` (`STORAGE_KEYS.VIRTUAL_DESKTOPS`) с удалением ключа после успешного PATCH. Outbound VD PATCH после Terminal Restore Ready (`membershipPersistReady`). `desktops[].windows` reconciles к live window ids (hydrate + restore); backend `_sanitize_virtual_desktops` отсекает id вне `windows_snapshot`. Стабильные `windows_snapshot.windows[].id` (`w-…`) переживают F5. См. `useVirtualDesktops.ts`, `DESKTOP-STATE-PERSISTENCE.md` §3.2.6. | — |
| Состояние окон (позиция, размер, свёрнутость, z-order, привязка к столу) | При авторизации — `shell_state.windows_snapshot` (debounced PATCH + flush на `pagehide`). Единый renderer `DesktopWindowLayer` + `EnhancedWindow`; `close-active-window` закрывает активное окно текущего стола. Логика: `useDesktopShellWindowPersistence` в связке с `useWindowManager`. | Без сессии — только клиент (см. legacy `localStorage` для окон в `STORAGE_KEYS.WINDOWS` до миграции в shell_state). |
| Восстановление окон при перезагрузке | С сервера: GET `shell_state` → восстановление; иначе одноразово из legacy `localStorage` с последующим PATCH и очисткой ключа. Maximize/restore/minimize — как в `EnhancedWindow`. | — |

## Быстрые действия и команды

| Раздел | Реализовано | Заглушка / пометка |
|--------|-------------|---------------------|
| Command Palette | Действия с хендлерами: тема, окна, settings, clipboard, VD, explorer и др. **P7 role:** shell commands/actions (`desktopLauncherRoles.commandPalette`) — не второй каталог Пуска | Нереализованные отключены или дают «Функция пока недоступна» |
| **Календарь в палитре** | Read-only quick action `calendar` в `CommandPalette.tsx` (`groupKind: 'info'`): **name** «Today's date» / «Сегодняшняя дата» (не «Calendar»), **description** — локализованная длинная дата устройства, **infoHint** — честная подсказка что приложение не открывается; `searchHints` для cmdk-поиска; `action: () => {}`, `aria-disabled`, Enter не закрывает палитру. Рядом `time` с текущим временем и `infoHint`. Контракт: `CommandPalette.commands.contract.test.ts`, `CommandPalette.keyboard.contract.test.ts` | **Не** открывает CalendarApp (запуск из Пуска/каталога `app-calendar`). **Не** widget-слот. Agenda = plan `due_date`. Events API: [DESKTOP-CALENDAR-APP.md](DESKTOP-CALENDAR-APP.md) |
| **Голосовая команда «погода»** | — | **Удалена из каталога** (`commandCatalog.ts`, `commandExecutor.ts`, 2026-06-30): не показывается в help/list; фразы «погода» / «weather» не матчятся как штатная команда (не «недоступна», а отсутствует) |

## Итог

- В меню и быстрых действиях нет пунктов с текстом «Скоро» без плана: нереализованные пункты удалены из меню или показывают нейтральное «Функция пока недоступна».
- **Не путать:** taskbar tray (GAF/UGS/music/notifications/volume) — рабочий контур; legacy «батарея/сеть без данных» и fake weather command — **сняты или не интегрированы**.
- Fallback/local-only блоки (заметки при падении API, избранное, голосовая история команд, legacy clipboard до migrate) показывают единую подсказку «Сохранено только на этом устройстве» и `data-local-only="true"` — без тихого fallback. **Wave B:** local-only mutations notes/todos/favorites enqueue subject-scoped outbox (`eliteew-desktop-widget-outbox-v1`) and flush via **`POST /desktop/widget-sync`** when online (clear only on 2xx; mid-request 500/abort keeps queue + Idempotency-Key). **Голосовой Штаб:** история команд — permanent offline (нет cloud sync API); Live Voice widget — отдельный контур с `/api/v1/live-voice/history`.

Открытые UX-проходы вложенных приложений: [`DESKTOP-EMBEDDED-APPS-UX-NEXT.md`](DESKTOP-EMBEDDED-APPS-UX-NEXT.md). Историческая сводка буфера/widget shelf (research 21) soft-retired under `trash/` (id 20260812-150728, was …/research).
