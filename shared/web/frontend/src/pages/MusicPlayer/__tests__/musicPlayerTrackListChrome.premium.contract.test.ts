/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Music Player track-list chrome: sentence-case column header, quiet gaps banner.
 *
 * Related:
 * - musicPlayerChrome.ts, MusicPlayerTrackList.tsx, MusicPlayerPage.tsx
 * - documentation/product/desktop/DESKTOP-MUSIC-PLAYER.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	MUSIC_PLAYER_PRESENTATION_GAPS_BANNER_CLASS,
	MUSIC_PLAYER_TRACK_LIST_HEADER_CLASS,
} from '../musicPlayerChrome';

const dir = dirname(fileURLToPath(import.meta.url));

function readSrc(relativeFromTests: string): string {
	return readFileSync(join(dir, relativeFromTests), 'utf8');
}

function stripComments(src: string): string {
	return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('Music Player track list premium chrome', () => {
	it('keeps column header sentence-case (no uppercase shout)', () => {
		expect(MUSIC_PLAYER_TRACK_LIST_HEADER_CLASS).not.toMatch(/\buppercase\b/);
		expect(MUSIC_PLAYER_TRACK_LIST_HEADER_CLASS).toMatch(/tracking-normal/);
	});

	it('keeps presentation gaps banner on desktop tokens (not amber shout)', () => {
		expect(MUSIC_PLAYER_PRESENTATION_GAPS_BANNER_CLASS).not.toMatch(/\bamber-/);
		expect(MUSIC_PLAYER_PRESENTATION_GAPS_BANNER_CLASS).toMatch(
			/desktop-text-secondary/
		);
	});

	it('wires chrome tokens into TrackList + MasterDetail', () => {
		const list = stripComments(readSrc('../MusicPlayerTrackList.tsx'));
		const detail = stripComments(readSrc('../MusicPlayerMasterDetail.tsx'));
		expect(list).toContain('MUSIC_PLAYER_TRACK_LIST_HEADER_CLASS');
		expect(list).not.toMatch(/\buppercase\b/);
		expect(detail).toContain('MUSIC_PLAYER_TRACK_LIST_SCROLL_CLASS');
		expect(detail).toContain('MUSIC_PLAYER_PRESENTATION_GAPS_BANNER_CLASS');
		expect(detail).not.toMatch(/\bamber-/);
	});
});
