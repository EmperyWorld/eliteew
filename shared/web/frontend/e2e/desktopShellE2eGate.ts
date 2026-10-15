/**
 * Gate for authenticated Desktop shell Playwright suites (waves 12–16).
 */
import { test } from 'playwright/test';

export function nodeEnv(key: string): string | undefined {
	if (typeof globalThis === 'undefined') return undefined;
	const proc = (
		globalThis as { process?: { env?: Record<string, string | undefined> } }
	).process;
	return proc?.env?.[key];
}

export const desktopShellE2eEnabled =
	nodeEnv('DESKTOP_SHELL_E2E_RUN') === '1' &&
	Boolean(nodeEnv('MC_E2E_BASE_URL')?.startsWith('http'));

/** Skip entire describe when contour is off. */
export const describeDesktop = desktopShellE2eEnabled
	? test.describe
	: test.describe.skip;
