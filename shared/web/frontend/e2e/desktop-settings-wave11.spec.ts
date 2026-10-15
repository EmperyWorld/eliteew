import { expect, test } from 'playwright/test';
import { describeDesktop } from './desktopShellE2eGate';
import { readOidcSubjectFromPage } from './desktopOidcPrincipal';

const QUEUE_STORAGE_KEY = 'eliteew-desktop-persist-patch-queue-v1';

/**
 * Wave 11: manual persist queue flush after failed PATCH, then success.
 *
 * DESKTOP_SHELL_E2E_RUN=1 MC_E2E_BASE_URL=https://app.eliteew.ru … pnpm exec playwright test e2e/desktop-settings-wave11.spec.ts
 */
describeDesktop('Desktop settings wave 11 (persist queue manual flush)', () => {
	test('operator can flush queue after transient PATCH failure', async ({
		page,
	}) => {
		await page.goto('/');
		await expect(page.locator('#desktop-main')).toBeVisible({
			timeout: 60_000,
		});

		const subject = await readOidcSubjectFromPage(page);
		test.skip(!subject, 'needs authenticated OIDC subject in session storage');

		await page.addInitScript(
			([key, sub]) => {
				localStorage.setItem(
					key,
					JSON.stringify({
						version: 1,
						subject: sub,
						ops: [{ kind: 'shell', payload: { quiet_mode: true } }],
					})
				);
			},
			[QUEUE_STORAGE_KEY, subject] as const
		);

		let failShellPatch = true;
		await page.route('**/api/v1/desktop/shell-state', async (route) => {
			if (route.request().method() !== 'PATCH') {
				await route.continue();
				return;
			}
			if (failShellPatch) {
				await route.fulfill({ status: 503, body: 'transient failure' });
				return;
			}
			await route.continue();
		});

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

		const queueBanner = page.getByTestId(
			'desktop-settings-persist-queue-banner'
		);
		await expect(queueBanner).toBeVisible({ timeout: 45_000 });

		const flushButton = page.getByTestId(
			'desktop-settings-persist-queue-flush'
		);
		await expect(flushButton).toBeVisible();
		await flushButton.click();

		await expect(
			page.getByText(
				/Could not flush the save queue|Не удалось отправить очередь/i
			)
		).toBeVisible({ timeout: 20_000 });

		failShellPatch = false;
		await flushButton.click();
		await expect(queueBanner).toBeHidden({ timeout: 45_000 });
	});
});
