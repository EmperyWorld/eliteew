/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 17: sync prefs timezone change + offline persist queue flush.
 *
 * DESKTOP_SHELL_E2E_RUN=1 MC_E2E_BASE_URL=https://app.eliteew.ru … pnpm exec playwright test e2e/desktop-settings-wave17.spec.ts
 */

import { expect, test } from 'playwright/test';
import { describeDesktop } from './desktopShellE2eGate';
import { readOidcSubjectFromPage } from './desktopOidcPrincipal';
import {
	expectDesktopSettingsSyncTimezoneVisible,
	gotoDesktopShellReady,
	openDesktopShellSettings,
	openDesktopShellSettingsSyncSection,
} from './desktopSettingsSyncHelpers';

const QUEUE_STORAGE_KEY = 'eliteew-desktop-persist-patch-queue-v1';

describeDesktop('Desktop settings wave 17 (sync timezone + queue)', () => {
	test('changing sync timezone select updates visible value', async ({
		page,
	}) => {
		await openDesktopShellSettingsSyncSection(page);

		const timezoneSelect = await expectDesktopSettingsSyncTimezoneVisible(page);
		const target = 'Asia/Vladivostok';
		await timezoneSelect.selectOption(target);
		await expect(timezoneSelect).toHaveValue(target);
	});

	test('queued timezone shell patch clears after reconnect', async ({
		page,
		context,
	}) => {
		await gotoDesktopShellReady(page);

		const subject = await readOidcSubjectFromPage(page);
		test.skip(!subject, 'needs authenticated OIDC subject in session storage');

		await context.setOffline(true);
		await page.evaluate(
			([key, sub]) => {
				localStorage.setItem(
					key,
					JSON.stringify({
						version: 1,
						subject: sub,
						ops: [
							{
								kind: 'shell',
								payload: { timezone: 'Asia/Vladivostok' },
							},
						],
					})
				);
			},
			[QUEUE_STORAGE_KEY, subject] as const
		);
		await page.reload({ waitUntil: 'domcontentloaded' });
		await gotoDesktopShellReady(page);
		await openDesktopShellSettings(page, 'shell');

		const queueLine = page.getByText(
			/Pending saves in queue: 1 \(config 0, shell 1\)|В очереди сохранений: 1 \(конфиг 0, shell 1\)/i
		);
		await expect(queueLine).toBeVisible({ timeout: 45_000 });

		await context.setOffline(false);
		await expect(queueLine).toBeHidden({ timeout: 45_000 });
	});
});
