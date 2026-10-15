/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Atomization contract for EWRP generator orchestration module extraction.
 *
 * Related:
 * - `useEwrpGeneratorOrchestration.tsx`, `ewrpOrchestration/*`
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('EWRP generator orchestration atomization contract', () => {
	const testDir = dirname(fileURLToPath(import.meta.url));
	const ewrpDir = join(testDir, '../..');
	const facadePath = join(ewrpDir, 'useEwrpGeneratorOrchestration.tsx');
	const orchDir = join(ewrpDir, 'ewrpOrchestration');

	it('keeps thin facade and wires ewrpOrchestration modules', () => {
		const src = readFileSync(facadePath, 'utf8');
		const lineCount = src.split('\n').length;

		expect(src).toContain("from './ewrpOrchestration/ewrpOrchestrationTypes'");
		expect(src).toContain("from './ewrpOrchestration/useEwrpGeneratorCompose'");
		expect(src).toContain('useEwrpGeneratorOrchestration');
		expect(src).not.toMatch(/useState\(/);
		expect(src).not.toMatch(/useEffect\(/);
		expect(lineCount).toBeLessThanOrEqual(50);
	});

	it('extracted orchestration modules exist and stay under 800 LOC each', () => {
		const modules = [
			'ewrpOrchestrationTypes.ts',
			'ewrpLocalDraftStorage.ts',
			'ewrpCompanionListing.ts',
			'ewrpStatusLiveText.ts',
			'ewrpShellChromeClasses.ts',
			'EwrpDocPickerVirtualRow.tsx',
			'useEwrpGeneratorPolling.ts',
			'useEwrpGeneratorHistory.tsx',
			'useEwrpGeneratorDocPicker.tsx',
			'useEwrpGeneratorSubmit.ts',
			'useEwrpJobActions.ts',
			'useEwrpPdfActions.ts',
			'useEwrpDraftEditor.ts',
			'useEwrpDraftEditorSave.ts',
			'useEwrpGeneratorBootstrap.ts',
			'useEwrpGeneratorDerivedState.ts',
			'useEwrpGeneratorKeyboard.ts',
			'useEwrpGeneratorGuide.ts',
			'useEwrpGeneratorCompose.tsx',
		];

		for (const mod of modules) {
			const modPath = join(orchDir, mod);
			const content = readFileSync(modPath, 'utf8');
			const lines = content.split('\n').length;
			expect(lines, mod).toBeLessThanOrEqual(800);
			if (mod === 'useEwrpGeneratorCompose.tsx') {
				expect(content).toContain('export function useEwrpGeneratorCompose');
			}
			if (mod === 'useEwrpPdfActions.ts') {
				expect(content).toContain("from '../../../utils/browserDownload'");
			}
		}
	});
});
