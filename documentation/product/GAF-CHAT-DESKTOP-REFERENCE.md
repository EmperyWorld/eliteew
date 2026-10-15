# Мессенджер (GAF Chat, Desktop) — справочник по реализации и UX

**Продукт:** приватный мессенджер **1:1** (Global & Friends) в приложении рабочего стола **Мессенджер** (`GAFChatApp`).
**Код (фронтенд):** `shared/web/frontend/src/pages/Desktop/components/GAFChat/`.
**i18n:** `shared/web/frontend/src/i18n/locales/en/gafChat.json`, `ru/gafChat.json` (namespace `gafChat`).

**Связанные документы:**

| Тема | Файл |
|------|------|
| API, БД, WebSocket, шифрование, E2E-задел | `product/GAF-CHAT-BACKEND.md` |
| Roadmap / вне scope (historical) | soft-retired under `trash/` (id 20260812-162003, was …/GAF-CHAT-ROADMAP.md) — living SoT = this doc + `GAF-CHAT-BACKEND.md` |
| Системные GAF-инструкции (админка, не этот чат) | `product/SYSTEM-GAF-ONBOARDING.md` |

---

## 1. Точка входа и оболочка

- Корневой компонент приложения: **`GAFChatApp.tsx`** (props: `initialTargetUsername`, `initialTargetChatId` для deep link / открытия из «Друзей»). **Cause B Wave 3 (2026-07-29):** thin shell (~73 LOC) — `useGafChatAppOrchestration` (+ core/phase-2 slices) → `buildGafChatAppWorkspaceModel` → `GafChatAppWorkspace`; default export path stable для `lazyImports`.
- Портал для модалок (превью вложений и т.п.): контекст **`GafChatPortalRootContext`**.
- Звук отправки и флаги оболочки: `gafChatShellSound`, `playGafSendSoundNow`; синхронизация с настройками стола через `patchDesktopShellStateMerged` (`gaf_chat_sound_enabled`).

---

## 2. Структура каталога (основные файлы)

| Категория | Файлы |
|-----------|--------|
| Приложение и chrome | `GAFChatApp.tsx`, `hooks/useGafChatAppOrchestration.ts`, `hooks/useGafChatAppOrchestrationCore.ts`, `hooks/useGafChatAppOrchestrationPhase2.ts`, `hooks/buildGafChatAppWorkspaceModel.ts`, `components/GafChatAppWorkspace.tsx`, `components/GafChatAppHeaderToolbar.tsx`, `components/GafChatMainColumnChrome.tsx`, `components/GafChatModalsCluster.tsx`, `components/GafChatSidebarPanel.tsx`, `components/GafChatSidebarThreadList.tsx`, `hooks/useGafChatSidebarList.ts`, `GAFChatSidebarRow.tsx`, `GAFChatChatActionsMenu.tsx`, `GAFChatConfirmModal.tsx` |
| Активный тред (лента) | `components/GafChatThreadPanel.tsx`, `hooks/useGafChatThreadScroll.ts`, `hooks/useGafChatThreadSearch.ts`, `GafChatVirtualizedThread.tsx`, `components/GafChatMessageListRow.tsx`, `GAFChatMessageBubble.tsx`, `gafChatMessageBodyRender.tsx`, `gafChatMessageViewUtils.ts` |
| Композер | `components/GafChatComposerCluster.tsx`, `gafChatComposerTypes.ts` |
| Контекстные меню (ПКМ) | `GafChatMessageContextMenu.tsx`, `GafChatMessageContextMenuProvider.tsx` (singleton меню сообщений), `GafChatThreadListContextMenu.tsx` — см. §2.1 |
| Вложения | `components/GafChatAttachmentBlock.tsx`, `GafChatInlineAudioPlayer.tsx`, `useGafAttachmentPreview.ts`, `GafChatAttachmentPreviewModal.tsx`, `GafChatComposerAttachmentPreview.tsx`, `GafAttachmentKindIcon.tsx`, `GafChatImageInline.tsx`, `GafChatVideoInline.tsx`, `GafChatVoiceMessagePlayer.tsx` |
| Превью / классификация | `gafChatAttachmentPreviewUtils.ts` |
| Сжатие изображений перед загрузкой | `gafChatImageCompress.ts` (`maybeCompressImageForGafUpload`) |
| Голос | `hooks/useGafVoiceRecorder.ts`, `gafVoiceConstants.ts` |
| Видеозвонки | кнопка запуска в `components/GafChatAppHeaderToolbar.tsx`, отдельное окно `VideoCallApp`, API `shared/api/video_calls/`; desktop — `product/INTERNAL-VIDEO-CALLS.md`; **MobileAndroid (≥ 0.2.4)** — in-app WebView на `join_url`: `mobile/MOBILE-GAF-VIDEO-CALLS-WEBVIEW.md` |
| Данные | `useGafChatMessages.ts`, `api/gafChatApi.ts`, `gafChatMessageUtils.ts`, `gafChatComposerDrafts.ts`, `gafChatPinnedChats.ts`, `gafChatThreadPrefs.ts`, `gafChatThreadSearch.ts` |
| Провайдер сокета | `context/GAFChatProvider.tsx` (thin composer ≤500 LOC, Wave 4 2026-07-29) + `context/gafChatProviderTypes.ts`, `gafChatIncomingMute.ts`, `gafChatIncomingNotifications.ts`, `useGafDesktopVideoCallProcess.ts`, `useDesktopSocketLeader.ts`, `useGafChatSocketEventHandlers.ts`; инвалидация react-query по событиям GAF и уведомления `video_call.*`; Vitest `context/__tests__/GAFChatProvider.atomization.contract.test.ts` |

