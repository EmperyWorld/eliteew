/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave D opt-in Playwright journey: offline widget note → outbox → online
 * `POST /desktop/widget-sync` with Idempotency-Key → outbox cleared.
 *
 * Invariants:
 * - Gated by `DESKTOP_SHELL_E2E_RUN=1` + HTTPS `MC_E2E_BASE_URL`.
 * - Sync response is fulfilled in-route (client contract proof); does not require
 *   live Redis on the target host for this smoke.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-SHELL-E2E-CI.md
 * - src/pages/Desktop/utils/desktopWidgetOutboxQueue.ts
 */

import { expect, test, type Page } from 'playwright/test';
import { describeDesktop } from './desktopShellE2eGate';
import { readOidcSubjectFromPage } from './desktopOidcPrincipal';

const OUTBOX_KEY = 'eliteew-desktop-widget-outbox-v1';

async function openWidgetShelf(page: Page) {
	await page.evaluate(() => {
		window.dispatchEvent(
			new CustomEvent('desktop-open-app', {
				detail: { appComponent: 'DesktopWidgetShelfApp' },
			})
		);
	});
	await expect(
		page.locator('[data-widget-shelf-guide="notes-pane"]')
	).toBeVisible({
		timeout: 45_000,
	});
}

async function readOutboxOps(page: Page): Promise<unknown[]> {
	return page.evaluate((key) => {
		try {
			const raw = localStorage.getItem(key);
			if (!raw) return [];
			const parsed = JSON.parse(raw) as { ops?: unknown[] };
			return Array.isArray(parsed.ops) ? parsed.ops : [];
		} catch {
			return [];
		}
	}, OUTBOX_KEY);
}

describeDesktop('Desktop widget-sync outbox journey (Wave D)', () => {
	test('offline note create flushes via widget-sync when back online', async ({
		page,
		context,
	}) => {
		await page.goto('/');
		await expect(page.locator('#desktop-main')).toBeVisible({
			timeout: 60_000,
		});

		const subject = await readOidcSubjectFromPage(page);
		test.skip(!subject, 'needs authenticated OIDC subject in session storage');

		await context.setOffline(true);

		await openWidgetShelf(page);
		await expect(
			page.locator('[data-widget-shelf-guide="local-hint"]')
		).toBeVisible({ timeout: 45_000 });

		const addNote = page.getByRole('button', {
			name: /Add note|Добавить заметку/,
		});
		await expect(addNote).toBeVisible({ timeout: 20_000 });
		await addNote.click();

		await expect
			.poll(
				async () => {
					const ops = await readOutboxOps(page);
					return ops.length;
				},
				{ timeout: 15_000 }
			)
			.toBeGreaterThan(0);

		const pendingOps = await readOutboxOps(page);
		expect(
			pendingOps.some(
				(op) =>
					typeof op === 'object' &&
					op !== null &&
					(op as { kind?: string }).kind === 'note_create'
			)
		).toBe(true);

		let syncPosts = 0;
		let seenIdempotencyKey: string | null = null;

		await context.route('**/api/v1/desktop/widget-sync', async (route) => {
			if (route.request().method() !== 'POST') {
				await route.continue();
				return;
			}
			syncPosts += 1;
			const headers = route.request().headers();
			seenIdempotencyKey =
				headers['idempotency-key'] ?? headers['Idempotency-Key'] ?? null;
			const body = route.request().postDataJSON() as {
				ops?: Array<{ op_id?: string }>;
			};
			const results = (body.ops ?? []).map((op) => ({
				op_id: op.op_id ?? 'unknown',
				status: 'applied' as const,
				server_id: `e2e-note-${op.op_id ?? 'x'}`,
			}));
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ results }),
			});
		});

		await context.route('**/api/v1/desktop/widget-notes**', async (route) => {
			if (route.request().method() === 'GET') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify([]),
				});
				return;
			}
			await route.continue();
		});

		await context.setOffline(false);

		await expect.poll(() => syncPosts, { timeout: 30_000 }).toBeGreaterThan(0);
		expect(seenIdempotencyKey).toBeTruthy();
		expect(String(seenIdempotencyKey).length).toBeGreaterThanOrEqual(8);

		await expect
			.poll(async () => (await readOutboxOps(page)).length, {
				timeout: 15_000,
			})
			.toBe(0);
	});
});
