# Онбординг и горячие клавиши

Краткая справка для пользователей и разработчиков: как начать работу с рабочим столом и где посмотреть горячие клавиши.

## Справка в приложении

- **F1** или **?** (Shift+/) — открыть модальное окно «Горячие клавиши» со списком сочетаний.
- Кнопка **«?»** на правой панели рабочего стола — то же окно (подсказка: «Клик — полная справка. ? или F1»).

## Горячие клавиши

### Рабочий стол

| Клавиши        | Действие                    |
|----------------|-----------------------------|
| Ctrl+K / ⌘K (macOS) | Палитра команд              |
| Win+D          | Свернуть все окна           |
| F5             | Обновить                    |
| Ctrl+Shift+N   | Новая папка                 |
| Win+↑ / ↓      | Развернуть / свернуть окно  |
| Win+← / →       | Привязать окно влево/вправо |
| Alt+Tab        | Переключение окон           |
| Ctrl+A / C / X / V | В полях ввода — нативный select-all / буфер. На пустом столе Ctrl+A **не** выделяет все ярлыки (канон `useDesktopClipboard`). C/X/V — копировать / вырезать / вставить выбранное |
| Delete         | Удалить выбранное           |
| Escape         | Снять выделение / закрыть меню |
| Клик вне ярлыков / rail Assistant | Снять выделение и скрыть панель быстрых действий |
| Любая клавиша в окне или поле ввода | Снять выделение (навигация по ярлыкам и Ctrl+C/X/V — без сброса) |

### Document Studio

| Клавиши     | Действие                |
|-------------|-------------------------|
| Ctrl+S      | Сохранить в хранилище   |
| Ctrl+Z / Y  | Отменить / Повторить    |
| Ctrl+B / I / U | Жирный / Курсив / Подчёркнутый |

### Глобальные

| Клавиши           | Действие                              |
|--------------------|----------------------------------------|
| Ctrl+Shift+D       | Панель отладки (если включена)        |
| F1 или ?           | Справка по горячим клавишам           |

**Палитра команд (Ctrl+K / ⌘K):** строки «Сегодняшняя дата» и «Текущее время» в группе Info — только справка (живые дата/время устройства); Enter **не** открывает приложение и **не** закрывает палитру.

## Онбординг по разделам

- **Рабочий стол:** иконки приложений на столе, «Магазин приложений» для установки новых. Состояние (обои, тема, позиции) сохраняется — см. `DESKTOP-STATE-PERSISTENCE.md`.
- **Тур по приложению (welcome tour):** при первом визите (если не dismissed) — баннер «Тур по приложению» над taskbar; повторный запуск — пункт **«Ещё»** на панели задач → **«Тур по приложению»**. Шаги подсвечивают **компактные** зоны (не весь холст) и показывают **пример жеста** (курсор / правый клик / двойной щелчок). Если панель виджетов выключена, шаги 3–4 (`widgets-panel`, `favorites-widget`) временно показывают stacked-пример (план ассистента, расписание, заметки, избранное) без записи в настройки. Пустой стол: пример ярлыка. Idle sync: пример плашки «Не удалось сохранить». Шаг горячих клавиш открывает меню «Ещё».
- **Справка F1:** секция «Поиск и запуск» — Win+S (Quick Search), Ctrl+K (палитра команд), Пуск (каталог).
- **Контент (Файловый менеджер):** загрузка файлов (перетаскивание или кнопка), папки, теги. При ошибках показываются тосты с подсказкой (обновить страницу, права доступа и т.д.).
- **ArlyQueen Chat:** «Новый чат» в сайдбаре для новой сессии; пустой диалог — подсказки и кнопки быстрых промптов; вложения — кнопка скрепки. В сайдбаре есть текст: «Сессии можно переименовывать (клик по названию) и удалять. Файлы прикрепляйте через кнопку скрепки.»

## Оператор: WAV welcome tour (Wave 7 — shipped in frontend)

Шаги `widgets-panel`, `favorites-widget`, `sync-status` включены в `DESKTOP_WELCOME_GUIDE_AUDIO_STEP_IDS`. В репозитории лежат placeholder/staging WAV; для prod-озвучки перегенерировать TTS на command-center:

| Step id | Подсветка | i18n ключ |
|---------|-----------|-----------|
| `workspace` | compact example plate (`WelcomeTourWorkspaceExample`), не `inset-0` фон | `welcomeOnboarding.guide.steps.workspace` |
| `widgets-panel` | stacked panel или free drag-toolbar; tour preview если панель выкл. | `welcomeOnboarding.guide.steps.widgets-panel` |
| `favorites-widget` | карточка «Избранное» (в preview всегда включена) | `welcomeOnboarding.guide.steps.favorites-widget` |
| `icons` | первый `[data-desktop-icon]` или ghost-ярлык | `welcomeOnboarding.guide.steps.icons` |
| `sync-status` | живая плашка или example chip на шаге тура | `welcomeOnboarding.guide.steps.sync-status` |

