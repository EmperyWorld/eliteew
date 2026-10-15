/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 19: failed timezone PATCH surfaces coordinator error banner in shell sync section.
 *
 * DESKTOP_SHELL_E2E_RUN=1 MC_E2E_BASE_URL=https://app.eliteew.ru … pnpm exec playwright test e2e/desktop-settings-wave19.spec.ts
 */

import { expect, test } from 'playwright/test';
import { describeDesktop } from './desktopShellE2eGate';
import {
	expectDesktopSettingsSyncTimezoneVisible,
	openDesktopShellSettingsSyncSection,
} from './desktopSettingsSyncHelpers';

describeDesktop(
	'Desktop settings wave 19 (timezone PATCH error banner)',
	() => {
		test('failed shell-state PATCH shows expansion save error banner', async ({
			page,
		}) => {
			await page.route('**/api/v1/desktop/shell-state', async (route) => {
				if (route.request().method() !== 'PATCH') {
					await route.continue();
					return;
				}
				await route.fulfill({ status: 503, body: 'timezone patch failed' });
			});

			await openDesktopShellSettingsSyncSection(page);

			const timezoneSelect =
				await expectDesktopSettingsSyncTimezoneVisible(page);
			await timezoneSelect.selectOption('Asia/Vladivostok');

			const errorBanner = page.getByTestId(
				'desktop-settings-shell-patch-error'
			);
			await expect(errorBanner).toBeVisible({ timeout: 15_000 });
			await expect(errorBanner).toContainText(
				/Could not sync expanded settings|Не удалось синхронизировать расширенные настройки/i
			);
		});
	}
);
