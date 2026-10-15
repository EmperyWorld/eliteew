# Desktop Design System

Краткий гайд по дизайн-токенам и паттернам Desktop UI. Токены объявлены в `../constants/` (barrel `index.ts` re-exports `desktopChromeTokens.ts`, `desktopDesignTokens.ts`, `desktopGridAndIcons.ts`, …).

## 1. Design tokens

### DESKTOP_DESIGN_TOKENS

CSS-переменные (RGB через пробел), радиусы, тени, отступы. Применяются на корне Desktop (`#desktop-main`); акцент задаётся отдельно через `--desktop-accent-rgb` (Settings → Personalize). Любой UI, который читает эти переменные и монтируется на `document.body`, обязан идти через `ShellPortalMount` / `DesktopPortaledConfirmShell` — иначе Personalize не доезжает до оверлея (см. [DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md](DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md) §Body portal theme invariant).

**Chrome under Personalize (2026-08-16):** поверхности приложений и guide/admin панелей внутри Desktop shell используют `--desktop-surface-*` / `--desktop-text-*` / `rgb(var(--desktop-accent-rgb)/…)`. Запрещены как «остров темы»: hardcoded shell hex (`#070b14`, `#0a101c`, …) и Tailwind `slate-*` / `violet-*` вместо accent/surface токенов (исключения: brand preview swatches, titlebar close reds, store icon gradients).

| Токен | Назначение |
|-------|------------|
| `--desktop-bg-primary-rgb` | Фон основной |
| `--desktop-bg-secondary-rgb` | Фон вторичный |
| `--desktop-fg-primary-rgb` | Текст основной |
| `--desktop-fg-secondary-rgb` | Текст вторичный |
| `--desktop-border-rgb` | Границы |
| `--desktop-radius` / `--desktop-radius-lg` | Радиусы скругления |
| `--desktop-shadow` | Тень панелей |
| `--desktop-spacing` / `--desktop-spacing-lg` | Отступы |
| `--desktop-paper-cream` / `--desktop-paper-cream-soft` | Бумажный пресет: основной и мягкий крем |
| `--desktop-paper-highlight` / `--desktop-paper-warm` | Бумажный пресет: подсветка и тёплый градиент |
| `--desktop-paper-edge` / `--desktop-paper-ring` | Бумажный пресет: кромка и кольцо фокуса |
| `--desktop-paper-ink` | Бумажный пресет: текст и глифы на светлой подложке |

Slim import без полного `constants/index.ts`: `constants/desktopDesignTokens.ts` (follower tab gate и paper/chrome).

### DESKTOP_SURFACE

Готовые классы для поверхностей (панели, карточки):

- `radius` / `radiusLg` — `rounded-xl`, `rounded-2xl`
- `shadow` — `shadow-2xl`
- `spacing` / `spacingLg` — `p-2`, `p-4`
- `border` — `border border-white/10`

### DESKTOP_OVERLAY

Оверлеи и модалки:

- `backdrop` — затемнённый фон за модалкой: `bg-black/60 backdrop-blur-sm`
- `panelSurface` — панель: `bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl`
- `panelSurfaceStrong` — то же с сильнее размытием для крупных оверлеев

### DESKTOP_TYPOGRAPHY

Иерархия текста для единообразия в Taskbar, Start Menu, панелях:

| Ключ | Назначение | Классы |
|------|------------|--------|
| `title` | Заголовок секции | `text-lg font-semibold …` |
| `body` | Основной текст | `text-sm …` |
| `meta` | Вторичный (время, подсказки) | `text-xs …` |
| `caption` / `captionInherit` | Подписи (11px) | token — не raw `text-[11px]` |
| `small` / `shellMeta10` / `sectionPill` / `micro` | Беджи и chrome (9–10px) | token — не raw `text-[9px]`/`text-[10px]` |

**P2 2026-07-28:** shell chrome (Start grid, widgets rail, runtime-disabled card, explorer monogram, assistant author) must use these tokens instead of ad-hoc `text-[9–11px]` literals.

