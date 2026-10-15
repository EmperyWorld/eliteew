# Assistant — User UX Map

**Статус:** Канон
**Обновлено:** 2026-08-16 (agentic center 50/50 live execution split)
**Программа:** EWA User Experience Program (Waves U0–U8) — **MVP + Slice 2–3 shipped**
**Аудитория:** конечный пользователь desktop + mobile WebView — **не** operator admin.

**Связи:** `documentation/plans/product/ewa/EWA-COMPANION-BACKGROUND-ORCHESTRATION-MASTER-PLAN.md` *[operator-local process plan; gitignored — not living canon]* §8–9, [EWA-COMPANION-USER-WORKFLOWS.md](EWA-COMPANION-USER-WORKFLOWS.md), [EWA-COMPANION-OPERATIONS-PANEL.md](EWA-COMPANION-OPERATIONS-PANEL.md), [EWA-COMPANION-WEB-SMOKE-RUNBOOK.md](EWA-COMPANION-WEB-SMOKE-RUNBOOK.md) §3.8.

**Env / миграции:** этот UX-слой — **только SPA** (localStorage/sessionStorage). Новых `EWA_*` env и SQL-миграций нет.

---

## 1. Терминология (единая для UI)

| Термин | Значение для пользователя | Точка входа |
|--------|---------------------------|-------------|
| **Инструменты** | 19 quick chips + 6 EWA-only tools (doc_insert, app_open, paperless_import, recall_memory, plan_task_complete, reflect_week); server tool names; «Недавние» (localStorage) | Desktop: кнопка в **левом guide rail** (`data-ewa-guide="composer-tools"`) → anchored popover; mobile: bottom sheet |
| **Мои фразы** | Сохранённые user quick presets (CRUD через API) | Desktop: кнопка в левом guide rail → output surface `my_phrases`; mobile: toolbar / deep link |
| **Цепочки** | Пользовательские workflows (phrase trigger → шаги) | Desktop: кнопки **Цепочки** / **Новая** в левом guide rail → `workflow_edit` / `workflow_dag_builder`; mobile: composer strip |
| **Операции** | Фоновые task runs (музыка, картинки, презентации, workflow, confirm) | Правая колонка desktop `lg+`; при `<lg` — кнопка **Операции** в `CompanionPresenceHeader` → тот же `CompanionMobileOperationsSheet`; mobile bottom sheet **Операции** (✨ на rail) |
| **Презентация** | Фоновая сборка слайдов + PDF (не «EWRP» в UI) | Инструмент «Презентация»; карточка в **Операциях** |
| **Песня** | Быстрая / расширенная / мастер песни (не Turbo / XL Base в UI) | Инструменты музыки + wizard surface `music_xl_base_wizard` |
| **Распознать текст** | OCR только как пользовательская формулировка | Инструмент «Распознать текст» (картинка с диска или библиотеки) |

i18n: `marketing.json` → `ewaCompanion.toolsCatalog.*`, `ewaCompanion.myPhrases.*`, `ewaCompanion.userWorkflowChainsLabel`, `ewaCompanion.operationsSheetTitle`. Операторские имена (`OCR`, `EWRP`, `Turbo`, `backend`) **не** показываются в user strings — см. `ui-product-copy.mdc`.

---

## 2. Desktop vs Mobile — capability matrix

