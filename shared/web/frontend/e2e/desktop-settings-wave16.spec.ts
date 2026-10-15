/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 16: storage map timezone field scrolls to sync prefs select.
 *
 * DESKTOP_SHELL_E2E_RUN=1 MC_E2E_BASE_URL=https://app.eliteew.ru … pnpm exec playwright test e2e/desktop-settings-wave16.spec.ts
 */

import { expect, test } from 'playwright/test';
import { describeDesktop } from './desktopShellE2eGate';
import {
	expectDesktopSettingsSyncTimezoneVisible,
	openDesktopShellSettingsSyncSection,
} from './desktopSettingsSyncHelpers';

describeDesktop(
	'Desktop settings wave 16 (storage map → sync timezone)',
	() => {
		test('clicking timezone field reveals sync prefs timezone select', async ({
			page,
		}) => {
			await openDesktopShellSettingsSyncSection(page);

			const timezoneField = page.getByTestId(
				'desktop-settings-storage-map-field-shell_state-timezone'
			);
			await expect(timezoneField).toBeVisible({ timeout: 45_000 });
			await timezoneField.click();

			await expect(
				page.locator('#desktop-settings-field-shell_state-timezone')
			).toBeVisible({ timeout: 20_000 });
			await expectDesktopSettingsSyncTimezoneVisible(page);
		});
	}
);
