import { expect, test } from 'playwright/test';
import { describeDesktop } from './desktopShellE2eGate';
import { collectDesktopRuntimeSmokeProfile } from './desktopRuntimeSmoke';

/**
 * Optional smoke for Desktop shell routing (authenticated host).
 *
 * Single file:
 *   DESKTOP_SHELL_E2E_RUN=1 MC_E2E_BASE_URL=https://app.eliteew.ru \
 *     pnpm exec playwright test e2e/desktop-shell-smoke.spec.ts
 *
 * All desktop-prefixed specs: `pnpm exec playwright test e2e/desktop*` (same env vars).
 * CI-parity bundled run: `pnpm run test:e2e:desktop` (see documentation/product/desktop/DESKTOP-SHELL-E2E-CI.md).
 */
describeDesktop('Desktop shell smoke (wave 12)', () => {
	test('landing loads and exposes desktop landmark', async ({ page }) => {
		await page.goto('/');
		const main = page.locator('#desktop-main');
		await expect(main.first()).toBeVisible({ timeout: 60_000 });
	});

	test('idle runtime profile stays inside reliability budget', async ({
		page,
	}, testInfo) => {
		await page.goto('/');
		await expect(page.locator('#desktop-main')).toBeVisible({
			timeout: 60_000,
		});

		const profile = await collectDesktopRuntimeSmokeProfile(page, {
			sampleMs: 2500,
		});
		await testInfo.attach('desktop-runtime-smoke.json', {
			body: JSON.stringify(profile, null, 2),
			contentType: 'application/json',
		});

		expect(profile.hasDesktopMain).toBe(true);
		expect(profile.hasStaleChip).toBe(false);
		expect(profile.hasStalledLoader).toBe(false);
		expect(profile.frameCount).toBeGreaterThan(20);
		expect(profile.runningAnimationCount).toBeLessThanOrEqual(2);
	});

	test('offline banner appears when network goes offline', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('#desktop-main')).toBeVisible({
			timeout: 60_000,
		});

		const banner = page.getByTestId('desktop-offline-banner');
		await expect(banner).toHaveCount(0);

		await page.context().setOffline(true);
		await expect(banner).toBeVisible({ timeout: 10_000 });

		await page.context().setOffline(false);
		await expect(banner).toHaveCount(0, { timeout: 10_000 });
	});
});
