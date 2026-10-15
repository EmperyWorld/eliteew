/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral contract tests for Content Manager explorer folder orchestration.
 *
 * Invariants:
 * - Successful nested-folder creation refreshes local folders and desktop consumers.
 *
 * Related:
 * - useContentManagerExplorerFolders.ts
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useContentManagerExplorerFolders } from './useContentManagerExplorerFolders';

const mocks = vi.hoisted(() => ({
	getDesktopItems: vi.fn(),
	upsertDesktopItem: vi.fn(),
	requestDesktopItemsRefresh: vi.fn(),
}));

vi.mock('../../Desktop/services/desktopApi', () => ({
	getDesktopItems: mocks.getDesktopItems,
	upsertDesktopItem: mocks.upsertDesktopItem,
	updateDesktopItem: vi.fn(),
	deleteDesktopItem: vi.fn(),
}));

vi.mock('../../../services/contentApi', () => ({
	contentApi: { updateContent: vi.fn() },
}));

vi.mock('../../../services/unifiedContentEvents', () => ({
	DESKTOP_ITEMS_REFRESH_EVENT: 'eliteew-desktop-items-refresh',
	requestDesktopFolderLibraryCountsInvalidate: vi.fn(),
	requestDesktopItemsRefresh: mocks.requestDesktopItemsRefresh,
}));

vi.mock('../../../notifications', () => ({
	notify: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

const t = ((key: string) => key) as never;
const parentFolder = {
	id: 'desktop-uuid',
	item_id: 'folder-parent',
	item_type: 'FOLDER',
	name: 'Parent',
	is_system: false,
	parent_id: null,
} as never;

describe('useContentManagerExplorerFolders', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getDesktopItems.mockResolvedValue([parentFolder]);
		vi.spyOn(window, 'prompt').mockReturnValue('Nested');
	});

	it('creates a nested folder and refreshes desktop consumers', async () => {
		const { result } = renderHook(() =>
			useContentManagerExplorerFolders({
				t,
				items: [],
				projects: [],
				filesBrowseMode: 'explorer',
				explorerFolderTarget: 'folder-parent',
				setExplorerFolderTarget: vi.fn(),
				folderViewDesktopChildren: [
					{
						id: 'nested-uuid',
						item_id: 'nested-folder',
						item_type: 'FOLDER',
						name: 'Nested from folder view',
					},
				] as never,
				fetchContent: vi.fn(),
				fetchStats: vi.fn(),
				fetchManagerActivity: vi.fn(),
			})
		);

		await waitFor(() => expect(result.current.folders).toHaveLength(1));
		expect(result.current.explorerNestedFolders).toEqual([
			expect.objectContaining({ item_id: 'nested-folder' }),
		]);
		await act(async () => {
			await result.current.createFolderUnderParent('folder-parent');
		});

		expect(mocks.upsertDesktopItem).toHaveBeenCalledWith(
			expect.stringMatching(/^folder-/),
			expect.objectContaining({
				name: 'Nested',
				parent_id: 'desktop-uuid',
				parent_item_id: 'folder-parent',
			})
		);
		expect(mocks.getDesktopItems).toHaveBeenCalledTimes(2);
		expect(mocks.requestDesktopItemsRefresh).toHaveBeenCalledOnce();
	});
});
