/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * IntersectionObserver hook for EWRP panels — tracks whether an anchor element is in viewport.
 *
 * Invariants:
 * - When disabled or anchor missing, returns visible=true (no gated UI).
 *
 * Related:
 * - `EWRPGeneratorMain.tsx`, `EwrpPresentationsMiniStatusBar.tsx`, `useEwrpPresentationsScrollTargets.ts`
 */

import { type RefObject, useEffect, useState } from 'react';

export type UseEwrpAnchorVisibilityOptions = {
	enabled?: boolean;
	threshold?: number;
	rootMargin?: string;
};

/** Returns true while the anchor intersects the viewport (or when observation is off). */
export function useEwrpAnchorVisibility(
	anchorRef: RefObject<Element | null>,
	options: UseEwrpAnchorVisibilityOptions = {}
): boolean {
	const {
		enabled = true,
		threshold = 0.08,
		rootMargin = '-8px 0px 0px 0px',
	} = options;
	const [isVisible, setIsVisible] = useState(true);

	useEffect(() => {
		if (!enabled) {
			setIsVisible(true);
			return;
		}
		const anchor = anchorRef.current;
		if (!anchor) {
			setIsVisible(true);
			return;
		}
		const observer = new IntersectionObserver(
			([entry]) => {
				setIsVisible(entry.isIntersecting);
			},
			{ root: null, threshold, rootMargin }
		);
		observer.observe(anchor);
		return () => observer.disconnect();
	}, [anchorRef, enabled, threshold, rootMargin]);

	return isVisible;
}
