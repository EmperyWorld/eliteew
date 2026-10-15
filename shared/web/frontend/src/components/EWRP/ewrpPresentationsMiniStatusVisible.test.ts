/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for EWRP presentations mini status bar visibility gate.
 *
 * Invariants:
 * - —
 *
 * Related:
 * - `ewrpPresentationsMiniStatusVisible.ts`
 */

import { describe, expect, it } from 'vitest';
import { ewrpPresentationsMiniStatusVisible } from './ewrpPresentationsMiniStatusVisible';

const base = {
	hasJobId: true,
	hasStatus: true,
	statusPanelVisible: false,
	showSlideEditorPanel: true,
};

describe('ewrpPresentationsMiniStatusVisible', () => {
	it('shows when editing and status panel is off-screen', () => {
		expect(ewrpPresentationsMiniStatusVisible(base)).toBe(true);
	});

	it('hides when status panel is visible', () => {
		expect(
			ewrpPresentationsMiniStatusVisible({
				...base,
				statusPanelVisible: true,
			})
		).toBe(false);
	});

	it('hides when slide editor panel is closed', () => {
		expect(
			ewrpPresentationsMiniStatusVisible({
				...base,
				showSlideEditorPanel: false,
			})
		).toBe(false);
	});

	it('hides without job or status', () => {
		expect(
			ewrpPresentationsMiniStatusVisible({
				...base,
				hasJobId: false,
			})
		).toBe(false);
		expect(
			ewrpPresentationsMiniStatusVisible({
				...base,
				hasStatus: false,
			})
		).toBe(false);
	});
});
