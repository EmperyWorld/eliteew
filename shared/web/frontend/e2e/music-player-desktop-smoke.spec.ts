import { expect, test } from 'playwright/test';
import { describeDesktop } from './desktopShellE2eGate';

/**
 * Music Player desktop smoke: open app shell + guide root.
 *
 * DESKTOP_SHELL_E2E_RUN=1 MC_E2E_BASE_URL=https://app.eliteew.ru …
 *   pnpm exec playwright test e2e/music-player-desktop-smoke.spec.ts
 */
describeDesktop('Music Player smoke', () => {
	test('open MusicPlayer: root + search', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto('/');
		await expect(page.locator('#desktop-main')).toBeVisible({
			timeout: 60_000,
		});

		await page.evaluate(() => {
			window.dispatchEvent(
				new CustomEvent('desktop-open-app', {
					detail: { appComponent: 'MusicPlayer' },
				})
			);
		});

		await expect(page.locator('[data-music-player-root]')).toBeVisible({
			timeout: 45_000,
		});
		await expect(
			page.getByRole('searchbox', { name: /поиск|search/i })
		).toBeVisible({
			timeout: 20_000,
		});
	});
});
