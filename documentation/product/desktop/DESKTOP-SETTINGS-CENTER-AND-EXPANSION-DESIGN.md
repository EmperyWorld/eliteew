# Desktop Settings Center и расширение shell: карта данных, контракты и UX-проект

Документ закрывает инженерные to-do по волнам расширения рабочего стола (без правок исходного плана). Опора на текущий код: API `shared/api/routers/desktop.py`, фронт `shared/web/frontend/src/pages/Desktop/`, типы `desktopExpansion.types.ts`, `useDesktopExpansionSettings.ts`, `useVirtualDesktops.ts`, `useWindowManager.ts`, `useDesktopWorkspaceVisualProfileBridge.ts`, `desktopVisualProfilePack.ts`.

**Everyday IA Cause (2026-09-06):** Look SoT navigate + Fine-tune budget + Behavior more-options + Comfort metrics support-only — [DESKTOP-SETTINGS-EVERYDAY-IA.md](DESKTOP-SETTINGS-EVERYDAY-IA.md). Lock: `DesktopSettingsEverydayIa.contract.test.ts`.

**Shell Plus program closeout (Wave F, 2026-08-10):** Settings **Wave 2** progressive disclosure + QuickSearch chrome density — Cause Done (`c0a1ede42`); Start/empty/offline guided CTAs + **Task Switcher honesty** — Wave 3 Done (`50ae1c95a`, `ac1119ac6`); `useDesktopStorage` → `desktopStorage/*` — Wave B Done (`fdb7ea386`); FE Wave 24/25 — `ensemblePlanForm/` + `mediaWorkbench/` atomization Done (`50ae1c95a`). Living peers: [DESKTOP-TASKBAR-ARCHITECTURE.md](DESKTOP-TASKBAR-ARCHITECTURE.md), [DESKTOP-STATE-PERSISTENCE.md](DESKTOP-STATE-PERSISTENCE.md) §4.1, [DESKTOP-ENSEMBLE-PLAN-AUTHORING.md](../DESKTOP-ENSEMBLE-PLAN-AUTHORING.md), [PROFESSIONAL-WORLDS-VERTICAL-TEMPLATE.md](../PROFESSIONAL-WORLDS-VERTICAL-TEMPLATE.md).

**Shell Wave 4 Done (`deba3d9d2`, 2026-08-11):** a11y Tab budgets + Playwright narrow×reduced-motion×low-GPU matrix + mobile embedded journey map (`DESKTOP-MOBILE-EMBEDDED-SHELL.md`). Evidence: `pnpm run test:desktop-shell-a11y`.

**Shell Wave 5 Done (`939540e7f`, 2026-08-11):** Measure overall **15/20** (gate ≥18 FAIL; cognitive 13). EWDesk dual-header on full-shell SSOT.

**Shell Wave 6 Cause (2026-08-11, Commit Package pending):** cognitive IA — Quick Search idle files-before-apps + Start-owns-catalog copy; Chrome tab style grids behind looks disclosures (preview primary; opacity/scale stay Wave 2 advanced). Evidence: `QuickSearch.wave6.cognitive.contract.test.ts` + `DesktopSettingsChromeTab.advanced.contract.test.ts`. Residual: true single-launcher chrome (demote QS/Palette affordances) still optional; bake deferred.

**Волна 2 (статус закрыт в коде):** сценарии как `workspace_profiles`, быстрый список на полоске VD, шаблоны в Пуске, подсказки на карточках (открытые окна + недавние приложения с учётом **`recent_app_ids_by_desktop`**); MRU на целевой VD при **«Открыть в сценарии»** и при **полном открытии профиля** (`collectWorkspaceProfileLaunchItemIdsForMru` + `recordRecentAppOnVirtualDesktop` в `openWorkspaceProfile`); атрибуты `#desktop-main` для активного VD; синхронизация pilot OpenAPI / уникальные `operationId` у multi-method proxy. Правило агента: `.cursor/rules/desktop-workspace-scenarios-shell-state.mdc`.

### Desktop library discovery (Start Menu + Quick Search)

- **Утилиты:** `shared/web/frontend/src/pages/Desktop/utils/desktopDiscoveryModel.ts` — нормализованные срезы ленты (`recent-content-feed` + MRU файлов из shell): документы (merge с `mergeRecentDocumentsDiscovery`), проекты, генерации, загрузки, добавления; пул и ранжирование для Quick Search (`buildQuickSearchRecentFilePool`, `rankRecentFilesForQuery`); счётчики expansion для вкладки «Работа» (`getDesktopExpansionDiscoveryCounts`).
- **Состояние фида:** `useDesktopRecentContentFeed` — `isLoading`, `error`, `lastLoadedAt`, `refetch`; UI Пуска и Quick Search показывает обновление/ошибку, не только `console`.
- **Таскбар / deep-link:** `requestOpenStartMenu(tab?)` (`desktopDeepLink.ts`) диспатчит `desktop-open-start-menu` с опциональным `StartMenuTab`; `Taskbar` поднимает `startMenuIntent` nonce и открывает Пуск. Intent (`useStartMenuDisclosure`, Wave 1 2026-08-10): `recent` → select Recent tab **without** auto-expanding library disclosure; `work`/`pinned`/`all` → select that tab + work-advanced when needed — **без** auto-open меню «Ещё» (оператор открывает More вручную).

---

## 1. Карта настроек (точная)

### 1.1 Таблица `desktop_configs` — `GET/PATCH /api/v1/desktop/config`

Канон моделей: `DesktopConfigCreate` / `DesktopConfigUpdate` / `DesktopConfigResponse` в `desktop.py`. На фронте зеркало: `DesktopConfig` в `desktop.types.ts`, загрузка в `useDesktopStorage`.

| Поле (API) | Назначение |
|------------|------------|
| `wallpaper` | Текущие обои (строка, в т.ч. data URL; лимит отправки на PATCH см. `MAX_WALLPAPER_LENGTH`) |
| `wallpapers_history` | История обоев (сервер) |
| `icon_size` | Размер иконок на столе (`small` / `medium` / `large`) |
| `show_widget` | Плавающий виджет заметок/задач (legacy имя поля) |
| `widget_position` | Координаты плавающего виджета |
| `theme` | Тема стола `dark` / `light` / `auto` |
| `accent_color` | Акцент (пресет или `#rrggbb`); во фронте частично как `accent` |
| `live_wallpaper` | Флаг в API; в типах помечено как legacy / не главный UX |
| `snap_to_grid`, `grid_step` | Привязка иконок к сетке |
| `widgets_panel_position` | Угол закрепления панели виджетов |
| `compact_widgets`, `show_widgets_panel` | Режим и видимость панели виджетов |

**Не путать с профилем:** визуальные пресеты окон/панели/иконок и масштаб живут в `profile.preferences.ui`, а не в `desktop_configs`.

### 1.2 Таблица `desktop_items` — `/api/v1/desktop/items`

Элементы рабочего стола (папки, ярлыки приложений, файлы): позиции, `is_pinned`, `parent_id`, `app_component`, системные ключи и т.д. Источник правды при авторизации — API; локальный кэш и конфликт вкладок — см. `useDesktopStorage` (`tabConflictDetected`, `STORAGE_KEYS`).

### 1.3 `shell_state` — `GET/PATCH /api/v1/desktop/shell-state`

Модель `DesktopShellStateOut` / `DesktopShellStatePatch` в `desktop.py`; на фронте `DesktopShellState` из OpenAPI-схемы (`desktopApi.ts`).

| Поле | Назначение | Типичные потребители |
|------|------------|----------------------|
| `recent_app_ids` | MRU приложений (id из каталога/ярлыков) | `useDesktopRecentApps`, Start Menu |
| `recent_app_ids_by_desktop` | MRU приложений **по id виртуального стола** (`virtual_desktops`); пустой список по столу → fallback на глобальный MRU в UI подсказок | `useDesktopRecentApps`, `effectiveRecentIdsForWorkspaceProfile`, API санитизация в `desktop.py` |
| `recent_file_ids` | MRU контента | `useRecentFiles`, Quick Search |
| `clipboard_history` | История буфера обмена (санитизация на API) | `ClipboardManager` |
| `virtual_desktops` | Виртуальные столы: `desktops[]`, `activeDesktopId` | `useVirtualDesktops` |
| `windows_snapshot` | Снимок открытых окон для восстановления | `useDesktopShellWindowPersistence` |
| `workspace_profiles` | Обёртка `{ profiles: DesktopWorkspaceProfile[] }` | `useDesktopExpansionSettings` |
| `window_layout_presets` | Сохранённые раскладки окон | `useDesktopExpansionSettings` |
| `widgets_layout` | Слоты виджетов + `perWorkspace` | `useDesktopExpansionSettings` — target contracts [DESKTOP-WIDGETS-AND-AGENDA.md](DESKTOP-WIDGETS-AND-AGENDA.md) |
| `app_collections` | Пользовательские коллекции приложений | `useDesktopExpansionSettings` |
| `content_shortcuts` | Ярлыки на контент / проекты / фильтры | `useDesktopExpansionSettings` |
| `assistant_context_actions` | Вкл/выкл видимых context actions | `useDesktopExpansionSettings` |
| `clock_show_seconds`, `timezone`, `quiet_mode` | Трей / часы / тихий режим | `DesktopTaskbarShellPrefsContext` и др. |
| `now_playing` | Возобновление музыки | `NowPlayingContext` |
| `gaf_chat_sound_enabled` | Звук GAF | `GAFChatProvider`, shell |
| `tray_show_feedback`, `tray_show_assistant` | Видимость строк в трее | taskbar prefs |
| `music_playlists` | Плейлисты плеера в shell | `MusicLibraryContext` |
| `visual_style_presets` | Именованные пользовательские наборы полей оформления (тема, акцент, стили shell, масштаб и т.д.), merge в патче как массив | `useDesktopExpansionSettings`, вкладка **Персонализация**, API `_sanitize_visual_style_presets_shell` |

