# Guided tour (экскурсия): у architecture, внедрение, озвучка, ошибки

Продуктовый **пошаговый тур**: затемнение, **спотлайт** на зону UI, **карточка** с текстом (стеклянный violet/slate стиль), опционально **озвучка** из статических WAV. Сценарии: **EWA Desktop (спутник)**, **Голосовой штаб**, **файловый менеджер**, **Workflow Builder (UGS)**, **Ассистент**. Маркетинговый кабин — отдельная спецификация: [GUIDED-TOUR-MARKETING-CABINET.md](GUIDED-TOUR-MARKETING-CABINET.md).

---

## 1. Общий модуль фронта (`components/guided-tour/`)

Все пути от корня **`shared/web/frontend/src/components/guided-tour/`**.

| Файл | Назначение |
|------|------------|
| **`CreativeStudioGuideTourModal.tsx`** | Общий каркас тура для студий Creative Studio и режимов Студии ГУ (портал, спотлайт, озвучка, `spotlightLayoutKey`). Пропсы: `rootId`, `steps`, `audioLocalStorageKey`, `audioPathForStep`. |
| **`GuideTourLaunchButton.tsx`** | Единая кнопка запуска (иконка Sparkles, опциональная подпись «Экскурсия»). Пропсы: `onClick`, `ariaLabel`, `title?`, `label?`, `showLabel?`, `compact?`, `className?`. |
| **`GuideTourLaunchSlot.tsx`** | Legacy `absolute` slot (upper-right of a positioned parent). **Deprecated** for desktop apps — use title-bar launch (§ 2). |
| **`GuideTourSpotlightFrame.tsx`** | Маска затемнения четырьмя полосами + lime/violet glow + пульсирующее кольцо + угловые скобки вокруг `getBoundingClientRect()` цели. Пропсы: `rect`, `onDimClick`, `padding?`, **`zMask` / `zGlow` / `zRing`**. |
| **`guideTourHighlightTarget.ts`** + **`.css`** | `findVisibleGuideHighlight`, transient **`data-guide-tour-spotlight-target`**. Skips `opacity:0` / `visibility:hidden` / **full-viewport** rects (>42% area). |
| **`GuideTourActionDemo.tsx`** | Курсор + ripple поверх спотлайта (`click` / `doubleClick` / `rightClick`). |
| **`GuideTourCardConnector.tsx`** | Пунктирная bezier-линия (violet→lime) от карточки к спотлайту; точка-метка на цели. |
| **`guideTourPlacement.ts`** | **`computeGuideCardPlacement(...)`** → `{ top, left, side }` — сторона карточки (`right`/`left`/`bottom`/`top`/`center`) без пересечения с «дырой» спотлайта. |
| **`useGuideTourFloatingCardPosition.ts`** | Хук: замер `ref`, двойной `requestAnimationFrame`, **`spotlightLayoutKey`**. Возвращает `guideCardWrapRef`, `floatingCardStyle`, **`cardPlacementSide`**, `useCenterCard`. |

Импорт в экранах: `@/components/guided-tour/...`.

---

## 2. Кнопка запуска: единое место в UI

**Desktop app windows:** кнопка «Экскурсия» (Sparkles) в **общей шапке окна** — слева от «Свернуть / Развернуть / Закрыть» (`WindowTitleBar.tsx`). Приложение регистрирует opener через **`useDesktopGuideTourOpener(open)`**; провайдер — **`DesktopGuideTourOpenerProvider`** в **`EnhancedWindow.tsx`**. Подпись: i18n **`desktopUi.titleBarChrome.guideTour`**. Кнопка видна только если приложение зарегистрировало callback (нет тура — нет кнопки).

**Не дублировать** `GuideTourLaunchSlot` в шапках приложений на рабочем столе.

Legacy **`GuideTourLaunchSlot`** + **`GuideTourLaunchButton`** — только для UI **вне** `EnhancedWindow` (если появится отдельный full-page контур без title bar).

Текущие якоря регистрации (модалки и `useDesktopGuideTourOpener`, без inline-кнопок):

