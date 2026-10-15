/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for my phrases reorder/duplicate helpers (U2.2–U2.3).
 */

import { describe, expect, it } from 'vitest';

import {
	buildDuplicateQuickPresetLabel,
	buildQuickPresetReorderUpdates,
} from '@/features/ewa/companionOutputSurface/companionMyPhrasesUi';

describe('companionMyPhrasesUi', () => {
	it('builds sort_order updates from ordered ids', () => {
		expect(buildQuickPresetReorderUpdates(['a', 'b', 'c'])).toEqual([
			{ id: 'a', sort_order: 10 },
			{ id: 'b', sort_order: 20 },
			{ id: 'c', sort_order: 30 },
		]);
	});

	it('appends duplicate suffix within label max', () => {
		expect(buildDuplicateQuickPresetLabel('Короткая', ' (копия)', 80)).toBe(
			'Короткая (копия)'
		);
		const long = 'А'.repeat(80);
		const duplicated = buildDuplicateQuickPresetLabel(long, ' (копия)', 80);
		expect(duplicated.length).toBe(80);
		expect(duplicated.endsWith(' (копия)')).toBe(true);
	});
});
