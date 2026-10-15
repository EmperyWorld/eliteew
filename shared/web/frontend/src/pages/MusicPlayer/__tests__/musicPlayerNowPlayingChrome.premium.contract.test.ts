/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Music Player now-playing footer chrome: quiet strip, sentence-case eyebrow, utility chips.
 *
 * Related:
 * - musicPlayerChrome.ts, MusicPlayerNowPlayingBar.tsx, AudioTrackMeta.tsx
 * - documentation/product/desktop/DESKTOP-MUSIC-PLAYER.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	MUSIC_PLAYER_NOW_PLAYING_EYEBROW_CLASS,
	musicPlayerFooterStripClass,
	musicPlayerUtilityChipClass,
} from '../musicPlayerChrome';

const dir = dirname(fileURLToPath(import.meta.url));

function readSrc(relativeFromTests: string): string {
	return readFileSync(join(dir, relativeFromTests), 'utf8');
}

function stripComments(src: string): string {
	return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('Music Player now-playing bar premium chrome', () => {
	it('keeps eyebrow sentence-case and quieter footer strip', () => {
		expect(MUSIC_PLAYER_NOW_PLAYING_EYEBROW_CLASS).not.toMatch(/\buppercase\b/);
		expect(MUSIC_PLAYER_NOW_PLAYING_EYEBROW_CLASS).toMatch(/tracking-normal/);
		expect(musicPlayerFooterStripClass).toMatch(/shadow-\[0_-4px_18px/);
		expect(musicPlayerUtilityChipClass(false)).toMatch(/tracking-normal/);
		expect(musicPlayerUtilityChipClass(true)).not.toMatch(/\buppercase\b/);
	});

	it('wires now-playing chrome tokens and visible sentence-case label', () => {
		const bar = stripComments(readSrc('../MusicPlayerNowPlayingBar.tsx'));
		const meta = stripComments(
			readSrc('../../../components/Audio/AudioTrackMeta.tsx')
		);
		expect(bar).toContain('MUSIC_PLAYER_NOW_PLAYING_EYEBROW_CLASS');
		expect(bar).toContain('MUSIC_PLAYER_NOW_PLAYING_TITLE_CLASS');
		expect(bar).toContain('nowPlayingLabel');
		expect(bar).not.toMatch(/\buppercase\b/);
		expect(meta).not.toMatch(/\buppercase\b/);
	});
});