| Экран | Регистрация |
|-------|-------------|
| Голосовой штаб (полное окно) | `VoiceCommandCenter` → title bar |
| Штаб во вкладке Студии ГУ | `StudioGUPage` → title bar |
| Студия изображений / видео / **Студия песен** | `ImageStudioPage`, `VideoStudioPage`, `MusicForgeApp` |
| Файловый менеджер | `ContentManagerPro` |
| Ассистент | `DesktopAiChatApp` |
| Workflow Builder | **Retired** — shell/`WorkflowBuilderGuideTour` absent from active `src/` (see [ugs_workflow_builder_contract.md](ugs_workflow_builder_contract.md)) |
| Ultimate Document Editor | `UltimateDocEditorInner` |
| Маркетинговый кабинет | `MarketingCabinetPage` |
| Assistant, GAF, UGS, EWDesk, … | соответствующий `*App` / `*Page` (см. grep `useDesktopGuideTourOpener`) |

Подписи шагов тура и app-specific `aria-label` модалок задаются **на экране** (i18n).

---

## 3. Модалка тура: слои и поведение

1. **`createPortal(…, document.body)`** — диалог над приложением, `role="dialog"`, `aria-modal`, связь заголовка/клавиатурной подсказки через `aria-labelledby` / `aria-describedby`.
2. **Виньетка** — радиальный градиент поверх контента; **dim** — `bg-slate-950/82` (или полноэкранная кнопка закрытия, если шага без подсветки).
3. При **`highlightSelector !== null`** и найденном **полезном** элементе (`findVisibleGuideHighlight`: не `opacity:0`, не full-viewport): **`GuideTourSpotlightFrame`** с координатами цели; клик по затемнению закрывает тур. Опционально **`GuideTourActionDemo`**: курсор и пульс клика (`demoAction` = `click` / `doubleClick` / `rightClick`).
4. **Карточка** — glass-панель (slate + violet/lime акцент): прогресс-бар с градиентом, **точки шагов**, счётчик `N/M`, **connector** к спотлайту при плавающей позиции, навигация, тумблер озвучки.
5. **Позиция карточки** — `useGuideTourFloatingCardPosition`: при подсветке **плавающая** позиция от `computeGuideCardPlacement` (**spring-анимация** при смене шага); без подсветки — **по центру** экрана.

Клавиатура (единообразно): **`Esc`** закрыть, **`←` / `→`**, **`Home` / `End`**.

---

## 4. Привязка к DOM: корни и `data-*`

Тур ищет цели только **внутри своего корневого контейнера** (`getElementById` + `querySelector`).

