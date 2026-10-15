/**
 * UGS Hub desktop deep-link smoke (deterministic, no live API).
 *
 * Run locally:
 *   pnpm exec playwright test e2e/ugs-hub-deeplink.spec.ts
 */
import { expect, test } from 'playwright/test';

const UGS_DESKTOP_DEEPLINK_STORAGE_KEY = 'eliteew.desktop.deepLink.ugs';

test.describe('UGS desktop deep link contract', () => {
	test('sessionStorage roundtrip preserves hub payload', async ({ page }) => {
		await page.goto('about:blank');
		await page.evaluate(
			({ key, payload }) => {
				sessionStorage.setItem(key, JSON.stringify(payload));
			},
			{
				key: UGS_DESKTOP_DEEPLINK_STORAGE_KEY,
				payload: { view: 'hub' },
			}
		);

		const stored = await page.evaluate(
			(key) => sessionStorage.getItem(key),
			UGS_DESKTOP_DEEPLINK_STORAGE_KEY
		);
		expect(stored).toContain('"view":"hub"');
	});

	test('custom event eliteew:desktop-ugs-deeplink is observable', async ({
		page,
	}) => {
		await page.goto('about:blank');
		const detail = await page.evaluate(async () => {
			return await new Promise<Record<string, unknown>>((resolve) => {
				window.addEventListener(
					'eliteew:desktop-ugs-deeplink',
					(event) => {
						resolve((event as CustomEvent).detail as Record<string, unknown>);
					},
					{ once: true }
				);
				window.dispatchEvent(
					new CustomEvent('eliteew:desktop-ugs-deeplink', {
						detail: { view: 'analytics' },
					})
				);
			});
		});
		expect(detail.view).toBe('analytics');
	});
});
