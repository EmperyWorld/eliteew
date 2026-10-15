/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 18: sync timezone select schedules coalesced shell-state PATCH.
 *
 * DESKTOP_SHELL_E2E_RUN=1 MC_E2E_BASE_URL=https://app.eliteew.ru … pnpm exec playwright test e2e/desktop-settings-wave18.spec.ts
 */

import { expect, test } from 'playwright/test';
import { describeDesktop } from './desktopShellE2eGate';
import {
	expectDesktopSettingsSyncTimezoneVisible,
	openDesktopShellSettingsSyncSection,
} from './desktopSettingsSyncHelpers';

describeDesktop('Desktop settings wave 18 (timezone PATCH)', () => {
	test('timezone select sends PATCH shell-state with timezone field', async ({
		page,
	}) => {
		const captured: { timezone?: string }[] = [];

		await page.route('**/api/v1/desktop/shell-state', async (route) => {
			if (route.request().method() !== 'PATCH') {
				await route.continue();
				return;
			}
			try {
				const body = route.request().postDataJSON() as {
					timezone?: string;
				};
				if (typeof body?.timezone === 'string') {
					captured.push({ timezone: body.timezone });
				}
			} catch {
				// ignore parse errors for unrelated PATCH bodies
			}
			await route.continue();
		});

		await openDesktopShellSettingsSyncSection(page);

		const timezoneSelect = await expectDesktopSettingsSyncTimezoneVisible(page);
		const target = 'Asia/Vladivostok';
		await timezoneSelect.selectOption(target);

		await expect
			.poll(() => captured.some((row) => row.timezone === target), {
				timeout: 15_000,
			})
			.toBe(true);
	});
});
