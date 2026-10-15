/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Retail Sealed Capsule UI gate — Channel/License editors are not product surfaces.
 *
 * Invariants:
 * - Retail sealed ON by default (No System Footprint path).
 * - Ops escape: localStorage eliteew.debug.ops=1 (hidden gesture sets this).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §Sealed Capsule
 */

const DEBUG_OPS_KEY = 'eliteew.debug.ops';

/** Retail sealed product IA (dashboard + capsule drop only). */
export function isRetailSealedUi(): boolean {
	try {
		if (typeof localStorage === 'undefined') return true;
		return localStorage.getItem(DEBUG_OPS_KEY) !== '1';
	} catch {
		return true;
	}
}

export function enableOpsDebugUi(): void {
	try {
		localStorage.setItem(DEBUG_OPS_KEY, '1');
	} catch {
		/* ignore quota */
	}
}

export function disableOpsDebugUi(): void {
	try {
		localStorage.removeItem(DEBUG_OPS_KEY);
	} catch {
		/* ignore */
	}
}

export { DEBUG_OPS_KEY };
