/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Atomization contract for OverviewView: facade keeps named export while
 * helpers, view-model, and UI panels live under views/overview/.
 *
 * Invariants:
 * - Parent views/OverviewView.tsx re-exports OverviewView and is ≤50 LOC.
 * - All child atomization modules are ≤800 LOC.
 * - Inner overview/OverviewView.tsx composes hero/analytics/activity panels.
 *
 * Related:
 * - views/OverviewView.tsx, overview/OverviewView.tsx
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const overviewDir = join(dir, '..');
const viewsDir = join(overviewDir, '..');

function lineCount(absPath: string): number {
	return readFileSync(absPath, 'utf8').split('\n').length;
}

function read(absPath: string): string {
	return readFileSync(absPath, 'utf8');
}

describe('OverviewView atomization contract', () => {
	const facadePath = join(viewsDir, 'OverviewView.tsx');
	const innerPath = join(overviewDir, 'OverviewView.tsx');

	const helperModules = [
		'overviewRemediationHelpers.ts',
		'overviewViewTypes.ts',
		'overviewViewModel.ts',
	] as const;

	const uiModules = [
		'IssueRemediationStatus.tsx',
		'OverviewHeroMetrics.tsx',
		'OverviewAnalyticsPanels.tsx',
		'OverviewActivityPanels.tsx',
	] as const;

	const allChildModules = [...helperModules, ...uiModules] as const;

	it('facade re-exports OverviewView from overview/', () => {
		const src = read(facadePath);
		expect(src).toMatch(
			/export\s+\{\s*OverviewView\s*\}\s+from\s+['"]@\/pages\/MarketingCabinet\/views\/overview\/OverviewView['"]/
		);
		expect(src).toMatch(/export\s+type\s+\{\s*OverviewViewProps\s*\}/);
	});

	it('inner OverviewView composes hero, analytics, and activity panels', () => {
		const src = read(innerPath);
		expect(src).toContain("from './OverviewHeroMetrics'");
		expect(src).toContain("from './OverviewAnalyticsPanels'");
		expect(src).toContain("from './OverviewActivityPanels'");
		expect(src).toContain('deriveOverviewViewModel(');
		expect(src).toContain('<OverviewHeroMetrics');
		expect(src).toContain('<OverviewAnalyticsPanels');
		expect(src).toContain('<OverviewActivityPanels');
		expect(src).not.toMatch(/\bfunction\s+canCreateAlertForSeverity\b/);
		expect(src).not.toMatch(/\bfunction\s+IssueRemediationStatus\b/);
		expect(src).not.toMatch(/\bfunction\s+getLocalizedOverviewTaskCopy\b/);
	});

	it('key symbols exist in extracted modules', () => {
		expect(read(join(overviewDir, 'overviewRemediationHelpers.ts'))).toContain(
			'export function canCreateAlertForSeverity'
		);
		expect(read(join(overviewDir, 'overviewRemediationHelpers.ts'))).toContain(
			'export function getLocalizedOverviewTaskCopy'
		);
		expect(read(join(overviewDir, 'overviewViewModel.ts'))).toContain(
			'export function deriveOverviewViewModel'
		);
		expect(read(join(overviewDir, 'IssueRemediationStatus.tsx'))).toContain(
			'export function IssueRemediationStatus'
		);
		expect(read(join(overviewDir, 'OverviewHeroMetrics.tsx'))).toContain(
			'export function OverviewHeroMetrics'
		);
		expect(read(join(overviewDir, 'OverviewAnalyticsPanels.tsx'))).toContain(
			'export function OverviewAnalyticsPanels'
		);
		expect(read(join(overviewDir, 'OverviewActivityPanels.tsx'))).toContain(
			'export function OverviewActivityPanels'
		);
	});

	it('all child modules exist', () => {
		for (const name of allChildModules) {
			expect(existsSync(join(overviewDir, name))).toBe(true);
		}
	});

	it('facade stays thin and all children stay within LOC gate', () => {
		const facadeLoc = lineCount(facadePath);
		const innerLoc = lineCount(innerPath);
		expect(facadeLoc).toBeLessThanOrEqual(50);
		expect(innerLoc).toBeLessThanOrEqual(800);

		for (const name of allChildModules) {
			const childLoc = lineCount(join(overviewDir, name));
			expect(childLoc).toBeLessThanOrEqual(800);
		}
	});
});
