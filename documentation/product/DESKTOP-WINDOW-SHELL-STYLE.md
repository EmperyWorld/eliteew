# Стиль окон рабочего стола (Desktop Window Shell Style)

Каноническое описание **пресета «Стиль окон»**: что он меняет, где хранится настройка, какие API в коде использовать и как **не ломать** визуальную согласованность с окнами, вложенными приложениями и плавающими панелями.

Связанные материалы:

- Общий язык glass / premium surface: **`desktop_brand_style.md`**
- Оболочка рабочего стола и окна (обзор): **`.cursor/rules/desktop-shell-and-windows.mdc`**
- Реализация токенов и пресетов: **barrel** **`shared/web/frontend/src/pages/Desktop/utils/desktopVisualSystem.tsx`** + modules **`…/desktopVisualSystem/*`** (taskbar / frames / icons / shell helpers / titlebar / glyphs / motion)
- Производительность оконного runtime (lag root-cause и guardrails): **`desktop/DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md`**

**Глобальный контекст пресета:** `App.tsx` оборачивает дерево в **`GlobalDesktopShellFrameProvider`** (`shared/web/frontend/src/contexts/GlobalDesktopShellFrameProvider.tsx`): `desktop_window_style` берётся из merge `DEFAULT_UI_PREFERENCES` + `UserPreferences.ui` (тот же серверный снимок, что и в `useDesktopWorkspaceVisualProfileBridge`). Компоненты на полноэкранных маршрутах, вызывающие **`useDesktopShellFrame()`**, получают выбор пользователя из профиля, а не жёсткий default `glass` из `createContext`. На маршруте **`desktop`** внутренний **`DesktopShellFrameProvider`** в **`DesktopWorkspaceShellLayout`** переопределяет значение живым состоянием рабочего стола (включая оптимистичные правки до завершения `PATCH`).

### Зоны фронтенда для аудита пресета

Удобное разбиение **`shared/web/frontend/src/`** при проверке согласованности с пресетами **`DesktopWindowStyle`** (в т.ч. `glass` / `framed` / `minimal` и расширения; вложенный UI — по **`getDesktopWindowShellTier()`**):

| № | Зона (путь от `src/`) | На что смотреть |
|---|------------------------|-----------------|
| 1 | `pages/Desktop/components/**` | Окна, таскбар, QuickSearch, виджеты, GAF/UGS контейнеры: inline `var(--glass-*)`, `getDesktopShellPanelClassName` vs сырой glass. |
| 2 | `pages/Desktop/` (без `components/`) | `DesktopShellFrameProvider`, границы провайдера, `DesktopWorkspaceContent`, welcome/skeleton. |
| 3 | `pages/ContentManager/**` | Embedded: `getDesktopShell*` на вкладках Files, панели, `FileRow`; нет ли лишнего `surface-app` поверх окна. |
| 4 | `features/friends/**` | Social Hub, FriendsApp, FriendsDirectory: хелперы, без второго `content` на корне. |
| 5 | `components/UserProfile.tsx`, `components/profile/**` | `embedded` + `shellPanel` / toolbar cluster. |
| 6 | `components/UltimateDocEditor/**` | Дублирование `content`, titlebar, панели, `EditorToolbar`. |
| 7 | `components/UGS/**` | Тёмный slate vs пресет окон; поэтапное подключение shell API. |
| 8 | `features/desktop-ai-chat/**`, `pages/StudioGU/**` | Студия ГУ: кластер режимов — `getDesktopShellToolbarClusterClassName`; без `StudioHeroHeader` (режим только в rail вкладок, см. `StudioGUPage.tsx`). |
| 8b | `pages/MarketingCabinet/**` | Rail, шапка main, тулбар, селект — как ранее; **каркасы блоков**: хук `useMarketingShellClasses()` (`hooks/useMarketingShellClasses.ts`) → `SectionPanel`, `MetricCard`, `MarketingEntityCard`; интерактивный дашборд — плитки и группы тулбара через тот же `contentPanel`. **«С заказчиком»**: `ClientInteractionView`, `CustomerFacingSummaryEditor` — `mcPanel` / `mcForm`. Выпадающие списки: портал `MarketingCabinetSelect` с `data-marketing-cabinet-shell` (токены `--mc-*` на `body`). Строка «режим иконок» в компактном rail: `getDesktopShellContentPanelClassName(shellFrame)` на `DesktopAppListRow`. |
| 8c | `features/site-studio/desktop/**` | Вкладки шапки — `getDesktopShellToolbarClusterClassName` в `SiteStudioHeader`. |
| 9 | `components/**` (крупные приложения: UnifiedContent, FileGrabber; historical WorkflowBuilder **retired**) | `DesktopAppPanel` без хелперов в окне. |
| 10 | Сквозной grep | `desktop-surface-panel` + embedded; двойной `.content`; кто импортирует `getDesktopShell*` vs список `appComponent` в `EnhancedWindow`. |