| Возможность | Desktop (`EwaDesktopApp`) | Mobile WebView (`#/mobile-ewa-companion`) |
|-------------|---------------------------|-------------------------------------------|
| Чат + streaming SSE | Да | Да |
| Каталог **Инструментов** | `CompanionToolsCatalogPanel` variant=`anchored` (над composer, portaled backdrop) | variant=`sheet` |
| Pin до 3 инструментов в composer | `companionPinnedToolsStorage` (localStorage) | Да |
| **Мои фразы** (список + preview) | `CompanionMyPhrasesMode` | Да (тот же surface) |
| **Script mode** (`{topic}` variables) | `CompanionScriptMode` surface `script` | Да |
| **Цепочки** list + builder | Полный builder v2 | List + builder (responsive) |
| Панель **Операций** | `CompanionOperationsPanel` (`lg+` right rail); **768–1023:** `CompanionPresenceHeader` ops button (`showOperationsEntry` when `!desktopRightRailVisible`) → shared sheet | `CompanionMobileOperationsSheet` + `UniversalOutputSurface` (pin/close/history) |
| Центр активности (sticky) | `CompanionActivityCenterStrip` | Да (desktop+mobile: Сейчас / Было) |
| In-transcript progress + click→focus | `InTranscriptProgressBanner` mainly for non-agentic / mobile; **active agentic** uses center mission **execution column** (live tree/trace) | Да (основной канал прогресса вне agentic split) |
| Center mission (agentic) | Active: `CompanionCenterMissionCanvas` `lg:grid-cols-2` — answer left, execution right; earlier chat collapsed | Stacked (no side-by-side); same surfaces |
| Step timeline icons | `companionStepKindVisual` → `CompanionOperationStepTimeline` | Да |
| Music phase labels | `companionMusicPhaseLabels` (текст → стиль → генерация → финал) | Да |
| Music result card (cover + play) | `CompanionOperationMusicCard` в run card | Да |
| Server surface block strip (kind + actions) | `CompanionSurfaceBlockStrip` на `CompanionOperationRunCard` (U4.9) | Да |
| Surface block payload body (`choice` / `builder` / `history_ref` / `text` + step summary) | `CompanionSurfaceBlockBody` (U4.10–U4.13) | Да |
| Failed run **Повторить** | `companionRetryPrompts` (safe intents) | Да |
| Cancel на active runs | `CompanionOperationRunCard` + `POST …/cancel` | Да |
| Actions tray + «К задаче» | Да (`task_run_id`) | «К задаче» → operations sheet |
| **Слэш** `/music` `/file` `/image` | `companionSlashCommands` chips под composer | Да |
| **Latest-reply hint** | Dismissible banner в transcript (`chatTranscriptLatestReplyHint`) | Да |
| **Pending reload delay** | «Ответ задерживается» после 8s pending без stream (R03) | Да |
| **Non-chat operations entry** | Кнопка «Операции» когда composer скрыт (output surface ≠ chat) | Mobile embedded + desktop |
| **Background panel hint** | Subtle copy когда окно EWA не foreground (`panelBackgroundHint`) | Desktop |
| **Bond arc onboarding** | One-time tooltip на sigil arc (`bondArcHint`) | Desktop `lg+` compact presence |
| Proactive «Не сегодня» | `companionProactiveSnoozeStorage` | Да |
| **Созерцание (W2)** | Left-rail tumbler → LP `companion_presence_v1`; observation hints suppressed | Desktop `lg+` composer tools rail |
| Soft initiative (W3) | Server budget rewrite of anticipation hints (flagged); no new transcript lines | Hint bubble only |
| Continuity tint chip (W5c) | Presence mood chip prefers `companion_continuity_v1.mood_tint` when non-neutral | Compact presence / header chip |
| Soft snooze parity (W5d) | «Не сегодня» → localStorage + server `snooze_until`; anticipation tips hidden | Protocol strip + anticipation tick |
| Observation triggers UI | `CompanionWorkflowObservationSettings` (local prefs) | Да (в list workflows) |
| Memory / plan left rail | Да (`lg+`) | Скрыто в embedded (`hideMobileEmbeddedMetaRail`); **память** — sheet «Помнит о вас» (🧠 в toolbar, read-only) |
| Desktop window tour | `EwaDesktopGuideModal` | Onboarding v2: 3 cards (`CompanionUxOnboardingHints`) |
| Touch targets mobile rail | — | ≥44px (`h-11 w-11`) |
| Pull-to-refresh transcript | — | Потянуть вниз в чате → профиль + операции (U5.5) |
| Landscape layout | — | Транскрипт слева, composer справа при `landscape` + `max-height≤520px` (U5.4) |
| Deep link на операцию | — | `#/mobile-ewa-companion?operation=<runId>` → sheet «Операции» (U5.12) |
| Deep link на инструменты | — | `#/mobile-ewa-companion?tools=1` → sheet «Инструменты» (U5.8) |
| Deep link «Мои фразы» / «Цепочки» | — | `?phrases=1` / `?workflows=1` (U5.11) |
| Badge активных операций | — | Число на ✨ в toolbar при running runs (U5.6) |
| Swipe-down закрытие sheet | — | Потянуть заголовок sheet вниз (U5.7) |
| Auto-open sheet при confirm | — | `awaiting_confirmation` → sheet «Операции» (U5.9) |
| Scroll к операции в sheet | — | Deep link / focus прокручивает карточку (U5.10) |
| Actions tray group headers | Desktop expanded tray | Секции по типу действия при ≥2 группах (U6.9) |
| **Compact presence (`lg+`)** | Sigil 72px + имя + mood в **верхней части левого rail** (`CompanionPresenceCompactBar`, `data-ewa-guide="presence-compact"`) | Горизонтальный `CompanionPresenceHeader` (mobile / `<lg`) |
| **Transcript + operations from top** | Три колонки (`left | chat | operations`) без full-width header над сеткой на `lg+` | Прежний stacked header + columns |
| **Left-rail activity disclosure** | Protocol strips + turn plan behind collapsed «Activity details» (`ewa-companion-left-rail-activity`); presence / memory / plan / composer tools stay primary | Mobile meta: turn plan visible; protocol strips omitted |

