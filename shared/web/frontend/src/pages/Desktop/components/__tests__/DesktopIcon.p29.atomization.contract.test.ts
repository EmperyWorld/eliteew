/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P29 atomization contract: thin DesktopIcon aggregator + module split.
 *
 * Related:
 * - components/DesktopIcon.tsx
 * - components/desktopIcon/*
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('DesktopIcon P29 atomization contract', () => {
	it('parent stays under 800 LOC, re-exports public API, and wires extracted modules', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const parentPath = join(dir, '../DesktopIcon.tsx');
		const src = readFileSync(parentPath, 'utf8');
		const lineCount = src.split('\n').length;

		expect(lineCount).toBeLessThanOrEqual(800);
		expect(src).toContain("from './desktopIcon/iconVisualStyles'");
		expect(src).toContain("from './desktopIcon/DesktopIcon'");
		expect(src).toContain("from './desktopIcon/types'");
		expect(src).toContain('ICON_VISUAL_STYLES');
		expect(src).toContain('ICON_STYLE_CARD_SAMPLE_APPS');
		expect(src).toContain('DesktopIcon');
		expect(src).not.toMatch(/export const ICON_VISUAL_STYLES/);
		expect(src).not.toMatch(/function getFileIcon/);
	});

	it('child modules stay under 800 LOC each', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const childDir = join(dir, '../desktopIcon');
		const modules = [
			'types.ts',
			'badgeHelpers.ts',
			'iconVisualStyles.ts',
			'fileIcon.tsx',
			'useDesktopIconDrag.ts',
			'useDesktopIconExternalDrag.ts',
			'DesktopIconSurface.tsx',
			'DesktopIcon.tsx',
		];
		for (const mod of modules) {
			const lines = readFileSync(join(childDir, mod), 'utf8').split(
				'\n'
			).length;
			expect(lines, mod).toBeLessThanOrEqual(800);
		}
	});
});