---

## 1. Зачем это нужно

Рантайм — **несколько distinct opaque static presets** по ключу `DesktopWindowStyle` (производительность / RDP paint). Ключи prefs сохраняются; каждый пресет даёт свой premium look **без** `backdrop-filter` и без chameleon sheen. Оболочка должна:

- опираться на **одни и те же** классы из `desktopVisualSystem`, а не на самособранные `border/bg` в листовых компонентах;
- в **приложениях внутри окна** получать ключ через **`useDesktopShellFrame()`** (для API/compat), без проброса пропсов через десятие уровней;
- **не** использовать `backdrop-filter` / infinite CSS sheen на chrome окон и таскбара;
- **не дублировать** один и тот же слой `content` на вложенных обёртках подряд.

---

## 2. Тип и значения

**Visual flattening (2026-07, revised):** ключи **`DesktopWindowStyle`** / **`desktop_*_style`** в профиле **сохраняются** для совместимости и API. **Рантайм-визуал** — **отдельные непрозрачные пресеты** в **`DESKTOP_WINDOW_FRAME_STYLES`**, **`DESKTOP_WINDOW_TITLEBAR_STYLES`**, **`DESKTOP_TASKBAR_STYLE_PRESETS`**, **`DESKTOP_ICON_SURFACE_STYLES`** (публичный импорт — barrel `desktopVisualSystem.tsx`; реализация — `utils/desktopVisualSystem/*`). **`getDesktopWindowShellTier()`** — neon/aurora/chameleon/premium → glass; noir → framed; paper → minimal. **Сетки пресетов** в Settings Chrome / Visual Studio / «Окна и виджеты» **восстановлены**; заметка: без blur и animated glass. **`DESKTOP_FLAT_SHELL` / `DESKTOP_FLAT_TASKBAR`** — optional helpers (= framed). CSS **`desktop-chameleon-*`** **не используются** — chameleon = static pastel gradients.

Тип: **`DesktopWindowStyle`** (`shared/web/frontend/src/types/profile.ts`):

| Значение   | Роль (distinct opaque preset; RDP-safe) |
|-----------|------|
| **`glass`**   | Glass-toned gradient без backdrop-filter. |
| **`framed`**| Дефолт; opaque `border-strong`, градиенты `desktop-bg-*-rgb`. |
| **`minimal`**| Тонкая рамка, приглушённая panel surface. |
| **`noir`** | Noir gradient (dark pack) / cool paper slate (light pack). |
| **`neon`** | Accent border-2, glow shadows. |
| **`paper`** | Paper edge, warm cream gradients. |
| **`aurora`** | Purple/cyan aurora borders; light pack uses lavender paper chrome. |
| **`chameleon`** | Theme-aware iridescent multi-stop via `--desktop-chrome-chameleon-*` (light pastel / dark opaque; без motion class). |
| **`premium`** | Warm gold radial accents. |

