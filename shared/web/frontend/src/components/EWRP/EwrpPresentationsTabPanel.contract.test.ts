/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Layer E contract lock for EWRP Phase C.4 Presentations-tab extract — Main imports the
 * presentational panel; panel composes slide-editor / outline / idle / PDF extracts;
 * public shell still re-exports Main.
 *
 * Invariants:
 * - `EWRPGenerator.tsx` keeps default export from `EWRPGeneratorMain`.
 * - Main composes `EwrpPresentationsTabPanel` + `EwrpGeneratorModals`; panel owns `ewrp-panel-presentations`.
 * - `EwrpPresentationsTabPanel.tsx` stays ≤1000 LOC (god-file hard target).
 *
 * Related:
 * - `EwrpPresentationsTabPanel.tsx`, `EwrpPresentationsSlideEditorSurface.tsx`,
 *   `EwrpPresentationsStatusOutline.tsx`, `EwrpPresentationsCompletedPdfActions.tsx`,
 *   `EwrpPresentationsIdleColumn.tsx`, `EWRPGeneratorMain.tsx`, `EwrpGeneratorModals.tsx`
 * - `documentation/product/EWRP-REVOLUTIONARY-PRESENTATIONS.md`
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const PRESENTATIONS_LOC_HARD_CAP = 1000;

describe('EWRP Presentations tab panel extract contract', () => {
	it('keeps public shell re-exporting Main', () => {
		const shell = readFileSync(join(dir, 'EWRPGenerator.tsx'), 'utf8');
		expect(shell).toContain("export { default } from './EWRPGeneratorMain'");
	});

	it('wires Main to Presentations tab panel, orchestration hook, and modals', () => {
		const main = readFileSync(join(dir, 'EWRPGeneratorMain.tsx'), 'utf8');
		expect(main).toContain('EwrpPresentationsTabPanel');
		expect(main).toContain("from './EwrpPresentationsTabPanel'");
		expect(main).toContain('useEwrpGeneratorOrchestration');
		expect(main).toContain('EwrpGeneratorModals');
		expect(main).not.toContain('id="ewrp-panel-presentations"');
	});

	it('exports Presentations panel with stable tabpanel id', () => {
		const panel = readFileSync(
			join(dir, 'EwrpPresentationsTabPanel.tsx'),
			'utf8'
		);
		expect(panel).toContain('export function EwrpPresentationsTabPanel');
		expect(panel).toContain('id="ewrp-panel-presentations"');
		expect(panel).toContain('aria-labelledby="ewrp-tab-presentations"');
	});

	it('keeps Presentations panel at or under the god-file LOC hard target', () => {
		const panel = readFileSync(
			join(dir, 'EwrpPresentationsTabPanel.tsx'),
			'utf8'
		);
		const loc = panel.split(/\r?\n/).length;
		expect(loc).toBeLessThanOrEqual(PRESENTATIONS_LOC_HARD_CAP);
	});

	it('composes Presentations presentational extracts from the panel', () => {
		const panel = readFileSync(
			join(dir, 'EwrpPresentationsTabPanel.tsx'),
			'utf8'
		);
		expect(panel).toContain('EwrpPresentationsSlideEditorSurface');
		expect(panel).toContain("from './EwrpPresentationsSlideEditorSurface'");
		expect(panel).toContain('EwrpPresentationsStatusOutline');
		expect(panel).toContain("from './EwrpPresentationsStatusOutline'");
		expect(panel).toContain('EwrpPresentationsCompletedPdfActions');
		expect(panel).toContain("from './EwrpPresentationsCompletedPdfActions'");
		expect(panel).toContain('EwrpPresentationsIdleColumn');
		expect(panel).toContain("from './EwrpPresentationsIdleColumn'");
	});
});
