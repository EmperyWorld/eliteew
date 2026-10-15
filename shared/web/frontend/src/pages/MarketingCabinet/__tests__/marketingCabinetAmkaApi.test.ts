/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for Marketing Cabinet AMKA client helpers (list/detail/core-alignment/export).
 *
 * Invariants:
 * - Mocks axios `api` and `apiClient`; no real HTTP.
 * - AMKA approve/resume payload tests include section, step, and operation skip arrays.
 *
 * Related:
 * - src/pages/MarketingCabinet/marketingCabinetApi/cabinetEntitiesApiSlice.ts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
	apiGet: vi.fn(),
	apiClientGet: vi.fn(),
	apiPost: vi.fn(),
	apiPut: vi.fn(),
	apiDelete: vi.fn(),
}));

vi.mock('../../../services/api/client', () => ({
	api: {
		get: hoisted.apiGet,
		post: hoisted.apiPost,
		put: hoisted.apiPut,
		patch: vi.fn(),
		delete: hoisted.apiDelete,
	},
	apiClient: {
		get: hoisted.apiClientGet,
	},
	apiFetchWithAuth: vi.fn(),
	buildQueryString: (params: Record<string, unknown>) => {
		const qs = new URLSearchParams();
		for (const [key, value] of Object.entries(params)) {
			if (value !== undefined && value !== null) qs.set(key, String(value));
		}
		const s = qs.toString();
		return s ? `?${s}` : '';
	},
}));

import {
	AMKA_OPERATOR_CONFIG_V1_DEFAULT,
	marketingCabinetApi,
} from '../marketingCabinetApi';

