import { expect, test } from 'playwright/test';
import { describeDesktop } from './desktopShellE2eGate';

/**
 * Wave 8: Settings shell tab sub-nav + save-current-workspace CTA (authenticated host).
 *
 * DESKTOP_SHELL_E2E_RUN=1 MC_E2E_BASE_URL=https://app.eliteew.ru … pnpm exec playwright test e2e/desktop-settings-wave8.spec.ts
 */
describeDesktop('Desktop settings wave 8 (shell sub-nav)', () => {
	test('shell tab exposes sticky subsection navigation', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('#desktop-main')).toBeVisible({
			timeout: 60_000,
		});

		// Deep-link `tab: 'shell'` auto-expands advanced disclosure (personalize-first IA).
		await page.evaluate(() => {
			window.dispatchEvent(
				new CustomEvent('desktop-open-shell-settings', {
					detail: { tab: 'shell' },
				})
			);
		});

		const shellTab = page.getByRole('tab', {
			name: /Behavior|Поведение/,
		});
		await expect(shellTab).toBeVisible({ timeout: 45_000 });
		if ((await shellTab.getAttribute('aria-selected')) !== 'true') {
			await shellTab.click();
		}

		const subNav = page.getByRole('navigation', {
			name: /Shell behavior subsections|Разделы вкладки «Поведение»/,
		});
		await expect(subNav).toBeVisible({ timeout: 20_000 });
		await expect(
			subNav.getByRole('button', { name: /Sync|Синхронизация/ })
		).toBeVisible();
		await expect(
			subNav.getByRole('button', { name: /Advanced|Расширенные/ })
		).toBeVisible();
	});

	test('workspace card shows save-current-desktop CTA', async ({ page }) => {
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

		const saveCta = page.getByRole('button', {
			name: /Save current desktop as workspace|Сохранить текущий стол как пространство/,
		});
		await expect(saveCta).toBeVisible({ timeout: 45_000 });
	});
});
