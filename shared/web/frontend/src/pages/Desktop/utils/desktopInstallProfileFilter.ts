/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure filters for Desktop Start/catalog rows against install-profile
 * `enabled_app_components` (defense-in-depth over server store gate).
 *
 * Invariants:
 * - `enabled == null` → no client filter (profile loading / unavailable).
 * - Empty Set → hide pack apps (fail closed when profile resolved empty).
 * - Shell-only / FE launch ids (not in install profiles) stay launchable.
 *
 * Related:
 * - `services/desktopApi/installProfile.ts`
 * - `hooks/useDesktopInstalledApps.ts`
 * - `documentation/platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md` §6
 * - `documentation/product/desktop/DESKTOP-API-AND-APPS.md` §Frontend-known
 */

import type { DesktopItem } from '../types/desktop.types';

type StoreAppRow = {
	app_component: string;
};

/**
 * FE/shell launch components that are never listed in install-profile
 * `enabled_app_components` (no EliteEW/apps manifest). Must not be blocked by
 * the client pack gate — otherwise Settings Center / maintenance never open.
 */
const INSTALL_PROFILE_LAUNCH_EXEMPT = new Set([
	'DesktopShellSettings',
	'DesktopAppMaintenance',
	'DesktopWidgetShelfApp',
	'DesktopDashboardFavoritesApp',
]);

export function isInstallProfileExemptAppComponent(
	appComponent: string | null | undefined
): boolean {
	return (
		typeof appComponent === 'string' &&
		INSTALL_PROFILE_LAUNCH_EXEMPT.has(appComponent)
	);
}

/**
 * When `enabled` is null, return input unchanged (profile not ready).
 */
export function filterStoreAppsByInstallProfile<T extends StoreAppRow>(
	apps: T[],
	enabled: ReadonlySet<string> | null
): T[] {
	if (enabled == null) return apps;
	return apps.filter((app) => enabled.has(app.app_component));
}

/**
 * Filter Start/Taskbar DesktopItem rows by `appComponent`.
 */
export function filterDesktopItemsByInstallProfile(
	items: DesktopItem[],
	enabled: ReadonlySet<string> | null
): DesktopItem[] {
	if (enabled == null) return items;
	return items.filter((item) => {
		const comp = item.appComponent;
		if (!comp) return false;
		if (isInstallProfileExemptAppComponent(comp)) return true;
		return enabled.has(comp);
	});
}

/**
 * Launch gate: unknown/missing component denied when profile is loaded.
 * Shell-only ids are exempt (see INSTALL_PROFILE_LAUNCH_EXEMPT).
 */
export function isAppComponentEnabledByInstallProfile(
	appComponent: string | null | undefined,
	enabled: ReadonlySet<string> | null
): boolean {
	if (enabled == null) return true;
	if (!appComponent) return false;
	if (isInstallProfileExemptAppComponent(appComponent)) return true;
	return enabled.has(appComponent);
}
