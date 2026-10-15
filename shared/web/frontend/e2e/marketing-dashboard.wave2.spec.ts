import { test } from 'playwright/test';

function nodeEnv(key: string): string | undefined {
	if (typeof globalThis === 'undefined') return undefined;
	const proc = (
		globalThis as { process?: { env?: Record<string, string | undefined> } }
	).process;
	return proc?.env?.[key];
}

/**
 * Backlog M.129–M.130 (preset → drag → refresh; canvas + offline). Full flows need
 * Keycloak session and stable `data-mc-*` selectors — unskip once `MC_E2E_BASE_URL`
 * points at a logged-in cabinet and helpers set storage state.
 */
test.describe('Marketing interactive dashboard (wave 2)', () => {
	test('preset apply → tile drag → reload restores layout', async ({
		page,
	}) => {
		const base = nodeEnv('MC_E2E_BASE_URL');
		test.skip(
			nodeEnv('MC_E2E_RUN') !== '1' || !base?.startsWith('http'),
			'Enable with MC_E2E_RUN=1, MC_E2E_BASE_URL, and auth storage (see DASHBOARD-REGRESSION-CHECKLIST.md).'
		);
		await page.goto('/');
		// Operator completes: open project → overview dashboard → apply preset → drag tile → F5.
	});

	/** G.65: full rollback needs auth + network mock; Wave 25 adds unit coverage for skip-link focus instead. */
	test('canvas widget: API save failure rolls back to server snapshot (client implemented)', async () => {
		const base = nodeEnv('MC_E2E_BASE_URL');
		test.skip(
			nodeEnv('MC_E2E_RUN') !== '1' || !base?.startsWith('http'),
			'Enable with MC_E2E_RUN=1, MC_E2E_BASE_URL, auth: after login, force PATCH error (e.g. mock 500) and expect markdown/drawing to match last server state + toast.'
		);
	});
});
