import { defineConfig, devices } from 'playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function nodeEnv(key: string): string | undefined {
	if (typeof globalThis === 'undefined') return undefined;
	const proc = (
		globalThis as { process?: { env?: Record<string, string | undefined> } }
	).process;
	return proc?.env?.[key];
}

function resolvePlaywrightStorageState(): string | undefined {
	const fromEnv = nodeEnv('PLAYWRIGHT_STORAGE_STATE');
	if (fromEnv) {
		const p = path.isAbsolute(fromEnv)
			? fromEnv
			: path.join(__dirname, fromEnv);
		if (fs.existsSync(p)) return p;
		console.warn(
			`[playwright] PLAYWRIGHT_STORAGE_STATE points to missing file: ${p}`
		);
		return undefined;
	}
	const def = path.join(__dirname, 'e2e', '.auth', 'storage-state.json');
	if (fs.existsSync(def)) return def;
	return undefined;
}

const storageState = resolvePlaywrightStorageState();

const cmDocE2eRun = nodeEnv('CM_DOC_E2E_RUN') === '1';

/**
 * Marketing / cabinet E2E (optional). Run locally when stack0 + auth are available:
 *
 *   MC_E2E_BASE_URL=https://app.eliteew.ru pnpm exec playwright test
 *
 * Desktop shell (waves 12–16, optional): additionally set DESKTOP_SHELL_E2E_RUN=1 to run
 * e2e/desktop-shell-smoke.spec.ts and e2e/desktop-shell-wave16-a11y.spec.ts.
 *
 * Keycloak: save session once with `pnpm exec playwright codegen $MC_E2E_BASE_URL --save-storage=e2e/.auth/storage-state.json`
 * or set PLAYWRIGHT_STORAGE_STATE to that file path. CI: see documentation/product/desktop/DESKTOP-SHELL-E2E-CI.md
 *
 * @see documentation/product/marketing/DASHBOARD-REGRESSION-CHECKLIST.md
 */
export default defineConfig({
	testDir: './e2e',
	fullyParallel: false,
	forbidOnly: Boolean(nodeEnv('CI')),
	retries: nodeEnv('CI') ? 2 : 0,
	...(cmDocE2eRun ? { globalSetup: './e2e/global-setup-content-e2e.ts' } : {}),
	use: {
		...devices['Desktop Chrome'],
		baseURL: nodeEnv('MC_E2E_BASE_URL') ?? 'http://127.0.0.1:5173',
		...(storageState ? { storageState } : {}),
	},
});
