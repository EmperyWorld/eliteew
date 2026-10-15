/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for GAF Chat sidebar list filtering hook.
 *
 * Invariants:
 * - Unread filter and deferred search narrow filteredChats without mutating source chats.
 *
 * Related:
 * - src/pages/Desktop/components/GAFChat/hooks/useGafChatSidebarList.ts
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GAFChatListItem } from '../../types';
import { useGafChatSidebarList } from '../useGafChatSidebarList';

vi.mock('@/i18n/config', () => ({}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@tanstack/react-query', () => ({
	useQueryClient: () => ({
		prefetchInfiniteQuery: vi.fn(),
		removeQueries: vi.fn(),
	}),
}));

const sampleChat = (
	id: string,
	unread: number,
	preview: string
): GAFChatListItem => ({
	chat_id: id,
	partner: {
		id: `user-${id}`,
		username: id,
		avatar_url: null,
		full_name: id,
		is_muted: false,
		is_blocked: false,
		blocked_by_partner: false,
	},
	last_message_at: null,
	last_message_preview: preview,
	unread_count: unread,
});

describe('useGafChatSidebarList', () => {
	it('filters to unread chats when sidebarFilter is unread', () => {
		const chats = [sampleChat('a', 2, 'hello'), sampleChat('b', 0, 'quiet')];
		const chatListRowRefs = { current: [] as (HTMLButtonElement | null)[] };

		const { result } = renderHook(() =>
			useGafChatSidebarList({
				myUserId: 'me',
				chats,
				searchQuery: '',
				sidebarFilter: 'unread',
				pinnedChatIds: [],
				setPinnedChatIds: vi.fn(),
				selectedChatId: null,
				setSelectedChatId: vi.fn(),
				chatListRowRefs,
			})
		);

		expect(result.current.filteredChats.map((c) => c.chat_id)).toEqual(['a']);
	});

	it('matches search against partner name and preview haystack', () => {
		const chats = [
			sampleChat('a', 0, 'project alpha'),
			sampleChat('b', 0, 'other'),
		];
		const chatListRowRefs = { current: [] as (HTMLButtonElement | null)[] };

		const { result } = renderHook(() =>
			useGafChatSidebarList({
				myUserId: 'me',
				chats,
				searchQuery: 'alpha',
				sidebarFilter: 'all',
				pinnedChatIds: [],
				setPinnedChatIds: vi.fn(),
				selectedChatId: null,
				setSelectedChatId: vi.fn(),
				chatListRowRefs,
			})
		);

		expect(result.current.filteredChats.map((c) => c.chat_id)).toEqual(['a']);
	});
});
