# EliteEW UX/UI Primitives Contract

**Status:** Canonical ownership contract
**Created:** 2026-05-29
**Scope:** Desktop shell, companion runtime, product workspaces and operator/admin surfaces

## Purpose

This document defines which UI primitive layer owns each kind of EliteEW surface. It prevents large UX waves from copying visual class stacks between products that have different behavior, palette and accessibility contracts.

## Ownership Matrix

| Surface family | Use first | Do not use for | Notes |
|----------------|-----------|----------------|-------|
| Desktop shell and normal app chrome | `DesktopAppChrome.tsx`, `DesktopAppSurface`, `DesktopAppPanel`, `DesktopAppButton`, `DesktopProductWorkspace`, `DESKTOP_APP_STYLE_CONTRACT` | Persona-specific EWA bubbles, raw admin evidence tables, product-local business forms | Owns focus ring, shell panels, window body controls, modal/menu surface, product workspace grammar and desktop app families. |
| App Store catalog/detail | App Store local components plus Desktop shell primitives | Product-specific runtime cards | Owns catalogue grid, detail overlays, install status, filters and store media fallback. |
| Assistant runtime | `companionPremiumPrimitives.tsx` (`CompanionGlassCard`, `CompanionPillButton`, etc.) | Admin/operator panels, non-companion products | Presentational only; consumes `--companion-*` persona tokens and must not dispatch actions or call APIs. |
| Professional Worlds runtime | `desktop/layout/*` (`ProfessionalWorldsWorkspacePanel`, `StatusBanner`, `FormField`, subtabs) | Generic Desktop shell overlays, EWA persona chrome | Owns profession workspace sections, CRM forms, AI rail and runtime addon panels. |
| Site Studio / Site Manager | Desktop shell primitives plus local Site Manager status helpers | EWA persona primitives | Normal user surfaces must use product labels; support exports may keep raw diagnostics. |
| Social Hub | Desktop shell primitives plus Friends feature components | Operator-only Site Manager patterns | Owns relationship cards, friend focus, report dialog, privacy/circle controls. |
| Unified Admin / operator tools | Admin feature primitives and Desktop shell surfaces where needed | User-facing companion/product cards | May show technical ids if labeled; raw values must be explained. |

## Global Rules

- Presentational primitives must not own API calls, routing, dispatch or mutation side effects.
- Product-specific primitives may depend on product tokens, but shared Desktop chrome must remain product-neutral.
- EWA runtime primitives consume `--companion-*` tokens. Admin EWA panels intentionally do not.
- Focus styling should ultimately route through the Desktop focus contract (`DESKTOP_CHROME_FOCUS_VISIBLE`) or a product wrapper that preserves equivalent visible focus.
- Primitive fallback copy lives in the `commonUi` i18n namespace. Product canons may override screen-specific labels, but shared primitives should not hardcode generic action/state labels.
- New shared primitives need tests when they encode behavior, focus, keyboard, aria role or state mapping. Pure class wrappers can be covered by the consuming component tests.

## Public Desktop Product Primitives

Import these from `shared/web/frontend/src/pages/Desktop/components/DesktopAppChrome.tsx`:

| Primitive | Contract |
|-----------|----------|
| `DesktopProductWorkspace` | Root frame for app-level header/toolbar/status/content/footer. Content region scrolls; header/status/footer do not. Default for App Store (page), GAF Chat, Assistant, Feedback Hub, Notifications window, Widget Shelf window (not Clipboard modal). |
| `DesktopProductHeader` | App or mode title, description, meta and primary actions. Use product copy, not raw route/component ids. |
| `DesktopProductStatusBanner` | Human-readable app or operation status with explicit tone. Support evidence belongs in a disclosure or support panel. |
| `DesktopProductStatePanel` | Shared empty/loading/error/offline/permission state with `commonUi` fallback labels. |
| `DesktopProductNextAction` | Guided “next step” card for post-create flows, setup, recovery and onboarding. |
| `DesktopShellRestrictedAppGate` | Shell-owned gate for window apps that require elevated access (`UnifiedAdminApp` today). Shows `DesktopProductStatePanel` loading/permissionDenied **before** app interior mounts; primary return path is **Close window** (`onRequestClose`). Registry: `desktopRestrictedAppAccess.ts`. Full-page `/admin` route still uses `AdminShellGate` inside Unified Admin. |

Product-local wrappers may compose these primitives, but must preserve visible focus, reduced-motion behavior and the `commonUi` fallback contract.

## Implementation References

- Desktop chrome: `shared/web/frontend/src/pages/Desktop/components/DesktopAppChrome.tsx`
- Shell restricted-app gate: `shared/web/frontend/src/pages/Desktop/components/DesktopShellRestrictedAppGate.tsx`, `…/utils/desktopRestrictedAppAccess.ts`
- Desktop visual system: barrel `shared/web/frontend/src/pages/Desktop/utils/desktopVisualSystem.tsx` + modules `…/desktopVisualSystem/*`
- Assistant primitives: `shared/web/frontend/src/features/ewa/companionPremiumPrimitives.tsx`
- Professional Worlds layout: `shared/web/frontend/src/features/professional-worlds/desktop/layout/`
- App Store: `shared/web/frontend/src/pages/Desktop/components/AppStore.tsx`
- Site Manager status helpers: `shared/web/frontend/src/features/site-studio/desktop/siteManagerUserStatus.ts`

## Review Checklist

Before adding or copying UI chrome:

- Identify the surface family from the ownership matrix.
- Prefer the local primitive layer before adding new classes.
- Keep behavior in hooks/services/components, not in presentational primitives.
- Verify focus and reduced-motion behavior if the primitive is interactive or animated.
- Add a product canon note when the primitive changes visible behavior or user copy.

## Relation To Global Roadmap

This contract implements the Design System foundation of `documentation/plans/product/ELITEEW-GLOBAL-UX-UI-ROADMAP.md` *[operator-local process plan; gitignored — not living canon]* (Required State Inventory + Wave register) and Wave 2 primitive ownership. Later waves should update this document only when primitive ownership changes, not for every component-level visual tweak.