**Тема `light` / `dark`:** токены `getDesktopThemeVars()` в **`desktopUi.ts`** (на `#desktop-main` через `data-theme`). Пресеты **`aurora` / `noir` / `neon` / `premium` / `chameleon`** читают **`--desktop-chrome-*`** для рамки окна, titlebar, карточек настроек, **Settings header strip** (`getDesktopShellHeaderStripClassName` = зеркало footer), **Settings main column** (`getDesktopShellSettingsMainColumnClassName` → `*-content-bg`), **taskbar surface**, **icon app/file tiles** и glyph-превью. Запрещены hardcoded dark `rgb(…)` в этих хелперах — иначе «Светлая» оставляет тёмную колонку/шапку поверх светлого chrome pack. **`chameleon`:** light = пастельный multi-stop; dark = непрозрачный иридисцентный pack (не day-pastel) — иначе белый текст тёмной темы на светлых пастелях «вымывает» Settings.

**Tailwind invariant:** chrome packs хранят **градиенты**. Утилита `bg-(--desktop-chrome-…)` компилируется в `background-color` и **не рисует** градиент. В `desktopVisualSystem` для этих токенов канон — **`[background-image:var(--desktop-chrome-…)]`**. Solid `rgba` (кнопки titlebar) могут оставаться на `bg-(--…)`.

**Превью в Settings («Стиль окон»):** `DesktopWindowStyleMiniPreview` — `DESKTOP_WINDOW_FRAME_STYLES` + `DESKTOP_WINDOW_TITLEBAR_STYLES` (без `bg-black/22` / `ring-black`). Иначе при светлой теме карточки Нуар/Неон/Премиум выглядят чёрными, хотя живое окно уже на light chrome pack.

**`getDesktopWindowShellTier()`** для вложенных карточек/форм — см. матрицу выше. Каждый ключ в **`DESKTOP_WINDOW_FRAME_STYLES`** / titlebar / taskbar maps — **distinct**.

Поле в UI-настройках профиля / десктопа: **`desktop_window_style`** (сервер и фронт согласованы с этим типом).

**Панель задач:** **`desktop_taskbar_style`** использует **те же ключи**, что и стиль окон (`DesktopTaskbarStyle` на фронте совпадает с `DesktopWindowStyle`). Поверхность и кнопки — **`DESKTOP_TASKBAR_STYLE_PRESETS`** в `desktopVisualSystem.tsx` (рендер в `Taskbar.tsx`): тень задаётся **`surfaceStyle.boxShadow`** (или CSS-переменные вроде `--desktop-taskbar-shadow-glass`). Кнопки (Пуск, закреплённые, окна, трей, часы) — пресетные **`buttonSurface` / `buttonActiveSurface`** (блок **`TB_TASKBAR_BUTTONS`**, без бледного «мягкого» слоя только из `--desktop-surface-soft`); геометрия полосы и иконок — **`TASKBAR`** в `constants/index.ts` (~46px высота, иконки **16px**). Ранее сохранённые значения **`clear`** / **`solid`** при загрузке профиля приводятся к **`framed`** / **`framed`** (`normalizeDesktopTaskbarStyle` на фронте; legacy `glass` остаётся валидным ключом, но рисуется как flat). Разбиение на подкомпоненты, shell prefs и приёмы производительности — см. **`product/desktop/DESKTOP-TASKBAR-ARCHITECTURE.md`**.

**Профиль UI (без HTTP-кэша):** **`GET /api/v1/profile/preferences`** — заголовки **`Cache-Control: no-store`** / **`Pragma: no-cache`** в **`profileService.getPreferences`**. После успешного **`PATCH`** контекст **`UserPreferencesApp`** обновляется телом ответа через **`refresh(nextFromServer)`** (без лишнего GET). Состояние в React — для отображения, не дублирует профиль в **localStorage**. Полный каталог desktop-полей — **`documentation/api/PROFILE-API.md`**.

### Shell motion (отдельно от пресетов рамки)

