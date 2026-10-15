/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Wave 4 Marketing Cabinet OpenAPI SSOT: bridge aliases match full pilot
 * schemas; Zod object keys ⊆ lite OpenAPI schema keys (Zod is runtime guard, not SoT).
 *
 * Related:
 * - documentation/api/FRONTEND-BACKEND-HTTP.md §Adoption Wave 4
 * - marketingCabinetOpenApi.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { components as FullComponents } from '@/generated/marketing-cabinet-full-openapi';
import type { components as LiteComponents } from '@/generated/marketing-cabinet-openapi';
import type { components as OrgComponents } from '@/generated/companies-projects-openapi';

import type {
	CompanyResponse,
	DashboardLayoutResponse,
	JobStoryCreateRequest,
	MarketingJobStory,
	MarketingJobStoryOut,
	MarketingPerformanceDashboardResponse,
	MarketingProjectHealthResponse,
	MarketingSwotOut,
	MarketingValuePropositionOut,
	ProjectResponse,
} from '../marketingCabinetOpenApi';
import {
	marketingAiRunDetailRawSchema,
	marketingAiRunListRawSchema,
	marketingProjectDashboardRawSchema,
} from '../marketingCabinetApiZod';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = join(__dirname, '../../../..');

type Full = FullComponents['schemas'];
type Lite = LiteComponents['schemas'];
type Org = OrgComponents['schemas'];

function schemaKeys(schema: {
	type?: string;
	required?: readonly string[];
	properties?: Record<string, unknown>;
}): string[] {
	return Object.keys(schema.properties ?? {}).sort();
}

function zodObjectKeys(schema: { shape?: Record<string, unknown> }): string[] {
	return Object.keys(schema.shape ?? {}).sort();
}

