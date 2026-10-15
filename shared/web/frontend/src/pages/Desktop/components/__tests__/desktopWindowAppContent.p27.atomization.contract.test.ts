/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P27 atomization contract: thin desktopWindowAppContent orchestrator + module split.
 *
 * Related:
 * - components/desktopWindowAppContent.tsx
 * - desktopWindowAppContent/renderDesktopWindowAppContent.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('desktopWindowAppContent P27 atomization contract', () => {
	it('parent stays under 800 LOC, re-exports public API, and wires extracted modules', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const parentPath = join(dir, '../desktopWindowAppContent.tsx');
		const src = readFileSync(parentPath, 'utf8');
		const lineCount = src.split('\n').length;

		expect(lineCount).toBeLessThanOrEqual(800);
		expect(src).toContain(
			"export type { DesktopWindowAppCallbacks } from './desktopWindowAppContent/types'"
		);
		expect(src).toContain(
			"export { getDesktopWindowAppContent } from './desktopWindowAppContent/renderDesktopWindowAppContent'"
		);
		expect(src).toContain('lazyImports.ts');
		expect(src).toContain('mounts.tsx');
		expect(src).toContain('renderDesktopWindowAppContent.tsx');
	});
});