| Продукт | Константа / `id` | Файл-источник |
|---------|------------------|---------------|
| Голосовой штаб | `VOICE_COMMAND_CENTER_DOM_ID` → `voice-command-center-root` | `VoiceCommandGuideModal.tsx`, разметка в `VoiceCommandCenter.tsx` |
| Студия изображений | `IMAGE_STUDIO_GUIDE_ROOT_ID` → `image-studio-guide-root` | `ImageStudioPage.tsx`, шаги в `imageStudioGuideData.ts`, модалка **`CreativeStudioGuideTourModal`** |
| Студия видео | `VIDEO_STUDIO_GUIDE_ROOT_ID` → `video-studio-guide-root` | `VideoStudioPage.tsx`, `videoStudioGuideData.ts`, **`CreativeStudioGuideTourModal`** |
| **Студия песен (MusicForge)** | *(экскурсия — backlog)* | `MusicForgeApp.tsx` — guided tour ещё не перенесён с legacy `MusicGeneratorPage` |
| Генератор песен (legacy) | `MUSIC_STUDIO_GUIDE_ROOT_ID` → `music-studio-guide-root` | ~~`MusicGeneratorPage.tsx`~~ — модуль в `trash/`; тур отключён до переноса на MusicForge |
| Студия ГУ (диалог / Live / транскрипция) | `STUDIO_GU_GUIDE_ROOT_ID` → `studio-gu-guide-root` | `StudioGUPage.tsx`, `studioGUGuideData.ts`, **`CreativeStudioGuideTourModal`** |
| **EWA Desktop (спутник)** | `EWA_DESKTOP_GUIDE_ROOT_ID` → `ewa-desktop-guide-root` | `EwaCompanionChatPanel.tsx`, `EwaDesktopGuideModal.tsx` |
| **UGS Hub** | `UGS_HUB_GUIDE_ROOT_ID` → `ugs-hub-guide-root` | `UGSHub.tsx`, `ugsHubGuideConstants.ts` |
| **UGS Dashboard** | `UGS_DASHBOARD_GUIDE_ROOT_ID` → `ugs-dashboard-guide-root` | `UGSDashboard.tsx` |
| **EWRP** | `EWRP_GUIDE_ROOT_ID` → `ewrp-guide-root` | `EWRPGeneratorMain.tsx` |
| **Site Studio** | `SITE_STUDIO_GUIDE_ROOT_ID` → `site-studio-guide-root` | `UserSiteStudioApp.tsx` |
| **GAF Chat** | `GAF_CHAT_GUIDE_ROOT_ID` → `gaf-chat-guide-root` | `GAFChatApp.tsx` |
| **Social Hub** | `SOCIAL_HUB_GUIDE_ROOT_ID` → `social-hub-guide-root` | `SocialHubShell.tsx` |
| **Music Evolution (legacy)** | `MUSIC_EVOLUTION_GUIDE_ROOT_ID` → `music-evolution-guide-root` | ~~`MusicEvolutionApp.tsx`~~ — UI в `trash/`; тур отключён |
| **Professional Worlds** | `PROFESSIONAL_WORLDS_GUIDE_ROOT_ID` → `professional-worlds-guide-root` | `ProfessionalWorldsApp.tsx`, `ProfessionalWorldsRuntimeShell.tsx` |
| **EWDesk** | `EW_DESK_GUIDE_ROOT_ID` → `ewdesk-guide-root` | `EWDeskApp.tsx` |
| **Video Call** | `VIDEO_CALL_GUIDE_ROOT_ID` → `video-call-guide-root` | `VideoCallApp.tsx` |
| **Notifications** | `NOTIFICATIONS_GUIDE_ROOT_ID` → `notifications-guide-root` | `NotificationsDesktopApp.tsx`, `NotificationHubBody.tsx` |
| **App Store** | `APP_STORE_GUIDE_ROOT_ID` → `app-store-guide-root` | `AppStoreWindowContent.tsx`, `AppStore.tsx` |
| **Clipboard** | `CLIPBOARD_GUIDE_ROOT_ID` → `clipboard-guide-root` | `ClipboardManager.tsx` (embedded) |
| **Assistant** | `ASSISTANT_GUIDE_ROOT_ID` → `assistant-guide-root` | `AssistantApp.tsx`, `assistantGuideConstants.ts` |
| **Feedback Hub** | `FEEDBACK_HUB_GUIDE_ROOT_ID` → `feedback-hub-guide-root` | `FeedbackHubApp.tsx`, `feedbackHubGuideConstants.ts` |
| **Music Player** | `MUSIC_PLAYER_GUIDE_ROOT_ID` → `music-player-guide-root` | `MusicPlayerPage.tsx`, `musicPlayerGuideConstants.ts` |
| **Widget Shelf** | `WIDGET_SHELF_GUIDE_ROOT_ID` → `widget-shelf-guide-root` | `DesktopWidgetShelfApp.tsx`, `widgetShelfGuideConstants.ts` |
| **Customer Cabinet** | `CUSTOMER_CABINET_GUIDE_ROOT_ID` → `customer-cabinet-guide-root` | `CustomerCabinetPage.tsx`, `customerCabinetGuideConstants.ts` |
| **About project** | `PROJECT_ABOUT_GUIDE_ROOT_ID` → `project-about-guide-root` | `ProjectAboutApp.tsx`, `projectAboutGuideConstants.ts` |
| Файловый менеджер | `CONTENT_MANAGER_ROOT_ID` → `content-manager-pro-root` | `ContentManagerPro.tsx`, `ContentManagerGuideModal.tsx` |
| Ассистент | `DESKTOP_AI_CHAT_ROOT_ID` → `desktop-ai-chat-app-root` | `DesktopAiChatApp.tsx` |
| Ultimate Document Editor | `ULTIMATE_DOC_EDITOR_GUIDE_ROOT_ID` → `ultimate-doc-editor-guide-root` | `UltimateDocEditor.tsx`, шаги в `ultimateDocEditorGuideData.ts`, модалка **`CreativeStudioGuideTourModal`** |

Якоря:

