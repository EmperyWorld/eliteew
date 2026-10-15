/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract: idle desktop must not sync-import UGSDesktopContainer.
 *
 * Invariants:
 * - UGS / UGSHubApp mount via React.lazy, not a static import.
 *
 * Related:
 * - `desktopWindowAppContent/lazyImports.ts`
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('desktopWindowAppContent UGS lazy boundary', () => {
	it('lazy-loads UGSDesktopContainer instead of a static import', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../desktopWindowAppContent/lazyImports.ts'),
			'utf8'
		);

		expect(src).not.toMatch(
			/import\s+\{\s*UGSDesktopContainer\s*\}\s+from\s+['"]\.\.\/UGSDesktopContainer['"]/
		);
		expect(src).toContain('UGSDesktopContainerLazy');
		expect(src).toContain("import('../UGSDesktopContainer')");
		expect(src).toMatch(/lazy\(\s*\(\)\s*=>/);
	});
});
