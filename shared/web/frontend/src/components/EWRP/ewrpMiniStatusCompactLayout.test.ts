/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for EWRP mini status bar compact action ordering.
 *
 * Invariants:
 * - —
 *
 * Related:
 * - `ewrpMiniStatusCompactLayout.ts`
 */

import { describe, expect, it } from 'vitest';
import { ewrpMiniStatusBarActionOrder } from './ewrpMiniStatusCompactLayout';

describe('ewrpMiniStatusBarActionOrder', () => {
	it('compact mode prioritizes save before scroll actions', () => {
		expect(
			ewrpMiniStatusBarActionOrder({
				showSave: true,
				showCancel: true,
				showScrollEditor: true,
				compact: true,
			})
		).toEqual(['save', 'cancel', 'scrollEditor', 'scrollStatus']);
	});

	it('comfortable mode keeps cancel before save, scroll last', () => {
		expect(
			ewrpMiniStatusBarActionOrder({
				showSave: true,
				showCancel: true,
				showScrollEditor: true,
				compact: false,
			})
		).toEqual(['cancel', 'save', 'scrollEditor', 'scrollStatus']);
	});

	it('omits save when draft is clean', () => {
		expect(
			ewrpMiniStatusBarActionOrder({
				showSave: false,
				showCancel: true,
				showScrollEditor: false,
				compact: true,
			})
		).toEqual(['cancel', 'scrollStatus']);
	});
});
