/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for companion admin task-run API client normalization and Zod boundary validation.
 *
 * Invariants:
 * - Task-run list/detail responses are normalized before reaching UI query cache.
 * - Malformed payloads fail fast instead of silently entering the admin table.
 *
 * Related:
 * - src/features/ewa/admin/ewaCompanionAdminApi.ts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
	get: vi.fn(),
}));

vi.mock('@/services/api/client', () => ({
	api: {
		get: hoisted.get,
	},
	APIError: class APIError extends Error {
		statusCode?: number;
		constructor(message: string, statusCode?: number) {
			super(message);
			this.statusCode = statusCode;
		}
	},
}));

import {
	fetchEwaCompanionAdminTaskRunDetail,
	fetchEwaCompanionAdminTaskRuns,
} from '../ewaCompanionAdminApi';

describe('ewaCompanionAdminApi task runs', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('normalizes list payload and preserves query filters', async () => {
		hoisted.get.mockResolvedValue({
			runs: [
				{
					id: ' run-1 ',
					principal_id: ' user-1 ',
					status: ' running ',
					intent_kind: ' open_app ',
					user_message: ' hello ',
					plan_payload: null,
					confirmation_state: null,
					result_payload: null,
					error_payload: null,
					created_at: ' 2026-05-25T10:00:00Z ',
					updated_at: null,
					completed_at: null,
				},
			],
		});

		const result = await fetchEwaCompanionAdminTaskRuns({
			limit: 25,
			status: 'running',
			principal_id: ' user-1 ',
			intent_kind: 'open_app',
		});

		expect(hoisted.get).toHaveBeenCalledWith(
			expect.stringContaining('/api/v1/ewa/admin/companion/task-runs?')
		);
		expect(result.runs[0]?.id).toBe('run-1');
		expect(result.runs[0]?.status).toBe('running');
		expect(result.runs[0]?.plan_payload).toEqual({});
		expect(result.runs[0]?.confirmation_state).toEqual({});
	});

	it('throws on malformed detail payload', async () => {
		hoisted.get.mockResolvedValue({
			status: 'running',
		});

		await expect(
			fetchEwaCompanionAdminTaskRunDetail('run-missing-id')
		).rejects.toThrow();
	});
});
