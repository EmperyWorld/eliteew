/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P23 atomization contract: thin QuickSearch orchestrator + module split.
 *
 * Related:
 * - components/QuickSearch.tsx
 * - quickSearch/useQuickSearchModel.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('QuickSearch P23 atomization contract', () => {
	it('parent QuickSearch.tsx stays under 800 LOC and wires extracted modules', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const parentPath = join(dir, '../QuickSearch.tsx');
		const src = readFileSync(parentPath, 'utf8');
		const lineCount = src.split('\n').length;

		expect(lineCount).toBeLessThanOrEqual(800);
		expect(src).toContain('export type { QuickAction }');
		expect(src).toContain('useQuickSearchModel');
		expect(src).toContain('QuickSearchResultsBody');
		expect(src).toContain('QuickSearchContextMenu');
	});
});