### Константы и тексты (источник правды)

| Артефакт | Путь |
|----------|------|
| Shipped WAV (озвучка играет) | `DESKTOP_WELCOME_GUIDE_AUDIO_STEP_IDS` в `shared/web/frontend/src/pages/Desktop/components/desktopWelcomeGuideConstants.ts` |
| Pending (без WAV) | `DESKTOP_WELCOME_GUIDE_AUDIO_PENDING_STEP_IDS` — пустой массив после Wave 7 |
| Тексты RU для синтеза | `shared/web/frontend/public/audio/desktop-welcome-guide/narrations.ru.json` (ключи `steps.*` уже заполнены) |
| Тексты EN (parity, без автогенерации WAV) | `shared/web/frontend/public/audio/desktop-welcome-guide/narrations.en.json` — зеркало `body` из `src/i18n/locales/en/desktopUi.json` |
| UI copy RU/EN | `src/i18n/locales/{ru,en}/desktopChrome.json` → `welcomeOnboarding.guide.steps` (merged into `desktopUi` at runtime) |

Общий конвейер guided-tour audio: `documentation/product/GUIDED-TOUR-EXCURSION.md` §7.

### Предусловия

- Хост **command-center** (`.136`), репозиторий с актуальным `narrations.ru.json`.
- Запущен контейнер TTS: **`stack9-cosyvoice3`** (по умолчанию для `generate-guide-audio-stack9.sh`). Проверка: `podman ps --format '{{.Names}}' | grep -qx stack9-cosyvoice3`.

### Генерация WAV (только pending или полный тур)

Из корня репозитория:

```bash
# planned/retired helper (not in tree as of 2026-09-30):
# bash generate-guide-audio-stack9.sh *[absent]* desktop-welcome-guide
```

Скрипт читает `public/audio/desktop-welcome-guide/narrations.ru.json`, синтезирует **все** шаги из `steps` и пишет `public/audio/desktop-welcome-guide/ru/<stepId>.wav`. Голос в JSON: **`companion_ewa`** (CosyVoice3).

Чтобы не перезаписывать уже отгруженные файлы, можно временно оставить в `narrations.ru.json` только три pending-ключа (или скопировать JSON во временный файл и передать `GUIDE_NARRATIONS=/path/to/partial.json`).

Проверка артефактов:

```bash
file shared/web/frontend/public/audio/desktop-welcome-guide/ru/widgets-panel.wav
# ожидается: RIFF WAVE audio
ls -la shared/web/frontend/public/audio/desktop-welcome-guide/ru/{widgets-panel,favorites-widget,sync-status}.wav
```

### После генерации (закрытие Wave 7 tail)

1. В `desktopWelcomeGuideConstants.ts` перенести `widgets-panel`, `favorites-widget`, `sync-status` из `DESKTOP_WELCOME_GUIDE_AUDIO_PENDING_STEP_IDS` в `DESKTOP_WELCOME_GUIDE_AUDIO_STEP_IDS` (Set).
2. Очистить или удалить массив pending (пустой `[]` или убрать экспорт, если больше нет хвоста).
3. Prod stack0 release на command-center: `bash docker/scripts/eliteew-deploy.sh release stack0 --all` (см. `documentation/platform/PROD-CORE-DEV-BIND-LINE.md`).
4. Smoke: рабочий стол → «Экскурсия» → шаги widgets / favorites / sync-status → включить озвучку → слышен WAV, в Network нет 404 на `/audio/desktop-welcome-guide/ru/<id>.wav`.

### Типичные сбои

| Симптом | Причина |
|---------|---------|
| Скрипт: «Контейнер stack9-cosyvoice3 не запущен» | Поднять stack9 на command-center |
| 404 на `.wav` в браузере | Фронт не пересобран / WAV не в `dist-build` |
| Decode error в консоли | В `.wav` попал JSON вместо PCM — перегенерировать |
| Шаг без звука при включённой озвучке | id не в `DESKTOP_WELCOME_GUIDE_AUDIO_STEP_IDS` или опечатка в имени файла |

## Связанные документы

- `DESKTOP-API-AND-APPS.md` — API рабочего стола и список приложений (app_component).
- `DESKTOP-STATE-PERSISTENCE.md` — сохранение состояния рабочего стола (обои, иконки, защищённые URL).
- `GUIDED-TOUR-EXCURSION.md` — архитектура guided tour и общий конвейер WAV (§7–§8).
