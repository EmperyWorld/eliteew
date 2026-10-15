/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Honest lock that MusicForge admin mutator DTO aliases are OpenAPI SSOT (Wave B4).
 *
 * Related:
 * - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md
 * - musicForgeOpenApi.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { components as MfComponents } from '@/generated/music-forge-openapi';

import type {
	MusicForgeAdminLaneOut,
	MusicForgeAdminModeOut,
	MusicForgeAdminPromptOut,
	MusicForgeAdminStageDeleteOut,
	MusicForgeAdminStageOut,
	MusicForgeAdminStyleOut,
} from '../musicForgeOpenApi';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = join(__dirname, '../../../../');
const PILOT_PATH = join(
	FRONTEND_ROOT,
	'openapi/pilot/music-forge.openapi.json'
);
const BRIDGE_PATH = join(__dirname, '../musicForgeOpenApi.ts');
const ADMIN_API_PATH = join(
	__dirname,
	'../../../pages/Admin/musicForge/musicForgeAdminApi.ts'
);

type Mf = MfComponents['schemas'];

const JSON_PATHS: Array<{ path: string; method: string; schema: string }> = [
	{
		path: '/api/v1/music-forge/admin/config/revisions/{revision_id}/lanes/{lane_key}',
		method: 'patch',
		schema: 'MusicForgeAdminLaneOut',
	},
	{
		path: '/api/v1/music-forge/admin/config/revisions/{revision_id}/prompts/{kind}',
		method: 'patch',
		schema: 'MusicForgeAdminPromptOut',
	},
	{
		path: '/api/v1/music-forge/admin/config/revisions/{revision_id}/styles/{style_key}',
		method: 'patch',
		schema: 'MusicForgeAdminStyleOut',
	},
	{
		path: '/api/v1/music-forge/admin/config/revisions/{revision_id}/modes/{mode_key}',
		method: 'patch',
		schema: 'MusicForgeAdminModeOut',
	},
	{
		path: '/api/v1/music-forge/admin/config/revisions/{revision_id}/modes/{mode_key}/stages/{stage_key}',
		method: 'patch',
		schema: 'MusicForgeAdminStageOut',
	},
	{
		path: '/api/v1/music-forge/admin/config/revisions/{revision_id}/modes/{mode_key}/stages',
		method: 'post',
		schema: 'MusicForgeAdminStageOut',
	},
	{
		path: '/api/v1/music-forge/admin/config/revisions/{revision_id}/modes/{mode_key}/stages/{stage_key}',
		method: 'delete',
		schema: 'MusicForgeAdminStageDeleteOut',
	},
];

describe('musicForge OpenAPI SSOT (Wave B4 mutators)', () => {
	it('UI aliases track music-forge-openapi Out schemas (type-level)', () => {
		type _Lane = MusicForgeAdminLaneOut extends Mf['MusicForgeAdminLaneOut']
			? true
			: false;
		type _Prompt =
			MusicForgeAdminPromptOut extends Mf['MusicForgeAdminPromptOut']
				? true
				: false;
		type _Style = MusicForgeAdminStyleOut extends Mf['MusicForgeAdminStyleOut']
			? true
			: false;
		type _Mode = MusicForgeAdminModeOut extends Mf['MusicForgeAdminModeOut']
			? true
			: false;
		type _Stage = MusicForgeAdminStageOut extends Mf['MusicForgeAdminStageOut']
			? true
			: false;
		type _Delete =
			MusicForgeAdminStageDeleteOut extends Mf['MusicForgeAdminStageDeleteOut']
				? true
				: false;
		const ok: [_Lane, _Prompt, _Style, _Mode, _Stage, _Delete] = [
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

	it('bridge + admin API consume named mutator Outs (no Record return)', () => {
		const bridge = readFileSync(BRIDGE_PATH, 'utf8');
		const adminApi = readFileSync(ADMIN_API_PATH, 'utf8');
		expect(bridge).toContain("Schemas['MusicForgeAdminLaneOut']");
		expect(bridge).toContain("Schemas['MusicForgeAdminStageDeleteOut']");
		expect(adminApi).toContain('MusicForgeAdminLaneOut');
		expect(adminApi).toContain('MusicForgeAdminStageDeleteOut');
		expect(adminApi).not.toMatch(
			/patchMusicForgeAdminConfigLane[\s\S]*Promise<Record<string, unknown>>/
		);
		expect(adminApi).not.toMatch(
			/deleteMusicForgeAdminConfigStage[\s\S]*Promise<Record<string, unknown>>/
		);
	});
});
