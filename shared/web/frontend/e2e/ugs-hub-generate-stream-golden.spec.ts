/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Narrow Hub happy-path: mock SSE `/generate/stream` → toast + task cache seed.
 *
 * Run (auth contour + mock stream):
 *   DESKTOP_SHELL_E2E_RUN=1 UGS_HUB_E2E_MOCK_STREAM=1 MC_E2E_BASE_URL=https://app.eliteew.ru \
 *     pnpm exec playwright test e2e/ugs-hub-generate-stream-golden.spec.ts
 *
 * Related:
 * - e2e/desktop-ai-chat-stream-golden.spec.ts
 * - services/api/ugs/runUgsGenerationStream.ts
 */

import { expect, test } from 'playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describeDesktop, nodeEnv } from './desktopShellE2eGate';
import { installUgsHubApiMocks } from './ugsHubApiMocks';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_SSE = path.join(
	__dirname,
	'fixtures/ugs-generate-stream-golden.sse'
);

const MOCK_TYPE = {
	type_key: 'text_chat_response',
	display_name: 'E2E Text chat',
	description: 'Mock type for Hub SSE golden path',
	category: 'text',
	estimated_time: 5,
	cost_credits: 1,
	is_active: true,
};

describeDesktop('UGS Hub generate stream golden path', () => {
	test.beforeEach(async ({ page }) => {
		if (nodeEnv('UGS_HUB_E2E_MOCK_STREAM') !== '1') {
			return;
		}
		const body = fs.readFileSync(FIXTURE_SSE, 'utf8');
		await installUgsHubApiMocks(page, {
			totalTasks: 0,
			types: [MOCK_TYPE],
		});
		await page.route('**/api/v1/ugs/generate/stream', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'text/event-stream',
				body,
			});
		});
	});

	test('mock stream closes modal and seeds completed task', async ({
		page,
	}) => {
		test.skip(
			nodeEnv('UGS_HUB_E2E_MOCK_STREAM') !== '1',
			'mock stream mode only'
		);

		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto('/#/ugs-hub');
		await expect(page.getByTestId('ugs-hub-root')).toBeVisible({
			timeout: 60_000,
		});

		await page
			.getByTestId('ugs-hub-quick-launch-text_chat_response')
			.click({ timeout: 20_000 });
		await expect(page.getByTestId('ugs-hub-generation-submit')).toBeVisible({
			timeout: 15_000,
		});
		await page.getByTestId('ugs-hub-generation-submit').click();

		await expect(page.getByText(/запущена/i)).toBeVisible({
			timeout: 30_000,
		});
		await expect(page.getByTestId('ugs-hub-generation-submit')).toHaveCount(0, {
			timeout: 15_000,
		});
		await expect(page.getByTestId('ugs-hub-virtual-task-list')).toContainText(
			/text_chat_response|E2E Text chat|E2E mock/i,
			{ timeout: 20_000 }
		);
	});
});
