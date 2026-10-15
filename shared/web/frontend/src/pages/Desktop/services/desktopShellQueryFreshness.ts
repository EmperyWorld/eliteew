/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared React Query staleTime aligned with GET /desktop/shell-bootstrap hydrate
 * so cold `#desktop` callers do not re-GET seeded slices within the boot window.
 *
 * Invariants:
 * - Keep ≥ typical cold shell settle (auth + content + restore); mutations still invalidate.
 * - Used by Auth / Preferences / NotificationCenter / GAF / friends / installed hooks.
 *
 * Related:
 * - services/desktopShellBootstrap.ts
 * - documentation/platform/FRONTEND-TOOLCHAIN-AND-BUILD.md
 */

/** Bootstrap-seeded profile / prefs / notif / friends / installed / GAF me. */
export const DESKTOP_SHELL_BOOTSTRAP_STALE_MS = 120_000;

/** GAF chat list — shorter than me; socket invalidation remains the live path. */
export const DESKTOP_SHELL_GAF_CHATS_STALE_MS = 90_000;

/** App Store catalog (not in bootstrap) — avoid remount refetch on idle desktop. */
export const DESKTOP_SHELL_STORE_CATALOG_STALE_MS = 120_000;
