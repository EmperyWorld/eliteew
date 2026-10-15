/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Honest lock that Marketing client-interaction DTOs are OpenAPI SSOT aliases
 * (Wave B1), not twin hand interfaces; pilot JSON paths $ref named outs.
 *
 * Related:
 * - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md
 * - marketingCabinetOpenApi.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { components as FullComponents } from '@/generated/marketing-cabinet-full-openapi';

import type {
	ClientChatBridge,
	ClientChatBridgeOut,
	ClientDocApproval,
	ClientEwrpJobListItem,
	ClientInteractionContext,
	ClientInteractionContextOut,
	ClientPresShare,
	CustomerFacingSummaryGetOut,
	CustomerFacingSummaryGetResponse,
	MarketingClientDocApprovalOut,
	MarketingClientPartnerOut,
} from '../marketingCabinetOpenApi';

const __dirname = dirname(fileURLToPath(import.meta.url));
/** `…/marketingCabinetApi/__tests__` → frontend package root. */
const FRONTEND_ROOT = join(__dirname, '../../../../../');
const PILOT_PATH = join(
	FRONTEND_ROOT,
	'openapi/pilot/marketing-cabinet-full.openapi.json'
);
const INDEX_PATH = join(__dirname, '../index.ts');

type Full = FullComponents['schemas'];

const CI_JSON_PATHS: Array<{ path: string; method: string; schema: string }> = [
	{
		path: '/api/v1/marketing-cabinet/client-interaction/context',
		method: 'get',
		schema: 'ClientInteractionContextOut',
	},
	{
		path: '/api/v1/marketing-cabinet/client-interaction/chat-bridge',
		method: 'get',
		schema: 'ClientChatBridgeOut',
	},
	{
		path: '/api/v1/marketing-cabinet/client-interaction/customer-facing-summary',
		method: 'get',
		schema: 'CustomerFacingSummaryGetOut',
	},
	{
		path: '/api/v1/marketing-cabinet/client-interaction/documents',
		method: 'get',
		schema: 'MarketingClientDocApprovalOut',
	},
	{
		path: '/api/v1/marketing-cabinet/client-interaction/ewrp-jobs',
		method: 'get',
		schema: 'ClientEwrpJobListItemOut',
	},
	{
		path: '/api/v1/marketing-cabinet/client-interaction/presentations',
		method: 'get',
		schema: 'ClientPresShareOut',
	},
];

describe('client-interaction OpenAPI SSOT (Wave B1)', () => {
	it('UI aliases are the full Out schemas (type-level)', () => {
		type _Ctx = ClientInteractionContext extends ClientInteractionContextOut
			? true
			: false;
		type _Chat = ClientChatBridge extends ClientChatBridgeOut ? true : false;
		type _Doc = ClientDocApproval extends MarketingClientDocApprovalOut
			? true
			: false;
		type _Sum =
			CustomerFacingSummaryGetResponse extends CustomerFacingSummaryGetOut
				? true
				: false;
		const ok: [_Ctx, _Chat, _Doc, _Sum] = [true, true, true, true];
		expect(ok).toEqual([true, true, true, true]);

		type _Partner =
			MarketingClientPartnerOut extends Full['MarketingClientPartnerOut']
				? true
				: false;
		type _Ewrp = ClientEwrpJobListItem extends Full['ClientEwrpJobListItemOut']
			? true
			: false;
		type _Pres = ClientPresShare extends Full['ClientPresShareOut']
			? true
			: false;
		const ok2: [_Partner, _Ewrp, _Pres] = [true, true, true];
		expect(ok2).toEqual([true, true, true]);
	});

	it('full pilot paths $ref named response schemas (not bare object)', () => {
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
											type?: string;
											items?: { $ref?: string };
											additionalProperties?: boolean;
										};
									};
								};
							}
						>;
					}
				>
			>;
			components: { schemas: Record<string, unknown> };
		};

		for (const row of CI_JSON_PATHS) {
			const op = pilot.paths[row.path]?.[row.method];
			expect(op, row.path).toBeTruthy();
			const schema =
				op?.responses?.['200']?.content?.['application/json']?.schema ??
				op?.responses?.['201']?.content?.['application/json']?.schema;
			expect(schema, `${row.path} schema`).toBeTruthy();
			const ref = schema?.$ref ?? schema?.items?.$ref;
			expect(ref, `${row.path} $ref`).toBe(
				`#/components/schemas/${row.schema}`
			);
			expect(schema?.additionalProperties).not.toBe(true);
			expect(pilot.components.schemas[row.schema]).toBeTruthy();
		}
	});

	it('partner schema has friends lookup fields, not mute/block flags', () => {
		const pilot = JSON.parse(readFileSync(PILOT_PATH, 'utf8')) as {
			components: {
				schemas: {
					MarketingClientPartnerOut: {
						properties: Record<string, unknown>;
						required?: string[];
					};
				};
			};
		};
		const props = Object.keys(
			pilot.components.schemas.MarketingClientPartnerOut.properties
		).sort();
		expect(props).toEqual(
			[
				'admin_badge_hint',
				'admin_badge_label',
				'avatar_url',
				'full_name',
				'id',
				'is_system_account',
				'is_trusted',
				'username',
			].sort()
		);
		expect(props).not.toContain('is_muted');
		expect(props).not.toContain('is_blocked');
	});

	it('index barrel does not redefine ClientInteractionContext as interface', () => {
		const src = readFileSync(INDEX_PATH, 'utf8');
		expect(src).not.toMatch(/export interface ClientInteractionContext/);
		expect(src).toMatch(/ClientInteractionContext/);
		expect(src).toContain("from './marketingCabinetOpenApi'");
	});
});
