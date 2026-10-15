/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P7/P12 launcher primacy contract — three discovery surfaces keep distinct jobs
 * (not three full app catalogs). Launch still converges on `handleOpenWindow`.
 *
 * Invariants:
 * - Start = personalized apps / pins / workspaces (only surface with full app catalog).
 * - Quick Search = recents, files, and find-as-you-type.
 * - Command Palette = shell commands and actions (not a second Start catalog).
 * - App open commits a window immediately (no preload gate) — see useWindowManager.
 *
 * Related:
 * - hooks/useWindowManager.ts
 * - hooks/useDesktopWorkspaceAppLaunch.ts
 * - components/CommandPalette.tsx
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md
 * - documentation/product/desktop/DESKTOP-ONLY-NAV.md
 */

export const DESKTOP_LAUNCHER_ROLES = {
	start: 'personalized_apps_and_pins',
	quickSearch: 'recents_files_and_find',
	commandPalette: 'shell_commands_and_actions',
} as const;

/**
 * Wave 6: idle Quick Search may surface a short MRU app list after files, but
 * must not present a browsable installed-app catalog (Start-only).
 */
export const QUICK_SEARCH_IDLE_RECENT_APPS_CAP = 3;

export type DesktopLauncherSurface = keyof typeof DESKTOP_LAUNCHER_ROLES;

/** True when the surface may present a browsable installed-app catalog. */
export function launcherSurfaceAllowsAppCatalog(
	surface: DesktopLauncherSurface
): boolean {
	return surface === 'start';
}

/** True when open must not wait on dynamic-import preload before a window exists. */
export function desktopAppOpenCommitsBeforeChunkReady(): true {
	return true;
}
