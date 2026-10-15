/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Verifies virtual row height estimation for compact/dense list modes.
 *
 * Invariants:
 * - Dense mode estimates are not larger than compact mode for the same row content.
 * - Empty item fallback remains finite for both density modes.
 *
 * Related:
 * - src/pages/MusicPlayer/musicPlayerListVirtual.ts
 */

import { describe, expect, it } from 'vitest';

import { estimateMusicTrackRowHeightPx } from './musicPlayerListVirtual';

describe('estimateMusicTrackRowHeightPx', () => {
	it('returns smaller estimate in dense mode', () => {
		const withMeta = {
			mime_type: 'audio/mpeg',
			tags: ['ambient'],
		};
		const compactHeight = estimateMusicTrackRowHeightPx(
			withMeta as never,
			'compact'
		);
		const denseHeight = estimateMusicTrackRowHeightPx(
			withMeta as never,
			'dense'
		);
		expect(denseHeight).toBeLessThan(compactHeight);
	});

	it('keeps finite fallback when item missing', () => {
		expect(estimateMusicTrackRowHeightPx(undefined, 'compact')).toBeGreaterThan(
			0
		);
		expect(estimateMusicTrackRowHeightPx(undefined, 'dense')).toBeGreaterThan(
			0
		);
	});
});