- Штаб: **`data-vcc-guide="<зона>"`**
- Студия изображений: **`data-img-guide`**: `tab-rail`, зоны вкладок (см. `ImageStudioPage.tsx`)
- Студия видео: **`data-video-guide`**: `tab-rail`, форма, превью, история
- Генератор песен: **`data-music-guide`**: `tab-rail`, `music-gen-workspace`, `music-generations-section`, `music-editor-section`
- Студия ГУ: **`data-studio-gu-guide`**: `mode-rail`, `dialog-settings`, `dialog-stage`, `dialog-history`, `live-state-panel`, `live-actions`, `transcription-toolbar`, `transcription-upload`, `transcription-run`, …
- Файловый менеджер: **`data-cm-guide`**: `tabs`, `header-actions`, `files-search-toolbar`, `files-panel`
- AI Chat: **`data-ai-chat-guide`**: `sidebar`, `thread`, `header-bar`, `settings-panel`, `composer`
- EWA Desktop: **`data-ewa-guide`**: `presence-compact` (desktop `lg+`, fallback → `presence-header` на `<lg`/mobile), `left-rail`, `transcript`, `operations`, `quick-presets`, `composer`
- UGS Hub: **`data-ugs-hub-guide`**: `header`, `stats`, `tab-rail`, `quick-launch`, `filters`, `task-list`
- UGS Dashboard: **`data-ugs-dashboard-guide`**: `header`, `shortcuts`
- EWRP: **`data-ewrp-guide`**: `tabs`, `outline-form`, `doc-picker`, `history`, `launch`
- Site Studio: **`data-ss-guide`**: `header`, `tabs`, `checklist`, `runtime`
- GAF Chat: **`data-gaf-guide`**: `toolbar`, `sidebar`, `thread`, `composer`
- Social Hub: **`data-sh-guide`**: `header`, `sidebar`, `workspace`, `people`, `privacy`
- Music Evolution: **`data-me-guide`**: `header`, `intake-form`, `pipeline`, `result`
- Professional Worlds: **`data-pw-guide`**: `header`, `vertical`, `sidebar`, `workspace`, `ai-rail`
- EWDesk: **`data-ewdesk-guide`**: `header`, `feed-list`, `feed-detail`
- Video Call: **`data-vc-guide`**: `toolbar`, `call-stage`
- Notifications: **`data-nc-guide`**: `filters`, `feed`, `footer` (окно `NotificationsApp`, density `window`)
- App Store: **`data-as-guide`**: `catalog`, `sidebar`
- Clipboard: **`data-clip-guide`**: `header`, `search`, `history`
- Assistant: **`data-assistant-guide`**: `header`, `faq-search`, `faq-list`, `chat-panel`, `chat-messages`, `composer`, `overflow-menu`, `shortcuts`
- Feedback Hub: **`data-feedback-hub-guide`**: `header`, `stats`, `ticket-list`, `list-filters`, `compose-kind`, `compose-form`, `preview`, `send-bar`
- Music Player: **`data-music-player-guide`**: `header-search`, `secondary-toolbar`, `track-list`, `queue-panel`, `now-playing`, `shortcuts`
- Widget Shelf: **`data-widget-shelf-guide`**: `tabs`, `notes-pane`, `todos-pane`, `local-hint`
- Customer Cabinet: **`data-customer-cabinet-guide`**: `header`, `search`, `company-tree`, `project-row`, `workspace`, `refresh`
- About project: **`data-project-about-guide`**: `shell-header`, `presentation`, `navigation`
- Ultimate Document Editor: **`data-doc-guide`**: `header-strip`, `header-actions`, `editor-surface`, `editor-toolbar-sticky`, `fab-scroll`, `preview-pane`

`highlightSelector` в шагах — полноценный CSS-селектор **относительно корня** (часто `[data-…="…"]`).

---

## 5. Условные шаги и подготовка layout

- **`onlyEmbedded` / `hideWhenEmbedded`** (штаб) — фильтрация шагов для встроенного режима Студии ГУ.
- **Файловый менеджер**: при смене вкладки панель «Файлы» может монтироваться позже. Передавайте в модалку **`onPrepareStep(stepId)`** (переключить вкладку до измерения) и **`spotlightLayoutKey`** (например `activeTab`), чтобы хук позиции карточки **пересчитался** после смены вёрстки.
- **Desktop welcome**: `onPrepareStep` пишет `desktopWelcomeTourSession` (шаг тура). Chrome показывает **пример**, а не прячет спотлайт: панель виджетов (stacked preview без persist, если `show_widgets_panel` выкл.), карточка избранного, compact workspace plate, ghost-ярлык при пустом столе, пример sync-chip, открытое меню «Ещё» на шаге shortcuts. **Нельзя** обнулять `highlightSelector`, если цель ещё не в DOM — модалка перемеривает после mount (`rAF` + `MutationObserver` на `#desktop-main`).
- **Desktop_ai_chat**: при открытии тура иногда используют **`flushSync`** + увеличение **`key`** модалки, чтобы первый шаг и аудио стабильно отработали (см. `DesktopAiChatApp.tsx`).
- **Ultimate Document Editor**: при смене режима (`edit` / `markdown` / `preview` / `view`) тур **закрывается**, **`spotlightLayoutKey`** совпадает с ключом режима (см. `UltimateDocEditor.tsx`).

