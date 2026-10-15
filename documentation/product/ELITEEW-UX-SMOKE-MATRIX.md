# EliteEW UX Smoke Matrix

**Status:** living regression matrix for global UX waves (ops companion to `documentation/plans/product/ELITEEW-GLOBAL-UX-UI-ROADMAP.md` *[operator-local process plan; gitignored — not living canon]*; not a product feature hub).  
**Created:** 2026-05-29  
**Scope:** Focused text, accessibility and support-export guards for global UX/UI waves

## Purpose

This matrix lists the high-signal smoke checks used by the global UX/UI program. It complements product canons by keeping test commands and evidence targets in one short operational view.

## Matrix

| Area | Guard | Evidence |
|------|-------|----------|
| Desktop shell chrome | Legacy app/window titles are normalized before titlebar, taskbar and switcher display. | `pnpm exec vitest run src/pages/Desktop/utils/__tests__/desktopDefaultAppUserFacingCopy.test.ts src/pages/Desktop/utils/__tests__/desktopWindowDisplayTitle.test.ts` |
| EWA operations | Backend/SSE aliases such as `in_progress`, `processing`, `success`, `errored` normalize to user-facing operation states. | `pnpm exec vitest run src/features/ewa/companionOperations/__tests__/companionOperationsUi.progress.test.ts src/features/ewa/companionOperations/__tests__/CompanionOperationRunCard.image.test.tsx src/features/ewa/companionOperations/__tests__/CompanionOperationsPanel.test.tsx` |
| Site Manager | Primary UI translates audit actions/job labels while support export keeps diagnostic ids. | `pnpm exec vitest run src/features/site-studio/desktop/__tests__/SiteManagerOpsPanel.test.tsx src/features/site-studio/desktop/__tests__/siteManagerUserStatus.test.ts` |
| Site Studio journey | Publish readiness exposes admin review before public launch when admin shell is ready. | `pnpm exec vitest run src/features/site-studio/desktop/__tests__/siteStudioUserJourney.test.ts src/features/site-studio/desktop/__tests__/SiteStudioJourneyComponents.test.tsx` |
| Social Hub | Friend card exposes a named relationship action-center region and next-step buttons. | `pnpm exec vitest run src/features/friends/components/__tests__/FriendPersonCard.test.tsx` |
| Professional Worlds | Active listing context is a named region and next-step buttons preserve linked listing id. | `pnpm exec vitest run src/features/professional-worlds/desktop/runtimePanels/RealtorObjectsWorkspacePanel.test.tsx` |
| Cross-app handoff | One-shot Professional Worlds draft keys only reach supported consumer apps and never persist to window snapshots. | `pnpm exec vitest run src/pages/Desktop/utils/__tests__/desktopOpenPayloads.test.ts src/pages/Desktop/utils/__tests__/sanitizePersistedDesktopWindowPayload.test.ts` |
| Android Friends parity | Mobile Friends uses the same relationship action-center priority as desktop. | `./gradlew :feature:friends:testDebugUnitTest` from `pack-cloud/mobile/` |

## Browser Smoke Candidates

Use browser automation only for high-value flows that cannot be proven from component tests:

- Desktop shell: open Start, search a normalized app name, open it and confirm the titlebar/taskbar label matches.
- Site Manager: open selected site drilldown, run publication check, copy support summary and confirm raw ids stay only in the clipboard/export text.
- Social Hub: open **Связи** / Connections — sidebar shows Home / People / Privacy / Phone (no «live showcase» header badge); notification with `tab=inbox` lands on People → Requests; home KPI row is single-layer (not duplicated in header).
- Social Hub: open a friend card, navigate relationship action center → Shared → Privacy with keyboard focus visible.
- Professional Worlds: select saved listing, click active context Deal / client, confirm the client capture surface receives the listing id.

## Update Rules

- Add a row when a new UX guard becomes reusable across waves.
- Keep matrix commands focused; full production builds remain the final frontend gate.
- Do not include private user content in browser smoke assertions; use labels, ids and synthetic fixtures.
