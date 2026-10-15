/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for EWRP locale-aware draft timestamp formatting.
 *
 * Invariants:
 * - Invalid or zero timestamps yield an empty string (no throw).
 *
 * Related:
 * - `ewrpDraftDateFormat.ts`
 */

import { describe, expect, it, vi } from 'vitest';
import { formatEwrpLocalDraftSavedAt } from './ewrpDraftDateFormat';

describe('formatEwrpLocalDraftSavedAt', () => {
	it('returns empty string for zero or non-finite timestamps', () => {
		expect(formatEwrpLocalDraftSavedAt(0)).toBe('');
		expect(formatEwrpLocalDraftSavedAt(Number.NaN)).toBe('');
	});

	it('formats a known UTC instant with locale date and time parts', () => {
		const localeSpy = vi
			.spyOn(Date.prototype, 'toLocaleString')
			.mockImplementation(() => '05/27/2026, 10:30 AM');
		expect(formatEwrpLocalDraftSavedAt(1_718_400_000_000)).toBe(
			'05/27/2026, 10:30 AM'
		);
		localeSpy.mockRestore();
	});
});
