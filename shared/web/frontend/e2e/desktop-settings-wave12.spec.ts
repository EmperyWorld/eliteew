import { expect, test } from 'playwright/test';
import { describeDesktop } from './desktopShellE2eGate';

/**
 * Wave 12: storage map field click navigates to the matching Settings tab.
 *
 * DESKTOP_SHELL_E2E_RUN=1 MC_E2E_BASE_URL=https://app.eliteew.ru … pnpm exec playwright test e2e/desktop-settings-wave12.spec.ts
 */
describeDesktop('Desktop settings wave 12 (storage map navigation)', () => {
	test('clicking wallpaper field switches to personalize tab', async ({
		page,
	}) => {
		await page.goto('/');
		await expect(page.locator('#desktop-main')).toBeVisible({
			timeout: 60_000,
		});

		await page.evaluate(() => {
			window.dispatchEvent(
				new CustomEvent('desktop-open-shell-settings', {
					detail: { tab: 'shell' },
				})
			);
		});

		const wallpaperField = page.getByTestId(
			'desktop-settings-storage-map-field-desktop_config-wallpaper'
		);
		await expect(wallpaperField).toBeVisible({ timeout: 45_000 });
		await wallpaperField.click();

		const personalizeTab = page.locator(
			'#desktop-settings-tab-d-personalize[aria-selected="true"]'
		);
		await expect(personalizeTab).toBeVisible({ timeout: 20_000 });
		await expect(
			page.locator('#desktop-settings-field-desktop_config-wallpaper')
		).toBeVisible();
	});
});