**Socket lifecycle (лидер вкладки):** подключение `Services.socket` — только когда `isSocketOwner` и есть `userId`. Отключение — при потере ownership, logout или уходе со стола; **не** при смене identity объекта `user` в React (иначе polling→websocket upgrade обрывается и в консоли появляется `WebSocket is closed before the connection is established`). `disconnect()` откладывается на следующий кадр (`requestAnimationFrame`), по тому же паттерну, что и doc-editor collaboration. Модули: `useDesktopSocketLeader.ts` (connect/disconnect), `useGafChatSocketEventHandlers.ts` (listeners + BC relay).

### 2.1 Контекстные меню (ПКМ)

- **Сообщения:** в **`GAFChatMessageBubble`** на строке сообщения (`onContextMenuCapture`) открывается одно меню на всё приложение: провайдер **`GafChatMessageContextMenuProvider`** оборачивает ветку `GAFChatApp` для залогиненного пользователя; портал **`GafChatMessageContextMenu`** в `document.body`. Новое ПКМ по другому сообщению закрывает предыдущее меню. Действия: копировать, ответить (если есть), правка / удалить (как в overflow «⋯»). Долгое нажатие ЛКМ по пузырю по-прежнему копирует текст (без открытия меню).
- **Клавиатура в меню сообщения:** как у **`GafChatMessageOverflowMenu`**: стрелки вверх/вниз, Home/End, фокус на первом пункте при открытии, Esc — закрыть.
- **Исключения:** поддеревья с **`data-gaf-skip-message-context="true"`** не открывают меню по сообщению (при необходимости проставить на интерактивах внутри пузыря).
- **Список чатов:** ПКМ по строке в сайдбаре — **`GafChatThreadListContextMenu`** (открыть чат, закрепить / снять), см. **`GAFChatSidebarRow.tsx`**.

---

## 3. Композер: текст, очередь, отправка

### 3.1 Текст и черновики

- Поле: `<textarea>` с `maxLength={2000}`, автоподстройка высоты по `scrollHeight`.
- Черновик текста по чату: **`localStorage`** через `saveGafComposerDraft` / `loadGafComposerDraft` / `clearGafComposerDraft` (привязка к `userId` и `chatId`).
- При **смене активного чата** или снятии выбора чата черновик подгружается/сбрасывается; **очередь вложений** (`pendingAttachments`) очищается при смене чата, чтобы файлы не «переезжали» между диалогами.

### 3.2 Очередь вложений (несколько файлов)

- Состояние: массив **`GafPendingComposerAttachment`** (`contentId`, `fileName`, `size`, `mimeType`, `kind: 'file'`).
- **Отправка** (`handleSend`): берётся **первый** элемент очереди + текст; после успешного `sendMutation` очередь обновляется **`slice(1)`** (следующий файл остаётся для следующего сообщения).
- **UI:** список превью в `<ul>` / `<li>`, при двух и более файлах — строка **`composerQueueCount`**; тост **`composerQueueAddedToast`** при добавлении **сразу нескольких** файлов за одну операцию.
- Источники файлов в очередь: загрузка с диска (`contentApi.uploadContent`), выбор из библиотеки контента — все добавляют в конец очереди.

### 3.3 Ответ на сообщение (reply)

- Состояние `replyingTo`; при отправке передаётся `replyToMessageId` в API.
- **Esc** (глобально, см. §7): сначала снимается ответ, затем очищается очередь файлов, затем поиск по треду.

---

## 4. Загрузка файлов

