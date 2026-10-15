# Desktop Icon System

## Goal

Иконки desktop-приложений должны быть управляемыми, массово настраиваемыми и зависеть от пользовательской настройки `desktop_icon_style`.

Иконка не должна жить как случайный локальный JSX-блок внутри каждого компонента. Это часть системного UI.

## Style Modes

Пресеты, совпадающие со **стилем окон** (`DesktopWindowStyle`): **`glass`**, **`framed`**, **`minimal`**, **`noir`**, **`neon`**, **`paper`**, **`aurora`**, **`chameleon`**, **`premium`** — см. **`product/DESKTOP-WINDOW-SHELL-STYLE.md`**.

Дополнительно **только для иконок** (ярлыки, Пуск, таскбар; **не** для рамки окон). Порядок карточек в Центре управления — **`DESKTOP_ICON_ONLY_STYLE_KEYS`**:

| Ключ | UI (RU) | Идея |
|------|---------|------|
| **`prism`** | Призма | Спектральная кромка (conic), тёмная подложка |
| **`mercury`** | Ртуть | Металлический градиент, «жидкое» серебро |
| **`vhs`** | VHS | Неон/хроматический блик, лёгкая «развёртка» |
| **`slate`** | Сланец | Матовый холодный камень; **без CSS-анимации** |
| **`clay`** | Глина | Тёплый керамический корпус; **без CSS-анимации** |
| **`ember`** | Уголь | Тёмный уголь + янтарная кромка; **без пульсации / анимации** |

Тип на фронте: **`DesktopIconStyle`** = **`DesktopWindowStyle | DesktopIconOnlyStyle`** (`profile.ts`). Полный порядок ключей — **`DESKTOP_ICON_STYLE_KEYS`**. Рендер: **`ICON_VISUAL_STYLES`**, **`DesktopAppSymbol`**, **`DesktopFolderSymbol`**. API: **`DesktopIconStyle`** в **`shared/api/schemas/user_profile.py`** — без деплоя бэкенда с этими литералами сохранение профиля даёт **422**.

### `minimal`

Классический режим.

- Используется старый glyph-подход
- Без premium symbol language
- Допустим более привычный контейнер/подача
- В UI настроек подписан как `Минимализм` (как у окон)

### `glass`

Премиальный базовый режим.

- Одна цветная символная форма
- Мягкий градиент, световой верх, glass-подача
- Без внешней второй рамки вокруг уже оформленной иконки

### `accent`

Премиальный усиленный режим.

- Тот же single-symbol principle
- Сильнее accent glow и motif
- Все еще без внешнего второго shell

## Hard Rule

Для новых premium иконок действует ключевое правило:

**У иконки должен быть один основной цветной корпус.**

Нельзя делать:

- цветную иконку
- вокруг нее еще один внешний glass-shell
- потом еще один hover-frame сверху

Если у иконки есть цветной symbol body, то дополнительная внешняя рамка вокруг него запрещена, если это не классический legacy-режим.

## Architecture

Главные точки системы:

- `getDesktopAppIconNode()` — базовый canonical glyph для app registry
- `DesktopAppSymbol` — переключает classic/premium rendering
- `DesktopAppBadge` — reusable wrapper для Start Menu / Taskbar / previews / lists
- `DESKTOP_APP_VISUALS` — карта фирменных visual preset по `appComponent`

## Source Files

- `web/frontend/src/pages/Desktop/utils/desktopVisualSystem.tsx`
- `web/frontend/src/pages/Desktop/constants/index.ts`
- `web/frontend/src/pages/Desktop/components/DesktopIcon.tsx`
- `web/frontend/src/pages/Desktop/components/Taskbar.tsx`
- `web/frontend/src/pages/Desktop/components/StartMenu.tsx`

Архитектура таскбара (подкомпоненты, производительность): `product/desktop/DESKTOP-TASKBAR-ARCHITECTURE.md`.

Внутри окна приложения: пример **EWDesk** — шапка контента с `DesktopAppSymbol` и `iconStyle` из профиля (`useUserPreferencesApp` + `normalizeDesktopIconStyle`), пресет `DESKTOP_APP_VISUALS.EWDeskApp`; см. `web/frontend/src/pages/Desktop/components/EWDeskApp.tsx`.

## Propagation Rule

Если меняется icon system, проверять не только рабочий стол.

Минимальный список поверхностей:

- Desktop grid
- Start Menu
- Taskbar
- Window previews / grouped window buttons
- Pinned app surfaces

Если настройка `desktop_icon_style` влияет только на рабочий стол, а остальные поверхности остаются в другом режиме, задача считается незавершенной.

## Adding A New App

При добавлении нового приложения:

1. Добавить базовый glyph в `DEFAULT_APPS`
2. Добавить premium visual preset в `DESKTOP_APP_VISUALS`
3. Проверить отображение в `minimal`, `glass`, `accent`
4. Проверить, что premium mode не получил вторую внешнюю рамку

## Do / Don't

### Do

- Держать premium icon как одну цельную форму
- Центрировать glyph и сохранять читаемость на малых размерах
- Использовать shared presets вместо локальных one-off wrappers
- Уважать пользовательскую настройку стиля

### Don't

- Хардкодить новый icon shell прямо в одном компоненте
- Делать premium icon внутри второй рамки
- Смешивать classic glyph и premium shell в одном режиме случайным образом
- Забывать синхронизировать Start Menu / Taskbar после изменения desktop icons
