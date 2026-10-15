# Экскурсия (guided tour): зал маркетинга

Пошаговый **продуктовый тур** по **Marketing Cabinet**: затемнение, **спотлайт** на зону интерфейса и **карточка** с текстом — по тому же паттерну, что [экскурсия по штабу, файловый менеджеру и UGS](GUIDED-TOUR-EXCURSION.md).

**Статус реализации:** модалка **`MarketingCabinetGuideModal.tsx`** подключена в `MarketingCabinetPage` (кнопка в шапке). Корень **`#marketing-cabinet-guide-root`** — обёртка в `MarketingCabinetContentFrame`; якоря **`data-mc-guide`**: `toolbar`, `sidebar`, `dashboard-toolbar`, `dashboard-grid`. Ниже — **спецификация и чеклист**; слои портала/спотлайта совпадают с [GUIDED-TOUR-EXCURSION.md](GUIDED-TOUR-EXCURSION.md).

**Тулбар (`MarketingCabinetToolbar`):** одна полоска контекста — компания, проект, документ и действия справа; отдельного верхнего ряда с крошками нет. Полноэкранный интерактивный дашборд — пункт **«Дашборд»** в сайдбаре (перед «Быстрая сводка») и deep link `mc_view=overview_dashboard`.

## Зачем отдельный тур

- Кабинет большой: **сайдбар**, **тулбар**, **обзор** (карточки / **интерактивный дашборд**), глубокие разделы.
- Оператору и новому пользователю проще закрепить: где **компания / проект**, **пресеты дашборда**, **добавление виджета**, **AI Studio**, **чат**.

## Где в коде (целевая схема после внедрения)

