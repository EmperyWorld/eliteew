import { expect, test } from 'playwright/test';
import { describeDesktop } from './desktopShellE2eGate';

/**
 * Wave 16: focus after closing Desktop control center + narrow Start Menu footer visibility.
 *
 * DESKTOP_SHELL_E2E_RUN=1 MC_E2E_BASE_URL=https://app.eliteew.ru … pnpm exec playwright test e2e/desktop-shell-wave16-a11y.spec.ts
 */
describeDesktop('Desktop shell wave 16 (a11y + narrow Start menu)', () => {
	test('shell settings: switch tab, close, focus returns to #desktop-main', async ({
		page,
	}) => {
		await page.goto('/');
		await expect(page.locator('#desktop-main')).toBeVisible({
			timeout: 60_000,
		});

		await page.evaluate(() => {
			window.dispatchEvent(
				new CustomEvent('desktop-open-shell-settings', {
					detail: { tab: 'personalize' },
				})
			);
		});

		const closeBtn = page.getByRole('button', {
			name: /^(Close|Закрыть)$/,
		});
		await expect(closeBtn).toBeVisible({ timeout: 45_000 });

		const iconsTab = page.getByRole('tab', {
			name: /Icons and grid|Иконки и сетка/,
		});
		await expect(iconsTab).toBeVisible({ timeout: 20_000 });
		await iconsTab.click();

		await closeBtn.click();
		await expect(closeBtn).toBeHidden({ timeout: 20_000 });

		const focusedMain = await page.evaluate(
			() => document.activeElement?.id === 'desktop-main'
		);
		expect(focusedMain).toBe(true);
	});

	test('narrow viewport: Start menu footer actions stay within viewport', async ({
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

		const viewport = page.viewportSize();
		expect(viewport).toBeTruthy();
		if (!viewport) {
			throw new Error('Expected viewport size after setViewportSize');
		}
		const vh = viewport.height;
		expect(vh).toBeGreaterThan(0);

		const critical = [
			/App Store|Магазин приложений/,
			/Settings|Настройки/,
			/Sign out \/ power|Выключение/,
		];

		for (const name of critical) {
			const btn = page.getByRole('button', { name });
			await expect(btn).toBeVisible();
			const box = await btn.boundingBox();
			expect(box, `bounding box for ${String(name)}`).toBeTruthy();
			if (!box) {
				throw new Error(`Expected bounding box for ${String(name)}`);
			}
			expect(box.y).toBeGreaterThanOrEqual(-0.5);
			expect(box.y + box.height).toBeLessThanOrEqual(vh + 1);
		}
	});
});
