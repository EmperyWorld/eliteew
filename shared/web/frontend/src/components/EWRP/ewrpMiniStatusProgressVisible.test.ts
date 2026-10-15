/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for EWRP mini status rebuild progress visibility gate.
 *
 * Invariants:
 * - —
 *
 * Related:
 * - `ewrpMiniStatusProgressVisible.ts`
 */

import { describe, expect, it } from 'vitest';
import { ewrpMiniStatusProgressVisible } from './ewrpMiniStatusProgressVisible';

describe('ewrpMiniStatusProgressVisible', () => {
	it('is true during rebuild phases', () => {
		expect(ewrpMiniStatusProgressVisible('generating_content')).toBe(true);
		expect(ewrpMiniStatusProgressVisible('building_pdf')).toBe(true);
	});

	it('is false for terminal and idle phases', () => {
		expect(ewrpMiniStatusProgressVisible('completed')).toBe(false);
		expect(ewrpMiniStatusProgressVisible('queued')).toBe(false);
		expect(ewrpMiniStatusProgressVisible(null)).toBe(false);
	});
});
