/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Optional Playwright coverage for multi-tab desktop shell-state conflict recovery.
 *
 * Invariants:
 * - Runs only behind `DESKTOP_SHELL_E2E_RUN=1` and an authenticated base URL.
 * - The test injects the 412 transport response; the UI action still goes through
 *   the real settings PATCH path.
 *
 * Related:
 * - desktop-shell-smoke.spec.ts
 * - src/pages/Desktop/components/DesktopSyncStatus.tsx
 */

import { expect, test, type Page } from 'playwright/test';
import { describeDesktop } from './desktopShellE2eGate';

async function openShellSettings(page: Page) {
	await page.evaluate(() => {
		window.dispatchEvent(
			new CustomEvent('desktop-open-shell-settings', {
				detail: { tab: 'shell' },
			})
		);
	});
	await expect(page.getByTestId('desktop-settings-sync-timezone')).toBeVisible({
		timeout: 45_000,
	});
}

async function selectDifferentTimezone(page: Page) {
	const timezoneSelect = page.getByTestId('desktop-settings-sync-timezone');
	const current = await timezoneSelect.inputValue();
	await timezoneSelect.selectOption(
		current === 'Asia/Vladivostok' ? 'Europe/Moscow' : 'Asia/Vladivostok'
	);
}

describeDesktop('Desktop shell-state conflict recovery', () => {
	test('multi-tab stale PATCH shows stale chip and recovers', async ({
		page,
		context,
	}) => {
		let rejectShellPatch = false;
		let rejectedPatchCount = 0;
		await context.route('**/api/v1/desktop/shell-state', async (route) => {
			if (route.request().method() !== 'PATCH' || !rejectShellPatch) {
				await route.continue();
				return;
			}
			rejectedPatchCount += 1;
			await route.fulfill({
				status: 412,
				contentType: 'application/json',
				body: JSON.stringify({
					detail: {
						code: 'desktop_shell_state_conflict',
						current_etag: '"e2e-conflict-current"',
					},
				}),
			});
		});

		const secondTab = await context.newPage();
		try {
			await page.goto('/');
			await secondTab.goto('/');
			await expect(page.locator('#desktop-main')).toBeVisible({
				timeout: 60_000,
			});
			await expect(secondTab.locator('#desktop-main')).toBeVisible({
				timeout: 60_000,
			});

			await openShellSettings(secondTab);
			await selectDifferentTimezone(secondTab);

			await openShellSettings(page);
			rejectShellPatch = true;
			await selectDifferentTimezone(page);

			const staleChip = page
				.getByText(/Состояние оболочки изменилось|Desktop shell state changed/i)
				.first();
			await expect(staleChip).toBeVisible({ timeout: 15_000 });
			expect(rejectedPatchCount).toBeGreaterThan(0);

			rejectShellPatch = false;
			const refreshButton = page
				.getByRole('button', {
					name: /Обновить|Refresh/i,
				})
				.first();
			if (await refreshButton.isVisible().catch(() => false)) {
				await refreshButton.click();
			}
			await expect(staleChip).toBeHidden({ timeout: 20_000 });
		} finally {
			await secondTab.close();
		}
	});
});
