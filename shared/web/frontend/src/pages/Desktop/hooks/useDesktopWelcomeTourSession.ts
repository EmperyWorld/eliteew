/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React subscription to the desktop welcome-tour step session store.
 *
 * Invariants:
 * - Server snapshot is always null (tour is a browser-only overlay).
 *
 * Related:
 * - components/desktopWelcomeTourSession.ts
 */

import { useSyncExternalStore } from 'react';
import {
	getDesktopWelcomeTourStep,
	subscribeDesktopWelcomeTourStep,
} from '../components/desktopWelcomeTourSession';

export function useDesktopWelcomeTourStep(): string | null {
	return useSyncExternalStore(
		subscribeDesktopWelcomeTourStep,
		getDesktopWelcomeTourStep,
		() => null
	);
}