Поля **`desktop_shell_*`** в **`UIPreferences`** управляют parallax обоев, morph chip minimize↔taskbar и скоростью spring-анимаций chrome. Effective reduce motion объединяет OS `prefers-reduced-motion`, `accessibility.reduce_motion`, `animations_enabled=false` и `desktop_shell_reduce_motion`. Резолвер: **`resolveDesktopShellMotion.ts`**; provider на маршруте desktop: **`DesktopShellMotionPrefsContext`**. UI: Settings → Personalize → Visual Studio (карточки + interactive preview hotspots). **Миграций и env нет.** См. **`product/desktop/DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md`** §1.7 и **`product/desktop/DESKTOP-TASKBAR-ARCHITECTURE.md`** (morph).

**Плавающий виджет:** **`desktop_widgets_style`** — тот же набор ключей, что и окна (`DesktopWidgetsStyle` = `DesktopWindowStyle`); корневые классы — **`getDesktopWidgetRootClassName()`**. Legacy **`board`** / **`compact`** маппятся в **`framed`** / **`minimal`**. В **Центре управления** на вкладке «Поведение shell» карточки пресетов показывают компактное превью (**`DesktopWidgetsStyleMiniPreview`** в **`DesktopSettingsPanel.tsx`**) — те же **`DESKTOP_WINDOW_FRAME_STYLES`**, скругление по **`getDesktopWindowShellTier`**, что и **`getDesktopWidgetRootClassName`**.

**Прозрачность панели задач:** **`desktop_panel_opacity`** (0.35–1, по умолчанию 1) — **сила плотной подложки** поверх taskbar preset: второй слой с **`var(--desktop-taskbar-bg-opaque)`**. Вес по пресету — **`TASKBAR_PANEL_OPACITY_OVERLAY_WEIGHT`**: **glass/framed = 0** (ползунок не влияет); **остальные = 1**. Кнопки панели без затемнения. **Плавающий виджет** на этот параметр **не** зависит.

**Иконки рабочего стола / Пуск / таскбар:** **`desktop_icon_style`** — тип **`DesktopIconStyle`** в **`shared/web/frontend/src/types/profile.ts`**: девять пресетов **`DesktopWindowStyle`** **плюс** icon-only packs: **`prism`**, **`mercury`**, **`vhs`**, **`slate`**, **`clay`**, **`ember`** (карточки «Особые» — **`DESKTOP_ICON_ONLY_STYLE_KEYS`**). Полный порядок ключей — **`DESKTOP_ICON_STYLE_KEYS`**. CSS плиток app/file: **`DESKTOP_ICON_SURFACE_STYLES`** / **`getDesktopIconSurfaceClasses`** в **`desktopVisualSystem.tsx`** (источник для **`ICON_VISUAL_STYLES`** в **`DesktopIcon.tsx`**). Глифы: **`DesktopAppSymbol`** / **`DesktopFolderSymbol`**. Паки **`slate` / `clay` / `ember`** — статичные (без CSS `animate-*` / shimmer). Legacy **`accent`** / **`graphite`** → **`aurora`** / **`noir`** (`normalizeDesktopIconStyle`). Канон: **`documentation/product/desktop_icon_system.md`**.

**Бэкенд:** enum **`DesktopIconStyle`** в **`shared/api/schemas/user_profile.py`** должен включать все icon-only ключи. Если **`PATCH /api/v1/profile/preferences`** отвечает **422** — на сервере крутится **старый образ API**; нужен деплой контейнера API.

### Плавающие меню и ПКМ (viewport)

