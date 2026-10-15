/**
 * UGS Hub wave 4 E2E (optional authenticated contour).
 *
 * DESKTOP_SHELL_E2E_RUN=1 MC_E2E_BASE_URL=https://app.eliteew.ru \
 *   pnpm exec playwright test e2e/ugs-hub-wave4.spec.ts
 *
 * Admin queue-ops: see e2e/ugs-hub-admin-queue-ops.spec.ts (UGS admin storage state).
 * Paginated sentinel test uses route mocks (still needs authenticated session to mount Hub).
 */
import { expect, test } from 'playwright/test';

import { describeDesktop } from './desktopShellE2eGate';
import { installUgsHubApiMocks } from './ugsHubApiMocks';

describeDesktop('UGS Hub wave 4', () => {
	test('tasks load sentinel appears with mocked paginated tasks', async ({
		page,
	}) => {
		await installUgsHubApiMocks(page, { totalTasks: 150 });
		await page.goto('/#/ugs-hub');
		await expect(page.getByTestId('ugs-hub-root')).toBeVisible({
			timeout: 60_000,
		});

		await expect(page.getByTestId('ugs-hub-tasks-load-sentinel')).toBeAttached({
			timeout: 30_000,
		});
	});

	test('scroll sentinel triggers second tasks page fetch (offset=100)', async ({
		page,
	}) => {
		const tasksRequestTracker = { urls: [] as string[] };
		await installUgsHubApiMocks(page, {
			totalTasks: 150,
			tasksRequestTracker,
		});
		await page.goto('/#/ugs-hub');
		await expect(page.getByTestId('ugs-hub-root')).toBeVisible({
			timeout: 60_000,
		});

		const sentinel = page.getByTestId('ugs-hub-tasks-load-sentinel');
		await expect(sentinel).toBeAttached({ timeout: 30_000 });
		await sentinel.scrollIntoViewIfNeeded();

		await expect
			.poll(
				() =>
					tasksRequestTracker.urls.some((url) => {
						const parsed = new URL(url);
						return parsed.searchParams.get('offset') === '100';
					}),
				{ timeout: 20_000 }
			)
			.toBe(true);
	});
});
