# EWRP: редактор слайдов после генерации

**Status:** living thin SoT for post-generate slide editor (prefer over opening the full EWRP hub for editor-only work). Product hub: [EWRP-REVOLUTIONARY-PRESENTATIONS.md](EWRP-REVOLUTIONARY-PRESENTATIONS.md).

Канон по **редактированию готовой презентации** на рабочем столе: бэкенд пересборки, нормализация bullets, фокусный UI (2026-06). Общий справочник продукта — **`product/EWRP-REVOLUTIONARY-PRESENTATIONS.md`** (§5.4, §6, §12).

**Код (фронт):** `shared/web/frontend/src/components/EWRP/` — UI shell `EWRPGeneratorMain.tsx` + orchestration facade `useEwrpGeneratorOrchestration.tsx` → compose `ewrpOrchestration/useEwrpGeneratorCompose.tsx`, overlays `EwrpGeneratorModals.tsx`, app chrome `EwrpGeneratorAppChrome.tsx`, Generate-вкладка facade `EwrpGenerateTabPanel.tsx` → `ewrpGenerateTab/*`, Presentations-вкладка `EwrpPresentationsTabPanel.tsx` (composition: `EwrpPresentationsSlideEditorSurface`, `EwrpPresentationsStatusOutline`, `EwrpPresentationsCompletedPdfActions`, `EwrpPresentationsIdleColumn`), shared chunks barrel `EwrpGeneratorChunks.tsx` → `ewrpChunks/*`, helpers `ewrpDraftBullets.ts`.

### Generate tab module map (atomization 2026-07-31)

| Модуль | Ответственность |
|--------|-----------------|
| `EwrpGenerateTabPanel.tsx` | Thin facade (≤50 LOC): re-export `EwrpGenerateTabPanel` + `EwrpGenerateTabPanelProps` |
| `ewrpGenerateTab/EwrpGenerateTabPanel.tsx` | Compose shell (`ewrp-panel-generate`); props-only; wires derived + sections |
| `ewrpGenerateTab/ewrpGenerateTabTypes.ts` | Public props contract (unchanged vs pre-atomization) |
| `ewrpGenerateTab/useEwrpGenerateTabDerived.tsx` | Sticky labels, mismatch flags, shell classes, energy detail |
| `ewrpGenerateTab/EwrpGenerateTabHistoryToolbar.tsx` | History-open button row |
| `ewrpGenerateTab/EwrpGenerateTabActiveJobBanner.tsx` | Active-job status banner |
| `ewrpGenerateTab/EwrpGenerateTabStickyContext.tsx` | Sticky workspace context + chips |
| `ewrpGenerateTab/EwrpGenerateTabTopicSection.tsx` | Step 1 topic hero |
| `ewrpGenerateTab/EwrpGenerateTabThemeSection.tsx` | Step 2 PDF theme |
| `ewrpGenerateTab/EwrpGenerateTabContentSection.tsx` | Step 3 title + slide count |
| `ewrpGenerateTab/EwrpGenerateTabModelContextSection.tsx` | Step 4 web-search quality + extra context |
| `ewrpGenerateTab/EwrpGenerateTabDataSourceSection.tsx` | Step 5 CM doc picker |
| `ewrpGenerateTab/EwrpGenerateTabSubmitSection.tsx` | Submit CTA + energy notice |

Contract lock: `EwrpGenerateTabPanel.contract.test.ts` (facade ≤50 LOC, children ≤800 LOC, Main wiring). Shared chunks barrel (`EwrpGeneratorChunks` → `ewrpChunks/*`) unchanged (Wave 3).

### Shared chunks module map (atomization 2026-07-31)

| Модуль | Ответственность |
|--------|-----------------|
| `EwrpGeneratorChunks.tsx` | Thin barrel: re-export `ewrpChunks/*` + status/HTTP/date helpers |
| `ewrpChunks/ewrpGeneratorConstants.ts` | Credits, CM helpers/types, poll/page/theme/layout consts |
| `ewrpChunks/ewrpHistoryExportHelpers.ts` | Date formatters, history/doc filters, outline markdown, download |
| `ewrpChunks/EwrpFormChrome.tsx` | History skeleton, form section header, desktop select, `sw` |
| `ewrpChunks/EwrpSlideOutlineRow.tsx` | Memo outline row |
| `ewrpChunks/EwrpDraftSlideRow.tsx` | Draft slide editor row + sortable DnD wrapper |
| `ewrpChunks/EwrpHistoryRow.tsx` | History list row actions |
| `ewrpChunks/EwrpDraftRestoreBanner.tsx` | Local draft restore banner |

