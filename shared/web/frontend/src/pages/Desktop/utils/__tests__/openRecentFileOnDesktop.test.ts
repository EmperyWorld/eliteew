import { describe, expect, it } from 'vitest';
import type { DesktopItem, RecentFile } from '../../types/desktop.types';
import {
	desktopFileItemToRecentLike,
	resolveRecentFileOpenAction,
} from '../openRecentFileOnDesktop';

function docApp(id = 'app-doc'): DesktopItem {
	return {
		id,
		name: 'Documents',
		type: 'app',
		appComponent: 'DocEditor',
		position: { x: 0, y: 0 },
	};
}

function cmApp(id = 'app-cm'): DesktopItem {
	return {
		id,
		name: 'Files',
		type: 'app',
		appComponent: 'ContentManagerPro',
		position: { x: 0, y: 0 },
	};
}

function fileOnDesktop(
	partial: Partial<DesktopItem> & Pick<DesktopItem, 'id' | 'name'>
): DesktopItem {
	return {
		type: 'file',
		position: { x: 0, y: 0 },
		...partial,
	};
}

describe('resolveRecentFileOpenAction', () => {
	it('maps document type to DocEditor with unifiedContentId', () => {
		const items = [docApp(), cmApp()];
		const file: RecentFile = {
			id: 'uc-1',
			name: 'a',
			type: 'document',
			path: '',
			openedAt: new Date(),
		};
		const a = resolveRecentFileOpenAction(file, items);
		expect(a?.item.appComponent).toBe('DocEditor');
		expect(a?.options?.initialPayload?.unifiedContentId).toBe('uc-1');
		expect(
			a?.options?.initialPayload?.contentManagerFolderItemId
		).toBeUndefined();
	});

	it('maps image to Content Manager with folder item id', () => {
		const items = [docApp(), cmApp()];
		const file: RecentFile = {
			id: 'img-9',
			name: 'x',
			type: 'image',
			path: '',
			openedAt: new Date(),
		};
		const a = resolveRecentFileOpenAction(file, items);
		expect(a?.item.appComponent).toBe('ContentManagerPro');
		expect(a?.options?.initialPayload?.contentManagerFolderItemId).toBe(
			'img-9'
		);
	});

	it('maps folder recent with project desktop id to Content Manager project scope', () => {
		const items = [cmApp()];
		const file: RecentFile = {
			id: 'eliteew-proj-550e8400-e29b-41d4-a716-446655440000',
			name: 'My project',
			type: 'folder',
			path: '',
			openedAt: new Date(),
		};
		const a = resolveRecentFileOpenAction(file, items);
		expect(a?.item.appComponent).toBe('ContentManagerPro');
		expect(a?.options?.initialPayload?.contentManagerProjectId).toBe(
			'550e8400-e29b-41d4-a716-446655440000'
		);
		expect(a?.options?.initialPayload?.contentManagerProjectName).toBe(
			'My project'
		);
		expect(
			a?.options?.initialPayload?.contentManagerFolderItemId
		).toBeUndefined();
	});

	it('falls back to DEFAULT_APPS when desk has no DocEditor/CM shortcuts', () => {
		const a = resolveRecentFileOpenAction(
			{
				id: 'uc-2',
				name: 'b',
				type: 'document',
				path: '',
				openedAt: new Date(),
			},
			[]
		);
		expect(a?.item.appComponent).toBe('DocEditor');
		expect(a?.options?.initialPayload?.unifiedContentId).toBe('uc-2');
	});

	it('maps project type to Content Manager with project id', () => {
		const items = [cmApp()];
		const file: RecentFile = {
			id: '550e8400-e29b-41d4-a716-446655440001',
			name: 'Alpha project',
			type: 'project',
			path: '/projects/alpha',
			openedAt: new Date(),
		};
		const a = resolveRecentFileOpenAction(file, items);
		expect(a?.item.appComponent).toBe('ContentManagerPro');
		expect(a?.options?.initialPayload?.contentManagerProjectId).toBe(
			'550e8400-e29b-41d4-a716-446655440001'
		);
		expect(a?.options?.initialPayload?.contentManagerProjectName).toBe(
			'Alpha project'
		);
	});

	it('returns null for empty id', () => {
		expect(
			resolveRecentFileOpenAction(
				{
					id: '  ',
					name: 'x',
					type: 'document',
					path: '',
					openedAt: new Date(),
				},
				[docApp()]
			)
		).toBeNull();
	});
});

describe('desktopFileItemToRecentLike', () => {
	it('classifies audio by extension', () => {
		const r = desktopFileItemToRecentLike(
			fileOnDesktop({ id: 't1', name: 'song.mp3' })
		);
		expect(r?.type).toBe('audio');
	});

	it('classifies image by mime', () => {
		const r = desktopFileItemToRecentLike(
			fileOnDesktop({
				id: 'i1',
				name: 'f',
				fileType: 'image/png',
			})
		);
		expect(r?.type).toBe('image');
	});

	it('defaults unknown file to document', () => {
		const r = desktopFileItemToRecentLike(
			fileOnDesktop({ id: 'd1', name: 'note.txt', fileType: 'text/plain' })
		);
		expect(r?.type).toBe('document');
	});

	it('returns null for folder items', () => {
		expect(
			desktopFileItemToRecentLike({
				id: 'x',
				name: 'F',
				type: 'folder',
				position: { x: 0, y: 0 },
			})
		).toBeNull();
	});
});
