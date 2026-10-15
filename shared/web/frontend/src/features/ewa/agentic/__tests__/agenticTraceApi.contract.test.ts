/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock agentic observability HTTP paths to ``/api/v1`` + ``/ewa/agentic/...``
 * (frontend nginx 404s bare ``/ewa/...``).
 *
 * Related:
 * - src/features/ewa/agentic/agenticTraceApi.ts
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/api/client', () => ({
	apiClient: { get: getMock },
}));

import {
	AGENTIC_SESSION_TRACE_PATH,
	AGENTIC_SESSION_TREE_PATH,
	fetchAgenticSessionTrace,
	fetchAgenticSessionTree,
} from '@/features/ewa/agentic/agenticTraceApi';

describe('agenticTraceApi path + API_OPTIONS contract', () => {
	beforeEach(() => {
		getMock.mockReset();
		getMock.mockResolvedValue({
			data: { session_id: 's1', checkpoints: [], nodes: [] },
		});
	});

	it('exports paths relative to /api/v1 baseURL', () => {
		expect(AGENTIC_SESSION_TRACE_PATH('sess/1')).toBe(
			'/ewa/agentic/sessions/sess%2F1/trace'
		);
		expect(AGENTIC_SESSION_TREE_PATH('sess/1')).toBe(
			'/ewa/agentic/sessions/sess%2F1/tree'
		);
	});

	it('fetchAgenticSessionTree passes API_OPTIONS baseURL /api/v1', async () => {
		await fetchAgenticSessionTree('sess-abc');
		expect(getMock).toHaveBeenCalledTimes(1);
		const [url, opts] = getMock.mock.calls[0] as [string, { baseURL?: string }];
		expect(url).toBe('/ewa/agentic/sessions/sess-abc/tree');
		expect(opts.baseURL).toBe('/api/v1');
	});

	it('fetchAgenticSessionTrace passes API_OPTIONS baseURL /api/v1', async () => {
		await fetchAgenticSessionTrace('sess-abc', 20);
		expect(getMock).toHaveBeenCalledTimes(1);
		const [url, opts] = getMock.mock.calls[0] as [
			string,
			{ baseURL?: string; params?: { limit: number } },
		];
		expect(url).toBe('/ewa/agentic/sessions/sess-abc/trace');
		expect(opts.baseURL).toBe('/api/v1');
		expect(opts.params?.limit).toBe(20);
	});
});
