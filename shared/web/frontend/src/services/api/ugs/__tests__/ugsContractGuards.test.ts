/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for UGS frontend runtime guards at flexible OpenAPI edges.
 *
 * Invariants:
 * - Malformed task rows and SSE payloads must be dropped before cache/UI merge paths.
 *
 * Related:
 * - services/api/ugs/dashboard.ts
 * - services/api/ugs/stream.ts
 */

import { describe, expect, it } from 'vitest';

import {
	normalizeUgsProvidersSummary,
	normalizeUgsTaskRows,
} from '../dashboard';
import { normalizeUgsStreamEventPayload } from '../stream';

describe('UGS contract guards', () => {
	it('keeps valid task rows and drops malformed rows', () => {
		const rows = normalizeUgsTaskRows([
			{
				id: 'req-1',
				type_key: 'text_chat',
				status: 'processing',
				created_at: '2026-05-28T00:00:00Z',
				updated_at: '2026-05-28T00:00:01Z',
				user_id: 'u1',
				priority: 5,
			},
			{ id: 'bad', type_key: 'text_chat', status: 'not-real' },
			null,
		]);

		expect(rows).toHaveLength(1);
		expect(rows[0]?.id).toBe('req-1');
	});

	it('normalizes SSE payload fields without trusting arbitrary shapes', () => {
		const payload = normalizeUgsStreamEventPayload({
			request_id: 'req-1',
			status: 'completed',
			progress: 100,
			result: { ok: true },
			metadata: ['bad'],
			data: { request_id: 'req-1' },
		});

		expect(payload).toEqual({
			request_id: 'req-1',
			status: 'completed',
			progress: 100,
			result: { ok: true },
			data: { request_id: 'req-1' },
		});
	});

	it('rejects non-object SSE payloads', () => {
		expect(normalizeUgsStreamEventPayload(null)).toBeNull();
		expect(normalizeUgsStreamEventPayload('nope')).toBeNull();
	});

	it('normalizes provider status envelopes through the generated-schema adapter boundary', () => {
		const normalized = normalizeUgsProvidersSummary({
			providers: [
				{
					provider_name: 'comfyui',
					display_label: 'ComfyUI',
					status: 'unhealthy',
					response_time: null,
					last_check: '2026-05-28T00:00:00Z',
					error: 'timeout',
				},
			],
			summary: {
				total: 2,
				healthy: 1,
				unhealthy: 1,
				average_response_time: 123,
			},
		});

		expect(normalized.total_providers).toBe(2);
		expect(normalized.healthy_providers).toBe(1);
		expect(normalized.average_response_time).toBe(123);
		expect(normalized.providers[0]?.provider_name).toBe('comfyui');
		expect(normalized.providers[0]?.error).toBe('timeout');
	});
});