describe('openapi SSOT Wave 4 — marketingCabinetOpenApi', () => {
	it('bridge file imports full + lite + companies-projects pilots', () => {
		const src = readFileSync(
			join(
				SRC_ROOT,
				'pages/MarketingCabinet/marketingCabinetApi/marketingCabinetOpenApi.ts'
			),
			'utf8'
		);
		expect(src).toContain('@/generated/marketing-cabinet-full-openapi');
		expect(src).toContain('@/generated/marketing-cabinet-openapi');
		expect(src).toContain('@/generated/companies-projects-openapi');
	});

	it('entity UI aliases match full Out schemas (type-level)', () => {
		type _Job = MarketingJobStory extends MarketingJobStoryOut ? true : false;
		type _Vp =
			MarketingValuePropositionOut extends Full['MarketingValuePropositionOut']
				? true
				: false;
		type _Swot = MarketingSwotOut extends Full['MarketingSwotOut']
			? true
			: false;
		type _Health =
			MarketingProjectHealthResponse extends Full['MarketingProjectHealthResponse']
				? true
				: false;
		type _Dash = DashboardLayoutResponse extends Full['DashboardLayoutResponse']
			? true
			: false;
		type _Perf =
			MarketingPerformanceDashboardResponse extends Full['MarketingPerformanceDashboardResponse']
				? true
				: false;
		type _Create = JobStoryCreateRequest extends Full['JobStoryCreateRequest']
			? true
			: false;
		const ok: [_Job, _Vp, _Swot, _Health, _Dash, _Perf, _Create] = [
			true,
			true,
			true,
			true,
			true,
			true,
			true,
		];
		expect(ok.every(Boolean)).toBe(true);
	});

	it('companies/projects org aliases match CompanyResponse / ProjectResponse', () => {
		type _C = CompanyResponse extends Org['CompanyResponse'] ? true : false;
		type _P = ProjectResponse extends Org['ProjectResponse'] ? true : false;
		const ok: [_C, _P] = [true, true];
		expect(ok.every(Boolean)).toBe(true);
	});

	it('JobStory create uses expected_outcome; Out uses outcome', () => {
		const createKeys: (keyof JobStoryCreateRequest)[] = [
			'project_id',
			'title',
			'situation',
			'motivation',
			'expected_outcome',
		];
		const outKeys: (keyof MarketingJobStoryOut)[] = [
			'id',
			'project_id',
			'title',
			'situation',
			'motivation',
			'outcome',
		];
		expect(createKeys).toContain('expected_outcome');
		expect(outKeys).toContain('outcome');
		expect(outKeys).not.toContain(
			'expected_outcome' as keyof MarketingJobStoryOut
		);
	});

	it('Zod AI/dashboard raw schemas keys ⊆ lite OpenAPI schema property keys', () => {
		const liteJson = JSON.parse(
			readFileSync(
				join(SRC_ROOT, '../openapi/pilot/marketing-cabinet.openapi.json'),
				'utf8'
			)
		) as {
			components: {
				schemas: Record<
					string,
					{ properties?: Record<string, unknown>; required?: string[] }
				>;
			};
		};
		const detailOpen = liteJson.components.schemas.MarketingAiRunDetailResponse;
		const listOpen = liteJson.components.schemas.MarketingAiRunListResponse;
		const dashOpen =
			liteJson.components.schemas.MarketingProjectDashboardResponse;
		expect(detailOpen?.properties).toBeTruthy();
		expect(listOpen?.properties).toBeTruthy();
		expect(dashOpen?.properties).toBeTruthy();

		const detailZod = zodObjectKeys(marketingAiRunDetailRawSchema);
		const listZod = zodObjectKeys(marketingAiRunListRawSchema);
		const dashZod = zodObjectKeys(marketingProjectDashboardRawSchema);

		const detailOpenKeys = new Set(schemaKeys(detailOpen));
		const listOpenKeys = new Set(schemaKeys(listOpen));
		const dashOpenKeys = new Set(schemaKeys(dashOpen));

		for (const k of detailZod) {
			expect(
				detailOpenKeys.has(k),
				`detail zod key ${k} missing in OpenAPI`
			).toBe(true);
		}
		for (const k of listZod) {
			expect(listOpenKeys.has(k), `list zod key ${k} missing in OpenAPI`).toBe(
				true
			);
		}
		for (const k of dashZod) {
			expect(
				dashOpenKeys.has(k),
				`dashboard zod key ${k} missing in OpenAPI`
			).toBe(true);
		}

		// Snapshot of required lite keys used by Zod parse helpers.
		expect(detailZod).toEqual(
			['error', 'poll_after_ms', 'queue', 'result', 'result_type', 'run'].sort()
		);
		expect(listZod).toEqual(['items', 'total'].sort());
		expect(dashZod).toContain('project');
		expect(dashZod).toContain('counts');
		expect(dashZod).toContain('readiness_score');

		type _LiteDetail = Lite['MarketingAiRunDetailResponse'];
		type _LiteDash = Lite['MarketingProjectDashboardResponse'];
		const _liteOk: [_LiteDetail, _LiteDash] | null = null;
		expect(_liteOk).toBeNull();
	});

	it('core entity / mutation / dashboard layout modules re-export from bridge', () => {
		const core = readFileSync(
			join(
				SRC_ROOT,
				'pages/MarketingCabinet/marketingCabinetApi/marketingCabinetApiCoreEntityTypes.ts'
			),
			'utf8'
		);
		const mut = readFileSync(
			join(
				SRC_ROOT,
				'pages/MarketingCabinet/marketingCabinetApi/marketingCabinetApiMutationPayloadTypes.ts'
			),
			'utf8'
		);
		const layout = readFileSync(
			join(
				SRC_ROOT,
				'pages/MarketingCabinet/marketingCabinetApi/marketingCabinetApiDashboardLayoutTypes.ts'
			),
			'utf8'
		);
		expect(core).toContain("./marketingCabinetOpenApi'");
		expect(core).not.toMatch(/export interface MarketingJobStory\b/);
		expect(mut).toContain("./marketingCabinetOpenApi'");
		expect(mut).not.toMatch(/export interface CreateJobStoryPayload\b/);
		expect(layout).toContain("./marketingCabinetOpenApi'");
		expect(layout).not.toMatch(/export interface MarketingDashboardLayout\b/);
	});
});