- **`getFloatingMenuPosition`** (**`desktopUi.ts`**): если **`preferAbove`** **не** задан, меню старается открыться **выше** якоря, когда точка якоря в **нижней части** экрана (эвристика ~ниже **72%** высоты viewport) или когда по переданной оценке **`menuHeight`** не хватает места **снизу**. Явный **`preferAbove`** (например мини-плеер громкости в трее) перекрывает авто.
- **`clampFixedBoxToViewport`** — поджим левого верхнего угла **`position: fixed`** по измеренным ширине/высоте после отрисовки.
- **`EnhancedContextMenu`** (ПКМ по столу / иконкам): корень и flyout — **`DesktopAppMenuSurface`** с **`windowStyle`** и тонкой обводкой **`ring-(--desktop-border-menu)`**, как у **`ContextMenu`** (ПКМ по объекту); без инлайновой **`box-shadow`**, чтобы не перебивать тени/пресет из **`getDesktopShellContextMenuClassName`**. Поджим корня через **`clampFixedBoxToViewport`**; flyout переворачивается **влево**, если справа мало места; **вверх** (`bottom-0` у строки пункта вместо `top-0`), если снизу экрана не помещается высота подменю; на **`DesktopWorkspaceCanvas`** задан **`key`** по координатам открытия, чтобы не тянуть старое смещение между открытиями.
- **`DesktopWorkspaceWindowContextMenu`** (ПКМ заголовка окна, пункт «Настройки рабочего стола»): позиция в **`useMemo`** с оценкой высоты по числу пунктов «переместить на другой рабочий стол».
- **ПКМ по пустой полосе таскбара** (**`Taskbar.tsx`**): увеличенный запас **`menuHeight`** под длинное меню (трей, чекбоксы); тот же **`getFloatingMenuPosition`**.

### Плавающие поверхности на `document.body` (прозрачность и портал)

**Симптом:** меню/каталог «просвечивает» — чат, обои или соседние окна читаются через фон; выглядит как сломанный UI.

**Причина (два слоя):**

1. **Портал без shell-контекста:** `createPortal(..., document.body)` без **`getDesktopPortalShellProps()`** / **`DesktopShellFloatingPortal`** — нет CSS-переменных `--desktop-*`, неверные координаты `position: fixed` при `transform: scale` на shell.
2. **Полупрозрачный фон:** классы **`DESKTOP_WINDOW_FRAME_STYLES.frame`** и **`getDesktopShellContentPanelClassName`** с альфой (`/0.95`, `color-mix(..., transparent)`) — норм для **рамки окна** внутри chrome, но **не** для выпадашек поверх arbitrary контента.

**Канон:**

| Слой | API |
|------|-----|
| Портал | **`DesktopShellFloatingPortal`** или обёртка с **`getDesktopPortalShellProps()`** + класс `dark` при `theme === 'dark'` |
| Фон меню ПКМ | **`getDesktopShellContextMenuClassName`** → непрозрачный **`rgb(var(--desktop-bg-secondary-rgb))`** |
| Компактный dropdown (GAF «⋯», quick presets) | **`getGafChatOverflowMenuSurfaceClassName`** или **`getDesktopShellFloatingSurfaceClassName`** |
| Большая панель в портале (каталог инструментов) | **`rgb(var(--desktop-bg-*-rgb))`** без альфы; см. **`companionToolsDesktopSurface.ts`** |

**Не** полагаться только на **`useSyncDesktopThemeFromMain`** для портала в `body` — он не подставляет transform-compensation и полный набор токенов.

**Аудит:** `rg 'createPortal\\(.*document\\.body' shared/web/frontend` — каждый call site должен иметь shell-обёртку; поверхности с `/95`, `/0.9` на floating UI — заменить на opaque helpers выше.

---

## 3. Откуда берётся значение в рантайме

1. **`DesktopWorkspaceContent`** читает визуальные предпочтения (в т.ч. `desktop_window_style`) и передаёт в **`DesktopShellFrameProvider windowStyle={desktopWindowStyle}`**.
2. Любой потомок в дереве рабочего стола может вызвать **`useDesktopShellFrame()`** → текущий `DesktopWindowStyle` (по умолчанию контекст в провайдере; дефолт контекста без провайдера — **`framed`**).
3. Само **окно** (`EnhancedWindow` и т.д.) комбинирует классы из **`DESKTOP_WINDOW_FRAME_STYLES`** для внешней рамки, области контента и состояний active/inactive — это слой **вокруг** приложения.

Вложенное приложение **не должно** заново накладывать **`framePreset.content`** на корень, если родитель (например оболочка Social Hub или файлового менеджера) уже задал градиент контента — иначе получится двойной фон.

---

## 4. Источник правды в коде: barrel + `desktopVisualSystem/*`

Публичный импорт для ~139 consumers: **`pages/Desktop/utils/desktopVisualSystem.tsx`** (thin re-export barrel). Реализация (2026-07-29 atomization):

