# Desktop context menu (ПКМ) architecture

Living canon for EliteEW desktop shell context menus: menu families, native-browser leak model, policy contract, and remediation waves. Updated **2026-07-31**.

## Verdict

ПКМ is **not one handler**. It is **≥5 menu families** that share chrome (`DesktopAppMenuSurface`) and portal (`ShellPortalMount` / `useShellPortal` → `document.body`), but use **different state owners and action dispatch**. The browser native menu appears where there is **no** `preventDefault`, or where the event never reaches React (iframe / media controls), or where an **opt-out** clears the shell handler without a replacement.

Primary development friction is **duplicated window actions + string action sprawl + opt-out without replacement contract**, not a single forgotten button.

## Capture model

| Rule | Reality |
|------|---------|
| Global `document` `contextmenu` suppress | **Yes (MED)** — `useDesktopShellNativeContextMenuDeny` on `DesktopWorkspaceShellLayout` (capture, no `stopPropagation`) |
| Coordinates | Viewport `clientX`/`clientY`; menus portaled to `body` so UI scale (`transform` on `[data-desktop-ui-scale]`) does not drift |
| Editable allowlist | [`isBrowserContextMenuAllowedTarget`](../../../shared/web/frontend/src/pages/Desktop/utils/desktopUi.ts) — native paste/spellcheck on text fields |
| Escape hatch | `[data-desktop-allow-native-context]` — skip document deny (rare media/debug) |
| Policy helper (Wave B) | [`applyDesktopContextMenuPolicy`](../../../shared/web/frontend/src/pages/Desktop/utils/desktopContextMenuPolicy.ts) — allow native on editables, else `preventDefault` (+ optional `stopPropagation`) |

## Menu families

| Family | Entry | State | Dispatch | Portal |
|--------|-------|-------|----------|--------|
| Desktop bg / icons | `handleContextMenu` in `useDesktopWorkspaceIconInteractions` | `DesktopStateContext` (`showEnhancedContextMenu`, …) | string → `useDesktopWorkspaceHandleAction` | `EnhancedContextMenu` → `ShellPortalMount` |
| Window chrome | title / body / resize → `CustomEvent('desktop-window-context-menu')` | local `windowContextMenu` | direct props (`onMinimizeWindow`, …); shared IDs in `desktopWindowChromeActions.ts` | `DesktopWorkspaceWindowContextMenu` |
| Window text | selection / editable in body | local text menu state | copy/paste helpers | `EnhancedWindowTextContextMenu` |
| Taskbar strip / Start / win button | `Taskbar.tsx` handlers | local points | inline / shared chrome action IDs | `TaskbarShellContextMenus` |
| Tray / overflow icons | host sets `{ point }` | per-host | children items | `TaskbarIconContextMenu` |
| Folder / Start app / GAF / Quick Search | app-local openers | app-local | callbacks | various `ShellPortalMount` |

### Shift+ПКМ

**Not implemented.** Product KB and empty-desktop copy historically claimed an “extended” menu on Shift+right-click. Code has a **single** decluttered menu per surface (no `shiftKey` branch). User-facing copy and KB must not promise Shift+ПКМ until a product decision ships an implementation.

Dead path: `createContextMenuItems` previously had `case 'window'`; live window UX is `DesktopWorkspaceWindowContextMenu` + taskbar win menu. The Enhanced `window` branch is removed (Wave C).

## Native leak inventory

### HIGH (shell / product)

| Surface | Why native | Mitigation |
|---------|------------|------------|
| iframe (Local Service, Project About, Jitsi, PDF, Kirs, Marketing, Файловый менеджер, UnifiedContent) | Separate browsing context | `data-desktop-iframe-host` on parent chrome (Wave E + F SPA-wide inventory); inside frame remains native |
| Doc Editor / Marketing shell (`data-desktop-window-ignore-context`) | Early return without suppress | Policy: non-editable → `preventDefault`; editables / app menus keep their own handlers |
| Taskbar «…» / pinned-stack toggle with `data-taskbar-interactive` | Strip skips interactive targets | Controls open their own menu on ПКМ (same as click) |
| Window resize handles (react-rnd) | Outside body `section` handler | `Rnd` `onContextMenu` → window chrome menu |

### MED

| Surface | Notes | Status |
|---------|-------|--------|
| `<video controls>` / `<audio controls>` | Element `desktopMediaContextMenuProps` + document deny; some UA chrome may still win | Done (Wave E) — residual UA-only |
| Quick Search / Command Palette chrome | Panel `onContextMenu` + document deny | Done (MED) |
| Floating widget / hub inner buttons | Policy suppress first; custom menu only on non-inner chrome | Done (MED) |
| Notification hub rows | Same pattern as FW | Done (MED) |

### Still unfixable without product change

