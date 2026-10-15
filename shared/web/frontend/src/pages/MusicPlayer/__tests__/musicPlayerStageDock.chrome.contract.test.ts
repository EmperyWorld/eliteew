/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock ultrawide Music Player stage-dock chrome tokens and page wiring.
 *
 * Related:
 * - musicPlayerChrome.ts, MusicPlayerPage.tsx, MusicPlayerMasterDetail.tsx
 * - documentation/product/desktop/DESKTOP-MUSIC-PLAYER.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	MUSIC_PLAYER_LAYOUT_CONTAINER_CLASS,
	MUSIC_PLAYER_MASTER_DETAIL_ROW_CLASS,
	MUSIC_PLAYER_STACKED_QUEUE_WRAP_CLASS,
	MUSIC_PLAYER_STAGE_DOCK_CLASS,
} from '../musicPlayerChrome';
import {
	STAGE_DOCK_OPEN_STORAGE_KEY,
	readStageDockOpen,
} from '../musicPlayerPageConstants';

const dir = dirname(fileURLToPath(import.meta.url));

function readSrc(relativeFromTests: string): string {
	return readFileSync(join(dir, relativeFromTests), 'utf8');
}

function stripComments(src: string): string {
	return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('Music Player stage dock chrome', () => {
	it('uses container queries for master–detail (≥1100px)', () => {
		expect(MUSIC_PLAYER_LAYOUT_CONTAINER_CLASS).toMatch(/@container/);
		expect(MUSIC_PLAYER_MASTER_DETAIL_ROW_CLASS).toMatch(
			/@min-\[1100px\]:flex-row/
		);
		expect(MUSIC_PLAYER_STAGE_DOCK_CLASS).toMatch(/@min-\[1100px\]:flex/);
		expect(MUSIC_PLAYER_STACKED_QUEUE_WRAP_CLASS).toMatch(
			/@min-\[1100px\]:hidden/
		);
	});

	it('defaults stage dock open unless localStorage is 0', () => {
		expect(STAGE_DOCK_OPEN_STORAGE_KEY).toBe(
			'eliteew.music-player.stage-dock.v1'
		);
		expect(readStageDockOpen()).toBe(true);
	});

	it('wires MasterDetail + StageDock from the page orchestrator', () => {
		const page = stripComments(readSrc('../MusicPlayerPage.tsx'));
		const detail = stripComments(readSrc('../MusicPlayerMasterDetail.tsx'));
		const dock = stripComments(readSrc('../MusicPlayerStageDock.tsx'));
		expect(page).toContain('MusicPlayerMasterDetail');
		expect(page).toContain('readStageDockOpen');
		expect(page).toContain('STAGE_DOCK_OPEN_STORAGE_KEY');
		expect(detail).toContain('MusicPlayerStageDock');
		expect(detail).toContain('MUSIC_PLAYER_LAYOUT_CONTAINER_CLASS');
		expect(dock).toContain('variant="embedded"');
	});

	it('exposes wide Created/Source columns on list header and row', () => {
		const list = stripComments(readSrc('../MusicPlayerTrackList.tsx'));
		const row = stripComments(readSrc('../MusicTrackRow.tsx'));
		expect(list).toContain('columnCreated');
		expect(list).toContain('columnSource');
		expect(list).toMatch(/@min-\[1100px\]:block/);
		expect(row).toMatch(/@min-\[1100px\]:block/);
		expect(row).toMatch(/@min-\[1100px\]:hidden/);
	});
});