### Orchestration module map (atomization 2026-07-29)

| Модуль | Ответственность |
|--------|-----------------|
| `useEwrpGeneratorOrchestration.tsx` | Public facade (≤50 LOC): re-export props + compose |
| `ewrpOrchestration/useEwrpGeneratorCompose.tsx` | Wire hooks; flat ~193-key return for Main |
| `ewrpOrchestration/useEwrpGeneratorPolling.ts` | Job status poll timers (`jobId`-only deps) |
| `ewrpOrchestration/useEwrpGeneratorHistory.tsx` | History list, virtual rows, delete target |
| `ewrpOrchestration/useEwrpGeneratorDocPicker.tsx` | CM doc picker modal + prefetch |
| `ewrpOrchestration/useEwrpGeneratorSubmit.ts` | Form submit + idempotency key |
| `ewrpOrchestration/useEwrpJobActions.ts` | Apply inputs, duplicate, retry, open, delete |
| `ewrpOrchestration/useEwrpPdfActions.ts` | PDF download/open/copy; outline export |
| `ewrpOrchestration/useEwrpDraftEditor.ts` | Slide editor lifecycle, DnD, nav, AI panel |
| `ewrpOrchestration/useEwrpDraftEditorSave.ts` | Save pipeline, editor hotkeys, autosave |
| `ewrpOrchestration/useEwrpGeneratorBootstrap.ts` | PW draft hydrate, restore, companion listing effects |
| `ewrpOrchestration/useEwrpGeneratorDerivedState.ts` | Energy quote + status label memos |
| `ewrpOrchestration/useEwrpGeneratorKeyboard.ts` | Global shortcuts (Escape, `/`, r, Ctrl+S, Ctrl+Enter) |
| `ewrpOrchestration/useEwrpGeneratorGuide.ts` | Guided tour tab prep + spotlight key |
| `ewrpOrchestration/ewrpOrchestrationTypes.ts` | Shared props / delete / restore types |
| `ewrpOrchestration/ewrpLocalDraftStorage.ts` | `ewrp-draft-{jobId}` localStorage |
| `ewrpOrchestration/ewrpCompanionListing.ts` | Companion `surface_listing` plain text |
| `ewrpOrchestration/ewrpStatusLiveText.ts` | Screen-reader status live region |
| `ewrpOrchestration/ewrpShellChromeClasses.ts` | Desktop shell field/button class builders |
| `ewrpOrchestration/EwrpDocPickerVirtualRow.tsx` | Virtual list row for doc picker |

Contract lock: `ewrpOrchestration/__tests__/EwrpGeneratorOrchestration.atomization.contract.test.ts`.

---

## 1. Поведение API при сохранении слайдов

После сохранения списка слайдов (`PUT /ewrp/{job_id}/slides`), если для какого-то слайда на диске ещё нет PNG, API ставит задачу в фон: для каждого такого индекса выполняется генерация изображения через UGS (тип `image_generation_comfyui`), затем **одна** пересборка PDF/HTML (скриншоты слайдов и сборка PDF), а не пересборка после каждого слайда.

Операторам: при ошибке на этапе картинок пользователь может снова открыть редактор и сохранить — недостающие изображения будут догенерированы при тех же правилах биллинга.

Пересборка PDF после правки текста/порядка/лейаута — **без дополнительного списания** за «вёрстку» (см. §4 в **`EWRP-REVOLUTIONARY-PRESENTATIONS.md`**).

---

## 2. Нормализация текста слайда (bullets)

| Слой | Модуль | Назначение |
|------|--------|------------|
| Backend | `shared/api/services/ewrp_slide_bullets.py` | Канон полей `bullets` в `slides_json` |
| Frontend | `ewrpDraftBullets.ts` | `normalizeEwrpSlideBullets`, `ewrpBulletsToTextareaValue`, `ewrpBulletLinesFromTextarea`, `ewrpDraftBulletsUnchanged` |

**Инварианты:**

- Textarea в редакторе — **одна строка = один пункт** на слайде; значение через `ewrpBulletsToTextareaValue` (поддержка legacy `content`/`body` в localStorage).
- **Live typing:** `ewrpBulletLinesFromTextarea` / round-trip `ewrpBulletsToTextareaValue` **не** trim/collapse и **не** отбрасывают пустые строки — иначе controlled `value` короче DOM и курсор уезжает в конец (Space / Delete / Enter).
- **Persist:** trim + collapse whitespace + drop empty — при **Сохранить** (`useEwrpDraftEditorSave`, inline clean перед `updateSlides`) и при входе в редактор / restore / sync после rebuild через `normalizeEwrpSlideBullets` (trim + drop empty; collapse — на save).
- Синхронизация draft с `GET .../status` после rebuild — только при смене **фазы** задачи (`generating_images` / `building_pdf` → `completed`), не при каждом обновлении reference `slides`.

