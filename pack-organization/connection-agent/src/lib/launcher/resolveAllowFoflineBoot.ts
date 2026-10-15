/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resolve FoFline CTA bit on shell cold boot without coercing “missing” to false.
 *
 * Invariants:
 * - Signed entitlement boolean wins when present (true or false).
 * - Omitted entitlement bit → last redeem/import persist.
 * - Both missing → null (caller fail-closed for UI, must not wipe persist).
 *
 * Related:
 * - useNativeBoot.ts
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §4.2
 */

export function resolveAllowFoflineBoot(input: {
	entitlementAllowFofline?: boolean | null;
	persistedAllowFofline?: boolean | null;
}): boolean | null {
	if (typeof input.entitlementAllowFofline === 'boolean') {
		return input.entitlementAllowFofline;
	}
	if (typeof input.persistedAllowFofline === 'boolean') {
		return input.persistedAllowFofline;
	}
	return null;
}
