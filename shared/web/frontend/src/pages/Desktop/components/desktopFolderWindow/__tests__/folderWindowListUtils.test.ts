/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for folder window list pure helpers.
 *
 * Invariants:
 * - Upload query omits folder_item_id for root/content pseudo folders.
 *
 * Related:
 * - folderWindowListUtils.ts
 */

import { describe, expect, it } from 'vitest';
import type { FolderFileItem } from '../../../hooks/useFolderContents';
import { FOLDER_WINDOW_ROOT_ID } from '../../../utils/desktopItemTree';
import {
	buildFolderWindowActiveFilterSummary,
	buildFolderWindowMetaSummary,
	folderRowUsesUnifiedContentThumbnail,
	folderWindowTypeFilterLabelKey,
	folderWindowUploadQuery,
	formatFolderItemDate,
	formatFolderItemDateRu,
	resolveFolderLibraryBodyVariant,
} from '../folderWindowListUtils';

describe('folderWindowUploadQuery', () => {
	it('returns empty object for root and content pseudo folders', () => {
		expect(folderWindowUploadQuery(undefined)).toEqual({});
		expect(folderWindowUploadQuery('content')).toEqual({});
		expect(folderWindowUploadQuery(FOLDER_WINDOW_ROOT_ID)).toEqual({});
	});

	it('maps desktop folder id to folder_item_id', () => {
		expect(folderWindowUploadQuery('folder-abc')).toEqual({
			folder_item_id: 'folder-abc',
		});
	});
});

describe('formatFolderItemDate', () => {
	const file = {
		created_at: '2024-03-15T12:00:00.000Z',
	} as unknown as FolderFileItem;

	it('formats with explicit locale', () => {
		expect(formatFolderItemDate(file, 'en-US')).toMatch(/Mar.*15.*2024/);
	});

	it('keeps ru-RU alias for legacy callers', () => {
		expect(formatFolderItemDateRu(file)).toMatch(/15.*2024/);
	});

	it('returns empty string when created_at is missing', () => {
		expect(formatFolderItemDate({} as unknown as FolderFileItem)).toBe('');
	});
});

describe('buildFolderWindowActiveFilterSummary', () => {
	it('detects search-only and type-only filters', () => {
		expect(
			buildFolderWindowActiveFilterSummary({
				searchQuery: '  report  ',
				contentTypeFilter: 'all',
			})
		).toEqual({
			hasSearch: true,
			hasTypeFilter: false,
			searchQuery: 'report',
			contentTypeFilter: 'all',
		});
		expect(
			buildFolderWindowActiveFilterSummary({
				searchQuery: '',
				contentTypeFilter: 'image',
			}).hasTypeFilter
		).toBe(true);
	});
});

describe('folderWindowTypeFilterLabelKey', () => {
	it('maps known content types to i18n keys', () => {
		expect(folderWindowTypeFilterLabelKey('video')).toBe(
			'folderWindow.typeVideo'
		);
		expect(folderWindowTypeFilterLabelKey('all')).toBe('folderWindow.typeAll');
	});
});

describe('folderRowUsesUnifiedContentThumbnail', () => {
	it('is true for image/video with non-empty id', () => {
		expect(
			folderRowUsesUnifiedContentThumbnail({
				id: 'c1',
				content_type: 'image/png',
			} as FolderFileItem)
		).toBe(true);
	});
});

describe('buildFolderWindowMetaSummary', () => {
	const labels = {
		loadingMeta: 'Loading…',
		metaNested: (count: number) => `${count} nested`,
		listMeta: (shown: number, total: number) => `${shown}/${total} files`,
		emptyMeta: 'Empty folder',
	};

	it('returns loading label while folder files load', () => {
		expect(
			buildFolderWindowMetaSummary({
				folderFilesLoading: true,
				hasNestedDesktopItems: false,
				nestedCount: 0,
				folderFiles: [],
				folderTotal: 0,
				labels,
			})
		).toBe('Loading…');
	});
});

describe('resolveFolderLibraryBodyVariant', () => {
	it('prioritizes loading over other signals', () => {
		expect(
			resolveFolderLibraryBodyVariant({
				folderFilesLoading: true,
				hasLibraryFiles: true,
				filtersActive: true,
				hasNestedDesktopItems: true,
			})
		).toBe('loading');
	});

	it('shows file list when library has rows', () => {
		expect(
			resolveFolderLibraryBodyVariant({
				folderFilesLoading: false,
				hasLibraryFiles: true,
				filtersActive: false,
				hasNestedDesktopItems: false,
			})
		).toBe('file-list');
	});

	it('shows filter empty when search/filter active and no nested shortcuts', () => {
		expect(
			resolveFolderLibraryBodyVariant({
				folderFilesLoading: false,
				hasLibraryFiles: false,
				filtersActive: true,
				hasNestedDesktopItems: false,
			})
		).toBe('filter-empty');
	});

	it('shows nested hint when only nested shortcuts remain', () => {
		expect(
			resolveFolderLibraryBodyVariant({
				folderFilesLoading: false,
				hasLibraryFiles: false,
				filtersActive: false,
				hasNestedDesktopItems: true,
			})
		).toBe('nested-only-hint');
	});

	it('shows full empty panel when folder is truly empty', () => {
		expect(
			resolveFolderLibraryBodyVariant({
				folderFilesLoading: false,
				hasLibraryFiles: false,
				filtersActive: false,
				hasNestedDesktopItems: false,
			})
		).toBe('folder-empty');
	});
});
