/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Atomization contract for OperationsView: facade keeps named export while
 * helpers, controller, UI sections, and compose live under operations/.
 *
 * Invariants:
 * - Parent views/OperationsView.tsx re-exports OperationsView and is ≤50 LOC.
 * - All child atomization modules are ≤800 LOC.
 * - useOperationsView wires queries, mutations, filters, and form state.
 *
 * Related:
 * - views/OperationsView.tsx
 * - operations/OperationsView.tsx
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const operationsDir = join(dir, '..');
const viewsDir = join(operationsDir, '..');

function lineCount(absPath: string): number {
	return readFileSync(absPath, 'utf8').split('\n').length;
}

function read(absPath: string): string {
	return readFileSync(absPath, 'utf8');
}

describe('OperationsView atomization contract', () => {
	const facadePath = join(viewsDir, 'OperationsView.tsx');
	const innerPath = join(operationsDir, 'OperationsView.tsx');

	const helperModules = ['operationsHelpers.ts', 'operationsTypes.ts'] as const;

	const hookModules = ['useOperationsView.ts'] as const;

	const uiModules = [
		'OperationsTasksSection.tsx',
		'OperationsAlertsSection.tsx',
	] as const;

	const allChildModules = [
		...helperModules,
		...hookModules,
		...uiModules,
		'OperationsView.tsx',
	] as const;

	it('facade re-exports OperationsView from operations/', () => {
		const src = read(facadePath);
		expect(src).toMatch(
			/export\s+\{\s*OperationsView\s*\}\s+from\s+['"]@\/pages\/MarketingCabinet\/views\/operations\/OperationsView['"]/
		);
		expect(src).toMatch(/export\s+type\s+\{\s*OperationsViewProps\s*\}/);
	});

	it('lazy import path still targets views/OperationsView named export', () => {
		const lazyPath = join(
			viewsDir,
			'..',
			'marketingCabinetPage',
			'marketingCabinetPageLazyImports.ts'
		);
		const lazySrc = read(lazyPath);
		expect(lazySrc).toContain(
			"import('@/pages/MarketingCabinet/views/OperationsView')"
		);
		expect(lazySrc).toContain('default: m.OperationsView');
	});

	it('inner compose delegates to controller and section panels', () => {
		const src = read(innerPath);
		expect(src).toContain("from './useOperationsView'");
		expect(src).toContain('useOperationsView(');
		expect(src).toContain('<OperationsTasksSection');
		expect(src).toContain('<OperationsAlertsSection');
		expect(src).toContain('EmptyProjectState');
		expect(src).not.toMatch(/\bfunction\s+compareTasks\b/);
		expect(src).not.toMatch(/\bfunction\s+isTaskOverdue\b/);
	});

	it('useOperationsView wires queries, mutations, and deep-link filters', () => {
		const src = read(join(operationsDir, 'useOperationsView.ts'));
		expect(src).toContain('marketingCabinetTasksQueryOptions');
		expect(src).toContain('marketingCabinetAlertsQueryOptions');
		expect(src).toContain('createTaskMutation');
		expect(src).toContain('createAlertMutation');
		expect(src).toContain('MC_OPS_TASK_STATUS');
		expect(src).toContain('displayTasks');
		expect(src).toContain('displayAlerts');
	});

	it('key symbols exist in extracted modules', () => {
		expect(read(join(operationsDir, 'operationsHelpers.ts'))).toContain(
			'export function compareTasks'
		);
		expect(read(join(operationsDir, 'operationsHelpers.ts'))).toContain(
			'export function isTaskOverdue'
		);
		expect(read(join(operationsDir, 'operationsHelpers.ts'))).toContain(
			'export const initialTaskForm'
		);
		expect(read(join(operationsDir, 'operationsTypes.ts'))).toContain(
			'export type OperationsViewProps'
		);
		expect(read(join(operationsDir, 'OperationsTasksSection.tsx'))).toContain(
			'VirtualVariableList'
		);
		expect(read(join(operationsDir, 'OperationsAlertsSection.tsx'))).toContain(
			'VirtualVariableList'
		);
	});

	it('named export is a function component', async () => {
		const mod = await import('../../OperationsView');
		expect(typeof mod.OperationsView).toBe('function');
	});

	it('all child modules exist', () => {
		for (const name of allChildModules) {
			expect(existsSync(join(operationsDir, name))).toBe(true);
		}
	});

	it('facade stays thin and all children stay within LOC gate', () => {
		const facadeLoc = lineCount(facadePath);
		expect(facadeLoc).toBeLessThanOrEqual(50);

		for (const name of allChildModules) {
			const childLoc = lineCount(join(operationsDir, name));
			expect(childLoc, name).toBeLessThanOrEqual(800);
		}
	});
});
