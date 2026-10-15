import { describe, expect, it } from 'vitest';
import type { DesktopItem, WindowState } from '../../types/desktop.types';
import {
	deriveWorkspaceProfileIdsFromPersistedWindows,
	deriveWorkspaceProfileIdsFromWindows,
} from '../desktopWorkspaceProfileCapture';

function deskApp(id: string, ac: string): DesktopItem {
	return {
		id,
		name: id,
		type: 'app',
		position: { x: 0, y: 0 },
		appComponent: ac,
	};
}

const folder: DesktopItem = {
	id: 'f1',
	name: 'F',
	type: 'folder',
	position: { x: 0, y: 0 },
};

const baseWindow = {
	position: { x: 0, y: 0 },
	size: { width: 400, height: 300 },
	isMinimized: false,
	isMaximized: false,
	zIndex: 1,
	path: [] as string[],
};

describe('deriveWorkspaceProfileIdsFromWindows', () => {
	it('maps folderId to app vs folder desktop items (deduped, stable order)', () => {
		const windows: WindowState[] = [
			{
				...baseWindow,
				id: 'w1',
				title: 'A',
				type: 'app',
				folderId: 'a1',
				appComponent: 'DocEditor',
				zIndex: 1,
			},
			{
				...baseWindow,
				id: 'w2',
				title: 'F',
				type: 'folder',
				folderId: 'f1',
				zIndex: 2,
			},
			{
				...baseWindow,
				id: 'w3',
				title: 'A2',
				type: 'app',
				folderId: 'a1',
				appComponent: 'DocEditor',
				zIndex: 3,
			},
		];
		const { appIds, folderItemIds } = deriveWorkspaceProfileIdsFromWindows(
			windows,
			[folder],
			[deskApp('a1', 'DocEditor')]
		);
		expect(appIds).toEqual(['a1']);
		expect(folderItemIds).toEqual(['f1']);
	});
});

describe('deriveWorkspaceProfileIdsFromPersistedWindows', () => {
	it('matches live window behavior for persisted rows', () => {
		const persisted = [
			{
				...baseWindow,
				title: 'A',
				type: 'app' as const,
				folderId: 'a1',
				appComponent: 'DocEditor',
			},
			{
				...baseWindow,
				title: 'F',
				type: 'folder' as const,
				folderId: 'f1',
			},
		];
		const { appIds, folderItemIds } =
			deriveWorkspaceProfileIdsFromPersistedWindows(
				persisted,
				[folder],
				[deskApp('a1', 'DocEditor')]
			);
		expect(appIds).toEqual(['a1']);
		expect(folderItemIds).toEqual(['f1']);
	});

	it('skips windows on other virtual desktops when filter is set', () => {
		const p = [
			{
				...baseWindow,
				title: 'A',
				type: 'app' as const,
				folderId: 'a1',
				appComponent: 'DocEditor',
				desktopId: 'd1',
			},
			{
				...baseWindow,
				title: 'B',
				type: 'app' as const,
				folderId: 'a2',
				appComponent: 'X',
				desktopId: 'd2',
			},
		];
		const { appIds } = deriveWorkspaceProfileIdsFromPersistedWindows(
			p,
			[],
			[deskApp('a1', 'DocEditor'), deskApp('a2', 'X')],
			'd1'
		);
		expect(appIds).toEqual(['a1']);
	});
});
