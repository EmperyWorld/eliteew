/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared helpers for static and React preloaders with a configurable minimum display time.
 *
 * Invariants:
 * - Global boot budget: one `VITE_ELITEEW_PRELOADER_MIN_MS` window from first paint across static HTML, Keycloak, desktop storage, and lazy route fallbacks.
 *
 * Related:
 * - `index.html`
 * - `public/preloader-fallback.js`
 */

declare global {
	interface Window {
		__ELITEEW_PRELOADER_STARTED_AT?: number;
		__REACT_APP_LOADED?: boolean;
	}
}

const DEFAULT_PRELOADER_MIN_MS = 300;

let preloaderMinBudgetBypassed = false;

/** Skip remaining min display when auth restored quickly (returning user). */
export function bypassPreloaderMinBudget(): void {
	preloaderMinBudgetBypassed = true;
	if (typeof document !== 'undefined') {
		const preloader = document.getElementById('app-preloader');
		if (preloader) {
			preloader.classList.add('hidden');
			window.setTimeout(() => preloader.remove(), 120);
		}
	}
}

export function isPreloaderMinBudgetBypassed(): boolean {
	return preloaderMinBudgetBypassed;
}

export function ensurePreloaderSessionStartedAt(): number {
	if (typeof window === 'undefined') {
		return 0;
	}
	if (window.__ELITEEW_PRELOADER_STARTED_AT == null) {
		window.__ELITEEW_PRELOADER_STARTED_AT = performance.now();
	}
	return window.__ELITEEW_PRELOADER_STARTED_AT;
}

export function getConfiguredPreloaderMinMs(): number {
	const raw = import.meta.env.VITE_ELITEEW_PRELOADER_MIN_MS;
	const parsed = Number(raw);
	if (!Number.isFinite(parsed)) {
		return DEFAULT_PRELOADER_MIN_MS;
	}
	return Math.max(0, Math.min(15_000, parsed));
}

/** Remaining global boot preloader budget since first paint (shared across gates). */
export function getRemainingPreloaderMinMs(): number {
	if (preloaderMinBudgetBypassed) {
		return 0;
	}
	if (typeof window === 'undefined') {
		return 0;
	}
	const elapsed = performance.now() - ensurePreloaderSessionStartedAt();
	return Math.max(0, getConfiguredPreloaderMinMs() - elapsed);
}

export function hideAppPreloaderAfterMinimum(): void {
	const preloader = document.getElementById('app-preloader');
	if (!preloader) {
		return;
	}
	const delayMs = getRemainingPreloaderMinMs();

	window.setTimeout(() => {
		preloader.classList.add('hidden');
		window.setTimeout(() => preloader.remove(), 300);
	}, delayMs);
}

/** Hide the static HTML preloader only after a confirmed React commit. */
export function completeAppPreloaderHandoff(): void {
	if (typeof window !== 'undefined') {
		window.__REACT_APP_LOADED = true;
	}
	hideAppPreloaderAfterMinimum();
}

export function waitForRemainingPreloaderBudget(): Promise<void> {
	const remainingMs = getRemainingPreloaderMinMs();
	if (remainingMs <= 0) {
		return Promise.resolve();
	}
	return new Promise((resolve) => {
		window.setTimeout(resolve, remainingMs);
	});
}
