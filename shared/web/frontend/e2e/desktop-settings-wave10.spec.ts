import { expect, test } from 'playwright/test';
import { describeDesktop } from './desktopShellE2eGate';
import { readOidcSubjectFromPage } from './desktopOidcPrincipal';

const QUEUE_STORAGE_KEY = 'eliteew-desktop-persist-patch-queue-v1';

/**
 * Wave 10: persist queue visible offline and auto-flush after reconnect.
 *
 * DESKTOP_SHELL_E2E_RUN=1 MC_E2E_BASE_URL=https://app.eliteew.ru … pnpm exec playwright test e2e/desktop-settings-wave10.spec.ts
 */
describeDesktop('Desktop settings wave 10 (persist queue flush)', () => {
	test('queued shell patch clears after browser reconnects', async ({
		page,
		context,
	}) => {
		await page.goto('/');
		await expect(page.locator('#desktop-main')).toBeVisible({
			timeout: 60_000,
		});

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
						ops: [{ kind: 'shell', payload: { quiet_mode: true } }],
					})
				);
			},
			[QUEUE_STORAGE_KEY, subject] as const
		);
		await page.reload({ waitUntil: 'domcontentloaded' });
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

		const queueLine = page.getByText(
			/Pending saves in queue: 1 \(config 0, shell 1\)|В очереди сохранений: 1 \(конфиг 0, shell 1\)/i
		);
		await expect(queueLine).toBeVisible({ timeout: 45_000 });

		await context.setOffline(false);
		await expect(queueLine).toBeHidden({ timeout: 45_000 });
	});
});
