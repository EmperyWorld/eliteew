/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 0 source lock — work-area ResizeObserver fits non-maximized windows
 * (Settings 720 → ≤390), not only maximized sync.
 *
 * Related:
 * - hooks/useWindowManager.ts
 * - hooks/windowManagerRestoreGeometry.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const wmSourcePath = join(
	dirname(fileURLToPath(import.meta.url)),
	'../useWindowManager.ts'
);

describe('useWindowManager work-area fit (Wave 0)', () => {
	const src = readFileSync(wmSourcePath, 'utf8');

	it('wires commitWindowsIntoWorkArea on desktop-main resize', () => {
		expect(src).toContain('commitWindowsIntoWorkArea');
		expect(src).toContain('syncMaximizedWindowsList');
		expect(src).toContain('ResizeObserver');
		expect(src).toContain('syncWorkAreaGeometry');
		expect(src).toContain('!w.isMaximized');
	});

	it('fits non-maximized geometry on open commit', () => {
		expect(src).toContain('fitWindowIntoWorkArea');
		expect(src).toContain('readDesktopWorkArea');
	});
});
