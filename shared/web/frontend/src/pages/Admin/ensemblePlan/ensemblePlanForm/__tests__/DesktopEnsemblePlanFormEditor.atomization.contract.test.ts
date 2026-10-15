/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Layer E lock — DesktopEnsemblePlanFormEditor stays a thin orchestrator;
 * section modules under ensemblePlanForm/ stay within LOC budget.
 *
 * Invariants:
 * - Stable path exports named DesktopEnsemblePlanFormEditor.
 * - Parent ≤400 LOC; each ensemblePlanForm child ≤500 LOC.
 * - Workbench keeps relative import `../ensemblePlan/DesktopEnsemblePlanFormEditor`.
 *
 * Related:
 * - ../DesktopEnsemblePlanFormEditor.tsx
 * - documentation/product/DESKTOP-ENSEMBLE-PLAN-AUTHORING.md
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DesktopEnsemblePlanFormEditor } from '@/pages/Admin/ensemblePlan/DesktopEnsemblePlanFormEditor';

describe('DesktopEnsemblePlanFormEditor atomization contract', () => {
	const testDir = dirname(fileURLToPath(import.meta.url));
	const formDir = join(testDir, '..');
	const ensemblePlanDir = join(formDir, '..');
	const parentPath = join(ensemblePlanDir, 'DesktopEnsemblePlanFormEditor.tsx');

	const expectedChildren = [
		'editorShared.ts',
		'editorI18n.tsx',
		'EnsemblePlanFormChrome.tsx',
		'EnsemblePlanBasicsSection.tsx',
		'EnsemblePlanStepsSection.tsx',
		'EnsemblePlanOutlineSection.tsx',
		'EnsemblePlanAdvancedSection.tsx',
		'EnsemblePlanJsonPanel.tsx',
	] as const;

	it('exports named DesktopEnsemblePlanFormEditor from the stable path', () => {
		expect(typeof DesktopEnsemblePlanFormEditor).toBe('function');
	});

	it('parent orchestrator stays ≤400 LOC and composes ensemblePlanForm sections', () => {
		const src = readFileSync(parentPath, 'utf8');
		const lineCount = src.replace(/\n$/, '').split('\n').length;
		expect(lineCount).toBeLessThanOrEqual(400);
		expect(src).toContain(
			"from './ensemblePlanForm/EnsemblePlanBasicsSection'"
		);
		expect(src).toContain("from './ensemblePlanForm/EnsemblePlanStepsSection'");
		expect(src).toContain(
			"from './ensemblePlanForm/EnsemblePlanOutlineSection'"
		);
		expect(src).toContain(
			"from './ensemblePlanForm/EnsemblePlanAdvancedSection'"
		);
		expect(src).toContain("from './ensemblePlanForm/EnsemblePlanFormChrome'");
		expect(src).toContain("from './ensemblePlanForm/EnsemblePlanJsonPanel'");
		expect(src).toContain('export function DesktopEnsemblePlanFormEditor');
		expect(src).not.toMatch(/\bfunction\s+StepEditor\b/);
		expect(src).not.toMatch(/\bfunction\s+OutlineSectionEditor\b/);
		expect(src).not.toMatch(/\bfunction\s+GlobalSlotsEditor\b/);
	});

	it('preserves EnsemblePlanWorkbench relative import path', () => {
		const workbench = readFileSync(
			join(ensemblePlanDir, '../desktopAiChat/EnsemblePlanWorkbench.tsx'),
			'utf8'
		);
		expect(workbench).toContain(
			"from '../ensemblePlan/DesktopEnsemblePlanFormEditor'"
		);
	});

	it('ensemblePlanForm children exist and stay ≤500 LOC each', () => {
		const names = new Set(
			readdirSync(formDir).filter((n) => /\.tsx?$/.test(n))
		);
		for (const mod of expectedChildren) {
			expect(names.has(mod), mod).toBe(true);
			const lines = readFileSync(join(formDir, mod), 'utf8').split('\n').length;
			expect(lines, mod).toBeLessThanOrEqual(500);
		}
	});

	it('steps section keeps drag / move aria i18n keys', () => {
		const steps = readFileSync(
			join(formDir, 'EnsemblePlanStepsSection.tsx'),
			'utf8'
		);
		expect(steps).toContain('adminEnsemblePlan.editor.dragStepAria');
		expect(steps).toContain('moveUpAria');
		expect(steps).toContain('moveDownAria');
	});

	it('chrome keeps assertive validation alerts', () => {
		const chrome = readFileSync(
			join(formDir, 'EnsemblePlanFormChrome.tsx'),
			'utf8'
		);
		expect(chrome).toContain('aria-live="assertive"');
	});
});
