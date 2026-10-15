/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EBrowser chrome sync timing — adaptive poll + bounds debounce constants.
 *
 * Invariants:
 * - Idle must not use aggressive sub-second triple IPC (Wave P).
 * - Burst after user/nav actions; slower when document hidden.
 *
 * Related:
 * - documentation/reference/solution-readiness/2026-09-10-ebrowser-chrome-perf-wave-p.md
 * - pages/Desktop/apps/EBrowserApp.tsx
 */

/** Fallback poll when focused and no recent burst (ms). */
export const EBROWSER_CHROME_IDLE_POLL_MS = 4000;
/** Fast poll window after open/navigate/tab/reload (ms). */
export const EBROWSER_CHROME_BURST_POLL_MS = 500;
/** How long burst mode stays active after an action (ms). */
export const EBROWSER_CHROME_BURST_WINDOW_MS = 2500;
/** Fallback when document.hidden (ms). */
export const EBROWSER_CHROME_HIDDEN_POLL_MS = 12_000;
/** ResizeObserver → set_bounds debounce (ms). */
export const EBROWSER_BOUNDS_DEBOUNCE_MS = 80;

export function ebrowserChromePollIntervalMs(args: {
	hidden: boolean;
	burstUntilMs: number;
	nowMs: number;
}): number {
	if (args.hidden) return EBROWSER_CHROME_HIDDEN_POLL_MS;
	if (args.nowMs < args.burstUntilMs) return EBROWSER_CHROME_BURST_POLL_MS;
	return EBROWSER_CHROME_IDLE_POLL_MS;
}

export function ebrowserBoundsEqual(
	a: { x: number; y: number; width: number; height: number } | null,
	b: { x: number; y: number; width: number; height: number } | null
): boolean {
	if (!a || !b) return false;
	return (
		a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
	);
}

export function ebrowserDownloadsFingerprint(
	items: Array<{
		id: number;
		phase: string;
		progress: number;
		contentId?: string;
	}>
): string {
	return items
		.map(
			(d) =>
				`${d.id}:${d.phase}:${Math.round(d.progress * 1000)}:${d.contentId ?? ''}`
		)
		.join('|');
}

export function ebrowserTabsFingerprint(
	tabs: Array<{ id: number; active: boolean; href: string }>,
	maxTabs: number
): string {
	return `${maxTabs}|${tabs.map((t) => `${t.id}:${t.active ? 1 : 0}:${t.href}`).join(';')}`;
}
