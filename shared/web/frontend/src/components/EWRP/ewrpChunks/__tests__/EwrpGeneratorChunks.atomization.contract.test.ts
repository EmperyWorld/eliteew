/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Atomization contract for EWRP generator shared UI chunks extraction.
 *
 * Related:
 * - `EwrpGeneratorChunks.tsx`, `ewrpChunks/*`
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('EWRP generator chunks atomization contract', () => {
	const testDir = dirname(fileURLToPath(import.meta.url));
	const chunksDir = join(testDir, '..');
	const barrelPath = join(chunksDir, '..', 'EwrpGeneratorChunks.tsx');

	const expectedModules = [
		'ewrpGeneratorConstants.ts',
		'ewrpHistoryExportHelpers.ts',
		'EwrpFormChrome.tsx',
		'EwrpSlideOutlineRow.tsx',
		'EwrpDraftSlideRow.tsx',
		'EwrpHistoryRow.tsx',
		'EwrpDraftRestoreBanner.tsx',
	] as const;

	const keyRuntimeExports = [
		'EWRP_CREDITS_PER_SLIDE',
		'loadEwrpContentManagerItems',
		'filterEwrpHistoryJobs',
		'buildOutlineMarkdown',
		'downloadTextFile',
		'EwrpHistoryListSkeleton',
		'sw',
		'EwrpFormSectionHeader',
		'EwrpDesktopSelect',
		'EwrpSlideOutlineRow',
		'EwrpDraftSlideRow',
		'EwrpSortableDraftSlideRow',
		'EwrpHistoryRow',
		'EwrpDraftRestoreBanner',
		'extractApiErrorDetail',
		'parseEwrpStatusResponse',
		'formatEwrpLocalDraftSavedAt',
		'ewrpStatusLabel',
		'EWRP_HISTORY_STALE_AFTER_MS',
	] as const;

	it('keeps thin barrel re-exporting ewrpChunks modules', () => {
		const src = readFileSync(barrelPath, 'utf8');
		const lineCount = src.split('\n').length;

		expect(lineCount).toBeLessThanOrEqual(200);
		for (const mod of expectedModules) {
			expect(src).toContain(
				`from './ewrpChunks/${mod.replace(/\.(tsx?)$/, '')}`
			);
		}
		expect(src).toContain("from './ewrpStatusPhaseIndicator'");
		expect(src).toContain("from './ewrpDraftDateFormat'");
		expect(src).toContain("from './ewrpHttpErrors'");
		expect(src).toContain("from './ewrpStatusResponse'");
		expect(src).toContain('extractApiErrorDetail');
		expect(src).toContain('parseEwrpStatusResponse');
		expect(src).not.toMatch(/useState\(/);
		expect(src).not.toMatch(/function Ewrp/);
	});

	it('extracted ewrpChunks modules exist and stay under 800 LOC each', () => {
		for (const mod of expectedModules) {
			const modPath = join(chunksDir, mod);
			const content = readFileSync(modPath, 'utf8');
			const lines = content.split('\n').length;
			expect(lines, mod).toBeLessThanOrEqual(800);
		}
	});

	it('barrel and modules still expose key public symbols', async () => {
		const barrel = await import('../../EwrpGeneratorChunks');
		for (const name of keyRuntimeExports) {
			expect(barrel, name).toHaveProperty(name);
		}

		const constantsSrc = readFileSync(
			join(chunksDir, 'ewrpGeneratorConstants.ts'),
			'utf8'
		);
		expect(constantsSrc).toContain('export type ContentItem');
		expect(constantsSrc).toContain('export const EWRP_CREDITS_PER_SLIDE');
		expect(
			readFileSync(join(chunksDir, 'EwrpSlideOutlineRow.tsx'), 'utf8')
		).toContain('export const EwrpSlideOutlineRow');
		expect(
			readFileSync(join(chunksDir, 'EwrpDraftSlideRow.tsx'), 'utf8')
		).toContain('export const EwrpDraftSlideRow');
		expect(
			readFileSync(join(chunksDir, 'EwrpDraftSlideRow.tsx'), 'utf8')
		).toContain('export const EwrpSortableDraftSlideRow');
		expect(
			readFileSync(join(chunksDir, 'EwrpHistoryRow.tsx'), 'utf8')
		).toContain('export const EwrpHistoryRow');
		expect(
			readFileSync(join(chunksDir, 'EwrpDraftRestoreBanner.tsx'), 'utf8')
		).toContain('export function EwrpDraftRestoreBanner');
	});

	it('ewrpChunks directory only contains expected production modules plus tests', () => {
		const entries = readdirSync(chunksDir).filter(
			(name) => !name.startsWith('.')
		);
		expect(entries).toContain('__tests__');
		for (const mod of expectedModules) {
			expect(entries).toContain(mod);
		}
	});
});
