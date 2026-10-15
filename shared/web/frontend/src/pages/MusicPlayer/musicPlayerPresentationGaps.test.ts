/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression checks for partial metadata warning banner formatter.
 *
 * Invariants:
 * - Banner is omitted when both gap counters are zero.
 *
 * Related:
 * - src/pages/MusicPlayer/musicPlayerPresentationGaps.ts
 */

import { describe, expect, it } from 'vitest';

import { formatMusicPlayerPresentationGapsBanner } from './musicPlayerPresentationGaps';

const labels = {
	formatBanner: (details: string) => `Incomplete: ${details}. Playable.`,
	formatWithoutArtwork: (count: number) => `${count} without artwork`,
	formatWithoutDuration: (count: number) => `${count} without duration`,
};

describe('formatMusicPlayerPresentationGapsBanner', () => {
	it('returns null when there are no gaps', () => {
		expect(
			formatMusicPlayerPresentationGapsBanner(
				{ missingThumbnailCount: 0, missingDurationCount: 0 },
				labels
			)
		).toBeNull();
	});

	it('joins artwork and duration gap details', () => {
		expect(
			formatMusicPlayerPresentationGapsBanner(
				{ missingThumbnailCount: 2, missingDurationCount: 1 },
				labels
			)
		).toBe('Incomplete: 2 without artwork; 1 without duration. Playable.');
	});
});
