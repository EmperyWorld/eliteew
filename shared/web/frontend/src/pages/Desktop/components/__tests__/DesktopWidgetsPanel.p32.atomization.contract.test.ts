/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P32 atomization contract: thin DesktopWidgetsPanel aggregator + module split.
 *
 * Related:
 * - components/DesktopWidgetsPanel.tsx
 * - components/desktopWidgetsPanel/*
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('DesktopWidgetsPanel P32 atomization contract', () => {
	it('parent stays under 800 LOC, re-exports public API, and wires extracted modules', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const parentPath = join(dir, '../DesktopWidgetsPanel.tsx');
		const src = readFileSync(parentPath, 'utf8');
		const lineCount = src.split('\n').length;

		expect(lineCount).toBeLessThanOrEqual(800);
		expect(src).toContain("from './desktopWidgetsPanel/DesktopWidgetsPanel'");
		expect(src).toContain('export {');
		expect(src).toContain('DesktopWidgetsPanel');
		expect(src).toContain('DesktopWidgetsPanelProps');
	});

	it('child modules stay under 800 LOC each', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const childDir = join(dir, '../desktopWidgetsPanel');
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
