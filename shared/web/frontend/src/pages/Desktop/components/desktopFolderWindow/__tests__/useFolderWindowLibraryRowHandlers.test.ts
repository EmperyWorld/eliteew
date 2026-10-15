/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for library row handlers extracted from DesktopFolderWindow slice 5.
 *
 * Invariants:
 * - Row click clears nested selection; shift-click selects range.
 *
 * Related:
 * - useFolderWindowLibraryRowHandlers.ts
 */

import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { FolderFileItem } from '../../../hooks/useFolderContents';
import { useFolderWindowLibraryRowHandlers } from '../useFolderWindowLibraryRowHandlers';

function makeFile(id: string): FolderFileItem {
	return {
		id,
		name: `file-${id}`,
		content_type: 'document',
	} as FolderFileItem;
}

describe('useFolderWindowLibraryRowHandlers', () => {
	it('selects one row on plain click and clears nested selection', () => {
		const clearNestedSelection = vi.fn();
		const selectOne = vi.fn();
		const filesList = [makeFile('a'), makeFile('b')];

		const { result } = renderHook(() =>
			useFolderWindowLibraryRowHandlers({
				filesList,
				selectedIds: new Set<string>(),
				clearNestedSelection,
				selectOne,
				toggleSelect: vi.fn(),
				selectAllIds: vi.fn(),
				setFocusedIndex: vi.fn(),
				setFolderFileContextMenu: vi.fn(),
				setPreviewFile: vi.fn(),
				setFolderDeletePending: vi.fn(),
				openFolderRename: vi.fn(),
			})
		);

		act(() => {
			result.current.onRowClick(
				{ shiftKey: false, metaKey: false, ctrlKey: false } as React.MouseEvent,
				filesList[1],
				1
			);
		});

		expect(clearNestedSelection).toHaveBeenCalledTimes(1);
		expect(selectOne).toHaveBeenCalledWith('b');
	});

	it('opens preview on view action', () => {
		const setPreviewFile = vi.fn();
		const file = makeFile('preview-1');

		const { result } = renderHook(() =>
			useFolderWindowLibraryRowHandlers({
				filesList: [file],
				selectedIds: new Set<string>(),
				clearNestedSelection: vi.fn(),
				selectOne: vi.fn(),
				toggleSelect: vi.fn(),
				selectAllIds: vi.fn(),
				setFocusedIndex: vi.fn(),
				setFolderFileContextMenu: vi.fn(),
				setPreviewFile,
				setFolderDeletePending: vi.fn(),
				openFolderRename: vi.fn(),
			})
		);

		act(() => {
			result.current.handleFolderFileAction('view', file);
		});

		expect(setPreviewFile).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'preview-1', content_type: 'document' })
		);
	});
});
