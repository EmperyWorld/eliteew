import { expect, test } from 'playwright/test';
import { describeDesktop } from './desktopShellE2eGate';

/**
 * MusicForge (Студия песен) desktop smoke: open app shell + idea field.
 *
 * DESKTOP_SHELL_E2E_RUN=1 MC_E2E_BASE_URL=https://app.eliteew.ru …
 *   pnpm exec playwright test e2e/music-forge-desktop-smoke.spec.ts
 */
describeDesktop('MusicForge Song Studio smoke', () => {
	test('open MusicForgeApp: root + idea field', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto('/');
		await expect(page.locator('#desktop-main')).toBeVisible({
			timeout: 60_000,
		});

		await page.evaluate(() => {
			window.dispatchEvent(
				new CustomEvent('desktop-open-app', {
					detail: { appComponent: 'MusicForgeApp' },
				})
			);
		});

		await expect(page.getByTestId('music-forge-root')).toBeVisible({
			timeout: 45_000,
		});
		await expect(page.locator('#music-forge-idea')).toBeVisible({
			timeout: 20_000,
		});
	});
});