| Module | Responsibility |
|--------|----------------|
| `sharedChromePrimitives.ts` | `DESKTOP_SHARED_CHROME_PRIMITIVES` |
| `taskbarPresets.ts` | Taskbar presets + opacity overlay weights |
| `windowFramePresets.ts` | Frame styles, shell tier, flat shell |
| `iconSurfacePresets.ts` | Icon tile surfaces |
| `shellChromeClasses.ts` | `getDesktopShell*` / native select / panel helpers |
| `titlebarPresets.ts` | Titlebar styles |
| `appGlyphMap.ts` | App glyph registry |
| `renderDesktopAppMotif.tsx` | Shared painted motif overlays (app + folder glyphs) |
| `DesktopAppSymbol.tsx` / `DesktopFolderSymbol.tsx` / `DesktopAppBadge.tsx` | Glyph components |
| `paintedSpan.tsx` | Internal paint helper |
| `workspaceMotion.ts` | `DESKTOP_WORKSPACE_MOTION` |

Vitest locks: `__tests__/desktopVisualSystem-flat-shell.test.ts`, `desktopVisualSystem-settings-form-card.test.ts`, `desktopVisualSystem-import-chain.test.ts`, `desktopVisualSystem-glyph-wiring.test.ts`.

### 4.1. Объект `DESKTOP_WINDOW_FRAME_STYLES`

Для каждого `DesktopWindowStyle` заданы строки классов Tailwind:

| Ключ | Назначение |
|------|------------|
| **`frame`** | Внешняя «коробка» окна / тяжёлых карточек: рамка, фон, blur. |
| **`content`** | Фон **внутренней** области контента под title bar (вертикальный градиент). |
| **`shell`** | Общий blur/оболочка там, где нужен слой shell без полного дублирования `frame`. |
| **`active` / `inactive`** | Акцент фокуса и приглушение неактивного окна. |
| **`accentLine`** | Декоративная линия (где используется по дизайну). |
| **`shellNavRail`** | Левая колонка навигации (например модалки настроек, embedded-редактор). |
| **`shellFooterStrip`** | Нижние полосы в духе Пуска / подвала панелей. |

### 4.2. `DESKTOP_WINDOW_TITLEBAR_STYLES`

Отдельный пресет для **полосы заголовка окна**: `root`, `iconShell`, `title`, `pill`, кнопки — по каждому `DesktopWindowStyle`.

Для **`aurora` / `noir` / `neon` / `premium`** фоны и цвета title/pill/controls берутся из **`--desktop-chrome-*-titlebar-*`** (пакет `getDesktopThemeVars`), чтобы светлая тема не оставляла тёмную шапку.

Использование: только там, где рисуется **хром title bar** (или его аналог в превью в настройках), а не каждый внутренний заголовок секции.

### 4.3. Функции-хелперы (рекомендуемый способ для вложенного UI)

Вызывать с аргументом **`const shellFrame = useDesktopShellFrame()`** (или переданным `desktopWindowStyle` с родителя, если контекста нет — редко).

