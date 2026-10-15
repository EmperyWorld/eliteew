import { expect, test } from 'playwright/test';
import { describeDesktop } from './desktopShellE2eGate';

/**
 * Wave 9: Settings sync card offline hint (authenticated host).
 *
 * DESKTOP_SHELL_E2E_RUN=1 MC_E2E_BASE_URL=https://app.eliteew.ru … pnpm exec playwright test e2e/desktop-settings-wave9.spec.ts
 */
describeDesktop('Desktop settings wave 9 (sync offline)', () => {
	test('sync card shows offline hint when browser goes offline', async ({
		page,
		context,
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

		const shellTab = page.getByRole('tab', {
			name: /Shell behavior|Поведение оболочки/,
		});
		await expect(shellTab).toBeVisible({ timeout: 45_000 });
		if ((await shellTab.getAttribute('aria-selected')) !== 'true') {
			await shellTab.click();
		}

		await context.setOffline(true);
		await expect(
			page.getByText(
				/Offline: config and shell_state|Офлайн: изменения конфигурации и shell_state/
			)
		).toBeVisible({ timeout: 20_000 });

		await context.setOffline(false);
	});
});
