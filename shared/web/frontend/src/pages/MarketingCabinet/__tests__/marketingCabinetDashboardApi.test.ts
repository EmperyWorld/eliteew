/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * Vitest HTTP-boundary coverage for Marketing Cabinet dashboard API client methods.
 *
 * Invariants:
 * - Tests assert URL/query payloads without requiring a live backend.
 * - New dashboard contracts should add a focused boundary assertion here.
 *
 * Related:
 * - ../marketingCabinetApi/dashboardApiSlice.ts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
	apiGet: vi.fn().mockResolvedValue({
		data: {
			success: true,
			data: [],
			total: 0,
			page: 1,
			per_page: 20,
		},
	}),
	apiPost: vi.fn().mockResolvedValue({ data: {} }),
	apiDelete: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/api/client', () => ({
	api: {
		get: hoisted.apiGet,
		post: hoisted.apiPost,
		put: vi.fn(),
		patch: vi.fn(),
		delete: hoisted.apiDelete,
	},
	apiFetchWithAuth: vi.fn(),
	buildQueryString: (params: Record<string, unknown>) => {
		const qs = new URLSearchParams();
		for (const [k, v] of Object.entries(params)) {
			if (v !== undefined && v !== null) qs.set(k, String(v));
		}
		const s = qs.toString();
		return s ? `?${s}` : '';
	},
}));

import { marketingCabinetApi } from '../marketingCabinetApi';

const minimalDashboardMock = {
	project: { id: 'proj-mock' },
	job_stories: [],
	value_propositions: [],
	competitors: [],
	researches: [],
	content: [],
	counts: {
		jtbd: 0,
		value_propositions: 0,
		swot: 0,
		competitors: 0,
		researches: 0,
		content: 0,
	},
	readiness_score: 0,
};