### Viewport matrix (operations entry)

| Width | Left tools rail | Right ops rail | Ops entry |
|------:|-----------------|----------------|-----------|
| `<768` (mobile / embedded) | Meta rail / sheets | Hidden | Toolbar ✨ + presence header ops when wired |
| **768–1023** (mid-desktop) | Hidden (`lg:flex`) | Hidden | **`CompanionPresenceHeader` → Operations** opens `CompanionMobileOperationsSheet` |
| `≥1024` (`lg+`) | Visible | Visible | Header ops **hidden** (`desktopRightRailVisible`); rail is source of truth |

Desktop **`lg+` layout (2026-06-30):** `CompanionChatMainRow` монтирует три колонки от верхней границы panel root; компактный образ спутника — только в левом rail. Guided tour шаг **presence** сначала таргетит `[data-ewa-guide="presence-compact"]`, при `<lg` / mobile — fallback на `[data-ewa-guide="presence-header"]` (`EwaDesktopGuideModal`).

**Desktop composer (2026-06-30):** card без внутреннего launcher rail — textarea + slash chips + строка preset chips (без дублирования launcher-кнопок) + restore/voice/send. Launcher-кнопки (Автоподтверждение, **Созерцание**, Веб, вложение, Инструменты, Мои фразы, Цепочки, Новая цепочка) живут в **`CompanionLeftRailComposerToolsSection`** внутри `aside[data-ewa-guide="left-rail"]` под persona/memory/plan. Pin/priority chips не дублируют закреплённые инструменты. **Copy** на ответах ассистента — footer bubble (hover), не header рядом с именем.

**First-run gate (`EwaDesktopApp`):** `GET companion-profile` → `404` = First Meet (`pick`); `401`/`403` = auth panel (в т.ч. axios path); `503` = offline retry. Opening preloader пропускается при session restore **и** в embedded mobile WebView. First Meet: 5 спокойных preference-вопросов → финал с одним CTA **«Создать спутника»** (`data-ewa-first-meet-confirm`); см. [EWA-COMPANION-SEED-PERSONA-MATRIX.md](EWA-COMPANION-SEED-PERSONA-MATRIX.md).

---

## 3. Output surface modes (пользователь)

| `mode` | UI | Composer |
|--------|-----|----------|
| `chat` | Transcript **or** Master Dashboard (empty) + progress + activity center | Full composer |
| `my_phrases` | Список user presets | Slim chat dock |
| `script` | Шаблон + переменные + preview | Slim chat dock |
| `workflow_edit` | «Мои цепочки» + filter + quick-start; footer **Новая линейная** / **Новая визуальная** | Slim chat dock |
| `workflow_dag_builder` | Visual DAG builder | Slim chat dock |
| `workflow_dag_builder` | Visual DAG canvas ([audit](EWA-COMPANION-USER-WORKFLOWS.md)) | Slim chat dock |
| `file_list` / `document_editor` / `music_xl_base_wizard` | Embedded surfaces | Slim chat dock |
| `roadmap` | Server plan strip | Slim chat dock |