**Тесты:** `ewrpDraftBullets.test.ts` (Vitest).

**Инцидент 2026-06-08:** отсутствующий импорт `ewrpBulletLinesFromTextarea` в `handleChangeBullets` давал `ReferenceError` и откат controlled textarea (заголовок менялся, текст — нет). Session: **`worklog/session-summaries/2026-06-08-0250-ewrp-slide-bullets-edit-fix.md`**.

**Инцидент 2026-08-26:** live-normalize (`.trim()` + `normalizeEwrpSlideBullets` в value) сбрасывал caret в конец при Space/Delete; фикс — raw draft lines while typing.

---

## 3. Фокусный режим редактирования (UI, 2026-06)

Вкладка **«Мои презентации»** → кнопка **«Редактировать слайды»** (при `completed` + слайды). В режиме редактирования (`editorFocusMode` = `showSlideEditorPanel`):

| Элемент | Поведение |
|---------|-----------|
| Шапка EWRP / вкладки / «История» / lead | **Скрыты** — место под редактор |
| Шапка приложения (вне EWRP) | Компактная вне edit; в edit не рендерится |
| Outline read-only (до edit) | Список структуры на панели статуса — только **вне** edit |
| **Структура в edit** | В спойлере **«Инструменты редактора»** (свернут по умолчанию): черновик структуры с миниатюрами, раскладка, подсказки |
| Progress bar | Скрыт в edit (rebuild — mini-bar / баннер редактора) |
| **Задача и статус** | Один спойлер: chip, тема, **«Завершить редактирование»**, pipeline, ID, retry/duplicate, PDF — по умолчанию **свёрнут** |
| **Инструменты редактора** | Спойлер **«Инструменты редактора»**: expand/collapse, comfortable/compact, структура, советы; бейдж «0 ⚡» — в шапке редактора |
| Поиск + quick nav | Всегда видны над списком слайдов |
| Список слайдов | Отдельный блок `flex-1 min-h-0` **рядом** со свёрнутой панелью задачи; **единственный** вертикальный scroll списка (sticky footer всегда в колонке); virtual list при 15+ |
| Превью медиа | `GET /api/v1/ewrp/{job_id}/slides/{slide_index}/image` → blob в `EwrpSlideImagePreview`: **только миниатюра** в строке слайда; клик по лупе — lightbox на весь экран |
| Поля слайда | Заголовок, **раскладка** (слайды 2+), текст; hint «каждая строка — пункт» |

Session (сжатие UI): **`worklog/session-summaries/2026-06-08-0255-ewrp-editor-focus-ux.md`**. Session (восстановление UX): **`worklog/session-summaries/2026-06-07-ewrp-editor-ux-restore.md`**.

---

## 4. Навигация и панель действий

### 4.1. Quick nav (`EwrpSlideEditorQuickNav.tsx`)

- Горизонтальная полоска **номеров слайдов** (при 2+ в текущем наборе).
- Кнопки **‹ / ›** — предыдущий / следующий слайд.
- При **поиске** в редакторе — только индексы совпадений.
- При **15+ слайдах** (`EWRP_EDITOR_SLIDES_VIRTUAL_THRESHOLD`) — jump через `VirtualVariableList.scrollToIndex` (`virtualListRef` на списке).
- Подсветка активного номера: `IntersectionObserver` (обычный список) или `onVisibleIndexChange` (virtual list).

### 4.2. Sticky footer (`EwrpSlideEditorStickyFooter.tsx`)

Внизу карточки редактора всегда видны: **Добавить слайд**, счётчик `N / max`, подсказка **0 ⚡** за пересборку PDF, **Просмотр PDF** (если готов), **Отмена**, **Сохранить и пересобрать PDF** (amber ring при несохранённых правках).

### 4.3. Mini status bar

При прокрутке мимо панели статуса — **`EwrpPresentationsMiniStatusBar`**: save/cancel, scroll CTAs. С 2026-06: кнопка **«Сохранить»** видна **всегда** при редактировании (неактивна без правок, tooltip `editorSaveNoChangesTitle`).

