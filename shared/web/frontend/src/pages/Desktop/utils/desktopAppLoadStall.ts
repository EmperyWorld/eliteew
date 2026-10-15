/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * SSOT for desktop app/chunk Suspense stall escalation — when a load spinner
 * has been visible long enough that “Opening…” becomes dishonest without CTA.
 *
 * Invariants:
 * - Default stall threshold is 8000ms (Cause P18); tests may inject shorter ms.
 * - Hook resets when `active` flips false or remounts a new load cycle.
 *
 * Related:
 * - EnhancedWindowAppContent.tsx
 * - DesktopAppLoadSuspenseFallback.tsx
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md
 */

import { useEffect, useState } from 'react';

/** Default time before Suspense loading UI escalates to still-opening + actions. */
export const DESKTOP_APP_LOAD_STALL_MS = 8_000;

/**
 * Returns true after `stallMs` while `active` stays true (Suspense fallback mounted).
 */
export function useDesktopAppLoadStall(
	active: boolean,
	stallMs: number = DESKTOP_APP_LOAD_STALL_MS
): boolean {
	const [stalled, setStalled] = useState(false);

	useEffect(() => {
		if (!active) {
			setStalled(false);
			return;
		}
		setStalled(false);
		const id = window.setTimeout(() => {
			setStalled(true);
		}, stallMs);
		return () => {
			window.clearTimeout(id);
		};
	}, [active, stallMs]);

	return stalled;
}