---

## 6. Озвучка: куда класть файлы и как на них ссылаются

Файлы лежат под **`shared/web/frontend/public/audio/…`**. В рантайме URL строится как:

```text
`${import.meta.env.BASE_URL}audio/<подкаталог>/<locale>/<man|woman>/<stepId>.wav`
```

- **`<locale>`** — `ru` или `en` (из i18n приложения).
- **`<man|woman>`** — выбор пользователя в карточке тура: **po&T** (`man`, TTS `man_1`) или **TZBrand** (`woman`, TTS `baya`). Предпочтение в `localStorage`: **`eliteew.guide-tour.voice`**.
- На каждый шаг — **4 варианта WAV** при наличии `narrations.ru.json` и `narrations.en.json`: ru/en × man/woman.

Legacy-путь `audio/<tour>/ru/<stepId>.wav` (без сегмента голоса) **устарел**; новая генерация — только матрица 4×.

| Тур | Каталог `public/audio/…` | Ключ `localStorage` (вкл/выкл) |
|-----|--------------------------|--------------------------------|
| Голосовой штаб | `voice-command-guide/` | `vcc-guide-audio-enabled` |
| Студия изображений | `image-studio-guide/` | `image-studio-guide-audio-enabled` |
| Студия видео | `video-studio-guide/` | `video-studio-guide-audio-enabled` |
| Генератор песен | `music-studio-guide/` | `music-studio-guide-audio-enabled` |
| Студия ГУ (диалог / Live / транскрипция) | `studio-gu-guide/` | `studio-gu-guide-audio-enabled` |
| Файловый менеджер | `content-manager-guide/` | `cm-guide-audio-enabled` |
| Ассистент | `desktop-ai-chat-guide/` | `desktop-ai-chat-guide-audio-enabled` |
| **EWA Desktop (спутник)** | `ewa-desktop-guide/` | `ewa-desktop-guide-audio-enabled` |
| **UGS Hub** | `ugs-hub-guide/` | `ugs-hub-guide-audio-enabled` |
| **UGS Dashboard** | `ugs-dashboard-guide/` | `ugs-dashboard-guide-audio-enabled` |
| **EWRP** | `ewrp-guide/` | `ewrp-guide-audio-enabled` |
| **Site Studio** | `site-studio-guide/` | `site-studio-guide-audio-enabled` |
| **GAF Chat** | `gaf-chat-guide/` | `gaf-chat-guide-audio-enabled` |
| **Social Hub** | `social-hub-guide/` | `social-hub-guide-audio-enabled` |
| **Music Evolution** | `music-evolution-guide/` | `music-evolution-guide-audio-enabled` |
| **Professional Worlds** | `professional-worlds-guide/` | `professional-worlds-guide-audio-enabled` |
| **EWDesk** | `ewdesk-guide/` | `ewdesk-guide-audio-enabled` |
| **Video Call** | `video-call-guide/` | `video-call-guide-audio-enabled` |
| **Notifications** | `notifications-guide/` | `notifications-guide-audio-enabled` |
| **App Store** | `app-store-guide/` | `app-store-guide-audio-enabled` |
| **Clipboard** | `clipboard-guide/` | `clipboard-guide-audio-enabled` |
| **Assistant** | `assistant-guide/` | `assistant-guide-audio-enabled` |
| **Feedback Hub** | `feedback-hub-guide/` | `feedback-hub-guide-audio-enabled` |
| **Music Player** | `music-player-guide/` | `music-player-guide-audio-enabled` |
| **Widget Shelf** | `widget-shelf-guide/` | `widget-shelf-guide-audio-enabled` |
| **Customer Cabinet** | `customer-cabinet-guide/` | `customer-cabinet-guide-audio-enabled` |
| **About project** | `project-about-guide/` | `project-about-guide-audio-enabled` |
| **Marketing Cabinet** | `marketing-cabinet-guide/` | `mc-guide-audio-enabled` |
| Ultimate Document Editor | `ultimate-doc-editor-guide/` | `ultimate-doc-editor-guide-audio-enabled` |