### 4.4. Горячие клавиши (только в режиме редактора)

| Сочетание | Действие |
|-----------|----------|
| `Ctrl`/`⌘` + `S` | Сохранить (тот же flow, что кнопка; multi-UGS confirm при нескольких новых картинках) |
| `Alt` + `←` / `↑` | Предыдущий слайд (в текущем наборе nav) |
| `Alt` + `→` / `↓` | Следующий слайд |

В видимом UI hotkeys не дублируются (см. **`EWRP-REVOLUTIONARY-PRESENTATIONS.md`** §11.5).

Sessions: **`2026-06-08-0310-ewrp-editor-nav-sticky-footer.md`**, **`2026-06-08-0310-ewrp-editor-nav-virtual-mini-save.md`**.

---

## 5. Прокрутка списка слайдов

**Инвариант (focus mode, 2026-08-25):** в `editorFocusMode` список слайдов — **единственный** вертикальный scroll owner колонки редактора:

- Классы: `flex-1 min-h-0` + `overflow-y-auto` (обычный список) или `overflow-hidden` + измеренная высота `VirtualVariableList`.
- **Запрещено** `min-h-[min(62vh,…)]` (и любой vh-based min-height) внутри цепочки `overflow-hidden`: иначе sticky footer и низ списка клипаются; уменьшение масштаба браузера «лечит» симптом — это не решение.
- Sticky footer (`EwrpSlideEditorStickyFooter`) — `shrink-0` sibling списка, всегда в колонке.

**Вне focus mode** (редактор внутри панели статуса):

- Обычный список: `max-h-[min(65vh,640px)] overflow-y-auto` на `slideEditorScrollRef`.
- Virtual list (15+): внутренний скролл `VirtualVariableList` (`height={560}`), без двойного `overflow` на обёртке.

Не использовать `overflow-hidden` + `flex-1` на родителях редактора без рабочей flex-цепочки (`min-h-0` по высоте) — иначе контент клипается без scrollbar.

Lock: `EwrpPresentationsSlideEditorSurface.layout.contract.test.ts`.  
Session (исторический): **`worklog/session-summaries/2026-06-08-0320-ewrp-editor-scroll-fix.md`**.

---

## 6. Вспомогательные компоненты (2026-06)

| Компонент | Файл |
|-----------|------|
| Спойлер секций | `EwrpCollapsibleSection.tsx` |
| Блок метаданных задачи | `EwrpPresentationJobAdminBlock.tsx` |
| Quick nav | `EwrpSlideEditorQuickNav.tsx` |
| Sticky footer | `EwrpSlideEditorStickyFooter.tsx` |

**Shared virtual list:** `VirtualVariableList` — опционально `virtualListRef` (`scrollToIndex`), `onVisibleIndexChange` — **`components/shared/VirtualList.tsx`**.

---

## 7. Локальный черновик и отмена

- Автосохранение в `localStorage` (`ewrp-draft-{jobId}`), debounce ~800 ms.
- Баннер restore — **`EwrpDraftRestoreBanner`**.
- Выход с несохранёнными правками — **`ConfirmDeleteModal`** (`cancelUnsavedTitle` / `discardChanges`).

---

## 8. Smoke (редактор)

1. Открыть **готовую** презентацию → **Редактировать слайды**.
2. Правка **заголовка и текста** (несколько строк bullets) → **Сохранить** → PDF пересобран.
3. **Детали задачи** / **Подсказки** — свёрнуты по умолчанию, раскрываются по клику.
4. 5+ слайдов: nav **«4»**, **‹ ›**, скролл до нижних слайдов, sticky footer на месте.
5. 15+ слайдов: nav + скролл virtual list.
6. `Ctrl+S` — сохранение; mini-bar **Сохранить** видна при прокрутке вверх.

---

## 9. Связанные session summaries (2026-06-08)

| Тема | Файл |
|------|------|
| Bullets edit fix | `worklog/session-summaries/2026-06-08-0250-ewrp-slide-bullets-edit-fix.md` |
| Focus UX / спойлеры | `worklog/session-summaries/2026-06-08-0255-ewrp-editor-focus-ux.md` |
| Nav + sticky footer | `worklog/session-summaries/2026-06-08-0310-ewrp-editor-nav-sticky-footer.md` |
| Virtual nav + mini save | `worklog/session-summaries/2026-06-08-0310-ewrp-editor-nav-virtual-mini-save.md` |
| Scroll fix | `worklog/session-summaries/2026-06-08-0320-ewrp-editor-scroll-fix.md` |
