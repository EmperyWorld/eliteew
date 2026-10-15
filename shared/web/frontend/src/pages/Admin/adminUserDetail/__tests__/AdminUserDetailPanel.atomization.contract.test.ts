/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Layer E lock — AdminUserDetailPanel stable path stays a thin facade;
 * implementation children under adminUserDetail/ stay within LOC budget.
 *
 * Invariants:
 * - Facade ≤50 LOC; re-exports named AdminUserDetailPanel.
 * - Each adminUserDetail child ≤800 LOC.
 * - Sibling hub/types/i18n modules remain shared (not duplicated).
 *
 * Related:
 * - ../../AdminUserDetailPanel.tsx (stable path)
 * - documentation/platform/UNIFIED-ADMIN-SHELL.md
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { AdminUserDetailPanel } from '@/pages/Admin/AdminUserDetailPanel';

describe('AdminUserDetailPanel atomization contract', () => {
	const testDir = dirname(fileURLToPath(import.meta.url));
	const moduleDir = join(testDir, '..');
	const adminDir = join(moduleDir, '..');
	const facadePath = join(adminDir, 'AdminUserDetailPanel.tsx');

	it('re-exports named AdminUserDetailPanel from the stable facade path', () => {
		expect(typeof AdminUserDetailPanel).toBe('function');
	});

	it('facade stays ≤50 LOC and only re-exports adminUserDetail implementation', () => {
		const src = readFileSync(facadePath, 'utf8');
		const lineCount = src.replace(/\n$/, '').split('\n').length;
		expect(lineCount).toBeLessThanOrEqual(50);
		expect(src).toContain("from './adminUserDetail/AdminUserDetailPanel'");
		expect(src).toContain('AdminUserDetailPanel');
		expect(src).not.toMatch(/export function\s+AdminUserDetailPanel\s*\(/);
		expect(src).not.toMatch(/useAdminUserDetailPanel\s*\(/);
		expect(src).not.toMatch(/getUserSsoOverview/);
	});

	it('preserves AdminUsersHubSection relative import path', () => {
		const hubPath = join(adminDir, 'AdminUsersHubSection.tsx');
		const hubSrc = readFileSync(hubPath, 'utf8');
		expect(hubSrc).toContain("from './AdminUserDetailPanel'");
	});

	it('adminUserDetail child modules exist and stay ≤800 LOC each', () => {
		const expected = [
			'AdminUserDetailPanel.tsx',
			'AdminUserDetailPanelHeader.tsx',
			'AdminUserDetailOverviewTab.tsx',
			'AdminUserDetailStoreTab.tsx',
			'AdminUserDetailUgsTab.tsx',
			'AdminUserDetailSessionsTab.tsx',
			'useAdminUserDetailPanel.ts',
			'types.ts',
			'constants.ts',
		];
		const names = new Set(
			readdirSync(moduleDir).filter((n) => /\.tsx?$/.test(n))
		);
		for (const mod of expected) {
			expect(names.has(mod), mod).toBe(true);
			const lines = readFileSync(join(moduleDir, mod), 'utf8').split(
				'\n'
			).length;
			expect(lines, mod).toBeLessThanOrEqual(800);
		}
	});

	it('reuses sibling hub modules instead of duplicating them', () => {
		const names = readdirSync(moduleDir);
		expect(names.some((n) => /adminUsersDetailTab/.test(n))).toBe(false);
		expect(names.some((n) => /adminDirectoryUserTypes/.test(n))).toBe(false);
		expect(names.some((n) => /AdminPresenceSection/.test(n))).toBe(false);

		const shell = readFileSync(
			join(moduleDir, 'AdminUserDetailPanel.tsx'),
			'utf8'
		);
		expect(shell).toContain("../adminUsersDetailTab'");
		expect(shell).toContain("../AdminPresenceSection'");
	});
});
