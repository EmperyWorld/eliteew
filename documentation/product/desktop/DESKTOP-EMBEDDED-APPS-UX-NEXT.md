# Следующие UX-проходы: приложения внутри окон десктопа

Дата: 2026-04-20 (актуализация: 2026-06-30 — FeedbackHub slice 3; GAF Chat slice 3 header/modals/chrome; AssistantApp slice 4 history/message list; 2026-04-29 — reflow вложенных окон)

Оболочка (`pages/Desktop` без вложенных продуктовых деревьев) и вложенные приложения развиваются **разными ветками**, чтобы регрессии не смешивались. Карта хуков / распил shell: [`DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md`](DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md); UX roadmap: `../ELITEEW-GLOBAL-UX-UI-ROADMAP.md` — `documentation/plans/product/ELITEEW-GLOBAL-UX-UI-ROADMAP.md` *[operator-local process plan; gitignored — not living canon]*.

### Окно оболочки + lazy-приложение (2026-04-29)

Регрессия «спиннер до ручного resize / разворачивания» для контента **`EnhancedWindow`** с `win.type === 'app'` задокументирована и закрыта в [**`DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md`**](DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md) (раздел «Вложенные приложения»). Код: `EnhancedWindow.tsx` — ref на body, `useLayoutEffect` + синтетический `resize`.

## GAF Chat

- **Wave J TS hygiene (2026-07-28):** full frontend `tsc --noEmit` **0** (prod + tests) and Biome error-level **0**. Cause-layer contract alignment across Desktop shell, EWRP, UltimateDocEditor, Button polymorphic, Professional Worlds, Social Hub, UGS, services/OpenAPI (KBSEW duplicate operationId regenerated), plus test fixtures (`desktopTestHelpers`, shell-state helpers). No `@ts-ignore` / `as any` silence. Verify: `pnpm exec tsc --noEmit`; `pnpm exec biome check src --diagnostic-level=error`.
- **Wave K Biome hygiene (2026-07-28):** Biome warning-level **0** on `src` (~565 → 0). Cause: mega-destructure of full Site Studio `vm` / Desktop `head` clusters and dead props after refactors — narrowed bindings, typed Site Studio deps bag (`userSiteStudioAppDeps.ts`), removed unused DocEditor/ContentManager/folder-list plumbing; PW panel tests use `expect().toBeDefined()` instead of `!`. Verify: `pnpm exec biome check src`; `pnpm exec tsc --noEmit`.
- **Wave I TS hygiene (2026-07-28):** Desktop shell scraps + GAF Social Hub open contract — `DesktopSocialHubOpenTab` unifies GAF deep-link tabs with shell launch hints; `openSocialHubTab('phone')` maps to payload `mobile-app`; compact virtual-desktops menu uses 2-arg `getFloatingMenuPosition` + wrapper `div` for portal ref; Assistant clear-modal z-index accepts `{backdrop,content}`; App Store catalog card install signatures match install flow; EWDesk imports `DesktopAppSurface`; TaskbarClock timer ids are `number`. Scope verify: `pnpm exec tsc --noEmit` filtered to companionUx + DesktopWorkspaceContent + VirtualDesktopsCompactMenu + TaskbarClock + EWDeskApp + AssistantApp + useAppStoreCatalogCardRenderer + DesktopGaf.
- **Wave F TS hygiene (2026-07-28):** desktop leftovers + MusicForge prod `tsc` cluster cleared — `DESKTOP_LUCIDE.stroke` for catalog icons; GAF E2EE/voice/workspace model types aligned with `DesktopGafOpenActions` / delete handlers / send-mutation adapter; `WindowInitialPayload.docEditorTitle`; Notifications lazy JSX mount. Scope verify: `pnpm exec tsc --noEmit` filtered to `GAFChat|Desktop/constants|desktopWindowAppContent|MusicForge|folderIcons`.
- **Wave N5 (2026-07-14):** orchestration hooks extract from `GAFChatApp.tsx` (≤~900 LOC): `useGafChatDeepLinkBootstrap` (chatId-over-username), `useGafChatVideoCallActions`, `useGafChatThreadLifecycleActions`; supporting shell/draft/sound/E2EE plaintext hooks; authenticated tree in `components/GafChatAppWorkspace.tsx`. Vitest: `hooks/__tests__/useGafChatDeepLinkBootstrap.test.ts`.
- **Slice 4 (2026-06-30):** message list row chrome + sidebar list virtualization cluster:
  - [`GafChatMessageListRow.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/GAFChat/components/GafChatMessageListRow.tsx) — avatars, bubble shell, video-call system row, footer meta; body composition остаётся в `GAFChatMessageBubble.tsx`.
  - [`GafChatSidebarThreadList.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/GAFChat/components/GafChatSidebarThreadList.tsx) — scroll-список чатов, empty states, `[content-visibility:auto]` на expanded rows.
  - [`useGafChatSidebarList.ts`](../../../shared/web/frontend/src/pages/Desktop/components/GAFChat/hooks/useGafChatSidebarList.ts) — deferred search haystack, unread filter, pin order, prefetch-on-hover.
  - Узкие тесты: `GafChatMessageListRow.test.tsx`, `gafChatMessageViewUtils.videoCall.test.ts`, `useGafChatSidebarList.test.ts` (+ slice 2–3 thread/sidebar/header tests).
