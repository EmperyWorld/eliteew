/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression checks for duplicate playlist naming helper.
 *
 * Invariants:
 * - First duplicate uses localized `(копия)` suffix when labels provide RU copy.
 * - Subsequent duplicates increment numeric suffix.
 *
 * Related:
 * - src/pages/MusicPlayer/musicPlayerPlaylistNaming.ts
 */

import { describe, expect, it } from 'vitest';

import {
	nextDuplicatePlaylistName,
	type DuplicatePlaylistNameLabels,
} from './musicPlayerPlaylistNaming';

const ruCopyLabels: DuplicatePlaylistNameLabels = {
	fallbackBase: 'Плейлист',
	formatPrimary: (base) => `${base} (копия)`,
	formatIndexed: (base, index) => `${base} (копия ${index})`,
};

describe('nextDuplicatePlaylistName', () => {
	it('returns base copy suffix when first copy is free', () => {
		const name = nextDuplicatePlaylistName(
			'Focus Session',
			new Set(['focus session']),
			ruCopyLabels,
			'ru'
		);
		expect(name).toBe('Focus Session (копия)');
	});

	it('increments suffix when copy names already exist', () => {
		const name = nextDuplicatePlaylistName(
			'Focus Session',
			new Set([
				'focus session',
				'focus session (копия)',
				'focus session (копия 2)',
			]),
			ruCopyLabels,
			'ru'
		);
		expect(name).toBe('Focus Session (копия 3)');
	});
});
