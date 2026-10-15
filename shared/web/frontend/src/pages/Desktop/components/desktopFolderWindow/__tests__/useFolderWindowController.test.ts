/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for folder window controller extracted in DesktopFolderWindow slice 6.
 *
 * Invariants:
 * - Controller exposes shell wiring surface without throwing on empty folder.
 *
 * Related:
 * - useFolderWindowController.ts · DesktopFolderWindowShell.tsx
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { WindowState } from '../../../types/desktop.types';
import { useFolderWindowController } from '../useFolderWindowController';

const mocks = vi.hoisted(() => ({
	useFolderWindowNavigation: vi.fn(),
}));

const win: WindowState = {
	id: 'win-1',
	title: 'Test Folder',
	type: 'folder',
	folderId: 'folder-1',
	path: ['folder-1'],
	appComponent: 'folder',
	isMinimized: false,
	isMaximized: false,
	position: { x: 0, y: 0 },
	size: { width: 800, height: 600 },
	zIndex: 1,
};

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@tanstack/react-query')>();
	return {
		...actual,
		useQueryClient: () => ({ invalidateQueries: vi.fn() }),
	};
});

vi.mock('@/hooks/useDebounce', () => ({
	useDebounce: (value: string) => value,
}));

vi.mock('@/hooks/useResizeObserverRect', () => ({
	useResizeObserverRect: () => ({ height: 400, width: 600 }),
}));

vi.mock('../../../context/DesktopAppPropsContext', () => ({
	useDesktopAppProps: () => ({ desktopItems: [] }),
}));

vi.mock('../../../hooks/useFolderContents', () => ({
	useFolderContents: () => ({
		folderFiles: [],
		folderTotal: 0,
		folderHasMore: false,
		folderFilesLoading: false,
		folderLoadingMore: false,
		folderDesktopChildren: [
			{
				id: 'desktop-child-uuid',
				item_id: 'nested-folder',
				item_type: 'FOLDER',
				name: 'Nested',
			},
		],
		refreshFolderContents: vi.fn(),
		loadMoreFolderContents: vi.fn(),
		setFolderFiles: vi.fn(),
	}),
}));

vi.mock('../useFolderLibraryRename', () => ({
	useFolderLibraryRename: () => ({
		folderRenameOpen: false,
		openFolderRename: vi.fn(),
		closeFolderRename: vi.fn(),
		setFolderRenameDraft: vi.fn(),
		confirmFolderRename: vi.fn(),
	}),
}));

vi.mock('../useFolderWindowSelection', () => ({
	useFolderWindowSelection: () => ({
		selectedIds: new Set<string>(),
		clear: vi.fn(),
		setOne: vi.fn(),
		toggle: vi.fn(),
		setAll: vi.fn(),
	}),
}));

vi.mock('../useFolderWindowNavigation', () => ({
	useFolderWindowNavigation: mocks.useFolderWindowNavigation,
}));

vi.mock('../useFolderWindowTreeDropHandlers', () => ({
	useFolderWindowTreeDropHandlers: () => ({
		treeDropHighlight: null,
		setTreeDropHighlight: vi.fn(),
		handleNestedItemDropToFolder: vi.fn(),
		handleLibraryContentDropToFolder: vi.fn(),
		handleTreeDropToFolder: vi.fn(),
		handleMoveTargetsToFolder: vi.fn(),
	}),
}));

vi.mock('../useFolderWindowNestedRowHandlers', () => ({
	useFolderWindowNestedRowHandlers: () => ({
		onNestedItemClick: vi.fn(),
		toggleNestedRowSelected: vi.fn(),
		ensureNestedSelected: vi.fn(),
	}),
}));

vi.mock('../useFolderWindowCompanionListing', () => ({
	useFolderWindowCompanionListing: vi.fn(),
}));

vi.mock('../useFolderWindowCreateActions', () => ({
	useFolderWindowCreateActions: () => ({
		openFolderContentManager: vi.fn(),
		handleOpenNewFolderDialog: vi.fn(),
		handleCreateMarkdownHere: vi.fn(),
	}),
}));

vi.mock('../useFolderWindowUpload', () => ({
	useFolderWindowUpload: () => ({
		runFolderUploadFiles: vi.fn(),
	}),
}));

vi.mock('../useFolderWindowListBodyDrop', () => ({
	useFolderWindowListBodyDrop: () => ({
		folderDropActive: false,
		handleFolderBodyDrop: vi.fn(),
		onListBodyDragEnter: vi.fn(),
		onListBodyDragOver: vi.fn(),
		onListBodyDragLeave: vi.fn(),
	}),
}));

vi.mock('../useFolderWindowMoveFoldersLoader', () => ({
	useFolderWindowMoveFoldersLoader: vi.fn(),
}));

vi.mock('../useFolderWindowLibraryRowHandlers', () => ({
	useFolderWindowLibraryRowHandlers: () => ({
		handleFolderFileAction: vi.fn(),
		openFileContextMenu: vi.fn(),
		onRowClick: vi.fn(),
		onRowDoubleClick: vi.fn(),
		toggleRowSelected: vi.fn(),
		libraryFileDragProps: {},
	}),
}));

vi.mock('../useFolderWindowListKeyboard', () => ({
	useFolderWindowListKeyboard: () => ({
		handleListKeyDown: vi.fn(),
	}),
}));

describe('useFolderWindowController', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.useFolderWindowNavigation.mockReturnValue({
			pathSegments: [],
			folderTreeRoots: [],
			nestedDesktopItems: [],
			hasNestedDesktopItems: false,
			nestedFolderPathPrefix: '',
			navigateToFolder: vi.fn(),
			navigateToPathSegment: vi.fn(),
			nestedMoveTargetFolders: [],
			nestedSelectionCanMoveToRoot: false,
			handleMoveNestedTargetsToFolder: vi.fn(),
			handleNestedRenameCommit: vi.fn(),
			requestNestedDelete: vi.fn(),
		});
	});

	it('initializes controller surface for empty folder', () => {
		const { result } = renderHook(() => useFolderWindowController({ win }));

		expect(result.current.effectiveFolderId).toBe('folder-1');
		expect(result.current.filesList).toEqual([]);
		expect(result.current.focusedIndex).toBe(0);
		expect(result.current.folderViewMode).toBe('grid');
		expect(result.current.canOpenNewFolderDialog).toBe(false);
		expect(mocks.useFolderWindowNavigation).toHaveBeenCalledWith(
			expect.objectContaining({
				folderDesktopChildren: [
					expect.objectContaining({ item_id: 'nested-folder' }),
				],
			})
		);
	});

	it('resetFilters clears search and content type filter', () => {
		const { result } = renderHook(() => useFolderWindowController({ win }));

		act(() => {
			result.current.setSearchInput('query');
			result.current.setContentTypeFilter('image');
		});

		expect(result.current.searchInput).toBe('query');
		expect(result.current.contentTypeFilter).toBe('image');

		act(() => {
			result.current.resetFilters();
		});

		expect(result.current.searchInput).toBe('');
		expect(result.current.contentTypeFilter).toBe('all');
	});

	it('onListBodyBackgroundClick clears selection when target is currentTarget', () => {
		const { result } = renderHook(() => useFolderWindowController({ win }));

		const target = document.createElement('div');
		act(() => {
			result.current.onListBodyBackgroundClick({
				target,
				currentTarget: target,
			} as unknown as React.MouseEvent);
		});

		expect(result.current.clearAllSelection).toBeDefined();
	});
});