**Unified Workspace (2026-07-09):** empty chat shows capability Gateway (`CompanionMasterDashboard`). DocEditor with `unified_content_id` stays in-companion by default (`open_on_desk` opt-in). Presentation desk app is progressive disclosure. Canon: [EWA-COMPANION-USER-UX-MAP.md](EWA-COMPANION-USER-UX-MAP.md).

Контракт: `CompanionOutputSurfaceState` в `companionOutputSurface/types.ts`; persist `sessionStorage` `eliteew.ewaCompanion.surface.v1::{principalId}`.

---

## 4. Локальные preferences (без сервера)

| Key prefix | Назначение | Max |
|------------|------------|-----|
| `eliteew.companion.pinnedTools.v1:{principalId}` | Закреплённые built-in instrument ids | 3 |
| `eliteew.companion.recentTools.v1:{principalId}` | Local chip clicks (Try / quick preset) | 5 |
| *(server)* `learned_preferences.companion_recent_server_actions` | Orchestrator ring — merged into catalog «Недавние» (U1.6) | 5 |
| `eliteew.companion.myPhraseIcons.v1:{principalId}` | User phrase icon overrides (U2.4) | — |
| `eliteew.companion.observationTriggers.v1:{principalId}` | `idleEnabled`, `focusAppEnabled` (до server sync) | — |
| `eliteew.companion.proactiveSnooze.v1:{principalId}` | Snooze proactive до конца локального дня | — |
| `eliteew.ewaCompanion.chatDraft.v1::{principalId}` | Composer draft (session) | 8000 chars |
| `eliteew.ewaCompanion.surface.v1::{principalId}` | Output surface mode (session) | — |
| `eliteew.companion.transcriptLatestReplyHint.v1:{principalId}` | Dismiss latest-reply explainer (localStorage) | — |
| `eliteew.companion.bondArcOnboarding.v1:{principalId}` | Dismiss bond-arc sigil tooltip once (localStorage) | — |

**Facade:** `companionClientPrefs.ts` re-exports getters/setters для ключей выше без смены строк ключей; hint storage также в `companionTranscriptHintStorage.ts`, `companionBondArcHintStorage.ts`.

---

## 5. FAQ (коротко)

**Почему в чате виден только последний ответ спутника?**
Полная переписка хранится на сервере для памяти и follow-up, но UI transcript намеренно показывает **последнюю пару** user + assistant после reload профиля — см. `chatTranscriptLatestReplyHint` в i18n и `extractLatestCompanionAssistantReplyFromLearned` в `ewaCompanionChatApi`.

**Где смотреть прогресс музыки / презентации / картинки?**
В блоке **Операции** (desktop — правая колонка; mobile — sheet ✨). In-transcript banner дублирует активные run-ы и ведёт фокус туда же.

**Почему блок «Результат миссии» (/agent) занимает весь чат?**
Завершённая миссия в центре **свёрнута по умолчанию** (компактная полоска). **Развернуть** открывает итог; **Свернуть** возвращает компакт; **Скрыть** / Operations **Закрыть** пишут dismiss в один `localStorage` lifecycle и переживают reload (run не отменяется). Активная миссия всегда развёрнута. Переписка («Контекст ответа») остаётся **под** полоской миссии и при свёртке — не пропадает в пустоту.

**Почему «Шаги миссии / Журнал» пустые после /agent?**
Дерево и трасса приходят с `/tree` и `/trace`. Если сессия завершилась без сохранённых узлов, UI честно пишет, что шаги не сохранились, и показывает `plan_summary` в «ходе миссии», когда он есть в `plan_payload`.

**Что значит «Итог недели»?**
Пользовательский инструмент `reflect_week` — краткий обзор бесед за неделю (не операторский workflow id в UI).

---

## 6. Код (индекс frontend)

**Wave I TS hygiene (2026-07-28):** companion orchestration type alignment — `applyQuickPreset` from `useCompanionToolsCatalog` (composer) / local mirror in transcript for «Мои фразы»; `handleNewActiveOperationRun(run: EwaCompanionTaskRun)` + `liveActiveOperationRunIds: ReadonlySet`; center-mission ready media null-narrow; left-rail optional catalog/phrases open wrappers; palette cast to `CompanionPresenceCssVars`.

