/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Constants and step anchors for Music Player guided tour (GT-10c).
 *
 * Related:
 * - MusicPlayerPage.tsx, public/audio/music-player-guide/
 */

import type { GuideStepDef } from '@/components/guided-tour/useBuiltGuideSteps';
import { guideTourWavUrl } from '@/components/guided-tour/guideTourWavUrl';

export const MUSIC_PLAYER_GUIDE_ROOT_ID = 'music-player-guide-root';
export const MUSIC_PLAYER_GUIDE_AUDIO_LS_KEY =
	'music-player-guide-audio-enabled';
export const MUSIC_PLAYER_GUIDE_TOUR_FOLDER = 'music-player-guide';

export const MUSIC_PLAYER_GUIDE_STEP_DEFS: readonly GuideStepDef[] = [
	{ id: 'intro', highlightSelector: null },
	{
		id: 'header-search',
		highlightSelector: '[data-music-player-guide="chrome-toolbar"]',
	},
	{
		id: 'secondary-toolbar',
		highlightSelector: '[data-music-player-guide="chrome-toolbar"]',
	},
	{
		id: 'track-list',
		highlightSelector: '[data-music-player-guide="track-list"]',
	},
	{
		id: 'queue-panel',
		highlightSelector: '[data-music-player-guide="queue-panel"]',
	},
	{
		id: 'now-playing',
		highlightSelector: '[data-music-player-guide="now-playing"]',
	},
	{
		id: 'shortcuts',
		highlightSelector: null,
	},
	{ id: 'outro', highlightSelector: null },
] as const;

export function musicPlayerGuideWavUrl(stepId: string): string {
	return guideTourWavUrl(MUSIC_PLAYER_GUIDE_TOUR_FOLDER, stepId);
}
