/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Wave 6 UGS OpenAPI SSOT: GenerationType / ProvidersSummary alias OpenAPI;
 * pilot list items $ref GenerationTypeResponse; no invented `icon` hand twin.
 *
 * Related:
 * - documentation/api/FRONTEND-BACKEND-HTTP.md §Adoption Wave 6
 * - services/api/ugs/types.ts
 * - services/api/ugs/schemas.ts
 */

/** @vitest-environment node */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { components } from '@/generated/ugs-openapi';

import type {
	UgsGenerationTypeListSchema,
	UgsGenerationTypeSchema,
	UgsProvidersStatusSchema,
	UgsProvidersStatusSummarySchema,
} from '../schemas';
import type { GenerationType, ProvidersSummary } from '../types';

const __dirname = dirname(fileURLToPath(import.meta.url));
/** `shared/web/frontend/src` */
const SRC_ROOT = join(__dirname, '../../../..');

type Schemas = components['schemas'];

describe('openapi SSOT Wave 6 — UGS GenerationType / ProvidersSummary', () => {
	it('schemas bridge exports clean GenerationTypeResponse + AdminGenerationTypeResponse', () => {
		const src = readFileSync(
			join(SRC_ROOT, 'services/api/ugs/schemas.ts'),
			'utf8'
		);
		expect(src).toContain("UgsSchemas['GenerationTypeResponse']");
		expect(src).toContain("UgsSchemas['AdminGenerationTypeResponse']");
		expect(src).toContain("UgsSchemas['UGSProvidersStatusSummary']");
		expect(src).not.toContain('api__schemas__ugs__GenerationTypeResponse');
		expect(src).not.toContain(
			'api__schemas__ugs_admin__GenerationTypeResponse'
		);
	});

	it('types.ts aliases OpenAPI (no hand GenerationType / ProvidersSummary interface)', () => {
		const src = readFileSync(
			join(SRC_ROOT, 'services/api/ugs/types.ts'),
			'utf8'
		);
		expect(src).toContain('UgsGenerationTypeSchema');
		expect(src).not.toMatch(/export interface GenerationType\b/);
		expect(src).not.toMatch(/export interface ProvidersSummary\b/);
		expect(src).not.toMatch(/\bicon\?:/);
		expect(src).toContain('normalizeUgsProvidersSummary');
	});

	it('dashboard fetchUgsTypes uses GenerationTypeListSchema envelope', () => {
		const src = readFileSync(
			join(SRC_ROOT, 'services/api/ugs/dashboard.ts'),
			'utf8'
		);
		expect(src).toContain('UgsGenerationTypeListSchema');
		expect(src).toContain('normalizeUgsProvidersSummary');
	});

	it('public aliases match generated schemas (type-level)', () => {
		type _Gen = GenerationType extends UgsGenerationTypeSchema ? true : false;
		type _GenSchema =
			UgsGenerationTypeSchema extends Schemas['GenerationTypeResponse']
				? true
				: false;
		type _List =
			UgsGenerationTypeListSchema extends Schemas['GenerationTypeListResponse']
				? true
				: false;
		type _Status =
			UgsProvidersStatusSchema extends Schemas['UGSProvidersStatusResponse']
				? true
				: false;
		type _Summary =
			UgsProvidersStatusSummarySchema extends Schemas['UGSProvidersStatusSummary']
				? true
				: false;
		type _Flatten = ProvidersSummary['total_providers'] extends number
			? true
			: false;

		const ok: [_Gen, _GenSchema, _List, _Status, _Summary, _Flatten] = [
			true,
			true,
			true,
			true,
			true,
			true,
		];
		expect(ok.every(Boolean)).toBe(true);
	});

	it('pilot JSON list items $ref GenerationTypeResponse (not loose object)', () => {
		const pilot = JSON.parse(
			readFileSync(join(SRC_ROOT, '../openapi/pilot/ugs.openapi.json'), 'utf8')
		) as {
			components?: { schemas?: Record<string, Record<string, unknown>> };
		};
		const schemas = pilot.components?.schemas ?? {};
		expect(schemas.GenerationTypeResponse).toBeTruthy();
		expect(schemas.AdminGenerationTypeResponse).toBeTruthy();
		expect(schemas.api__schemas__ugs__GenerationTypeResponse).toBeUndefined();
		expect(
			schemas.api__schemas__ugs_admin__GenerationTypeResponse
		).toBeUndefined();

		const list = schemas.GenerationTypeListResponse as {
			properties?: { types?: { items?: { $ref?: string } } };
		};
		expect(list.properties?.types?.items?.$ref).toBe(
			'#/components/schemas/GenerationTypeResponse'
		);
	});
});
