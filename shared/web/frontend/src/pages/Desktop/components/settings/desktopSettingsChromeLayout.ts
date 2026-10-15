/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P6 Settings chrome layout: sidebar vs stacked tabs from **panel container width**,
 * not viewport media queries (narrow window on wide monitor must stay stacked).
 *
 * Invariants:
 * - Embedded mobile route always stacked.
 * - Unmeasured width (0) → stacked (fail-safe until ResizeObserver paints).
 *
 * Related:
 * - DesktopSettingsPanel.tsx
 * - documentation/product/desktop/DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md
 */

/** Min panel width before Settings uses the left nav rail (desktop chrome). */
export const DESKTOP_SETTINGS_SIDEBAR_MIN_WIDTH_PX = 640;

export function resolveDesktopSettingsTabsDesktopLayout(params: {
	panelWidthPx: number;
	embeddedMobileLayout: boolean;
	sidebarMinWidthPx?: number;
}): boolean {
	if (params.embeddedMobileLayout) return false;
	const min = params.sidebarMinWidthPx ?? DESKTOP_SETTINGS_SIDEBAR_MIN_WIDTH_PX;
	if (!(params.panelWidthPx > 0)) return false;
	return params.panelWidthPx >= min;
}