WAV внутри каталога: `{ru,en}/{man,woman}/{stepId}.wav`. Голос тура (po&T / TZBrand) — **`eliteew.guide-tour.voice`** (общий для всех экскурсий).

Имена файлов **`{stepId}.wav`** должны **строго совпадать** с полем **`id`** шага в коде и с ключами в **`narrations.*.json`** (поле `steps`).

Поведение в UI:

- На смене шага: **`pause`**, **`removeAttribute('src')`** у предыдущего `Audio` (не полагаться на «случайную» готовность без сброса).
- `play()` оборачивают в `.catch(() => {})` — отсутствие файла **не ломает** тур.
- Тумблер в модалке управляет **только** озвучкой экскурсии, не живым TTS ответов чата/штаба.

Подробные команды для каждого тура — **README в соответствующей папке** `public/audio/...`:

- `voice-command-guide/README.md`
- `image-studio-guide/README.md`, `video-studio-guide/README.md`, `music-studio-guide/README.md`, `studio-gu-guide/README.md` (Creative Studio / Студия ГУ)
- `content-manager-guide/README.md`
- `desktop-ai-chat-guide/README.md`
- `ewa-desktop-guide/README.md`
- `ultimate-doc-editor-guide/README.md`

---

## 7. Генерация WAV (типовой конвейер)

Общая идея: тексты лежат в **`narrations.ru.json`** (и при необходимости `narrations.en.json`) вида:

```json
{
  "voice": "xenia",
  "steps": {
    "intro": "Текст для шага intro…",
    "toolbar": "…"
  }
}
```

Синтез:

1. **Через API в Podman** (`stack0-eliteew-api-prod`): в контейнер копируют JSON, вызывают **`api.services.voice_gateway_service.synthesize_speech`**, пишут **сырые байты WAV** в файлы, `podman cp` обратно в `public/audio/.../{locale}/{man|woman}/` (готовые сниппеты — в README каждой папки).
2. **Ассистент** — предпочтительный путь: скрипт **`./docker/scripts/generate-desktop-ai-chat-guide-audio-stack9.sh`** (stack9 Silero); важно писать в файл **декодированный PCM**, а не JSON-ответ endpoint (см. README).
3. **EWA Desktop** — **`./docker/scripts/generate-ewa-desktop-guide-audio-stack9.sh`** (stack9 CosyVoice3, голос `companion_ewa`; legacy Silero через env `EWA_GUIDE_TTS_MODE=silero`).
4. **Остальные туры** — **`bash generate-guide-audio-stack9.sh *[absent]* <tour-folder>`** (**script absent from tree as of 2026-09-30** — restore before ops use) (читает `narrations.ru.json` + опционально `narrations.en.json`, пишет `{ru,en}/{man,woman}/*.wav`). Голоса: **man → `man_1` (po&T)**, **woman → `baya` (TZBrand)**. Пакетно: **`bash generate-all-guide-audio-stack9.sh *[absent]*`** (**absent**); продолжить после обрыва — **`--skip-existing`** (пропускает туры с уже готовым `ru/man/*.wav`). Пакетно все папки с `narrations.ru.json`: **`bash generate-all-guide-audio-stack9.sh *[absent]*`** (**absent**).
4. **Голосовой штаб** — опционально с хоста: `ELITEEW_SYNTH_API_URL` + `ELITEEW_BEARER_TOKEN`: `shared/web/frontend/scripts/generate-voice-command-guide-audio.mjs`.

Голос по умолчанию для русского: **`xenia`** (выразительная Ксения Silero). Не путать с **`kseniya`**.

**Английский** (workflow): пока Silero в контуре настроен на **`ru`**, латиница может отклоняться; при отсутствии `en/*.wav` озвучка тихо не играет.

---

## 8. Podman / прод: типичные причины «нет звука» и 404

