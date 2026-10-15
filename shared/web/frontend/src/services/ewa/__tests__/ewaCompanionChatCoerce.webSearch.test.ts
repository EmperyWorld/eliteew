/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Coercion of companion web_search_result status payloads (ok/empty/error).
 *
 * Related:
 * - src/services/ewa/ewaCompanionChatCoerce.ts
 */

import { describe, expect, it } from 'vitest';
import { coerceCompanionWebSearchResult } from '@/services/ewa/ewaCompanionChatCoerce';

describe('coerceCompanionWebSearchResult status', () => {
	it('keeps empty status without results', () => {
		const out = coerceCompanionWebSearchResult({
			schema_version: 1,
			query: 'news',
			status: 'empty',
			result_count: 0,
			results: [],
		});
		expect(out).toEqual(
			expect.objectContaining({
				query: 'news',
				status: 'empty',
				result_count: 0,
				results: [],
			})
		);
	});

	it('keeps error_code for failed search', () => {
		const out = coerceCompanionWebSearchResult({
			query: 'x',
			status: 'error',
			error_code: 'budget_exceeded',
			results: [],
		});
		expect(out?.status).toBe('error');
		expect(out?.error_code).toBe('budget_exceeded');
	});

	it('infers ok from legacy hits without status', () => {
		const out = coerceCompanionWebSearchResult({
			query: 'rate',
			results: [{ title: 'A', url: 'https://ex.test' }],
		});
		expect(out?.status).toBe('ok');
		expect(out?.results).toHaveLength(1);
	});
});
