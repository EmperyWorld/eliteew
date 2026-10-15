/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source lock — EnhancedWindow imports `readDesktopWorkArea` for restore/minimize clamp
 * (missing import → ReferenceError crash on title-bar restore).
 *
 * Related:
 * - components/EnhancedWindow.tsx
 * - utils/desktopSnapGeometry.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const sourcePath = join(
	dirname(fileURLToPath(import.meta.url)),
	'../EnhancedWindow.tsx'
);

describe('EnhancedWindow work-area import lock', () => {
	const src = readFileSync(sourcePath, 'utf8');

	it('imports and calls readDesktopWorkArea', () => {
		expect(src).toMatch(
			/import\s*\{\s*readDesktopWorkArea\s*\}\s*from\s*['"]\.\.\/utils\/desktopSnapGeometry['"]/
		);
		expect(src).toContain('readDesktopWorkArea()');
	});
});