| Функция | Когда применять |
|---------|------------------|
| **`getDesktopShellContentPanelClassName(windowStyle)`** | Внутренние карточки **и** поверхность `DesktopAppContentWrapper` (`framed`). Strong presets (`noir` / `neon` / `paper` / `aurora` / `chameleon` / `premium`) — **distinct** chrome surfaces (как карточки Settings); `glass` / `framed` / `minimal` — через tier. |
| **`getDesktopShellEmbeddedAppRootClassName()`** | Корень приложения **внутри** окна: `bg-transparent`, чтобы `DESKTOP_WINDOW_FRAME_STYLES.content` и framed content-panel были видны. Standalone full-page маршруты оставляют `bg-(--desktop-surface-app)`. |
| **`getDesktopShellSettingsFormCardClassName(windowStyle)`** | Карточки Центра управления — те же distinct surfaces + hairline для glass/framed/minimal. |
| **`getDesktopShellToolbarClusterClassName(windowStyle)`** | Кластеры вкладок / групп кнопок в одной «пилюле» (как embedded Файловый менеджер, табы Social Hub). |
| **`getDesktopShellFormSelectClassName(windowStyle)`** | `select` и поля в одной строке с тулбар-кластером. |
| **`getDesktopShellFileCardRootIdleClassName`** и **`Thumb`** / **`Meta`** | Сетка файлов в файловом менеджере под пресетом. |
| **`getDesktopShellNavRailClassName`** | Левая навигационная колонка модалок shell. |
| **`getDesktopShellFooterStripClassName`** | Нижние полосы Пуска и аналоги. |
| **`getDesktopShellContextMenuClassName`** | ПКМ и **`DesktopAppMenuSurface`** на `document.body` — **opaque** фон, не `frame` с альфой. |
| **`getDesktopShellFloatingSurfaceClassName`** | Компактные popover/panel в портале (настройки диалога GAF, и т.п.). |
| **`getGafChatOverflowMenuSurfaceClassName`** | Dropdown «⋯» в GAF Chat — accent stripe + opaque фон. |
| **`getDesktopShellPanelClassName(windowStyle, strength?)`** | Плавающие панели (Пуск, поиск, трей и т.д.) — **полная** скруглённая оболочка с `frame`. Те же классы для **`DesktopAppModalFrame`** (`DesktopAppChrome.tsx`): шапка модалки — **`getDesktopShellHeaderStripClassName`**, прокручиваемое тело — слой **`DESKTOP_WINDOW_FRAME_STYLES[shellFrame].content`**. **`ModalAdvanced`** с **`variant="desktop"`** использует тот же набор, чтобы диалоги в приложениях стола следовали пресету «Стиль окон». Опционально **`contentClassName`** на body (единственный scroll owner, виртуализированные сетки — см. **`WallpaperPicker`**). |

Дополнительно в том же файле: пресеты **таскбара** (`DESKTOP_TASKBAR_STYLE_PRESETS`), **виджетов** (`getDesktopWidgetRootClassName`), иконок приложений — это **соседние** оси настройки, не путать с «стилем окон», но визуально должны сочетаться.

---

## 5. Паттерны использования

### 5.1. Приложение целиком в окне (без отдельного «embedded»)

Оболочка окна даёт **`frame`** и фон секции (**`DESKTOP_WINDOW_FRAME_STYLES` → `content`**).

- **`DesktopAppContentWrapper`** с режимом **`framed`** (семейство docs/media по умолчанию и переопределения Studio/UGS) дополнительно оборачивает приложение во **`getDesktopShellContentPanelClassName(windowStyle)`**, чтобы смена «Стиль окон» читалась **во всех** framed-приложениях (Image Studio, Video Studio, GAF, App Store, …), а не только в Settings.
- Корень приложения в окне — **прозрачный** (`getDesktopShellEmbeddedAppRootClassName` / `studioPageEmbeddedShellClass` / `DESKTOP_APP_STYLE_CONTRACT.shell` / `DesktopProductWorkspace`): **не** закрашивать `bg-(--desktop-surface-app)` поверх content-panel — иначе пресет «не работает».
- **`standard`** (например **`DocEditor`**, **`ContentManagerPro`**) — отступы + **`getDesktopShellPanelClassName(..., 'strong')`**.
- Окно **папки** на столе не проходит через `DesktopAppContentWrapper`; там та же внутренняя карточка задаётся в **`EnhancedWindow`** вокруг тела под заголовком.

В листьях по-прежнему **`DesktopAppPanel`** и **`DESKTOP_APP_STYLE_CONTRACT`**; отдельный **`getDesktopShellContentPanelClassName`** на каждой секции не обязателен, если базовый слой уже пришёл из обёртки выше.

Порталы ПКМ в **`EnhancedWindow`** передают в **`DesktopAppMenuSurface`** явный **`windowStyle={visualStyle}`**, чтобы пресет меню совпадал с окном при всплытии из `document.body`.

### 5.2. Вложенный режим (`embedded`)

Используется, когда тот же компонент идёт **и** full-page, **и** внутри окна (пример: `UserProfile embedded`).

