import { expect, test } from 'playwright/test';
import { describeDesktop } from './desktopShellE2eGate';

/**
 * EWA Companion chat smoke: compact presence (lg+), transcript, operations rail.
 *
 * DESKTOP_SHELL_E2E_RUN=1 MC_E2E_BASE_URL=https://app.eliteew.ru … pnpm exec playwright test e2e/ewa-companion-chat-smoke.spec.ts
 */
describeDesktop('EWA companion chat smoke', () => {
	test('lg viewport: open EWA window, transcript + compact presence + operations', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto('/');
		await expect(page.locator('#desktop-main')).toBeVisible({
			timeout: 60_000,
		});

		await page.evaluate(() => {
			window.dispatchEvent(
				new CustomEvent('desktop-open-app', {
					detail: { appComponent: 'EwaApp' },
				})
			);
		});

		await expect(page.getByTestId('ewa-companion-chat-root')).toBeVisible({
			timeout: 45_000,
		});
		await expect(page.getByTestId('ewa-companion-transcript')).toBeVisible({
			timeout: 20_000,
		});
		await expect(
			page.getByTestId('ewa-companion-presence-compact')
		).toBeVisible({
			timeout: 20_000,
		});
		await expect(page.getByTestId('ewa-companion-composer')).toBeVisible({
			timeout: 20_000,
		});
		await expect(page.getByTestId('ewa-companion-send')).toBeDisabled({
			timeout: 5_000,
		});

		await expect(
			page.getByText(/Current operations|Текущие операции/)
		).toBeVisible({ timeout: 20_000 });
	});
});
