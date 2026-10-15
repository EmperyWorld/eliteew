/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * FE Desktop KNOWN set = API generated union + shell-only launch components.
 *
 * Invariants:
 * - Do not hand-edit knownDesktopAppComponents.generated.json — run
 *   `bash scripts/eliteew/validate-app-manifests.sh`.
 * - Shell-only ids are never in install-profile enabled lists (see exempt filter).
 *
 * Related:
 * - utils/desktopAppRegistry.ts
 * - shell/appMounts.registry.ts
 * - api/services/desktop_app_manifests/loader.py
 */

import generated from './knownDesktopAppComponents.generated.json';

/** Launchable shell chrome / FE-only apps (no EliteEW/apps manifest yet). */
export const SHELL_ONLY_DESKTOP_APP_COMPONENTS = [
	'DesktopShellSettings',
	'DesktopAppMaintenance',
	'DesktopWidgetShelfApp',
	'DesktopDashboardFavoritesApp',
	'EmperyNexusChronicleApp',
	'SiteManagerOps',
] as const;

const apiKnown = generated.app_components as readonly string[];

export const API_KNOWN_DESKTOP_APP_COMPONENTS: ReadonlySet<string> = new Set(
	apiKnown
);

export const KNOWN_DESKTOP_APP_COMPONENTS: ReadonlySet<string> = new Set([
	...apiKnown,
	...SHELL_ONLY_DESKTOP_APP_COMPONENTS,
]);
