# Desktop widgets and agenda — journey / contract (target)

**Status:** Living target canon (2026-08-19). **P3 locked** (D1–D6 = A). Waves **A–E landed**. Wave F (CalendarApp + events API) **locked and in implementation** — SoT [DESKTOP-CALENDAR-APP.md](DESKTOP-CALENDAR-APP.md).
**Planning / history:** `documentation/plans/product/desktop/DESKTOP-WIDGETS-ASSISTANT-PLAN-CALENDAR-PLAN.md` *[operator-local process plan; gitignored — not living canon]*. **This file wins** on product contracts if they diverge.
**Edition:** cloud / onprem Kernel chrome. Client/FoFline: same projection when companion-plans HTTP is available; otherwise honest disabled/empty — no fake local plan.

---

## 1. Intent

The widgets panel is a **live projection of Kernel and Assistant state on the wallpaper**, not a launcher of empty windows and not a second todo product.

User-visible outcome:

- Enabled slots **show data and allow the primary action** on the desktop.
- Tasks and goals are the **active Assistant plan** (`GET /api/v1/ewa/companion-plans/active`).
- Time is an **agenda of plan `due_date` values**, not a hollow calendar grid.
- App windows **cover** widgets; widgets **cover** icons/wallpaper; taskbar **covers** windows.

---

## 2. As-is failure (cause) — fixed in A–E

Historical failure (pre-lock):

1. **Stacking:** slot layouts set `z-index: DESKTOP_Z_INDEX.PANEL` (1100). Window frames use `desktopWindow.zIndex` from 1. Widgets always painted above apps.
2. **Expanded stub:** `mode === 'expanded'` rendered `ExpandedSlotPlaceholder` (copy + «open app»).
3. **Wrong task SoT:** panel todos used `desktop_widget_todos`. Assistant plans used EWA PG + companion-plans HTTP.
4. **No events API:** palette `calendar` is device date info.

Landed:

1. Widget panel uses `resolveDesktopWidgetPanelZIndex()` (40). Window layer uses `resolveDesktopWindowLayerZIndex()` (100).
2. Slot bodies are always live. Settings no longer expose compact/expanded per slot; `compact_widgets` is the density override. Persisted `mode` still maps expanded → roomy inline.
3. Default task UI is `assistant-plan` + `agenda` from `GET /companion-plans/active`. Legacy `todos` stays in the catalog, default **off**.
4. v1 time surface is agenda buckets, not a calendar grid.

---

## 3. Phase / state model

### 3.1 Panel visibility

| State | Condition | Persist |
|-------|-----------|---------|
| `off` | `show_widgets_panel !== true` and not tour | — |
| `tour-preview` | Welcome tour needs widgets example and panel is off | **Must not** PATCH `show_widgets_panel` |
| `on` | `show_widgets_panel === true` | `desktop_config` |
| `mobile-hidden` | compact/mobile workspace | no panel mount |

Floating widget (`desktop_floating_widget_visible`) is **independent**.

### 3.2 Slot density

A slot has one **functional body**. Density is compact vs roomy **row count / chrome**, never a different product (placeholder vs app).

Forbidden: expanded = only «Open in a separate window».

Allowed: optional footer **«Open …»** after the live body.

### 3.3 Task sources (precedence)

| Rank | Source | Role |
|------|--------|------|
| 1 | Active companion plan bundle | **SoT for goals/tasks** |
| 2 | Widget notes | Scratch text only |
| 3 | Legacy `widget-todos` | Not the plan; do not show as default task UI after Wave D |

If companion-plans probe is **disabled** (`404 companion_plans_disabled` or opaque 404 cached): **unmount** `assistant-plan` and `agenda` (do not leave a disabled stub as task UI), do not substitute widget-todos as if they were the plan.

If probe **enabled** and `plan == null`: empty state «Ask Assistant to make a plan» + CTA to EWA chat — not an error.

### 3.4 Agenda vs calendar

| Tier | What | When |
|------|------|------|
| **Agenda (v1)** | Open plan tasks grouped by `due_date` (overdue, today, upcoming, undated) | Waves E |
| **CalendarApp** | Persisted personal events, month/week grid **inside a window** | Wave F — [DESKTOP-CALENDAR-APP.md](DESKTOP-CALENDAR-APP.md) |
| **Docked Big Calendar** | Forbidden until Events API exists | Never in v1 widgets |

---

## 4. Information architecture

**Default enabled slots (P3 D5-A):**

`assistant-plan` · `agenda` · `notes` · `ewdesk` · `now-playing`

**Default off:** `favorites`, `notifications`, `project-shortcuts`, `recent-content`, legacy `todos`.

Settings remain the place to enable slots, corner, free vs stacked, per-workspace.

---

## 5. Surfaces (normative)

### 5.1 Stacking (Kernel)

1. Wallpaper + icon layer.
2. Widgets panel (canvas band).
3. **Window layer** — stacking context **above** widgets for every window z-index.
4. Taskbar / Start / shell overlays (`PANEL` and above) unchanged.

