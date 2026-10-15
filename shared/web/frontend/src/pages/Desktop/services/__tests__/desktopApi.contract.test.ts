/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for desktop user API paths and OpenAPI pilot shell-state fields used by the desktop UI.
 *
 * Invariants:
 * - Expected shell-state keys stay synchronized with `shared/api/routers/desktop.py`.
 * - Tests read pilot JSON only; no HTTP calls.
 *
 * Related:
 * - src/pages/Desktop/services/desktopApi.ts
 * - openapi/pilot/desktop.openapi.json
 * - shared/api/routers/desktop.py
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DESKTOP_API_V1_BASE, DESKTOP_USER_API_PREFIX } from '../desktopApi';
import { EXPANSION_SHELL_STATE_PATCH_KEYS } from '../../types/desktopShellStatePatch.types';

const PILOT = join(
	__dirname,
	'../../../../../openapi/pilot/desktop.openapi.json'
);

/** Sorted keys of `DesktopShellStateOut` / `DesktopShellStatePatch` — sync with `shared/api/routers/desktop.py` when adding shell_state fields. */
const DESKTOP_SHELL_STATE_SCHEMA_KEYS_SORTED = [
	'app_collections',
	'assistant_context_actions',
	'clipboard_history',
	'clock_show_seconds',
	'content_shortcuts',
	'ewa_hints',
	'gaf_chat_sound_enabled',
	'music_playback',
	'music_playlists',
	'now_playing',
	'quiet_mode',
	'recent_app_ids',
	'recent_app_ids_by_desktop',
	'recent_file_ids',
	'timezone',
	'tray_show_assistant',
	'tray_show_feedback',
	'virtual_desktops',
	'visual_style_presets',
	'widgets_layout',
	'window_layout_presets',
	'windows_snapshot',
	'workspace_profiles',
] as const;