**Floating widget chrome (2026-08-05):** clock timezone + nested «Сейчас играет» use sentence-case `shellMeta10` / `FLOATING_WIDGET_*` tokens in `desktopWorkspaceFloatingWidget/widgetChromeStyles.ts` — no `uppercase` / `labelOverline` shout; now-playing and credits use quiet surface panels (no accent radial wash). Lock: `floatingWidgetChrome.premium.contract.test.ts`.

### DESKTOP_INTERACTIVE

Состояния интерактивных элементов (кнопки, строки, поля):

- `btn` / `btnRounded` — нейтральная кнопка (hover, focus ring по акценту, active, disabled)
- `btnDanger` — опасное действие (красный focus/hover)
- `rowHover` — строка только с hover
- `rowInteractive` — строка с hover + focus + active
- `inputFocus` — фокус поля ввода
- `focusRing` — только кольцо фокуса (когда hover/active заданы отдельно)

### DESKTOP_ICON_SIZES (рабочий стол)

Размеры иконок на рабочем столе по настройке пользователя (`small` | `medium` | `large`):

- `width` / `height` — размер ячейки
- `iconBox` — класс для контейнера иконки (`w-10 h-10`, `w-14 h-14`, `w-16 h-16`)
- `label` — класс подписи под иконкой

### DESKTOP_ICON_SIZES_PANEL

Иконки в панелях и меню:

- `menu` — пункты меню: `w-4 h-4`
- `button` — кнопки тулбара: `w-5 h-5`

### DESKTOP_TOOLTIP

- `delayMs` — задержка перед показом (400 ms)
- `maxLength` — макс. длина текста до обрезки
- `truncate(s, max?)` — обрезка с многоточием

### DESKTOP_Z_INDEX

Порядок слоёв: overlay < panel < context menu < modal < desktop shell.

- `OVERLAY` (40), `PANEL` (50), `CONTEXT_MENU` (10001), `MODAL` (9998), `MODAL_CONTENT` (9999), `DESKTOP_SHELL` (99999)

---

## 2. Рекомендуемые паттерны

### Product Workspace

Главные приложения Desktop используют единый каркас:

- `DesktopProductWorkspace` — общий вертикальный layout: header, toolbar, status, scrollable content, footer.
- `DesktopProductHeader` — название приложения/режима, human-readable description, primary actions, meta.
- `DesktopProductStatusBanner` — состояние операции или окружения (`info`, `success`, `warning`, `danger`, `neutral`).
- `DesktopProductStatePanel` — empty/loading/error/offline/permission state с fallback copy из `commonUi`.
- `DesktopProductNextAction` — единый блок “следующий шаг” для guided UX.

**Adoption (default product shell, 2026-07-22):** App Store (page variant), GAF Chat, Assistant («Ассистент»), Feedback Hub, Notifications (window), Widget Shelf (expanded window). Clipboard modal IA stays outside ProductWorkspace. Outer `DesktopAppContentWrapper` may still wrap ProductWorkspace where GAF/Assistant-style guide roots require it.

Импортировать эти primitives из `src/pages/Desktop/components/DesktopAppChrome.tsx`. Product-local wrappers допустимы только если они не меняют keyboard/focus contract и не вводят hardcoded fallback copy.

### Окна (EnhancedWindow, DesktopWindowLayer)

- Заголовок: `DESKTOP_TYPOGRAPHY.title` или `meta` для подзаголовка
- Кнопки в title bar: `DESKTOP_INTERACTIVE.btnRounded` или `btnDanger` для закрытия
- Тень/радиус: `DESKTOP_SURFACE` или токены — **обязательный import** из `pages/Desktop/constants` в `EnhancedWindow.tsx` (иначе `ReferenceError` в chunk `DesktopWindowLayer`; lock: `EnhancedWindowSelfScroll.test.ts`)

### Модалки и диалоги

