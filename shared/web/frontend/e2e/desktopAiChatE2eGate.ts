/**
 * Gate for Desktop AI Chat Playwright E2E (SSE golden path).
 */
import { test } from 'playwright/test';

export function nodeEnv(key: string): string | undefined {
	if (typeof globalThis === 'undefined') return undefined;
	const proc = (
		globalThis as { process?: { env?: Record<string, string | undefined> } }
	).process;
	return proc?.env?.[key];
}

export const desktopAiChatE2eEnabled =
	nodeEnv('DESKTOP_AI_CHAT_E2E_RUN') === '1' &&
	Boolean(nodeEnv('MC_E2E_BASE_URL')?.startsWith('http'));

export const describeDesktopAiChat = desktopAiChatE2eEnabled
	? test.describe
	: test.describe.skip;