- Контейнер фронта (**`stack0-eliteew-frontend-prod`**) отдаёт **только собранный** `dist-build`. Файлы из `public/` попадают в образ **только при сборке**:
  `cd shared/web/frontend && pnpm run build:react-compiler`
  затем при необходимости пересоздание/рестарт фронта.
- В файл с расширением **`.wav` попал JSON** (ошибка скрипта) → браузер: decode error / `MEDIA_ERR_*`. Проверка: `file *.wav`, размер, первые байты `RIFF` для WAV.
- Неверный **`stepId`** или опечатка в имени файла → тихий сбой `play()`.
- Кросс-домен и кэш реже; основной класс проблем — **не пересобрали фронт** после добавления WAV.

---

## 9. Чеклист: добавить новый тур на экран

1. Завести **`id`** корневого контейнера и повесить его на реальный корневой DOM узел сцены.
2. Разметить якоря **`data-…`** согласованно с селекторами шагов.
3. Создать модалку по образцу **`VoiceCommandGuideModal`**, **`ContentManagerGuideModal`**, **`DesktopAiChatGuideModal`**, **`SpotlightGuideModal`**, или общий каркас **`CreativeStudioGuideTourModal`** (студии изображений/видео/музыки, часть режимов Студии ГУ): портал, виньетка, **`GuideTourSpotlightFrame`**, хук **`useGuideTourFloatingCardPosition`**, клавиатура. *(Historical `WorkflowBuilderGuideTour` retired with the builder shell.)*
4. Зарегистрировать **`useDesktopGuideTourOpener(open)`** (кнопка появится в title bar окна; не дублировать слот в шапке приложения).
5. Выбрать **уникальный** ключ `localStorage` для озвучки экскурсии.
6. Опционально: `public/audio/<имя>/`, `narrations.*.json`, README со сниппетом регенерации.
7. Если layout шага зависит от вкладки: **`onPrepareStep`** + **`spotlightLayoutKey`** (паттерн CM).
8. Сборка: **`pnpm run build:react-compiler`**, проверка в Podman при необходимости.

---

## 10. Ошибки, которых стоит избегать

| Проблема | Как избежать |
|----------|----------------|
| Карточка перекрывает подсвеченную зону | Использовать **`useGuideTourFloatingCardPosition`** + **`computeGuideCardPlacement`**, не задавать позицию «на глаз». |
| `ref` не на той ноде | **`guideCardWrapRef`** — на внешнюю обёртку карточки, которую измеряют для ширины/высоты. |
| Элемент не находится | Селектор от **корня тура**, не от `document`; убедиться, что шаг открыт **после** монтирования (вкладка, `onPrepareStep`). |
| Позиция не обновилась после смены вкладки | Передать **`spotlightLayoutKey`** в хук (как `activeTab` в CM). |
| Спотлайт под другими слоями | Прокинуть **`DESKTOP_Z_INDEX.MODAL`** / **`MODAL_CONTENT`** в **`GuideTourSpotlightFrame`**, как в существующих модалках. |
| `sticky` vs `relative` | Для абсолютного слота кнопки часто достаточно **`sticky`** родителя (карточка позиционирования для `absolute` дочернего). Не дублировать **`sticky` + `relative`** без нужды — линтер может ругаться; слот привязывают к уже работающему контексту шапки. |
| В штабе/CM перезапись чужого LS | У каждого тура **свой** ключ `localStorage`. |
| Озвучка обнуляет шаг | В cleanup — **`pause` + removeAttribute(`src`)**, не вызывать **`load()`** без необходимости (можно ломать повторное воспроизведение в некоторых браузерах). |

---

## 11. Карта исходников (модалки и точки входа)

