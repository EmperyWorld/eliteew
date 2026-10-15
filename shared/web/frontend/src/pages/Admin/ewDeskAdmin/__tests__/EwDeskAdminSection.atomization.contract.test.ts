/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Layer E lock — EwDeskAdminSection stable path stays a thin facade;
 * implementation children under ewDeskAdmin/ stay within LOC budget.
 *
 * Invariants:
 * - Facade ≤50 LOC; re-exports named EwDeskAdminSection.
 * - Each ewDeskAdmin child ≤800 LOC.
 * - Sibling modules (EwDeskMarkdownToolbar, EwDeskContentImagePicker, …) remain shared.
 *
 * Related:
 * - ../../EwDeskAdminSection.tsx (stable path)
 * - documentation/product/desktop/EWDESK-NEWS.md
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { EwDeskAdminSection } from '@/pages/Admin/EwDeskAdminSection';

describe('EwDeskAdminSection atomization contract', () => {
	const testDir = dirname(fileURLToPath(import.meta.url));
	const moduleDir = join(testDir, '..');
	const adminDir = join(moduleDir, '..');
	const facadePath = join(adminDir, 'EwDeskAdminSection.tsx');

	it('re-exports named EwDeskAdminSection from the stable facade path', () => {
		expect(typeof EwDeskAdminSection).toBe('function');
	});

	it('facade stays ≤50 LOC and only re-exports ewDeskAdmin implementation', () => {
		const src = readFileSync(facadePath, 'utf8');
		const lineCount = src.replace(/\n$/, '').split('\n').length;
		expect(lineCount).toBeLessThanOrEqual(50);
		expect(src).toContain("from './ewDeskAdmin/EwDeskAdminSection'");
		expect(src).toContain('EwDeskAdminSection');
		expect(src).not.toMatch(/export function\s+EwDeskAdminSection\s*\(/);
		expect(src).not.toMatch(/useEwDeskAdminSection\s*\(/);
		expect(src).not.toMatch(/adminListNews/);
	});

	it('preserves AdminSectionLazy relative import path', () => {
		const lazyPath = join(adminDir, 'shell/AdminSectionLazy.tsx');
		const lazySrc = readFileSync(lazyPath, 'utf8');
		expect(lazySrc).toContain("import('../EwDeskAdminSection')");
	});

	it('inner compose delegates to useEwDeskAdminSection and subpanels', () => {
		const innerPath = join(moduleDir, 'EwDeskAdminSection.tsx');
		const src = readFileSync(innerPath, 'utf8');
		expect(src).toContain("from './useEwDeskAdminSection'");
		expect(src).toContain('useEwDeskAdminSection()');
		expect(src).toContain('<EwDeskAdminEditNewsForm');
		expect(src).toContain('EwDeskAdminNewsImagePreview');
		expect(src).not.toMatch(/\bfunction\s+isoToDatetimeLocal\b/);
		expect(src).not.toMatch(/adminListNews/);
	});

	it('useEwDeskAdminSection wires queries, mutations, and handlers', () => {
		const src = readFileSync(
			join(moduleDir, 'useEwDeskAdminSection.ts'),
			'utf8'
		);
		expect(src).toContain('adminListNews');
		expect(src).toContain('adminCreateNews');
		expect(src).toContain('adminUpdateNews');
		expect(src).toContain('adminDeleteNews');
		expect(src).toContain('adminPolishNewsBody');
		expect(src).toContain('runBulkAiRegenerate');
	});

	it('ewDeskAdmin child modules exist and stay ≤800 LOC each', () => {
		const expected = [
			'EwDeskAdminSection.tsx',
			'ewDeskAdminHelpers.ts',
			'EwDeskAdminMediaPreviews.tsx',
			'EwDeskNewsAiPolishButton.tsx',
			'EwDeskAdminEditNewsForm.tsx',
			'useEwDeskAdminSection.ts',
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

	it('reuses sibling modules from parent Admin/ instead of duplicating', () => {
		const shell = readFileSync(
			join(moduleDir, 'EwDeskAdminSection.tsx'),
			'utf8'
		);
		const editForm = readFileSync(
			join(moduleDir, 'EwDeskAdminEditNewsForm.tsx'),
			'utf8'
		);
		expect(shell).toContain("../EwDeskMarkdownToolbar'");
		expect(shell).toContain("../EwDeskContentImagePicker'");
		expect(editForm).toContain('../EwDeskNewsTemplateAndLinks');
		expect(editForm).toContain('../EwDeskMarkdownToolbar');

		const names = readdirSync(moduleDir);
		expect(names.some((n) => /EwDeskMarkdownToolbar/.test(n))).toBe(false);
		expect(names.some((n) => /EwDeskContentImagePicker/.test(n))).toBe(false);
		expect(names.some((n) => /ewDeskNewsTemplates/.test(n))).toBe(false);
	});
});
