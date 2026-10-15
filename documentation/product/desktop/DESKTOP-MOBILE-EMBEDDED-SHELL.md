# Desktop mobile embedded shell map (Wave 4)

**Status:** living — Wave 4 Cause (2026-08-11) + Wave 5 embedded adoption.
**Edition:** cloud + client (MobileAndroid WebView `#/mobile-*` SPA pack).

## Purpose

Allowlisted hash journeys for the native embedded SPA host, and the rule that
**full Desktop shell chrome** (taskbar, Start, dual-header chrome) must not leak
into those routes.

## Allowlist (`MOBILE_EMBEDDED_JOURNEY_MAP`)

SSOT: [`shared/web/frontend/src/utils/mobileEmbeddedSpaRoute.ts`](../../../shared/web/frontend/src/utils/mobileEmbeddedSpaRoute.ts)
(`listMobileEmbeddedHashRoutes` + `MOBILE_EMBEDDED_JOURNEY_MAP`).

| Hash route | Journey |
|------------|---------|
| `mobile-ewa-companion` | Assistant chat |
| `mobile-handbook` | Assistant / docs reader |
| `mobile-social-hub` | Social Hub |
| `mobile-feedback-hub` | Feedback Hub |
| `mobile-notifications` | Notifications center |
| `mobile-content-manager` | Файловый менеджер |
| `mobile-ewdesk` | EWDesk |
| `mobile-professional-worlds` | Professional Worlds |
| `mobile-app-store` | App Store |
| `mobile-desktop-settings` | Desktop Settings Center (embedded panel only; no taskbar / window manager) |

Every journey sets `hidesFullShellChrome: true`.

## Full-shell-only chrome

| Mechanism | Path |
|-----------|------|
| Attr helper | `utils/desktopFullShellChrome.ts` → `data-desktop-chrome="full-shell-only"` |
| CSS hide | `mobileEmbeddedTheme.css`: `html:has([data-mobile-embedded-shell])` (and embedded-mobile) hides any marked control on the page |
| Render gate | `shouldRenderFullShellOnlyChrome(embeddedMobileLayout?)` |

**Wired dual-header mounts (Wave 4–5):** taskbar (`Taskbar.tsx`); Feedback Hub
(`FeedbackHubApp` + header); EWDesk (`EWDeskApp` + `EwDeskAppHeader`). Adoption lock:
`utils/__tests__/desktopFullShellChrome.adoption.contract.test.ts`. Prefer not rendering
when `embeddedMobileLayout` is known; CSS is defense-in-depth. Assistant keeps a compact
embedded header on purpose (not a desktop dual-header duplicate).

## Forbidden on embedded hosts

- Taskbar / Start menu / virtual-desktop strip / Welcome nudge chrome
- Full `DesktopWorkspaceContent` window manager (Settings embedded uses
  `embeddedMobileSettingsOnly` bridge instead)
- Desktop-only dual headers that duplicate native Android toolbar title

## Verification

```bash
cd shared/web/frontend
pnpm exec vitest run src/utils/__tests__/desktopFullShellChrome.test.ts \
  src/utils/__tests__/desktopFullShellChrome.adoption.contract.test.ts \
  src/pages/Desktop/components/__tests__/FeedbackHubApp.mobile-embedded.contract.test.ts \
  src/pages/Desktop/components/__tests__/EWDeskApp.dual-header.contract.test.ts
pnpm run test:desktop-shell-a11y
```

## Related

- [DESKTOP-SHELL-A11Y-CHECKLIST.md](DESKTOP-SHELL-A11Y-CHECKLIST.md) — Wave 4 budgets + matrix; Wave 5 Measure
- [DESKTOP-EMBEDDED-APPS-UX-NEXT.md](DESKTOP-EMBEDDED-APPS-UX-NEXT.md) — in-window app UX (different axis)
- [DESKTOP-KERNEL-OFFLINE-MOUNT-BRIDGE.md](DESKTOP-KERNEL-OFFLINE-MOUNT-BRIDGE.md) — SPA offline mounts (not mobile embedded)