### 4.1 Общая функция

- **`enqueueUploadedFiles(files: File[])`** — последовательная загрузка через `contentApi.uploadContent` с **`onProgress`**; состояние **`attachmentUploading`** + **`attachmentUploadPercent`** (0–100, шаг **5%**, helper `gafChatUploadProgress.ts`); после успешного цикла добавление в очередь через **`startTransition`** (`setPendingAttachments`), чтобы не блокировать ввод.
- **UI:** строка статуса в композере (`composerUploadProgress` / `composerUploading`) + тонкая полоса прогресса; на кнопке «с компьютера» вместо спиннера показывается **процент**, пока идёт байтовая загрузка. Выбор из библиотеки / drag библиотеки — `attachmentUploadPercent = null` (только спиннер / текст «Загрузка…»).
- Выбор из библиотеки: **`handleContentLibraryPick`** — также **`startTransition`** при добавлении в очередь.
- Окно выбора файла из Файловый менеджер: **`GafContentLibraryPicker`** (modal shell) + **`GafContentLibraryPickerPanel`** (orchestrator ≤650 LOC). Дочерние модули в `components/`: **`GafContentLibraryPreview`** (side preview + `formatPickerDate`), **`GafContentLibraryPickerRow`** (grid/list row), **`GafContentLibraryPickerActionBar`** (sticky top/bottom attach bar). При длинном списке файлов кнопка прикрепления не должна требовать прокрутки в самый низ: после выбора файл показывается в закреплённой верхней action-полосе с кнопкой подтверждения, а нижний footer дополнительно остаётся sticky. LOC lock: `__tests__/GafContentLibraryPickerPanel.atomization.contract.test.ts`.

### 4.2 Локальный файл

- Скрытый `<input type="file">`; обработчик **`handlePickLocalFile`** вызывает `enqueueUploadedFiles([file])` с процентным индикатором.

### 4.3 Drag-and-drop

- Обработчики на **`<form>`** композера: `onDragEnter`, `onDragLeave`, `onDragOver`, `onDrop`.
- Типы `Files` в `dataTransfer`; при активном перетаскивании — **`composerDragOver`** и визуальный слой (полупрозрачный фон, `backdrop-blur`, **`motion-reduce:backdrop-blur-none`**), текст **`composerDragActiveHint`**, `role="status"`, `aria-live="polite"`.
- У формы **`relative`**, оверлей **`z-20`** с **`pointer-events-none`**; колонка ввода и блок кнопок — **`relative z-10`**, чтобы клики доходили до кнопок.

### 4.4 Вставка из буфера

- **`onPaste`** на textarea: при наличии `clipboardData.files` вызывается **`preventDefault`** и **`enqueueUploadedFiles(Array.from(files))`**.

### 4.5 Сжатие изображений (`gafChatImageCompress.ts`)

- Перед загрузкой каждый файл прогоняется через **`maybeCompressImageForGafUpload`**.
- **Пропускается:** не-изображения, **GIF**, **SVG**, ошибки декодирования.
- **Действия:** ограничение длинной стороны (**2048 px**); перекодирование при размере **≥ ~96 KB** или при уменьшении размеров.
- **Формат выхода:** приоритет **WebP** → для исходного PNG при неудаче **PNG** → иначе **JPEG**. Если результат **не меньше ~97%** от исходного размера — возвращается **исходный** файл.

### 4.6 Источник байтов для превью вложений

- Единая точка выбора источника: `components/gafAttachmentDownload.ts`.
- Для **persisted** сообщений (`message_id` не `gaf-opt-*`) превью/модалка используют chat-scoped endpoint:
  `GET /api/v1/gaf-chat/chats/{chat_id}/messages/{message_id}/attachment`.
- Для **optimistic** сообщений и не-чатовых контекстов (например picker/composer preview до отправки)
  используется fallback на `contentApi.downloadContentBlob(contentId)`.
- Такая схема убирает зависимость превью получателя от `content_shares` и снижает `404` на
  `/api/v1/content/{id}/download` в треде GAF.

### 4.7 Mark-read watermark (`POST .../read`)

- `GAFChatApp` вызывает `markRead` с последним **серверным** id из треда (`resolveGafLastMessageIdForRead` в `gafChatMessageUtils.ts`).
- Строки с id `gaf-opt-*` (optimistic до ack) **не** передаются в `up_to_message_id` — иначе API отвечает **400** (`badly formed hexadecimal UUID string`).
- Если в UI только optimistic-хвост, тело запроса `{}` — прочитано до последнего сообщения в БД.

---

## 5. Системное сообщение «инструкция» (`onboarding_instruction`)

