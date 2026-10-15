/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P30 atomization contract: thin EnhancedContextMenu aggregator + module split.
 *
 * Related:
 * - components/EnhancedContextMenu.tsx
 * - components/enhancedContextMenu/*
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('EnhancedContextMenu P30 atomization contract', () => {
	it('parent stays under 800 LOC, re-exports public API, and wires extracted modules', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const parentPath = join(dir, '../EnhancedContextMenu.tsx');
		const src = readFileSync(parentPath, 'utf8');
		const lineCount = src.split('\n').length;

		expect(lineCount).toBeLessThanOrEqual(800);
		expect(src).toContain("from './enhancedContextMenu/EnhancedContextMenu'");
		expect(src).toContain('export { EnhancedContextMenu }');
		expect(src).toContain("from './enhancedContextMenu/types'");
		expect(src).toContain('EnhancedContextMenuProps');
	});

	it('child modules stay under 800 LOC each', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const childDir = join(dir, '../enhancedContextMenu');
		const modules = [
			'types.ts',
			'styleContract.ts',
			'branchHelpers.ts',
			'createContextMenuItems.tsx',
			'useEnhancedContextMenuController.ts',
			'ContextMenuItemRow.tsx',
			'EnhancedContextMenu.tsx',
		];
		for (const mod of modules) {
			const lines = readFileSync(join(childDir, mod), 'utf8').split(
				'\n'
			).length;
			expect(lines, mod).toBeLessThanOrEqual(800);
		}
	});
});
