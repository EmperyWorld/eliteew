/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Holds the SPA React root so imperative fallbacks (stale bundle UI) can unmount safely.
 *
 * Invariants:
 * - Only `mainFullApp.ts` registers the root; fallbacks call `detachAppReactRoot()` before DOM takeover.
 *
 * Related:
 * - `utils/staleBundleReload.ts`, `mainFullApp.ts`
 */

import type { Root } from 'react-dom/client';

let appReactRoot: Root | null = null;

export function registerAppReactRoot(root: Root): void {
	appReactRoot = root;
}

/** Unmount React before non-React DOM fallback — avoids removeChild reconciliation errors. */
export function detachAppReactRoot(): void {
	if (!appReactRoot) {
		return;
	}
	try {
		appReactRoot.unmount();
	} catch {
		/* ignore — root may already be torn down */
	}
	appReactRoot = null;
}
