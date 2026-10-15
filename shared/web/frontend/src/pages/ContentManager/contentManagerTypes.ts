/**
 * Shared types for Content Manager Pro (tabs, URL sync).
 */
import type { Content as ContentItem } from '../../components/UnifiedContent/types';
import type { DesktopItemResponse } from '../Desktop/services/desktopApi';

/** In «Все файлы» + группировка по папке: сколько файлов показывать изначально и шаг «Показать ещё». */
export const ALL_FILES_FOLDER_VISIBLE_STEP = 10;

/** Группа для панели списка: `items` могут быть урезаны для показа, `totalInFolder` — полный счётчик. */
export type ContentManagerFilePanelGroup = {
	groupId: string;
	title: string;
	items: ContentItem[];
	totalInFolder: number;
};

/** Explorer sidebar: desktop folders as a tree */
export type ContentManagerFolderTreeNode = DesktopItemResponse & {
	children: ContentManagerFolderTreeNode[];
};
export type ContentManagerTab =
	| 'files'
	| 'stats'
	| 'tags'
	| 'versions'
	| 'shared'
	| 'comments'
	| 'duplicates'
	| 'brokenFiles';

/** Deep-link sync (optional `?cm_tab=&cm_ft=&cm_fv=`) — see useContentManagerUrlSync */
export const CONTENT_MANAGER_URL_TABS: ReadonlySet<ContentManagerTab> = new Set(
	[
		'files',
		'stats',
		'tags',
		'versions',
		'shared',
		'comments',
		'duplicates',
		'brokenFiles',
	]
);

export type FilesBrowseMode = 'catalog' | 'explorer' | 'all_files';
export type ExplorerFolderTarget = 'unfiled' | string;

export type ViewMode = 'grid' | 'list';
export type SortField =
	| 'name'
	| 'created_at'
	| 'updated_at'
	| 'file_size'
	| 'content_type';
export type SortOrder = 'asc' | 'desc';
export type GroupBy = 'none' | 'type' | 'date' | 'folder';

export type FilterVisibility =
	| 'all'
	| 'private'
	| 'shared'
	| 'friends'
	| 'from_friends';
