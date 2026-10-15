# Unified admin shell (EliteEW)

Единая админ-панель: боковое меню, заголовок раздела и контентная область. Точка входа — `shared/web/frontend/src/pages/Admin/UnifiedAdminPage.tsx`.

## Открытие

| Контекст | Маршрут / окно |
|----------|----------------|
| Полная страница | `AppRouter`: `admin`, `desktop-admin` |
| Окно на столе | `UnifiedAdminApp` → `UnifiedAdminPage` с `embedded` |

Права (SPA gate): `isUgsAdminAuthorized` / `hasUgsAdminIdentity` — **только роли** JWT `admin` | `emperyworld_admin` (зеркало `require_admin_user`). Email allowlist **не** на фронте: `UGS_ADMIN_EMAILS` — API break-glass только для `require_ugs_admin_user` (UGS admin routes). Write в разделах — отдельные проверки API.

**TS hygiene (2026-07-28 Wave G):** admin forms use `DESKTOP_INTERACTIVE.input` / `.button` (aliases of field chrome + `btn`); Users open event accepts `userId` without `search`; directory sort i18n keys are narrowed to listed options only.

## Deep link

- `?section=<id>` — активный раздел (`users`, `desktop`, `ugsV2`, `workers`, …). Legacy `?section=ugs` мигрирует в `ugsV2` (`ugsAdminShellUrl.ts`).
- При уходе с **Пользователи** query-ключи каталога (`q`, `userId`, `view`, `mismatch`, …) снимаются; при переходе **на** `users` сохраняются (см. `adminUsersUrlFilters.ts`). Ключ `q` общий с обращениями — при входе в `users` не сбрасывается (`adminShellUrl.ts`).
- В **embedded**-окне URL не меняется (`syncAdminShellSectionToUrl` отключён).

## Модули оболочки

| Файл | Назначение |
|------|------------|
| `shell/adminShellConfig.ts` | Группы навигации, метаданные разделов, `headerMode`; `AdminSectionId` derived from `ADMIN_SHELL_SECTIONS` |
| `shell/adminShellSmokeChecklist.ts` | Operator smoke lines derived from nav SSOT (parity Vitest) |
| `shell/adminShellNavTelemetry.ts` | In-session counters for section opens (`recordAdminShellSectionSelect`) |
| `shell/adminShellSectionSelectApi.ts` | Best-effort POST → `/desktop/admin/shell/section-select` |
| `users/adminUsersHubFiltersTypes.ts` | Public Users hub filters types |
| `users/adminUsersDirectoryQuery.ts` | Pure directory query / active-filter builders |
| `shell/AdminSectionLazy.tsx` | Module-scope `lazy()` factories для тел разделов (кроме inline `system`) |
| `shell/adminShellUrl.ts` | Чтение/запись `section` в URL |
| `shell/eliteewAdminShell.css` | Токены, sidebar, UGS embed |
| `shell/AdminShellSidebar.tsx` | Группированное меню, collapse, mobile drawer |
| `shell/AdminShellContentHeader.tsx` | Sticky top bar (`none` / `breadcrumb` / `full`) |
| `shell/AdminShellGate.tsx` | Loading / access denied |
| `shell/AdminSectionFrame.tsx` | Общие отступы контента |
| `shell/AdminSectionPanel.tsx` | Панель подраздела (вложенные карточки внутри раздела) |
| CSS `.eliteew-admin-hub-tabs` / `.eliteew-admin-summary-bar` | Табы и сводка в Users hub |
| `shell/adminShellLastSection.ts` | Последний раздел (localStorage / embedded sessionStorage); legacy `ugs` → `ugsV2` |
| `shell/useAdminShellNavBadges.ts` | Счётчики в sidebar (очередь обращений, social reports, онлайн) |
| `users/useAdminUsersHubController.ts` | Composer Users hub (filters / directory / bulk / shell subhooks) |
| `users/useAdminUsersHubFilters.ts` | Facade (&lt;400 LOC): chips / summary / filtersCtrl |
| `users/useAdminUsersDirectoryFilterState.ts` | Directory filter React state + snapshot / query |
| `users/useAdminUsersHubTablePrefs.ts` | Channels compact, table columns, auto-refresh (localStorage) |
| `users/useAdminUsersHubNamedPresets.ts` | Named filter presets (load/save/delete) |
| `users/adminUsersSummaryFilterApply.ts` | Pure helpers for summary-bar filter toggles |
| `users/adminUsersHubFiltersTypes.ts` | Public Users hub filters types |
| `users/adminUsersDirectoryQuery.ts` | Pure directory query / active-filter builders |
| `users/buildAdminUsersCatalogFiltersController.ts` | Assemble catalog filters panel controller |
| `users/AdminUsersCatalogToolbar.tsx` | Toolbar каталога Users |
| `users/AdminUsersActiveFilterChips.tsx` | Снимаемые чипы активных фильтров |
| `users/AdminUsersCatalogFiltersPanel.tsx` | Сворачиваемая панель фильтров каталога |
| `users/AdminUsersSummaryBar.tsx` | Сводка (total, онлайн, ⇄, subset counts) |
| `users/AdminUsersBulkActionsBar.tsx` | Массовый выбор / CSV / группа |
| `users/AdminUsersCatalogTable.tsx` | Таблица каталога + пагинация (desktop) |
| `users/AdminUsersCatalogCards.tsx` | Карточки каталога (viewport &lt; 768px) |
| `adminDirectoryUserTypes.ts` | Shared row type для Users hub, detail panel, CSV и diagnostics (не импортировать тип из facade/`adminUserDetail`) |
| `AdminUserDetailPanel.tsx` | Thin facade — stable import for Users hub slide-over |
| `EwDeskAdminSection.tsx` | Thin facade — stable import for EWDesk admin section (`ewDeskAdmin/`) |
| `ewDeskAdmin/` | EWDesk admin implementation: hook, edit form, media previews, AI polish (≤800 LOC per child) |
| `adminUserDetail/` | Detail panel implementation: hook + header + overview/store/ugs/sessions tabs (≤800 LOC per child) |
| `users/adminUsersFormatters.ts` | Shared date/name/user-agent formatters для каталога и detail panel |
| `users/useAdminUsersMobileCatalog.ts` | `matchMedia` для переключения table/cards |
| `users/useAdminUsersCatalogLiveRefresh.ts` | Периодический refetch каталога для live presence |
| `users/useAdminUsersRelativeTimeTick.ts` | Тик для «N мин назад» в ячейках каналов |
| `users/adminUsersFormatI18n.ts` | i18n formatters для channel cells |
| `users/AdminUsersChannelCells.tsx` | Ячейки каналов presence/SSO |
| `shell/AdminCommandPalette.tsx` | Ctrl+K: разделы + поиск пользователя |
| `users/adminUsersExternalOpen.ts` | Событие открытия Users из палитры / search (`search?` + `userId?`) |
| `content/ContentAdminSection.tsx` | Unified Admin hub: content ops overview, diagnostics, quota, processing failures |
| `content/contentAdminApi.ts` | Client for `/api/v1/desktop/admin/content-ops/*` |
| `kbsew/KbsewAdminSection.tsx` | KBSEW knowledge barrels: create, enable/disable, PDF ingest, status |
| `desktopAiChat/DesktopAiChatAdminSection.tsx` | Ассистент admin hub: defaults, templates, blueprint plans, diagnostics |
| `kbsewAdminApi.ts` | Client for `/api/v1/kbsew/*` (stack0 gateway) |

