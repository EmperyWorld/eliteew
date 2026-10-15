import { expect, test } from 'playwright/test';

function nodeEnv(key: string): string | undefined {
	if (typeof globalThis === 'undefined') return undefined;
	const proc = (
		globalThis as { process?: { env?: Record<string, string | undefined> } }
	).process;
	return proc?.env?.[key];
}

/**
 * Content Manager -> DocEditor critical user flows.
 *
 * Run manually on an authenticated desktop shell:
 *   CM_DOC_E2E_RUN=1 MC_E2E_BASE_URL=https://app.eliteew.ru pnpm test:e2e -- e2e/content-manager-doceditor.spec.ts
 */
const cmDocE2eEnabled =
	nodeEnv('CM_DOC_E2E_RUN') === '1' &&
	Boolean(nodeEnv('MC_E2E_BASE_URL')?.startsWith('http'));

const describeCmDoc = cmDocE2eEnabled ? test.describe : test.describe.skip;

describeCmDoc('Content Manager DocEditor integration', () => {
	test('PKM open in DocEditor loads target document', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: /file manager|файловый менеджер/i }).click();
		await page
			.getByRole('row', { name: /doc editor e2e/i })
			.click({ button: 'right' });
		await page
			.getByRole('menuitem', { name: /open in document editor/i })
			.click();
		await expect(
			page.getByRole('heading', { name: /doc editor e2e/i })
		).toBeVisible();
	});

	test('already-open DocEditor switches to requested file', async ({
		page,
	}) => {
		await page.goto('/');
		await page.getByRole('button', { name: /file manager|файловый менеджер/i }).click();
		await page
			.getByRole('row', { name: /doc one/i })
			.click({ button: 'right' });
		await page
			.getByRole('menuitem', { name: /open in document editor/i })
			.click();
		await page.getByRole('button', { name: /file manager|файловый менеджер/i }).click();
		await page
			.getByRole('row', { name: /doc two/i })
			.click({ button: 'right' });
		await page
			.getByRole('menuitem', { name: /open in document editor/i })
			.click();
		await expect(page.getByRole('heading', { name: /doc two/i })).toBeVisible();
	});

	test('no-access or not-found shows explicit load error state', async ({
		page,
	}) => {
		await page.goto('/');
		// Operator fixture should provide an inaccessible/deleted entry.
		await page.getByRole('button', { name: /file manager|файловый менеджер/i }).click();
		await page
			.getByRole('row', { name: /restricted or deleted doc/i })
			.click({ button: 'right' });
		await page
			.getByRole('menuitem', { name: /open in document editor/i })
			.click();
		await expect(
			page.getByRole('heading', { name: /failed to load/i })
		).toBeVisible();
		await expect(
			page.getByText(/document was not found|access denied/i)
		).toBeVisible();
	});

	test('clean open from CM does not trigger beforeunload confirm on reload', async ({
		page,
	}) => {
		await page.goto('/');
		await page.getByRole('button', { name: /file manager|файловый менеджер/i }).click();
		await page
			.getByRole('row', { name: /doc editor e2e/i })
			.click({ button: 'right' });
		await page
			.getByRole('menuitem', { name: /open in document editor/i })
			.click();
		await expect(
			page.getByRole('heading', { name: /doc editor e2e/i })
		).toBeVisible();

		let beforeUnloadSeen = false;
		page.on('dialog', async (dialog) => {
			if (dialog.type() === 'beforeunload') {
				beforeUnloadSeen = true;
			}
			await dialog.dismiss();
		});

		await page.reload();
		expect(beforeUnloadSeen).toBe(false);
	});

	test('dirty editor state triggers beforeunload confirm on reload', async ({
		page,
	}) => {
		await page.goto('/');
		await page.getByRole('button', { name: /file manager|файловый менеджер/i }).click();
		await page
			.getByRole('row', { name: /doc editor e2e/i })
			.click({ button: 'right' });
		await page
			.getByRole('menuitem', { name: /open in document editor/i })
			.click();
		await expect(
			page.getByRole('heading', { name: /doc editor e2e/i })
		).toBeVisible();

		await page.locator('[contenteditable="true"]').first().click();
		await page.keyboard.type(' dirty-e2e-change');

		const dialogPromise = page.waitForEvent('dialog');
		await page.reload();
		const dialog = await dialogPromise;
		expect(dialog.type()).toBe('beforeunload');
		await dialog.dismiss();
	});
});