- Backdrop: `DESKTOP_OVERLAY.backdrop`, для скринридера — `aria-hidden` на фоне
- Контейнер: `DESKTOP_OVERLAY.panelSurface` или `panelSurfaceStrong`
- Обязательно: `role="dialog"`, `aria-modal="true"`, `aria-label` или заголовок
- Focus trap (Tab не уходит за пределы) и возврат фокуса при закрытии

### Панели (Start Menu, WidgetsPanel, Command Palette, Quick Search)

- Фон: `DESKTOP_OVERLAY.panelSurface*`
- Заголовки: `DESKTOP_TYPOGRAPHY.title` / `meta`
- Пункты списка: `DESKTOP_INTERACTIVE.rowHover` или `rowInteractive`
- Иконки: `DESKTOP_ICON_SIZES_PANEL.menu` / `button`
- **Start Menu sm+ geometry:** `startMenuPanelGeometry.ts` — `top/left/right: 2cm`, `bottom: 5rem` (над таскбаром); панель **растягивается** между inset’ами (не `max-h` от контента без верхнего отступа). **Suspense skeleton** (`StartMenuSuspenseFallback`) использует тот же `START_MENU_PANEL_GEOMETRY` + `absolute` в `[data-desktop-ui-scale]` — не `position: fixed` слева у Пуска (иначе вспышка в углу под scale-transform).

### Контекстные меню

- Контейнер: `DESKTOP_OVERLAY.panelSurface`, z-index из `DESKTOP_Z_INDEX.CONTEXT_MENU`
- Пункты: `DESKTOP_INTERACTIVE.rowInteractive`, иконки `DESKTOP_ICON_SIZES_PANEL.menu`

### Тултипы

- Задержка: `DESKTOP_TOOLTIP.delayMs`
- Длинный текст: `DESKTOP_TOOLTIP.truncate(text)`
- Единый стиль (например, через обёртку с `DESKTOP_TYPOGRAPHY.caption`)

### Иконки на рабочем столе

- Размеры брать из `DESKTOP_ICON_SIZES[iconSize]` (iconBox, label)
- Сетка: `DESKTOP_GRID` (GRID_SIZE, OFFSET, ICON_WIDTH, ICON_HEIGHT)

---

## 3. Импорт

```ts
import {
  DESKTOP_DESIGN_TOKENS,
  DESKTOP_SURFACE,
  DESKTOP_OVERLAY,
  DESKTOP_TYPOGRAPHY,
  DESKTOP_INTERACTIVE,
  DESKTOP_ICON_SIZES,
  DESKTOP_ICON_SIZES_PANEL,
  DESKTOP_TOOLTIP,
  DESKTOP_Z_INDEX,
} from '../constants';
```

---

## 4. Компонентный аудит (расхождения)

При рефакторинге проверять замену «сырых» классов на токены в:

- **Taskbar** — типы, кнопки, часы
- **StartMenu** — заголовки, пункты, вкладки
- **CommandPalette** — уже использует overlay/dialog-паттерны
- **QuickSearch** — панель и кнопки
- **WidgetsPanel** — заголовки, списки виджетов
- **DesktopModalsLayer** — все модалки (WallpaperPicker, NewFolderDialog и т.д.)
- **NotificationCenter** — заголовки, список уведомлений
- **VirtualDesktops** — кнопки и карточки столов
- **EnhancedContextMenu** — пункты меню
- **DesktopIconLayer** / иконки — размеры из DESKTOP_ICON_SIZES, подписи

Избегать: разрозненные `text-xs`, `text-sm`, `rounded-lg`, `bg-slate-*` без привязки к токенам, где уже есть аналог в DESKTOP_TYPOGRAPHY или DESKTOP_SURFACE.

## 5. Shared copy namespace

Primitive-level copy lives in `commonUi`:

- `actions.close`, `actions.retry`, `actions.search`, `actions.cancel`, `actions.confirm`;
- `states.empty`, `states.loading`, `states.error`, `states.offline`, `states.permissionDenied`;
- `workspace.nextAction`, `workspace.primaryActions`, `workspace.advancedDetails`.

Продуктовые namespace могут переопределять смысл конкретного экрана, но общий fallback не должен быть зашит строкой в TSX.
