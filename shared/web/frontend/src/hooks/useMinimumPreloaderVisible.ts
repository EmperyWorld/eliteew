/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Keeps React loading/preloader states visible for the configured minimum duration.
 *
 * Invariants:
 * - Uses the same `VITE_ELITEEW_PRELOADER_MIN_MS` contract as the static HTML preloader.
 * - Does not delay data fetching or app rendering work; it only gates loading UI replacement.
 *
 * Related:
 * - `utils/appPreloader.ts`
 * - Global boot budget via `getRemainingPreloaderMinMs()` (shared with static HTML preloader).
 */

import { useEffect, useRef, useState } from 'react';
import { getRemainingPreloaderMinMs } from '@/utils/appPreloader';

export type MinimumPreloaderVisibleOptions = {
	/** Override remaining budget (e.g. 0 when maintenance overlay owns recovery UX). */
	minimumMs?: number;
};

export function useMinimumPreloaderVisible(
	active: boolean,
	options?: MinimumPreloaderVisibleOptions
): boolean {
	const [visible, setVisible] = useState(active);
	const optionsRef = useRef(options);
	optionsRef.current = options;

	useEffect(() => {
		if (active) {
			setVisible(true);
			return;
		}

		if (!visible) {
			return;
		}

		const remainingMs =
			optionsRef.current?.minimumMs ?? getRemainingPreloaderMinMs();
		const timer = window.setTimeout(() => setVisible(false), remainingMs);

		return () => window.clearTimeout(timer);
	}, [active, visible]);

	return visible;
}
