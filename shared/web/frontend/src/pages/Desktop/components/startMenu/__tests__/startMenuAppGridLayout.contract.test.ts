/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P16 / Wave 1 lock — Start catalog vs Home short-list density SSOT
 * (narrow 2-col, readable name, meta/hints hidden; Home idle ≤3 cols).
 *
 * Invariants:
 * - Grid/name classes must not use taskbarWindowTitle micro type as the catalog name.
 * - Keyboard cols match Tailwind breakpoints used by each density.
 *
 * Related:
 * - `../startMenuAppGridLayout.ts`
 */

import { describe, expect, it } from 'vitest';
import {
	resolveStartMenuAppGridCols,
	resolveStartMenuAppGridColsForDensity,
	resolveStartMenuHomeShortGridCols,
	START_MENU_APP_GRID_CLASS,
	START_MENU_APP_META_CLASS,
	START_MENU_APP_NAME_CLASS,
	START_MENU_CATEGORIES_STACK_CLASS,
	START_MENU_CATEGORY_HINT_CLASS,
	START_MENU_HOME_SHORT_GRID_CLASS,
	startMenuAppGridClassForDensity,
} from '../startMenuAppGridLayout';

describe('startMenuAppGridLayout', () => {
	it('uses 2 columns on narrow and scales with Tailwind breakpoints', () => {
		expect(START_MENU_APP_GRID_CLASS).toContain('grid-cols-2');
		expect(START_MENU_APP_GRID_CLASS).toContain('sm:grid-cols-3');
		expect(START_MENU_APP_GRID_CLASS).toContain('md:grid-cols-4');
		expect(resolveStartMenuAppGridCols(375)).toBe(2);
		expect(resolveStartMenuAppGridCols(640)).toBe(3);
		expect(resolveStartMenuAppGridCols(768)).toBe(4);
		expect(resolveStartMenuAppGridCols(1024)).toBe(5);
		expect(resolveStartMenuAppGridCols(1280)).toBe(6);
	});

	it('caps Home idle short grid at 3 columns on wide viewports', () => {
		expect(START_MENU_HOME_SHORT_GRID_CLASS).toContain('grid-cols-2');
		expect(START_MENU_HOME_SHORT_GRID_CLASS).toContain('sm:grid-cols-3');
		expect(START_MENU_HOME_SHORT_GRID_CLASS).not.toContain('md:grid-cols-4');
		expect(START_MENU_HOME_SHORT_GRID_CLASS).not.toContain('xl:grid-cols-6');
		expect(resolveStartMenuHomeShortGridCols(375)).toBe(2);
		expect(resolveStartMenuHomeShortGridCols(1280)).toBe(3);
		expect(resolveStartMenuAppGridColsForDensity(1280, 'home-short')).toBe(3);
		expect(resolveStartMenuAppGridColsForDensity(1280, 'catalog')).toBe(6);
		expect(startMenuAppGridClassForDensity('home-short')).toBe(
			START_MENU_HOME_SHORT_GRID_CLASS
		);
		expect(startMenuAppGridClassForDensity('catalog')).toBe(
			START_MENU_APP_GRID_CLASS
		);
	});

	it('uses readable catalog name token instead of taskbar micro type', () => {
		expect(START_MENU_APP_NAME_CLASS).toContain('text-[13px]');
		expect(START_MENU_APP_NAME_CLASS).not.toContain('taskbarWindowTitle');
		expect(START_MENU_APP_META_CLASS).toContain('max-sm:hidden');
	});

	it('tightens category wall spacing and hides hints on narrow', () => {
		expect(START_MENU_CATEGORIES_STACK_CLASS).toContain('max-sm:space-y-3');
		expect(START_MENU_CATEGORY_HINT_CLASS).toContain('max-sm:hidden');
	});
});
