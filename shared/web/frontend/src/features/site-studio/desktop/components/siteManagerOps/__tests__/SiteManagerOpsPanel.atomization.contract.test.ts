/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Layer E lock — SiteManagerOpsPanel stable path stays a thin facade;
 * implementation children under siteManagerOps/ stay within LOC budget.
 *
 * Invariants:
 * - Facade ≤50 LOC; re-exports named SiteManagerOpsPanel and default.
 * - Each siteManagerOps child ≤800 LOC.
 * - Sibling atoms/drilldown/cards remain shared (not duplicated under siteManagerOps/).
 *
 * Related:
 * - ../../SiteManagerOpsPanel.tsx (stable path)
 * - documentation/product/SITE-STUDIO.md
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { SiteManagerOpsPanel } from '@/features/site-studio/desktop/components/SiteManagerOpsPanel';
import SiteManagerOpsPanelDefault from '@/features/site-studio/desktop/components/SiteManagerOpsPanel';

describe('SiteManagerOpsPanel atomization contract', () => {
	const testDir = dirname(fileURLToPath(import.meta.url));
	const moduleDir = join(testDir, '..');
	const componentsDir = join(moduleDir, '..');
	const facadePath = join(componentsDir, 'SiteManagerOpsPanel.tsx');

	it('re-exports named and default component from the stable facade path', () => {
		expect(typeof SiteManagerOpsPanel).toBe('function');
		expect(typeof SiteManagerOpsPanelDefault).toBe('function');
		expect(SiteManagerOpsPanelDefault).toBe(SiteManagerOpsPanel);
	});

	it('facade stays ≤50 LOC and only re-exports siteManagerOps implementation', () => {
		const src = readFileSync(facadePath, 'utf8');
		const lineCount = src.replace(/\n$/, '').split('\n').length;
		expect(lineCount).toBeLessThanOrEqual(50);
		expect(src).toContain("from './siteManagerOps/SiteManagerOpsPanel'");
		expect(src).toContain('SiteManagerOpsPanel');
		expect(src).toContain('default');
		expect(src).not.toMatch(/export const\s+SiteManagerOpsPanel\s*:/);
		expect(src).not.toMatch(/useSiteManagerOps\s*\(/);
		expect(src).not.toMatch(/function formatDate/);
		expect(src).not.toMatch(/ DomainsModePanel/);
	});

	it('preserves desktop lazy and admin named-import paths', () => {
		const lazyPath = join(
			componentsDir,
			'../../../../pages/Desktop/components/desktopWindowAppContent/lazyImports.ts'
		);
		const adminPath = join(
			componentsDir,
			'../../../../pages/Admin/shell/AdminSectionLazy.tsx'
		);
		const lazySrc = readFileSync(lazyPath, 'utf8');
		const adminSrc = readFileSync(adminPath, 'utf8');
		expect(lazySrc).toContain(
			'features/site-studio/desktop/components/SiteManagerOpsPanel'
		);
		expect(adminSrc).toContain(
			'features/site-studio/desktop/components/SiteManagerOpsPanel'
		);
		expect(adminSrc).toContain('default: m.SiteManagerOpsPanel');
	});

	it('siteManagerOps child modules exist and stay ≤800 LOC each', () => {
		const expected = [
			'SiteManagerOpsPanel.tsx',
			'AttentionModePanel.tsx',
			'DomainsModePanel.tsx',
			'AdvancedModePanel.tsx',
			'DomainStepperCard.tsx',
			'KirsCollaborationOpsCard.tsx',
			'RecoveryCard.tsx',
			'useSiteManagerOps.ts',
			'siteManagerOpsFormatters.ts',
			'siteManagerOpsStorage.ts',
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

	it('reuses sibling atoms/drilldown/cards instead of duplicating them', () => {
		const names = readdirSync(moduleDir);
		expect(names.some((n) => /SiteManagerOpsAtoms/.test(n))).toBe(false);
		expect(names.some((n) => /SiteManagerDrilldownPanel/.test(n))).toBe(false);
		expect(names.some((n) => /SiteManagerSiteCards/.test(n))).toBe(false);

		const impl = readFileSync(
			join(moduleDir, 'SiteManagerOpsPanel.tsx'),
			'utf8'
		);
		const attention = readFileSync(
			join(moduleDir, 'AttentionModePanel.tsx'),
			'utf8'
		);
		expect(impl).toContain("../SiteManagerOpsAtoms'");
		expect(attention).toContain("../SiteManagerDrilldownPanel'");
		expect(attention).toContain("../SiteManagerSiteCards'");
	});
});
