/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 6 Cause lock — Quick Search idle order demotes MRU apps after files;
 * copy/roles insist Start owns the browsable catalog.
 *
 * Related:
 * - quickSearch/useQuickSearchModel.ts
 * - quickSearch/QuickSearchResultsBody.tsx
 * - utils/desktopLauncherRoles.ts
 * - i18n/locales/{en,ru}/desktopChrome.json
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('QuickSearch Wave 6 cognitive IA', () => {
	const dir = dirname(fileURLToPath(import.meta.url));

	it('idle flatRows place recent documents before recent apps', () => {
		const model = readFileSync(
			join(dir, '../quickSearch/useQuickSearchModel.ts'),
			'utf8'
		);
		const docs = model.indexOf('...recentDocumentsUnifiedLimited.map');
		const apps = model.indexOf(
			'// Wave 6: MRU apps after files — Start owns browsable catalog'
		);
		const appsMap = model.indexOf(
			'...recentAppsLimited.map((i) => ({ type: \'app\' as const, data: i })),',
			docs
		);
		expect(docs).toBeGreaterThan(-1);
		expect(apps).toBeGreaterThan(docs);
		expect(appsMap).toBeGreaterThan(apps);
		expect(model).toContain('QUICK_SEARCH_IDLE_RECENT_APPS_CAP');
		expect(model).not.toContain('recentItems.slice(0, 5)');
	});

	it('ResultsBody renders recentAppsHeading after documents heading', () => {
		const body = readFileSync(
			join(dir, '../quickSearch/QuickSearchResultsBody.tsx'),
			'utf8'
		);
		const docs = body.indexOf("t('quickSearch.recentDocumentsUnifiedHeading')");
		const apps = body.indexOf("t('quickSearch.recentAppsHeading')");
		expect(docs).toBeGreaterThan(-1);
		expect(apps).toBeGreaterThan(docs);
	});

	it('desktopChrome QS copy does not claim a competing app catalog', () => {
		const en = readFileSync(
			join(dir, '../../../../i18n/locales/en/desktopChrome.json'),
			'utf8'
		);
		expect(en).toContain('Find files, recent items, and actions');
		expect(en).toContain('full app catalog stays in Start');
		expect(en).not.toContain('Search apps, files, and actions');
	});
});