- **Slice 3 (2026-06-30):** header toolbar, main-column chrome (no-chat / opening-chat), modals overlay cluster вынесены из `GAFChatApp.tsx` в `pages/Desktop/components/GAFChat/components/`:
  - [`GafChatAppHeaderToolbar.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/GAFChat/components/GafChatAppHeaderToolbar.tsx) — title, connection badge, partner card, E2EE/video/sound/actions, chats error bar.
  - [`GafChatMainColumnChrome.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/GAFChat/components/GafChatMainColumnChrome.tsx) — portal root, empty/resolving states, slot для thread + composer.
  - [`GafChatModalsCluster.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/GAFChat/components/GafChatModalsCluster.tsx) — new chat, confirm/delete/edit, library/admin pickers, group call picker, guided tour.
  - Узкие тесты: `components/__tests__/GafChatAppHeaderToolbar.test.tsx`, `GafChatMainColumnChrome.test.tsx` (+ slice 2 `GafChatThreadPanel.test.tsx`, `GafChatSidebarPanel.test.tsx`).
- Оверлеи и z-index: политика [`DESKTOP_Z_INDEX`](../../../shared/web/frontend/src/pages/Desktop/constants/index.ts); превью вложений — `GAF_ATTACHMENT_PREVIEW_BACKDROP`; локальный стек композера — `GAF_INNER_BASE` / `GAF_INNER_OVERLAY`.
- Списки и виртуализация: см. [`DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md`](DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md) (инвалидации, guardrails).
- i18n оставшихся строк в компонентах GAF — отдельный grep по `pages/Desktop/components/GAFChat`.

## UGS

- Карта deep link и окон: [`UGS-DESKTOP-SHELL.md`](UGS-DESKTOP-SHELL.md).
- Права admin / hub vs studio — не менять без согласования API и продуктовой политики.

## Уведомления и трей

- Центр уведомлений рабочего стола: [`DESKTOP-NOTIFICATIONS-APP.md`](DESKTOP-NOTIFICATIONS-APP.md) (при наличии актуальных правок — синхронизировать с кодом).

## Обращения (`FeedbackHubApp`)

- Точка входа: [`FeedbackHubApp.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/FeedbackHubApp.tsx) (~420 строк) — orchestration: queries, list filters, guide tour, layout classes.
- **Slice 3 (2026-06-30):** header, ticket card chrome, compose preview, layout tokens в `pages/Desktop/components/feedbackHub/`:
  - [`FeedbackHubAppHeader.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/feedbackHub/FeedbackHubAppHeader.tsx) — title, tagline, trusted badge (desktop only).
  - [`FeedbackHubTicketCard.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/feedbackHub/FeedbackHubTicketCard.tsx) — list item chrome: badges, body, team reply, recognition.
  - [`FeedbackHubComposePreview.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/feedbackHub/FeedbackHubComposePreview.tsx) — read-only «что уйдёт» preview + char counter.
  - [`feedbackHubLayoutTokens.ts`](../../../shared/web/frontend/src/pages/Desktop/components/feedbackHub/feedbackHubLayoutTokens.ts) + [`useFeedbackHubLayoutClasses.ts`](../../../shared/web/frontend/src/pages/Desktop/components/feedbackHub/useFeedbackHubLayoutClasses.ts) — shell toolbar/search/kind-toggle classes на `DESKTOP_TYPOGRAPHY`.
  - [`mapFeedbackSubmitError.ts`](../../../shared/web/frontend/src/pages/Desktop/components/feedbackHub/mapFeedbackSubmitError.ts) — user-facing ошибки отправки (rate limit, quota, offline) через i18n.
- **Slice 1–2 (ранее):** [`FeedbackHubTicketListSection.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/feedbackHub/FeedbackHubTicketListSection.tsx), [`FeedbackHubStatsSection.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/feedbackHub/FeedbackHubStatsSection.tsx), [`FeedbackHubComposeForm.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/feedbackHub/FeedbackHubComposeForm.tsx), [`feedbackHubComposeStyles.ts`](../../../shared/web/frontend/src/pages/Desktop/components/feedbackHub/feedbackHubComposeStyles.ts).
- Продуктовый канон: [`product/FEEDBACK-HUB.md`](../FEEDBACK-HUB.md).
- Узкие тесты: `feedbackHub/__tests__/mapFeedbackSubmitError.test.ts`, `feedbackHubLayoutTokens.test.ts`, `__tests__/FeedbackHubApp.mobile-embedded.contract.test.ts`.

