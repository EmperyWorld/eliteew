/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Atomization contract for AmkaView module extraction under amkaView/.
 *
 * Related:
 * - ../AmkaView.tsx
 * - amkaView/*
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('AmkaView atomization contract', () => {
	const testDir = dirname(fileURLToPath(import.meta.url));
	const amkaDir = join(testDir, '../..');
	const parentPath = join(amkaDir, 'AmkaView.tsx');
	const amkaViewDir = join(amkaDir, 'amkaView');
	const lazyImportsPath = join(
		amkaDir,
		'../../pages/MarketingCabinet/marketingCabinetPage/marketingCabinetPageLazyImports.ts'
	);

	it('keeps export on parent path and wires amkaView modules', () => {
		const src = readFileSync(parentPath, 'utf8');
		const lineCount = src.split('\n').length;

		expect(src).toContain('export function AmkaView');
		expect(src).toContain("from '@/features/amka/amkaView/useAmkaViewCompose'");
		expect(src).toContain("from '@/features/amka/amkaView/AmkaStartRunPanel'");
		expect(src).toContain(
			"from '@/features/amka/amkaView/AmkaRunStatusHeader'"
		);
		expect(src).toContain(
			"from '@/features/amka/amkaView/AmkaMasterPlanPanel'"
		);
		expect(src).toContain("from '@/features/amka/amkaView/AmkaViewMainTabs'");
		expect(src).toContain(
			"from '@/features/amka/amkaView/AmkaRunHistoryPanel'"
		);
		expect(src).toContain(
			"from '@/features/amka/amkaView/AmkaRunToolbarActions'"
		);
		expect(src).toContain(
			"from '@/features/amka/amkaView/AmkaStepsPagerPanel'"
		);
		expect(src).not.toMatch(/function handleStart\(/);
		expect(src).not.toMatch(/useCreateAmkaRun\(/);
		expect(lineCount).toBeLessThanOrEqual(800);
	});

	it('preserves MarketingCabinetAmkaView alias and lazy import path', () => {
		const aliasPath = join(amkaDir, 'MarketingCabinetAmkaView.tsx');
		const aliasSrc = readFileSync(aliasPath, 'utf8');
		expect(aliasSrc).toContain("from '@/features/amka/AmkaView'");
		expect(aliasSrc).toContain(
			'export const MarketingCabinetAmkaView = AmkaView'
		);

		const lazySrc = readFileSync(lazyImportsPath, 'utf8');
		expect(lazySrc).toContain('features/amka/MarketingCabinetAmkaView');
	});

	it('extracted amkaView modules exist and stay under 800 LOC each', () => {
		const modules = [
			'amkaViewTypes.ts',
			'amkaViewShellStyles.ts',
			'buildAmkaStartPayload.ts',
			'useAmkaViewLocalState.ts',
			'useAmkaViewQueries.ts',
			'useAmkaViewRunDerived.ts',
			'useAmkaViewSelectionEffects.ts',
			'useAmkaViewMutations.ts',
			'useAmkaViewCompose.ts',
			'AmkaViewMainTabs.tsx',
			'AmkaDestructiveApprovalBanner.tsx',
			'AmkaOverviewHealthPreview.tsx',
			'AmkaRunErrorPanel.tsx',
			'AmkaRunProgressBar.tsx',
			'AmkaRunToolbarActions.tsx',
			'AmkaRunHistoryPanel.tsx',
			'AmkaStepsPagerPanel.tsx',
			'AmkaStartRunPanel.tsx',
			'AmkaRunStatusHeader.tsx',
			'AmkaMasterPlanPanel.tsx',
		];

		for (const mod of modules) {
			const modPath = join(amkaViewDir, mod);
			const content = readFileSync(modPath, 'utf8');
			const lines = content.split('\n').length;
			expect(lines, mod).toBeLessThanOrEqual(800);
			if (mod === 'useAmkaViewCompose.ts') {
				expect(content).toContain('export function useAmkaViewCompose');
			}
		}
	});
});
