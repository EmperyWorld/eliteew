/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract lock for Empery World curated desktop style sets.
 *
 * Invariants:
 * - Stable ids; wallpaper indices in range; icon styles from registry.
 *
 * Related:
 * - `desktopCuratedStyleSets.ts`
 */

import { describe, expect, it } from 'vitest';
import {
	DESKTOP_ICON_STYLE_KEYS,
	DESKTOP_TASKBAR_STYLE_KEYS,
} from '@/types/profile';
import { WALLPAPER_COUNT } from '../wallpapers';
import { DESKTOP_CURATED_STYLE_SETS } from '../desktopCuratedStyleSets';
import enDesktopUi from '@/i18n/locales/en/desktopUi.json';
import ruDesktopUi from '@/i18n/locales/ru/desktopUi.json';

describe('DESKTOP_CURATED_STYLE_SETS', () => {
	it('keeps stable unique ids and valid wallpaper indices', () => {
		const ids = DESKTOP_CURATED_STYLE_SETS.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).toEqual(
			expect.arrayContaining([
				'velvet-midnight',
				'neon-lab',
				'aurora-dream',
				'rose-atelier',
			])
		);
		for (const set of DESKTOP_CURATED_STYLE_SETS) {
			expect(set.wallpaperIndex).toBeGreaterThanOrEqual(1);
			expect(set.wallpaperIndex).toBeLessThanOrEqual(WALLPAPER_COUNT);
			expect(DESKTOP_TASKBAR_STYLE_KEYS).toContain(set.windowStyle);
			if (set.iconStyle) {
				expect(DESKTOP_ICON_STYLE_KEYS).toContain(set.iconStyle);
			}
		}
	});

	it('has RU/EN copy for every curated set id', () => {
		const ruSets = ruDesktopUi.curatedStylePreset.sets as Record<
			string,
			{ name: string; blurb: string }
		>;
		const enSets = enDesktopUi.curatedStylePreset.sets as Record<
			string,
			{ name: string; blurb: string }
		>;
		for (const set of DESKTOP_CURATED_STYLE_SETS) {
			expect(ruSets[set.id]?.name?.trim().length).toBeGreaterThan(0);
			expect(ruSets[set.id]?.blurb?.trim().length).toBeGreaterThan(0);
			expect(enSets[set.id]?.name?.trim().length).toBeGreaterThan(0);
			expect(enSets[set.id]?.blurb?.trim().length).toBeGreaterThan(0);
		}
	});

	it('uses distinct name strings in RU catalog', () => {
		const ruSets = ruDesktopUi.curatedStylePreset.sets as Record<
			string,
			{ name: string }
		>;
		const names = DESKTOP_CURATED_STYLE_SETS.map((s) => ruSets[s.id].name);
		expect(new Set(names).size).toBe(names.length);
	});
});
