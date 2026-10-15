# UI Components — canonical and legacy

Reference for which UI components to use in new EliteEW SPA code (`shared/web/frontend/src/components/ui/`) and which are kept for compatibility only. Not an operator/DEWA surface.

Developer entry: [FRONTEND-DEVELOPER-ENTRY.md](FRONTEND-DEVELOPER-ENTRY.md). Auth/modals that need focus trap: prefer **ModalAdvanced** with the Keycloak login fallback patterns in [FRONTEND-AUTH.md](FRONTEND-AUTH.md).

## Canonical components (use these)

- **ButtonV2** — `@/components/ui/Button` (default export and `ButtonV2`)
- **ModalAdvanced** — `@/components/ui/ModalAdvanced` — for all new modals (focus trap, Escape, aria). Prefer over Modal/ModalV2. Desktop variant: `variant="desktop"` + shell frame tokens; optional **`contentClassName`** on the scrollable body (e.g. `overflow-hidden flex flex-col` when the child owns its own scroll, as in **`WallpaperPicker`**). Do **not** use ultra-transparent `glass` (`bg-white/5`) for dialogs over the desktop — unreadable; `glass` is a denser color-mix fallback, and **`ConfirmDeleteModal`** defaults to **`desktop`**.
- **ConfirmDeleteModal** — `@/components/ui/modals/ConfirmDeleteModal` — destructive confirm; default **`variant="desktop"`** (opaque shell panel). Pass `solid` / `default` only outside `#desktop-main` without shell tokens.
- **InputV2** — `@/components/ui/Input`
- **RetryBlock** — `@/components/ui/RetryBlock` — error state with retry action
- **EmptyState** — `@/components/ui/EmptyState` (primitives API: icon, title, description, actionLabel, onAction)
- **EmptyStateBlock** — `@/components/ui/EmptyStateBlock` — simpler empty state (icon as ReactNode, action as ReactNode)
- **TooltipV2** — `@/components/ui/TooltipV2` — tooltips for icon-only buttons and hints. Process-wide **`tooltipCoordinator`** enforces a single visible tooltip, pointer-integrity recovery when `pointerleave` is lost (Linux/XFCE Chromium, Quest), and global dismiss on scroll/blur/visibility. Desktop shell mounts **`useDesktopHoverChromeSafetyNet`** on `#desktop-main`. Default trigger wrapper is **`inline-flex`** (fine for taskbar/buttons). In **CSS Grid / equal-width flex rows**, pass **`fullWidth`** so the trigger is **`block w-full min-w-0`** — otherwise grid tracks collapse (see **`WallpaperPicker`** + **`DesktopChromeTooltip fullWidth`**).

See also: loading/error/empty/modal guidelines are consolidated in this document and in component-level docs under `@/components/ui/*`.

## Legacy (backward compatibility only)

- **Modal**, **ModalV2** — `@/components/ui/Modal`. For new dialogs use **ModalAdvanced**. Modal/ModalV2 are not removed but should not be used in new features.
- **ButtonAdvanced** — if present in the codebase, prefer **ButtonV2** for new code.

Do not remove legacy components in this phase; use them only when touching existing code that already depends on them.
