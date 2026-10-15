/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Journey lock: `desktop-open-start-menu` with tab opens Start Menu on that tab
 * without requiring a manual «More» click for secondary tabs.
 *
 * Invariants:
 * - Gated by DESKTOP_SHELL_E2E_RUN + MC_E2E_BASE_URL (same as other desktop shell E2E).
 *
 * Related:
 * - desktopDeepLink.requestOpenStartMenu
 * - useStartMenuDisclosure
 */

import { expect, test } from 'playwright/test';
import { describeDesktop } from './desktopShellE2eGate';

/**
 * DESKTOP_SHELL_E2E_RUN=1 MC_E2E_BASE_URL=https://app.eliteew.ru …
 * pnpm exec playwright test e2e/desktop-start-menu-intent.spec.ts
 */
describeDesktop('Desktop Start Menu intent deep-link', () => {
	test('requestOpenStartMenu(recent) selects Recent tab', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('#desktop-main')).toBeVisible({
			timeout: 60_000,
		});

		await page.evaluate(() => {
			window.dispatchEvent(
				new CustomEvent('desktop-open-start-menu', {
					detail: { tab: 'recent' },
				})
			);
		});

		const panel = page.locator('#start-menu-panel');
		await expect(panel).toBeVisible({ timeout: 20_000 });

		const recentTab = panel.getByRole('button', {
			name: /Recently used apps|Недавние приложения|Recent|Недавние/,
		});
		await expect(recentTab).toBeVisible({ timeout: 10_000 });
		await expect(recentTab).toHaveAttribute('aria-pressed', 'true');
	});

	test('requestOpenStartMenu(work) expands More and selects Work', async ({
		page,
	}) => {
		await page.goto('/');
		await expect(page.locator('#desktop-main')).toBeVisible({
			timeout: 60_000,
		});

		await page.evaluate(() => {
			window.dispatchEvent(
				new CustomEvent('desktop-open-start-menu', {
					detail: { tab: 'work' },
				})
			);
		});

		const panel = page.locator('#start-menu-panel');
		await expect(panel).toBeVisible({ timeout: 20_000 });

		const workTab = panel.getByRole('button', {
			name: /Workspaces, collections|Пространства|Work|Работа/,
		});
		await expect(workTab).toBeVisible({ timeout: 10_000 });
		await expect(workTab).toHaveAttribute('aria-pressed', 'true');
	});
});
