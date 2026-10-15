import { expect, test } from 'playwright/test';
import { describeDesktop } from './desktopShellE2eGate';
import { readOidcSubjectFromPage } from './desktopOidcPrincipal';

/**
 * Favorites widget slot smoke: widgets panel renders the favorites slot.
 *
 * DESKTOP_SHELL_E2E_RUN=1 MC_E2E_BASE_URL=https://app.eliteew.ru \
 *   pnpm exec playwright test e2e/desktop-favorites-widget-smoke.spec.ts
 *
 * All desktop-prefixed specs: `pnpm exec playwright test e2e/desktop*` (same env vars).
 */
describeDesktop('Desktop favorites widget smoke', () => {
	test('widgets panel shows favorites slot', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('#desktop-main')).toBeVisible({
			timeout: 60_000,
		});

		const subject = await readOidcSubjectFromPage(page);
		test.skip(!subject, 'needs authenticated OIDC subject in session storage');

		await page.evaluate(() => {
			window.dispatchEvent(
				new CustomEvent('desktop-open-shell-settings', {
					detail: { tab: 'shell' },
				})
			);
		});

		const shellTab = page.getByRole('tab', {
			name: /Shell behavior|Поведение оболочки/,
		});
		await expect(shellTab).toBeVisible({ timeout: 45_000 });
		if ((await shellTab.getAttribute('aria-selected')) !== 'true') {
			await shellTab.click();
		}

		const widgetsLayoutField = page.getByTestId(
			'desktop-settings-storage-map-field-shell_state-widgets_layout'
		);
		await expect(widgetsLayoutField).toBeVisible({ timeout: 45_000 });
		await widgetsLayoutField.click();

		const showPanelCheckbox = page.getByRole('checkbox', {
			name: /Show panel on desktop|Показывать панель на столе/,
		});
		await expect(showPanelCheckbox).toBeVisible({ timeout: 20_000 });
		if (!(await showPanelCheckbox.isChecked())) {
			await showPanelCheckbox.check();
		}

		await expect(
			page.getByRole('heading', { name: /Widget panel|Панель виджетов/ })
		).toBeVisible();

		const closeBtn = page.getByRole('button', {
			name: /^(Close|Закрыть)$/,
		});
		await closeBtn.click();
		await expect(closeBtn).toBeHidden({ timeout: 20_000 });

		const widgetsPanel = page.getByRole('complementary', {
			name: /Desktop widgets panel|Панель виджетов/,
		});
		await expect(widgetsPanel).toBeVisible({ timeout: 20_000 });

		const favoritesSlot = page.getByRole('region', {
			name: /^Favorites$|^Избранное$/,
		});
		await expect(favoritesSlot).toBeVisible({ timeout: 20_000 });
		await expect(
			favoritesSlot.getByRole('button', { name: /^(Add|Добавить)$/ })
		).toBeVisible();
	});
});
