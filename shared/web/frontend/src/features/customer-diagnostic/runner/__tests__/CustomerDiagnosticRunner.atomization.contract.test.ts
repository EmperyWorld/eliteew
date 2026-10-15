/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Layer E lock — CustomerDiagnosticRunner stable path stays a thin facade;
 * implementation children under runner/ stay within LOC budget.
 *
 * Invariants:
 * - Facade ≤50 LOC; re-exports named CustomerDiagnosticRunner + props type.
 * - Each runner child ≤800 LOC.
 *
 * Related:
 * - ../CustomerDiagnosticRunner.tsx (stable path)
 * - documentation/product/marketing/MARKETING-CABINET.md
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
	CustomerDiagnosticRunner,
	type CustomerDiagnosticRunnerProps,
} from '@/features/customer-diagnostic/CustomerDiagnosticRunner';

describe('CustomerDiagnosticRunner atomization contract', () => {
	const testDir = dirname(fileURLToPath(import.meta.url));
	const runnerDir = join(testDir, '..');
	const featureDir = join(runnerDir, '..');
	const facadePath = join(featureDir, 'CustomerDiagnosticRunner.tsx');

	it('re-exports named component and props from the stable facade path', () => {
		expect(typeof CustomerDiagnosticRunner).toBe('function');
		const propsCheck: CustomerDiagnosticRunnerProps = { projectId: 'p1' };
		expect(propsCheck.projectId).toBe('p1');
	});

	it('facade stays ≤50 LOC and only re-exports runner implementation', () => {
		const src = readFileSync(facadePath, 'utf8');
		const lineCount = src.replace(/\n$/, '').split('\n').length;
		expect(lineCount).toBeLessThanOrEqual(50);
		expect(src).toContain("from './runner/CustomerDiagnosticRunner'");
		expect(src).toContain('CustomerDiagnosticRunner');
		expect(src).toContain('CustomerDiagnosticRunnerProps');
		expect(src).not.toMatch(/export function\s+CustomerDiagnosticRunner/);
		expect(src).not.toMatch(/useMutation\(/);
		expect(src).not.toMatch(/function WelcomePanel/);
		expect(src).not.toMatch(/function ModuleRunner/);
	});

	it('preserves CustomerProjectWorkspace named import path', () => {
		const workspacePath = join(
			featureDir,
			'../../pages/CustomerCabinet/CustomerProjectWorkspace.tsx'
		);
		const src = readFileSync(workspacePath, 'utf8');
		expect(src).toContain(
			"from '@/features/customer-diagnostic/CustomerDiagnosticRunner'"
		);
		expect(src).toContain('<CustomerDiagnosticRunner projectId={projectId} />');
	});

	it('runner child modules exist and stay ≤800 LOC each', () => {
		const expected = [
			'CustomerDiagnosticRunner.tsx',
			'WelcomePanel.tsx',
			'HubPanel.tsx',
			'ResultsPanel.tsx',
			'ModuleRunner.tsx',
			'moduleMaxSteps.ts',
			'ArchetypeStep.tsx',
			'BusinessStep.tsx',
			'ValuesStep.tsx',
			'ServiceStep.tsx',
			'EmotionsStep.tsx',
			'runnerTypes.ts',
		];
		const names = new Set(
			readdirSync(runnerDir).filter((n) => /\.tsx?$/.test(n))
		);
		for (const mod of expected) {
			expect(names.has(mod), mod).toBe(true);
			const lines = readFileSync(join(runnerDir, mod), 'utf8').split(
				'\n'
			).length;
			expect(lines, mod).toBeLessThanOrEqual(800);
		}
	});

	it('ModuleRunner still wires all five module step components', () => {
		const src = readFileSync(join(runnerDir, 'ModuleRunner.tsx'), 'utf8');
		expect(src).toContain('ArchetypeStep');
		expect(src).toContain('ValuesStep');
		expect(src).toContain('BusinessStep');
		expect(src).toContain('ServiceStep');
		expect(src).toContain('EmotionsStep');
		expect(src).toContain('moduleMaxSteps');
	});
});
