import { describe, expect, it } from 'vitest';
import type { DesktopItem, WindowState } from '../../types/desktop.types';
import {
	buildDuplicateWindowOpenOptions,
	resolveDesktopItemForWindow,
} from '../desktopWindowDuplicate';

describe('desktopWindowDuplicate', () => {
	it('resolves desktop item from open window state', () => {
		const items: DesktopItem[] = [
			{
				id: 'app-1',
				name: 'Notes',
				type: 'app',
				position: { x: 0, y: 0 },
				appComponent: 'DocEditor',
			},
		];
		const window: WindowState = {
			id: 'win-1',
			title: 'Notes',
			type: 'app',
			position: { x: 40, y: 40 },
			size: { width: 800, height: 600 },
			isMinimized: false,
			isMaximized: false,
			zIndex: 3,
			folderId: 'app-1',
			path: ['Notes'],
			appComponent: 'DocEditor',
		};
		expect(resolveDesktopItemForWindow(window, items)?.id).toBe('app-1');
	});

	it('builds forceNew open options with offset restore bounds', () => {
		const window: WindowState = {
			id: 'win-2',
			title: 'Folder',
			type: 'folder',
			position: { x: 100, y: 120 },
			size: { width: 640, height: 480 },
			isMinimized: false,
			isMaximized: false,
			zIndex: 2,
			folderId: 'folder-a',
			path: ['Parent', 'Folder'],
			initialPayload: { contentManagerFolderItemId: 'folder-a' },
		};
		const opts = buildDuplicateWindowOpenOptions(window);
		expect(opts.forceNew).toBe(true);
		expect(opts.restoreState?.position).toEqual({ x: 132, y: 152 });
		expect(opts.initialPayload?.contentManagerFolderItemId).toBe('folder-a');
		expect(opts.folderPathPrefix).toEqual(['Parent']);
	});
});
