/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Presentation tests for sidebar thread list empty/error branches.
 *
 * Related:
 * - GafChatSidebarThreadList.tsx
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GafChatSidebarThreadListProps } from '../GafChatSidebarThreadList';
import { GafChatSidebarThreadList } from '../GafChatSidebarThreadList';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

const baseProps: GafChatSidebarThreadListProps = {
	sidebarCollapsed: false,
	chatsLoading: false,
	chatsError: false,
	chats: [],
	filteredChats: [],
	searchQuery: '',
	sidebarFilter: 'all' as const,
	selectedChatId: null,
	onSelectChat: vi.fn(),
	chatListRowRefs: { current: [] as (HTMLButtonElement | null)[] },
	pinnedChatIds: [],
	onTogglePin: vi.fn(),
	onPrefetchThread: vi.fn(),
};

vi.mock('../../GAFChatSidebarRow', () => ({
	GAFChatSidebarRow: () => null,
}));

describe('GafChatSidebarThreadList', () => {
	it('shows chats load error empty state with retry', () => {
		const onRefetchChats = vi.fn();
		render(
			<GafChatSidebarThreadList
				{...baseProps}
				chatsError
				onRefetchChats={onRefetchChats}
			/>
		);
		expect(screen.getByText('sidebarChatsLoadErrorTitle')).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'errorBarRetry' }));
		expect(onRefetchChats).toHaveBeenCalled();
	});

	it('shows collapsed empty hint when inbox is empty', () => {
		render(
			<GafChatSidebarThreadList
				{...baseProps}
				sidebarCollapsed
				filteredChats={[]}
			/>
		);
		expect(screen.getByRole('status')).toBeTruthy();
	});
});
