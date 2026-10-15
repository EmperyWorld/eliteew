/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for hand-written EWA Runtime Gateway clients: canonical paths, content query URL builder, and command
 * body normalization.
 *
 * Invariants:
 * - No network calls; tests inspect pure helpers/constants only.
 *
 * Related:
 * - src/services/ewa/ewaRuntimeContextApi.ts
 * - src/services/ewa/ewaRuntimeCommandApi.ts
 */
import { describe, expect, it } from 'vitest';
import {
	EWA_RUNTIME_CONTEXT_CONTENT_PATH,
	EWA_RUNTIME_CONTEXT_PATH,
	buildEwaRuntimeContentPath,
} from '../ewaRuntimeContextApi';
import {
	EWA_RUNTIME_COMMAND_PATH,
	EWA_RUNTIME_TURN_PATH,
	buildEwaRuntimeCommandBody,
} from '../ewaRuntimeCommandApi';

describe('EWA Runtime Gateway clients', () => {
	it('keeps canonical /api/v1/ewa-relative route paths', () => {
		expect(EWA_RUNTIME_CONTEXT_PATH).toBe('/ewa/runtime-context');
		expect(EWA_RUNTIME_CONTEXT_CONTENT_PATH).toBe(
			'/ewa/runtime-context/content'
		);
		expect(EWA_RUNTIME_COMMAND_PATH).toBe('/ewa/runtime-command');
		expect(EWA_RUNTIME_TURN_PATH).toBe('/ewa/runtime-turn');
	});

	it('builds a stable content page query path without empty params', () => {
		expect(
			buildEwaRuntimeContentPath({
				offset: 10,
				limit: 50,
				search: 'alpha',
				search_scope: 'content',
				content_types: ['document', 'audio'],
				extension_exclude: ['.mp3'],
				visibility: null,
				sort_field: '',
			})
		).toBe(
			'/ewa/runtime-context/content?offset=10&limit=50&search=alpha&search_scope=content&content_types=document&content_types=audio&extension_exclude=.mp3'
		);
	});

	it('normalizes command bodies with explicit empty arguments', () => {
		expect(
			buildEwaRuntimeCommandBody({
				command_kind: 'desktop.open_app',
				target_app: 'ContentManagerPro',
			})
		).toEqual({
			command_kind: 'desktop.open_app',
			target_app: 'ContentManagerPro',
			arguments: {},
		});
	});
});
