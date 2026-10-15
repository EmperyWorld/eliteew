/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Layout wake for desktop app window bodies: local geometry read always; optional
 * one-shot `window` resize only after Suspense settle / unminimize (not on boot thrash).
 *
 * Invariants:
 * - `scheduleAppWindowBodyLayoutSync` never dispatches synthetic `window` resize.
 * - `scheduleAppWindowContentSettledLayoutWake` dispatches resize at most once per flushKey.
 * - Layout reads run after paint via double `requestAnimationFrame`.
 *
 * Related:
 * - src/pages/Desktop/components/EnhancedWindow.tsx
 * - src/pages/Desktop/components/enhancedWindow/EnhancedWindowAppContent.tsx
 * - documentation/product/desktop/DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md
 */

/** Flush keys that already received a post-Suspense / restore resize wake this session. */
const contentSettledResizeFlushKeys = new Set<string>();

/**
 * After nested flex + lazy Suspense settle, read body geometry locally (no window resize fan-out).
 * Safe on every chrome size change / boot restore — does not wake global resize listeners.
 */
export function scheduleAppWindowBodyLayoutSync(
	el: HTMLElement | null | undefined
): void {
	if (!el || typeof window === 'undefined') {
		return;
	}
	window.requestAnimationFrame(() => {
		window.requestAnimationFrame(() => {
			void el.getBoundingClientRect();
		});
	});
}

function scheduleDeferredWindowResizeWake(): void {
	if (typeof window === 'undefined') {
		return;
	}
	window.setTimeout(() => {
		window.dispatchEvent(new Event('resize'));
	}, 0);
}

/**
 * Once per `flushKey` after nested app content mounts (Suspense settled) or after
 * restore-from-minimize: local geometry + deferred `window` resize so apps that
 * measure on resize (or wait for reflow) leave the forever-preloader state.
 *
 * Boot thrash avoidance: do **not** call this from EnhancedWindow mount for every
 * restored window — only from Suspense-settled children (staggered by chunk load)
 * or explicit unminimize.
 */
export function scheduleAppWindowContentSettledLayoutWake(
	flushKey: string,
	el: HTMLElement | null | undefined
): void {
	scheduleAppWindowBodyLayoutSync(el);
	if (!flushKey || typeof window === 'undefined') {
		return;
	}
	if (contentSettledResizeFlushKeys.has(flushKey)) {
		return;
	}
	contentSettledResizeFlushKeys.add(flushKey);
	scheduleDeferredWindowResizeWake();
}

/** Test / HMR helper — clears once-per-key resize wake bookkeeping. */
export function resetAppWindowContentSettledLayoutWakeForTests(): void {
	contentSettledResizeFlushKeys.clear();
}
