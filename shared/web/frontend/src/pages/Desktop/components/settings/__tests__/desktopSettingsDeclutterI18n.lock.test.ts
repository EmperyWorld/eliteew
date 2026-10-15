/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock pruned Settings chrome i18n keys so badges/blurbs/continue-setup copy
 * cannot silently return via locale files alone.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-CHROME-DECLUTTER-AND-SCROLL.md
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const FORBIDDEN_SETTINGS_PANEL_KEYS = [
	'personalizeNextTitle',
	'persistenceDesktop',
	'flatShellWidgetNote',
	'sectionPerformanceTip',
	'headerSubtitle',
	'widgetsTaxonomyIntro',
	'widgetsTaxonomyFloating',
	'widgetsTaxonomyPanel',
	'cardWidgetPanelTaxonomyNote',
] as const;

describe('desktop settings declutter i18n lock', () => {
	it.each(['en', 'ru'] as const)(
		'%s desktopUi settingsPanel omits removed chrome keys',
		(locale) => {
			const path = resolve(
				__dirname,
				`../../../../../i18n/locales/${locale}/desktopUi.json`
			);
			const data = JSON.parse(readFileSync(path, 'utf8')) as {
				settingsPanel: Record<string, unknown>;
			};
			const panel = data.settingsPanel;
			for (const key of FORBIDDEN_SETTINGS_PANEL_KEYS) {
				expect(panel[key], key).toBeUndefined();
			}
			const visualStudio = panel.visualStudio as
				| Record<string, unknown>
				| undefined;
			expect(visualStudio?.flatShellStyleNote).toBeUndefined();
		}
	);
});
