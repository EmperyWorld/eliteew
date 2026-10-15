/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P22 LOC lock — `useDesktopStorage` parent stays ≤800 after atomization;
 * Wave B composes `hooks/desktopStorage/*`.
 *
 * Invariants:
 * - Public export path remains `hooks/useDesktopStorage.ts`.
 * - Facade imports from `./desktopStorage/`; at least 3 modules under that dir.
 *
 * Related:
 * - hooks/useDesktopStorage.ts
 * - hooks/desktopStorage/*
 * - documentation/product/desktop/DESKTOP-STATE-PERSISTENCE.md
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const STORAGE_HOOK = join(here, '../useDesktopStorage.ts');
const STORAGE_DIR = join(here, '../desktopStorage');

describe('useDesktopStorage P22 atomization', () => {
	it('parent hook stays ≤800 LOC', () => {
		const src = readFileSync(STORAGE_HOOK, 'utf8');
		expect(src.split('\n').length).toBeLessThanOrEqual(800);
	});

	it('re-exports public wallpaper helpers from desktopConfigPatch', () => {
		const src = readFileSync(STORAGE_HOOK, 'utf8');
		expect(src).toMatch(/isWallpaperTooLargeForApi/);
		expect(src).toMatch(/MAX_WALLPAPER_LENGTH/);
		expect(src).toMatch(/from ['"]\.\.\/utils\/desktopConfigPatch['"]/);
	});

	it('facade imports from ./desktopStorage/ and at least 3 modules exist', () => {
		const src = readFileSync(STORAGE_HOOK, 'utf8');
		expect(src).toMatch(/from ['"]\.\/desktopStorage\//);
		expect(existsSync(STORAGE_DIR)).toBe(true);
		const modules = readdirSync(STORAGE_DIR).filter((name) =>
			name.endsWith('.ts')
		);
		expect(modules.length).toBeGreaterThanOrEqual(3);
	});
});