| Surface | Why |
|---------|-----|
| iframe **documents** (Local Service, About, Jitsi, PDF, and SPA-wide hosts) | Separate browsing context — parent cannot intercept. Parent hosts mark `data-desktop-iframe-host` (Wave F SPA inventory). Residual unchanged: inside-frame ПКМ stays native. |
| Some browser media chrome | UA UI may ignore page `preventDefault` even with element handlers |

### LOW / intentional

| Surface | Contract |
|---------|----------|
| `input` / `textarea` / `contenteditable` | Native via allowlist |
| Selection in window body (no ignore) | Custom text menu, not browser |

## Opt-out contract (HARD)

| Attribute | Meaning | Required replacement |
|-----------|---------|----------------------|
| `data-desktop-window-ignore-context` | Skip **window chrome** menu | App menu **or** policy suppress on non-editable (never silent allow native on chrome) |
| `data-taskbar-interactive="true"` | Skip **empty-strip** taskbar menu | Own `onContextMenu` with `preventDefault` (open host menu or suppress) |

## Architecture risks (why patches cascade)

1. Document capture default-deny (MED) + per-surface policy — new controls still need custom menus, but native leak is no longer the default.
2. Window actions duplicated: workspace WCM vs taskbar win menu (shared action ID registry reduces drift).
3. Enhanced path uses free-form action strings → typos fail silently in `default:` (typed IDs reduce this).
4. Three dismiss stacks (Enhanced controller, `useDismissibleFloatingMenu`, TaskbarIconCM).
5. Wide prop-drill through shell hook clusters for Enhanced menu wiring.

### Scaling forecast

| Horizon | Without Cause-fix | With policy + shared chrome actions |
|---------|--------------------|-------------------------------------|
| +1 tray control | Leak risk if `data-taskbar-interactive` without handler | Copy overflow pattern |
| +1 window action | 2+ files | Registry + both consumers |
| +1 ignore-context app | Chrome native until manual audit | Policy suppress by default |
| 12 months | Combinatorial menus × dismiss × portals | Shell policy + typed Enhanced actions |

## Remediation waves

| Wave | Status | Scope |
|------|--------|-------|
| **Measure** | Done (this doc) | Inventory + SSOT |
| **A** | Done | Taskbar interactive ПКМ, resize handles, ignore-context suppress, Start/NC panel suppress |
| **B** | Done | `applyDesktopContextMenuPolicy` + Vitest policy + inventory guard |
| **C** | Done | Shared `desktopWindowChromeActions`; Enhanced `window` branch removed; typed `EnhancedContextMenuActionId` |
| **MED** | Done | Document capture default-deny; FW/hub suppress-first; QS/Command Palette panel policy |
| **D** | Done | Per-site taskbar-interactive inventory; ignore-context suppress lock; portal+scale contract; windows-overflow ПКМ opens menu; KB index scrub |
| **E** | Done | Media element policy props; iframe host inventory (`data-desktop-iframe-host`); honest residual for iframe documents / UA media chrome |
| **F** (Wave 7 residual) | Done | SPA-wide iframe host inventory beyond `pages/Desktop/` (Kirs, Marketing Cabinet, Файловый менеджер, UnifiedContent, EWRP, UltimateDocEditor); Vitest walks `src/**/*.tsx`; honest residual unchanged — iframe **documents** remain native |

## Key paths

- Policy: `shared/web/frontend/src/pages/Desktop/utils/desktopContextMenuPolicy.ts`
- Document default-deny: `shared/web/frontend/src/pages/Desktop/utils/useDesktopShellNativeContextMenuDeny.ts`
- Embedded media / iframe host: `shared/web/frontend/src/pages/Desktop/utils/desktopEmbeddedSurfacePolicy.ts`
- Window chrome action IDs: `shared/web/frontend/src/pages/Desktop/utils/desktopWindowChromeActions.ts`
- Enhanced items: `…/enhancedContextMenu/createContextMenuItems.tsx`
- Handle action: `…/hooks/useDesktopWorkspaceHandleAction.ts`
- Window menu: `…/DesktopWorkspaceWindowContextMenu.tsx`
- Taskbar menus: `…/TaskbarShellContextMenus.tsx`, `…/TaskbarIconContextMenu.tsx`
- Floating widget ПКМ: `…/desktopWorkspaceFloatingWidget/helpers.ts` (`shouldOpenFloatingWidgetContextMenu`)

## Related

- [DESKTOP-IMPLEMENTED-VS-STUB.md](DESKTOP-IMPLEMENTED-VS-STUB.md) — living vs stub (ПКМ rows)
- [DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md](DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md) — portal + UI scale
- [DESKTOP-TASKBAR-ARCHITECTURE.md](DESKTOP-TASKBAR-ARCHITECTURE.md) — tray ПКМ
- Assistant KB: [kb-ikonki-setka-i-menyu.md](../handbook-kb-articles/kb-ikonki-setka-i-menyu.md) (no Shift+ПКМ promise)
