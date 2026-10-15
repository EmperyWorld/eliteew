/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Locks Wave 26 HTTP client atomization: thin facade + modules under 800 LOC.
 *
 * Invariants:
 * - Public import path remains `./client` (and barrel `services/api`).
 * - Facade re-exports createAPIClient, apiFetchWithAuth, APIError; no interceptor body.
 * - apiClientCore / createAPIClient / apiFetchWithAuth each stay under 800 LOC.
 *
 * Related:
 * - ../client.ts, ../apiClientCore.ts, ../createAPIClient.ts, ../apiFetchWithAuth.ts
 * - documentation/api/FRONTEND-BACKEND-HTTP.md
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MODULES = [
	'client.ts',
	'apiClientCore.ts',
	'createAPIClient.ts',
	'apiFetchWithAuth.ts',
] as const;

describe('Wave 26 API client atomization contract', () => {
	it('keeps each HTTP client module under 800 LOC', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		for (const name of MODULES) {
			const source = readFileSync(join(dir, '..', name), 'utf8');
			const lineCount = source.split('\n').length;
			expect(lineCount, `${name} LOC`).toBeLessThan(800);
		}
	});

	it('keeps client.ts as a thin public facade with stable re-exports', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const facade = readFileSync(join(dir, '../client.ts'), 'utf8');

		expect(facade).toContain("from './apiClientCore'");
		expect(facade).toContain("from './createAPIClient'");
		expect(facade).toContain(
			"export { createAPIClient } from './createAPIClient'"
		);
		expect(facade).toContain(
			"export { apiFetchWithAuth } from './apiFetchWithAuth'"
		);
		expect(facade).toContain('APIError');
		expect(facade).toContain('export const apiClient = createAPIClient()');
		expect(facade).not.toContain('interceptors.request.use');
		expect(facade).not.toContain('interceptors.response.use');
		expect(facade).not.toContain('async function apiFetchWithAuthOnce');
	});
});
