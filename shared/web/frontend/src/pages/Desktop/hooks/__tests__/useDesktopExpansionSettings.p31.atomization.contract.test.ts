/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P31 atomization contract: thin useDesktopExpansionSettings aggregator + module split.
 *
 * Related:
 * - hooks/useDesktopExpansionSettings.ts
 * - hooks/desktopExpansionSettings/*
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('useDesktopExpansionSettings P31 atomization contract', () => {
	it('parent stays under 800 LOC, re-exports public API, and wires extracted modules', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const parentPath = join(dir, '../useDesktopExpansionSettings.ts');
		const src = readFileSync(parentPath, 'utf8');
		const lineCount = src.split('\n').length;

		expect(lineCount).toBeLessThanOrEqual(800);
		expect(src).toContain(
			"from './desktopExpansionSettings/useDesktopExpansionSettings'"
		);
		expect(src).toContain('export {');
		expect(src).toContain('useDesktopExpansionSettings');
		expect(src).toContain('UseDesktopExpansionSettingsParams');
	});

	it('child modules stay under 800 LOC each', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const childDir = join(dir, '../desktopExpansionSettings');
		const modules = [
			'constants.ts',
			'normalizers.ts',
			'layoutHelpers.ts',
			'expansionStorageMap.ts',
			'useDesktopExpansionShellCore.ts',
			'useDesktopExpansionWorkspaceActions.ts',
			'useDesktopExpansionWindowLayoutActions.ts',
			'useDesktopExpansionWidgetActions.ts',
			'useDesktopExpansionDiscoveryActions.ts',
			'useDesktopExpansionSettings.ts',
		];
		for (const mod of modules) {
			const lines = readFileSync(join(childDir, mod), 'utf8').split(
				'\n'
			).length;
			expect(lines, mod).toBeLessThanOrEqual(800);
		}
	});
});