describe('marketingCabinetApi dashboard (HTTP boundary)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		hoisted.apiGet.mockResolvedValue({
			data: {
				success: true,
				data: [],
				total: 0,
				page: 1,
				per_page: 20,
			},
		});
	});

	it('listDashboardLayouts calls GET /marketing-cabinet/projects/:id/dashboard-layouts with params', async () => {
		await marketingCabinetApi.listDashboardLayouts('proj-a', {
			page: 2,
			per_page: 10,
			name: 'mine',
		});
		expect(hoisted.apiGet).toHaveBeenCalledOnce();
		const [url, opts] = hoisted.apiGet.mock.calls[0] as [
			string,
			{ params?: Record<string, unknown> },
		];
		expect(url).toBe('/marketing-cabinet/projects/proj-a/dashboard-layouts');
		expect(opts?.params).toEqual({ page: 2, per_page: 10, name: 'mine' });
	});

	it('getProjectDashboard calls GET /marketing-cabinet/projects/:id/dashboard', async () => {
		hoisted.apiGet.mockResolvedValueOnce(minimalDashboardMock);
		await marketingCabinetApi.getProjectDashboard('proj-b');
		expect(hoisted.apiGet).toHaveBeenCalledWith(
			'/marketing-cabinet/projects/proj-b/dashboard',
			expect.objectContaining({ timeout: expect.any(Number) })
		);
	});

	it('getProjectDashboard passes include=series when includeSeries', async () => {
		hoisted.apiGet.mockResolvedValueOnce(minimalDashboardMock);
		await marketingCabinetApi.getProjectDashboard('proj-c', {
			includeSeries: true,
			windowDays: 14,
		});
		expect(hoisted.apiGet).toHaveBeenCalledWith(
			'/marketing-cabinet/projects/proj-c/dashboard',
			expect.objectContaining({
				params: { include: 'series', window_days: '14' },
			})
		);
	});

	it('getProjectDashboard passes layout_id when layoutId set', async () => {
		hoisted.apiGet.mockResolvedValueOnce(minimalDashboardMock);
		await marketingCabinetApi.getProjectDashboard('proj-d', {
			layoutId: '11111111-1111-1111-1111-111111111111',
		});
		expect(hoisted.apiGet).toHaveBeenCalledWith(
			'/marketing-cabinet/projects/proj-d/dashboard',
			expect.objectContaining({
				params: { layout_id: '11111111-1111-1111-1111-111111111111' },
			})
		);
	});

	it('getProjectDashboard passes compact_lists when compactLists', async () => {
		hoisted.apiGet.mockResolvedValueOnce(minimalDashboardMock);
		await marketingCabinetApi.getProjectDashboard('proj-e', {
			compactLists: true,
		});
		expect(hoisted.apiGet).toHaveBeenCalledWith(
			'/marketing-cabinet/projects/proj-e/dashboard',
			expect.objectContaining({
				params: { compact_lists: 'true' },
			})
		);
	});

	it('getProjectPerformanceDashboard passes flexible filters without page reload', async () => {
		hoisted.apiGet.mockResolvedValueOnce({
			project_id: 'proj-f',
			generated_at: '2026-05-28T00:00:00Z',
			filters: {
				date_from: '2026-05-01',
				date_to: '2026-05-28',
				campaign_ids: ['11111111-1111-4111-8111-111111111111'],
				sources: ['paid'],
				geos: ['EU'],
			},
			totals: {
				spend: 100,
				revenue: 250,
				gross_profit: 150,
				leads: 10,
				qualified_leads: 5,
				conversions: 2,
				customers: 1,
			},
			campaigns: [],
			series: [],
			cohorts: [],
			diagnostics: [],
		});
		await marketingCabinetApi.getProjectPerformanceDashboard('proj-f', {
			dateFrom: '2026-05-01',
			dateTo: '2026-05-28',
			campaignIds: ['11111111-1111-4111-8111-111111111111'],
			sources: ['paid'],
			geos: ['EU'],
		});
		expect(hoisted.apiGet).toHaveBeenCalledWith(
			'/marketing-cabinet/projects/proj-f/performance-dashboard',
			expect.objectContaining({
				params: {
					date_from: '2026-05-01',
					date_to: '2026-05-28',
					campaign_ids: '11111111-1111-4111-8111-111111111111',
					sources: 'paid',
					geos: 'EU',
				},
			})
		);
	});

	it('listDashboardLayoutTemplates calls GET /marketing-cabinet/dashboard-layout-templates', async () => {
		await marketingCabinetApi.listDashboardLayoutTemplates({
			page: 2,
			per_page: 25,
		});
		expect(hoisted.apiGet).toHaveBeenCalledWith(
			'/marketing-cabinet/dashboard-layout-templates',
			expect.objectContaining({ params: { page: 2, per_page: 25 } })
		);
	});

	it('saveDashboardLayoutAsTemplate posts to from-project/:id', async () => {
		await marketingCabinetApi.saveDashboardLayoutAsTemplate('proj-x', {
			name: 'T1',
			description: 'd',
		});
		expect(hoisted.apiPost).toHaveBeenCalledWith(
			'/marketing-cabinet/dashboard-layout-templates/from-project/proj-x',
			{ name: 'T1', description: 'd' },
			expect.objectContaining({ timeout: expect.any(Number) })
		);
	});

	it('applyDashboardLayoutTemplate posts from-template', async () => {
		await marketingCabinetApi.applyDashboardLayoutTemplate('proj-y', {
			template_layout_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
		});
		expect(hoisted.apiPost).toHaveBeenCalledWith(
			'/marketing-cabinet/projects/proj-y/dashboard-layouts/from-template',
			{ template_layout_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
			expect.objectContaining({ timeout: expect.any(Number) })
		);
	});

	it('deleteDashboardLayoutTemplate deletes template id', async () => {
		await marketingCabinetApi.deleteDashboardLayoutTemplate(
			'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
		);
		expect(hoisted.apiDelete).toHaveBeenCalledWith(
			'/marketing-cabinet/dashboard-layout-templates/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
			expect.objectContaining({ timeout: expect.any(Number) })
		);
	});
});
