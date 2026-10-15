/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for EWA observation builders from persisted desktop shell-state.
 *
 * Invariants:
 * - Observation wire keys match `OBSERVATION-CATALOG.md`.
 * - Tests use shell-state fixtures only; no desktop API calls.
 *
 * Related:
 * - src/features/ewa/amkaShellObservations.ts
 * - src/features/ewa/ewaShellHints.ts
 * - shared/api/ewa_platform/docs/OBSERVATION-CATALOG.md
 */
import type { DesktopShellState } from '@/pages/Desktop/services/desktopApi';
import type { PersistedWindowState } from '@/pages/Desktop/types/desktop.types';
import { describe, expect, it } from 'vitest';
import {
	EWA_SHELL_HINTS_SUBTREE_KEY,
	type EwaShellHintsSubtreeV1,
} from '../ewaShellHints';
import {
	buildActiveAppObservationFromShellState,
	buildWindowListObservationFromShellState,
	windowRefFromPersistedWindow,
} from '../amkaShellObservations';

function shellWithWindows(windows: unknown[]): DesktopShellState {
	return {
		windows_snapshot: { windows },
	} as DesktopShellState;
}

function persistedWindow(
	overrides: Partial<PersistedWindowState>
): PersistedWindowState {
	return {
		type: 'app',
		path: [],
		title: '',
		position: { x: 0, y: 0 },
		size: { width: 100, height: 100 },
		isMinimized: false,
		isMaximized: false,
		zIndex: 0,
		...overrides,
	};
}

describe('EWA shell observations contract', () => {
	it('uses stable path-based window ids before fallback ids', () => {
		expect(
			windowRefFromPersistedWindow(
				persistedWindow({ path: ['desktop', 'doc', '42'] }),
				0
			)
		).toBe('desktop/doc/42');
		expect(
			windowRefFromPersistedWindow(
				persistedWindow({ appComponent: 'EwaApp' }),
				2
			)
		).toBe('app:EwaApp:2');
	});

	it('builds window_list_snapshot from persisted shell windows', () => {
		const obs = buildWindowListObservationFromShellState(
			shellWithWindows([
				{
					type: 'app',
					appComponent: 'EwaApp',
					title: 'EWA',
					path: ['apps', 'ewa'],
				},
			])
		);

		expect(obs).toEqual({
			observation_kind: 'window_list_snapshot',
			windows: [
				{
					window_id: 'apps/ewa',
					app_component: 'EwaApp',
					title: 'EWA',
					type: 'app',
				},
			],
		});
	});

	it('builds active_app_changed from top non-minimized app window', () => {
		const obs = buildActiveAppObservationFromShellState(
			shellWithWindows([
				{ type: 'app', appComponent: 'LowApp', zIndex: 1 },
				{ type: 'app', appComponent: 'TopApp', zIndex: 9 },
				{
					type: 'app',
					appComponent: 'HiddenApp',
					zIndex: 99,
					isMinimized: true,
				},
			])
		);

		expect(obs).toEqual({
			observation_kind: 'active_app_changed',
			app_component: 'TopApp',
			window_id: 'app:TopApp:1',
		});
	});

	it('keeps the persisted hints key and v1 subtree shape explicit', () => {
		const hints: EwaShellHintsSubtreeV1 = {
			documents_workspace: { open_document_count: 1 },
			content_manager: { roots: ['project-a'] },
		};

		expect(EWA_SHELL_HINTS_SUBTREE_KEY).toBe('ewa_hints');
		expect(Object.keys(hints).sort()).toEqual([
			'content_manager',
			'documents_workspace',
		]);
	});
});
