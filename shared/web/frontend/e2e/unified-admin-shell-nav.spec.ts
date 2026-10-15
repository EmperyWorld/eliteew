/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Authenticated SPA smoke for Unified Admin deep links (`?section=`) and sidebar
 * `aria-current` swap — UGS admin storage contour (same as queue-ops).
 *
 * Save admin session once:
 *   pnpm exec playwright codegen "$MC_E2E_BASE_URL" \
 *     --save-storage=e2e/.auth/ugs-admin-storage-state.json
 *
 * Run:
 *   DESKTOP_SHELL_E2E_RUN=1 MC_E2E_BASE_URL=https://app.eliteew.ru \
 *     pnpm exec playwright test e2e/unified-admin-shell-nav.spec.ts
 *
 * Related:
 * - e2e/ugsHubE2eAuth.ts
 * - documentation/platform/UNIFIED-ADMIN-SHELL.md
 * - documentation/product/desktop/DESKTOP-SHELL-E2E-CI.md
 */
import { expect, type Page, test } from 'playwright/test';

import { desktopShellE2eEnabled } from './desktopShellE2eGate';
import {
	resolveUgsAdminStorageStatePath,
	ugsAdminE2eStorageAvailable,
} from './ugsHubE2eAuth';

const adminStorageState = resolveUgsAdminStorageStatePath() ?? '';

const describeAdminShell =
	desktopShellE2eEnabled && ugsAdminE2eStorageAvailable
		? test.describe
		: test.describe.skip;

const DEEP_LINK_SECTIONS = ['users', 'workers', 'musicForge', 'ugsV2'] as const;

async function openAdminSection(page: Page, section: string): Promise<void> {
	await page.goto(`/?section=${encodeURIComponent(section)}#admin`);
	const sidebar = page.locator('.eliteew-admin-shell__sidebar');
	await expect(sidebar).toBeVisible({ timeout: 60_000 });
	await expect(page.getByRole('alert')).toHaveCount(0);
}

async function expectNavCurrent(page: Page, section: string): Promise<void> {
	const navBtn = page.locator(`[data-nav-section="${section}"]`);
	await expect(navBtn).toBeVisible({ timeout: 30_000 });
	await expect(navBtn).toHaveAttribute('aria-current', 'page');
	await expect(
		page.locator('.eliteew-admin-shell__section-pane')
	).toBeVisible();
}

describeAdminShell('Unified Admin shell nav deep links', () => {
	test.use({ storageState: adminStorageState });

	for (const section of DEEP_LINK_SECTIONS) {
		test(`deep link ?section=${section} sets aria-current`, async ({
			page,
		}) => {
			await openAdminSection(page, section);
			await expectNavCurrent(page, section);
		});
	}

	test('sidebar click swaps users → workers aria-current', async ({ page }) => {
		await openAdminSection(page, 'users');
		await expectNavCurrent(page, 'users');

		await page.locator('[data-nav-section="workers"]').click();
		await expectNavCurrent(page, 'workers');
		await expect(
			page.locator('[data-nav-section="users"]')
		).not.toHaveAttribute('aria-current', 'page');
	});
});
