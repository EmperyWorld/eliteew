/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression tests for shared admin user presentation formatters.
 *
 * Invariants:
 * - User-agent truncation is presentation-only and preserves missing values as
 *   the neutral dash used by the detail panel.
 *
 * Related:
 * - ../users/adminUsersFormatters.ts
 * ---
 */

import { describe, expect, it } from 'vitest';

import { shortenUserAgent } from '../users/adminUsersFormatters';

describe('adminUsersFormatters', () => {
	it('formats missing and long user agents for detail surfaces', () => {
		expect(shortenUserAgent(null)).toBe('—');
		expect(shortenUserAgent('  Firefox  ')).toBe('Firefox');
		expect(shortenUserAgent('x'.repeat(80))).toBe(`${'x'.repeat(71)}…`);
	});
});
