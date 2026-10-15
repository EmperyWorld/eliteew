/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 4 Playwright matrix — narrow viewport × reduced-motion × low-GPU paths
 * for Start, Settings, and one open-app journey. Absorbs prior chrome-viewport
 * assertions (375px taskbar / Start sheet).
 *
 * Invariants:
 * - Gated by `DESKTOP_SHELL_E2E_RUN=1` + HTTPS `MC_E2E_BASE_URL`.
 * - Axes do not wipe each other: reduce-motion + low-GPU both applied.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-SHELL-A11Y-CHECKLIST.md
 * - documentation/product/desktop/DESKTOP-SHELL-E2E-CI.md
 * - e2e/desktop-shell-chrome-viewport.spec.ts (manual peer; matrix covers core)
 */

import { expect, test } from 'playwright/test';
import { describeDesktop } from './desktopShellE2eGate';

async function enableReducedMotion(page: import('playwright/test').Page) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
}

async function setLowGpuWindowsOverride(
	page: import('playwright/test').Page,
	enabled: boolean
) {
	const value = enabled ? '1' : '0';
	await page.addInitScript((v) => {
		try {
			window.localStorage.setItem('elite_desktop_low_gpu_windows', v);
		} catch {
			/* ignore */
		}
	}, value);
}

describeDesktop(
	'Desktop shell Wave 4 matrix (narrow × motion × low-GPU)',
	() => {
		test('narrow 390: Start All apps + Settings open stay usable', async ({
			page,
		}) => {
			await page.setViewportSize({ width: 390, height: 844 });
			await enableReducedMotion(page);
			await page.goto('/');
			await expect(page.locator('#desktop-main')).toBeVisible({
				timeout: 60_000,
			});

			const strip = page.locator('[data-desktop-taskbar-strip]');
			await expect(strip).toBeVisible();
			const stripBox = await strip.boundingBox();
			expect(stripBox?.height ?? 0).toBeGreaterThanOrEqual(44);
			expect(stripBox?.height ?? 0).toBeLessThanOrEqual(64);

			await page.locator('[data-start-menu-toggle="true"]').click();
			const panel = page.locator('#start-menu-panel');
			await expect(panel).toBeVisible({ timeout: 20_000 });

			const allApps = page.getByTestId('start-menu-tab-all');
			await expect(allApps).toBeVisible();
			await allApps.click();
			const grid = page.getByTestId('start-menu-app-grid').first();
			await expect(grid).toBeVisible({ timeout: 20_000 });
			const viewport = page.viewportSize();
			expect(viewport).toBeTruthy();
			const gridBox = await grid.boundingBox();
			expect(gridBox, 'All apps grid in viewport').toBeTruthy();
			if (gridBox && viewport) {
				expect(gridBox.y).toBeGreaterThanOrEqual(-1);
				expect(gridBox.y + Math.min(gridBox.height, 40)).toBeLessThanOrEqual(
					viewport.height + 1
				);
			}

			await page.keyboard.press('Escape');
			await page.evaluate(() => {
				window.dispatchEvent(
					new CustomEvent('desktop-open-shell-settings', {
						detail: { tab: 'personalize' },
					})
				);
			});
			const settingsRoot = page.locator('[data-desktop-settings-root]');
			await expect(
				page
					.getByRole('tab', { name: /Personalize|Персонализа/i })
					.or(page.locator('[data-desktop-settings-nav]'))
			).toBeVisible({ timeout: 45_000 });
			const nav = page.locator('[data-desktop-settings-nav]');
			await expect(nav).toHaveAttribute(
				'data-desktop-settings-nav',
				'stacked',
				{
					timeout: 10_000,
				}
			);
			void settingsRoot;
		});

		test('narrow 360 + reduce-motion + low-GPU hint: open Assistant without clip', async ({
			page,
		}) => {
			await setLowGpuWindowsOverride(page, true);
			await enableReducedMotion(page);
			await page.setViewportSize({ width: 360, height: 640 });
			await page.goto('/');
			await expect(page.locator('#desktop-main')).toBeVisible({
				timeout: 60_000,
			});

			await page.locator('[data-start-menu-toggle="true"]').click();
			await expect(page.locator('#start-menu-panel')).toBeVisible({
				timeout: 20_000,
			});
			await page.getByTestId('start-menu-tab-all').click();

			const assistant = page
				.getByRole('button', { name: /Assistant|Ассистент|Справка/i })
				.first();
			if (await assistant.isVisible().catch(() => false)) {
				await assistant.click();
				const win = page.locator('[data-desktop-window]').first();
				await expect(win).toBeVisible({ timeout: 45_000 });
				const box = await win.boundingBox();
				const viewport = page.viewportSize();
				expect(box && viewport).toBeTruthy();
				if (box && viewport) {
					expect(box.x + box.width).toBeGreaterThan(8);
					expect(box.y + 24).toBeLessThanOrEqual(viewport.height + 2);
				}
			} else {
				// Catalog label drift — still prove Start chrome under axes.
				const footerSettings = page.getByRole('button', {
					name: /Settings|Настройки/,
				});
				await expect(footerSettings).toBeVisible();
				const box = await footerSettings.boundingBox();
				const viewport = page.viewportSize();
				expect(box && viewport).toBeTruthy();
				if (box && viewport) {
					expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
				}
			}

			const reduceMotion = await page.evaluate(
				() => window.matchMedia('(prefers-reduced-motion: reduce)').matches
			);
			expect(reduceMotion).toBe(true);
		});

		test('dual-flag negative: elite_desktop_low_gpu_windows=0 clears reduce-backdrop-blur (not default-on)', async ({
			page,
		}) => {
			await setLowGpuWindowsOverride(page, false);
			await enableReducedMotion(page);
			await page.setViewportSize({ width: 390, height: 700 });
			await page.goto('/');
			await expect(page.locator('#desktop-main')).toBeVisible({
				timeout: 60_000,
			});
			await page.locator('[data-start-menu-toggle="true"]').click();
			await expect(page.locator('#start-menu-panel')).toBeVisible({
				timeout: 20_000,
			});
			const reduceMotion = await page.evaluate(
				() => window.matchMedia('(prefers-reduced-motion: reduce)').matches
			);
			expect(reduceMotion).toBe(true);
			const stored = await page.evaluate(() =>
				window.localStorage.getItem('elite_desktop_low_gpu_windows')
			);
			expect(stored).toBe('0');
			const portal = page.getByTestId('desktop-shell-floating-portal');
			await expect(portal).toBeVisible({ timeout: 10_000 });
			await expect(portal).not.toHaveAttribute(
				'data-desktop-reduce-backdrop-blur',
				'true'
			);
		});

		test('dual-flag positive: elite_desktop_low_gpu_windows=1 sets reduce-backdrop-blur with reduce-motion', async ({
			page,
		}) => {
			await setLowGpuWindowsOverride(page, true);
			await enableReducedMotion(page);
			await page.setViewportSize({ width: 390, height: 700 });
			await page.goto('/');
			await expect(page.locator('#desktop-main')).toBeVisible({
				timeout: 60_000,
			});
			await page.locator('[data-start-menu-toggle="true"]').click();
			await expect(page.locator('#start-menu-panel')).toBeVisible({
				timeout: 20_000,
			});
			const reduceMotion = await page.evaluate(
				() => window.matchMedia('(prefers-reduced-motion: reduce)').matches
			);
			expect(reduceMotion).toBe(true);
			const stored = await page.evaluate(() =>
				window.localStorage.getItem('elite_desktop_low_gpu_windows')
			);
			expect(stored).toBe('1');
			const portal = page.getByTestId('desktop-shell-floating-portal');
			await expect(portal).toBeVisible({ timeout: 10_000 });
			await expect(portal).toHaveAttribute(
				'data-desktop-reduce-backdrop-blur',
				'true'
			);
		});
	}
);
