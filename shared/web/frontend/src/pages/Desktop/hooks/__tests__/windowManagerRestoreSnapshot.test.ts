/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for persisted window snapshot → runtime restore builder.
 *
 * Invariants:
 * - Geometry guards, legacy remap, and z-order contracts stay stable across refactors.
 *
 * Related:
 * - `hooks/windowManagerRestoreSnapshot.ts`, `hooks/useWindowManager.ts`
 */

import { describe, expect, it, vi } from 'vitest';
import type {
	DesktopItem,
	PersistedWindowState,
} from '../../types/desktop.types';
import {
	buildRestoredWindowStates,
	isValidPersistedWindowGeometry,
	normalizePersistedWindowSnapshot,
	prepareSessionRestore,
	resolveRestoreItemForSnapshot,
} from '../windowManagerRestoreSnapshot';

const ugsItem: DesktopItem = {
	id: 'app-ugs',
	name: 'UGS',
	type: 'app',
	position: { x: 0, y: 0 },
	appComponent: 'UGS',
};

const folderItem: DesktopItem = {
	id: 'folder-docs',
	name: 'Documents',
	type: 'folder',
	position: { x: 0, y: 0 },
};

function persistedApp(
	overrides: Partial<PersistedWindowState> = {}
): PersistedWindowState {
	return {
		type: 'app',
		title: 'UGS',
		path: ['UGS'],
		position: { x: 40, y: 60 },
		size: { width: 800, height: 600 },
		isMinimized: false,
		isMaximized: false,
		zIndex: 5,
		appComponent: 'UGS',
		...overrides,
	};
}

describe('normalizePersistedWindowSnapshot', () => {
	it('remaps legacy chat components and drops hidden apps', () => {
		const normalized = normalizePersistedWindowSnapshot([
			persistedApp({ appComponent: 'EliteChat', title: 'Chat' }),
			persistedApp({ appComponent: 'VoiceCommand', title: 'Voice' }),
			persistedApp({ appComponent: 'DesktopShellSettings', title: 'Settings' }),
		]);

		expect(normalized).toHaveLength(1);
		expect(normalized[0]?.appComponent).toBe('GAFChatApp');
	});
});

describe('isValidPersistedWindowGeometry', () => {
	it('rejects entries without position or size objects', () => {
		expect(
			isValidPersistedWindowGeometry(
				persistedApp({
					position: undefined as unknown as PersistedWindowState['position'],
				})
			)
		).toBe(false);
		expect(
			isValidPersistedWindowGeometry(
				persistedApp({
					size: undefined as unknown as PersistedWindowState['size'],
				})
			)
		).toBe(false);
	});
});

describe('resolveRestoreItemForSnapshot', () => {
	it('resolves folder windows by folderId', () => {
		const resolved = resolveRestoreItemForSnapshot(
			{
				type: 'folder',
				title: 'Documents',
				path: ['Documents'],
				position: { x: 0, y: 0 },
				size: { width: 400, height: 300 },
				isMinimized: false,
				isMaximized: false,
				zIndex: 1,
				folderId: 'folder-docs',
			},
			[folderItem]
		);

		expect(resolved?.id).toBe('folder-docs');
	});

	it('falls back to DEFAULT_APPS when app is missing from desktop items', () => {
		const resolved = resolveRestoreItemForSnapshot(
			persistedApp({ appComponent: 'AppStore' }),
			[]
		);

		expect(resolved?.appComponent).toBe('AppStore');
	});
});

describe('buildRestoredWindowStates', () => {
	it('preserves persisted z-index and desktopId alignment when entries are skipped', () => {
		const onSkipInvalid = vi.fn();
		const result = buildRestoredWindowStates({
			snapshot: [
				persistedApp({ title: 'Back', zIndex: 3, desktopId: 'desk-a' }),
				persistedApp({
					title: 'Broken',
					position: undefined as unknown as PersistedWindowState['position'],
				}),
				persistedApp({ title: 'Front', zIndex: 19, desktopId: 'desk-b' }),
			],
			items: [ugsItem],
			createWindowId: (index) => `w-test-${index}`,
			onSkipInvalid,
		});

		expect(onSkipInvalid).toHaveBeenCalledTimes(1);
		expect(result.windows).toHaveLength(2);
		expect(result.windows.map((window) => window.zIndex)).toEqual([3, 19]);
		expect(result.desktopIds).toEqual(['desk-a', 'desk-b']);
		expect(result.maxZ).toBe(19);
		expect(
			result.windows.every((window) => window.openedFromSessionRestore)
		).toBe(true);
	});

	it('assigns monotonic fallback z-index when snapshot zIndex is missing', () => {
		const result = buildRestoredWindowStates({
			snapshot: [
				persistedApp({ zIndex: undefined as unknown as number }),
				persistedApp({ zIndex: undefined as unknown as number }),
			],
			items: [ugsItem],
			createWindowId: (index) => `w-fallback-${index}`,
		});

		expect(result.windows.map((window) => window.zIndex)).toEqual([1, 2]);
	});

	it('defaults path to item name when snapshot path is empty', () => {
		const result = buildRestoredWindowStates({
			snapshot: [persistedApp({ path: [] })],
			items: [ugsItem],
			createWindowId: () => 'w-path',
		});

		expect(result.windows[0]?.path).toEqual(['UGS']);
	});

	it('reuses persisted window id when valid and unique', () => {
		const result = buildRestoredWindowStates({
			snapshot: [persistedApp({ id: 'w-stable-42' })],
			items: [ugsItem],
			createWindowId: () => 'w-mint-fallback',
		});

		expect(result.windows[0]?.id).toBe('w-stable-42');
	});

	it('mints fallback id when persisted id collides', () => {
		const result = buildRestoredWindowStates({
			snapshot: [
				persistedApp({ id: 'w-dup', title: 'One' }),
				persistedApp({ id: 'w-dup', title: 'Two' }),
			],
			items: [ugsItem],
			createWindowId: (index) => `w-fallback-${index}`,
		});

		expect(result.windows.map((window) => window.id)).toEqual([
			'w-dup',
			'w-fallback-1',
		]);
	});
});

describe('prepareSessionRestore', () => {
	it('returns null when snapshot normalizes to empty', () => {
		expect(
			prepareSessionRestore(
				[persistedApp({ appComponent: 'VoiceCommand' })],
				[ugsItem],
				() => 'w-empty'
			)
		).toBeNull();
	});

	it('returns built windows when restore is valid', () => {
		const result = prepareSessionRestore(
			[persistedApp()],
			[ugsItem],
			() => 'w-ready'
		);
		expect(result?.windows).toHaveLength(1);
		expect(result?.windows[0]?.id).toBe('w-ready');
	});
});