### Группы меню (SSOT: `ADMIN_SHELL_SECTIONS`)

1. **Операции** — `users`, `feedback`, `socialReports`, `surveys`, `content`
2. **Продукт** — `desktop` (App store), `professionalWorlds`, `ewdesk`, `ewaCompanion`, `siteStudio`
3. **UGS и AI** — `ugsV2` (единственная UGS-панель; legacy `ugs` → migrate), `assistant`, `search`, `musicForge`, `kbsew`, `desktopAiChat`, `gaf`
4. **Система** — `i18nRewrite`, `workers`, `platformOps` (stack0 line + Podman egress, read-only), `topology` (honest platform map cards + declared deps/events), `factory` (Gen/Forge intentions), `system` (health/cache/SSO console)

### Режим заголовка (`headerMode`)

- `breadcrumb` — краткая полоса «Админ / …» + описание (Пользователи, UGS, магазин, PW, EWA).
- `full` — заголовок и подзаголовок в top bar (Система, GAF, EWDesk, Обращения, Ассистент). Тело раздела **без** дублирующего `h2` — используйте `AdminSectionFrame`.
- `descriptionI18nKey` в `adminShellConfig` — подзаголовок из `desktopUi` (`assistantAdmin.subtitle`, `ewDeskAdmin.shellSubtitle`, …).

При смене раздела снимаются query-ключи других разделов: Users (`q`, `userId`, …) и Feedback (`ticket`).

### Observability

- `selectSection` → in-session `recordAdminShellSectionSelect` (Vitest: `adminShellNavTelemetry.test.ts`) + best-effort `POST /api/v1/desktop/admin/shell/section-select` → Prometheus `admin_shell_section_select_total{section,embedded}` (`desktop_admin_shell_telemetry.py`, `require_admin_user`).
- API allowlist `ADMIN_SHELL_SECTION_IDS` must include every FE `AdminSectionId` (incl. `platformOps`, `topology`, `factory`, `docEditor`); unknown ids → **400**. Lock: `tests/test_desktop_admin_shell_telemetry.py`.
- FE client: `shell/adminShellSectionSelectApi.ts` — debounce 400ms same key; network errors do not block nav (`section_select_post_skip` debug).
- Structured debug `admin_shell_section_select` `{ section, embedded, count }` (без email/user id).
- Sidebar badges: online Users, Feedback queue, open Social reports (`useAdminShellNavBadges`).
- No durable PG audit trail for section opens (metrics scrape only).

