/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock VirtualGrid to measured rows so short estimates cannot stack cards.
 *
 * Related:
 * - ../VirtualList.tsx
 * - documentation/product/FRONTEND-VIRTUAL-LIST-AND-PERF-PATTERNS.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('VirtualGrid measure contract', () => {
	it('measures grid rows instead of forcing fixed rowHeight on cells', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../VirtualList.tsx'), 'utf8');
		const gridIdx = src.indexOf('export function VirtualGrid');
		expect(gridIdx).toBeGreaterThan(-1);
		const gridSrc = src.slice(gridIdx);
		expect(gridSrc).toContain('VirtualVariableRow');
		expect(gridSrc).toContain('measureElement={virtualizer.measureElement}');
		expect(gridSrc).not.toContain('heightPx={rowHeight}');
		expect(gridSrc).not.toContain('function VirtualGridRow');
		expect(src).toContain(
			'Actual row height is measured (`measureElement` + ResizeObserver)'
		);
	});
});