describe('marketingCabinetApi AMKA endpoints', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		hoisted.apiGet.mockResolvedValue({ data: { items: [], total: 0 } });
		hoisted.apiClientGet.mockResolvedValue({
			status: 200,
			data: {
				status: 'awaiting_approval',
				pulse: {},
				policy: {},
				projection: {},
				observations: {},
				task_preview: [],
				task_count: 0,
			},
			headers: {},
		});
		hoisted.apiPost.mockResolvedValue({
			data: { run: { id: 'run-1', status: 'planning' }, poll_after_ms: 2000 },
		});
	});

	it('listAmkaRuns calls GET /marketing-cabinet/amka/project/:id/runs', async () => {
		await marketingCabinetApi.listAmkaRuns('project-1', 12);
		expect(hoisted.apiGet).toHaveBeenCalledWith(
			'/marketing-cabinet/amka/project/project-1/runs',
			expect.objectContaining({
				params: { limit: 12 },
			})
		);
	});

	it('getAmkaRunDetail calls GET /marketing-cabinet/amka/runs/:id', async () => {
		await marketingCabinetApi.getAmkaRunDetail('run-2');
		expect(hoisted.apiGet).toHaveBeenCalledWith(
			'/marketing-cabinet/amka/runs/run-2',
			expect.any(Object)
		);
	});

	it('getAmkaCoreAlignment calls apiClient GET .../core-alignment', async () => {
		await marketingCabinetApi.getAmkaCoreAlignment('run-9');
		expect(hoisted.apiClientGet).toHaveBeenCalledWith(
			'/marketing-cabinet/amka/runs/run-9/core-alignment',
			expect.objectContaining({
				validateStatus: expect.any(Function),
			})
		);
	});

	it('getAmkaCoreAlignment forwards If-None-Match when provided', async () => {
		hoisted.apiClientGet.mockResolvedValueOnce({
			status: 304,
			data: undefined,
			headers: { etag: 'W/"x"' },
		});
		const out = await marketingCabinetApi.getAmkaCoreAlignment('run-9', {
			ifNoneMatch: 'W/"x"',
		});
		expect(out).toBeNull();
		expect(hoisted.apiClientGet).toHaveBeenCalledWith(
			'/marketing-cabinet/amka/runs/run-9/core-alignment',
			expect.objectContaining({
				headers: { 'If-None-Match': 'W/"x"' },
			})
		);
	});

	it('exportAmkaRunMarkdown can request include_core_alignment', async () => {
		await marketingCabinetApi.exportAmkaRunMarkdown('run-x', {
			includeCoreAlignment: true,
		});
		expect(hoisted.apiGet).toHaveBeenCalledWith(
			'/marketing-cabinet/amka/runs/run-x/export.md',
			expect.objectContaining({
				params: { include_core_alignment: true },
			})
		);
	});

	it('createAmkaRun posts payload with default all_visible scope', async () => {
		await marketingCabinetApi.createAmkaRun({
			project_id: 'project-1',
			company_id: 'company-1',
			user_instruction: 'focus evidence',
		});
		expect(hoisted.apiPost).toHaveBeenCalledWith(
			'/marketing-cabinet/amka/runs',
			{
				project_id: 'project-1',
				company_id: 'company-1',
				user_instruction: 'focus evidence',
				scope_key: 'all_visible',
			},
			expect.any(Object)
		);
	});

	it('createAmkaRun forwards section_keys and IMC options', async () => {
		await marketingCabinetApi.createAmkaRun({
			project_id: 'project-1',
			company_id: 'company-1',
			section_keys: ['imc', 'evidence'],
			imc_type_key: 'imc_rag_jtbd',
			imc_focus: 'global',
			imc_max_wait_seconds: 200,
		});
		expect(hoisted.apiPost).toHaveBeenCalledWith(
			'/marketing-cabinet/amka/runs',
			{
				project_id: 'project-1',
				company_id: 'company-1',
				section_keys: ['imc', 'evidence'],
				imc_type_key: 'imc_rag_jtbd',
				imc_focus: 'global',
				imc_max_wait_seconds: 200,
				scope_key: 'all_visible',
			},
			expect.any(Object)
		);
	});

	it('createAmkaRun forwards run_mode and auto_cycle_count', async () => {
		await marketingCabinetApi.createAmkaRun({
			project_id: 'project-1',
			company_id: 'company-1',
			run_mode: 'auto',
			auto_cycle_count: 4,
		});
		expect(hoisted.apiPost).toHaveBeenCalledWith(
			'/marketing-cabinet/amka/runs',
			{
				project_id: 'project-1',
				company_id: 'company-1',
				run_mode: 'auto',
				auto_cycle_count: 4,
				scope_key: 'all_visible',
			},
			expect.any(Object)
		);
	});

	it('approve/resume/cancel call dedicated control endpoints', async () => {
		await marketingCabinetApi.approveAmkaRun('run-3');
		await marketingCabinetApi.approveAmkaRun('run-4', {
			skip_section_keys: ['alerts'],
			skip_step_ids: ['step-1'],
		});
		await marketingCabinetApi.resumeAmkaRun('run-3');
		await marketingCabinetApi.cancelAmkaRun('run-3');

		expect(hoisted.apiPost).toHaveBeenNthCalledWith(
			1,
			'/marketing-cabinet/amka/runs/run-3/approve',
			{ skip_section_keys: [], skip_step_ids: [], skip_operation_keys: [] },
			expect.any(Object)
		);
		expect(hoisted.apiPost).toHaveBeenNthCalledWith(
			2,
			'/marketing-cabinet/amka/runs/run-4/approve',
			{
				skip_section_keys: ['alerts'],
				skip_step_ids: ['step-1'],
				skip_operation_keys: [],
			},
			expect.any(Object)
		);
		expect(hoisted.apiPost).toHaveBeenNthCalledWith(
			3,
			'/marketing-cabinet/amka/runs/run-3/resume',
			{ skip_section_keys: [], skip_step_ids: [], skip_operation_keys: [] },
			expect.any(Object)
		);
		expect(hoisted.apiPost).toHaveBeenNthCalledWith(
			4,
			'/marketing-cabinet/amka/runs/run-3/cancel',
			{},
			expect.any(Object)
		);
	});

	it('listAmkaPresetTemplates calls GET /marketing-cabinet/amka/preset-templates', async () => {
		await marketingCabinetApi.listAmkaPresetTemplates();
		expect(hoisted.apiGet).toHaveBeenCalledWith(
			'/marketing-cabinet/amka/preset-templates',
			expect.any(Object)
		);
	});

	it('getAmkaOperatorConfig calls GET /marketing-cabinet/amka/operator-config', async () => {
		await marketingCabinetApi.getAmkaOperatorConfig();
		expect(hoisted.apiGet).toHaveBeenCalledWith(
			'/marketing-cabinet/amka/operator-config',
			expect.any(Object)
		);
	});

	it('putAmkaOperatorConfig calls PUT with config body', async () => {
		const cfg = AMKA_OPERATOR_CONFIG_V1_DEFAULT;
		await marketingCabinetApi.putAmkaOperatorConfig(cfg);
		expect(hoisted.apiPut).toHaveBeenCalledWith(
			'/marketing-cabinet/amka/operator-config',
			{ config: cfg },
			expect.any(Object)
		);
	});

	it('createAmkaRun forwards preset_id when set', async () => {
		await marketingCabinetApi.createAmkaRun({
			project_id: 'project-1',
			company_id: 'company-1',
			preset_id: '550e8400-e29b-41d4-a716-446655440000',
		});
		expect(hoisted.apiPost).toHaveBeenCalledWith(
			'/marketing-cabinet/amka/runs',
			{
				project_id: 'project-1',
				company_id: 'company-1',
				preset_id: '550e8400-e29b-41d4-a716-446655440000',
				scope_key: 'all_visible',
			},
			expect.any(Object)
		);
	});

	it('listAmkaPresets calls GET with project_id', async () => {
		hoisted.apiGet.mockResolvedValueOnce({ data: { items: [], total: 0 } });
		await marketingCabinetApi.listAmkaPresets('proj-x');
		expect(hoisted.apiGet).toHaveBeenCalledWith(
			'/marketing-cabinet/amka/presets',
			expect.objectContaining({
				params: { project_id: 'proj-x' },
			})
		);
	});

	it('createAmkaPreset posts body and project_id query', async () => {
		await marketingCabinetApi.createAmkaPreset('proj-y', {
			display_name: 'Test',
			slug: 'test',
			config: { schema_version: 1, extra_plan_tasks: [] },
		});
		expect(hoisted.apiPost).toHaveBeenCalledWith(
			'/marketing-cabinet/amka/presets',
			{
				display_name: 'Test',
				slug: 'test',
				config: { schema_version: 1, extra_plan_tasks: [] },
			},
			expect.objectContaining({
				params: { project_id: 'proj-y' },
			})
		);
	});

	it('deleteAmkaPreset calls DELETE', async () => {
		await marketingCabinetApi.deleteAmkaPreset('preset-1');
		expect(hoisted.apiDelete).toHaveBeenCalledWith(
			'/marketing-cabinet/amka/presets/preset-1',
			expect.any(Object)
		);
	});
});
