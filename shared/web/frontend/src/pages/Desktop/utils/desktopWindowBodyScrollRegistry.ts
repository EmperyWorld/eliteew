/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Legacy adapter: self-scroll appComponent Set derived from Shell App Registry (U1).
 * Prefer `shell/appRegistry` / `shell/shellScroll` for new code.
 *
 * Invariants:
 * - Membership = catalog entries with scroll.mode === 'self' (parity with former hand Set).
 * - ContentManagerPro / iframe launchers stay non-self (outer / outer_preview in catalog).
 *
 * Related:
 * - pages/Desktop/shell/appRegistry.ts
 * - pages/Desktop/shell/appRegistry.catalog.ts
 * - documentation/product/desktop/DESKTOP-SHELL-U1-APP-REGISTRY-DESIGN.md
 * - documentation/product/desktop/DESKTOP-CHROME-DECLUTTER-AND-SCROLL.md
 */

import '../shell/appRegistry.catalog';
import {
	isShellAppSelfScroll,
	listShellAppRegistrations,
} from '../shell/appRegistry';

/** `appComponent` values whose window body uses overflow-hidden (self-scroll). */
export const DESKTOP_APP_WINDOW_BODY_SELF_SCROLL: ReadonlySet<string> = new Set(
	listShellAppRegistrations()
		.filter((reg) => reg.scroll.mode === 'self')
		.map((reg) => reg.appComponent)
);

export function isDesktopAppWindowBodySelfScrollApp(
	appComponent?: string | null
): boolean {
	if (!appComponent) return false;
	return isShellAppSelfScroll('app', appComponent);
}
