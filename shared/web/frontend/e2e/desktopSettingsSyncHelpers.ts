/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 22 Lock: shared Playwright helpers for Desktop Settings sync / timezone
 * journeys (wave 16–19). Specs reuse these instead of duplicating goto + open shell.
 *
 * Invariants:
 * - Does not change product behavior; opt-in via DESKTOP_SHELL_E2E_RUN like peers.
 *
 * Related:
 * - e2e/desktop-settings-wave16.spec.ts … wave19.spec.ts
 * - documentation/product/desktop/DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md
 */

import { expect, type Locator, type Page } from 'playwright/test';

export const DESKTOP_SETTINGS_SYNC_TIMEZONE_TEST_ID =
	'desktop-settings-sync-timezone';

export async function gotoDesktopShellReady(page: Page): Promise<void> {
	await page.goto('/');
	await expect(page.locator('#desktop-main')).toBeVisible({
		timeout: 60_000,
	});
}

export async function openDesktopShellSettings(
	page: Page,
	tab:
		| 'shell'
		| 'personalize'
		| 'icons'
		| 'chrome'
		| 'widgets'
		| 'performance' = 'shell'
): Promise<void> {
	await page.evaluate((settingsTab) => {
		window.dispatchEvent(
			new CustomEvent('desktop-open-shell-settings', {
				detail: { tab: settingsTab },
			})
		);
	}, tab);
}

export async function openDesktopShellSettingsSyncSection(
	page: Page
): Promise<void> {
	await gotoDesktopShellReady(page);
	await openDesktopShellSettings(page, 'shell');
}

export function desktopSettingsSyncTimezoneSelect(page: Page): Locator {
	return page.getByTestId(DESKTOP_SETTINGS_SYNC_TIMEZONE_TEST_ID);
}

export async function expectDesktopSettingsSyncTimezoneVisible(
	page: Page
): Promise<Locator> {
	const timezoneSelect = desktopSettingsSyncTimezoneSelect(page);
	await expect(timezoneSelect).toBeVisible({ timeout: 45_000 });
	return timezoneSelect;
}
