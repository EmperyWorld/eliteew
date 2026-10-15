/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for folder window library drag helpers.
 *
 * Invariants:
 * — (нет)
 *
 * Related:
 * - folderWindowLibraryDrag.ts
 */

import { describe, expect, it } from 'vitest';

import { FOLDER_WINDOW_ROOT_ID } from '../desktopItemTree';
import { treeFolderIdToLibraryFolderItemId } from '../folderWindowLibraryDrag';

describe('treeFolderIdToLibraryFolderItemId', () => {
	it('maps root/unfiled to null', () => {
		expect(treeFolderIdToLibraryFolderItemId(FOLDER_WINDOW_ROOT_ID)).toBeNull();
		expect(treeFolderIdToLibraryFolderItemId('')).toBeNull();
		expect(treeFolderIdToLibraryFolderItemId('content')).toBeNull();
	});

	it('passes desktop folder item ids through', () => {
		expect(treeFolderIdToLibraryFolderItemId('documents')).toBe('documents');
		expect(treeFolderIdToLibraryFolderItemId('folder-abc')).toBe('folder-abc');
	});
});
