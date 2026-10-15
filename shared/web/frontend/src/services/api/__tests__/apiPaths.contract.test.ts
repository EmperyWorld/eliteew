import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_PATHS } from '../config';

const DESKTOP_PILOT = join(
	__dirname,
	'../../../../openapi/pilot/desktop.openapi.json'
);

/**
 * Contract: central {@link API_PATHS} vs backend domain mounts under `/api/v1`.
 */
describe('API_PATHS contract', () => {
	it('CONTENT matches unified_content router (/content under v1)', () => {
		expect(API_PATHS.CONTENT).toBe('/api/v1/content');
	});

	it('DOC_EDITOR matches creative domain mount', () => {
		expect(API_PATHS.DOC_EDITOR).toBe('/api/v1/doc-editor');
	});

	it('DESKTOP is v1 root for relative /desktop/* clients', () => {
		expect(API_PATHS.DESKTOP).toBe('/api/v1');
		expect(`${API_PATHS.DESKTOP}/desktop/config`).toBe(
			'/api/v1/desktop/config'
		);
	});

	it('SITE_STUDIO_PROXY stays under desktop router tree', () => {
		expect(API_PATHS.SITE_STUDIO_PROXY).toBe(
			'/api/v1/desktop/site-studio/proxy'
		);
	});

	it('DASHBOARD is a legacy placeholder (no /api/v1/dashboard in current OpenAPI)', () => {
		expect(API_PATHS.DASHBOARD).toBe('/api/v1/dashboard');
	});

	it('desktop OpenAPI pilot documents landmark routes under API_PATHS.DESKTOP', () => {
		const spec = JSON.parse(readFileSync(DESKTOP_PILOT, 'utf8')) as {
			paths: Record<string, unknown>;
		};
		const base = API_PATHS.DESKTOP;
		for (const p of [
			`${base}/desktop/config`,
			`${base}/desktop/shell-state`,
			`${base}/desktop/installed`,
			`${base}/desktop/items`,
			`${base}/desktop/store`,
			`${base}/desktop/ew-wallet`,
		]) {
			expect(
				spec.paths[p],
				`expected ${p} in openapi/pilot/desktop.openapi.json`
			).toBeDefined();
		}
	});
});