| Что | Путь (предлагается) |
|-----|---------------------|
| Модалка тура, шаги, спотлайт, озвучка | `shared/web/frontend/src/pages/MarketingCabinet/components/MarketingCabinetGuideModal.tsx` *(создать по образцу `ContentManagerGuideModal.tsx`)* |
| Корневой **id** для `querySelector` внутри тура | константа `MARKETING_CABINET_GUIDE_ROOT_ID` → `marketing-cabinet-guide-root` на корневом обёртке **main** (например рядом с `MarketingCabinetContentFrame` или корень активного вида в `shell/`) |
| Триггер «Экскурсия» (Sparkles) | **`useDesktopGuideTourOpener`** в `MarketingCabinetPage.tsx` → кнопка в title bar окна — см. [GUIDED-TOUR-EXCURSION.md § 2](GUIDED-TOUR-EXCURSION.md#2-кнопка-запуска-единое-место-в-ui) |
| Страница и состояние | `MarketingCabinetPage.tsx`, навигация `useMarketingCabinetNavigation` |
| Обзор дашборда (сетка виджетов) | `views/OverviewInteractiveDashboard.tsx` — повесить `data-mc-guide` на тулбар дашборда, каталог виджетов, сетку |
| i18n текстов | `marketing.json` (ru / en) → ключи `tour.*` или `mcGuide.*` |
| Озвучка (опционально) | `public/audio/marketing-cabinet-guide/<locale>/<stepId>.wav`; ключ LS, например **`mc-guide-audio-enabled`** (`'1'` / `'0'`) |

Краткий обзор продукта и дашборда: [marketing/MARKETING-CABINET.md](marketing/MARKETING-CABINET.md).

## Поведение

Полностью совпадает с **[GUIDED-TOUR-EXCURSION.md § 3](GUIDED-TOUR-EXCURSION.md#3-модалка-тура-слои-и-поведение)**: портал → подложка с вырезом → **`GuideTourSpotlightFrame`** → стеклянная карточка (violet/slate) + **`useGuideTourFloatingCardPosition`** / **`computeGuideCardPlacement`** относительно `getBoundingClientRect()` цели внутри **`#marketing-cabinet-guide-root`**.

## Привязка к разметке (якоря)

Рекомендуемый префикс атрибута: **`data-mc-guide="<зона>"`**.

Примеры зон для сценария «первый вход с проектом»:

| Значение `data-mc-guide` | Смысл |
|--------------------------|--------|
| `toolbar` | Тулбар: компания, проект, файловый менеджер, «Все разделы», AI jobs |
| `sidebar` | Список разделов кабинета |
| `overview-mode` | Переключатель «Карточки» / «Дашборд» на обзоре |
| `dashboard-toolbar` | Панель дашборда: пресет, добавить виджет, настройки сетки |
| `dashboard-grid` | Область `react-grid-layout` с плитками |
| `widget-chrome` | Одна плитка (пример): заголовок, действия на плитке *(опционально, шаг с узким спотлайтом)* |

Селекторы в шагах тура: `[data-mc-guide="toolbar"]` и т.д. — **только** внутри корня `marketing-cabinet-guide-root`, как у штаба и файлового менеджера.

## Условные шаги

Имеет смысл заложить флаги в компонент тура (по аналогии с `embeddedInStudio` в штабе):

- **`onlyWithProject`** — шаг только если выбран `mc_project` (и данные проекта доступны).
- **`onlyDashboard`** — только в режиме обзора **дашборд** (`overview` + внутренний режим дашборда; уточнить по флагу из `OverviewInteractiveDashboard` / URL).
- **`hideOnReadOnly`** — скрыть шаги про редактирование макета, если представитель / read-only баннер.

Фильтрация массива шагов — в модалке перед показом, props из `MarketingCabinetPage` или контекста.

## Клавиатура

Те же соглашения, что в [GUIDED-TOUR-EXCURSION.md § 3](GUIDED-TOUR-EXCURSION.md#3-модалка-тура-слои-и-поведение): `Esc`, `←` / `→`, `Home` / `End`.

## Озвучка

По образцу [GUIDED-TOUR-EXCURSION.md § 6–7](GUIDED-TOUR-EXCURSION.md#6-озвучка-куда-класть-файлы-и-как-на-них-ссылаются):

- Каталог: **`public/audio/marketing-cabinet-guide/ru/<id>.wav`** (и при необходимости `en/`).
- Отдельный ключ **localStorage** (не смешивать с `vcc-guide-audio-enabled` / `cm-guide-audio-enabled`).
- Тумблер в UI модалки только для **этого** тура.
- Генерация WAV — тот же контур, что в README в `public/audio/voice-command-guide/` (Voice Gateway / скрипт), с подстановкой префикса пути тура.

После правок текстов шагов в `marketing.json` озвучка в `public/audio/marketing-cabinet-guide/{ru,en}/` может не совпадать с карточкой, пока файлы не перезаписаны.

## Типографика карточки

**Карточка тура** в продукте унифицирована со стилем AI Chat / workflow (glass + violet). Внутри маркетингового кабинета при необходимости согласуйте подписи с [desktop_brand_style.md](desktop_brand_style.md); триггер в шапке — **`GuideTourLaunchButton`**.

## Как внедрить (чеклист)

1. Прочитать **[GUIDED-TOUR-EXCURSION.md](GUIDED-TOUR-EXCURSION.md)** и открыть эталон **`ContentManagerGuideModal.tsx`** (ближе по «приложению в окне», чем полноэкранный штаб, при необходимости — смешанный с `VoiceCommandGuideModal`).
2. Добавить **`id={MARKETING_CABINET_GUIDE_ROOT_ID}`** на стабильный контейнер, внутри которого есть все якоря `data-mc-guide`.
3. Вставить **`data-mc-guide`** на узлы в `MarketingCabinetToolbar`, `MarketingCabinetSidebar`, `OverviewInteractiveDashboard` (и при необходимости дочерние компоненты).
4. Создать **`MarketingCabinetGuideModal.tsx`**: массив шагов `id`, `title`, `body`, `highlightSelector`, опционально `onlyWithProject` / `onlyDashboard` / `hideOnReadOnly`.
5. Подключить триггер и состояние `isOpen` в **`MarketingCabinetPage.tsx`** или **toolbar** — открывать тур, когда DOM кабинета уже смонтирован (после выбора контекста, если шаги это требуют).
6. Добавить **`tour`** (или **`mcGuide`**) в **`marketing.json`** (ru/en).
7. По желанию — положить WAV и README в **`public/audio/marketing-cabinet-guide/`**, ключ LS для озвучки.
8. Проверить **`pnpm run build:react-compiler`**, сценарии с клавиатурой и `prefers-reduced-motion`.

## Связанные API

Только если делаете озвучку файлами: **`POST /api/v1/voice-gateway/synthesize`** — как в [GUIDED-TOUR-EXCURSION.md § 12](GUIDED-TOUR-EXCURSION.md#12-связанные-сервисы-генерация-речи).
