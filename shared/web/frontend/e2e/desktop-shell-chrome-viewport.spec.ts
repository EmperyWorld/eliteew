import { expect, test } from 'playwright/test';
import { describeDesktop } from './desktopShellE2eGate';

/**
 * Narrow viewport regression for desktop shell chrome (plan 01/20 P2-6).
 *
 * Run:
 *   DESKTOP_SHELL_E2E_RUN=1 MC_E2E_BASE_URL=https://app.eliteew.ru \
 *     pnpm exec playwright test e2e/desktop-shell-chrome-viewport.spec.ts
 */
describeDesktop('Desktop shell chrome viewport (375px)', () => {
	test.use({ viewport: { width: 375, height: 812 } });

	test('taskbar compact height and Start sheet usable', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('#desktop-main')).toBeVisible({
			timeout: 60_000,
		});
		const strip = page.locator('[data-desktop-taskbar-strip]');
		await expect(strip).toBeVisible();
		const box = await strip.boundingBox();
		expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
		expect(box?.height ?? 0).toBeLessThanOrEqual(56);
		await page.locator('[data-start-menu-toggle="true"]').click();
		await expect(page.locator('#start-menu-panel')).toBeVisible({
			timeout: 10_000,
		});
	});

	test('Quick Search opens on narrow viewport', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('#desktop-main')).toBeVisible({
			timeout: 60_000,
		});
		await page.keyboard.press('Meta+S');
		await expect(
			page.getByRole('dialog', { name: /quick search|быстрый поиск/i })
		).toBeVisible({ timeout: 10_000 });
	});

	test('VD strip hidden; compact overflow menu available', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('#desktop-main')).toBeVisible({
			timeout: 60_000,
		});
		await expect(page.locator('[data-vd-switch="true"]')).toHaveCount(0);
		await expect(
			page.getByTestId('virtual-desktops-compact-menu')
		).toBeVisible();
	});
});
