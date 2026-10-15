/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * FE-only desktop shell UX observability: structured debug events for offline
 * banner and sync conflict surfaces (no API / Prometheus), plus Wave 4 a11y
 * keyboard Tab budgets for Start / Settings.
 *
 * Invariants:
 * - recordDesktopShellUxEvent never throws into UI; failures are swallowed after log.
 * - Stable event names are the contract for Vitest spies and operator console filters.
 * - Keyboard budgets freeze measured Tab load (P19 Start primary All apps; Settings
 *   roving tablist → first tabpanel control).
 *
 * Related:
 * - `DesktopWorkspaceOfflineBanner.tsx`
 * - `DesktopSyncStatus.tsx`
 * - `startMenu/StartMenuTabStrip.tsx`
 * - `settings/desktopSettingsTablistKeyboard.ts`
 * - documentation/product/desktop/DESKTOP-SHELL-A11Y-CHECKLIST.md
 */

/**
 * Wave 4: max Tab presses from Start search/keyboard surface to the All-apps
 * primary open control (All apps is a primary strip tab, not behind More).
 */
export const START_ALL_APPS_MAX_TABS_TO_PRIMARY = 6;

/**
 * Wave 4: max Tab presses from the focused Settings tab (roving tablist) to the
 * first interactive control inside the active tabpanel.
 */
export const SETTINGS_TABS_MAX_TABS_TO_PRIMARY = 3;

/** 0-based index of All apps on the Start primary tab strip (Home=0, All=1). */
export const START_MENU_ALL_APPS_PRIMARY_TAB_INDEX = 1;

export type DesktopShellUxEventName =
	| 'desktop_shell_offline_banner_shown'
	| 'desktop_shell_offline_banner_retry'
	| 'desktop_shell_sync_conflict_shown';
export type DesktopShellUxEventDetail = Record<string, unknown>;

const lastEmitted = new Map<string, string>();

function transitionKey(
	name: DesktopShellUxEventName,
	detail?: DesktopShellUxEventDetail
): string {
	const kind =
		typeof detail?.kind === 'string'
			? detail.kind
			: typeof detail?.status === 'string'
				? detail.status
				: '';
	return `${name}:${kind}`;
}

/**
 * Emit a structured debug event. Debounces identical name+kind transitions so
 * remounts/re-renders do not spam the console.
 */
export function recordDesktopShellUxEvent(
	name: DesktopShellUxEventName,
	detail?: DesktopShellUxEventDetail
): void {
	try {
		const key = transitionKey(name, detail);
		if (lastEmitted.get(name) === key) {
			return;
		}
		lastEmitted.set(name, key);
		const payload = {
			event: name,
			ts: Date.now(),
			...(detail ?? {}),
		};
		console.debug('[desktop_shell_ux]', payload);
	} catch (err) {
		try {
			console.warn('[desktop_shell_ux] record_failed', err);
		} catch {
			/* metrics must never break chrome */
		}
	}
}

/** Test helper: clear debounce state between Vitest cases. */
export function resetDesktopShellUxMetricsForTests(): void {
	lastEmitted.clear();
}