- Рендер в **`GAFChatMessageBubble.tsx`**: если в `metadata` есть **`welcome_text`** и **`thanks_text`** (структурированный шаблон v2), тело пузыря собирается через **`GafChatOnboardingStructuredBody.tsx`** — приветствие, благодарность, затем шаги; у каждого шага с **`open_app_component`** — **своя** кнопка `DesktopAppButton` (открытие через `DesktopGafActionsContext` / `openAppByComponent` с новым окном).
- Старые сообщения без этих полей: прежний разбор `metadata.steps` и **одна** полоса кнопок внизу пузыря.
- Ключи i18n: при необходимости **`onboardingDesktopOnlyHint`** (при отсутствии провайдера десктоп-действий).
- Админка и контракт API: **`product/SYSTEM-GAF-ONBOARDING.md`**.

---

## 6. Подсказки в UI и доступность

- **Toolbar:** три колонки — слева заголовок + «Новый чат» (`data-gaf-guide="new-chat"`), по центру карточка собеседника, справа действия (E2EE, звонки, звук, меню). Рендер в **`GafChatAppHeaderToolbar`**. Подзаголовок «Личные сообщения с друзьями» убран.
- **Guided tour (GT-6):** шаги `intro → toolbar → new-chat → sidebar → thread → composer → outro` в `gafChatGuideConstants.ts`; селекторы `[data-gaf-guide="…"]` на chrome-кластерах.
- **Sidebar:** по умолчанию **свёрнут** (`ui.desktop_gaf_chat_sidebar_collapsed`, PATCH profile); узкая колонка с аватарками/монограммой; кнопка разворота в шапке сайдбара. Развёрнутый режим — поиск, фильтры, полный список.
- **Elite System:** для `is_system_account` композер скрыт, баннер **`systemComposerBanner`**.
- Статус соединения в шапке: при online — **`serverOnlineShort`** + tooltip **`serverOnlineTooltip`**; при offline — **`serverOfflineShort`** (предупреждение).
- Пустые состояния треда без технического текста про шифрование на сервере; E2EE/encryption — в кнопке режима и баннерах готовности.
- **Empty states (UI 07/20):** sidebar — ошибка загрузки чатов (`sidebarChatsLoadError*`) с Retry; свёрнутый rail — tooltip `sidebarCollapsedEmptyHint`; main column — timeout deep-link (`openingChatFailed*` + Retry); пустой тред — варианты generic / E2EE-pending / blocked (`emptyThread*` keys).
- **E2EE UX:** toolbar `GAFChatEncryptionIconButton` — status badge на узкой ширине; subheader chip в треде при `active`; readiness banner dismiss per chat в `localStorage` (`gafChatE2eeBannerPrefs`); attach/reply disabled в composer с tooltip при active E2EE.
- **i18n/errors:** `mapGafChatUserError` для error bars/toasts; video missed/end — `videoCallMissedToastMessage` через `gafChat` keys (не RU hardcode).
- Действия на пузыре сообщения: кнопки copy/overflow **частично видны** на desktop (`opacity-55`), полностью — при hover/focus-within.
- Очередь вложений: **`composerAttachmentQueueAria`** на `<ul>`; при нескольких файлах — **`composerQueueCount`**.

---

## 7. Горячие клавиши (сводка)

Реализация в **`GAFChatApp`** + hooks **`useGafChatKeyboardShortcuts`**, **`useGafChatSendOrchestration`**, **`useGafChatE2eeConsent`**, **`useGafChatMarkRead`** (глобальный `window` listener при активном окне и в зависимости от флагов модалок/записи голоса):

| Действие | Клавиши |
|----------|---------|
| Поиск в треде | Ctrl/Cmd+F |
| Следующее/предыдущее совпадение в треде | Ctrl/Cmd+G / Shift+Ctrl/Cmd+G |
| Поиск в сайдбаре чатов | Ctrl/Cmd+K |
| Смена чата без фокуса в поле ввода | Alt+↑ / Alt+↓ |
| **Esc** | По приоритету: снять ответ → очистить очередь файлов → очистить поиск по треду (если строка не пустая) |

Подсказки частично отражены в i18n (`threadSearchTooltip`, `sidebarSearchTooltip`, `sidebarListNavHint`).

### 7.1 Активный тред (`GafChatThreadPanel`)

