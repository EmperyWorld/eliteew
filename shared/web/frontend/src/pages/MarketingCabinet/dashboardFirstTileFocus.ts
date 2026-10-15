/** Selector for the first keyboard-focusable control inside a dashboard tile (Wave 25 / L.115). */
export const MC_DASHBOARD_FIRST_TILE_FOCUSABLE_SELECTOR =
	'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Moves focus to the first focusable element inside `#mc-dashboard-first-tile`, or the tile root if it has `tabIndex={-1}`.
 * Used by the skip link so Tab order continues inside the first plitka instead of stopping on an inert wrapper.
 */
export function focusFirstInteractiveInDashboardFirstTile(): boolean {
	const root = document.getElementById('mc-dashboard-first-tile');
	if (!root) return false;
	const first = root.querySelector<HTMLElement>(
		MC_DASHBOARD_FIRST_TILE_FOCUSABLE_SELECTOR
	);
	if (first) {
		first.focus();
		return true;
	}
	if (root instanceof HTMLElement && root.tabIndex < 0) {
		root.focus();
		return true;
	}
	return false;
}
