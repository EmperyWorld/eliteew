/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract: Start Menu desktop geometry insets top like left/right (2cm),
 * bottom clears taskbar — no content-capped max-height that ignores top.
 *
 * Related:
 * - startMenuPanelGeometry.ts
 */

import { describe, expect, it } from 'vitest';
import { START_MENU_PANEL_GEOMETRY } from '../startMenuPanelGeometry';

describe('START_MENU_PANEL_GEOMETRY', () => {
	it('stretches with equal 2cm edge insets on sm+ including top', () => {
		expect(START_MENU_PANEL_GEOMETRY).toContain('sm:top-[2cm]');
		expect(START_MENU_PANEL_GEOMETRY).toContain('sm:left-[2cm]');
		expect(START_MENU_PANEL_GEOMETRY).toContain('sm:right-[2cm]');
		expect(START_MENU_PANEL_GEOMETRY).toContain('sm:bottom-20');
		const tokens = START_MENU_PANEL_GEOMETRY.split(/\s+/);
		expect(tokens.some((c) => c.startsWith('sm:max-h-'))).toBe(false);
	});
});
