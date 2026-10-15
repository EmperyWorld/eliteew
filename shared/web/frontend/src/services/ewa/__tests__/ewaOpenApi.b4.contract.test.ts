/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Honest lock that EWA context-anchor / driver-catalog / tiny delete aliases
 * are OpenAPI SSOT (Wave B4).
 *
 * Related:
 * - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md
 * - ewaOpenApi.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { components as EwaComponents } from '@/generated/ewa-openapi';

import type {
	CompanionContextAnchorGetOut,
	CompanionContextAnchorRefreshOut,
	CompanionContextDiagnoseOut,
	CompanionDeletedOut,
	CompanionOkOut,
	EwaDriverCatalogEntryOut,
} from '../ewaOpenApi';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = join(__dirname, '../../../../');
const PILOT_PATH = join(FRONTEND_ROOT, 'openapi/pilot/ewa.openapi.json');
const BRIDGE_PATH = join(__dirname, '../ewaOpenApi.ts');

type Ewa = EwaComponents['schemas'];

const JSON_PATHS: Array<{ path: string; method: string; schema: string }> = [
	{
		path: '/api/v1/ewa/companion-profile/context-anchor',
		method: 'get',
		schema: 'CompanionContextAnchorGetOut',
	},
	{
		path: '/api/v1/ewa/companion-profile/context-anchor/refresh',
		method: 'post',
		schema: 'CompanionContextAnchorRefreshOut',
	},
	{
		path: '/api/v1/ewa/companion-profile/context-anchor/diagnose',
		method: 'post',
		schema: 'CompanionContextDiagnoseOut',
	},
	{
		path: '/api/v1/ewa/companion-profile/quick-actions/{preset_id}',
		method: 'delete',
		schema: 'CompanionOkOut',
	},
	{
		path: '/api/v1/ewa/companion-user-workflows/{workflow_id}',
		method: 'delete',
		schema: 'CompanionDeletedOut',
	},
	{
		path: '/api/v1/ewa/driver-catalog',
		method: 'get',
		schema: 'EwaDriverCatalogEntryOut',
	},
];

describe('ewa OpenAPI SSOT (Wave B4)', () => {
	it('UI aliases track ewa-openapi Out schemas (type-level)', () => {
		type _Get =
			CompanionContextAnchorGetOut extends Ewa['CompanionContextAnchorGetOut']
				? true
				: false;
		type _Refresh =
			CompanionContextAnchorRefreshOut extends Ewa['CompanionContextAnchorRefreshOut']
				? true
				: false;
		type _Diagnose =
			CompanionContextDiagnoseOut extends Ewa['CompanionContextDiagnoseOut']
				? true
				: false;
		type _Ok = CompanionOkOut extends Ewa['CompanionOkOut'] ? true : false;
		type _Deleted = CompanionDeletedOut extends Ewa['CompanionDeletedOut']
			? true
			: false;
		type _Driver =
			EwaDriverCatalogEntryOut extends Ewa['EwaDriverCatalogEntryOut']
				? true
				: false;
		const ok: [_Get, _Refresh, _Diagnose, _Ok, _Deleted, _Driver] = [
			true,
			true,
			true,
			true,
			true,
			true,
		];
		expect(ok).toEqual([true, true, true, true, true, true]);
	});

	it('pilot JSON paths $ref named B4 outs', () => {
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

	it('bridge exports B4 context-anchor / driver / tiny delete aliases', () => {
		const bridge = readFileSync(BRIDGE_PATH, 'utf8');
		for (const name of [
			'CompanionContextAnchorGetOut',
			'CompanionContextAnchorRefreshOut',
			'CompanionContextDiagnoseOut',
			'CompanionOkOut',
			'CompanionDeletedOut',
			'EwaDriverCatalogEntryOut',
		]) {
			expect(bridge).toContain(`Schemas['${name}']`);
		}
	});
});
