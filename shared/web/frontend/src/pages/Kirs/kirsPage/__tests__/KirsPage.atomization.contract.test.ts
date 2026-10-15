/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Layer E lock — KirsPage stable path stays a thin facade;
 * implementation children under kirsPage/ stay within LOC budget.
 *
 * Invariants:
 * - Facade ≤50 LOC; re-exports named KirsPage and default.
 * - Each kirsPage child ≤800 LOC.
 * - Sibling modules (kirsRuntimeGuards, KirsSiteStudioAdminPanel, etc.) remain in parent.
 *
 * Related:
 * - ../../KirsPage.tsx (stable path)
 * - documentation/product/KIRS-SITE-CURATION.md
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { KirsPage } from '@/pages/Kirs/KirsPage';
import KirsPageDefault from '@/pages/Kirs/KirsPage';

describe('KirsPage atomization contract', () => {
	const testDir = dirname(fileURLToPath(import.meta.url));
	const moduleDir = join(testDir, '..');
	const kirsDir = join(moduleDir, '..');
	const facadePath = join(kirsDir, 'KirsPage.tsx');

	it('re-exports named and default component from the stable facade path', () => {
		expect(typeof KirsPage).toBe('function');
		expect(typeof KirsPageDefault).toBe('function');
		expect(KirsPageDefault).toBe(KirsPage);
	});

	it('facade stays ≤50 LOC and only re-exports kirsPage implementation', () => {
		const src = readFileSync(facadePath, 'utf8');
		const lineCount = src.replace(/\n$/, '').split('\n').length;
		expect(lineCount).toBeLessThanOrEqual(50);
		expect(src).toContain("from './kirsPage/KirsPage'");
		expect(src).toContain('KirsPage');
		expect(src).toContain('default');
		expect(src).not.toMatch(/export const\s+KirsPage\s*:/);
		expect(src).not.toMatch(/useKirsPage\s*\(/);
		expect(src).not.toMatch(/listKirsOperatorProjects/);
	});

	it('preserves desktop lazy import path', () => {
		const lazyPath = join(
			kirsDir,
			'../Desktop/components/desktopWindowAppContent/lazyImports.ts'
		);
		const lazySrc = readFileSync(lazyPath, 'utf8');
		expect(lazySrc).toContain("import('../../../Kirs/KirsPage')");
	});

	it('inner compose delegates to useKirsPage and subpanels', () => {
		const innerPath = join(moduleDir, 'KirsPage.tsx');
		const src = readFileSync(innerPath, 'utf8');
		expect(src).toContain("from './useKirsPage'");
		expect(src).toContain('useKirsPage()');
		expect(src).toContain('<KirsProjectsListPanel');
		expect(src).toContain('<KirsDetailPanel');
		expect(src).toContain('SpotlightGuideModal');
		expect(src).toContain('ConfirmDeleteModal');
		expect(src).not.toMatch(/\bfunction\s+formatRuCountWord\b/);
		expect(src).not.toMatch(/listKirsOperatorProjects/);
	});

	it('useKirsPage wires queries, mutations, and handlers', () => {
		const src = readFileSync(join(moduleDir, 'useKirsPage.ts'), 'utf8');
		expect(src).toContain('listKirsOperatorProjects');
		expect(src).toContain('getKirsProjectInstance');
		expect(src).toContain('provisionKirsInstance');
		expect(src).toContain('createKirsDomainBinding');
		expect(src).toContain('updateKirsCollaborationState');
		expect(src).toContain('confirmKirsDelete');
		expect(src).toContain('computeKirsRuntimeUi');
	});

	it('kirsPage child modules exist and stay ≤800 LOC each', () => {
		const expected = [
			'KirsPage.tsx',
			'kirsPageConstants.ts',
			'useKirsPage.ts',
			'KirsPageToolbar.tsx',
			'KirsProjectsListPanel.tsx',
			'KirsCreateInstancePanel.tsx',
			'KirsPanelTabs.tsx',
			'KirsAdminTabContent.tsx',
			'KirsDetailPanel.tsx',
			'KirsConsoleRuntimeSection.tsx',
			'KirsConsoleDomainsSection.tsx',
			'KirsConsoleAccessDeleteSection.tsx',
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

	it('reuses sibling modules from parent Kirs/ instead of duplicating', () => {
		const adminSrc = readFileSync(
			join(moduleDir, 'KirsAdminTabContent.tsx'),
			'utf8'
		);
		const hookSrc = readFileSync(join(moduleDir, 'useKirsPage.ts'), 'utf8');
		expect(adminSrc).toContain("import('../KirsSiteStudioAdminPanel')");
		expect(hookSrc).toContain('../kirsRuntimeGuards');
		expect(hookSrc).toContain('../kirsCurationGuideConstants');

		const names = readdirSync(moduleDir);
		expect(names.some((n) => /kirsRuntimeGuards/.test(n))).toBe(false);
		expect(names.some((n) => /KirsSiteStudioAdminPanel/.test(n))).toBe(false);
		expect(names.some((n) => /kirsCurationGuideConstants/.test(n))).toBe(false);
	});
});
