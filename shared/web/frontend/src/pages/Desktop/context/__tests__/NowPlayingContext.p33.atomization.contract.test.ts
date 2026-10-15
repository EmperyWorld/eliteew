/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P33 atomization contract: thin NowPlayingContext aggregator + module split.
 *
 * Related:
 * - context/NowPlayingContext.tsx
 * - context/nowPlaying/*
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('NowPlayingContext P33 atomization contract', () => {
	it('parent stays under 800 LOC and re-exports public API', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const parentPath = join(dir, '../NowPlayingContext.tsx');
		const src = readFileSync(parentPath, 'utf8');
		const lineCount = src.split('\n').length;

		expect(lineCount).toBeLessThanOrEqual(800);
		expect(src).toContain("from './nowPlaying/constants'");
		expect(src).toContain("from './nowPlaying/types'");
		expect(src).toContain("from './nowPlaying/contexts'");
		expect(src).toContain("from './nowPlaying/NowPlayingProvider'");
		expect(src).toContain('NOW_PLAYING_LOAD_STALL_MS');
		expect(src).toContain('NowPlayingTrack');
		expect(src).toContain('NowPlayingDiagnostics');
		expect(src).toContain('NowPlayingContextValue');
		expect(src).toContain('NowPlayingTransportValue');
		expect(src).toContain('useNowPlaying');
		expect(src).toContain('useNowPlayingTransport');
		expect(src).toContain('useNowPlayingTime');
		expect(src).toContain('NowPlayingProvider');
	});

	it('child modules stay under 800 LOC each', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const childDir = join(dir, '../nowPlaying');
		const modules = readdirSync(childDir).filter(
			(f) => f.endsWith('.ts') || f.endsWith('.tsx')
		);
		expect(modules.length).toBeGreaterThan(0);
		for (const mod of modules) {
			const lines = readFileSync(join(childDir, mod), 'utf8').split(
				'\n'
			).length;
			expect(lines, mod).toBeLessThanOrEqual(800);
		}
	});
});
