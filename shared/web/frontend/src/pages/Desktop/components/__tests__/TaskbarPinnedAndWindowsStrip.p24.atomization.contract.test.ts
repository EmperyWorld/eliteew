/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P24 atomization contract: thin TaskbarPinnedAndWindowsStrip orchestrator + island split.
 *
 * Related:
 * - components/TaskbarPinnedAndWindowsStrip.tsx
 * - taskbarStrip/TaskbarPinnedMenuIsland.tsx
 * - taskbarStrip/TaskbarWindowsOverflowStrip.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('TaskbarPinnedAndWindowsStrip P24 atomization contract', () => {
	it('parent stays under 800 LOC and wires extracted islands + dense re-exports', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const parentPath = join(dir, '../TaskbarPinnedAndWindowsStrip.tsx');
		const src = readFileSync(parentPath, 'utf8');
		const lineCount = src.split('\n').length;

		expect(lineCount).toBeLessThanOrEqual(800);
		expect(src).toContain('TaskbarPinnedMenuIsland');
		expect(src).toContain('TaskbarWindowsOverflowStrip');
		expect(src).toContain('partitionTaskbarWindowsForStrip');
		expect(src).toContain('TASKBAR_DENSE_WINDOW_COUNT');
		expect(src).toContain('closeFlyouts');
		expect(src).toContain('closeHoverFlyouts');
	});
});
