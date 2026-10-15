/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Wave 5 KBSEW OpenAPI SSOT: bridge schema aliases match generated pilot;
 * admin client re-exports bridge types (no parallel hand DTO twins).
 *
 * Related:
 * - documentation/api/FRONTEND-BACKEND-HTTP.md §Adoption Wave 5
 * - pages/Admin/kbsewOpenApi.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { components } from '@/generated/kbsew-openapi';

import type {
	AdminKbsewSearchOut,
	KbsewBarrel,
	KbsewBarrelOut,
	KbsewBarrelStatus,
	KbsewBarrelStatusOut,
	KbsewIngestOut,
	KbsewIngestResponse,
	KbsewReadyOut,
	KbsewReadyResponse,
	KbsewSearchResponse,
} from '../kbsewOpenApi';

const __dirname = dirname(fileURLToPath(import.meta.url));
/** `shared/web/frontend/src` */
const SRC_ROOT = join(__dirname, '../../..');

type Schemas = components['schemas'];

describe('openapi SSOT Wave 5 — kbsewOpenApi', () => {
	it('bridge imports generated kbsew pilot and exports Out schemas', () => {
		const src = readFileSync(
			join(SRC_ROOT, 'pages/Admin/kbsewOpenApi.ts'),
			'utf8'
		);
		expect(src).toContain('@/generated/kbsew-openapi');
		expect(src).toContain("Schemas['KbsewBarrelOut']");
		expect(src).toContain("Schemas['AdminKbsewSearchOut']");
		expect(src).toContain("Schemas['KbsewReadyOut']");
	});

	it('admin client re-exports bridge types (no hand interface twins)', () => {
		const src = readFileSync(
			join(SRC_ROOT, 'pages/Admin/kbsewAdminApi.ts'),
			'utf8'
		);
		expect(src).toContain("from './kbsewOpenApi'");
		expect(src).not.toMatch(/export interface KbsewBarrel\b/);
		expect(src).not.toMatch(/export interface KbsewReadyResponse\b/);
		expect(src).not.toMatch(/export interface KbsewSearchResponse\b/);
	});

	it('compat aliases match generated Out schemas (type-level)', () => {
		type _Barrel = KbsewBarrel extends KbsewBarrelOut ? true : false;
		type _BarrelGen = KbsewBarrelOut extends Schemas['KbsewBarrelOut']
			? true
			: false;
		type _Status = KbsewBarrelStatus extends KbsewBarrelStatusOut
			? true
			: false;
		type _Ready = KbsewReadyResponse extends KbsewReadyOut ? true : false;
		type _Ingest = KbsewIngestResponse extends KbsewIngestOut ? true : false;
		type _Search = KbsewSearchResponse extends AdminKbsewSearchOut
			? true
			: false;
		type _SearchGen = AdminKbsewSearchOut extends Schemas['AdminKbsewSearchOut']
			? true
			: false;

		const ok: [
			_Barrel,
			_BarrelGen,
			_Status,
			_Ready,
			_Ingest,
			_Search,
			_SearchGen,
		] = [true, true, true, true, true, true, true];
		expect(ok.every(Boolean)).toBe(true);
	});

	it('pilot JSON exposes named Out schema refs for barrels list + search', () => {
		const pilot = JSON.parse(
			readFileSync(
				join(SRC_ROOT, '../openapi/pilot/kbsew.openapi.json'),
				'utf8'
			)
		) as {
			components?: { schemas?: Record<string, unknown> };
			paths?: Record<string, Record<string, unknown>>;
		};
		const schemas = pilot.components?.schemas ?? {};
		for (const name of [
			'KbsewBarrelOut',
			'KbsewBarrelStatusOut',
			'KbsewReadyOut',
			'AdminKbsewSearchOut',
			'KbsewIngestOut',
			'KbsewDriversOut',
		]) {
			expect(schemas[name], name).toBeTruthy();
		}
		const barrelsGet = pilot.paths?.['/api/v1/kbsew/barrels']?.get as {
			responses?: {
				'200'?: {
					content?: {
						'application/json'?: { schema?: { items?: { $ref?: string } } };
					};
				};
			};
		};
		expect(
			barrelsGet?.responses?.['200']?.content?.['application/json']?.schema
				?.items?.$ref
		).toContain('KbsewBarrelOut');
		const searchPost = pilot.paths?.['/api/v1/kbsew/search']?.post as {
			responses?: {
				'200'?: {
					content?: {
						'application/json'?: { schema?: { $ref?: string } };
					};
				};
			};
		};
		expect(
			searchPost?.responses?.['200']?.content?.['application/json']?.schema
				?.$ref
		).toContain('AdminKbsewSearchOut');
	});
});
