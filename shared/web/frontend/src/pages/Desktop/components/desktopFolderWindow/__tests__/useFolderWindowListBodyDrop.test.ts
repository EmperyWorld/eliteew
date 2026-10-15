/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for list body drop handler wiring extracted from DesktopFolderWindow slice 4.
 *
 * Invariants:
 * - Body drop delegates nested ids before library payload before file upload.
 *
 * Related:
 * - useFolderWindowListBodyDrop.ts
 */

import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { DESKTOP_NESTED_ITEM_DRAG_MIME } from '../../../utils/desktopNestedItemDrag';
import { useFolderWindowListBodyDrop } from '../useFolderWindowListBodyDrop';

describe('useFolderWindowListBodyDrop', () => {
	it('routes nested drag ids to nested drop handler', () => {
		const handleNestedItemDropToFolder = vi.fn();
		const handleLibraryContentDropToFolder = vi.fn();
		const runFolderUploadFiles = vi.fn();

		const { result } = renderHook(() =>
			useFolderWindowListBodyDrop({
				effectiveFolderId: 'folder-a',
				handleNestedItemDropToFolder,
				handleLibraryContentDropToFolder,
				runFolderUploadFiles,
			})
		);

		const dt = {
			getData: (type: string) =>
				type === DESKTOP_NESTED_ITEM_DRAG_MIME ? '["id-1","id-2"]' : '',
			files: [] as unknown as FileList,
		};

		act(() => {
			result.current.handleFolderBodyDrop({
				preventDefault: vi.fn(),
				stopPropagation: vi.fn(),
				dataTransfer: dt,
			} as unknown as React.DragEvent);
		});

		expect(handleNestedItemDropToFolder).toHaveBeenCalledTimes(1);
		expect(handleLibraryContentDropToFolder).not.toHaveBeenCalled();
		expect(runFolderUploadFiles).not.toHaveBeenCalled();
	});

	it('activates drop highlight on drag enter for file payloads', () => {
		const { result } = renderHook(() =>
			useFolderWindowListBodyDrop({
				effectiveFolderId: 'folder-a',
				handleNestedItemDropToFolder: vi.fn(),
				handleLibraryContentDropToFolder: vi.fn(),
				runFolderUploadFiles: vi.fn(),
			})
		);

		expect(result.current.folderDropActive).toBe(false);

		act(() => {
			result.current.onListBodyDragEnter({
				preventDefault: vi.fn(),
				stopPropagation: vi.fn(),
				dataTransfer: {
					getData: () => '',
					files: [{ name: 'a.txt' }],
					types: ['Files'],
				},
			} as unknown as React.DragEvent);
		});

		expect(result.current.folderDropActive).toBe(true);
	});

	it('tracks drop kind for overlay copy', () => {
		const { result } = renderHook(() =>
			useFolderWindowListBodyDrop({
				effectiveFolderId: 'folder-a',
				handleNestedItemDropToFolder: vi.fn(),
				handleLibraryContentDropToFolder: vi.fn(),
				runFolderUploadFiles: vi.fn(),
			})
		);

		act(() => {
			result.current.onListBodyDragOver({
				preventDefault: vi.fn(),
				stopPropagation: vi.fn(),
				dataTransfer: {
					getData: () => '',
					files: [{ name: 'a.txt' }],
					types: ['Files'],
				},
			} as unknown as React.DragEvent);
		});

		expect(result.current.folderDropKind).toBe('upload');
	});
});
