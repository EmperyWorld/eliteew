# Companion: opening preloader

Source-backed desktop frontend contract · reviewed 2026-10-11. The EWA opening overlay is a visual persona sequence mounted for a fresh app instance. “Fresh” means its React instance was not opened from restored window state and is not embedded mobile; there is no persistent first-ever-opening flag.

## Mount and readiness

[EwaDesktopApp](../../../shared/web/frontend/src/features/ewa/EwaDesktopApp.tsx) computes `skipOpeningPreloader = openedFromSessionRestore || embeddedMobile`, initializes local dismissal from that value and lazy-loads the overlay through Suspense with null fallback. Focusing an existing instance does not restart its local sequence; closing and opening a new instance can. [Window snapshot restore](../../../shared/web/frontend/src/pages/Desktop/hooks/windowManagerRestoreSnapshot.ts) marks restored windows `openedFromSessionRestore: true`. A refresh skips the overlay only when the restored-window path actually supplies that flag.

Profile loading runs concurrently. `contentReady` is `gate !== 'loading'`, so readiness includes profile pick, error/unavailable and load-timeout screens, not only a successful profile. Once both the sequence and gate wait finish, the overlay schedules dismissal. With a skipped/dismissed overlay and a loading gate, the app renders its own skeleton/status. The visual overlay itself is `role=presentation`, `aria-hidden=true`, has no text, progress bar, quote or interactive controls, and uses `pointer-events:none`.

## Sequence and time

[Phase source](../../../shared/web/frontend/src/features/ewa/ewaOpeningPreloaderSequence.ts) defines:

1. `mela`, `zera`, `kora`, `tala`, `feni`, one by one: 560 ms each.
2. A veiled `arlika` + `arlika_v2` pair: 920 ms.
3. `parent` finale: 1280 ms.

The phase holds total 5000 ms. Non-final phases start fading 280 ms before advance. [Overlay implementation](../../../shared/web/frontend/src/features/ewa/EwaOpeningPreloader.tsx) holds the finale if profile gate is still loading, then waits for any remaining shared boot-preloader minimum and fades out over another 480 ms. Total visibility is therefore at least approximately 5480 ms under the full sequence, subject to timers, gate, module load and boot budget; 5 seconds is not a total loading deadline.

Reduced motion uses only the parent finale, held 720 ms, plus readiness/shared-budget wait and the 480 ms exit. [CSS](../../../shared/web/frontend/src/features/ewa/ewaOpeningPreloader.css) disables finale animations under the media query; the veiled pair is skipped. [Shared budget helper](../../../shared/web/frontend/src/utils/appPreloader.ts) reads `VITE_ELITEEW_PRELOADER_MIN_MS` (finite clamp 0–15000; nonfinite fallback 300), measured from the shared boot timestamp, and can be bypassed. It does not restart a private budget for each EWA window.

No live visual, animation-performance or assistive-technology acceptance is inferred from source or DOM unit tests. Changing reduced-motion preference during an in-progress sequence and unmounting while dismissal timers are scheduled need their own lifecycle checks; the existing selected tests do not exercise them.

## Verification and manual smoke

The existing phase-builder and visual-only component suites passed (four tests) within this iteration's 33-test frontend selection. The component test mocks reduced motion and shared budget and checks canvas/no progress/quote; it does not measure full timeline, readiness wait, restore routing or browser animation.

Manual smoke, not executed here: open a fresh EWA window, observe the daughter/pair/parent order, wait for gate resolution, then confirm dismissal to the appropriate gate screen. Restore that window through a saved snapshot and check the sequence is skipped; repeat embedded mobile. Under reduced motion verify parent-only rendering. Test a delayed/error profile response to distinguish readiness from success and total duration from nominal phase holds.

See [seed and onboarding matrix](EWA-COMPANION-SEED-PERSONA-MATRIX.md) and [profile contract](EWA-COMPANION-PROFILE-ADR.md).
