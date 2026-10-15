/**
 * UGS Hub authenticated smoke (optional contour).
 *
 * DESKTOP_SHELL_E2E_RUN=1 MC_E2E_BASE_URL=https://app.eliteew.ru \
 *   pnpm exec playwright test e2e/ugs-hub-smoke.spec.ts
 */
import { expect, test } from 'playwright/test';

import { describeDesktop } from './desktopShellE2eGate';

describeDesktop('UGS Hub smoke', () => {
	test('legacy #ugs-hub opens desktop UGS hub root', async ({ page }) => {
		await page.goto('/#/ugs-hub');
		await expect(page).toHaveURL(/#\/desktop/, { timeout: 60_000 });
		await expect(page.getByTestId('ugs-hub-root')).toBeVisible({
			timeout: 60_000,
		});
	});
});