## Ассистент (`AssistantApp`)

- Точка входа: [`AssistantApp.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/AssistantApp.tsx) — orchestration: FAQ query, local FAQ merge, keyboard shortcuts, layout classes, session FAQ open state.
- **Slice 5 (2026-06-30, plan UI 8/20 R01–R22):** FAQ panel split + UX polish в `pages/Desktop/components/assistant/`:
  - [`AssistantFaqSearchBar.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/assistant/AssistantFaqSearchBar.tsx), [`AssistantFaqCard.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/assistant/AssistantFaqCard.tsx), [`AssistantFaqListEmpty.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/assistant/AssistantFaqListEmpty.tsx), [`AssistantFaqModeExplainer.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/assistant/AssistantFaqModeExplainer.tsx) — FAQ aside decomposition; card primary «Показать в чате», overflow для insert/ask/copy.
  - [`AssistantAppHeader.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/assistant/AssistantAppHeader.tsx) — **desktop toolbar-only** (title в `WindowTitleBar`); plain message count; overflow menu через `createPortal`.
  - [`readInitialAssistantFaqOpen.ts`](../../../shared/web/frontend/src/pages/Desktop/components/assistant/readInitialAssistantFaqOpen.ts), [`formatAssistantStreamingSources.ts`](../../../shared/web/frontend/src/pages/Desktop/components/assistant/formatAssistantStreamingSources.ts) — session FAQ default + RAG source hint (max 2 titles).
  - Chat subheader: chip «убрать подсказки из FAQ»; sticky «Показать более ранние (N)»; empty-chat FAQ chips только на mobile collapsed FAQ.
  - i18n `desktopUi.assistant.*` — neutral EN copy, mode explainer, stream/stop hints; tour step `guide.steps.header` обновлён под toolbar-only header.
  - Узкие тесты: `formatAssistantStreamingSources.test.ts`, `readInitialAssistantFaqOpen.test.ts`; contract [`AssistantApp.mobile-embedded.contract.test.ts`](../../../shared/web/frontend/src/pages/Desktop/components/__tests__/AssistantApp.mobile-embedded.contract.test.ts).