| Продукт | Модалка / тур | Точка запуска (слот кнопки) |
|---------|----------------|------------------------------|
| Голосовой штаб | `VoiceCommandGuideModal.tsx` | `VoiceCommandCenter.tsx` |
| Студия изображений / видео / музыка | `CreativeStudioGuideTourModal.tsx` + `*GuideData.ts` | `StudioHeroHeader` (`meta`) на соответствующих страницах |
| Студия ГУ (диалог, Live, транскрипция) | `CreativeStudioGuideTourModal.tsx` + `studioGUGuideData.ts` | `StudioGUPage.tsx` (mode rail; без `StudioHeroHeader`) |
| Студия ГУ (штаб) | `VoiceCommandGuideModal.tsx` (как раньше) | `VoiceCommandCenter.tsx` (`embedded-bar` + синхронизация с шапкой через `guideOpen` / `onGuideOpenChange`) |
| Файловый менеджер | `ContentManagerGuideModal.tsx` | `ContentManagerPro.tsx` (`prepareContentGuideStep`, `spotlightLayoutKey`) |
| Ассистент | `DesktopAiChatGuideModal.tsx` | `DesktopAiChatApp.tsx` |
| EWA Desktop (спутник) | `EwaDesktopGuideModal.tsx` | `EwaCompanionChatPanel.tsx` (кнопка в presence header) |
| UGS Hub / Dashboard / EWRP / Site Studio / GAF / Social / Music Evolution | **`SpotlightGuideModal.tsx`** + `*GuideConstants.ts` | `useDesktopGuideTourOpener` → title bar |
| Professional Worlds / EWDesk / Video Call / Notifications / App Store / Clipboard | **`SpotlightGuideModal.tsx`** + `*GuideConstants.ts` | см. §4 DOM (`data-pw-guide`, `data-ewdesk-guide`, …) |
| Assistant / Feedback Hub / Music Player / Widget Shelf / Customer Cabinet / About project | **`SpotlightGuideModal.tsx`** + `*GuideConstants.ts` | GT-10: 6–10 шагов, детальные i18n; `onPrepareStep` для FAQ/очереди/вкладок |
| Desktop Shell Settings / POEMMA / KIRS curation / KIRS client site | **`SpotlightGuideModal.tsx`** + `*GuideConstants.ts` | GT-11: `DesktopSettingsPanel`, `PoemmaApp`, `KirsPage`, `KirsClientSitePage`; audio `desktop-shell-settings-guide`, `poemma-guide`, `kirs-curation-guide`, `kirs-client-site-guide` |
| Local Service | **`SpotlightGuideModal.tsx`** + `localServiceGuideConstants.ts` | GT-12: `LocalServiceIframeApp.tsx`; audio `local-service-guide` |
| Desktop welcome (first visit) | **`SpotlightGuideModal.tsx`** + `desktopWelcomeGuideConstants.ts` | GT-13: `DesktopWelcomeScreen.tsx`, root `#desktop-main`, `data-desktop-welcome-guide`; product name **«Тур по приложению»**; i18n `welcomeOnboarding.guide.steps` + `examples` + `demoCaption`; session `desktopWelcomeTourSession.ts` reveals widgets/favorites/workspace/icons/sync/overflow **examples** (не `bodyHidden` вместо спотлайта); `GuideTourActionDemo` на шагах с `demoAction`; audio `desktop-welcome-guide` |
| Workflow Builder | **Retired** (no modal) | Historical `WorkflowBuilderGuideTour.tsx` / `WorkflowBuilder.tsx` absent from active `src/` |
| Ultimate Document Editor | `CreativeStudioGuideTourModal.tsx` + `ultimateDocEditorGuideData.ts` | `UltimateDocEditorInner` → title bar |

Тексты UI:

- ~~Workflow Builder tour i18n~~ — retired with the shell (`workflowBuilder.json` may linger as unused locale debt).
- Ассистент: `desktopAiChat.json` → **`tour`**.
- Штаб и CM: в основном строки внутри TSX шагов (при желании вынести в i18n).

---

## 12. Связанные сервисы (генерация речи)

- Живой TTS приложения: **`POST /api/v1/voice-gateway/synthesize`**, сервис `shared/api/services/voice_gateway_service.py`.
- Для офлайн WAV в контейнере допустим прямой вызов **`synthesize_speech`** в `podman exec` (как в README папок audio).

---

## 13. См. также

- Product guided-tour backlog (GT-1…GT-13) soft-retired under `trash/` (id 20260812-161937, was …/GUIDED-TOUR-BACKLOG.md) — DEFAULT_APPS coverage closed; living architecture/WAV = this document + [GUIDED-TOUR-MARKETING-CABINET.md](GUIDED-TOUR-MARKETING-CABINET.md).
- `documentation/README.md`, `documentation/INDEX.md` — указатель.
- `product/VOICE-CONTROL-STUDIO.md`, `CONTENT-MANAGER.md`, `DESKTOP-LLAMA-CHAT.md` — контекст экранов.
- Per-tour README под `shared/web/frontend/public/audio/*/README.md`.
