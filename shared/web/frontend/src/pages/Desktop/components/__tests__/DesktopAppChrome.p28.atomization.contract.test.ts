/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P28 atomization contract: thin DesktopAppChrome aggregator + module split.
 *
 * Related:
 * - components/DesktopAppChrome.tsx
 * - components/desktopAppChrome/*
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('DesktopAppChrome P28 atomization contract', () => {
	it('parent stays under 800 LOC, re-exports public API, and wires extracted modules', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const parentPath = join(dir, '../DesktopAppChrome.tsx');
		const src = readFileSync(parentPath, 'utf8');
		const lineCount = src.split('\n').length;

		expect(lineCount).toBeLessThanOrEqual(800);
		expect(src).not.toMatch(/export const DesktopAppButton/);
		expect(src).not.toMatch(/export const DesktopAppMenuSurface/);
		expect(src).toContain("from './desktopAppChrome/styleContract'");
		expect(src).toContain("from './desktopAppChrome/surfaces'");
		expect(src).toContain("from './desktopAppChrome/productWorkspace'");
		expect(src).toContain("from './desktopAppChrome/controls'");
		expect(src).toContain("from './desktopAppChrome/states'");
		expect(src).toContain("from './desktopAppChrome/modal'");
		expect(src).toContain("from './desktopAppChrome/menu'");
		expect(src).toContain('DesktopAppButton');
		expect(src).toContain('DesktopAppMenuSurface');
		expect(src).toContain('DESKTOP_APP_STYLE_CONTRACT');
		expect(src).toContain('getDesktopAppFamily');
		expect(src).toContain('DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME');
	});

	it('child modules stay under 800 LOC each', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const childDir = join(dir, '../desktopAppChrome');
		const modules = [
			'styleContract.ts',
			'surfaces.tsx',
			'controls.tsx',
			'states.tsx',
			'modal.tsx',
			'menu.tsx',
			'productWorkspace.tsx',
		];
		for (const mod of modules) {
			const lines = readFileSync(join(childDir, mod), 'utf8').split(
				'\n'
			).length;
			expect(lines, mod).toBeLessThanOrEqual(800);
		}
	});
});
