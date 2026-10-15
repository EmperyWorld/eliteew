# Студия ГУ (Voice Control Studio)

Единое десктоп-приложение EliteEW для голосовых сценариев: **диалог** (voice-gateway: запись → `/api/v1/voice-gateway/process`), **голосовое управление** (штаб: команды, макросы, аудит), **Live Voice** (статус, включение режима и открытие глобальной dock-панели справа; запись и pipeline — `LiveVoiceDesktopPipeline`), **транскрипция** длинных файлов (Whisper async: загрузка / запись → `/api/v1/voice-gateway/transcribe/async` + polling статуса).

## Границы продуктов

- **Студия песен** (`MusicForgeApp` / `app-music-forge`) — отдельное приложение; legacy API `/api/v1/music-generator/*` и `/api/v1/music-evolution/*` не часть Студии ГУ. См. [MUSIC-FORGE-APP.md](MUSIC-FORGE-APP.md).
- Отдельного ярлыка «Транскрипция» на столе нет: сценарий встроен во вкладку **Транскрипция** внутри Студии ГУ.

## Live Voice (dock + taskbar)

- **Режим** `activeMode === 'live-voice'` и **панель** `showLiveVoicePanel` разделены: панель можно открыть без режима; `enableLiveVoice()` = режим + панель.
- Взаимное исключение с `voice-command` на виджете рабочего стола: включение Live Voice снимает голосовые команды. CTA во вкладке Live **не** disabled при `voice-command` — честный helper предупреждает о переключении.
- Точки открытия: Студия ГУ (`StudioLiveTab`), правый rail таскбара (`TaskbarRightToolbar`, `data-live-voice-taskbar`), тумблер в `#live-voice-widget-panel`.
- Dock chrome: **opaque** side rail — `liveVoiceLayoutTokens.ts` (`rgb(var(--desktop-bg-*-rgb) / 1)` for shell/header/body/footer); pipeline also stamps `getDesktopPortalShellProps()` CSS vars on the fixed rail so tokens resolve even if inheritance drifts. No translucent `--desktop-surface-panel*` glass wash over wallpaper (`LiveVoiceDesktopPipeline` + `WidgetExpanded` `chrome="dock"`). Тумблер **не** блокируется отсутствием сокета (`setActive(true)` инициирует connect / HTTP fallback).
- **Premium dock IA (2026-07-28):** один заголовок «Голос» + статусная строка; вкладка «Запись» — mic **hero** как единственный primary CTA и короткий hint (`desktopUi.liveVoiceDesktop`); без карточки-инструкции «Голосовой ответ» / двойного «Голос · Live Voice». Текст / настройки / история — progressive tabs. Footer только при offline degrade.
- **Настройки панели:** только язык, скорость речи и громкость. Модели / голос / персона — не в UI (серверные поля сохраняются как есть). Debounced save не зависит от объекта context/`saving` (иначе «Сохранение…» мигает каждую секунду).
- Канон taskbar: `product/desktop/DESKTOP-TASKBAR-ARCHITECTURE.md`.
- **TTS URL (2026-07-28):** Live Voice / `text-to-voice` / voice-gateway берут HTTP base_url из `generation_providers.silero` (env `SILERO_SERVICE_URL` fallback). Runtime: Silero **MIT `v5_cis_base_nostress`** on GPU. Голос профиля — `user_live_voice_settings.tts_voice` (default `ru_ekaterina`; legacy `xenia` → `ru_ekaterina` в stack9). Resolver: `api/services/voice/tts_endpoint_resolver.py`.

## UI и стиль

Канон: `product/desktop_brand_style.md`, правила `.cursor/rules/desktop-shell-and-windows.mdc` и `desktop-ui-brand-style.mdc`. Реализация: `shared/web/frontend/src/pages/StudioGU/` (оболочка на токенах `--desktop-*`, `DESKTOP_TYPOGRAPHY`, `DESKTOP_APP_STYLE_CONTRACT`).

**Scroll ownership:** `appComponent` **`StudioGU`** в `DESKTOP_APP_WINDOW_BODY_SELF_SCROLL` (`desktopWindowBodyScrollRegistry.ts`). Outer `EnhancedWindow` body = `overflow-hidden`; vertical scroll stays inside mode panels (диалог / штаб / Live / транскрипция). Без записи в реестре внешний `overflow-auto` «уезжает» chrome вкладок и отрывает нижнюю панель от taskbar при высоких вкладках — канон `product/desktop/DESKTOP-CHROME-DECLUTTER-AND-SCROLL.md`.

**Chrome:** режим задаёт только rail вкладок (без `StudioHeroHeader` / дублирующих helper blurbs). Во вкладке «Управление» при `embeddedInStudio` скрыты chip «история только на устройстве» и пустая embedded-bar.

**Штаб (Управление):** при развороте макросов/каталога команд скролл — на `data-vcc-scroll-body` (`VCC_SCROLL_BODY_CLASSNAME`); панель микрофона (`data-vcc-guide="controls"`) остаётся pinned внизу вкладки, не уезжает и не клипится без scrollbar.

**Экскурсия (тур):** единая кнопка запуска (`GuideTourLaunchButton` в `GuideTourLaunchSlot`) — **справа вверху** полноэкранного тулбара штаба или узкой полосы во вкладке «Штаб»; открывает `VoiceCommandGuideModal.tsx`. Полное описание: **`product/GUIDED-TOUR-EXCURSION.md`**.

