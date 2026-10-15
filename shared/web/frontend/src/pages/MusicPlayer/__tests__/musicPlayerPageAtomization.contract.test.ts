/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Locks Music Player Wave 1 atomization boundaries, public exports, and extracted module inventory.
 *
 * Invariants:
 * - Lazy consumers keep importing `MusicPlayer/MusicPlayerPage`.
 * - Page and track-list orchestrators remain at or below 800 LOC.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerPage.tsx
 * - src/pages/MusicPlayer/MusicPlayerTrackList.tsx
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const musicPlayerDirectory = join(testDirectory, '..');
const pagePath = join(musicPlayerDirectory, 'MusicPlayerPage.tsx');
const trackListPath = join(musicPlayerDirectory, 'MusicPlayerTrackList.tsx');
const lazyImportsPath = join(
	musicPlayerDirectory,
	'..',
	'Desktop',
	'components',
	'desktopWindowAppContent',
	'lazyImports.ts'
);

describe('MusicPlayer page Wave 1 atomization contract', () => {
	it('keeps page and track-list orchestrators at or below 800 LOC', () => {
		const pageLineCount = readFileSync(pagePath, 'utf8').split('\n').length;
		const trackListLineCount = readFileSync(trackListPath, 'utf8').split(
			'\n'
		).length;

		expect(pageLineCount).toBeLessThanOrEqual(800);
		expect(trackListLineCount).toBeLessThanOrEqual(800);
	});

	it('preserves the MusicPlayerPage named and default exports', () => {
		const source = readFileSync(pagePath, 'utf8');

		expect(source).toContain('export interface MusicPlayerPageProps');
		expect(source).toContain('export const MusicPlayerPage');
		expect(source).toContain('export default MusicPlayerPage');
	});

	it('preserves the Desktop lazy import path', () => {
		const source = readFileSync(lazyImportsPath, 'utf8');

		expect(source).toContain("import('../../../MusicPlayer/MusicPlayerPage')");
	});

	it('keeps every Wave 1 extracted module on the MusicPlayer path', () => {
		const modules = [
			'musicPlayerPageConstants.ts',
			'MusicPlayerLoadingSkeleton.tsx',
			'MusicPlayerAbLoopEffect.tsx',
			'useMusicPlayerCatalog.ts',
			'useMusicPlayerTrackPipeline.ts',
			'useMusicPlayerPlaylistActions.ts',
			'useMusicPlayerPageShortcuts.ts',
			'useMusicPlayerTrackActions.ts',
			'MusicTrackRow.tsx',
			'MusicPlayerMasterDetail.tsx',
			'MusicPlayerStageDock.tsx',
		];

		for (const moduleName of modules) {
			expect(
				existsSync(join(musicPlayerDirectory, moduleName)),
				moduleName
			).toBe(true);
		}
	});
});
