/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock cold-boot FoFline bit precedence (omit ≠ false).
 */

import { describe, expect, it } from 'vitest';
import { resolveAllowFoflineBoot } from './resolveAllowFoflineBoot';

describe('resolveAllowFoflineBoot', () => {
	it('prefers signed entitlement when present', () => {
		expect(
			resolveAllowFoflineBoot({
				entitlementAllowFofline: false,
				persistedAllowFofline: true,
			})
		).toBe(false);
		expect(
			resolveAllowFoflineBoot({
				entitlementAllowFofline: true,
				persistedAllowFofline: false,
			})
		).toBe(true);
	});

	it('uses persist when entitlement bit omitted', () => {
		expect(
			resolveAllowFoflineBoot({
				entitlementAllowFofline: null,
				persistedAllowFofline: true,
			})
		).toBe(true);
		expect(
			resolveAllowFoflineBoot({
				entitlementAllowFofline: undefined,
				persistedAllowFofline: false,
			})
		).toBe(false);
	});

	it('returns null when both missing (do not wipe persist)', () => {
		expect(resolveAllowFoflineBoot({})).toBeNull();
		expect(
			resolveAllowFoflineBoot({
				entitlementAllowFofline: null,
				persistedAllowFofline: null,
			})
		).toBeNull();
	});
});