Widgets **must not** use `DESKTOP_Z_INDEX.PANEL`. Policy helper: `resolveDesktopWidgetPanelZIndex` / `WIDGET_PANEL_STACKING`.

Window layer **must** establish a stacking context greater than the widget band so a window with `zIndex: 1` still covers widgets.

### 5.2 Assistant plan slot

- Data: same bundle as EWA left rail.
- Show: plan title, FSM/progress, up to N open tasks, checkbox complete → `POST /companion-plans/tasks/{id}/complete`.
- Reuse `companionPlanStripUi` overdue/progress helpers — do not duplicate status English/Russian maps.
- Empty / disabled: honest copy, one CTA.

### 5.3 Agenda slot

- Input: open tasks with optional `due_date`.
- Output: buckets overdue / today / upcoming / undated. No month grid in v1.
- Click task: same complete or focus plan slot — not a fake calendar event editor.

### 5.4 Other slots

Each enabled slot’s compact body **must** show live content (existing previews: ewdesk headlines, now-playing transport, favorites links). Deep-link to the app is secondary.

### 5.5 Notes

Remain `widget-notes` + outbox. Never presented as Assistant goals.

---

## 6. Platform constraints (do not regress)

- No `amka_core` from `ewa_platform`.
- Companion-plans routes stay under `/api/v1/ewa`; desktop widget-sync stays `/api/v1/desktop/widget-sync`.
- Do not invent a second cloud topology.
- Do not ship Tauri Connection Agent with this work.
- Generated OpenAPI types for companion-plans; no hand-rolled DTO on the HTTP boundary.
- Tour preview must not persist panel on.

---

## 7. Failure / Edge-Case Matrix

| Axis | Contract |
|------|----------|
| **Offline** | Notes: existing outbox. Plan complete: no fake success if POST cannot run; keep checkbox unchecked; user-visible failure. Agenda uses last in-memory bundle. |
| **Dual-flag** | Tour preview vs live: preview wins visually, no persist. Plan disabled vs empty plan: different copy. Legacy todos vs plan: plan is task SoT. Compact-all vs per-slot mode: compact-all overrides density only, not enablement. |
| **Permission** | 401 on companion-plans: existing desktop auth recovery. 403: cannot complete; show why. Do not write plan tasks into `widget-todos`. |
| **Regression** | `pnpm exec vitest run src/pages/Desktop/utils/__tests__/desktopWidgetSurfacePolicy.test.ts src/pages/Desktop/components/desktopWidgetsPanel/__tests__/desktopWidgetSurface.source.contract.test.ts src/pages/Desktop/utils/__tests__/desktopWidgetLayoutUtils.test.ts src/pages/Desktop/utils/__tests__/welcomeTourWidgetsExampleLayout.test.ts`. Source lock: stacked/free layouts do not assign `DESKTOP_Z_INDEX.PANEL`. Plan/agenda bodies do not import `useWidgetTodos`. |

---

## 8. Implementation waves

Follow the process plan §7. **P3 locked. Waves A–E landed**. Wave F locked separately: [DESKTOP-CALENDAR-APP.md](DESKTOP-CALENDAR-APP.md).

---

## 9. Module sketch + lock paths

| Path | Contract |
|------|----------|
| `shared/web/frontend/src/pages/Desktop/utils/desktopWidgetSurfacePolicy.ts` | Stacking, slot kinds, density, task-source precedence, calendar tier |
| `shared/web/frontend/src/pages/Desktop/utils/__tests__/desktopWidgetSurfacePolicy.test.ts` | Locks below |
| `shared/web/frontend/src/features/ewa/companionPlanStripUi.ts` | Plan FSM / overdue — import, do not fork |

**Locks in policy tests:**

- Widget panel z-index is below window-layer floor and is not `PANEL`.
- `expanded` density is not `placeholder`.
- Task SoT for the desktop task widget is `companion-plan`, not `widget-todos`.
- Calendar v1 surface is `agenda`, not `third-party-grid`.
- Tour preview does not persist panel visibility.

---

## 10. Doc ownership (SoT vs plan vs peers)

| Doc | Role |
|-----|------|
| **This file** | Normative UX/API contracts for widgets + agenda |
| Process plan | Waves, decisions log |
| [DESKTOP-IMPLEMENTED-VS-STUB.md](DESKTOP-IMPLEMENTED-VS-STUB.md) | Rewrite rows when behavior lands |
| [DESKTOP-STATE-PERSISTENCE.md](DESKTOP-STATE-PERSISTENCE.md) | `widgets_layout`, widget-sync |
| [DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md](DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md) | Settings cards |
| [EWA-COMPANION-SERVER-PLANS-ADR.md](../ewa/EWA-COMPANION-SERVER-PLANS-ADR.md) | Plan HTTP / FSM |
| [ONBOARDING-AND-HOTKEYS.md](ONBOARDING-AND-HOTKEYS.md) | Tour must not persist panel |
