/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * Tests upload folder target resolution for Content Manager file uploads.
 *
 * Invariants:
 * - Explorer mode uses the selected folder; unfiled uploads omit `folder_item_id`.
 * - Catalog/all-files default to `documents` when no catalog folder filter is set.
 *
 * Related:
 * - `contentManagerUploadTarget.ts`
 */
import { describe, expect, it } from 'vitest';
import { resolveContentManagerUploadFolderItemId } from './contentManagerUploadTarget';

describe('resolveContentManagerUploadFolderItemId', () => {
	it('uses the selected explorer folder', () => {
		expect(
			resolveContentManagerUploadFolderItemId('explorer', 'folder-42')
		).toBe('folder-42');
	});

	it('keeps explorer unfiled uploads without folder_item_id', () => {
		expect(
			resolveContentManagerUploadFolderItemId('explorer', 'unfiled')
		).toBeNull();
	});

	it('uses catalog folder filter when set', () => {
		expect(
			resolveContentManagerUploadFolderItemId('catalog', 'unfiled', 'documents')
		).toBe('documents');
	});

	it('defaults catalog uploads to documents when no folder filter', () => {
		expect(
			resolveContentManagerUploadFolderItemId('catalog', 'folder-42', null)
		).toBe('documents');
	});

	it('defaults all-files uploads to documents', () => {
		expect(
			resolveContentManagerUploadFolderItemId('all_files', 'folder-42')
		).toBe('documents');
	});
});
