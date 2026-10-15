/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Schedule deferred Desktop runtime after the first critical paint without
 * starving hidden tabs or double-starting.
 *
 * Invariants:
 * - `requestIdleCallback` is not the only trigger; a max-delay fallback always fires.
 * - Cleanup cancels both idle callback and timeout.
 *
 * Related:
 * - `pages/Desktop/DesktopWorkspace.tsx`
 * - `documentation/platform/FRONTEND-BOOT-ORCHESTRATION.md`
 */

export const DESKTOP_DEFERRED_RUNTIME_MAX_DELAY_MS = 1_200;

export function scheduleDeferredDesktopRuntime(
	activate: () => void,
	maxDelayMs = DESKTOP_DEFERRED_RUNTIME_MAX_DELAY_MS
): () => void {
	let cancelled = false;
	let idleId: number | null = null;
	let timeoutId: number | null = null;

	const run = (): void => {
		if (cancelled) {
			return;
		}
		cancelled = true;
		if (idleId != null && typeof window.cancelIdleCallback === 'function') {
			window.cancelIdleCallback(idleId);
		}
		if (timeoutId != null) {
			window.clearTimeout(timeoutId);
		}
		activate();
	};

	if (typeof window.requestIdleCallback === 'function') {
		idleId = window.requestIdleCallback(run, { timeout: maxDelayMs });
	}
	timeoutId = window.setTimeout(run, maxDelayMs);

	return () => {
		if (cancelled) {
			return;
		}
		cancelled = true;
		if (idleId != null && typeof window.cancelIdleCallback === 'function') {
			window.cancelIdleCallback(idleId);
		}
		if (timeoutId != null) {
			window.clearTimeout(timeoutId);
		}
	};
}
