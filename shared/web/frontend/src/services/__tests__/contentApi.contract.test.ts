/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Locks Unified Content client path and OpenAPI pilot contracts used by generated frontend types.
 *
 * Invariants:
 * - Folder-view schemas and route remain present together in the pilot.
 *
 * Related:
 * - src/services/contentApi/
 * - openapi/pilot/content.openapi.json
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTENT_API_V1_BASE } from '../contentApi';

const PILOT = join(__dirname, '../../../openapi/pilot/content.openapi.json');

describe('unified content API path contract', () => {
	it('uses v1 prefix from shared/api/domains/content.py', () => {
		expect(CONTENT_API_V1_BASE).toBe('/api/v1');
	});

	it('resolves list and download paths', () => {
		expect(`${CONTENT_API_V1_BASE}/content`).toBe('/api/v1/content');
		expect(`${CONTENT_API_V1_BASE}/content/c1/download`).toBe(
			'/api/v1/content/c1/download'
		);
		expect(`${CONTENT_API_V1_BASE}/content/batch-download`).toBe(
			'/api/v1/content/batch-download'
		);
	});

	it('OpenAPI pilot includes list and get content routes', () => {
		type PathItem = Partial<
			Record<'get' | 'post' | 'patch' | 'put' | 'delete', unknown>
		>;
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as {
			paths: Record<string, PathItem | undefined>;
		};
		expect(spec.paths['/api/v1/content']?.get).toBeDefined();
		expect(spec.paths['/api/v1/content/{content_id}']?.get).toBeDefined();
	});

	it('OpenAPI pilot documents list_profile and compact list response', () => {
		type GetOp = {
			parameters?: Array<{ name?: string }>;
			responses?: Record<
				string,
				{ content?: Record<string, { schema?: unknown }> }
			>;
		};
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as {
			paths: Record<string, { get?: GetOp } | undefined>;
			components?: { schemas?: Record<string, unknown> };
		};
		const listGet = spec.paths['/api/v1/content']?.get;
		expect(listGet).toBeDefined();
		const paramNames =
			listGet?.parameters?.map((p) => p.name).filter(Boolean) ?? [];
		expect(paramNames).toContain('list_profile');

		const schema = listGet?.responses?.['200']?.content?.['application/json']
			?.schema as
			| {
					oneOf?: Array<{ $ref?: string }>;
					anyOf?: Array<{ $ref?: string }>;
			  }
			| undefined;
		const variants = schema?.oneOf ?? schema?.anyOf;
		expect(Array.isArray(variants)).toBe(true);
		const refs = (variants ?? [])
			.map((item) => item?.$ref)
			.filter((value): value is string => typeof value === 'string');
		expect(refs).toContain('#/components/schemas/ContentListResponse');
		expect(refs).toContain('#/components/schemas/ContentListCompactResponse');

		const schemas = spec.components?.schemas ?? {};
		expect(schemas.ContentListItemCompact).toBeDefined();
		expect(schemas.ContentListCompactResponse).toBeDefined();
	});

	it('OpenAPI pilot includes the atomic folder-view contract', () => {
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as {
			paths: Record<string, { get?: unknown } | undefined>;
			components?: { schemas?: Record<string, unknown> };
		};
		expect(spec.paths['/api/v1/content/folder-view']?.get).toBeDefined();
		expect(spec.components?.schemas?.FolderViewDesktopChild).toBeDefined();
		expect(spec.components?.schemas?.FolderViewResponse).toBeDefined();
	});
});