| Область | Путь |
|---------|------|
| Shell | `EwaCompanionChatPanel.tsx`, **`companionUx/useEwaCompanionChatPanelOrchestration.tsx`** (~103 LOC glue), **`companionChatOrchestrationShared.ts`**, **`companionClientPrefs.ts`** |
| Orchestration bundles | **`useCompanionChatOrchestrationBase.ts`** (layout, i18n, refs, draft, surface), **`useCompanionChatOperationsBundle.ts`** (SSE, task runs, ops rail), **`useCompanionChatTranscriptBundle.tsx`** (~766; helpers `buildCompanionCenterMissionCanvas`, `buildCompanionTranscriptMessageListProps`, `useCompanionEmptyGatewayHandlers`) + **`useCompanionChatTranscriptDisplay.ts`**, **`useCompanionChatComposerBundle.tsx`**, **`useCompanionChatOverlaysBundle.tsx`**, **`useCompanionChatSurfaceBundle.ts`** — glue order: base → operations → transcript → composer → overlays; ref bridges `submitCompanionLineRef`, `speakCompanionReplyRef`, `stopSpeakingRef`, `openToolsCatalogRef` |
| Plan 15 UX helpers | **`CompanionTranscriptLatestReplyHint.tsx`**, **`CompanionPendingReloadBanner.tsx`**, **`CompanionPanelBackgroundHint.tsx`**, **`CompanionNonChatOperationsEntry.tsx`**, **`useCompanionPendingReloadDelay.ts`**, **`companionPendingReloadDelay.ts`**, **`companionTranscriptHintStorage.ts`**, **`companionBondArcHintStorage.ts`** |
| Presence / sigil | **`CompanionPresenceCompactBar.tsx`** (`lg+` left rail), `CompanionPresenceHeader.tsx` (mobile / `<lg`), `CompanionSigil.tsx` (`size`: `default` \| `compact`), `useCompanionPresencePresentation.ts`, `useCompanionArlikaV2SigilToggle.ts` |
| Chat API client | `services/ewa/ewaCompanionChatApi.ts` (barrel), `ewaCompanionChatCoerce.ts`, `ewaCompanionChatMessageApi.ts`, `ewaCompanionChatStreamApi.ts`, `ewaCompanionChatTaskRunsApi.ts` |
| Left rail strips | `companionUx/CompanionLeftRailServerActionsSection.tsx`, `CompanionTurnPlanStrip.tsx`, `CompanionLeftRailPlanSection.tsx`, `CompanionProtocolStrips.tsx`, **`CompanionAnticipationHintSection.tsx`**, **`CompanionLeftRailComposerToolsSection.tsx`**, **`CompanionChatOperationsRail.tsx`**, **`CompanionTransformVideoPortal.tsx`**, **`CompanionLeftRailCluster.tsx`**, **`CompanionDesktopRightOperationsAside.tsx`** |
| Composer / dialogs | `companionUx/CompanionSlashSuggestionsStrip.tsx`, **`CompanionChatDialogCluster.tsx`**, **`CompanionPendingImagePreview.tsx`**, **`CompanionComposerAttachButtons.tsx`**, **`CompanionComposerVoiceRail.tsx`**, **`CompanionMobileComposerToolbar.tsx`**, **`CompanionTranscriptEmptyState.tsx`**, **`CompanionTranscriptMessageRow.tsx`**, **`CompanionTranscriptThinkingBubble.tsx`**, **`CompanionTranscriptMessageList.tsx`**, **`CompanionComposerTextarea.tsx`**, **`CompanionComposerDraftStack.tsx`**, **`CompanionDesktopComposerFooter.tsx`**, **`CompanionComposerShell.tsx`**, **`CompanionMobileComposerBody.tsx`**, **`CompanionDesktopComposerBody.tsx`**, **`CompanionTranscriptChatContent.tsx`**, **`CompanionComposerSection.tsx`**, **`CompanionChatMobileSheets.tsx`**, **`CompanionToolsInstrumentsOverlay.tsx`**, **`CompanionChatPanelOverlays.tsx`**, **`CompanionChatMainRow.tsx`**, **`CompanionTranscriptColumn.tsx`**, **`CompanionChatMainColumn.tsx`**, **`CompanionChatPanelRoot.tsx`**, **`CompanionChatPanelStack.tsx`** |
| Actions tray | `companionUx/CompanionActionsTray.tsx`, `companionActionTrayUi.ts` |
| Composer strip | `EwaCompanionQuickPresetsStrip.tsx` |
| Instruments catalog | `companionTools/CompanionToolsCatalogPanel.tsx` (**«В чат» + «Попробовать»**), **`CompanionToolsCatalogPortal.tsx`** (`getDesktopPortalShellProps` on `document.body`), `companionToolsDesktopSurface.ts` (opaque `rgb(var(--desktop-bg-*))` surfaces), `companionToolsCatalogUi.ts`, `companionEwaToolsRegistry.ts`, `companionRecentToolsMerge.ts` |
| Mobile sheets | `companionUx/CompanionMobileBottomSheet.tsx`, `CompanionMobileOperationsSheet.tsx`, `CompanionMobileMemorySheet.tsx` |
| Mobile pull-refresh / deep link | `companionUx/companionMobilePullRefresh.ts`, `useCompanionMobilePullRefresh.tsx`, `companionMobileDeepLink.ts`, `companionMobileSheetSwipe.ts`, `useCompanionMobileSheetSwipeDismiss.tsx` |
| Activity / onboarding | `companionUx/CompanionActivityCenterStrip.tsx`, `CompanionUxOnboardingHints.tsx`, `companionUx/companionUserSuccessToasts.ts`, `companionUx/companionProgressA11y.ts` |
| Operations UI | `companionOperations/*` — barrel `companionOperationsUi.ts` → `companionOperationsDisplayFilters` / `MissionSurface` / thin `companionOperationsProgressUi` → `progressUi/{types,musicPipeline,readyArtifacts,operationLabels,transcriptProgress,workflowSummary}`; banner, step timeline, run card, `CompanionOperationMusicCard`, panel |
| Surface blocks (U4.9–U4.13) | `companionOutputSurface/companionSurfaceBlockUi.ts`, `companionSurfaceBlockPayload.ts`, `CompanionSurfaceBlockStrip.tsx`, `CompanionSurfaceBlockBody.tsx` |
| Surfaces | `companionOutputSurface/CompanionMyPhrasesMode.tsx`, `useCompanionMyPhrasesController.ts`, `companionMyPhrasesUi.ts`, `companionMyPhrasesExport.ts`, `companionMyPhrasesImport.ts`, `companionMyPhraseIconsStorage.ts`, `CompanionScriptMode.tsx`, `CompanionWorkflowEditMode.tsx` |
| Chat submit | `companionUx/useCompanionChatSubmit.ts` |
| Action dispatch | `companionUx/useCompanionActionDispatch.ts` (tray state + desktop dispatch, U8.3 slice 7), **`useCompanionEmbeddedDocumentSurface.ts` (slice 10)** |
| Left rail | `companionUx/useCompanionLeftRailController.ts`, `CompanionLeftRailMemorySection.tsx`, `useCompanionMemoryForget.ts`, **`CompanionLeftRailPlanSection.tsx`**, **`CompanionLeftRailServerActionsSection.tsx`**, **`CompanionTurnPlanStrip.tsx`**, **`CompanionProtocolStrips.tsx`** |
| Run card stories | `companionOperations/companionOperationRunCardStories.ts` (U8.2 fixtures §8.5) |
| Tests | `companionUx/__tests__/CompanionChatMainRow.test.tsx`, `CompanionPresenceCompactBar.test.tsx`, **`__tests__/EwaCompanionChatPanel.integration.test.tsx`**, **`__tests__/EwaCompanionChatPanel.render.test.tsx` (R14)**, `useCompanionChatSubmit.test.ts`, … |
| E2E smoke | `e2e/ewa-companion-chat-smoke.spec.ts` (`DESKTOP_SHELL_E2E_RUN=1`) |

