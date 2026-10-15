# Desktop API contract and app_component list

Канон по приложению **EWRP** (революционные презентации, лендинг, PDF): **`product/EWRP-REVOLUTIONARY-PRESENTATIONS.md`**.
Assistant (`EwaApp`, Ассистент): **`product/ewa/README.md`** — не путать с **Эксперты** (`DesktopAiChatApp`, ensemble chat).

## API base

All endpoints are under `/api/v1/desktop` (or project base). Auth: OAuth2/Keycloak (require_oauth2_user).

## Router modules (living)

Parent mount: `shared/api/routers/desktop.py` (re-exports + `KNOWN_DESKTOP_APP_COMPONENTS`). Children:

| Module | Responsibility |
|--------|----------------|
| `desktop_shell.py` | Aggregator for shell subtree |
| `desktop_shell_config.py` | Aggregator for config + shell-state routes (re-exports) |
| `desktop_shell_config_routes.py` | Theme/wallpaper `GET/POST/PATCH/PUT /config` |
| `desktop_shell_state_routes.py` | `GET/PATCH /shell-state` (ETag / field-etags); Wave C Prometheus SLI |
| `desktop_shell_state_sanitize.py` | `shell_state` JSON sanitizers (shared caps/helpers) |
| `desktop_shell_etag.py` | Weak ETag + stable digest helpers |
| `desktop_shell_proxy.py` | Local-service iframe proxy |
| `desktop_shell_bootstrap.py` | Shell bootstrap snapshot (`schema_version` 2+: includes shell-state + items; not full store catalog) |
| `desktop_store.py` | App Store, installed apps, EW billing |
| `desktop_widgets.py` | Widget notes/todos, dashboard favorites, Wave B `POST /widget-sync` |
| `desktop_calendar.py` | CalendarApp personal events `GET/POST/PATCH/DELETE /calendar/events` |
| `desktop_workspace.py` | Items / recents / bootstrap aggregator |
| `desktop_items.py` | Items CRUD (via workspace) |
| `desktop_recents.py` | Recent files / content feed |
| `desktop_bootstrap.py` | System folders, App Store icon ensure |

URL paths are stable; imports may use `from api.routers.desktop import …` (re-export). Structural canon: `platform/ATOMIC-ROUTER-DECOMPOSITION-CANON.md`.

## Endpoints

### Config

- **GET /desktop/config** — Returns `DesktopConfigResponse`: id, user_id, wallpaper, icon_size, show_widget, widget_position, theme, created_at, updated_at.
- **POST /desktop/config** — Create config (body: DesktopConfigCreate).
- **PATCH /desktop/config** — Partial update (DesktopConfigUpdate).
- **PUT /desktop/config** — Full replace.

### Items

- **GET /desktop/items** — Returns list of desktop items (id, item_id, item_type, name, position, color, gradient, is_pinned, app_component, parent_id, etc.).
- **POST /desktop/items** — Create item (DesktopItemCreate: item_id, item_type, name, position, color, gradient, is_pinned, app_component, parent_id).
- **PATCH /desktop/items/{item_id}** — Update item (DesktopItemUpdate).
- **PUT /desktop/items/{item_id}** — Replace item.
- **DELETE /desktop/items/{item_id}** — Delete item.
- **PUT /desktop/items** — Full replace of non-system desktop items for the current user. Frontend uses it as a committed snapshot, not as patch/upsert.

### Shell state

- **GET /desktop/shell-state** — Ephemeral UI state (`windows_snapshot`, MRU, widgets layout, …). Supports `If-None-Match` → **304**. Emits `desktop_shell_state_get_304_total` (Wave C).
- **PATCH /desktop/shell-state** — Merge top-level keys; `If-Match` + optional field-etags. **412** `desktop_shell_state_conflict` on same-key race. SLI: `desktop_shell_state_patch_total{result=ok|conflict_412|error}` + latency histogram (Wave C). Details: `DESKTOP-STATE-PERSISTENCE.md`.

### Widgets (notes / todos / favorites)

Per-entity CRUD (online happy-path) remains on:

- **GET/POST /desktop/widget-notes**, **PATCH/DELETE /desktop/widget-notes/{id}**
- **GET/POST /desktop/widget-todos**, **PATCH/DELETE /desktop/widget-todos/{id}**
- **GET/POST /desktop/favorites**, **DELETE /desktop/favorites/{id}**, **PATCH /desktop/favorites/reorder**

