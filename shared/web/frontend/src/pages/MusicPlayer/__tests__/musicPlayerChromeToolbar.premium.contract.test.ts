/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Music Player chrome toolbar: sentence-case meta, quiet chips, no amber sort warning.
 *
 * Related:
 * - musicPlayerChrome.ts, MusicPlayerSecondaryToolbar.tsx
 * - documentation/product/desktop/DESKTOP-MUSIC-PLAYER.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	MUSIC_PLAYER_CHROME_TOOLBAR_CLASS,
	MUSIC_PLAYER_DURATION_SORT_WARNING_CLASS,
	MUSIC_PLAYER_TOOLBAR_META_LABEL_CLASS,
	musicPlayerToolbarChipClass,
} from '../musicPlayerChrome';

const dir = dirname(fileURLToPath(import.meta.url));

function readSrc(relativeFromTests: string): string {
	return readFileSync(join(dir, relativeFromTests), 'utf8');
}

function stripComments(src: string): string {
	return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('Music Player chrome toolbar premium', () => {
	it('keeps toolbar meta sentence-case (no uppercase shout)', () => {
		expect(MUSIC_PLAYER_TOOLBAR_META_LABEL_CLASS).not.toMatch(/\buppercase\b/);
		expect(MUSIC_PLAYER_TOOLBAR_META_LABEL_CLASS).toMatch(/tracking-normal/);
		expect(MUSIC_PLAYER_CHROME_TOOLBAR_CLASS).toMatch(/shrink-0/);
		expect(MUSIC_PLAYER_CHROME_TOOLBAR_CLASS).toMatch(/gap-1\.5/);
	});

	it('keeps duration-sort warning on desktop tokens (not amber)', () => {
		expect(MUSIC_PLAYER_DURATION_SORT_WARNING_CLASS).not.toMatch(/\bamber-/);
		expect(musicPlayerToolbarChipClass(true)).toMatch(/desktop-accent-rgb/);
		expect(musicPlayerToolbarChipClass(false)).not.toMatch(/\buppercase\b/);
	});

	it('wires chrome tokens into SecondaryToolbar; Page no longer owns pill/sort callbacks', () => {
		const toolbar = stripComments(
			readSrc('../MusicPlayerSecondaryToolbar.tsx')
		);
		const page = stripComments(readSrc('../MusicPlayerPage.tsx'));
		expect(toolbar).toContain('MUSIC_PLAYER_CHROME_TOOLBAR_CLASS');
		expect(toolbar).toContain('musicPlayerToolbarPillClass');
		expect(toolbar).toContain('musicPlayerToolbarChipClass');
		expect(toolbar).toContain('MUSIC_PLAYER_DURATION_SORT_WARNING_CLASS');
		expect(toolbar).not.toMatch(/\bamber-/);
		expect(toolbar).not.toMatch(/\bpillTag\b/);
		expect(toolbar).not.toMatch(/\bsortChip\b/);
		expect(page).not.toMatch(/\bpillTag\b/);
		expect(page).not.toMatch(/\bsortChip\b/);
	});
});
