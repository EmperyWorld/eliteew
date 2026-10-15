/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Layer E lock — CompanionDocumentEditorMode stable path stays a thin facade;
 * implementation children under companionDocumentEditor/ stay within LOC budget.
 *
 * Invariants:
 * - Facade ≤50 LOC; re-exports named CompanionDocumentEditorMode.
 * - Each companionDocumentEditor child ≤800 LOC.
 * - Sibling draft/sync/structure modules remain shared (not duplicated).
 *
 * Related:
 * - ../../CompanionDocumentEditorMode.tsx (stable path)
 * - documentation/product/ewa/EWA-COMPANION-DOC-EDITOR-AND-SHELL-CONTEXT.md
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { CompanionDocumentEditorMode } from '@/features/ewa/companionOutputSurface/CompanionDocumentEditorMode';

describe('CompanionDocumentEditorMode atomization contract', () => {
	const testDir = dirname(fileURLToPath(import.meta.url));
	const moduleDir = join(testDir, '..');
	const surfaceDir = join(moduleDir, '..');
	const facadePath = join(surfaceDir, 'CompanionDocumentEditorMode.tsx');

	it('re-exports named CompanionDocumentEditorMode from the stable facade path', () => {
		expect(typeof CompanionDocumentEditorMode).toBe('function');
	});

	it('facade stays ≤50 LOC and only re-exports companionDocumentEditor implementation', () => {
		const src = readFileSync(facadePath, 'utf8');
		const lineCount = src.replace(/\n$/, '').split('\n').length;
		expect(lineCount).toBeLessThanOrEqual(50);
		expect(src).toContain(
			"from './companionDocumentEditor/CompanionDocumentEditorMode'"
		);
		expect(src).toContain('CompanionDocumentEditorMode');
		expect(src).not.toMatch(
			/export function\s+CompanionDocumentEditorMode\s*\(/
		);
		expect(src).not.toMatch(/useCompanionDocumentEditorMode\s*\(/);
		expect(src).not.toMatch(/streamEwaCompanionDocumentAiTransform/);
	});

	it('preserves CompanionOutputSurface import path', () => {
		const surfacePath = join(surfaceDir, 'CompanionOutputSurface.tsx');
		const surfaceSrc = readFileSync(surfacePath, 'utf8');
		expect(surfaceSrc).toContain(
			"from '@/features/ewa/companionOutputSurface/CompanionDocumentEditorMode'"
		);
	});

	it('companionDocumentEditor child modules exist and stay ≤800 LOC each', () => {
		const expected = [
			'CompanionDocumentEditorMode.tsx',
			'CompanionDocumentEditorModeView.tsx',
			'CompanionDocumentEditorActionControls.tsx',
			'useCompanionDocumentEditorMode.ts',
			'helpers.ts',
			'types.ts',
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

	it('reuses sibling draft/sync/structure modules instead of duplicating them', () => {
		const names = readdirSync(moduleDir);
		expect(names.some((n) => /CompanionDocumentStructurePanel/.test(n))).toBe(
			false
		);
		expect(
			names.some((n) => /useCompanionDocumentServerDraftSync/.test(n))
		).toBe(false);
		expect(
			names.some((n) => /companionDocumentSurfaceDraftState/.test(n))
		).toBe(false);

		const hook = readFileSync(
			join(moduleDir, 'useCompanionDocumentEditorMode.ts'),
			'utf8'
		);
		expect(hook).toContain("useCompanionDocumentServerDraftSync'");
		expect(hook).toContain("companionDocumentSurfaceDraftState'");
		expect(hook).toContain("CompanionDocumentStructurePanel'");
	});
});
