/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Opt-in Playwright lifecycle honesty: offline banner (P13), narrow Start 2-col
 * (P16 via All apps tab), and P18 stalled app-chunk load (abort dynamic assets → escalate CTA).
 *
 * Invariants:
 * - Gated by `DESKTOP_SHELL_E2E_RUN=1` + HTTPS `MC_E2E_BASE_URL` (`desktopShellE2eGate`).
 * - Offline banner body must mention browser/layout durability (EN or RU).
 * - At 360px Start All-apps grid resolves to two CSS columns.
 * - P18: after chunk abort, `desktop-app-load-fallback` reaches `data-stalled=true` with Close.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-SHELL-E2E-CI.md
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md
 */

import { expect, test } from 'playwright/test';
import { describeDesktop } from './desktopShellE2eGate';

const OFFLINE_BODY_RE = /browser|layout|icons|браузер|раскладк|ярлык|иконк/i;

describeDesktop('Desktop shell lifecycle honesty (P17–P18)', () => {
	test('offline: canvas banner shows browser-layout durability copy', async ({
		page,
		context,
	}) => {
		await page.goto('/');
		await expect(page.locator('#desktop-main')).toBeVisible({
			timeout: 60_000,
		});

		await context.setOffline(true);
		await page.evaluate(() => {
			window.dispatchEvent(new Event('offline'));
		});

		const banner = page.getByTestId('desktop-offline-banner');
		await expect(banner).toBeVisible({ timeout: 20_000 });
		const body = (await banner.innerText()).trim();
		expect(body).toMatch(OFFLINE_BODY_RE);
		expect(body.toLowerCase()).not.toContain('all changes on this device');

		await context.setOffline(false);
		await page.evaluate(() => {
			window.dispatchEvent(new Event('online'));
		});
		await expect(banner).toBeHidden({ timeout: 20_000 });
	});

	test('narrow Start: app grid is two columns (P16 density)', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 360, height: 640 });
		await page.goto('/');
		await expect(page.locator('#desktop-main')).toBeVisible({
			timeout: 60_000,
		});

		await page.getByRole('button', { name: /Start menu|Меню Пуск/ }).click();
		const panel = page.locator('#start-menu-panel');
		await expect(panel).toBeVisible({ timeout: 20_000 });

		const allAppsTab = page.getByTestId('start-menu-tab-all');
		await expect(allAppsTab).toBeVisible({ timeout: 10_000 });
		await allAppsTab.click();

		const grid = page.getByTestId('start-menu-app-grid').first();
		await expect(grid).toBeVisible({ timeout: 20_000 });

		const columnCount = await grid.evaluate((el) => {
			const cols = getComputedStyle(el).gridTemplateColumns;
			return cols.split(/\s+/).filter(Boolean).length;
		});
		expect(columnCount).toBe(2);
	});

	test('P18: aborted app chunk escalates load fallback then Close works', async ({
		page,
	}) => {
		await page.goto('/');
		await expect(page.locator('#desktop-main')).toBeVisible({
			timeout: 60_000,
		});

		let blockDynamicAssets = false;
		await page.route('**/*', async (route) => {
			const url = route.request().url();
			const isAssetScript =
				blockDynamicAssets &&
				/\/assets\//.test(url) &&
				/\.m?js(\?|$)/.test(url);
			if (isAssetScript) {
				// Never resolve — keeps React.lazy Suspense mounted until stall escalate.
				await new Promise(() => undefined);
				return;
			}
			await route.continue();
		});

		blockDynamicAssets = true;
		await page.evaluate(() => {
			window.dispatchEvent(
				new CustomEvent('desktop-open-app', {
					detail: { appComponent: 'MusicPlayer', forceNewWindow: true },
				})
			);
		});

		const fallback = page.getByTestId('desktop-app-load-fallback');
		await expect(fallback).toBeVisible({ timeout: 20_000 });
		await expect(fallback).toHaveAttribute('data-stalled', 'true', {
			timeout: 12_000,
		});
		await expect(
			page.getByTestId('desktop-app-load-stall-retry')
		).toBeVisible();
		await page.getByTestId('desktop-app-load-stall-close').click();
		await expect(fallback).toBeHidden({ timeout: 15_000 });
	});
});
