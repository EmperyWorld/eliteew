/**
 * Playwright global setup: seed Content Manager E2E fixtures via admin API.
 */
import type { FullConfig } from 'playwright/test';

const FIXTURE_NAMES = [
	'doc editor e2e',
	'doc one',
	'doc two',
	'restricted or deleted doc',
] as const;

async function globalSetup(_config: FullConfig): Promise<void> {
	if (process.env.CM_DOC_E2E_RUN !== '1') {
		return;
	}
	const baseUrl = process.env.MC_E2E_BASE_URL?.replace(/\/$/, '');
	if (!baseUrl?.startsWith('http')) {
		console.warn('[cm-e2e-setup] MC_E2E_BASE_URL missing; skip seed');
		return;
	}
	const bearer = process.env.CONTENT_E2E_ADMIN_BEARER?.trim();
	if (!bearer) {
		console.warn(
			'[cm-e2e-setup] CONTENT_E2E_ADMIN_BEARER missing; skip automated seed'
		);
		return;
	}
	try {
		const res = await fetch(
			`${baseUrl}/api/v1/desktop/admin/content-e2e/seed`,
			{
				method: 'POST',
				headers: {
					Authorization: `Bearer ${bearer}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ fixture_names: [...FIXTURE_NAMES] }),
			}
		);
		if (!res.ok) {
			const text = await res.text();
			console.warn(
				`[cm-e2e-setup] seed failed ${res.status}: ${text.slice(0, 200)}`
			);
			return;
		}
		console.log('[cm-e2e-setup] fixtures seeded');
	} catch (err) {
		console.warn('[cm-e2e-setup] seed error', err);
	}
}

export default globalSetup;
