/**
 * UGS Hub admin queue-ops E2E (strict admin storage contour).
 *
 * Save admin session once:
 *   pnpm exec playwright codegen "$MC_E2E_BASE_URL" \
 *     --save-storage=e2e/.auth/ugs-admin-storage-state.json
 *
 * Run:
 *   DESKTOP_SHELL_E2E_RUN=1 MC_E2E_BASE_URL=https://app.eliteew.ru \
 *     pnpm exec playwright test e2e/ugs-hub-admin-queue-ops.spec.ts
 */
import { expect, test } from 'playwright/test';

import { desktopShellE2eEnabled } from './desktopShellE2eGate';
import { installUgsHubApiMocks } from './ugsHubApiMocks';
import {
	resolveUgsAdminStorageStatePath,
	ugsAdminE2eStorageAvailable,
} from './ugsHubE2eAuth';

const adminStorageState = resolveUgsAdminStorageStatePath() ?? '';

const describeUgsAdmin =
	desktopShellE2eEnabled && ugsAdminE2eStorageAvailable
		? test.describe
		: test.describe.skip;

describeUgsAdmin('UGS Hub admin queue-ops', () => {
	test.use({ storageState: adminStorageState });

	test('overview does not mount full queue-ops panel', async ({ page }) => {
		await page.goto('/#/ugs-hub');
		await expect(page.getByTestId('ugs-hub-root')).toBeVisible({
			timeout: 60_000,
		});
		await expect(page.getByTestId('ugs-hub-queue-ops')).toHaveCount(0);
	});

	test('workflows header renders queue-ops strip for UGS admin', async ({
		page,
	}) => {
		await page.goto('/#/ugs-hub');
		await expect(page.getByTestId('ugs-hub-root')).toBeVisible({
			timeout: 60_000,
		});

		const workflowsTab = page.getByRole('button', {
			name: /воркфлоу|workflows/i,
		});
		await expect(workflowsTab).toBeVisible({ timeout: 30_000 });
		await workflowsTab.click();

		await expect(page.getByTestId('ugs-hub-queue-ops-strip')).toBeVisible({
			timeout: 30_000,
		});
	});

	test('high backlog queue-ops prefetches next tasks page without scroll', async ({
		page,
	}) => {
		const tasksRequestTracker = { urls: [] as string[] };
		await installUgsHubApiMocks(page, {
			totalTasks: 250,
			tasksRequestTracker,
		});
		await page.goto('/#/ugs-hub');
		await expect(page.getByTestId('ugs-hub-root')).toBeVisible({
			timeout: 60_000,
		});

		await expect
			.poll(
				() =>
					tasksRequestTracker.urls.some((url) => {
						const parsed = new URL(url);
						return parsed.searchParams.get('offset') === '100';
					}),
				{ timeout: 25_000 }
			)
			.toBe(true);
	});
});
