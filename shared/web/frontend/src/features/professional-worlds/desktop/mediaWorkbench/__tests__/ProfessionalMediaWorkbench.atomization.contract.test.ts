/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave E LOC lock — ProfessionalMediaWorkbench stable path stays a thin facade;
 * implementation children under mediaWorkbench/ stay within LOC budget.
 *
 * Invariants:
 * - Facade ≤400 LOC; re-exports named component + PW_FALLBACK_PHOTO_PRESETS + context type.
 * - Each mediaWorkbench child ≤500 LOC.
 * - Public import path remains `desktop/ProfessionalMediaWorkbench`.
 *
 * Related:
 * - ../ProfessionalMediaWorkbench.tsx (stable path)
 * - documentation/product/PROFESSIONAL-WORLDS.md
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
	ProfessionalMediaWorkbench,
	PW_FALLBACK_PHOTO_PRESETS,
} from '../../ProfessionalMediaWorkbench';
import type { ProfessionalMediaContextType } from '../../ProfessionalMediaWorkbench';

const here = dirname(fileURLToPath(import.meta.url));
const facadePath = join(here, '../../ProfessionalMediaWorkbench.tsx');
const moduleDir = join(here, '..');

describe('ProfessionalMediaWorkbench Wave E atomization', () => {
	it('re-exports public symbols from the stable facade path', () => {
		expect(typeof ProfessionalMediaWorkbench).toBe('function');
		expect(Array.isArray(PW_FALLBACK_PHOTO_PRESETS)).toBe(true);
		expect(PW_FALLBACK_PHOTO_PRESETS.length).toBeGreaterThan(0);
		const _typeProbe: ProfessionalMediaContextType = 'realtor';
		expect(_typeProbe).toBe('realtor');
	});

	it('facade stays ≤400 LOC and only re-exports mediaWorkbench implementation', () => {
		const src = readFileSync(facadePath, 'utf8');
		const lineCount = src.replace(/\n$/, '').split('\n').length;
		expect(lineCount).toBeLessThanOrEqual(400);
		expect(src).toContain("from './mediaWorkbench/ProfessionalMediaWorkbench'");
		expect(src).toContain("from './mediaWorkbench/constants'");
		expect(src).toContain("from './mediaWorkbench/types'");
		expect(src).toContain('ProfessionalMediaWorkbench');
		expect(src).toContain('PW_FALLBACK_PHOTO_PRESETS');
		expect(src).toContain('ProfessionalMediaContextType');
		expect(src).not.toMatch(
			/export function\s+ProfessionalMediaWorkbench\s*\(/
		);
		expect(src).not.toMatch(/useProfessionalMediaWorkbench\s*\(/);
		expect(src).not.toMatch(/createRealtorMediaBatch/);
	});

	it('mediaWorkbench child modules exist and stay ≤500 LOC each', () => {
		expect(existsSync(moduleDir)).toBe(true);
		const expected = [
			'ProfessionalMediaWorkbench.tsx',
			'useProfessionalMediaWorkbench.ts',
			'MediaWorkbenchAttachedPhotos.tsx',
			'MediaWorkbenchBatchProgress.tsx',
			'MediaWorkbenchAlbumsPanel.tsx',
			'MediaWorkbenchBrandKitPanel.tsx',
			'MediaWorkbenchModals.tsx',
			'constants.ts',
			'types.ts',
			'helpers.ts',
			'FieldGrid.tsx',
		];
		const names = new Set(
			readdirSync(moduleDir).filter((n) => /\.tsx?$/.test(n))
		);
		for (const mod of expected) {
			expect(names.has(mod), mod).toBe(true);
			const lines = readFileSync(join(moduleDir, mod), 'utf8').split(
				'\n'
			).length;
			expect(lines, mod).toBeLessThanOrEqual(500);
		}
		expect(names.size).toBeGreaterThanOrEqual(3);
	});

	it('preserves Objects media panel import path', () => {
		const panelPath = join(
			here,
			'../../runtimePanels/realtorObjects/ListingWorkspaceMediaPanel.tsx'
		);
		const panelSrc = readFileSync(panelPath, 'utf8');
		expect(panelSrc).toContain("from '../../ProfessionalMediaWorkbench'");
	});
});
