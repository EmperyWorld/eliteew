/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * Tests Content Manager deep-link and desktop focus side effects.
 *
 * Invariants:
 * - Opening by id selects and previews content even when it is not in the current list page.
 *
 * Related:
 * - `useContentManagerOpenContentEffects.ts`
 * - `desktopDeepLink.ts`
 */
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import { contentApi } from '../../../services/contentApi';
import { CONTENT_MANAGER_OPEN_CONTENT } from '../../Desktop/utils/desktopDeepLink';
import { useContentManagerOpenContentEffects } from './useContentManagerOpenContentEffects';

vi.mock('../../../services/contentApi', () => ({
	contentApi: {
		getContent: vi.fn(),
	},
}));

function item(id: string): ContentItem {
	return {
		id,
		name: id,
		content_type: 'document',
		file_size: 0,
		mime_type: null,
		created_at: '2026-01-01T00:00:00Z',
		updated_at: '2026-01-01T00:00:00Z',
		user_id: 'u',
		visibility: 'private',
		tags: [],
	} as ContentItem;
}

function t(key: string): string {
	return key;
}

describe('useContentManagerOpenContentEffects', () => {
	afterEach(() => {
		vi.clearAllMocks();
		sessionStorage.clear();
	});

	it('opens an item from the current list without refetching it', async () => {
		const row = item('c1');
		const setPendingOpenContentId = vi.fn();
		const setSelectedIds = vi.fn();
		const setPreviewItem = vi.fn();
		const setError = vi.fn();
		const onContentOpened = vi.fn();

		renderHook(() =>
			useContentManagerOpenContentEffects({
				items: [row],
				pendingOpenContentId: 'c1',
				setPendingOpenContentId,
				setSelectedIds,
				setPreviewItem,
				setError,
				t: t as never,
				onContentOpened,
			})
		);

		await waitFor(() => expect(setPreviewItem).toHaveBeenCalledWith(row));
		expect(setSelectedIds.mock.calls[0][0]).toEqual(new Set(['c1']));
		expect(onContentOpened).toHaveBeenCalledWith(row);
		expect(contentApi.getContent).not.toHaveBeenCalled();
		expect(setPendingOpenContentId).toHaveBeenCalledWith(null);
	});

	it('fetches and opens content absent from the current list', async () => {
		const row = item('c2');
		vi.mocked(contentApi.getContent).mockResolvedValue(row);
		const setPendingOpenContentId = vi.fn();
		const setSelectedIds = vi.fn();
		const setPreviewItem = vi.fn();

		renderHook(() =>
			useContentManagerOpenContentEffects({
				items: [],
				pendingOpenContentId: 'c2',
				setPendingOpenContentId,
				setSelectedIds,
				setPreviewItem,
				setError: vi.fn(),
				t: t as never,
			})
		);

		await waitFor(() => expect(setPreviewItem).toHaveBeenCalledWith(row));
		expect(contentApi.getContent).toHaveBeenCalledWith('c2');
		expect(setSelectedIds.mock.calls[0][0]).toEqual(new Set(['c2']));
		expect(setPendingOpenContentId).toHaveBeenCalledWith(null);
	});

	it('handles initial focus payload and opens assign project modal', async () => {
		const row = item('c3');
		const onOpenAssignProject = vi.fn();

		renderHook(() =>
			useContentManagerOpenContentEffects({
				items: [row],
				pendingOpenContentId: null,
				setPendingOpenContentId: vi.fn(),
				setSelectedIds: vi.fn(),
				setPreviewItem: vi.fn(),
				setError: vi.fn(),
				t: t as never,
				initialFocusUnifiedContentId: ' c3 ',
				initialOpenAssignProject: true,
				onOpenAssignProject,
			})
		);

		await waitFor(() => expect(onOpenAssignProject).toHaveBeenCalledTimes(1));
	});

	it('listens for open-content events from an already mounted desktop window', async () => {
		const row = item('c4');
		const setPendingOpenContentId = vi.fn();

		renderHook(() =>
			useContentManagerOpenContentEffects({
				items: [row],
				pendingOpenContentId: null,
				setPendingOpenContentId,
				setSelectedIds: vi.fn(),
				setPreviewItem: vi.fn(),
				setError: vi.fn(),
				t: t as never,
			})
		);

		window.dispatchEvent(
			new CustomEvent(CONTENT_MANAGER_OPEN_CONTENT, {
				detail: { contentId: 'c4' },
			})
		);

		await waitFor(() =>
			expect(setPendingOpenContentId).toHaveBeenCalledWith('c4')
		);
	});
});