## Голосовые команды (штаб)

- Каталог фраз и `open_*` для запуска приложений с рабочего стола: `voiceCommand/engine/commandCatalog.ts`, исполнение — `commandExecutor.ts` (событие `desktop-command` / `useDesktopVoiceCommands`). Дополнительно: **цикл окон** (`focus_next_window` / `focus_previous_window`), **палитра команд** (`open_command_palette`), **озвучка ответов** (`voice_sound_mute` / `unmute` / `toggle`) — prefs TTS в `localStorage` + событие `VOICE_CENTER_UI_SYNC_EVENT` для синка UI фонового и оконного штаба.
- Расширенный набор **открыть приложение**: ComfyUI, Студия изображений, Студия видео, музыкальный плеер, генератор песен, буфер обмена, магазин приложений, Site Studio, Social hub, **маркетинговый кабинет**, **Студия ГУ** (в дополнение к чату, контенту, UGS, презентациям, Doc Editor). Команда «открой Студию ГУ» с рабочего стола фокусирует или открывает окно, не закрывая другие окна Студии; при открытии **другого** приложения окна Студии ГУ по-прежнему закрываются (см. `useDesktopVoiceCommands`).
- LLM fallback **`POST /api/v1/voice-gateway/map-intent`**: допустимые id зашиты в `api/services/voice_gateway_service.py` (`VOICE_COMMAND_IDS`, `MAP_INTENT_SYSTEM`) — при добавлении команд на фронте их нужно синхронизировать с этим набором.

### Три поверхности истории (штаб)

| Поверхность | Где | Хранение | Очистка |
|-------------|-----|----------|---------|
| **Лента сообщений** | Центральный feed + trash | React state (сессия) | Trash / голос «очисти историю» (`clear_history` → `clear_messages`) |
| **Журнал команд** | Drawer «Журнал команд» (иконка часов) | `localStorage` `voice_command_center_history` (до 20) | Кнопка «Очистить журнал» в drawer + `clearPersistedHistory()` |
| **Аудит** | Drawer «Аудит команд» | Сервер GET `/api/v1/voice-commands/audit` | Не очищается из UI штаба |

UI chrome и ответы команд: i18n `desktopUi.voiceCommand.*` (en/ru); фразы распознавания в `commandCatalog` остаются RU-primary.

## Код

- Корень приложения: `StudioGUPage.tsx` (`appComponent: StudioGU`).
- Логика штаба (бывший Voice Command Center): `StudioGU/voiceCommand/` — composer `VoiceCommandCenter.tsx` + `hooks/useVoiceCommandSession.ts` / `useVoiceCommandHealth.ts` + `components/VoiceCommandShell.tsx`.
- Диалог с gateway: `hooks/useVoiceGatewayDialog.ts`, `VoiceDialogPanel.tsx`. Form `tts_voice` на `POST /api/v1/voice-gateway/process` (merge с `user_live_voice_settings`).
- Транскрипция: `hooks/useStudioTranscription.ts`, `StudioTranscriptionTab.tsx`. Размер Whisper **read-only** из `GET /voice-gateway/health` → `stt.model_size` (веса = stack9 `MODEL_SIZE`; UI не переключает).
- Аудит команд штаба: `POST/GET /api/v1/voice-commands/audit` → Postgres `voice_command_audit` (не in-memory).
- Фоновый экземпляр штаба для виджета рабочего стола (без UI): `VoiceCommandCenter` с `backgroundOnly` в `VoiceCommandOnDemandMount` — только пока нет открытого окна Студии ГУ.
- Legacy hash `#/audio-transcription` ведёт на рабочий стол с открытием **Студии ГУ** и вкладкой «Транскрипция» (`desktopOnlyNavigation` + `STUDIO_GU_INITIAL_MODE_KEY` в sessionStorage).

### STT model truth

Инференс всегда тот, что загружен в `stack9-whisper-fast`. Поле `whisper_model` в live settings / transcriptions — метаданные, принудительно = `WHISPER_MODEL_SIZE`. Query `model` на async transcribe игнорируется как switcher.

## Миграция рабочего стола

- **Фронт:** при загрузке `desktop_items` из API ярлыки `app-voice` / `app-voicecmd` / **`app-transcription`** и компоненты `VoiceStudio` / `VoiceCommand` / **`AudioTranscriptionPro`** нормализуются к **`app-studio-gu`** / **`StudioGU`** (`useDesktopStorage.mergeItemsWithDefaults`); `desktopAppRegistry` скрывает legacy id/компоненты.
- **БД:** миграции `pending/20260328_01_desktop_studio_gu_catalog_and_data.sql` — каталог Студии ГУ; при необходимости — строка `app-transcription` в каталоге (историческая); `pending/20260328_02_desktop_merge_transcription_into_studio_gu.sql` — перенос `app-transcription` → `app-studio-gu`, удаление legacy каталога транскрипции.
- **API:** `api/routers/desktop.py` — `StudioGU` в `KNOWN_DESKTOP_APP_COMPONENTS`; legacy `app-transcription` / `AudioTranscriptionPro` в `LEGACY_HIDDEN_*` для очистки.
