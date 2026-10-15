/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P38 atomization contract: thin constants/index.ts barrel + sibling module split.
 *
 * Related:
 * - constants/index.ts
 * - constants/defaultApps.ts, desktopChromeTokens.ts, desktopZIndex.ts, …
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	DEFAULT_APPS,
	DESKTOP_Z_INDEX,
	STORAGE_KEYS,
	WALLPAPERS,
} from '../index';
import { TASKBAR } from '../desktopChromeTokens';

describe('Desktop constants P38 atomization contract', () => {
	it('parent index.ts stays under 800 LOC and is mostly re-exports', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const parentPath = join(dir, '../index.ts');
		const src = readFileSync(parentPath, 'utf8');
		const lineCount = src.split('\n').length;

		expect(lineCount).toBeLessThanOrEqual(800);
		expect(lineCount).toBeLessThanOrEqual(200);
		expect(src).toContain("from './wallpapers'");
		expect(src).toContain("from './defaultApps'");
		expect(src).toContain("from './desktopZIndex'");
		expect(src).toContain("from './desktopRuntimeConfig'");
		expect(src).not.toContain('export const DEFAULT_APPS');
		expect(src).not.toContain('export const DESKTOP_Z_INDEX');
	});

	it('re-exports key public symbols from the barrel', () => {
		expect(Array.isArray(DEFAULT_APPS)).toBe(true);
		expect(DEFAULT_APPS.length).toBeGreaterThan(0);
		expect(DESKTOP_Z_INDEX.CONTEXT_MENU).toBe(10100);
		expect(TASKBAR.HEIGHT_PX).toBe(46);
		expect(STORAGE_KEYS.CONFIG).toBe('elite_desktop_config');
		expect(Array.isArray(WALLPAPERS)).toBe(true);
		expect(WALLPAPERS.length).toBeGreaterThan(0);
	});

	it('P38 sibling modules exist and stay under 800 LOC each', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const constantsDir = join(dir, '..');
		const expected = [
			'defaultApps.ts',
			'folderAndAccentColors.ts',
			'desktopGridAndIcons.ts',
			'desktopChromeTokens.ts',
			'desktopZIndex.ts',
			'desktopRuntimeConfig.ts',
		];
		for (const mod of expected) {
			const path = join(constantsDir, mod);
			expect(existsSync(path), mod).toBe(true);
			const lines = readFileSync(path, 'utf8').split('\n').length;
			expect(lines, mod).toBeLessThanOrEqual(800);
		}

		const p38Modules = readdirSync(constantsDir).filter((f) =>
			/^(defaultApps|folderAndAccentColors|desktopGridAndIcons|desktopChromeTokens|desktopZIndex|desktopRuntimeConfig)\.ts$/.test(
				f
			)
		);
		expect(p38Modules).toHaveLength(6);
	});
});