Доп. поля в патче могут добавляться только в рамках уже принятой схемы merge на бэкенде; для новых «волн» приоритет — JSON в перечисленных ключах без новой таблицы, пока хватает ёмкости и валидации на API.

### 1.4 `profile.preferences.ui` — PATCH профиля пользователя

Тип `UIPreferences` в `shared/web/frontend/src/types/profile.ts`. Мост рабочего стола: `useDesktopWorkspaceVisualProfileBridge` (подмножество desktop-релевантных полей).

**Desktop-специфично (основной набор):**

| Поле | Назначение |
|------|------------|
| `desktop_open_apps_maximized` | Новые окна сразу на весь рабочий стол |
| `desktop_floating_widget_visible` | Видимость плавающего виджета |
| `desktop_icon_style`, `desktop_taskbar_style`, `desktop_window_style`, `desktop_widgets_style` | Визуальные пресеты (нормализация legacy ключей) |
| `desktop_scene_depth` | Глубина сцены (`soft` / `balanced` / `immersive`); виньетка `#desktop-main` и immersive-hover иконок |
| `desktop_font_body` | Основной шрифт UI (`manrope` / `poppins` / `raleway` / `montserrat`; `@fontsource`) |
| `desktop_font_display` | Акцентный шрифт заголовков (`system` = как body, иначе `cinzel` / `playfair` / `cormorant` / `raleway`) |
| `desktop_wallpaper_crossfade_enabled` | Плавная смена фона обоев (0.5 с через `DESKTOP_WORKSPACE_MOTION`) |
| `desktop_styled_tooltips` | TooltipV2 на chrome стола (таскбар, окна, App Store…); `false` → нативные `title`. Coordinator + **`useDesktopHoverChromeSafetyNet`** на `#desktop-main` закрывают залипшие подсказки (CubOS/XFCE Chromium, Quest). **Canvas icons** (`DesktopIcon`) — без hover tooltip независимо от pref (имя под глифом). В **CSS Grid** (напр. **`WallpaperPicker`**) — **`DesktopChromeTooltip fullWidth`**, иначе trigger `inline-flex` ломает ширину колонок |
| `desktop_shell_reduce_motion` | Минимальные анимации shell (окна, taskbar, morph) — независимо от ОС |
| `desktop_shell_parallax_enabled` | Pointer parallax обоев на `#desktop-main` |
| `desktop_shell_parallax_intensity` | Множитель силы parallax: `subtle` / `normal` / `strong` |
| `desktop_shell_window_morph_enabled` | `layoutId` morph иконки окно ↔ taskbar |
| `desktop_shell_motion_speed` | Скорость spring/minimize: `slow` / `normal` / `fast` |
| `desktop_accent_follows_window_style` | Акцент из стиля окон |
| `desktop_panel_opacity` | Прозрачность панелей (кламп 0.35–1) |
| `desktop_ui_scale` | Масштаб UI стола |
| `desktop_reduce_backdrop_blur` | Комфорт: снять `backdrop-filter` с **`#desktop-main`** (см. **`useDesktopWorkspaceMainSurfaceEffects`**, **`useDesktopWorkspaceShellCss`**) |

**Остальные ключи `UIPreferences`** (`compact_mode`, `animations_enabled`, `sidebar_collapsed`, `default_view`) — глобальные; `animations_enabled=false` **принудительно включает** effective reduce motion для shell (см. §1.7).

### 1.7 Visual Studio и shell motion (2026-06-21)

**Persist:** только `profile.preferences.ui` (поля §1.4). **Миграций БД и env-ключей нет** — значения хранятся в JSON `users.preferences` / профиль API.

**Effective motion** (`resolveDesktopShellMotion.ts` → `DesktopShellMotionPrefsProvider` в `DesktopWorkspaceContent.tsx`):

| Условие | Эффект |
|---------|--------|
| OS `prefers-reduced-motion` | `reduceMotion=true` |
| `accessibility.reduce_motion` | `reduceMotion=true` |
| `animations_enabled=false` | `reduceMotion=true` |
| `desktop_shell_reduce_motion=true` | `reduceMotion=true` |
| `reduceMotion=true` | parallax и morph **выключены** независимо от toggles |

**Runtime consumers:** `Taskbar`, `StartMenu`, `QuickSearch`, `EnhancedWindow` + `DesktopWindowMorphChip`, `useWindowManager` (minimize spring), `useDesktopWallpaperParallax`, `VirtualDesktops`, `NotificationHubItem` layout, Settings Visual Studio preview.

**Visual Studio UI** (`DesktopSettingsVisualStudioSection`):

1. **`DesktopVisualStudioPreviewInteractive`** — live preview с **hotspot-зонами** (badge, title, window mock, taskbar, morph chip, pills «Фон»/legend «Ещё»). Root: `#desktop-settings-field-profile_ui-visual_studio_preview`.
2. **Legend / hover / morph chips** — `VISUAL_STUDIO_PREVIEW_CHIP_CLASS` (`shellMeta10` + `font-medium tracking-normal`): **sentence-case**, без shouty `uppercase` / `sectionOverlineStrong`. Morph chip copy: `previewIconLabel` (RU «Приложение» / EN localized), не hardcode `App`.
3. **Hint strip** над preview — `livePreviewInteractiveHint` (короткий путь: зона или чип → быстрые настройки; полные карточки ниже).
4. **Popover** (portal + `useSyncDesktopThemeFromMain`) — те же `onChange`, что карточки формы; для window/taskbar — mini-preview + описание стиля; footer «Подробнее в карточке» → scroll/tab (`visualStudioHotspotNavigateTarget`).
5. **Morph demo** в preview — циклический `layoutId` chip ↔ taskbar; **пауза** при hover preview или открытом popover.
6. Карточки ниже (Typography, Scene depth, Motion) — **a11y fallback** и точная настройка.
7. Preview frame — soft depth (`shadow` + ring + top sheen); taller min-height on sm+.

**Performance tab:** `openShellMotionSettings()` → вкладка `personalize` + scroll к `desktop-settings-field-profile_ui-desktop_shell_motion`.

**OpenAPI:** pilot `desktop.openapi.json` покрывает `shell_state`, **не** `UIPreferences`. Контракт полей — `shared/api/schemas/user_profile.py` + `src/types/profile.ts`; см. **`documentation/api/PROFILE-API.md` §UIPreferences (desktop)**.

**Commits (reference):** `c76d40e8` motion polish; `ddb6e80c` user prefs + API; `9bf24f6a` interactive preview hotspots.

### 1.5 Локальная сессия (`local_session`)

Не персистится на сервере: offscreen drag, фокус модалок, временные performance-флаги, часть debounce-состояний. В UX «Данные и синхронизация»: явно отметить «сбросится при перезагрузке».

### 1.6 Связь с уже существующим «storage map» в UI

`useDesktopExpansionSettings` отдаёт `storageMap` с bucket’ами `desktop_config`, `desktop_items`, `profile_ui`, `shell_state`, `local_session`. С **волны 10 (2026-05-27)** списки `fields` покрывают §1.1–1.4; UI — scrollable списки полей и счётчик в карточке storage map.

**P0 (2026-07-28):** карточка рендерится **последней** в `ExpansionSettingsSection` и скрыта за disclosure **«Для поддержки»** → вложенное «Показать карту хранения». Outer summary не показывает `cardStorageMapFieldCount`. Contract: `DesktopSettingsExpansionStorageCard.support.contract.test.ts`.

**P0 follow-up (2026-07-28):** в `ExpansionSettingsSection` primary — **рабочие пространства** + **панель мини-виджетов** (deep-link с карточки плавающего виджета); discovery / Assistant+GAF — за disclosure **«Ещё параметры рабочего стола»** (`data-testid=desktop-settings-power-options`). User-facing EN live preview: **Live preview** / badge **Preview** (не «Visual studio»); EN motion — minimize / living wallpaper / depth (не Morph/Parallax). Taxonomy-callout над «Окна и виджет» убран.

---

## 2. Проектирование Settings Center

**Инварианты:** один `DesktopSettingsPanel` / `DesktopShellSettingsBridge`, без второго менеджера окон. `TabId` и `DesktopControlCenterTab` — шесть значений (`personalize` | `icons` | `chrome` | `widgets` | `shell` | `performance`) для storage map и deep-link; главный уровень показывает **Персонализацию**, **Иконки**, **Окна и панель** и **Виджеты**. `shell` и `performance` — в раскрываемом блоке **«Поведение и комфорт рабочего стола»**; active/deep-link на любой из них автоматически раскрывает блок. **Scroll + chrome contract:** living canon [DESKTOP-CHROME-DECLUTTER-AND-SCROLL.md](DESKTOP-CHROME-DECLUTTER-AND-SCROLL.md) — no persistence badges / card blurbs; Settings self-scroll via Shell App Registry (`DesktopShellSettings` + `scrollContainerId: desktop-settings-main-tabpanel`); Personalize order sticky preview → curated → theme/wallpaper.

**P6 compact chrome (2026-07-28):** sidebar vs stacked tab strip follows **panel container width** (`useResizeObserverRect` on the Settings dialog/embedded root + `resolveDesktopSettingsTabsDesktopLayout` in `settings/desktopSettingsChromeLayout.ts`), **not** viewport `min-width: 768px` / Tailwind `md:`. Threshold: **`DESKTOP_SETTINGS_SIDEBAR_MIN_WIDTH_PX = 640`**. Embedded mobile route and unmeasured width (0) stay stacked. Narrow panel: wrap tab chips + compact content padding (`p-3`). Markers: `data-desktop-settings-nav="stacked"|"sidebar"`. Lock: `settings/__tests__/desktopSettingsChromeLayout.test.ts`. Clamp of window min-size ≠ usable chrome — see [DESKTOP-WINDOW-MIN-SIZES.md](DESKTOP-WINDOW-MIN-SIZES.md).