Wave B transactional batch (offline outbox flush):

- **POST /desktop/widget-sync** — body `{ ops: [...] }`; header **`Idempotency-Key`** required (8–128 chars). One Postgres transaction for the batch; Redis idempotency (fail-closed **503** if Redis down with key present). Response `{ results: [{ op_id, status: applied|skipped_lww|noop|error, … }] }`. Service: `api/services/desktop_widget_sync.py`. FE outbox: `desktopWidgetOutboxQueue.ts`. Persistence canon: `DESKTOP-STATE-PERSISTENCE.md` §Wave B.

### Calendar (personal events)

Canon: `DESKTOP-CALENDAR-APP.md`. Owner-scoped; other users' ids look like 404.

- **GET /desktop/calendar/events?from=&to=** — overlap list; max 93 days; 422 if `from >= to` or range too long
- **POST /desktop/calendar/events** — create (201)
- **PATCH /desktop/calendar/events/{id}** — update own
- **DELETE /desktop/calendar/events/{id}** — 204

Not companion-plans. Not a widget slot.

### Store and installed

- **GET /desktop/install-profile** — Active `ELITEEW_PRODUCT_EDITION` + install profile + sorted `enabled_app_components` (OAuth2). Schema **v2** also returns best-effort `ai_provider`, `ai_providers_allowlist`, `ai_eliteew_configured`. Misconfigured edition/profile → **503**. **FoFline** (`azp=empery-fofline`) overrides to profile **`fofline-connected`** (scoped surface; browser keeps env/`cloud-full`). FE: `getDesktopInstallProfile` / `useDesktopInstallProfileEnabledComponents` (+ `foflineConnectedSurface` fail-closed for `foflineNative`) filters Start/Taskbar/store lists and launch resolve.
- **GET /desktop/store** — Catalog of apps (from `desktop_app_catalog`): app_id, name, description, app_component, category, gradient, color, sort_order. Filtered by role/access **and** active install profile.
- **GET /desktop/installed** — List of app_id installed for current user.
- **POST /desktop/installed** — Mark app as installed (body: app_id); rejected if app_component not enabled for active profile.
- **DELETE /desktop/installed/{app_id}** — Uninstall app.

### Poemma workspace

- **GET /desktop/poemma/workspace** — Resolve current user workspace snapshot (`storage_payload`) and effective role (`owner|team|manager|smm|production`).
- **PUT /desktop/poemma/workspace** — Upsert full workspace snapshot from frontend repository (`storage_payload`, `payload_version`, optional `org_id`, `mutation`).
- **POST /desktop/poemma/workspace/import-local-backup** — One-time import of scoped localStorage backup (`backup.entries`) into server workspace.
- **PATCH /desktop/poemma/workspace/role** — Update **the caller's** membership `role` on the resolved workspace. Allowed only when the actor is the workspace `owner_user_id` **or** platform role is `admin` / `emperyworld_admin`. Non-owners receive **403** `poemma_forbidden_role_change` (no self-escalation to `owner`). Invalid role enum → **400** `poemma_invalid_role`.
- Mutation ACL is server-side in `api/services/poemma_service.py`: owner-only mutations are blocked for non-owner roles, team/manager/smm/production can mutate only allowed collaborative sections. Role PATCH ACL: `can_poemma_actor_change_role`.
- Non-owner **PUT /workspace**: after mutation ACL, `merge_poemma_storage_payload_for_role` merges only mutation-scoped storage namespaces (`initiatives`, `strategy`, `teamTasks`, `customer-path`, `happiness-signals`). Changing owner-protected namespaces (finance, org, channels, …) vs server snapshot → **403** `poemma_forbidden_owner_namespace`. Owner PUT remains full replace.
- **Finance plan fields (server-derived):** on mutation `saveFinanceSnapshot`, API overwrites each `…:finance:{periodId}` snapshot with authoritative `planPercent` / `planStatus` from matching `…:goal:{periodId}.targetProfit` and snapshot `profit` (`api/services/poemma_profit_plan.py`). Client-supplied plan percent/status are not trusted. FE `computePoemmaProfitPlanSummary` prefers server fields when present; otherwise falls back to local formula. Coverage: `api/tests/test_poemma_profit_plan.py`, Vitest `poemmaFinanceForm.test.ts`.
- DEV UI role switcher (`PoemmaDevRoleSelect`) is shown only when the same ACL mirror passes (`canChangePoemmaRoleOnServer`); server remains authoritative.