- **Slice 4 (2026-06-30):** history sidebar + message list presentation cluster в `pages/Desktop/components/assistant/`:
  - [`AssistantChatHistorySidebar.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/assistant/AssistantChatHistorySidebar.tsx) — collapsible «ранние сообщения» (`<details>`).
  - [`AssistantChatMessageList.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/assistant/AssistantChatMessageList.tsx) — skeleton, history error/retry, empty state, bubbles, pending/streaming.
  - [`splitAssistantDisplayMessages.ts`](../../../shared/web/frontend/src/pages/Desktop/components/assistant/splitAssistantDisplayMessages.ts) — merge local FAQ + visible window split.
  - [`useAssistantChatHistory.ts`](../../../shared/web/frontend/src/pages/Desktop/components/assistant/useAssistantChatHistory.ts), [`useAssistantChatScroll.ts`](../../../shared/web/frontend/src/pages/Desktop/components/assistant/useAssistantChatScroll.ts), [`useAssistantConversationActions.ts`](../../../shared/web/frontend/src/pages/Desktop/components/assistant/useAssistantConversationActions.ts), [`useAssistantFlashTimeout.ts`](../../../shared/web/frontend/src/pages/Desktop/components/assistant/useAssistantFlashTimeout.ts) — orchestration hooks из monolith.
  - Ошибки истории/clipboard — i18n `assistant.historyError`, `historyRetry`, `toastError` (plain RU/EN).
  - Узкие тесты: `assistant/__tests__/splitAssistantDisplayMessages.test.ts`, `AssistantChatMessageList.test.tsx`.
- **Slice 3 (2026-06-30):** header chrome, SSE stream, guided tour в `pages/Desktop/components/assistant/`:
  - [`AssistantAppHeader.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/assistant/AssistantAppHeader.tsx) — title, streaming indicator, history refresh, overflow menu.
  - [`AssistantClearChatModal.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/assistant/AssistantClearChatModal.tsx) — confirm «очистить чат» из overflow.
  - [`useAssistantMessageStream.ts`](../../../shared/web/frontend/src/pages/Desktop/components/assistant/useAssistantMessageStream.ts) — send/stop, rate-limit countdown, cache merge, RAG footer debounce.
  - [`mapAssistantStreamError.ts`](../../../shared/web/frontend/src/pages/Desktop/components/assistant/mapAssistantStreamError.ts) — user-facing ошибки через i18n (`rateLimited`, `toastError`).
  - [`AssistantGuideTour.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/assistant/AssistantGuideTour.tsx) — `SpotlightGuideModal` + title-bar opener.
  - [`assistantHeaderStyles.ts`](../../../shared/web/frontend/src/pages/Desktop/components/assistant/assistantHeaderStyles.ts) — Tailwind-токены header/overflow menu.
- **Slice 2 (2026-06-30):** чат и композер:
  - [`AssistantChatThreadPanel.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/assistant/AssistantChatThreadPanel.tsx) — chat column shell (subheader, scroll FAB); message list — `AssistantChatMessageList`.
  - [`AssistantComposerCluster.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/assistant/AssistantComposerCluster.tsx) — textarea, send/stop, rate-limit banner, shortcuts `<details>`.
  - [`AssistantChatMessageBubble.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/assistant/AssistantChatMessageBubble.tsx) — bubble + copy/helpful/feedback/ask-again.
  - [`assistantChatConstants.ts`](../../../shared/web/frontend/src/pages/Desktop/components/assistant/assistantChatConstants.ts), [`assistantChatPanelStyles.ts`](../../../shared/web/frontend/src/pages/Desktop/components/assistant/assistantChatPanelStyles.ts) — лимиты и Tailwind-токены чата.