Backend quick-intent sync (19 built-ins): [EWA-COMPANION-QUICK-INTENTS.md](EWA-COMPANION-QUICK-INTENTS.md).

---

## 7. Waves — статус реализации (2026-06-20)

| Wave | Shipped в этом релизе | Отложено |
|------|----------------------|----------|
| U0 | IA map, i18n, empty state, onboarding v2 | — |
| U1 | Catalog popover/sheet, compact rows, pin, search, Vitest, **EWA tool registry (25 rows)**, recent tools, **server ring merge (U1.6)** | — |
| U2 | My phrases surface, script mode v1, **drag reorder**, **duplicate**, **icon picker (local)**, **JSON export (U2.8)**, **JSON import (U2.9)** | — |
| U3 | List filter, quick-start cards, observation triggers UI (local), **user success toasts (U3.10)**, **operations history expand UX (U3.4 — show more, 8→20)** | U3.3 workflow dry-run preview API |
| U4 | Activity center, banner focus, step icons, music phases, retry, cancel, SSE pulse, **image lightbox**, **music result card**, **mobile surface lifecycle (U4.8)**, **surface block strip (U4.9)**, **payload block renderers (U4.10–U4.13)** | — |
| U5 | Operations sheet, tools sheet, in-transcript progress, 44px rail, landscape, pull-refresh, ops badge, sheet swipe, tools/operation/phrases/workflows deep links, confirm auto-open, highlight scroll | — |
| U6 | Anticipation icons, proactive snooze, slash commands, **tray group headers (U6.9)**, **mobile memory sheet**, **memory forget + mood chip (U6.3)** | — |
| U7 | Focus trap sheets, reduced-motion pulse, RU+EN strings, touch targets, **progress SR labels (U7.3)** | — |
| U8 | Shared `CompanionToolsCatalogPanel`, Vitest helpers, smoke §3.8, **panel hooks extract slices 1–5 (U8.1 Done)**, **run card story fixtures + Vitest (U8.2)**, **`CompanionActionsTray` extract (U8.3 slice 6)**, **`useCompanionActionDispatch` (U8.3 slice 7)**, **memory forget hook + left-rail memory section (U8.3 slice 8)**, **left-rail plan/server-actions/turn-plan/protocol strips (U8.3 slice 9)**, **`useCompanionEmbeddedDocumentSurface` (U8.3 slice 10)**, **anticipation/operations rail/transform portal + operation image actions (U8.3 slice 11)**, **presence header + presentation hooks (U8.3 slice 12)**, **slash suggestions + dialog cluster (U8.3 slice 13)**, **composer pending image + attach/voice rail + mobile toolbar (U8.3 slice 14)**, **transcript empty state + message list rows (U8.3 slice 15)**, **composer textarea + draft stack + desktop footer (U8.3 slice 16)**, **composer shell + mobile/desktop body + transcript chat content (U8.3 slice 17)**, **composer section + mobile sheets cluster (U8.3 slice 18)**, **tools catalog backdrop/panel + OCR dialog overlay (U8.3 slice 19)**, **dialog cluster + transform video portal + guide modal overlays (U8.3 slice 20)**, **left-rail cluster + shared operations rail props (U8.3 slice 21)**, **desktop right operations aside (U8.3 slice 22)**, **main chat row shell + mobile sheets prop bundles (U8.3 slice 23)**, **main column + transcript column + output surface prop bundles (U8.3 slice 24)**, **panel root shell + overlay stack prop bundles (U8.3 slice 25)**, **`useEwaCompanionChatPanelOrchestration` hook extract + thin panel view shell (U8.3 slice 26 — panel JSX decomposition Done)** | U3.3 workflow dry-run preview API |

---

## 8. Out of scope

- `EwaCompanionAdminPanel`, Monaco operator catalog, env flags UI
- Marketing AMKA cabinet
- Новые HTTP endpoints (кроме уже существующих task-runs / quick-actions / user-workflows и **memory forget** `DELETE …/companion-profile/memory/{content_hash}`)

---

## 9. Operator smoke

Ручной чеклист: [EWA-COMPANION-WEB-SMOKE-RUNBOOK.md](EWA-COMPANION-WEB-SMOKE-RUNBOOK.md) **§3.8**.