### 2.1 Распределение по вкладкам

| Вкладка | Подразделы (новые/усиленные) | Источник данных |
|---------|------------------------------|-----------------|
| **Персонализация** | Hero: sticky **Visual Studio** preview. Сразу под ним (scroll top): **Подборки от Empery World** (curated). Tier 1: тема/акцент/обои; **один primary CTA** (idle → Change wallpaper; try-on → Save на sticky banner). Progressive disclosure: **Точная настройка** (typography / scene / motion), **Подборки и мои виды** (my looks + try-on + pack); JSON export/import — nested Advanced. Try-on Save/Discard только на banner (без дубля в карточке). | `desktop_config` + `virtual_desktops` + `profile.ui` |
| **Иконки** | Размер, сетка, icon-only packs (`DESKTOP_ICON_ONLY_STYLE_KEYS`, в т.ч. статичные `slate`/`clay`/`ember`) | `desktop_config`, `profile.ui.desktop_icon_style` |
| **Оформление окон (chrome)** | Стиль окон, таскбара, прозрачность панели, масштаб UI — без tab intro / persistence badges / flat-shell note (также доступны из hotspot «Окно»/«Панель» в Visual Studio preview) | `profile.ui` |
| **Виджеты** | Плавающая карточка (видимость, timezone, quiet, секунды), панель мини-виджетов (dock/free layout, слоты), стиль chrome виджетов | `profile.ui` + `desktop_config` + `shell_state.widgets_layout` |
| **Поведение shell** | Виртуальные столы, workspace profiles, pinned/start visibility, новые окна, синхронизация, расширенные сценарии | `shell_state` + `desktop_items` + `profile.ui` |
| **Производительность** | Режимы отображения, `animations_enabled`, backdrop blur, агрессивная выгрузка фона; **deep-link** «Настройки движения оболочки» → Personalize / `desktop_shell_motion` | `profile.ui` + локальные perf flags |

**UX copy (UI audit follow-up P0, 2026-07-28; Wave 2 progressive disclosure 2026-08-10):** пользовательские строки вкладок — в `desktopUi.settingsPanel` (RU/EN): единый термин **«рабочий стол» / desktop**; без `shell_state` в primary copy. **No persistence badges / card blurbs** in Settings chrome (see [DESKTOP-CHROME-DECLUTTER-AND-SCROLL.md](DESKTOP-CHROME-DECLUTTER-AND-SCROLL.md)). **Персонализация:** sticky hero preview → Empery curated → theme/wallpaper → Fine-tune / Looks disclosures; sticky try-on banner как единственный Save/Discard; JSON pack за Advanced; EN hero title **Live preview** (не Visual studio). **Поведение → Окна:** card «Новые окна» (maximized). **Виджеты (primary tab):** floating card + panel layout + widget chrome style; stacked panel scroll — `StackedWidgetsPanelLayout` (`min-h-0` flex chain + `overflow-y-auto`). EN Personalize motion copy uses **minimize / living wallpaper / depth** (not Morph/Parallax jargon). **Окна и панель (Chrome):** window + taskbar presets primary; opacity + scale — `chromeAdvancedTitle` disclosure (`desktop-settings-chrome-advanced`). **Комфорт и скорость:** primary **«Плавность и эффекты»**; experimental inactive soft-blur measure — `desktop-settings-comfort-experimental-effects`; session metrics / DevTools marks — за disclosure **«Состояние сессии»** (`desktop-settings-comfort-session-status`); без Telemetry/FPS-budget jargon в primary copy. **Синхронизация:** refresh/queue primary; support diagnostics exports — `desktop-settings-sync-diagnostics`. **P11 (2026-07-28):** `usePerformanceOptimizer` emits recommendation **codes** + vars (`desktopPerformanceRecommendations.ts`); Settings Performance tab and floating strip translate via `desktopUi.performance.recommendation.*` (no hardcoded RU in the hook). **P15 (2026-07-28):** Settings Performance user hints drop Socket.IO / `window.__eliteewSetPerfMode` / raw `runtime` / `refetch` jargon (`settingsPanel.perfRealtimeMarksHint`, `perfStatActiveAdaptersHint`, `performance.recommendation.suspended_adapters`); lock `desktopSettingsPerformanceCopy.p15.test.ts`. **Расширенные:** workspace primary; discovery / assistant — за **«Ещё параметры рабочего стола»**; **карта хранения настроек** — только в конце Advanced за disclosure **«Для поддержки»** (`DesktopSettingsExpansionStorageCard`, `data-testid=desktop-settings-support-diagnostics`); field counts не на outer summary; storage map во вложенном `<details>`.

### 2.2 Новая вкладка или подраздел «Данные и синхронизация»

Внутри **shell** или отдельная секция первого уровня (решение за UX-polish; технически — одна модалка):

- Таблица: **что где хранится** (расширенный `storageMap`).
- Статус: онлайн/офлайн, ошибка последнего PATCH, `tabConflictDetected`.
- Очередь сохранений (**волна 15**): при офлайне или сетевой ошибке тела PATCH конфига (`/desktop/config`) и ключевых PATCH `shell_state` складываются в **`desktopPersistPatchQueue`** (см. `DesktopWorkspaceContent` + `DesktopSyncStatus`: «В очереди», «Отправить», авто-flush при восстановлении сети); без тихого потерянного PATCH. **Settings → shell → «Данные и синхронизация»** показывает счётчик очереди и кнопку flush (**2026-05-27**).
- **Coalesced shell writer:** `desktopShellStateWriteCoordinator.ts` — merge debounced PATCH для expansion, VD, windows_snapshot, taskbar prefs, MRU apps/files, GAF sound, **now_playing**, **music_playlists**, **clipboard_history**, **timezone/quiet_mode** (floating widget); queue flush и import pack — `immediate` (**2026-05-27**).
- Действия: «Обновить с сервера» (`refresh` + `fetchDesktopShellStateDeduplicated`), «Сбросить предупреждение о вкладке».

### 2.3 Раздел «Окна» (внутри shell или chrome)

- `desktop_open_apps_maximized` — понятный toggle + краткое пояснение.
- Политика экземпляров: ссылка на справку «из каталога приложения» (`allow_multiple_windows`, `max_window_instances`) — данные уже в `desktop_items` / каталоге.
- **Presets раскладки** и **собрать окна** — см. раздел 4; элементы управления вызывают уже существующие хендлеры expansion.

### 2.4 Модульная структура фронта (волна 2 split, **2026-05-27**)

`DesktopSettingsPanel.tsx` (≤~800 строк, Wave N6) — **оболочка**: tab strip, modal/embedded chrome, `DesktopSettingsPanelProps`. Lazy Suspense bodies — `settings/DesktopSettingsPanelTabPanels.tsx`; props — `settings/desktopSettingsPanel.types.ts`.

