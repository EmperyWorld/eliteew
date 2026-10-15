import { describe, expect, it } from 'vitest';
import type { DesktopItem } from '../../types/desktop.types';
import {
	buildDesktopItemMetaForApi,
	readFolderIconIdFromMeta,
} from '../desktopFolderIconMeta';
import { toApiItem, fromApiItem } from '../../services/desktopApi';

describe('desktopFolderIconMeta', () => {
	it('round-trips folder_icon through toApiItem/fromApiItem', () => {
		const item: DesktopItem = {
			id: 'folder-1',
			name: 'Notes',
			type: 'folder',
			position: { x: 40, y: 40 },
			folderIconId: 'heart',
			meta: { folder_icon: 'heart' },
		};
		const api = toApiItem(item);
		expect(api.meta).toEqual({ folder_icon: 'heart' });
		const partial = fromApiItem({
			item_id: item.id,
			item_type: 'FOLDER',
			name: item.name,
			position: item.position,
			color: null,
			gradient: null,
			is_pinned: false,
			app_component: null,
			parent_id: null,
			is_system: false,
			meta: { folder_icon: 'heart' },
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z',
			id: '00000000-0000-0000-0000-000000000001',
		});
		expect(partial.folderIconId).toBe('heart');
	});

	it('drops invalid folder_icon ids on read', () => {
		expect(
			readFolderIconIdFromMeta({ folder_icon: 'not-an-icon' })
		).toBeUndefined();
	});

	it('omits empty meta on buildDesktopItemMetaForApi', () => {
		const item: DesktopItem = {
			id: 'folder-2',
			name: 'Plain',
			type: 'folder',
			position: { x: 10, y: 10 },
		};
		expect(buildDesktopItemMetaForApi(item)).toBeNull();
	});
});
