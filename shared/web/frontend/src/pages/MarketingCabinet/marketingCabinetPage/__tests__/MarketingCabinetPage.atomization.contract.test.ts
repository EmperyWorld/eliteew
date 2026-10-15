/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Atomization contract for MarketingCabinetPage Waves 1–6 module extraction.
 *
 * Related:
 * - MarketingCabinetPage.tsx
 * - marketingCabinetPage/*
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('MarketingCabinetPage atomization contract (Waves 1–6)', () => {
	const testDir = dirname(fileURLToPath(import.meta.url));
	const atomDir = join(testDir, '..');
	const cabinetDir = join(atomDir, '..');
	const parentPath = join(cabinetDir, 'MarketingCabinetPage.tsx');

	it('keeps named + default export on parent path and wires atomized modules', () => {
		const src = readFileSync(parentPath, 'utf8');
		const lineCount = src.split('\n').length;

		expect(src).toContain('export const MarketingCabinetPage');
		expect(src).toContain('export default MarketingCabinetPage');
		expect(src).toContain(
			"from './marketingCabinetPage/useMarketingCabinetPageCompose'"
		);
		expect(src).toContain(
			"from './marketingCabinetPage/MarketingCabinetPageViewRouter'"
		);
		expect(src).toContain('MarketingCabinetPageProps');
		const composePath = join(atomDir, 'useMarketingCabinetPageCompose.ts');
		expect(readFileSync(composePath, 'utf8')).toContain(
			'desktopConsumedMarketingDeepLink'
		);
		expect(src).not.toMatch(/lazy\(\(\) => import\('\.\/views\//);
		expect(lineCount).toBeLessThanOrEqual(800);
	});

	it('preserves Desktop lazy import path to MarketingCabinetPage', () => {
		const lazyImportsPath = join(
			cabinetDir,
			'../Desktop/components/desktopWindowAppContent/lazyImports.ts'
		);
		const lazySrc = readFileSync(lazyImportsPath, 'utf8');
		expect(lazySrc).toContain(
			"import('../../../MarketingCabinet/MarketingCabinetPage')"
		);
	});

	it('lazy import targets for views/sections/AMKA remain in lazyImports module', () => {
		const lazyPath = join(atomDir, 'marketingCabinetPageLazyImports.ts');
		const lazySrc = readFileSync(lazyPath, 'utf8');
		expect(lazySrc).toContain('views/ChatView');
		expect(lazySrc).toContain('views/EvidenceView');
		expect(lazySrc).toContain('sections/CompaniesSection');
		expect(lazySrc).toContain('features/amka/MarketingCabinetAmkaView');
	});

	it('extracted Wave 1–6 modules exist and stay under 800 LOC each', () => {
		const modules = [
			'useMarketingCabinetFormSelectOptions.ts',
			'useMarketingCabinetFilteredEntities.ts',
			'useMarketingCabinetPageLocalState.ts',
			'useMarketingCabinetInvalidation.ts',
			'useMarketingCabinetAiRunEffects.ts',
			'useMarketingCabinetPageSyncEffects.ts',
			'useMarketingCabinetPageCompose.ts',
			'MarketingCabinetPageViewRouter.tsx',
			'marketingCabinetPageLazyImports.ts',
		];

		for (const mod of modules) {
			const modPath = join(atomDir, mod);
			const content = readFileSync(modPath, 'utf8');
			const lines = content.split('\n').length;
			expect(lines, mod).toBeLessThanOrEqual(800);
			if (mod === 'useMarketingCabinetPageCompose.ts') {
				expect(content).toContain(
					'export function useMarketingCabinetPageCompose'
				);
				// Lock: setters used before `...local` spread must be destructured
				// (else ReferenceError at runtime — setJobStoryExtractText 2026-07-29).
				expect(content).toMatch(
					/jobStoryExtractText,\s*\n\s*setJobStoryExtractText,/
				);
				expect(content).toContain('useMarketingCabinetAiRunEffects({');
				expect(content).toContain('setJobStoryExtractText,');
			}
			if (mod === 'MarketingCabinetPageViewRouter.tsx') {
				expect(content).toContain(
					'export function MarketingCabinetPageViewRouter'
				);
				expect(content).toMatch(/activeView === 'overview'/);
				expect(content).toMatch(/activeView === 'client_interaction'/);
			}
		}
	});
});
