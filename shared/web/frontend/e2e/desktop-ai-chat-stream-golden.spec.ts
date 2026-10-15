import { expect, test } from 'playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describeDesktopAiChat } from './desktopAiChatE2eGate';
import { openDesktopAiChatApp } from './desktopAiChatRuntimeSmoke';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_SSE = path.join(
	__dirname,
	'../../shared/api/tests/fixtures/desktop_chat_done_context_sse_golden.sse'
);

describeDesktopAiChat('Desktop AI Chat stream golden path', () => {
	test.beforeEach(async ({ page }) => {
		if (process.env.AI_CHAT_E2E_MOCK_STREAM === '1') {
			const body = fs.readFileSync(FIXTURE_SSE, 'utf8');
			await page.route(
				'**/api/v1/desktop/ai-chat/chats/*/stream',
				async (route) => {
					await route.fulfill({
						status: 200,
						contentType: 'text/event-stream',
						body,
					});
				}
			);
		}
	});

	test('mock stream delivers assistant content', async ({ page }) => {
		test.skip(process.env.AI_CHAT_E2E_MOCK_STREAM !== '1', 'mock mode only');
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto('/');
		await expect(page.locator('#desktop-main')).toBeVisible({
			timeout: 60_000,
		});
		await openDesktopAiChatApp(page);
		const composer = page.getByTestId('desktop-ai-chat-composer');
		await expect(composer).toBeVisible({ timeout: 20_000 });
		await composer.locator('textarea').fill('probe question for mock stream');
		await composer.getByRole('button', { name: /send|отправ/i }).click();
		await expect(page.getByTestId('desktop-ai-chat-messages')).toContainText(
			/Привет|probe/i,
			{
				timeout: 30_000,
			}
		);
	});
});
