/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Atomization + Phase C.4 contract lock for EWRP Generate tab — thin facade,
 * ewrpGenerateTab/* children ≤800 LOC, Main still wires chrome/hook/modals.
 *
 * Invariants:
 * - `EWRPGenerator.tsx` keeps default export from `EWRPGeneratorMain`.
 * - Main composes `EwrpGenerateTabPanel` + `EwrpGeneratorAppChrome` + `EwrpGeneratorModals`.
 * - Facade `EwrpGenerateTabPanel.tsx` re-exports named panel + props and stays ≤50 LOC.
 * - All `ewrpGenerateTab/*` children stay ≤800 LOC.
 * - `EWRPGeneratorMain.tsx` stays ≤1000 LOC.
 *
 * Related:
 * - `EwrpGenerateTabPanel.tsx`, `ewrpGenerateTab/*`, `EWRPGeneratorMain.tsx`
 * - `documentation/product/EWRP-EDITOR.md`
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const generateTabDir = join(dir, 'ewrpGenerateTab');
const MAIN_LOC_HARD_CAP = 1000;
const FACADE_LOC_HARD_CAP = 50;
const CHILD_LOC_HARD_CAP = 800;

function lineCount(absPath: string): number {
	return readFileSync(absPath, 'utf8').split(/\r?\n/).length;
}

function listTsModules(absDir: string): string[] {
	return readdirSync(absDir)
		.filter((name) => /\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts'))
		.map((name) => join(absDir, name))
		.filter((p) => statSync(p).isFile());
}

describe('EWRP Generate tab panel atomization contract', () => {
	it('keeps public shell re-exporting Main', () => {
		const shell = readFileSync(join(dir, 'EWRPGenerator.tsx'), 'utf8');
		expect(shell).toContain("export { default } from './EWRPGeneratorMain'");
	});

	it('wires Main to Generate tab panel, app chrome, orchestration hook, and modals', () => {
		const main = readFileSync(join(dir, 'EWRPGeneratorMain.tsx'), 'utf8');
		expect(main).toContain('EwrpGenerateTabPanel');
		expect(main).toContain('EwrpGeneratorAppChrome');
		expect(main).toContain("from './EwrpGenerateTabPanel'");
		expect(main).toContain("from './EwrpGeneratorAppChrome'");
		expect(main).toContain('useEwrpGeneratorOrchestration');
		expect(main).toContain("from './useEwrpGeneratorOrchestration'");
		expect(main).toContain('EwrpGeneratorModals');
		expect(main).toContain("from './EwrpGeneratorModals'");
		expect(main).not.toContain('id="ewrp-panel-generate"');
		expect(main).not.toContain('id="ewrp-panel-presentations"');
		expect(main).not.toContain('id="ewrp-history-modal-title"');
		expect(main).not.toContain('id="ewrp-doc-picker-title"');
	});

	it('keeps Main at or under the god-file LOC hard target', () => {
		const loc = lineCount(join(dir, 'EWRPGeneratorMain.tsx'));
		expect(loc).toBeLessThanOrEqual(MAIN_LOC_HARD_CAP);
	});

	it('facade re-exports panel and props from ewrpGenerateTab/', () => {
		const facade = readFileSync(join(dir, 'EwrpGenerateTabPanel.tsx'), 'utf8');
		expect(facade).toMatch(
			/export\s+\{\s*EwrpGenerateTabPanel\s*\}\s+from\s+['"]\.\/ewrpGenerateTab\/EwrpGenerateTabPanel['"]/
		);
		expect(facade).toMatch(
			/export\s+type\s+\{\s*EwrpGenerateTabPanelProps\s*\}\s+from\s+['"]\.\/ewrpGenerateTab\/ewrpGenerateTabTypes['"]/
		);
		expect(facade).not.toContain('export function EwrpGeneratorAppChrome');
		expect(
			lineCount(join(dir, 'EwrpGenerateTabPanel.tsx'))
		).toBeLessThanOrEqual(FACADE_LOC_HARD_CAP);
	});

	it('inner panel owns ewrp-panel-generate and composes submodules', () => {
		const innerPath = join(generateTabDir, 'EwrpGenerateTabPanel.tsx');
		expect(existsSync(innerPath)).toBe(true);
		const panel = readFileSync(innerPath, 'utf8');
		expect(panel).toContain('export function EwrpGenerateTabPanel');
		expect(panel).toContain('id="ewrp-panel-generate"');
		expect(panel).toContain('useEwrpGenerateTabDerived');
		expect(panel).toContain('EwrpGenerateTabHistoryToolbar');
		expect(panel).toContain('EwrpGenerateTabStickyContext');
		expect(panel).toContain('EwrpGenerateTabTopicSection');
		expect(panel).toContain('EwrpGenerateTabSubmitSection');
		expect(panel).not.toContain('export function EwrpGeneratorAppChrome');
	});

	it('ewrpGenerateTab children stay within LOC gate', () => {
		expect(existsSync(generateTabDir)).toBe(true);
		const modules = listTsModules(generateTabDir);
		expect(modules.length).toBeGreaterThanOrEqual(10);
		for (const modPath of modules) {
			const loc = lineCount(modPath);
			expect(loc, modPath).toBeLessThanOrEqual(CHILD_LOC_HARD_CAP);
		}
	});

	it('exports app chrome with stable tab ids', () => {
		const chrome = readFileSync(
			join(dir, 'EwrpGeneratorAppChrome.tsx'),
			'utf8'
		);
		expect(chrome).toContain('export function EwrpGeneratorAppChrome');
		expect(chrome).toContain('id="ewrp-tab-generate"');
		expect(chrome).toContain('id="ewrp-tab-presentations"');
	});

	it('exports orchestration hook as named function', () => {
		const hook = readFileSync(
			join(dir, 'useEwrpGeneratorOrchestration.tsx'),
			'utf8'
		);
		expect(hook).toContain('export function useEwrpGeneratorOrchestration');
		expect(hook).toContain('export type EWRPGeneratorProps');
	});

	it('exports generator modals host with history and doc-picker ids', () => {
		const modals = readFileSync(join(dir, 'EwrpGeneratorModals.tsx'), 'utf8');
		expect(modals).toContain('export function EwrpGeneratorModals');
		expect(modals).toContain('id="ewrp-history-modal-title"');
		expect(modals).toContain('id="ewrp-doc-picker-title"');
		expect(modals).toContain('EwrpPdfPresentationViewer');
		expect(modals).toContain('ConfirmDeleteModal');
		expect(modals).toContain('SpotlightGuideModal');
	});
});