| Модуль | Назначение |
|--------|------------|
| `components/settings/DesktopSettingsPanelTabPanels.tsx` | Lazy `Suspense` + `activeTab === …` bodies for all five Settings tabs |
| `components/settings/desktopSettingsPanel.types.ts` | `DesktopSettingsPanelProps` public contract |
| `components/settings/desktopSettingsShared.types.ts` | Общие типы вкладок (`TabId`, `DesktopSettingsShellHelpers`, `DesktopSettingsWorkspaceProfilesShellContext`, …) |
| `components/settings/desktopSettingsChromeLayout.ts` | **P6:** container-width gate for sidebar vs stacked Settings chrome (`DESKTOP_SETTINGS_SIDEBAR_MIN_WIDTH_PX`) |
| `components/settings/desktopSettingsVisualLabels.tsx` | i18n-билдеры подписей пресетов (`buildDesktopSettingsVisualLabels`, theme mode options) |
| `components/settings/desktopSettingsPreviewComponents.tsx` | Мини-превью обоев, taskbar/window/widget style pickers, curated presets strip |
| `components/settings/DesktopSettingsVisualStudioSection.tsx` | Блок **Visual Studio** на вкладке «Персонализация» |
| `components/settings/DesktopVisualStudioPreview.tsx` | Композитное live preview (обои + окно + таскбар + morph demo) |
| `components/settings/DesktopVisualStudioPreviewInteractive.tsx` | Hotspot/popover-слой поверх preview; legend chips; navigate-to-card footer |
| `components/settings/desktopVisualStudioPreviewHotspots.ts` | Id зон, legend/hint keys, `visualStudioHotspotNavigateTarget()` |
| `utils/resolveDesktopShellMotion.ts` | Effective reduce motion / parallax / morph / speed из profile + OS + a11y |
| `context/DesktopShellMotionPrefsContext.tsx` | React context для shell chrome (provider в `DesktopWorkspaceContent`) |
| `components/settings/DesktopSettingsMotionSection.tsx` | Motion wrapper для карточек Settings (stagger + reduced motion) |
| `components/settings/desktopSettingsSharedUi.tsx` | `DesktopSettingsTabIntro` (display font + meta), style picker tiles, inline alerts |
| `utils/desktopSettingsCardMotion.ts` | Stagger motion для карточек Settings (respect `prefers-reduced-motion`) |
| `utils/desktopVisualStudioMeta.ts` | Подписи font/depth на curated и user visual presets |
| `components/desktopFolderTooltipLabels.tsx` | Shared truncated labels + move-menu rows for folder window tooltips |
| `components/DesktopChromeTooltip.tsx` | TooltipV2 vs native `title` по `desktop_styled_tooltips`; taskbar, windows, folder tree/files/move menus/path/**library+nested file select toggles** (**не** desktop canvas icons — иконки стола без hover tooltip с 2026-07-30), **FilePreviewModal** download, **layout preset apply** dialog, **floating widget performance** toggle, App Store (catalog cards, **featured/recent/related** compact rows, **description clamp overflow**, **detail breadcrumb current page**, **active filter chips**, **category jump**, **empty catalog actions**, **detail back/retry/breadcrumb**, category nav, filters/sort, search, header), **App Store admin** (back, catalog/group edit-delete), **WallpaperPicker** grid/footer (**`fullWidth`** on cells), **EWDesk** list refresh/**row badges** (pinned, starred, audio), **EWDesk widget preview rows**, EWDesk/**FeedbackHub** (refresh, search clear), **assistant selection rail**, AssistantApp + **ProductAssistantMarkdown** (code copy, external links, image alt, **FAQ collapsed hint**), **Ассистент** (sidebar rows, header toolbar, bubbles, composer, attachments, settings toggles, blueprint artifact, ensemble commands, context footnote, **guide tour**), GAF Chat (**attachment preview close**, **content library picker** view/type/actions/**row tiles**, **sidebar row title/preview**, **new-chat modal rows**, **voice play/pause**, **confirm modal**, **error/E2EE banners**, **load older**, **reply quote** (full text + jump), **composer reply preview**, **shell header server status**, **app link open**, **text preview copy**, **E2EE decrypt setup**, **shell new chat / filters / scroll / composer / edit modal**, **onboarding steps**, **admin app link picker**, **chat actions overflow menu**), **Live Voice** (power toggle, collapse, record, network hint, **minimized expand**), **VideoCallApp** + **participant picker footer**, **ItemPropertiesModal** assistant actions, **DesktopWidgetShelfApp** tabs/add/delete, **SpotlightGuideModal** (audio toggle, close), **DesktopWidgetsPanel** slot/panel drag handles/**notification + open-app actions + free-strip drag + now-playing row + expanded slot + project collections**/**content shortcuts + recent file rows**, **QuickSearch**, **CommandPalette** header close, **Visual Studio** font/depth segments, VirtualDesktops quick scenarios, expansion remove/storage-map/apply/**assistant toggles**, NewFolderDialog icon grid, clipboard (**clear history**), notifications hub (**tray close/open-full**, **item dismiss**, **footer toolbar**, **filters/chips**, **source group headers**, **clear confirm**, **quick settings** sound/DND/socket/themes/tests/UGS/GAF toggles), sync chip + inline flush/retry/refresh/dismiss, **TaskSwitcher** empty action, **taskbar tray rows**, **Start Menu** (continue/resume windows, **library discovery rows**, recent docs **+ remove**, **expansion workspace/collections/shortcuts/GAF recent**, **recommended app chips**), floating widget (+ AudioTrackMeta), **DesktopWorkspaceEmptyState** app-store CTA, settings badges; **Settings Center header close**; **DesktopAppModalFrame** shared close + **truncated modal title**; **DesktopAppMenuHeader** context menus (Start Menu, taskbar pinned, doc editor) **title/subtitle truncate**; **DesktopAppMenuItem** + **DesktopAppContextMenuTitle** string labels; **DesktopProductHeader** truncate; taskbar **window/group buttons + group/overflow lists + hover preview** (styled bridge, not native-only); **GAFChatChatActionsMenu** overflow items; **QuickSearch launcher rows** (search + browse sections); **Icons/Chrome/Shell** style picker cards + segments, **CuratedStylePresetsRow**, Personalize try-on/presets/quick-jump/theme/wallpaper/pack; **Shell** VD/apps/sync actions, **widget slot** DnD rows; **expansion** workspace/discovery action buttons; **UGSDesktopContainer** view tabs; **RuntimeDisabledActionsHintCard** raw-details toggle |
| `components/WindowTitleBar.tsx` | Title bar controls + truncated title / instance pill tooltips |
| `components/VirtualDesktops.tsx` | VD strip: desktop switch, add, delete, counter, quick scenarios |
| `constants/desktopCuratedStyleSets.ts` | Curated looks; опционально `fontBody` / `fontDisplay` / `sceneDepth` |
| `components/settings/DesktopSettingsPersonalizeTab.tsx` | Вкладка «Персонализация» (`DesktopSettingsTabIntro` + Visual Studio) |
| `components/settings/DesktopSettingsIconsTab.tsx` | Вкладка «Иконки» (motion cards + `DesktopSettingsTabIntro`) |
| `components/settings/DesktopSettingsChromeTab.tsx` | Вкладка «Оформление окон» (motion cards + `DesktopSettingsTabIntro`) |
| `components/settings/DesktopSettingsShellTab.tsx` | Вкладка «Поведение shell»: intro + sticky sub-nav; тело — `expansion/DesktopSettingsExpansionShellCluster` |
| `components/settings/DesktopSettingsPerformanceTab.tsx` | Вкладка «Производительность» (motion cards + intro с budget/tip) |
| `components/settings/expansion/DesktopSettingsExpansionShellCluster.tsx` | Facade shell-tab body: VD, windows/widgets chrome, apps, sync, expansion cards |
| `components/settings/expansion/DesktopSettingsExpansionSection.tsx` | Оркестратор expansion (lazy cards + stagger motion `0.28`–`0.44`) |
| `components/settings/expansion/desktopSettingsWidgetSlotCopy.ts` | User labels + per-slot help (`settingsPanel.widgetSlot*` / `widgetSlotDesc.*`) |
| `components/settings/expansion/*` | Карточки expansion (storage, workspace, discovery, widget panel, assistant), shell sub-cards, lists, DnD slots, error banner |
| `components/settings/DesktopSettingsFormCard.tsx` | Общая карточка формы |
| `utils/desktopShellMotion.ts` | Единые spring/stagger пресеты shell (taskbar, Start Menu, Quick Search, minimize) |
| `components/DesktopWindowMorphChip.tsx` | Shared `layoutId` morph иконки окна ↔ taskbar (title bar + window buttons) |
| `hooks/useDesktopWallpaperParallax.ts` | Pointer parallax `#desktop-main`: `desktop_scene_depth` × `desktop_shell_parallax_*` × effective reduce motion; CSS vars `--desktop-wallpaper-parallax-*` |

**Shell motion polish (2026-06-21):** `LayoutGroup` на canvas+windows+taskbar; minimize spring + icon morph; wallpaper `--desktop-wallpaper-parallax-*` на `#desktop-main`.

**Shell motion settings (2026-06-21):** Visual Studio → «Движение и подсказки» — `desktop_shell_*` prefs в `profile.preferences.ui`; резолвер `resolveDesktopShellMotion.ts` + контекст `DesktopShellMotionPrefsContext` (OS reduce-motion, `animations_enabled`, accessibility).

**Shell motion chrome + preview (2026-06-21):** те же prefs применяются к Start Menu (`desktopShellMenuPanelVariants`, stagger по `speedScale`), Virtual Desktops (enter/exit через `desktopShellTransitionDurationSec`), Notification Hub item layout; live preview в Visual Studio (morph cycle + pointer parallax по form state); вкладка «Производительность» → ссылка «Настройки движения оболочки» (`openShellMotionSettings` → Personalize / `desktop_shell_motion`).

**Visual Studio interactive preview (2026-06-21; polish 2026-08-05):** `DesktopVisualStudioPreviewInteractive` — hotspot-зоны на live preview (фон/шрифты/окно/taskbar/morph/«Ещё») открывают anchored popover с теми же `onChange`, что карточки ниже; window/taskbar/opacity editable без перехода на вкладку Chrome. Legend/hover/morph chips — sentence-case (`VISUAL_STUDIO_PREVIEW_CHIP_CLASS`); morph label = `previewIconLabel`; hint strip + morph pause on hover/popover; popover theme sync + mini preview header; «Подробнее в карточке» → scroll/tab. **Stage/shell chrome (2026-08-05):** `VISUAL_STUDIO_PREVIEW_STAGE_CLASS` / `VISUAL_STUDIO_PREVIEW_SHELL_CLASS` — quiet panel depth (`--desktop-shadow-panel`), no heavy `0_28px_64px` drop shadow, no accent hairline wash on sticky preview shell; legend/demo chips `rounded-md`; hotspot active without outer glow. Lock: `desktopVisualStudioPreviewHotspots.premium.contract.test.ts`.

**Lazy load:** все пять вкладок подключаются через `React.lazy` + `Suspense` в `DesktopSettingsPanelTabPanels`; неактивная вкладка **размонтируется** (`activeTab === …`). Chunk split снижает initial parse монолита (~5k строк до split).

**Expansion split (волна 6, 2026-05-27; Settings Center slice 2, 2026-06-30):** `DesktopSettingsExpansionSection.tsx` — тонкий re-export; оркестратор и shell-tab body живут в `components/settings/expansion/` (`DesktopSettingsExpansionShellCluster`, lazy cards). Общие списки/DnD — `desktopSettingsExpansionLists.tsx`, `desktopSettingsExpansionWidgetSlots.tsx`; подписи слотов и help (в т.ч. **Избранное / Favorites**) — `desktopSettingsWidgetSlotCopy.ts` + `settingsPanel.widgetSlotDesc.*` в `desktopUi.json`. `DesktopSettingsShellTab.tsx` ~140 строк (intro + sub-nav). Ошибки PATCH coordinator → `subscribeCoalescedShellStatePatchErrors` → `useDesktopExpansionSettings.error` → баннер в storage card и sync-блоке (`DesktopSettingsExpansionSaveErrorBanner`).

**Волна 7 (2026-05-27):** sticky sub-nav внутри shell tab (scroll-to-anchor); `ExpansionList` виртуализирует >8 строк; pagehide keepalive flush coalesced writer; баннер ошибки показывает текст PATCH.

**Волна 8 (2026-05-27):**

| Пункт | Реализация |
|-------|------------|
| Prefetch lazy chunks | `prefetchDesktopSettingsTabChunks.ts` — `requestIdleCallback` (fallback `setTimeout`) при открытой модалке Settings; idempotent per session |
| Dedupe PATCH errors | `patchExpansion` без `toast.error`; только `error` state → баннер (coordinator subscription без дубля toast) |
| Virtualize workspace profiles | `WorkspaceProfilesExpansionList` → `VirtualVariableList` при `profiles.length > 8`; строка в `desktopSettingsExpansionWorkspaceProfileRow.tsx` |
| Save current workspace CTA | Акцентная кнопка «Сохранить текущий рабочий стол как пространство» в `DesktopSettingsExpansionWorkspaceCard` (`addWorkspaceProfileFromOpenWindows`) |
| E2E smoke | `e2e/desktop-settings-wave8.spec.ts` — sticky sub-nav + save-workspace CTA (`DESKTOP_SHELL_E2E_RUN=1`) |
| OpenAPI nested wire | `DesktopWorkspaceProfilesWire`, `DesktopWindowLayoutPresetWire`, … в `desktop.py`; pilot `desktop.openapi.json` + `desktop-openapi.ts`; pytest `test_desktop_shell_state_expansion_wire.py` |

**Волна 9 (2026-05-27):**

| Пункт | Реализация |
|-------|------------|
| Prefetch tuning | Соседние вкладки первыми (`buildDesktopSettingsTabPrefetchOrder`); `cancelDesktopSettingsTabChunkPrefetch` при закрытии панели |
| OpenAPI contract wave 10 | `desktopApi.contract.test.ts` — все expansion wire `$ref` (в т.ч. `anyOf` для nullable) |
| A11y / sync tests | `DesktopSettingsPanel.a11y.test.tsx` — клавиши 1–5, offline hint + persist queue |
| E2E offline sync | `e2e/desktop-settings-wave9.spec.ts` |
| Hotfix shell/expansion imports | `DesktopSettingsShellTab` — `DESKTOP_INTERACTIVE`, widget style keys; `desktopSettingsExpansionWidgetSlots` — React hooks + `DESKTOP_INTERACTIVE` |

**Волна 10 (2026-05-27):**

| Пункт | Реализация |
|-------|------------|
| Tablist keyboard | `desktopSettingsTablistKeyboard.ts` — Arrow/Home/End + roving `tabIndex` внутри своего уровня; цифры 1–3 переключают primary, 4–5 доступны только в раскрытом блоке behavior/comfort |
| Storage map UX | Полный перечень полей §1.1–1.4 в `storageMap`; карточка — scrollable `<ul>` + счётчик полей |
| E2E persist flush | `e2e/desktop-settings-wave10.spec.ts` — очередь offline → auto-flush после reconnect |
| Shared tab order | `DESKTOP_SETTINGS_TAB_ORDER` в `desktopSettingsShared.types.ts` (prefetch + panel) |

**Волна 11 (2026-05-27):**

| Пункт | Реализация |
|-------|------------|
| Storage map → live settings | `desktopSettingsStorageMapNavigation.ts` — bucket/field → `{ tab, elementId }`; кликабельные поля с `aria-controls` в `DesktopSettingsExpansionStorageCard` |
| Scroll после смены вкладки | `DesktopSettingsPanel` — `handleStorageMapFieldNavigate`, `scrollToSettingsElement` с retry после lazy mount |
| Manual flush Vitest | `DesktopSettingsPanel.a11y.test.tsx` — `data-testid` flush → `onFlushPersistQueue` |
| E2E manual flush | `e2e/desktop-settings-wave11.spec.ts` — 503 на PATCH → ошибка → повтор успешен, баннер скрыт |
| i18n | `storageMapFieldGoTo` (RU/EN) |

**Волна 12 (2026-05-27):**

| Пункт | Реализация |
|-------|------------|
| Storage map E2E | `e2e/desktop-settings-wave12.spec.ts` — клик `desktop_config/wallpaper` → вкладка Personalize |
| Stable test ids | `data-testid="desktop-settings-storage-map-field-{bucket}-{field}"` на кнопках полей |

**Волна 13 (2026-05-27):**

| Пункт | Реализация |
|-------|------------|
| Field-level DOM ids | `desktopSettingsFieldElementIds.ts` — `buildDesktopSettingsFieldElementId`, `WIRED_STORAGE_MAP_FIELD_KEYS` |
| Navigation precision | `resolveStorageMapFieldNavigateTarget` предпочитает field id; widget/desktop_config → shell advanced; `visual_style_presets` → personalize |
| UI wiring | `SettingsFormCard` optional `id`; ids на карточках Personalize / Icons / Chrome / Shell / Performance / expansion |
| Tests | `desktopSettingsFieldElementIds.test.ts`; расширен navigation test; E2E wave 12 проверяет `#desktop-settings-field-*` |

**Волна 14 (2026-05-27):**

| Пункт | Реализация |
|-------|------------|
| Settings bridge hook | `useDesktopSettingsCenterBridge.ts` — вынесено из `DesktopWorkspaceContent` |
| Shared shell prefs | `DesktopTaskbarShellPrefsProvider` оборачивает `DesktopWorkspaceContent` (hooks до JSX return) |
| Sync prefs UI | `DesktopSettingsShellSyncPrefsCard.tsx` — clock / quiet / timezone / tray |
| Field ids sync | `quiet_mode`, `clock_show_seconds`, `timezone`, `tray_show_*` wired |
| Timezone options | `constants/desktopShellTimezoneOptions.ts` |

**Backlog (волна 15+):** дальнейшее сжатие `DesktopWorkspaceContent` (shell settings integration cluster); единый источник timezone options для floating widget.

> **Интеграция волн 14–19:** living SoT is **this document** (dated `DESKTOP-SETTINGS-CENTER-WAVES-14-19-INTEGRATION-REFACTOR.md` → `trash/`).

**Волна 15 (2026-05-27):**

| Пункт | Реализация |
|-------|------------|
| Settings integration hook | `useDesktopWorkspaceSettingsCenterIntegration.ts` — bridge + personalization pack import/export + VD wallpaper override |
| Scroll bridge hook | `useDesktopShellSettingsScrollBridge.ts` — deep-link scroll target из payload окна Settings |
| Timezone dedupe | `DesktopWorkspaceFloatingWidget` использует `DESKTOP_SHELL_TIMEZONE_OPTIONS` напрямую (alias удалён) |
| Tests | `desktopShellTimezoneOptions.test.ts`, `useDesktopShellSettingsScrollBridge.test.ts` |

**Backlog (волна 16+):** консолидация `useDesktopWorkspaceShellSettingsIntegrationCluster` input в `DesktopWorkspaceContent`; E2E storage map → sync prefs card.

**Волна 16 (2026-05-27):**

| Пункт | Реализация |
|-------|------------|
| Shell cluster input hook | `useDesktopWorkspaceShellSettingsClusterInput.ts` — flat slices → `shellClusterRest` (~60 строк из content) |
| Widgets panel normalize | `normalizeDesktopWidgetsPanelPosition.ts` — shared fallback `top-right` |
| Storage map → timezone E2E | `e2e/desktop-settings-wave16.spec.ts` |
| Navigation tests | `desktopSettingsStorageMapNavigation.test.ts` — `shell_state/timezone` → field id |
| Sync timezone test id | `data-testid="desktop-settings-sync-timezone"` на select в sync prefs card |

**Backlog (волна 17+):** вынести `mergedSettingsPerformanceForPanel` + appearance/wallpaper slices; Playwright offline flush для sync prefs timezone change.

**Волна 17 (2026-05-27):**

| Пункт | Реализация |
|-------|------------|
| Performance panel merge hook | `useDesktopWorkspaceSettingsPerformanceForPanel.ts` — animations + backdrop blur toggles |
| Surface chrome bundle input | `useDesktopWorkspaceSurfaceChromeBundleInput.ts` — memoized accent/appearance/wallpaper/mainSurface slices |
| E2E sync timezone | `e2e/desktop-settings-wave17.spec.ts` — select change + offline queue flush (`timezone` payload) |
| Vitest | `useDesktopWorkspaceSettingsPerformanceForPanel.test.ts` |

**Backlog (волна 18+):** объединить `shellClusterRest` + `surfaceChromeBundleInput` в один facade hook; E2E PATCH intercept для timezone coalesced writer.

**Волна 18 (2026-05-27):**

| Пункт | Реализация |
|-------|------------|
| Surface chrome facade | `useDesktopWorkspaceSettingsSurfaceChromeFacade.ts` — `{ shell, chrome }` → `shellClusterRest` + bundle input |
| Content wiring | `DesktopWorkspaceContent` — один вызов facade вместо двух хуков |
| E2E PATCH body | `e2e/desktop-settings-wave18.spec.ts` — timezone select → `PATCH shell-state` с `timezone` |

**Backlog (волна 19+):** dedupe shared visual fields между `shell` и `chrome` slices; coordinator error banner E2E после failed timezone PATCH.

**Волна 19 (2026-05-27):**

| Пункт | Реализация |
|-------|------------|
| Shared visual slices | `desktopWorkspaceSettingsSharedVisualSlices.ts` + `useDesktopWorkspaceSettingsSharedVisualSlices.ts` |
| Facade merge | `useDesktopWorkspaceSettingsSurfaceChromeFacade` принимает `visual` input, spreads в shell/chrome |
| Error banner test id | `data-testid="desktop-settings-shell-patch-error"` + `role="alert"` |
| E2E failed PATCH | `e2e/desktop-settings-wave19.spec.ts` — timezone select → coordinator error banner |

**Волна 20 (2026-09-06):**

| Пункт | Реализация |
|-------|------------|
| Settings Integration Bundle | `useDesktopWorkspaceSettingsIntegrationBundle.ts` — public TailCluster entry (wraps ClusterInput) |
| Visual + persistence slices | `desktopWorkspaceSettingsIntegrationSlices.ts` — pure builders + `mergeDesktopWorkspaceSettingsShellRest` |
| Content wiring | `useDesktopWorkspaceContentTailCluster` → bundle (не inline ClusterInput) |
| Vitest | `desktopWorkspaceSettingsIntegrationSlices.test.ts`, `useDesktopWorkspaceSettingsIntegrationBundle.test.ts` |

**Волна 21 (2026-09-06):**

| Пункт | Реализация |
|-------|------------|
| Flat Tail → sources builder | `desktopWorkspaceSettingsIntegrationBundleSources.ts` — flat builder + `…SourcesFromHead(head, launch)` |
| Content wiring | TailCluster: `FromHead(head, { handlePinAppFromStartMenu, openAppStoreAsWindow })` |
| Vitest | `desktopWorkspaceSettingsIntegrationBundleSources.test.ts` |
| Forecast / readiness | [solution-readiness README](../../reference/solution-readiness/README.md) (registry retired) |

**Backlog (волна 22+):** optional Playwright matrix reuse of wave 16–19 sync paths; дальнейшее сжатие не-settings кластеров TailCluster.

**Волна 22 (2026-09-06):**

| Пункт | Реализация |
|-------|------------|
| Shell Nav AppProps input builder | `desktopWorkspaceShellNavAppPropsClusterInput.ts` — parts builder + `…FromTailParts(head, itemOps)` |
| Content wiring | TailCluster: `FromTailParts(head, itemOps)` → `useDesktopWorkspaceShellNavAppPropsAndSideEffectsCluster` |
| TailCluster LOC | **707 → 614** (target ≤620) |
| Vitest | `desktopWorkspaceShellNavAppPropsClusterInput.test.ts` (wrappers + five groups + FromTailParts) |
| Playwright Lock | `e2e/desktopSettingsSyncHelpers.ts` — wave 16–19 sync goto/open/timezone reuse |
| Forecast / readiness | [solution-readiness README](../../reference/solution-readiness/README.md) (registry retired) |

**Backlog (волна 23+):** дальнейшее сжатие layout/modals кластеров TailCluster; optional Playwright matrix consolidation beyond shared helpers.

**Волна 23 (2026-09-06):**

| Пункт | Реализация |
|-------|------------|
| Layout assembly FromTailClusters | `desktopWorkspaceShellLayoutInputAssemblyFromTail.ts` — named bags → Sources |
| Deferred runtime builders | `desktopWorkspaceDeferredRuntimeInputs.ts` + `useDesktopWorkspaceDeferredRuntimeInputsCluster` |
| Expansion launch dedupe | `useDesktopWorkspaceExpansionLaunchActionsFromParts` — one input → hook + deferred omit |
| Layout root params | `desktopWorkspaceShellLayoutRootClusterParams.ts` |
| Content wiring | TailCluster thin call sites for layout / deferred / root |
| TailCluster LOC | **614 → 442** (target ≤500) |
| Vitest | layout FromTail / deferred inputs / layout root params tests |
| Forecast / readiness | [solution-readiness README](../../reference/solution-readiness/README.md) (registry retired) |

**Backlog (волна 24+):** optional Playwright sync matrix beyond helpers; further Tail leftovers (return bag / drop handlers) if still above operator budget.

**Волна 24 (2026-09-06):**

| Пункт | Реализация |
|-------|------------|
| Bridge input utils | `utils/desktopWorkspaceShellLayoutBridgeInput/` — canvas / chrome / derived builders + compose |
| Sources type | `desktopWorkspaceShellLayoutInputAssembly.types.ts` (re-export from assembly hook) |
| Thin assembly hook | `useDesktopWorkspaceShellLayoutInputAssembly.ts` **588 → 35** LOC |
| Vitest | remap locks: sync OR flush, contextMenuType window→desktop, widget_position seed |
| Forecast / readiness | [solution-readiness README](../../reference/solution-readiness/README.md) (registry retired) |

**Backlog (волна 25+):** optional Playwright sync matrix beyond W22 helpers; Tail &lt;400 only if operator budgets further compression.

**Type contracts (assembly, 2026-07-28):** Settings surface chrome / voice cluster inputs use `AccentColorId` (not `DesktopConfig['accent']`) for accent + RGB slices; shell cluster requires concrete `iconSize` / `gridStep`; new-folder create handlers take `UserFolderIconId`; expansion launch open uses `OpenWindowOptions`. Facade omits visual fields injected from shared slices so callers do not duplicate them.

---

## 3. Workspace profiles: JSON-контракт и UI менеджера

### 3.1 Хранение на сервере

`shell_state.workspace_profiles` — объект с массивом **`profiles`** (см. нормализацию в `normalizeWorkspaceProfiles`).

### 3.2 Контракт элемента `DesktopWorkspaceProfile`

Уже зафиксирован в `desktopExpansion.types.ts`:

```ts
interface DesktopWorkspaceProfile {
  id: string;
  name: string;
  description?: string;
  desktopId?: string;           // привязка к virtual desktop id
  wallpaper?: string;
  appIds: string[];             // id элементов/каталога для «открыть набор»
  folderItemIds: string[];
  widgetIds: string[];
}
```

**Рекомендации по эволюции (без ломки):**

- Новые опциональные поля только как необязательные ключи (API merge не удаляет неизвестные вложенные структуры осторожно — проверять при добавлении).
- Лимит **24** профиля (как в `useDesktopExpansionSettings`).
- `appIds` должны резолвиться в `openWindow` через те же `DesktopItem`, что и лаунчер (не вводить второй resolver).

### 3.3 UI «Менеджер пространств»

**Точки входа (без горячих клавиш):** кнопка настроек сценариев и **выпадающий список сохранённых профилей** (`VirtualDesktops`: `workspaceQuickScenarios` / `onOpenWorkspaceQuickScenario` → `openWorkspaceProfile`) рядом с переключателем VD на taskbar; **те же шаблоны сценариев**, что в настройках — на вкладке «Работа» в Пуске (`StartMenu`, `onAddWorkspaceProfileFromTemplate`); пункт Start Menu, блок в Settings → shell.

**Экран:**

- Сетка карточек: превью обоев, имя, связанный virtual desktop, число закреплённых приложений/папок.
- Действия: «Применить» (переключить VD + обои + опционально открыть `appIds` через существующий `openWindow` с `WindowInitialPayload`), «Редактировать», «Удалить».
- «Сохранить текущее как пространство» — явная акцентная кнопка в Settings → shell → workspace card (**волна 8**, `addWorkspaceProfileFromOpenWindows`); ранее — эвристика `addWorkspaceProfile` и вторичная кнопка «From open windows».

---

## 4. Окна: layout presets, snap picker, reset / collect

### 4.1 Layout presets

Тип `DesktopWindowLayoutPreset`: `{ id, name, description?, windows: PersistedWindowState[], createdAt? }`.

- Сохранение: уже реализовано через `addWindowLayoutPreset` (текущие окна → `persistableWindow`).
- Применение: `applyWindowLayoutPreset` → коллбек `onApplyWindowLayoutPreset` в `DesktopWorkspaceContent` должен вызывать `restoreWindows` / согласованную стратегию (не дублировать менеджер).

**Проектирование UX:**

- Список пресетов в Settings и в контекстном меню taskbar (подменю «Раскладки»).
- При применении: диалог «Заменить текущие окна / добавить к существующим» (**реализовано:** `DesktopWindowLayoutPresetApplyDialog`, `applyDesktopWindowLayoutPresetWindows.ts`; при пустом столе — сразу add).

**Сценарные пресеты (реализовано):** помимо кнопок по «кураторским» id (`halfHorizontal`, …), в Settings → shell доступны строки **сценариев** — та же snap-геометрия, но сохранение в `window_layout_presets` с именами вроде «Редактор и чат» / «Студия и результат» (см. `desktopScenarioWindowLayouts.ts`, `addWindowLayoutPresetFromScenario`, `applyScenarioWorkspaceLayout`). Окна по-прежнему берутся из открытых на текущем столе, не из фиксированного списка приложений. Подробная таблица и a11y — [`DESKTOP-WINDOW-LAYOUT-PRESETS.md`](DESKTOP-WINDOW-LAYOUT-PRESETS.md).

### 4.2 Визуальный snap picker

Сегодня `SnapZone` включает половины, углы и трети (`desktop.types.ts`); геометрия — `getSnapZoneForClientPosition` в `desktopSnapGeometry.ts`.

**UI-слой:** при удержании заголовка окна показывать полупрозрачную сетку зон поверх рабочей области (без дополнительного тяжёлого blur при включённом low-GPU режиме — см. `DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md`). Подсветка активной зоны синхронизирована с `snapZone` из `useWindowManager`.

### 4.3 «Вернуть окна на экран» / «Собрать окна пространства»

- **На экран:** функция нормализации позиций `WindowState.position` в границы `readDesktopWorkArea()` + минимальные размеры из registry (см. `DESKTOP-WINDOW-MIN-SIZES.md`, вынос `getMinWindowSize` из `EnhancedWindow.tsx`).
- **Собрать:** `collectCurrentWorkspaceWindows` в expansion — связать с обновлением пресета или каскадной укладкой (алгоритм: сохранить порядок z-index, разложить смещением по диагонали в пределах work area).

---

## 5. Start Menu и App Store как единый discovery / control слой

### 5.1 Общие принципы

- **Один источник приложений:** `useDesktopInstalledApps`, `desktop_items`, `/desktop/installed`; политики окон — из каталога.
- **Контекст пространства:** читать активный `workspace_profiles` / `activeDesktopId`; секция «Рекомендуемые» = объединение `appIds` профиля и `app_collections`, связанных с этим профилем.

### 5.2 Start Menu

**Multimodal orchestrator (2026-07-14):** `components/StartMenu.tsx` reads `profile.ui.desktop_menu_mode` (`legacy` | `command_console` | `workspace_dashboard`, default **`legacy`**) and renders:

| Mode | Component | Role |
|------|-----------|------|
| `legacy` | `StartMenuLegacy.tsx` | Production-stable Пуск (tabs, grid, disclosures) — unchanged behavior |
| `command_console` | `startMenu/StartMenuCommandConsole.tsx` | Search-first list; shared fuzzy ranker with Quick Search |
| `workspace_dashboard` | `startMenu/StartMenuWorkspace.tsx` | WorkExpansion-first workspace board |

**Home tab (P19 + Wave 1 density + Wave 3 guided empty, 2026-08-10):** `StartMenuHomeSurface` — search-first short pinned/recent; when Home has content, hint + **catalog CTA** in a soft strip; section headings **sentence case** (override chrome `uppercase`). Fully empty idle Home or empty search: **one** hero empty state with the same catalog CTA (hint strip hidden — no competing guidance). Idle short lists use `density="home-short"` (≤3 cols); Home search results keep full catalog density. Keys: `startMenu.homeHint`, `openAllApps`, `emptyHomeDescription`, `emptySearchDescription`. Command Console idle empty: `focusSearchCta` focuses the search field. Empty desktop canvas copy (`workspace.emptyDesc`) is App Store–only (single path). Offline sync chip (`DesktopSyncStatus`) exposes Retry via `onRetry`/`onRefresh` like the error branch.

**Recent tab (Wave 1 progressive, 2026-08-10):** `StartMenuRecentDiscovery` — overview strip + Continue + collapsed documents preview (`START_MENU_RECENT_LIBRARY_PREVIEW_CAP`); full library slices + recommended (`START_MENU_RECENT_RECOMMENDED_CAP`) only when `showLibraryDiscovery`. Idle MRU grid in `StartMenuLegacy` uses `density="home-short"` + `START_MENU_RECENT_MRU_CAP` (search → `catalog`). Role strip in `StartMenuSearchHeader` uses `startMenu.roleTitle/Description/Badge`.

**Settings:** Desktop Settings → Shell → **Start menu layout** (`DesktopSettingsMenuModeCard`). Persist via `PATCH /preferences` → `ui.desktop_menu_mode`.

**Single Brain search:** `utils/desktopLauncherFuzzySearch.ts` (`rankDesktopAppsForQuery`) — used by Quick Search and Command Console (no per-surface scoring fork).

Оркестратор legacy-тела: `components/StartMenuLegacy.tsx`. Структурные модули (Wave N1): `components/startMenu/StartMenuTabStrip.tsx`, `StartMenuRecentDiscovery.tsx`, `StartMenuWorkExpansion.tsx`, `StartMenuAppGrid.tsx`, `useStartMenuDisclosure.ts`, `startMenuPrimitives.tsx`. Клавиатура (Wave N11): `useStartMenuKeyboard.ts` + `unwindStartMenuEscapeLayer`.

**Tab strip IA (P1 2026-07-28):** primary strip = **Categories** + **Recent** only. **Pinned / All / Work** live under «Ещё» (`aria-haspopup="menu"`, `data-testid=start-menu-more-tabs-menu`); selecting a secondary tab keeps the More menu closed.

Таб **«Недавние»** (legacy): сверху вниз — overview + progressive library disclosure (collapsed by default; intent selects tab only), **Продолжить** (`resumeWindows`), short documents preview when collapsed, then (when expanded) **«Для текущего пространства»** + library slices, затем заголовок сетки (**«Недавние приложения»** или **«Совпадения»** при поиске) и MRU-сетка с `home-short` на idle (`StartMenuAppGrid`). Контекстное меню приложения: открыть, новое окно (если policy), на стол, открыть в пространстве.

Таб **«Работа»** (legacy / workspace mode): (`StartMenuWorkExpansion`) шаблоны сценариев (`workspace_profiles`), список сохранённых пространств, **заготовки коллекций**, пользовательские `app_collections`, `content_shortcuts`, видимые assistant actions (+ advanced GAF recent).

Таб **«По категориям»** (legacy): под заголовком категории — краткая подсказка `desktopUi.appCategoryHints.<id>`; компактные карточки через `StartMenuAppGrid` (иконка + имя + description/category meta; pin на стол — chip / icon+tooltip, без длинной подписи на плитке). **P5 (2026-07-28):** карточка = `<article>` + sibling buttons (open / pin / overflow menu) — без nested interactive. **P16 (2026-07-28):** density SSOT `startMenuAppGridLayout.ts` — на `max-sm` сетка **2 колонки**, имя `shellCopy13` (не taskbar 11px), meta и category hints скрыты; keyboard cols lockstep с grid breakpoints.

| Секция | Данные |
|--------|--------|
| Продолжить | `resumeWindows` из shell / мост Desktop |
| Для текущего пространства | `workspace_profiles[].appIds` фильтром по активному столу |
| Недавние файлы | пропсы `recentFiles` / обработчик открытия |
| Коллекции | `app_collections` + быстрые шаблоны коллекций |

### 5.3 App Store

На карточке (`AppStoreCard`): бейджи и текстовый блок **«На рабочем столе / пространства / коллекции»** при установленном приложении; политика окон и минимальные размеры — см. код карточки и `getAppStoreWindowInstanceCap`.

**Категории (паритет с Пуском):** те же ключи, что **`desktopUi.appCategoryHints`** и `appCategories`: в списке каталога (режим «все категории») — краткий текст под заголовком секции; при фильтре **одной** категории на **`lg`** подсказка дублируется в **сайдбаре** под списком категорий, а в основной колонке подсказка у заголовка скрыта на больших экранах (`lg:hidden`), чтобы не повторять текст.

**Навигация:** управление коллекциями и сценариями — вкладка «Поведение shell» и Пуск («Работа»).

---

## 6. Project / content flows на столе

**Папка проекта на столе (`eliteew-proj-{uuid}`):** создаётся **автоматически** при `POST /api/v1/projects` (`ensure_project_desktop_folder` в `api/services/project_desktop_folder_service.py`); дублирующий клиентский ensure — в `ensureProjectDesktopFolder` при открытии Файловый менеджер из кабинета. Открытие ярлыка (и пункт контекстного меню «в Файловый менеджер») переводит в **Файловый менеджер** с **`contentManagerProjectId`** и опционально **`contentManagerProjectName`**, а не в окно встроенной папки рабочего стола — см. `parseProjectIdFromDesktopFolderItemId`, `useDesktopWorkspaceAppLaunch`. Файловый ярлык внутри такой папки (или после перетаскивания в неё) синхронизирует **`unified_content.folder_item_id`** и классификацию **`project_id` / `company_id`** через `desktopFileContentFolderScope.ts`; перенос в обычную папку или на корень стола снимает привязку к проекту/компании.

### 6.1 Проектные папки

Окно Файловый менеджер уже понимает `WindowInitialPayload`:

- `contentManagerProjectId`, `contentManagerFolderItemId`, `contentManagerCompanyId`, варианты отображения кабинета.

**Desktop UX:** ярлык с id **`eliteew-proj-{uuid}`** при открытии с **рабочего стола** сразу открывает Файловый менеджер в scope проекта; обычные папки — окно `DesktopFolderWindow` или навигация по `contentManagerFolderItemId`. Системные папки создаются на API; контент привязан через `folder_item_id`.

### 6.2 Сохранённые фильтры

Тип `DesktopContentShortcut` с `type: 'saved-filter'`, `target: Record<string, string>` — хранить достаточные query-параметры для восстановления фильтра Файловый менеджер (контракт ключей зафиксировать в одном месте на фронте, например `contentManagerSavedFilterV1`).

### 6.3 Recent content

- Источник порядка «Недавние файлы» в Пуске (MRU): `recent_file_ids` в shell_state + первичная загрузка **`GET /api/v1/desktop/recent-files`**.
- Лента библиотеки: **`GET /api/v1/desktop/recent-content-feed?limit=1…30`** (по умолчанию 6). В ответе четыре массива элементов **в том же JSON-форме, что и строки `GET /desktop/recent-files`** (`id`, `name`, `type`, `path`, `openedAt`):
  - **`opened`** — порядок по `COALESCE(last_accessed_at, updated_at)`;
  - **`added`** — по `created_at` (любое происхождение записи);
  - **`generated`** — непустой `source_service` в `unified_content`, **исключая** `user_profile` и `product_desktop` (аватары и операторские привязки к продукту);
  - **`uploaded`** — пустой `source_service`, **исключая** строки с `sub_type = gaf_chat_voice` (шум от голосовых вложений GAF).
- **Фронт:** `useDesktopRecentContentFeed` внутри `useDesktopWorkspaceRecentFilesAndViewport`; блоки в **Пуске** и **Quick Search** (i18n `startMenu.library*` / `quickSearch.library*`). Для списка «недавно добавленные» в UI **убираются id**, уже попавшие в **generated** или **uploaded**, чтобы не показывать одну и ту же запись дважды.
- После действия **«Обновить рабочий стол»** (`performWorkspaceRefresh`) выполняется **повторный запрос** ленты (`refetchRecentContentFeed`), чтобы данные совпали с только что перечитанным состоянием.
- Постоянный polling не требуется. Отдельного API-среза только «последние документы» (`content_type = document`) нет: документы пользователь видит в MRU и в секции **opened**; при необходимости — отдельное ТЗ.

### 6.3.1 Единый блок «недавно открытые» (Пуск / Quick Search)

Чтобы не дублировать два списка с одним смыслом (MRU **`recent_file_ids`** vs срез **`opened`** ленты), фронт агрегирует источники в **`mergeRecentDocumentsDiscovery`** (`shared/web/frontend/src/pages/Desktop/utils/mergeRecentDocumentsDiscovery.ts`): сначала элементы **`opened`**, затем MRU без пересечения по `id` (до 8 записей). Заголовки UI: **`startMenu.recentDocumentsUnifiedTitle`**, **`quickSearch.recentDocumentsUnifiedHeading`**.

### 6.4 Контекстные действия

ПКМ для элементов `desktop_items` типа `file`/`folder` (**реализация:** `EnhancedContextMenu.tsx`, обработка в `useDesktopWorkspaceHandleAction`):

- **Свойства**: модалка рабочего стола.
- **Назначить компанию / проект** (для ярлыка **file**): Файловый менеджер с `contentManagerFocusUnifiedContentId` и `contentManagerOpenAssignProject`.
- Открыть в DocEditor / Music Player (для аудио) / Файловый менеджер — подменю «Открыть с помощью».
- «Отправить в GAF» / Desktop AI — с передачей идентификатора контента в payload (без дублирования бинарников).

---

## 7. Виджет-панель (без системных мониторингов)

### 7.1 Контракт `widgets_layout`

```ts
interface DesktopWidgetsLayout {
  slots: DesktopWidgetLayoutSlot[];
  perWorkspace: boolean;
}
interface DesktopWidgetLayoutSlot {
  id: string;
  type: 'assistant-plan' | 'agenda' | 'notes' | 'todos' | 'favorites'
       | 'ewdesk' | 'notifications' | 'now-playing'
       | 'project-shortcuts' | 'recent-content';
  enabled: boolean;
  /** Persisted density hint. Settings no longer toggle this; `compact_widgets` overrides to compact. Expanded maps to roomy inline, never a placeholder. */
  mode: 'compact' | 'expanded';
  position?: { x: number; y: number };
  workspaceProfileId?: string;
}
```

**Запрещено по продуктовым guardrails:** слоты CPU/GPU/RAM/network telemetry.

### 7.2 Поведение

- **Панель со слотами:** composition-only; each enabled slot shows a **live body**. Deep-link «открыть в окне» is secondary (`desktop-performance-background-mounts.mdc`). Default enabled: Assistant plan, agenda, notes, EWDesk, now-playing. Legacy todos are opt-in scratch, not the plan.
- Per-slot compact/expanded **toggle is removed**; density is `compact_widgets` («compact all») plus persisted `mode` (expanded → roomy inline).
- **Per-space:** при `perWorkspace === true` выбор слота учитывает `workspaceProfileId` / активный профиль; фолбек — глобальный набор слотов.
- **Drag внутри ограниченной области:** обновление `position` слота → debounced `patchDesktopShellStateMerged`.

### 7.3 Связь с `desktop_config`

`show_widgets_panel`, `widgets_panel_position`, `compact_widgets` остаются в конфиге; `widgets_layout` — детальная композиция в shell_state.

---

## 8. Assistant и GAF: видимые context actions

### 8.1 Контракт `assistant_context_actions`

`DesktopAssistantContextAction`: `id`, `label` (i18n key), `source` (`selection` | `window-toolbar` | `context-menu` | `properties-panel`), `assistantTarget` (`assistant` | `gaf`), `enabled`.

- Редактирование списка: только enable/disable через настройки (не произвольный пользовательский код).
- **Без новых глобальных hotkeys;** триггеры — ПКМ, кнопки тулбара окна, панель свойств.

### 8.2 Контекст окна

Окно передаёт в Assistant/GAF только явный **opt-in** payload (`WindowInitialPayload` / узкий channel props): документ, projectId, выбранный файл. Не сканировать всё дерево состояния.

### 8.3 GAF desktop

Использовать существующие поля `targetUsername`, `targetChatId`; recent threads — из GAF API при открытии меню, не фоновый permanent websocket для discovery.

### 8.4 Где смотреть в UI (волна 7, реализация)

| Вход | Файлы / поведение |
|------|-------------------|
| ПКМ по заголовку окна | `DesktopWorkspaceWindowContextMenu` — секция Assistant/GAF при `isAssistantWindowContextSupported` |
| Кнопки в title bar | `WindowTitleBar` — дублируют те же действия (иконки Bot / MessageCircle), i18n `windowContextMenu.*` |
| Выделение на корневом столе | `DesktopAssistantSelectionRail` — explain / task / GAF; плюс **summarize-window**, если активное окно поддерживает контекст |
| Свойства ярлыка | `ItemPropertiesModal` — explain / task / GAF для файлов; `allowAnyDesktopLocation` в `buildAssistantLaunchFromExpansionAction` для объектов не с корня стола |
| Настройки expansion | Включение/выключение действий: `assistant_context_actions` в `useDesktopExpansionSettings` |

---

## Персонализация и комфорт (волна 8)

### Контракт данных

- **`shell_state.visual_style_presets`**: сохранённые пользователем снимки набора полей визуального стиля. Сервер: нормализация и ограничения в **`shared/api/routers/desktop.py`** (`_sanitize_visual_style_presets_shell`, поля `DesktopShellStateOut` / патч `DesktopShellStatePatch`).
- **`profile.preferences.ui`**: см. §1.4 — дополнительно **`desktop_reduce_backdrop_blur`**. Карточка **Производительность** в настройках стола смешивает эти prefs с локальными флагами сессии (`STATIC_DESKTOP_SETTINGS_PERFORMANCE` в `DesktopWorkspaceContent`).

### JSON-профиль стола и try-on

- **`shared/web/frontend/src/pages/Desktop/utils/desktopVisualProfilePack.ts`**: версионированный пакет `eliteew.desktopVisualProfilePack`; **экспорт v2** может включать **`shell`**: **`workspace_profiles.profiles`** (до 24) и **`window_layout_presets`** (до 96). **Парсинг** принимает **v1** (только конфиг + `visual`; поле **`shell`**, если присутствует, не применяется) и **v2**. При экспорте отбрасываются oversized data URL обоев; при импорте v2 с **`shell`** успешный путь вызывает **`patchDesktopShellStateMerged`** и обновление expansion state.
- **Try-on без немедленного сохранения:** флаг **`personalizationStagingActive`** и ref **`deferVisualPersistRef`** в **`DesktopWorkspaceContent`**; пока активен staging, в bridge передаётся **`profilePatchRemote: false`**; курируемый пресет и Apply коммитят изменения профиля.
- **`data-desktop-reduce-backdrop-blur="true"`** на **`#desktop-main`**: глобальное правило ослабляет размытие оболочки (см. **`useDesktopWorkspaceShellCss`**).