1. **`const shellFrame = useDesktopShellFrame()`**
2. **`const shellPanel = embedded ? getDesktopShellContentPanelClassName(shellFrame) : ''`**
3. На карточках: **`className={cn(shellPanel, 'p-6', …)}`**
4. Для полосы мобильных табов вместо `DESKTOP_APP_STYLE_CONTRACT.softCard`: **`cn('rounded-…', getDesktopShellToolbarClusterClassName(shellFrame))`**
5. **Не** добавлять **`DESKTOP_WINDOW_FRAME_STYLES[shellFrame].content`** на корень, если родительский layout (Social Hub, Файловый менеджер) уже выставил `content` на обёртку.

### 5.3. Герой-блок и крупные блоки в духе окна

Можно обернуть блок в **`DESKTOP_WINDOW_FRAME_STYLES[shellFrame].frame`** (плюс радиус/тень по месту), как в **Social Hub**: шапка хаба визуально согласована с рамкой окна.

### 5.4. Новое приложение на столе

1. Зарегистрировать **`appComponent`** в `EnhancedWindow` / реестре (см. `desktop-shell-and-windows.mdc`).
2. Если внутри нужен пресет **как у окон** — читать **`useDesktopShellFrame()`** и хелперы выше.
3. Плавающие элементы вне окна — **`getDesktopShellPanelClassName`**, не копировать строки из `DESKTOP_WINDOW_FRAME_STYLES.frame` вручную без причины.

---

## 6. Антипаттерны

- **Дублирование `content`** на каждом уровне вложенности — перегрузка градиента.
- **Непрозрачный `bg-(--desktop-surface-app)` на корне** приложения внутри окна — перекрывает `frame.content` и framed content-panel; пресет окон визуально «не меняется».
- **Новые карточки только через `bg-(--desktop-surface-panel)`** в embedded-приложении, когда вокруг уже glass/framed — визуальный разрыв с пресетом.
- **Жёстко зашитый `glass`** в классах вместо `useDesktopShellFrame()` — пользователь сменит пресет в настройках, UI останется «старым».
- **Второй псевдо-title bar** с полным `DESKTOP_WINDOW_TITLEBAR_STYLES`, если сверху уже есть `WindowTitleBar` у окна — дублирование хрома.

---

## 7. Где меняет пользователь (UI)

- Персонализация / **Центр управления** / настройки внешнего вида: выбор **«Стиль окон»** (`DesktopSettingsPanel` и связанные экраны).
- Значение уходит в сохранённые предпочтения вместе с остальными desktop UI prefs (`desktop_window_style`).

---

## 8. Чеклист для ревью и агентов

- [ ] Вложенный контент в окне использует **`useDesktopShellFrame`** там, где нужна согласованность с пресетом.
- [ ] Карточки секций в embedded-режиме используют **`getDesktopShellContentPanelClassName`** (или осознанное исключение с комментарием).
- [ ] Нет лишнего слоя **`content`** на дочернем корне при уже окрашенном родителе.
- [ ] Кластеры вкладок/действий в embedded используют **`getDesktopShellToolbarClusterClassName`**, а не только `DesktopAppPanel` по умолчанию.
- [ ] Изменения в **barrel / `desktopVisualSystem/*`** отражают все три ключа **`glass` / `framed` / `minimal`**, если добавляется новый общий хелпер.

---

## 9. Performance Guardrails (обязательно)

Стиль окон не должен ломать бюджет композитинга при множестве открытых окон:

- Не использовать `backdrop-filter`/`filter` как обязательный always-on слой для каждого окна без low-GPU fallback.
- Не возвращать тяжёлые `shadow-*` и массовые `transition-*` в окнах «по умолчанию» без измерений на слабом GPU.
- Не включать spring/scale/y-анимации на каждый open/focus/minimize без подтверждённого перф-бюджета.
- При глобальных визуальных изменениях проверять сценарий 8-12 открытых окон, а не только 1 окно.

Детальный протокол и чеклист: **`desktop/DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md`**.
