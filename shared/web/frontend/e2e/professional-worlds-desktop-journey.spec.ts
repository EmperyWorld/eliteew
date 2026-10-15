/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Optional authenticated Desktop journey smoke for Professional Worlds sidebar IA
 * and Objects photos default path (waves 6–7).
 *
 * Invariants:
 * - Gated by DESKTOP_SHELL_E2E_RUN=1 and MC_E2E_BASE_URL (see desktopShellE2eGate.ts).
 *
 * Related:
 * - e2e/desktopShellE2eGate.ts
 * - documentation/product/PROFESSIONAL-WORLDS-SMOKE-STACK0.md
 */
import { expect, test, type Page } from 'playwright/test';

import { describeDesktop } from './desktopShellE2eGate';

async function openProfessionalWorlds(page: Page) {
	await page.goto('/');
	await expect(page.locator('#desktop-main')).toBeVisible({
		timeout: 60_000,
	});
	await page.evaluate(() => {
		window.dispatchEvent(
			new CustomEvent('desktop-open-app', {
				detail: { appComponent: 'ProfessionalWorlds' },
			})
		);
	});
	await expect(
		page.getByRole('navigation', {
			name: /Professional Worlds sections|Разделы профессиональных миров/i,
		})
	).toBeVisible({ timeout: 45_000 });
}

/**
 * Wave 6–7: sidebar realtor labels + Objects photos simple path.
 *
 * DESKTOP_SHELL_E2E_RUN=1 MC_E2E_BASE_URL=https://app.eliteew.ru \
 *   pnpm exec playwright test e2e/professional-worlds-desktop-journey.spec.ts
 */
describeDesktop('Professional Worlds desktop journey (waves 6–7)', () => {
	test('sidebar labels and Objects photos default path', async ({
		page,
	}, testInfo) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await openProfessionalWorlds(page);

		for (const pattern of [
			/^Today$|^Сегодня$/,
			/^Listings$|^Объекты$/,
			/^Clients & deals$|^Клиенты и сделки$/,
			/^My image$|^Мой образ$/,
			/^Drafts$|^Черновики$/,
		]) {
			await expect(page.getByText(pattern).first()).toBeVisible({
				timeout: 20_000,
			});
		}

		await page
			.locator('[data-pw-nav-item]')
			.filter({ hasText: /^Listings$|^Объекты$/ })
			.click();

		await expect(
			page
				.getByText(
					/Choose a listing|Saved listings|Выберите объект|Сохранённые объекты/i
				)
				.first()
		).toBeVisible({ timeout: 20_000 });

		const emptyListings = page.getByText(
			/No listings yet|Пока нет сохранённых|Пока нет объектов/i
		);
		const portfolioSummary = page.getByText(
			/\d+ listing\(s\) in your portfolio|\d+ объект/i
		);

		if (await emptyListings.isVisible().catch(() => false)) {
			testInfo.skip(true, 'account has no listings for Objects photos path');
		}

		if (await portfolioSummary.isVisible().catch(() => false)) {
			await page.locator('button.group.flex.w-full.flex-col').first().click();
		}

		await expect(
			page.getByRole('button', { name: /Upload photos|Загрузить фото/i })
		).toBeVisible({ timeout: 20_000 });
		await expect(
			page.getByRole('button', {
				name: /Choose from library|Выбрать из медиатеки/i,
			})
		).toBeVisible({ timeout: 20_000 });
		await expect(
			page.getByText(/batch target album|целевой альбом/i)
		).toBeHidden();
		await expect(
			page.getByText(/Advanced: improve photos|Дополнительно: улучшить фото/i)
		).toBeHidden();
	});
});