### Синхронизация типов OpenAPI

- После изменения Pydantic-моделей shell-state во фронтовом дереве выполните **`pnpm run openapi:export`** (контейнер API) и **`pnpm run openapi:refresh-pilots`** из **`shared/web/frontend`**. В pilot **`openapi/pilot/desktop.openapi.json`** схемы **`DesktopShellStateOut`** и **`DesktopShellStatePatch`** должны содержать ключи expansion включая **`visual_style_presets`**; см. **`src/pages/Desktop/services/__tests__/desktopApi.contract.test.ts`** (полный набор ключей и пакет полей expansion, **волна 10**).

---

## 9. Quality pass по волнам

| Волна / тема | i18n | a11y | Тесты | Сборка |
|--------------|------|------|-------|--------|
| Settings Center map/sync | Ключи `desktopUi.settingsPanel.*` для всех новых подписей | Порядок фокуса: вкладки → sub-nav → формы; `aria-expanded` на аккордеонах | Vitest: нормализаторы `normalizeWorkspaceProfiles`, `normalizeWidgetsLayout` | `pnpm run build:react-compiler` |
| Workspace profiles UI | ru/en `desktopUi.json` | Карточки с `role="button"` или настоящие кнопки, подписи полей | Расширить `desktopApi.contract.test.ts` если OpenAPI добавит поля | Сборка |
| Window layouts + snap UI | Лейблы зон snap (опционально `aria-live` при смене) | `desktopSnapGeometry.test.ts` + снапшоты позиций после snap | Сборка |
| Discovery Start/App Store | Категории: уйти на i18n-ключи в `constants/index.ts` | Поиск: управление стрелками, модалы focus trap | Vitest для селекторов коллекций (pure) | Сборка |
| Content workflows | Новые строки для ПКМ | Контекстное меню: escape, возврат фокуса | Контракт `content_shortcuts.target` (unit) | Сборка |
| Widget panel | Все слоты | Перетаскивание: не только мышь (кнопки «вверх/вниз» как fallback) | Vitest: merge `widgets_layout` | Сборка |
| Assistant context | `label` → t() | Не прятать единственный toggle без видимого названия | Загрузка default actions | Сборка |
| Персонализация / экспорт профиля (волна 8) | Полный parity ru/en | Preview: фокус не теряется при apply/cancel | Контракт pilot: **`visual_style_presets`** в `desktopApi.contract.test.ts`; Vitest **`useDesktopWorkspaceShellSettingsIntegration`** | Сборка + `openapi:export` + **`openapi:refresh-pilots`** при смене `desktop.py`; health API по `project-and-deploy.mdc` |
| Надёжность / Settings Center (волна 9) | При новых ключах UI — ru/en | ARIA вкладки: **`DesktopSettingsPanel`**, см. **`DESKTOP-SHELL-A11Y-CHECKLIST.md`** | **`DesktopSettingsPanel.a11y.test.tsx`**; контракт пакета expansion в **`desktopApi.contract.test.ts`**; **`desktopVisualProfilePack.test.ts`**; гидратация **`visual_style_presets`** в **`useDesktopExpansionSettings.test.tsx`** | `pnpm run build:react-compiler` |

**Регрессия производительности:** после каждой волны пройти чеклист `DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md` (lazy mount, нет постоянного тяжёлого blur).

---

## Перекрёстные ссылки

- Персистентность: `product/desktop/DESKTOP-STATE-PERSISTENCE.md`
- Perf окон: `product/desktop/DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md`
- App Store: `product/desktop/DESKTOP-APP-STORE.md`
- A11y shell: `product/desktop/DESKTOP-SHELL-A11Y-CHECKLIST.md`