- FAQ aside (slice 1): [`AssistantFaqPanel.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/assistant/AssistantFaqPanel.tsx), [`buildAssistantFaqAsideClassName.ts`](../../../shared/web/frontend/src/pages/Desktop/components/assistant/buildAssistantFaqAsideClassName.ts).
- **Premium polish 2026-08-05:** FAQ answer label sentence-case (`ASSISTANT_FAQ_ANSWER_LABEL_CLASS`, no `uppercase` shout «ОТВЕТ»); softer FAQ rail padding/panel mix + sticky header sheen; quieter mode explainer; glassier chat subheader. Locks: `assistantFaqStyles.premium.contract.test.ts`, `buildAssistantFaqAsideClassName.test.ts`.
- **Premium polish 2026-08-05 (shortcuts + header):** composer «Горячие клавиши» stays a **collapsed spoiler** by default (no first-visit auto-open; storage key `shortcutsOpen.v2`); quieter `<details>` chrome. Desktop toolbar message count — full plural copy (`N сообщений`) + `ASSISTANT_HEADER_MESSAGE_COUNT_CLASS` chip. Lock: `assistantShortcutsHeader.premium.contract.test.ts`.
- **Bubble polish 2026-08-05:** Assistant/user bubbles — soft top sheen, author chips as sentence-case pills, quieter hover (no translate bounce), relaxed body leading. Lock: `assistantUserShellUi.premium.contract.test.ts`.
- Продуктовый канон: [`product/SPRAVOCHNIK-AI.md`](../SPRAVOCHNIK-AI.md).
- Узкие тесты: `assistant/__tests__/*` (constants, FAQ aside, stream errors, split messages, streaming sources, FAQ open defaults, message list, premium chrome), `AssistantApp.mobile-embedded.contract.test.ts`.

## Проверка после ветки

- `pnpm run build:react-compiler` в `shared/web/frontend`.
- Сценарии из [`DESKTOP-SHELL-A11Y-CHECKLIST.md`](DESKTOP-SHELL-A11Y-CHECKLIST.md) и [`DESKTOP-SHELL-E2E-CI.md`](DESKTOP-SHELL-E2E-CI.md) для затронутых точек входа.

## Двойной заголовок: shell vs in-app chrome (plan UI 02/20 R03)

Контракт поверхностей — **`DesktopAppChrome.tsx`** (`standard` / `framed` / `passthrough`). Shell всегда рисует **`WindowTitleBar`** с display title; вложенное приложение не дублирует то же имя в своей шапке.

| App / surface | Shell title | In-app header | Target pattern |
|---------------|-------------|---------------|----------------|
| GAF Chat | `WindowTitleBar` + localized title | `GafChatAppHeaderToolbar` — actions/partner, **без** повтора app name | compact in-app bar |
| Assistant | `WindowTitleBar` | `AssistantAppHeader` — toolbar-only (slice 5); title только в shell | shell title only |
| UGS | `WindowTitleBar` | `UGSDesktopContainer` toolbar — **view label + tabs only** (P2 2026-07-28: no «UGS Workspace» overline) | compact in-app bar |
| Music Player | `WindowTitleBar` | toolbar search/filters; catalog title `sr-only` only | shell title only |
| Doc Editor V2 / Ultimate | `WindowTitleBar` | document tabs / breadcrumbs — document title, not catalog name; sticky meta strip sentence-case (`DOC_EDITOR_HEADER_META_LABEL_CLASS`, 2026-08-05); sticky formatting toolbar glass + quieter icon chrome (`DOC_EDITOR_TOOLBAR_*`, 2026-08-05); left panel rail soft accent + hairline dividers (`DOC_EDITOR_SIDEBAR_*`, 2026-08-05); reading canvas soft paper + prose focus (`DOC_EDITOR_CANVAS_*`, 2026-08-05) | compact in-app bar |
| Ассистент | `WindowTitleBar` | sidebar list quiet team cards + sentence-case meta (`DESKTOP_AI_CHAT_SIDEBAR_*`, 2026-08-05) | compact in-app bar |
| Feedback Hub | `WindowTitleBar` | `FeedbackHubAppHeader` — tagline/badge only (**P2 2026-07-28**, no duplicate title) | compact in-app bar |
| Folder window | breadcrumb title in shell (`resolveDesktopWindowDisplayTitle` + `path`, R16) | list body без второго H1 с тем же именем | shell title only |
| App Store / Settings | `WindowTitleBar` | framed `DesktopAppContentWrapper` | standard / framed |
| EWDesk | `WindowTitleBar` | desktop header — tagline + refresh only (**P2 2026-07-28**); title только в shell / mobile `sr-only` | shell title only |

GAF/Assistant **internals** (#07/#08) — отдельные UI-планы; здесь только правило «не два одинаковых заголовка».

## Before-close guards (plan UI 02/20 R06)

- API: **`DesktopWindowContext.tsx`** — `registerBeforeClose` / `unregisterBeforeClose`.
- Standard confirm: **`createDesktopWindowBeforeCloseConfirmHandler`** (`context/desktopWindowBeforeCloseConfirm.ts`).
- Documented apps with guards: **`DESKTOP_WINDOW_CLOSE_GUARD_CATALOG`** (`utils/desktopWindowCloseGuardCatalog.ts`) — DocEditor, DocEditorV2, Site Studio, Marketing Cabinet.

---

## Синхронизация с планом UI/UX shell (2026-04-21)

Волна **A** roadmap касалась преимущественно оболочки (типографика cmdk, Quick Search, таскбар, палитра команд). Этот файл — очередь для **волны C**: каждый блок ниже по-прежнему в отдельной ветке.

| Область | Следующий шаг |
|---------|----------------|
| GAF Chat | grep хардкод-строк и `z-*` вне `DESKTOP_Z_INDEX` / `useEmbeddedPortaledModalZIndex`; сверка с worklog по порталам. **2026-04-21:** подпись «я» без имени — `gafChat.meDisplayNameFallback` (ru/en); тосты ошибок обоев в shell — `desktopUi.wallpaper.toast*`. **2026-04-21 (аудит z-index):** overflow-меню `GAFChatChatActionsMenu` задаёт `z-index` через `useDesktopWindowPortalStackBase()` — окно вложенного приложения. **2026-04-21 (повторный grep):** пользовательских строк в `GAFChat/*.tsx` вне i18n не найдено; бэкдропы/превью опираются на `DESKTOP_Z_INDEX.GAF_*`. Сообщения ошибок стрима Desktop AI — `desktopAiChat.apiErrors.*` в [`desktopChatClient.ts`](../../../shared/web/frontend/src/features/desktop-ai-chat/api/desktopChatClient.ts). |
| UGS | только согласованные изменения маршрутов/прав; см. `UGS-DESKTOP-SHELL.md`. |
| Уведомления | правки UI — сверить `DESKTOP-NOTIFICATIONS-APP.md`. **2026-06-30 (UI audit 11/20):** NH-01 persist toast + revert; panel `panelQuickSettingsHint`; extraction `notificationHub/NotificationHubPanelFilters`, `NotificationHubWindowFilters`, `NotificationHubGroupedFeed`, `NotificationHubFooterToolbar`, `quickSettings/*`. **2026-06-30 (Wave 9 S2/S3):** `notificationHubLayoutTokens.ts` — item/quick-settings typography на `DESKTOP_TYPOGRAPHY`; `NotificationHubClearConfirm` — `useEmbeddedPortaledModalZIndex` + `DesktopPortaledConfirmShell`; z-index контекстного меню строки — `DESKTOP_PORTAL_STACK_BUMP.NOTIFICATION_HUB_ITEM_MENU`. **2026-04-21:** расхождений с [`UGS-DESKTOP-SHELL.md`](UGS-DESKTOP-SHELL.md) / [`DESKTOP-NOTIFICATIONS-APP.md`](DESKTOP-NOTIFICATIONS-APP.md) по потокам UGS↔центр уведомлений не выявлено; при смене endpoint tray или профиля — обновить оба файла. **2026-04-22:** UX-проход S2 — нижний тулбар [`NotificationHubBody.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/NotificationHubBody.tsx) (кнопки «прочитать всё» / экспорт / «очистить») на `DESKTOP_TYPOGRAPHY.body` и `shellCopy13`; доки UGS/notifications по API без расхождений. |
| Обращения | **2026-06-30 (Wave 9):** slice 3 — `FeedbackHubAppHeader`, `FeedbackHubTicketCard`, `FeedbackHubComposePreview`, `feedbackHubLayoutTokens` / `useFeedbackHubLayoutClasses`; `mapFeedbackSubmitError` + i18n `toastRateLimited` / quota / network; узкие vitest в `feedbackHub/__tests__/`. Structured template в `FeedbackHubComposeForm` — следующий slice при росте файла. |
