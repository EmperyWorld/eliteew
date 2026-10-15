/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Focused unit tests for desktop item operation callbacks extracted from DesktopWorkspaceContent.
 *
 * Invariants:
 * - Tests mutate an in-memory item array only through the hook commit function.
 *
 * Related:
 * - src/pages/Desktop/hooks/useDesktopWorkspaceItemOperations.ts
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDesktopUiTFunction } from '../../__fixtures__/desktopTestHelpers';
import type { UserFolderIconId } from '../../constants/folderIcons';
import type { DesktopItem } from '../../types/desktop.types';
import { FOLDER_WINDOW_ROOT_ID } from '../../utils/desktopItemTree';
import { useDesktopWorkspaceItemOperations } from '../useDesktopWorkspaceItemOperations';

const toastSuccess = vi.hoisted(() => vi.fn());
const requestDesktopFolderLibraryCountsInvalidate = vi.hoisted(() => vi.fn());

vi.mock('sonner', () => ({
	toast: {
		success: toastSuccess,
	},
}));

vi.mock('@/services/unifiedContentEvents', () => ({
	requestDesktopFolderLibraryCountsInvalidate,
}));

function item(
	id: string,
	type: DesktopItem['type'] = 'file',
	parentId?: string
): DesktopItem {
	return {
		id,
		type,
		name: id,
		position: { x: 0, y: 0 },
		...(parentId ? { parentId } : {}),
	};
}

describe('useDesktopWorkspaceItemOperations', () => {
	let items: DesktopItem[];
	let createFolder: (
		name: string,
		options: { parentId?: string; folderIconId?: UserFolderIconId }
	) => Promise<DesktopItem>;
	let createMarkdownFile: (options?: {
		parentId?: string;
	}) => Promise<{ contentId: string; item: DesktopItem } | null>;
	let desktopToast: { info: (title: string, message?: string) => unknown };
	let openDesktopAppByComponent: (
		appComponent: string,
		options?: { initialPayload?: unknown }
	) => unknown;
	let setPropertiesItem: (item: DesktopItem | null) => void;
	let setShowNF: (value: boolean) => void;
	let updateFolderIcon: (
		itemId: string,
		folderIconId: UserFolderIconId
	) => Promise<void>;
	const t = createDesktopUiTFunction();

	beforeEach(() => {
		items = [];
		createFolder = vi.fn(async (name: string) =>
			item(`folder-${name}`, 'folder')
		);
		createMarkdownFile = vi.fn(async () => ({
			contentId: 'content-1',
			item: item('doc-1', 'file'),
		}));
		desktopToast = { info: vi.fn() };
		openDesktopAppByComponent = vi.fn();
		setPropertiesItem = vi.fn();
		setShowNF = vi.fn();
		updateFolderIcon = vi.fn(async () => {});
		toastSuccess.mockReset();
		requestDesktopFolderLibraryCountsInvalidate.mockReset();
	});

	function renderOperations() {
		const newFolderDialogRef = { current: {} };
		const hook = renderHook(() =>
			useDesktopWorkspaceItemOperations({
				commitItems: (mutator) => {
					items = mutator(items);
				},
				createFolder,
				createMarkdownFile,
				desktopToast,
				newFolderDialogRef,
				openDesktopAppByComponent,
				setPropertiesItem,
				setShowNF,
				t,
				updateFolderIcon,
			})
		);
		return { ...hook, newFolderDialogRef };
	}

	it('creates a folder through the dialog ref and calls the onCreated callback', async () => {
		const { result, newFolderDialogRef } = renderOperations();
		const onCreated = vi.fn();
		newFolderDialogRef.current = { parentId: 'parent-1', onCreated };

		await act(async () => {
			await result.current.handleCreateFolderForDialog('docs', 'star');
		});

		expect(createFolder).toHaveBeenCalledWith('docs', {
			parentId: 'parent-1',
			folderIconId: 'star',
		});
		expect(onCreated).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'folder-docs' })
		);
		expect(newFolderDialogRef.current).toEqual({});
	});

	it('creates markdown at root sentinel without persisting the sentinel as parent', async () => {
		const { result } = renderOperations();

		await act(async () => {
			await result.current.createMarkdownFileInFolder(FOLDER_WINDOW_ROOT_ID);
		});

		expect(createMarkdownFile).toHaveBeenCalledWith({ parentId: undefined });
		expect(openDesktopAppByComponent).toHaveBeenCalledWith('DocEditor', {
			initialPayload: { unifiedContentId: 'content-1' },
		});
		expect(requestDesktopFolderLibraryCountsInvalidate).not.toHaveBeenCalled();
	});

	it('reports skipped cyclic folder moves to the desktop toast', () => {
		items = [
			item('folder-a', 'folder'),
			item('folder-b', 'folder', 'folder-a'),
		];
		const { result } = renderOperations();

		act(() => {
			result.current.moveDesktopNestedItemsToFolder(['folder-a'], 'folder-b');
		});

		expect(desktopToast.info).toHaveBeenCalledWith(
			'workspace.folderMovePartialTitle',
			expect.stringContaining('workspace.folderMovePartialBody')
		);
		expect(
			items.find((candidate) => candidate.id === 'folder-a')?.parentId
		).toBeUndefined();
	});
});