- **`GAFChatApp`** монтирует **`GafChatThreadPanel`** для выбранного чата: toolbar (статус mute/block, in-thread search, prefs), E2EE readiness banner, scroll-контейнер (`role="log"`), пустой тред, виртуализированная лента, FAB «вниз».
- **Scroll:** `hooks/useGafChatThreadScroll.ts` — stick-to-bottom при новых сообщениях/смене чата, сохранение якоря при подгрузке старых страниц, `showScrollDown` + `scrollMessagesToBottom`.
- **In-thread search:** `hooks/useGafChatThreadSearch.ts` — match ids, навигация, scroll-into-view; refs (`threadSearchInputRef`, `threadSearchNavRef`) остаются в **`GAFChatApp`** для глобальных hotkeys (§7).
- **Пустой тред:** `emptyThreadTitle` / `emptyThreadDescription` (без технического текста про сервер/E2EE).

---

## 8. Производительность и оптимизации

- **Лента:** `@tanstack/react-virtual` в **`GafChatVirtualizedThread`**; `overscan` при **reduced motion** уменьшен; оценка высоты строк (`estimateSize`), `getItemKey` по id сообщения.
- **Сайдбар:** поиск по списку чатов через **`useDeferredValue`** + **`chatSearchHayById`** (haystack по id, без лишних конкатенаций на каждый символ); логика фильтра/prefetch — **`hooks/useGafChatSidebarList.ts`**; scroll-список с `content-visibility` — **`components/GafChatSidebarThreadList.tsx`**.
- **Prefetch** первой страницы сообщений при наведении на строку чата (`prefetchInfiniteQuery`, дедупликация через `Set`).
- **Превью в композере:** `GafChatComposerAttachmentPreview` обёрнут в **`memo`**.
- **Очередь вложений:** обновление состояния после пачки через **`startTransition`** (см. §4).

---

## 9. Типовые сценарии для разработчика

- **Проверка сборки фронта после правок:** из `shared/web/frontend`: `pnpm run build:react-compiler` (см. `project-and-deploy.mdc`).
- **Новые строки UI:** добавлять ключи в **оба** `en` и `ru` для `gafChat`; при необходимости прогнать `pnpm run i18n:check` из фронтенда.
- **API и миграции БД** по GAF — не в этом файле; см. **`product/GAF-CHAT-BACKEND.md`**.

---

## 10. История изменений документа

| Период | Суть |
|--------|------|
| 2026-07-31 | Composer local-file upload: percent indicator (`attachmentUploadPercent`, step 5%) via `contentApi.onProgress` + `gafChatUploadProgress.ts`; library attach stays spinner-only. |
| 2026-06-30 | UI plan 07/20 (complete): slice 5 hooks; `mapGafChatUserError`; i18n video toasts; empty/error/E2EE UX; guided tour `new-chat` step; vitest 65/65 under `GAFChat/`; `GAFChatApp.tsx` ~2440→~1533 LOC (target &lt;1400 deferred). |
| 2026-06-30 | Slice 3 refactor: app header toolbar, main-column empty/resolving chrome, and modals overlay cluster вынесены из `GAFChatApp.tsx` в `GafChatAppHeaderToolbar`, `GafChatMainColumnChrome`, `GafChatModalsCluster` (~546 строк; empty states и error bars без изменения UX). |
| 2026-06-30 | Slice 2 refactor: message thread / scroll cluster вынесен из `GAFChatApp.tsx` в `GafChatThreadPanel` + `useGafChatThreadScroll` / `useGafChatThreadSearch` (scroll-to-bottom, empty thread, in-thread search без изменения UX). |
| 2026-05 | Attachment preview/download в треде переведён на chat-scoped endpoint (`/api/v1/gaf-chat/.../attachment`) через `gafAttachmentDownload.ts`; fallback на `/api/v1/content/{id}/download` оставлен только для optimistic и не-чатовых сценариев. |
| 2026-04 | Очередь вложений, drag/paste, сжатие изображений, отдельные подсказки (клавиатура / файлы / drag-over), Esc по приоритету, `startTransition`, семантика списка очереди, `motion-reduce` на оверлее, справочник зафиксирован в `product/`. |
| 2026-04 | Онбординг системный GAF: структурированные `welcome_text`/`thanks_text` в метаданных, `GafChatOnboardingStructuredBody`, кнопки по шагам; см. §5 и `SYSTEM-GAF-ONBOARDING.md`. |
| 2026-04 | ПКМ по сообщению и списку чатов: singleton **`GafChatMessageContextMenuProvider`**, клавиатура в меню сообщения; см. §2.1. |

Детализация по отдельным итерациям UI (пузыри, виртуализация, правки сообщений) — в living sections ниже / код `GAFChat/`; historical handoff dump soft-retired under `trash/` (id 20260812-162003, was …/GAF-CHAT-ROADMAP.md).
