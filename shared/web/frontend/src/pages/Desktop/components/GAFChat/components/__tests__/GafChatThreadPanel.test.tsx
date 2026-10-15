/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Presentation tests for extracted GAF Chat thread panel (empty state, scroll FAB, search).
 *
 * Invariants:
 * - Empty thread copy remains visible when messages array is empty and not loading.
 *
 * Related:
 * - src/pages/Desktop/components/GAFChat/components/GafChatThreadPanel.tsx
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { GafChatThreadPrefs } from '../../gafChatThreadPrefs';
import { GafChatThreadPanel } from '../GafChatThreadPanel';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		i18n: { language: 'en' },
		t: (key: string) => key,
	}),
}));

vi.mock('../../gafChatMapUserError', () => ({
	mapGafChatUserError: (
		error: unknown,
		t: (key: string) => string,
		context?: string
	) => {
		if (error instanceof Error && error.message.trim()) {
			return error.message;
		}
		return context === 'messages'
			? t('messagesLoadErrorFallback')
			: t('toastSendFailed');
	},
}));

vi.mock('../../GafChatVirtualizedThread', () => ({
	GafChatVirtualizedThread: () => <div data-testid="virtualized-thread" />,
}));

vi.mock('./GafChatThreadSettingsPopover', () => ({
	GafChatThreadSettingsPopover: () => <div data-testid="thread-settings" />,
}));

vi.mock('./GAFChatE2eeReadinessBanner', () => ({
	GAFChatE2eeReadinessBanner: () => null,
}));

const defaultPrefs: GafChatThreadPrefs = {
	loadMedia: true,
	showMediaPreview: true,
};

const partner = {
	id: 'user-2',
	username: 'alice',
	avatar_url: null,
	full_name: 'Alice',
	is_muted: false,
	is_blocked: false,
	blocked_by_partner: false,
};

const baseProps = {
	shellFrame: 'glass' as const,
	selectedChatId: 'chat-1',
	partner,
	chatMuted: false,
	chatBlocked: false,
	threadPrefs: defaultPrefs,
	onThreadPrefsChange: vi.fn(),
	showE2eeReadinessBanner: false,
	onSetupE2eeKeys: vi.fn(),
	onDismissE2eeReadinessBanner: vi.fn(),
	messageListRef: createRef<HTMLDivElement>(),
	loadMoreSentinelRef: createRef<HTMLDivElement>(),
	onMessageListScroll: vi.fn(),
	showScrollDown: false,
	onScrollToBottom: vi.fn(),
	messagesLoading: false,
	messagesError: false,
	messagesErrorDismissed: false,
	messagesQueryError: null,
	onRefetchMessages: vi.fn(),
	onDismissMessagesError: vi.fn(),
	messages: [],
	messageById: new Map(),
	hasNextPage: false,
	isFetchingNextPage: false,
	onLoadOlder: vi.fn(),
	myUserId: 'user-1',
	meLabel: 'Me',
	partnerLastReadIndex: -1,
	threadSearchQuery: '',
	onThreadSearchQueryChange: vi.fn(),
	threadSearchInputRef: createRef<HTMLInputElement>(),
	threadSearchTrimmed: '',
	threadMatchIds: [],
	threadMatchIndex: 0,
	onPrevThreadMatch: vi.fn(),
	onNextThreadMatch: vi.fn(),
	scrollToMessageId: null,
	onConsumedScrollToMessage: vi.fn(),
	onCopyPlainText: vi.fn(),
	onAcceptAttachment: vi.fn(),
	acceptBusyMessageId: null,
	onReply: vi.fn(),
	onJumpToMessage: vi.fn(),
	onEditMessage: vi.fn(),
	onDeleteMessageForMe: vi.fn(),
	onDeleteMessageForEveryone: vi.fn(),
};

describe('GafChatThreadPanel', () => {
	it('shows empty thread state when there are no messages', () => {
		render(<GafChatThreadPanel {...baseProps} />);
		expect(screen.getByText('emptyThreadTitle')).toBeInTheDocument();
		expect(screen.getByText('emptyThreadDescription')).toBeInTheDocument();
	});

	it('shows scroll-to-bottom control when parent reports off-bottom', () => {
		render(<GafChatThreadPanel {...baseProps} showScrollDown />);
		expect(
			screen.getByRole('button', { name: 'scrollToBottom' })
		).toBeInTheDocument();
	});

	it('calls onScrollToBottom when scroll FAB is clicked', () => {
		const onScrollToBottom = vi.fn();
		render(
			<GafChatThreadPanel
				{...baseProps}
				showScrollDown
				onScrollToBottom={onScrollToBottom}
			/>
		);
		fireEvent.click(screen.getByRole('button', { name: 'scrollToBottom' }));
		expect(onScrollToBottom).toHaveBeenCalledTimes(1);
	});

	it('exposes id and name on the in-thread search input', () => {
		render(<GafChatThreadPanel {...baseProps} />);
		const search = screen.getByLabelText('threadSearchAria');
		expect(search).toHaveAttribute('id');
		expect(search).toHaveAttribute('name', 'gaf-chat-thread-search');
	});

	it('shows thread search no-matches copy when query has no hits', () => {
		render(
			<GafChatThreadPanel
				{...baseProps}
				threadSearchQuery="hello"
				threadSearchTrimmed="hello"
				threadMatchIds={[]}
			/>
		);
		expect(screen.getByText('threadSearchNoMatches')).toBeInTheDocument();
	});

	it('hides scroll FAB while in-thread search is active', () => {
		render(
			<GafChatThreadPanel
				{...baseProps}
				showScrollDown
				threadSearchTrimmed="hello"
			/>
		);
		expect(
			screen.queryByRole('button', { name: 'scrollToBottom' })
		).not.toBeInTheDocument();
	});

	it('shows E2EE-pending empty thread copy', () => {
		render(<GafChatThreadPanel {...baseProps} e2eeStatusValue="pending" />);
		expect(screen.getByText('emptyThreadE2eePendingTitle')).toBeInTheDocument();
	});
});
