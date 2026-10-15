/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock companion tools catalog self-portals to CompanionToolsCatalogPortal shell.
 *
 * Related:
 * - ../CompanionToolsCatalogPanel.tsx
 * - ../CompanionToolsCatalogPortal.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('CompanionToolsCatalogPanel portal theme contract', () => {
	it('sheet/backdrop/body host use CompanionToolsCatalogPortal, not bare body', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../CompanionToolsCatalogPanel.tsx'),
			'utf8'
		);
		expect(src).toContain('CompanionToolsCatalogPortal');
		expect(src).not.toMatch(/createPortal\s*\(/);
		expect(src).not.toMatch(/document\.body/);
	});
});
