/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral contract tests for the shared folder-view hook and refresh-event integration.
 *
 * Invariants:
 * - Folder selection and pagination reach contentApi without changing wire semantics.
 * - Desktop and library refresh events both refetch the atomic folder view.
 *
 * Related:
 * - src/hooks/useFolderView.ts
 * - src/services/unifiedContentEvents.ts
 */
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	CONTENT_MANAGER_LIBRARY_REFRESH_EVENT,
	DESKTOP_ITEMS_REFRESH_EVENT,
} from '@/services/unifiedContentEvents';
import { useFolderView } from '../useFolderView';

const mocks = vi.hoisted(() => ({
	getFolderView: vi.fn(),
}));

vi.mock('@/services/contentApi', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@/services/contentApi')>();
	return {
		...actual,
		contentApi: {
			...actual.contentApi,
			getFolderView: mocks.getFolderView,
		},
	};
});

const response = {
	folder_item_id: 'folder-1',
	unfiled: false,
	desktop_children: [],
	files: {
		items: [],
		total: 0,
		page: 1,
		page_size: 50,
		has_more: false,
	},
};

describe('useFolderView', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getFolderView.mockResolvedValue(response);
	});

	it('loads one folder context through getFolderView', async () => {
		const { result } = renderHook(() =>
			useFolderView({
				folderItemId: 'folder-1',
				search: ' report ',
				sort: { field: 'name', order: 'asc' },
				limit: 50,
				offset: 0,
			})
		);

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(mocks.getFolderView).toHaveBeenCalledWith(
			{
				folderItemId: 'folder-1',
				unfiled: false,
				search: 'report',
				sort: { field: 'name', order: 'asc' },
				limit: 50,
				offset: 0,
				contentType: undefined,
			},
			expect.objectContaining({ signal: expect.any(AbortSignal) })
		);
	});

	it.each([DESKTOP_ITEMS_REFRESH_EVENT, CONTENT_MANAGER_LIBRARY_REFRESH_EVENT])(
		'refetches on %s',
		async (eventName) => {
			const { result } = renderHook(() =>
				useFolderView({ unfiled: true, limit: 50, offset: 0 })
			);
			await waitFor(() => expect(result.current.loading).toBe(false));
			expect(mocks.getFolderView).toHaveBeenCalledTimes(1);

			window.dispatchEvent(new CustomEvent(eventName));

			await waitFor(() => expect(mocks.getFolderView).toHaveBeenCalledTimes(2));
		}
	);
});
