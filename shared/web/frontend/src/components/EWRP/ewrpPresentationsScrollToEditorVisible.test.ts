/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for EWRP scroll-to-editor visibility gates.
 *
 * Invariants:
 * - —
 *
 * Related:
 * - `ewrpPresentationsScrollToEditorVisible.ts`
 */

import { describe, expect, it } from 'vitest';
import {
	ewrpMiniStatusScrollToEditorVisible,
	ewrpPresentationsScrollToEditorVisible,
} from './ewrpPresentationsScrollToEditorVisible';

describe('ewrpPresentationsScrollToEditorVisible', () => {
	it('shows when editing, status visible, editor off-screen', () => {
		expect(
			ewrpPresentationsScrollToEditorVisible({
				showSlideEditorPanel: true,
				statusPanelVisible: true,
				slideEditorPanelVisible: false,
			})
		).toBe(true);
	});

	it('hides when editor is already visible', () => {
		expect(
			ewrpPresentationsScrollToEditorVisible({
				showSlideEditorPanel: true,
				statusPanelVisible: true,
				slideEditorPanelVisible: true,
			})
		).toBe(false);
	});

	it('hides when status panel is off-screen (mini bar owns navigation)', () => {
		expect(
			ewrpPresentationsScrollToEditorVisible({
				showSlideEditorPanel: true,
				statusPanelVisible: false,
				slideEditorPanelVisible: false,
			})
		).toBe(false);
	});
});

describe('ewrpMiniStatusScrollToEditorVisible', () => {
	it('shows when mini bar is up and editor is below fold', () => {
		expect(
			ewrpMiniStatusScrollToEditorVisible({
				showPresentationsMiniStatus: true,
				slideEditorPanelVisible: false,
			})
		).toBe(true);
	});

	it('hides when editor anchor is visible', () => {
		expect(
			ewrpMiniStatusScrollToEditorVisible({
				showPresentationsMiniStatus: true,
				slideEditorPanelVisible: true,
			})
		).toBe(false);
	});
});