describe('desktop user API path contract', () => {
	it('matches domains/desktop.py mount (/api/v1 + routers/desktop.py /desktop)', () => {
		expect(DESKTOP_API_V1_BASE).toBe('/api/v1');
		expect(DESKTOP_USER_API_PREFIX).toBe('/desktop');
	});

	it('resolves config and shell-state paths used by desktopApi', () => {
		const base = `${DESKTOP_API_V1_BASE}${DESKTOP_USER_API_PREFIX}`;
		expect(`${base}/config`).toBe('/api/v1/desktop/config');
		expect(`${base}/shell-state`).toBe('/api/v1/desktop/shell-state');
		expect(`${base}/items`).toBe('/api/v1/desktop/items');
	});

	it('OpenAPI pilot includes landmark routes from desktop.py', () => {
		type PilotPathEntry = {
			get?: { responses?: Record<string, unknown> };
			patch?: { responses?: Record<string, unknown> };
		};
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as {
			paths: Record<string, PilotPathEntry>;
		};
		expect(spec.paths['/api/v1/desktop/config']?.get).toBeDefined();
		expect(spec.paths['/api/v1/desktop/config']?.patch).toBeDefined();
		expect(spec.paths['/api/v1/desktop/shell-state']?.get).toBeDefined();
		expect(spec.paths['/api/v1/desktop/items']?.get).toBeDefined();
	});

	it('includes recent-content-feed (wave 5)', () => {
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as {
			paths: Record<string, { get?: unknown }>;
		};
		expect(
			spec.paths['/api/v1/desktop/recent-content-feed']?.get
		).toBeDefined();
	});

	it('recent-content-feed response schema documents all slices including projects', () => {
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as {
			paths: Record<
				string,
				{
					get?: {
						responses?: Record<
							string,
							{
								content?: Record<string, { schema?: { $ref?: string } }>;
							}
						>;
					};
				}
			>;
			components: {
				schemas: Record<
					string,
					{ properties?: Record<string, unknown>; required?: string[] }
				>;
			};
		};
		const ref =
			spec.paths['/api/v1/desktop/recent-content-feed']?.get?.responses?.['200']
				?.content?.['application/json']?.schema?.$ref;
		expect(ref).toBe('#/components/schemas/DesktopRecentContentFeedResponse');
		const feed = spec.components.schemas.DesktopRecentContentFeedResponse;
		expect(feed?.properties?.projects).toBeDefined();
		expect(feed?.properties?.opened).toBeDefined();
		expect(feed?.required?.sort()).toEqual(
			['added', 'generated', 'opened', 'projects', 'uploaded'].sort()
		);
		const row = spec.components.schemas.DesktopRecentFileRow;
		expect(row?.properties?.id).toBeDefined();
		expect(row?.properties?.type).toBeDefined();
		expect(row?.properties?.openedAt).toBeDefined();
	});

	it('recent-files 200 schema is array of DesktopRecentFileRow', () => {
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as {
			paths: Record<
				string,
				{
					get?: {
						responses?: Record<
							string,
							{
								content?: Record<
									string,
									{
										schema?: {
											type?: string;
											items?: { $ref?: string };
										};
									}
								>;
							}
						>;
					};
				}
			>;
		};
		const schema =
			spec.paths['/api/v1/desktop/recent-files']?.get?.responses?.['200']
				?.content?.['application/json']?.schema;
		expect(schema?.type).toBe('array');
		expect(schema?.items?.$ref).toBe(
			'#/components/schemas/DesktopRecentFileRow'
		);
	});

	it('conditional GET (ETag / 304) documented on config, shell-state, installed', () => {
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as {
			paths: Record<string, { get?: { responses?: Record<string, unknown> } }>;
		};
		for (const p of [
			'/api/v1/desktop/config',
			'/api/v1/desktop/shell-state',
			'/api/v1/desktop/installed',
		] as const) {
			expect(
				spec.paths[p]?.get?.responses?.['304'],
				`expected 304 on GET ${p}`
			).toBeDefined();
			expect(spec.paths[p]?.get?.responses?.['200']).toBeDefined();
		}
	});

	it('shell-state schemas include per-desktop recent apps (wave 2)', () => {
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as {
			components: {
				schemas: Record<string, { properties?: Record<string, unknown> }>;
			};
		};
		expect(
			spec.components.schemas.DesktopShellStateOut?.properties
				?.recent_app_ids_by_desktop
		).toBeDefined();
		expect(
			spec.components.schemas.DesktopShellStatePatch?.properties
				?.recent_app_ids_by_desktop
		).toBeDefined();
	});

	it('shell-state schemas include window layout presets (wave 3)', () => {
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as {
			components: {
				schemas: Record<string, { properties?: Record<string, unknown> }>;
			};
		};
		expect(
			spec.components.schemas.DesktopShellStateOut?.properties
				?.window_layout_presets
		).toBeDefined();
		expect(
			spec.components.schemas.DesktopShellStatePatch?.properties
				?.window_layout_presets
		).toBeDefined();
	});

	it('shell-state schemas include expansion fields bundle (waves 5–9)', () => {
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as {
			components: {
				schemas: Record<string, { properties?: Record<string, unknown> }>;
			};
		};
		const keysOut = [
			'workspace_profiles',
			'widgets_layout',
			'window_layout_presets',
			'app_collections',
			'content_shortcuts',
			'assistant_context_actions',
			'visual_style_presets',
		] as const;
		const outProps = spec.components.schemas.DesktopShellStateOut?.properties;
		const patchProps =
			spec.components.schemas.DesktopShellStatePatch?.properties;
		expect(outProps).toBeDefined();
		expect(patchProps).toBeDefined();
		for (const k of keysOut) {
			expect(outProps?.[k], `Out ${k}`).toBeDefined();
			expect(patchProps?.[k], `Patch ${k}`).toBeDefined();
		}
	});

	it('shell-state schemas: full Out/Patch property set matches backend list (wave 10)', () => {
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as {
			components: {
				schemas: Record<string, { properties?: Record<string, unknown> }>;
			};
		};
		const outProps =
			spec.components.schemas.DesktopShellStateOut?.properties ?? {};
		const patchProps =
			spec.components.schemas.DesktopShellStatePatch?.properties ?? {};
		const outKeys = Object.keys(outProps).sort();
		const patchKeys = Object.keys(patchProps).sort();
		expect(patchKeys).toEqual(outKeys);
		expect(outKeys).toEqual([...DESKTOP_SHELL_STATE_SCHEMA_KEYS_SORTED]);
	});

	it('expansion patch keys align with backend shell-state schema (wave 5 types)', () => {
		for (const key of EXPANSION_SHELL_STATE_PATCH_KEYS) {
			expect(
				DESKTOP_SHELL_STATE_SCHEMA_KEYS_SORTED.includes(
					key as (typeof DESKTOP_SHELL_STATE_SCHEMA_KEYS_SORTED)[number]
				),
				key
			).toBe(true);
		}
		expect(EXPANSION_SHELL_STATE_PATCH_KEYS.length).toBe(7);
	});

	it('shell-state workspace_profiles uses nested wire schema when pilot refreshed (wave 8)', () => {
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as {
			components: {
				schemas: Record<string, { properties?: Record<string, unknown> }>;
			};
		};
		const wp = spec.components.schemas.DesktopShellStateOut?.properties
			?.workspace_profiles as { $ref?: string } | undefined;
		if (!wp?.$ref) {
			expect(wp).toBeDefined();
			return;
		}
		expect(wp.$ref).toContain('DesktopWorkspaceProfilesWire');
		expect(
			spec.components.schemas.DesktopWorkspaceProfilesWire?.properties?.profiles
		).toBeDefined();
	});

	it('shell-state expansion fields use nested wire schemas (wave 9–10)', () => {
		type SchemaProp = {
			$ref?: string;
			type?: string;
			items?: SchemaProp;
			anyOf?: SchemaProp[];
		};

		const schemaRef = (prop: SchemaProp | undefined): string | undefined => {
			if (!prop) return undefined;
			if ('$ref' in prop && prop.$ref) return prop.$ref;
			if ('items' in prop && prop.items) {
				const itemsRef = schemaRef(prop.items);
				if (itemsRef) return itemsRef;
			}
			if ('anyOf' in prop && prop.anyOf) {
				for (const entry of prop.anyOf) {
					const ref = schemaRef(entry);
					if (ref) return ref;
				}
			}
			return undefined;
		};

		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as {
			components: {
				schemas: Record<string, { properties?: Record<string, SchemaProp> }>;
			};
		};
		const outProps = spec.components.schemas.DesktopShellStateOut?.properties;
		expect(outProps).toBeDefined();

		expect(schemaRef(outProps?.workspace_profiles)).toContain(
			'DesktopWorkspaceProfilesWire'
		);
		expect(schemaRef(outProps?.window_layout_presets)).toContain(
			'DesktopWindowLayoutPresetWire'
		);
		expect(schemaRef(outProps?.widgets_layout)).toContain(
			'DesktopWidgetsLayoutWire'
		);
		expect(schemaRef(outProps?.app_collections)).toContain(
			'DesktopAppCollectionWire'
		);
		expect(schemaRef(outProps?.content_shortcuts)).toContain(
			'DesktopContentShortcutWire'
		);
		expect(schemaRef(outProps?.assistant_context_actions)).toContain(
			'DesktopAssistantContextActionWire'
		);
	});

	it('site-studio proxy routes use distinct operationIds per HTTP method', () => {
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as {
			paths: Record<
				string,
				Record<string, { operationId?: string } | undefined>
			>;
		};
		const entry = spec.paths['/api/v1/desktop/site-studio/proxy/{path}'];
		expect(entry).toBeDefined();
		const ids = new Set<string>();
		for (const method of [
			'get',
			'post',
			'put',
			'patch',
			'delete',
			'options',
		] as const) {
			const op = entry[method] as { operationId?: string } | undefined;
			expect(op?.operationId, method).toBeDefined();
			const opId = op?.operationId;
			expect(opId).toBeDefined();
			if (opId) ids.add(opId);
		}
		expect(ids.size).toBe(6);
	});
});
