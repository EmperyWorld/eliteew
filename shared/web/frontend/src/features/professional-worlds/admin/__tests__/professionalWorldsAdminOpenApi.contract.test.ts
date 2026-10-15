/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Honest lock that PW admin pack/release/rollout/test DTO aliases are OpenAPI SSOT (Wave B3).
 *
 * Related:
 * - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md
 * - professionalWorldsAdminOpenApi.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { components as PwComponents } from '@/generated/professional-worlds-openapi';

import type {
	ProfessionalAiActionTestOut,
	ProfessionalPackImportJobOut,
	ProfessionalPackImportJobRow,
	ProfessionalVerticalRollout,
	ProfessionalVerticalRolloutOut,
} from '../professionalWorldsAdminOpenApi';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = join(__dirname, '../../../../../');
const PILOT_PATH = join(
	FRONTEND_ROOT,
	'openapi/pilot/professional-worlds.openapi.json'
);
const BRIDGE_PATH = join(__dirname, '../professionalWorldsAdminOpenApi.ts');
const TYPES_PATH = join(__dirname, '../types.ts');
const API_PATH = join(__dirname, '../api.ts');

type Pw = PwComponents['schemas'];

const JSON_PATHS: Array<{ path: string; method: string; schema: string }> = [
	{
		path: '/api/v1/professional-worlds/admin/packs/import/jobs/{job_id}',
		method: 'get',
		schema: 'ProfessionalPackImportJobOut',
	},
	{
		path: '/api/v1/professional-worlds/admin/rollouts',
		method: 'get',
		schema: 'ProfessionalVerticalRolloutOut',
	},
	{
		path: '/api/v1/professional-worlds/admin/ai-actions/{action_key}/test',
		method: 'post',
		schema: 'ProfessionalAiActionTestOut',
	},
	{
		path: '/api/v1/professional-worlds/admin/verticals/{slug}/export',
		method: 'get',
		schema: 'ProfessionalVerticalPackExportOut',
	},
];

describe('professional worlds admin OpenAPI SSOT (Wave B3)', () => {
	it('UI aliases track professional-worlds-openapi Out schemas (type-level)', () => {
		type _Job =
			ProfessionalPackImportJobOut extends Pw['ProfessionalPackImportJobOut']
				? true
				: false;
		type _Row =
			ProfessionalPackImportJobRow extends Pw['ProfessionalPackImportJobOut']
				? true
				: false;
		type _Rollout =
			ProfessionalVerticalRollout extends Pw['ProfessionalVerticalRolloutOut']
				? true
				: false;
		type _RolloutOut =
			ProfessionalVerticalRolloutOut extends Pw['ProfessionalVerticalRolloutOut']
				? true
				: false;
		type _Test =
			ProfessionalAiActionTestOut extends Pw['ProfessionalAiActionTestOut']
				? true
				: false;
		const ok: [_Job, _Row, _Rollout, _RolloutOut, _Test] = [
			true,
			true,
			true,
			true,
			true,
		];
		expect(ok).toEqual([true, true, true, true, true]);
	});

	it('pilot JSON paths $ref named B3 outs', () => {
		const pilot = JSON.parse(readFileSync(PILOT_PATH, 'utf8')) as {
			paths: Record<
				string,
				Record<
					string,
					{
						responses?: Record<
							string,
							{
								content?: {
									'application/json'?: {
										schema?: {
											$ref?: string;
											items?: { $ref?: string };
											type?: string;
										};
									};
								};
							}
						>;
					}
				>
			>;
		};
		for (const { path, method, schema } of JSON_PATHS) {
			const op = pilot.paths[path]?.[method];
			expect(op, path).toBeTruthy();
			const content =
				op?.responses?.['200']?.content?.['application/json']?.schema ??
				op?.responses?.['201']?.content?.['application/json']?.schema;
			expect(content, `${method} ${path}`).toBeTruthy();
			const ref =
				content?.$ref ??
				(content?.type === 'array' ? content.items?.$ref : undefined);
			expect(ref).toBe(`#/components/schemas/${schema}`);
		}
	});

	it('bridge + types + api do not redefine hand PackImportJobRow / VerticalRollout interfaces', () => {
		const bridge = readFileSync(BRIDGE_PATH, 'utf8');
		const types = readFileSync(TYPES_PATH, 'utf8');
		const api = readFileSync(API_PATH, 'utf8');
		expect(bridge).toContain(
			"components['schemas']['ProfessionalPackImportJobOut']"
		);
		expect(bridge).toContain(
			"components['schemas']['ProfessionalVerticalRolloutOut']"
		);
		expect(types).not.toMatch(/export interface ProfessionalPackImportJobRow/);
		expect(types).not.toMatch(
			/export interface ProfessionalVerticalRollout \{/
		);
		expect(api).toContain('ProfessionalAiActionTestOut');
		expect(api).toContain('ProfessionalVerticalPackExportOut');
		expect(api).not.toMatch(
			/testProfessionalWorldsAiAction[\s\S]*Promise<Record<string, unknown>>/
		);
	});
});
