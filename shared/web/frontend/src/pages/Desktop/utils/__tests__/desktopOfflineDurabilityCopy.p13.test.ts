/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P13 lock — offline / sync copy must match P3 durability scope (browser layout,
 * not an unqualified “all changes on this device” promise).
 *
 * Related:
 * - i18n/locales/{en,ru}/desktopUi.json
 * - i18n/locales/{en,ru}/desktopChrome.json
 * - documentation/product/desktop/DESKTOP-STATE-PERSISTENCE.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const frontendRoot = join(
	dirname(fileURLToPath(import.meta.url)),
	'../../../../..'
);

function readJson(rel: string): Record<string, unknown> {
	return JSON.parse(readFileSync(join(frontendRoot, rel), 'utf8')) as Record<
		string,
		unknown
	>;
}

describe('desktop offline durability copy (P13)', () => {
	it('scopes EN/RU offline banner to browser desktop layout (not all changes)', () => {
		const en = readJson('src/i18n/locales/en/desktopUi.json') as {
			workspace: { offlineBannerBody: string; syncServerUnavailable: string };
		};
		const ru = readJson('src/i18n/locales/ru/desktopUi.json') as {
			workspace: { offlineBannerBody: string; syncServerUnavailable: string };
		};

		expect(en.workspace.offlineBannerBody.toLowerCase()).toContain('browser');
		expect(en.workspace.offlineBannerBody.toLowerCase()).toMatch(/icon|layout/);
		expect(en.workspace.offlineBannerBody.toLowerCase()).not.toContain(
			'changes stay on this device'
		);
		expect(en.workspace.syncServerUnavailable.toLowerCase()).toContain(
			'browser'
		);

		expect(ru.workspace.offlineBannerBody.toLowerCase()).toContain('браузер');
		expect(ru.workspace.offlineBannerBody).toMatch(/ярлык|раскладк/i);
		expect(ru.workspace.offlineBannerBody).not.toContain(
			'Изменения сохраняются на этом устройстве'
		);
	});

	it('scopes chrome sync error / tour copy to browser desktop changes', () => {
		const en = readJson('src/i18n/locales/en/desktopChrome.json') as {
			syncStatus: { errorDetail: string };
			welcomeOnboarding: {
				guide: { steps: { 'sync-status': { body: string } } };
			};
		};
		expect(en.syncStatus.errorDetail.toLowerCase()).toContain('browser');
		expect(en.syncStatus.errorDetail.toLowerCase()).not.toContain(
			'kept on this device'
		);
		expect(
			en.welcomeOnboarding.guide.steps['sync-status'].body.toLowerCase()
		).toContain('browser');
	});
});