## Локальное состояние

- `eliteew.admin.sidebar_collapsed` — свёрнутый sidebar (миграция с `admin_sidebar_collapsed`).
- `eliteew.admin.lastSection.v1` — последний раздел при открытии без `?section=`.
- `eliteew.admin.embeddedSection.v1` (sessionStorage) — раздел в embedded-окне на столе.
- `eliteew.admin.users.filtersExpanded.v1` — раскрыта ли панель фильтров Users.

## Связанные каноны

- Admin New World design system + gap roadmap (Parallel Implementation & Trash Migration): `documentation/plans/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md` *[operator-local process plan; gitignored — not living canon]* — tokens/atoms in `pages/Admin/ui/`; shell root adds `eliteew-admin-ui` + loads `ui/tokens.css`; no shims to Old World chrome
- SSO / присутствие в Users: `documentation/platform/SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md`
- Assistant admin: `documentation/product/ewa/EWA-COMPANION-ADMIN-UI.md`
- Файловый менеджер admin hub: `documentation/product/CONTENT-MANAGER.md` (Observability)
- Platform ops (stack0 line + egress, read-only): `documentation/platform/docker-re_doc/ADMIN-PLATFORM-OPS.md`
- Workers ops: `documentation/platform/docker-re_doc/ADMIN-WORKERS-OPS.md`

## Smoke (оператор)

### Machine verify (nav / lazy / mount)

```bash
bash docker/scripts/unified-admin-shell-checklist.sh
# alias from shared/web/frontend:
pnpm run test:admin-shell
```

Locks: `ADMIN_SHELL_SECTIONS` ↔ `adminShellSmokeChecklist` ↔ `AdminSectionLazy` ↔ `UnifiedAdminPage.sectionMatrix` ↔ nav telemetry (+ URL migrate tests).
Checklist SSOT: `shared/web/frontend/src/pages/Admin/shell/adminShellSmokeChecklist.ts`.
PR gate: `.github/workflows/eliteew-pr-gate.yml` step **Unified Admin shell machine checklist**.

### Playwright (optional authenticated SPA)

Same contour as UGS admin queue-ops (storage + `DESKTOP_SHELL_E2E_RUN=1`):

```bash
# from shared/web/frontend — needs e2e/.auth/ugs-admin-storage-state.json
DESKTOP_SHELL_E2E_RUN=1 MC_E2E_BASE_URL=https://app.eliteew.ru \
  pnpm exec playwright test e2e/unified-admin-shell-nav.spec.ts
```

Bundled in `pnpm run test:e2e:desktop`. Without storage / gate env the suite **skips** (not fail). Deep links: `/?section=<id>#admin` for `users`, `workers`, `musicForge`, `ugsV2` + click swap users→workers (`aria-current`). Canon: `documentation/product/desktop/DESKTOP-SHELL-E2E-CI.md`.

**Live run blocker (command-center):** `e2e/.auth/` has no `ugs-admin-storage-state.json` until operator saves one via codegen (see DESKTOP-SHELL-E2E-CI). Without that file, Playwright correctly reports **skipped**, not green false-pass.

### Manual UI (shell)

1. Открыть админку (`admin` / `desktop-admin` или окно **Unified Admin** на столе).
2. Sidebar: 4 группы, collapse; не-embedded — `?section=system` в адресной строке.
3. Deep links (не embedded): `?section=workers`, `?section=musicForge`, `?section=desktopAiChat&aiChatTab=` — **Ассистент не подвкладка System**.
4. Legacy `?section=ugs` → активный `ugsV2`.
5. Смена раздела в sidebar → прокрутка контента вверх; in-session counter + backend Prometheus ingest + debug `admin_shell_section_select` (`count`).
6. **Ctrl+K** — палитра (разделы + поиск пользователя).
7. Badges: Users (online), Feedback (queue), Social reports (open).
8. Mobile (&lt;768px): гамбургер / overlay; в Users — cards вместо table.
9. Embedded-окно: URL **не** меняется; раздел в `sessionStorage` (`eliteew.admin.embeddedSection.v1`).

### Manual UI (Users hub, кратко)

1. Каталог без дублирующего `h2`; фильтр ⇄ mismatch (`mismatch=1` / сводка «⇄ на странице»).
2. Чипы фильтров, сворачиваемая панель, `/` → поиск, `Esc` → закрыть карточку.
3. Live presence refetch (~20 с; выкл. при auto-refresh 30 с); Redis banner если offline.
4. OpenAPI pilot `desktop.openapi.json`: `channel_mismatch_only`, `channel_mismatch_matching_total`.

### System section

- Только health API/DB, cache cleanup, Keycloak SSO console link.
- Не искать здесь Ассистент / Ensemble — отдельные разделы (`desktopAiChat` и связанные admin modules).
