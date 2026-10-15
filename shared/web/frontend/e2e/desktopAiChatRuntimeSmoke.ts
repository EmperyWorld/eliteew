/**
 * Open Desktop AI Chat window helper for E2E.
 */
import type { Page } from 'playwright/test';

import { DESKTOP_AI_CHAT_ROOT_ID } from '../src/features/desktop-ai-chat/DesktopAiChatGuideModal';

export async function openDesktopAiChatApp(page: Page): Promise<void> {
	await page.evaluate(() => {
		window.dispatchEvent(
			new CustomEvent('desktop-open-app', {
				detail: { appComponent: 'DesktopAiChatApp' },
			})
		);
	});
	await page.locator(`#${DESKTOP_AI_CHAT_ROOT_ID}`).waitFor({
		state: 'visible',
		timeout: 45_000,
	});
}
