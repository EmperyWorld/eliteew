/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for Desktop folder window list pure helpers extracted from DesktopFolderWindow.
 *
 * Invariants:
 * - Upload query omits folder_item_id for root/content pseudo folders.
 *
 * Related:
 * - desktopFolderWindow/folderWindowListUtils.ts
 */

import { describe, expect, it } from 'vitest';
import type { FolderFileItem } from '../../hooks/useFolderContents';
import { FOLDER_WINDOW_ROOT_ID } from '../../utils/desktopItemTree';
import {
	buildFolderWindowMetaSummary,
	folderRowUsesUnifiedContentThumbnail,
	folderWindowUploadQuery,
	formatFolderItemDateRu,
	resolveFolderLibraryBodyVariant,
} from '../desktopFolderWindow/folderWindowListUtils';

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

describe('formatFolderItemDateRu', () => {
	it('formats ISO created_at in ru-RU short month form', () => {
		const file = {
			created_at: '2024-03-15T12:00:00.000Z',
		} as unknown as FolderFileItem;
		expect(formatFolderItemDateRu(file)).toMatch(/15.*2024/);
	});

	it('returns empty string when created_at is missing', () => {
		expect(formatFolderItemDateRu({} as unknown as FolderFileItem)).toBe('');
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
		expect(
			folderRowUsesUnifiedContentThumbnail({
				id: 'c2',
				content_type: 'video/mp4',
			} as FolderFileItem)
		).toBe(true);
	});

	it('is false for documents or blank id', () => {
		expect(
			folderRowUsesUnifiedContentThumbnail({
				id: 'c3',
				content_type: 'document',
			} as FolderFileItem)
		).toBe(false);
		expect(
			folderRowUsesUnifiedContentThumbnail({
				id: '  ',
				content_type: 'image/png',
			} as FolderFileItem)
		).toBe(false);
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

	it('joins nested and library counts with middle dot', () => {
		expect(
			buildFolderWindowMetaSummary({
				folderFilesLoading: false,
				hasNestedDesktopItems: true,
				nestedCount: 2,
				folderFiles: [{ id: 'a', name: 'a' }],
				folderTotal: 5,
				labels,
			})
		).toBe('2 nested · 1/5 files');
	});

	it('returns empty meta when no nested items and no library files', () => {
		expect(
			buildFolderWindowMetaSummary({
				folderFilesLoading: false,
				hasNestedDesktopItems: false,
				nestedCount: 0,
				folderFiles: [],
				folderTotal: 0,
				labels,
			})
		).toBe('Empty folder');
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