#### Poemma migration and ops verify (wave-3)

- Managed migration runner now includes POEMMA entries:
  - `api/migrations/applied/20260603_01_desktop_app_catalog_poemma.sql`
  - `api/migrations/applied/20260603_02_poemma_workspace_domain.sql`
- Operator path for anti-503 checks:
  1. `bash docker/scripts/apply-eliteew-migrations.sh`
  2. `bash poemma-workspace-db-verify.sh *[absent — historical DB verify helper]*
  3. Authenticated smoke for `/api/v1/desktop/poemma/workspace` should return `200` (not `503 db_schema_migration`).
- API contract coverage for this route family is in `api/tests/test_poemma_workspace_http.py`.

#### Frontend runtime UX notes (wave-1)

- `PoemmaApp` top bar shows actor role + 90-day period + live sync badge (`online`, `syncing`, `fallback-local`, `degraded`).
- Server sync failures are explicit for users: banner with retry action is rendered instead of silent local fallback.
- Workspace/home bootstrap now has explicit loading/error state panels with retry buttons.
- Wave-2 updates strategy/guide/period-close shells to the same UX grammar (hero panel, explicit loading state, clearer action grouping).
- Wave-3 applies the same grammar to finance/team/settings and removes silent `return null` loaders on remaining data pages (`goal`, `segments`, `happiness`, `ideas`, `promo`, `customer-path`, `onboarding`).

#### Frontend runtime UX notes (wave-4)

- Shared POEMMA UI kit lives in `shared/web/frontend/src/features/poemma/ui/` (`PoemmaPageShell`, `PoemmaPageHeader`, `PoemmaNavRail`, `PoemmaMetricBadge`, `PoemmaFilterTabs`, `PoemmaContextCard`, `PoemmaPageSection`, `PoemmaSectionTitle`, loading/error wrappers). Section chrome: readable `PoemmaSectionTitle` (accent marker), helper callout, optional `variant="framed"` body well on `PoemmaPageSection`.
- Wave-4 applies the kit to app/home shells, Ideas/Promo high-impact flows, and operational pages (`customer-path`, `happiness`, `onboarding`): consistent back-nav rail, hero hierarchy, metric badges, action rows, and explicit empty/loading states.
- Top-bar sync/period chips use `PoemmaMetricBadge` + `PoemmaStatusStack`; domain behavior and Russian text contracts unchanged (Vitest `src/features/poemma` gate).

#### Frontend runtime UX notes (wave-5)

- Wave-5 completes UI kit adoption on remaining owner/team pages: `finance`, `team`, `settings`, `goal`, `segments`, `strategy`, `guide`, `period-close`.
- Local back bars (`PoemmaFinanceBackBar`, `PoemmaStrategyBackBar`, `PoemmaTeamTabBar`) removed in favor of `PoemmaNavRail` + `PoemmaPageHeader`; `DesktopProductHeader` / `DesktopProductStatePanel` no longer used in POEMMA page shells.
- `PoemmaFilterTabs` supports optional `roleMode="tab"` for team task filters (ideas remain button role for Vitest contract).
- Shared tokens (`POEMMA_PAGE_PANEL_CLASS`, `POEMMA_TEXTAREA_CLASS`, `POEMMA_HERO_PANEL_CLASS`) replace page-local class duplicates.

#### Frontend runtime UX notes (wave-6)

- Shared map components: `PoemmaMapTile`, `PoemmaChecklistItem`, `PoemmaProgressBar`, `PoemmaProfitPlanFactRow` (extracted from finance).
- Contrast pass on kit tokens: hero/context gradients use desktop CSS variables only (no hardcoded `black`); `PoemmaMetricBadge` semantic tones use `color-mix` for light/dark shells; progress tracks and metric cells get inset borders for readability.
- Home map (`/`) uses map tiles + shared progress bars; guide block uses hero panel styling.

#### Frontend runtime UX notes (wave-7)

- Kit extended: `PoemmaEyebrowLabel`, `PoemmaFormField`, `PoemmaStepIndicator`, `PoemmaSemanticText`, `PoemmaListRow`, `PoemmaTopNavChip`, `PoemmaWizardFrame`, `PoemmaTopBar`, `PoemmaDevRoleSelect`; semantic tokens `POEMMA_SEMANTIC_*`, `POEMMA_FORM_GRID_CLASS`, `POEMMA_WIZARD_FOOTER_CLASS`.
- App shell: top bar and DEV role switcher extracted from `PoemmaApp.tsx` into kit; nav chips unified via `PoemmaTopNavChip`.
- **Wave 26+ shell atomization:** `PoemmaApp.tsx` stays the public Desktop entry (&lt;800 LOC). Route catalog / session helpers → `poemmaAppRouting.ts`; route switch + bootstrap/unauth panels → `PoemmaRouteBody.tsx`. Locks: `PoemmaApp.wave26-atomization.contract.test.ts`, `poemmaAppRouting.contract.test.ts`.
- Wizards: onboarding uses `PoemmaWizardFrame` + shared step indicator; guide/strategy alignment dots → `PoemmaStepIndicator`; period-close profit verdicts → `PoemmaSemanticText` (theme-safe, no raw `emerald`/`amber`).
- Full page sweep: all operational POEMMA screens use kit form fields, eyebrows, and list rows where applicable; Vitest `src/features/poemma` gate unchanged (130 passed).
- Layout (wave-7.1): `PoemmaPageShell` no longer caps content at `max-w-5xl`; wizard/guide panels and inline forms use full workspace width (modals keep dialog width).
- Premium polish (wave-8): elevated surfaces (inset ring, accent hero rail, interactive hover depth), glass top bar + nav track, section accent rules, `PoemmaPagePanel`, refined badges/progress/forms via shared tokens.
- Panel consistency (wave-8.1): all content panels use `PoemmaPagePanel` instead of inline `DesktopAppPanel` + `POEMMA_PAGE_PANEL_CLASS` (hero blocks keep `POEMMA_HERO_PANEL_CLASS`).
- Shell kit (wave-9): `PoemmaHeroPanel`, `PoemmaNoticePanel`, `PoemmaAccessDenied`, `PoemmaSoonPanel`; bootstrap/unauth/soon/ACL surfaces and hero blocks unified across app + pages.

## Frontend state model

- `useDesktopStorage` is the source of truth for server-backed `config` and `items`.
- `DesktopStateContext` keeps only UI-session state (selection, menus, modals, clipboard, recent files, etc.).
- `useDesktopInstalledApps` is the source of truth for install state and broadcasts install/uninstall invalidation so Store, Desktop, Start Menu and Taskbar do not drift. When install-profile is loaded, lists are also filtered by `enabled_app_components` (defense-in-depth over server store gate).
- App Store catalog install UX (progress bar, per-card errors, modal busy guard) lives in `shared/web/frontend/src/pages/Desktop/components/appStore/` — see `product/desktop/DESKTOP-APP-STORE.md`.

## app display names (SSOT)

**Source of truth:** `desktop_app_catalog.name` and `desktop_app_catalog.description` (admin App Store catalog). One string for all UI locales (RU-first product); no separate `name_en` in this contract. **Authoring (2026-09-13):** agent writes EN in `locales/en/appStore.json`; Gemma `ui-ru` writes **Mode 1 STRICT UI ENGINE** RU (`eliteew-localization-engine`) into `locales/ru/appStore.json`. Catalog DB follow-up: `applied/20260915_01_desktop_app_catalog_descriptions_mode1.sql` (live SSOT stays RU-first). `20260913_01` is already in prod `schema_migrations` (first rewrite).

| Surface | How name is resolved |
|---------|----------------------|
| App Store / Start / installed list | `GET /desktop/store` → FE keeps catalog strings; `localizeDefaultDesktopAppCatalog*` **does not** overwrite non-empty store names with `appStore.defaultApps` i18n |
| Desktop icons (`type=app`) | `GET /desktop/items` runs `reconcile_desktop_app_item_names_from_catalog` — `desktop_items.name` synced to catalog by `item_id = app_id` |
| Offline / empty name | `DEFAULT_APPS` + i18n `defaultApps.*` as fallback only |

Operator edits names only in catalog admin; users see the same label in Start, store, and icons after refresh.

## app_component matrix (backend + frontend)

`app_component` validation / launch registry (separate from display-name SSOT above):

- **Backend catalog validation:** `KNOWN_DESKTOP_APP_COMPONENTS` from `api/services/desktop_app_manifests` (re-exported by `shared/api/routers/desktop.py`) — **SoT:** `shared/apps/*/app.manifest.yaml` ∪ `shared/apps/_legacy/known_desktop_app_components.legacy.json`. Validate: `bash scripts/eliteew/validate-app-manifests.sh`. See `shared/apps/README.md`.
- **Frontend launch registry:** `DEFAULT_APPS` + `KNOWN_DESKTOP_APP_COMPONENTS` in `shared/web/frontend/src/pages/Desktop/*`.

### Backend-validated `app_component` (catalog API)

Source (2026-08): loader union above. Manifest-backed: see `shared/apps/README.md` (includes **`kursorina` / `KursorinaApp`** — investigation worker; SoT `documentation/product/desktop/KURSORINA.md`). Remaining heavy/legacy-hidden ids in `_legacy/known_desktop_app_components.legacy.json` — migrate when touching the module.

Do **not** hand-edit a frozenset in `desktop.py`.

### Frontend-known launch components (shell/UI level)

**Wave F1:** FE `KNOWN_DESKTOP_APP_COMPONENTS` = API union from `shell/knownDesktopAppComponents.generated.json` (written by `bash scripts/eliteew/validate-app-manifests.sh`) **∪** `SHELL_ONLY_DESKTOP_APP_COMPONENTS` in `shell/desktopKnownAppComponents.ts`. Re-exported from `utils/desktopAppRegistry.ts`.

Shell-only / FE launch ids (no manifest yet):

- `DesktopShellSettings` (ephemeral settings window).
- `DesktopWidgetShelfApp`, `DesktopDashboardFavoritesApp`.
- `ProfessionalWorlds`, `EmperyNexusChronicleApp`, `SiteManagerOps`.
- `DesktopAppMaintenance` (store tech screen).

**Mount catalog:** `shell/appMounts.registry.ts` (`APP_MOUNTED_COMPONENTS` + `APP_UNMOUNTED_COMPONENTS`); implementations in `shell/appMounts.resolve.tsx`; thin entry `components/desktopWindowAppContent/renderDesktopWindowAppContent.tsx`. Parity lock: `shell/__tests__/appMounts.parity.test.ts`.

**Factory DoD (Wave F2):** `bash scripts/eliteew/verify-app-factory.sh <manifest_id>` — gates D1 (UI quality / no scaffold stub), D2 (mount registry + resolve case + U1 catalog), D3 (manifest + API KNOWN). Canon: [ELITEEW-GENEW-FACTORY-HARVEST.md](../../platform/ELITEEW-GENEW-FACTORY-HARVEST.md) §8.1.

**Install-profile launch gate:** client filter (`desktopInstallProfileFilter.ts`) must **not** block shell-only ids above — they are never in `enabled_app_components` from `/desktop/install-profile`. Exempt set: `isInstallProfileExemptAppComponent` (`DesktopShellSettings`, `DesktopAppMaintenance`, `DesktopWidgetShelfApp`, `DesktopDashboardFavoritesApp`). Without the exemption, Settings Center / Start gear silently no-op after profile load.

### Legacy hidden components

Catalog may still **validate** legacy ids that the shell **hides** from launch/store UI (`LEGACY_HIDDEN_DESKTOP_APP_COMPONENTS` / ids in `desktopAppRegistry.ts`):

- Frontend hidden (no replacement): `VoiceCommand`, `VoiceStudio`, `AudioTranscriptionPro`, `FriendsApp`, `UserProfile`, `Analytics`, `SystemMonitorWidget`.
- Frontend remap (persisted icons / shell windows): `EliteChat`, `ArlyQueenChat`, `app-chat` → `GAFChatApp` / `app-gaf-chat`.
- Backend cleanup: `_cleanup_legacy_desktop_state` + `api/services/desktop_app_component_legacy.py` (same remaps).
- **Do not** treat “in `KNOWN_DESKTOP_APP_COMPONENTS`” as “shown in Start Menu” — check the hidden set.

Архитектура, контент API и оптимизации UI **музыкального плеера:** **`product/desktop/DESKTOP-MUSIC-PLAYER.md`**.

## Deep link

- Event `desktop-open-app` with `detail: { appComponent: string }` opens the app in a new window. Resolution goes through the centralized desktop app registry (`resolveDesktopAppLaunchItem` / `find` / `canDisplay`) so deep links, voice commands, Start Menu, **App Store Open**, and desktop icons follow the same install/system rules. **P8 (2026-07-28):** resolve order is desktop shortcuts → **installed catalog** → `DEFAULT_APPS` (icons-only lookup is insufficient). Legacy `pendingOpen` peeks until installed apps finish loading.
