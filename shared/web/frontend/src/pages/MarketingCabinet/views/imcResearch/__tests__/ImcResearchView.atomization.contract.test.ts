/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Atomization contract for ImcResearchView: facade keeps named export while
 * helpers, controller, UI panels, and compose live under imcResearch/.
 *
 * Invariants:
 * - Parent views/ImcResearchView.tsx re-exports ImcResearchView and is ≤50 LOC.
 * - All child atomization modules are ≤800 LOC.
 * - useImcResearchController wires queries, mutations, filters, and handlers.
 *
 * Related:
 * - views/ImcResearchView.tsx
 * - imcResearch/ImcResearchView.tsx
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const imcResearchDir = join(dir, '..');
const viewsDir = join(imcResearchDir, '..');

function lineCount(absPath: string): number {
	return readFileSync(absPath, 'utf8').split('\n').length;
}

function read(absPath: string): string {
	return readFileSync(absPath, 'utf8');
}

describe('ImcResearchView atomization contract', () => {
	const facadePath = join(viewsDir, 'ImcResearchView.tsx');
	const innerPath = join(imcResearchDir, 'ImcResearchView.tsx');

	const helperModules = [
		'imcResearchHelpers.ts',
		'imcResearchTypes.ts',
	] as const;

	const hookModules = ['useImcResearchController.ts'] as const;

	const uiModules = [
		'ImcResearchListPanel.tsx',
		'ImcResearchRunForm.tsx',
		'ImcResearchDetailPanel.tsx',
		'ImcResearchComparePanel.tsx',
	] as const;

	const allChildModules = [
		...helperModules,
		...hookModules,
		...uiModules,
		'ImcResearchView.tsx',
	] as const;

	it('facade re-exports ImcResearchView from imcResearch/', () => {
		const src = read(facadePath);
		expect(src).toMatch(
			/export\s+\{\s*ImcResearchView\s*\}\s+from\s+['"]@\/pages\/MarketingCabinet\/views\/imcResearch\/ImcResearchView['"]/
		);
		expect(src).toMatch(/export\s+type\s+\{\s*ImcResearchViewProps\s*\}/);
	});

	it('lazy import path still targets views/ImcResearchView named export', () => {
		const lazyPath = join(
			viewsDir,
			'..',
			'marketingCabinetPage',
			'marketingCabinetPageLazyImports.ts'
		);
		const lazySrc = read(lazyPath);
		expect(lazySrc).toContain(
			"import('@/pages/MarketingCabinet/views/ImcResearchView')"
		);
		expect(lazySrc).toContain('default: m.ImcResearchView');
	});

	it('inner compose delegates to controller and subpanels', () => {
		const src = read(innerPath);
		expect(src).toContain("from './useImcResearchController'");
		expect(src).toContain('useImcResearchController(');
		expect(src).toContain('<ImcResearchListPanel');
		expect(src).toContain('<ImcResearchDetailPanel');
		expect(src).toContain('<ImcResearchRunForm');
		expect(src).toContain('ConfirmDeleteModal');
		expect(src).not.toMatch(/\bfunction\s+imcMarkdownTextStats\b/);
		expect(src).not.toMatch(/\bfunction\s+statusBadgeClass\b/);
	});

	it('useImcResearchController wires queries, mutations, and handlers', () => {
		const src = read(join(imcResearchDir, 'useImcResearchController.ts'));
		expect(src).toContain('useImcProjectResearches(');
		expect(src).toContain('useImcRunResearch(');
		expect(src).toContain('useImcCancelResearch(');
		expect(src).toContain('useImcRerunResearch(');
		expect(src).toContain('useImcDeleteResearch(');
		expect(src).toContain('handleRun');
		expect(src).toContain('confirmDeleteResearch');
		expect(src).toContain('handlePromoteImcToRag');
	});

	it('key symbols exist in extracted modules', () => {
		expect(read(join(imcResearchDir, 'imcResearchHelpers.ts'))).toContain(
			'export const IMC_CONTROL_CLASS'
		);
		expect(read(join(imcResearchDir, 'imcResearchHelpers.ts'))).toContain(
			'export function imcMarkdownTextStats'
		);
		expect(read(join(imcResearchDir, 'imcResearchHelpers.ts'))).toContain(
			'export function statusBadgeClass'
		);
		expect(read(join(imcResearchDir, 'imcResearchTypes.ts'))).toContain(
			'export type ImcResearchViewProps'
		);
		expect(read(join(imcResearchDir, 'ImcResearchListPanel.tsx'))).toContain(
			'VirtualVariableList'
		);
		expect(read(join(imcResearchDir, 'ImcResearchComparePanel.tsx'))).toContain(
			'compareLeftId'
		);
	});

	it('all child modules exist', () => {
		for (const name of allChildModules) {
			expect(existsSync(join(imcResearchDir, name))).toBe(true);
		}
	});

	it('facade stays thin and all children stay within LOC gate', () => {
		const facadeLoc = lineCount(facadePath);
		expect(facadeLoc).toBeLessThanOrEqual(50);

		for (const name of allChildModules) {
			const childLoc = lineCount(join(imcResearchDir, name));
			expect(childLoc, name).toBeLessThanOrEqual(800);
		}
	});
});
