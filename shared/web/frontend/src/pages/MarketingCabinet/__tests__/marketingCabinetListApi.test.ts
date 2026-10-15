/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract checks for marketing-cabinet list API helpers (limit/offset query params).
 *
 * Invariants:
 * - listFunnels forwards limit and offset when provided.
 *
 * Related:
 * - marketingCabinetApi/cabinetEntitiesApiSlice.ts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
	apiGet: vi.fn().mockResolvedValue({
		data: { items: [], total: 0 },
	}),
}));

vi.mock('../../../services/api/client', () => ({
	api: {
		get: hoisted.apiGet,
		post: vi.fn(),
		put: vi.fn(),
		patch: vi.fn(),
		delete: vi.fn(),
	},
	apiClient: {},
	unwrapApiData: (x: unknown) => x,
}));

import { marketingCabinetApi } from '../marketingCabinetApi';

describe('marketingCabinetApi list limits', () => {
	beforeEach(() => {
		hoisted.apiGet.mockClear();
	});

	it('listFunnels passes limit and offset in query params', async () => {
		await marketingCabinetApi.listFunnels('project-uuid', 200, 0);
		expect(hoisted.apiGet).toHaveBeenCalledWith(
			'/marketing-cabinet/funnels',
			expect.objectContaining({
				params: expect.objectContaining({
					project_id: 'project-uuid',
					limit: 200,
					offset: 0,
				}),
			})
		);
	});

	it('listValuePropositions passes limit and offset in query params', async () => {
		await marketingCabinetApi.listValuePropositions('project-uuid', 200, 0);
		expect(hoisted.apiGet).toHaveBeenCalledWith(
			'/marketing-cabinet/value-propositions',
			expect.objectContaining({
				params: expect.objectContaining({
					project_id: 'project-uuid',
					limit: 200,
					offset: 0,
				}),
			})
		);
	});

	it('listJobStories passes limit and offset in query params', async () => {
		await marketingCabinetApi.listJobStories('project-uuid', undefined, 200, 0);
		expect(hoisted.apiGet).toHaveBeenCalledWith(
			'/marketing-cabinet/jtbd/job-stories',
			expect.objectContaining({
				params: expect.objectContaining({
					project_id: 'project-uuid',
					limit: 200,
					offset: 0,
				}),
			})
		);
	});

	it('listCompanies passes limit in query params', async () => {
		await marketingCabinetApi.listCompanies({ limit: 200, skip: 0 });
		expect(hoisted.apiGet).toHaveBeenCalledWith(
			'/companies',
			expect.objectContaining({
				params: expect.objectContaining({ limit: 200, skip: 0 }),
			})
		);
	});

	it('listProjectMembers passes limit and offset in query params', async () => {
		hoisted.apiGet.mockResolvedValueOnce({
			items: [
				{
					id: 'member-1',
					project_id: 'project-uuid',
					user_id: 'user-1',
					role: 'member',
					permissions: [],
					status: 'active',
					created_at: '2026-01-01T00:00:00Z',
					updated_at: '2026-01-01T00:00:00Z',
				},
			],
			total: 1,
		});
		const result = await marketingCabinetApi.listProjectMembers(
			'project-uuid',
			200,
			0
		);
		expect(result.total).toBe(1);
		expect(hoisted.apiGet).toHaveBeenCalledWith(
			'/projects/project-uuid/members',
			expect.objectContaining({
				params: expect.objectContaining({ limit: 200, offset: 0 }),
			})
		);
	});

	it('listSwot passes limit and offset in query params', async () => {
		await marketingCabinetApi.listSwot('project-uuid', 200, 0);
		expect(hoisted.apiGet).toHaveBeenCalledWith(
			'/marketing-cabinet/analysis/swot',
			expect.objectContaining({
				params: expect.objectContaining({
					project_id: 'project-uuid',
					limit: 200,
					offset: 0,
				}),
			})
		);
	});
});
