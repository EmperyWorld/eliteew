/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Layer E lock — DesktopAppStoreAdminPage barrel stays thin and re-exports public API after atomization.
 *
 * Invariants:
 * - Consumers import from `../DesktopAppStoreAdminPage` (barrel), not deep module paths.
 * - Parent barrel ≤800 LOC; no child module >800 LOC.
 *
 * Related:
 * - `pages/Desktop/DesktopAppStoreAdminPage.tsx`
 * - `documentation/product/desktop/DESKTOP-APP-STORE-ADMIN-INTERFACE-AUDIT-NOTE.md`
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	AdminTabLoading,
	DesktopAppStoreAdminPage,
} from '../DesktopAppStoreAdminPage';

describe('DesktopAppStoreAdminPage atomization contract', () => {
	it('re-exports public page and loading symbols from the barrel', () => {
		expect(typeof DesktopAppStoreAdminPage).toBe('function');
		expect(typeof AdminTabLoading).toBe('function');
	});

	it('barrel stays under 800 LOC and only re-exports DesktopAppStoreAdmin modules', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const barrelPath = join(dir, '../DesktopAppStoreAdminPage.tsx');
		const src = readFileSync(barrelPath, 'utf8');
		const lineCount = src.split('\n').length;
		expect(lineCount).toBeLessThanOrEqual(800);
		expect(src).toContain("from './DesktopAppStoreAdmin/AdminTabLoading'");
		expect(src).toContain(
			"from './DesktopAppStoreAdmin/DesktopAppStoreAdminPage'"
		);
		expect(src).toContain("from './DesktopAppStoreAdmin/types'");
		expect(src).not.toMatch(/export function DesktopAppStoreAdminPage\s*\(/);
	});

	it('child modules stay under 800 LOC each', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const childDir = join(dir, '../DesktopAppStoreAdmin');
		for (const name of readdirSync(childDir)) {
			if (!/\.(ts|tsx)$/.test(name)) continue;
			const lines = readFileSync(join(childDir, name), 'utf8').split(
				'\n'
			).length;
			expect(lines, name).toBeLessThanOrEqual(800);
		}
	});
});
