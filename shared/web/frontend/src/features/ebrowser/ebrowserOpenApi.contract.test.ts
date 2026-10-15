/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock that EBrowser FE policy types track the OpenAPI pilot schemas.
 *
 * Related:
 * - features/ebrowser/ebrowserOpenApi.ts
 * - src/generated/ebrowser-openapi.ts
 */

import { describe, expect, it } from 'vitest';
import type { components } from '@/generated/ebrowser-openapi';
import type {
	EBrowserPolicyApi,
	EBrowserPolicyPut,
	EBrowserPolicyResponse,
} from './ebrowserOpenApi';

type Schemas = components['schemas'];

describe('ebrowser OpenAPI pilot types', () => {
	it('re-exports match generated schemas (compile-time aliases)', () => {
		const response: EBrowserPolicyResponse = {
			user_id: 'u1',
			mode: 'allowlist',
			allow: [],
			deny: [],
			ttl_seconds: 300,
			fetched_at: '2026-09-10T00:00:00Z',
			expires_at: '2026-09-10T00:05:00Z',
			is_default: true,
		};
		const api: EBrowserPolicyApi = response;
		const put: EBrowserPolicyPut = { mode: 'open', allow: [], deny: [] };
		const gen: Schemas['EBrowserPolicyResponse'] = api;
		expect(gen.is_default).toBe(true);
		expect(put.mode).toBe('open');
	});
});
