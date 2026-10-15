/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Presentation tests for extracted GAF Chat sidebar panel (filters, collapse, list).
 *
 * Invariants:
 * - Unread filter toggle calls parent handler without duplicating filter logic.
 *
 * Related:
 * - src/pages/Desktop/components/GAFChat/components/GafChatSidebarPanel.tsx
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GAFChatListItem } from '../../types';
import type { GafChatSidebarPanelProps } from '../GafChatSidebarPanel';
import { GafChatSidebarPanel } from '../GafChatSidebarPanel';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		i18n: { language: 'en' },
		t: (key: string) => key,
	}),
}));

vi.mock('../../GAFChatSidebarRow', () => ({
	GAFChatSidebarRow: ({
		chat,
		onSelect,
	}: {
		chat: GAFChatListItem;
		onSelect: (id: string) => void;
	}) => (
		<button type="button" onClick={() => onSelect(chat.chat_id)}>
			{chat.chat_id}
		</button>
	),
}));

vi.mock('./GAFChatSkeletons', () => ({
	GAFChatSidebarSkeleton: () => <div data-testid="sidebar-skeleton" />,
}));

const sampleChat: GAFChatListItem = {
	chat_id: 'chat-1',
	partner: {
		id: 'user-2',
		username: 'alice',
		avatar_url: null,
		full_name: 'Alice',
		is_muted: false,
		is_blocked: false,
		blocked_by_partner: false,
	},
	last_message_at: null,
	last_message_preview: null,
	unread_count: 2,
	e2ee_status: 'off',
	e2ee_ready: false,
};

const baseProps: GafChatSidebarPanelProps = {
	shellNavAsideClass: 'nav-aside',
	shellFrame: 'glass' as const,
	shellSidebarSearchRowClass: 'search-row',
	shellSidebarSearchInputClass: 'search-input',
	sidebarCollapsed: false,
	sidebarCollapsePersisting: false,
	toggleSidebarCollapsed: vi.fn(),
	sidebarSearchInputRef: { current: null },
	searchQuery: '',
	onSearchQueryChange: vi.fn(),
	sidebarFilter: 'all' as const,
	onSidebarFilterChange: vi.fn(),
	chatsLoading: false,
	chatsError: false,
	chats: [sampleChat],
	filteredChats: [sampleChat],
	selectedChatId: null,
	onSelectChat: vi.fn(),
	chatListRowRefs: { current: [] as (HTMLButtonElement | null)[] },
	pinnedChatIds: [] as string[],
	onTogglePin: vi.fn(),
	onPrefetchThread: vi.fn(),
};

describe('GafChatSidebarPanel', () => {
	it('renders search and unread filter when expanded', () => {
		render(<GafChatSidebarPanel {...baseProps} />);

		const search = screen.getByLabelText('sidebarSearchAria');
		expect(search).toBeInTheDocument();
		expect(search).toHaveAttribute('id');
		expect(search).toHaveAttribute('name', 'gaf-chat-sidebar-search');
		expect(
			screen.getByRole('button', { name: 'sidebarFilterUnread' })
		).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'chat-1' })).toBeInTheDocument();
	});

	it('calls onSidebarFilterChange when unread filter is pressed', () => {
		const onSidebarFilterChange = vi.fn();
		render(
			<GafChatSidebarPanel
				{...baseProps}
				onSidebarFilterChange={onSidebarFilterChange}
			/>
		);

		fireEvent.click(
			screen.getByRole('button', { name: 'sidebarFilterUnread' })
		);

		expect(onSidebarFilterChange).toHaveBeenCalledWith('unread');
	});

	it('hides search row when sidebar is collapsed', () => {
		render(<GafChatSidebarPanel {...baseProps} sidebarCollapsed />);

		expect(
			screen.queryByLabelText('sidebarSearchAria')
		).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'chat-1' })).toBeInTheDocument();
	});
});
