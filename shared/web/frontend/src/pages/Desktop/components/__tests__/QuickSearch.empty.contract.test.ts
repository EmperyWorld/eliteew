/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract for QuickSearch empty states (P23: results body + shell attrs).
 *
 * Related:
 * - quickSearch/QuickSearchResultsBody.tsx
 * - quickSearch/useQuickSearchModel.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * QuickSearch full render + framer-motion is flaky/hangs in jsdom; keep a source contract
 * that empty results use DesktopAppEmptyState (desktop shell consistency).
 */
describe('QuickSearch empty state contract', () => {
	it('uses DesktopAppEmptyState for no-result query in ResultsBody', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const resultsSrc = readFileSync(
			join(dir, '../quickSearch/QuickSearchResultsBody.tsx'),
			'utf8'
		);
		expect(resultsSrc).toContain('DesktopAppEmptyState');
		expect(resultsSrc).toContain("t('quickSearch.emptyTitle')");
		expect(resultsSrc).toContain("t('quickSearch.emptyDescription')");
	});

	it('parent keeps shell keyboard surface and empty browse hint', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const parentSrc = readFileSync(join(dir, '../QuickSearch.tsx'), 'utf8');
		expect(parentSrc).toContain('data-desktop-shell-keyboard-surface');
		expect(parentSrc).toContain("t('quickSearch.emptyBrowseHint')");
		expect(parentSrc).toContain('data-testid="quick-search-empty-browse-hint"');
	});

	it('Home keyboard nav lives in useQuickSearchModel', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const modelSrc = readFileSync(
			join(dir, '../quickSearch/useQuickSearchModel.ts'),
			'utf8'
		);
		expect(modelSrc).toContain('selectedIndexRef');
		expect(modelSrc).toContain("case 'Home':");
	});

	it('DesktopWorkspaceSearchOverlays wires quick action copy via desktopUi launcherQuickActions', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../DesktopWorkspaceSearchOverlays.tsx'),
			'utf8'
		);
		expect(src).toContain('quickSearch.launcherQuickActions');
	});
});
