/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Formats partial metadata warning copy for Music Player track list banner.
 *
 * Invariants:
 * - Returns null when there are no presentation gaps to report.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerPage.tsx
 */

export type PresentationGapLabels = {
	formatBanner: (details: string) => string;
	formatWithoutArtwork: (count: number) => string;
	formatWithoutDuration: (count: number) => string;
};

export function formatMusicPlayerPresentationGapsBanner(
	gaps: {
		missingThumbnailCount: number;
		missingDurationCount: number;
	},
	labels: PresentationGapLabels
): string | null {
	const parts: string[] = [];
	if (gaps.missingThumbnailCount > 0) {
		parts.push(labels.formatWithoutArtwork(gaps.missingThumbnailCount));
	}
	if (gaps.missingDurationCount > 0) {
		parts.push(labels.formatWithoutDuration(gaps.missingDurationCount));
	}
	if (parts.length === 0) return null;
	return labels.formatBanner(parts.join('; '));
}
