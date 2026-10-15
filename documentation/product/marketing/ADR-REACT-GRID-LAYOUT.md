# ADR: React Grid Layout для интерактивной сетки маркетингового дашборда / React Grid Layout for the marketing interactive dashboard grid

## Статус

**Accepted** — библиотека уже используется в маркетинговом кабинете (`OverviewInteractiveDashboard`, зависимость `react-grid-layout` ^2.2.3).

## Контекст

Нужна сетка виджетов с перетаскиванием, изменением размера, сохранением позиций в API и блокировкой отдельных плиток. Дашборд живёт во фронтенде EliteEW, домен — Marketing Cabinet.

## Решение

Использовать **React Grid Layout (RGL)**:

- импорт из `react-grid-layout/legacy` (плоский API v1 для миграции/стабильности) и хук `useContainerWidth` для ширины контейнера;
- стили `react-grid-layout/css/styles.css` и `react-resizable/css/styles.css`;
- идентификаторы элементов сетки (`i`) совпадают с id виджета на бэкенде (см. комментарий в `marketingCabinetApi.ts`);
- политика сетки — `overviewDashboardGridPolicy.ts`: **`compactType: null`** (не vertical compact), чтобы пустые ряды снизу оставались доступны для drag/resize; корень плитки — `overflow-visible`, клип — в `TileChrome`.

Код: `shared/web/frontend/src/pages/MarketingCabinet/views/OverviewInteractiveDashboard.tsx`, `MarketingDashboardInteractiveGrid.tsx`.

## Последствия

**Плюсы**

- Зрелая экосистема, нативная интеграция с React, типы встроены в пакет (v2).
- Готовые drag/resize, compaction, min/max размеров, статические элементы (`static` / locked widgets).
- Модель layout как массив `{ i, x, y, w, h, ... }` хорошо ложится на сохранение `grid_position` в БД.

**Минусы и известные ограничения**

- **Доступность (a11y):** перетаскивание опирается на мышь/тач; для клавиатуры и скринридеров потребуются отдельные паттерны (фокус, явные действия «переместить», альтернативный порядок без DnD).
- **Адаптивность:** текущая реализация — одна сетка с фиксированным числом колонок и `useContainerWidth`, а не полноценный `Responsive` с картой layouts по breakpoints; при смене ширины окна поведение завязано на пересчёт ширины контейнера, а не на отдельные сохранённые layouts на breakpoint.
- Зависимость от `react-draggable` / DOM-событий — при обновлениях React и пакета нужны регрессионные проверки.

## Рассмотренные альтернативы

- **GridStack.js** — сильный стек на vanilla/интеграциях; для React потребовался бы обёрточный слой и синхронизация состояния с тем же контрактом API.
- **Muuri** — гибкая физика/layout; меньше «из коробки» под React и типичную модель `{x,y,w,h}` без дополнительного клея.
- **Своя сетка на CSS Grid + DnD** — полный контроль и a11y по дизайну, но высокая стоимость разработки и сопровождения (collision, resize, персистенция).
