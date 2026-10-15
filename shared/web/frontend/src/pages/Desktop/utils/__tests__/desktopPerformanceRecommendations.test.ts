/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P11 lock — performance recommendation codes render through desktopUi, not hardcoded RU.
 *
 * Related:
 * - utils/desktopPerformanceRecommendations.ts
 */

import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import {
	desktopPerformanceRecommendationKey,
	translateDesktopPerformanceRecommendation,
} from '../desktopPerformanceRecommendations';

describe('desktopPerformanceRecommendations (P11)', () => {
	it('translates codes with interpolation vars', () => {
		const t = ((key: string, opts?: Record<string, unknown>) => {
			if (key === 'performance.recommendation.low_fps') {
				return `FPS ${opts?.fps}`;
			}
			return key;
		}) as TFunction<'desktopUi'>;

		expect(
			translateDesktopPerformanceRecommendation(t, {
				code: 'low_fps',
				values: { fps: 20 },
			})
		).toBe('FPS 20');
	});

	it('builds stable list keys from code + values', () => {
		expect(
			desktopPerformanceRecommendationKey({
				code: 'many_windows',
				values: { windowCount: 12 },
			})
		).toBe('many_windows:{"windowCount":12}');
		expect(desktopPerformanceRecommendationKey({ code: 'high_memory' })).toBe(
			'high_memory'
		);
	});
});
