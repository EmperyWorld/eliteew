/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Detect when the SPA hash route is the desktop shell (`#desktop`, `#desktop/store/...`).
 *
 * Invariants:
 * - Empty hash and slash-prefixed Desktop hashes match pre-React boot policy.
 * - Does not inspect React shell page state.
 *
 * Related:
 * - `contexts/MaintenanceContext.tsx`
 * - `pages/Desktop/DesktopWorkspaceContent.tsx`
 */

import {
	isDesktopBootLocation,
	readWindowBootLocation,
} from '@/services/boot/bootRoutePolicy';

/** True when location hash targets the desktop workspace shell. */
export function isDesktopShellRoute(): boolean {
	return (
		typeof window !== 'undefined' &&
		isDesktopBootLocation(readWindowBootLocation())
	);
}
