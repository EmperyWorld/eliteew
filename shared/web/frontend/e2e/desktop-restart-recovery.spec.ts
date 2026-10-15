/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Desktop maintenance UX: workspace stays mounted under inline overlay.
 *
 * Run: DESKTOP_SHELL_E2E_RUN=1 MC_E2E_BASE_URL=https://app.eliteew.ru pnpm exec playwright test e2e/desktop-restart-recovery.spec.ts
 */

import { expect, test } from 'playwright/test';
import { describeDesktop } from './desktopShellE2eGate';

describeDesktop('Desktop restart recovery UX', () => {
	test('keeps desktop icons visible under maintenance overlay', async ({
		page,
	}) => {
		await page.goto('/#desktop');
		await expect(page.locator('#desktop-main').first()).toBeVisible({
			timeout: 60_000,
		});
		await expect(page.locator('[data-desktop-icon]').first()).toBeVisible({
			timeout: 60_000,
		});

		await page.route('**/api/v1/system/maintenance*', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					active: true,
					window: {
						id: 'e2e-maintenance',
						kind: 'stack0_restart',
						phase: 'active',
						active: true,
						retry_after_seconds: 30,
						title: 'EliteEW восстанавливает связь',
						message:
							'Связь с сервером временно прервана. Окна и данные сохранены.',
						affected_services: ['Безраздельный мир'],
						user_impact: 'Вкладку можно оставить открытой.',
						suppress_error_toasts: true,
						block_new_long_jobs: true,
						allow_operator_bypass: false,
					},
				}),
			});
		});

		await page.evaluate(() => {
			window.dispatchEvent(new Event('focus'));
		});
		await page.reload({ waitUntil: 'domcontentloaded' });
		await expect(page.locator('#desktop-main').first()).toBeVisible({
			timeout: 60_000,
		});
		await expect(page.locator('[data-desktop-icon]').first()).toBeVisible({
			timeout: 30_000,
		});
		await expect(
			page.locator('[data-testid="desktop-maintenance-overlay"]')
		).toBeVisible({ timeout: 30_000 });
		await expect(
			page.locator('[data-testid="desktop-taskbar-recovery-chip"]')
		).toBeVisible({ timeout: 15_000 });
	});
});
