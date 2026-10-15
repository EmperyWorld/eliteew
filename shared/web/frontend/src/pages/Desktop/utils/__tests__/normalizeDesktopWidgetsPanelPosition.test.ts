/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for widgets panel position normalization helper.
 *
 * Invariants:
 * - —
 *
 * Related:
 * - `normalizeDesktopWidgetsPanelPosition.ts`
 */

import { describe, expect, it } from 'vitest';
import { normalizeDesktopWidgetsPanelPosition } from '../normalizeDesktopWidgetsPanelPosition';

describe('normalizeDesktopWidgetsPanelPosition', () => {
	it('returns known corners unchanged', () => {
		expect(normalizeDesktopWidgetsPanelPosition('bottom-left')).toBe(
			'bottom-left'
		);
	});

	it('falls back to top-right for unknown values', () => {
		expect(normalizeDesktopWidgetsPanelPosition(undefined)).toBe('top-right');
		expect(normalizeDesktopWidgetsPanelPosition('center')).toBe('top-right');
	});
});
