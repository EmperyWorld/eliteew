import { describe, expect, it } from 'vitest';
import {
	buildDesktopFolderLibraryListQuery,
	buildDesktopFolderLibraryPreviewQuery,
	collectFolderIdsForLibraryMutation,
	countNestedDesktopChildrenByFolderId,
	libraryContentToFolderPreviewEntry,
	mergeFolderIconBadgeCounts,
	mergeFolderIconPreviewEntries,
	resolveDesktopFolderLibraryTotal,
} from '../desktopFolderLibraryCounts';
import {
	DESKTOP_FOLDER_LIBRARY_TOTALS_QUERY_KEY,
	desktopFolderLibraryTotalQueryKey,
} from '../../hooks/useDesktopFolderLibraryCounts';
import { desktopFolderLibraryPreviewQueryKey } from '../../hooks/useDesktopFolderLibraryPreviews';

describe('libraryContentToFolderPreviewEntry', () => {
	it('maps content types to desktop fileType hints', () => {
		expect(
			libraryContentToFolderPreviewEntry({
				id: 'c1',
				content_type: 'image',
			})
		).toEqual({ id: 'c1', type: 'file', fileType: 'image' });
		expect(
			libraryContentToFolderPreviewEntry({
				id: 'c2',
				content_type: 'document',
				mime_type: 'application/pdf',
			})
		).toEqual({ id: 'c2', type: 'file', fileType: undefined });
	});
});

describe('buildDesktopFolderLibraryPreviewQuery', () => {
	it('requests up to four compact rows sorted by name', () => {
		expect(buildDesktopFolderLibraryPreviewQuery('images')).toEqual({
			limit: 4,
			offset: 0,
			folder_item_id: 'images',
			list_profile: 'compact',
			sort_field: 'name',
			sort_order: 'asc',
		});
	});
});

describe('mergeFolderIconPreviewEntries', () => {
	it('fills remaining slots with library entries after nested', () => {
		const nested = [
			{ id: 'n1', type: 'folder' as const },
			{ id: 'n2', type: 'file' as const, fileType: 'image' },
		];
		const library = [
			{ id: 'l1', type: 'file' as const, fileType: 'video' },
			{ id: 'n2', type: 'file' as const, fileType: 'document' },
			{ id: 'l2', type: 'file' as const, fileType: 'audio' },
		];
		expect(mergeFolderIconPreviewEntries(nested, library)).toEqual([
			{ id: 'n1', type: 'folder' },
			{ id: 'n2', type: 'file', fileType: 'image' },
			{ id: 'l1', type: 'file', fileType: 'video' },
			{ id: 'l2', type: 'file', fileType: 'audio' },
		]);
	});
});

describe('desktopFolderLibraryCounts', () => {
	it('builds list query for system and user folders', () => {
		expect(buildDesktopFolderLibraryListQuery('documents')).toEqual({
			limit: 1,
			offset: 0,
			folder_item_id: 'documents',
			list_profile: 'compact',
		});
		expect(buildDesktopFolderLibraryListQuery('content')).toEqual({
			limit: 1,
			offset: 0,
			list_profile: 'compact',
		});
	});

	it('merges nested shortcuts with library totals', () => {
		const nested = countNestedDesktopChildrenByFolderId([
			{ parentId: 'documents' },
			{ parentId: 'documents' },
			{ parentId: 'my-folder' },
		]);
		expect(nested).toEqual({ documents: 2, 'my-folder': 1 });
		expect(
			mergeFolderIconBadgeCounts(nested, { documents: 5, images: 3 })
		).toEqual({ documents: 7, 'my-folder': 1, images: 3 });
	});

	it('uses stable react-query keys for batch totals', () => {
		expect(DESKTOP_FOLDER_LIBRARY_TOTALS_QUERY_KEY).toEqual([
			'desktop',
			'folder-library-totals',
		]);
		expect(desktopFolderLibraryTotalQueryKey('documents')).toEqual([
			'desktop',
			'folder-library-totals',
			'documents',
		]);
		expect(desktopFolderLibraryPreviewQueryKey('documents')).toEqual([
			'desktop',
			'folder-library-preview',
			'documents',
		]);
	});

	it('resolves content folder from byFolderItemId bucket (not library total)', () => {
		expect(
			resolveDesktopFolderLibraryTotal(
				{
					byFolderItemId: { images: 3, content: 4 },
					unfiled: 1,
					total: 10,
				},
				'content'
			)
		).toBe(4);
		expect(
			resolveDesktopFolderLibraryTotal(
				{
					byFolderItemId: { images: 3 },
					unfiled: 1,
					total: 10,
				},
				'content'
			)
		).toBe(0);
		expect(
			resolveDesktopFolderLibraryTotal(
				{
					byFolderItemId: { images: 3 },
					unfiled: 1,
					total: 10,
				},
				'images'
			)
		).toBe(3);
	});

	it('collects source and target folder ids for CM moves', () => {
		const items = [
			{ id: 'a', folder_item_id: 'documents' },
			{ id: 'b', folder_item_id: 'images' },
		];
		expect(
			collectFolderIdsForLibraryMutation(items, ['a', 'b'], 'projects')
		).toEqual(['documents', 'images', 'projects']);
	});
});
