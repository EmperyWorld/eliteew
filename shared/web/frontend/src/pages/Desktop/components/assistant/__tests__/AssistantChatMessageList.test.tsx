/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Presentation tests for Assistant history sidebar and message list error/empty states.
 *
 * Invariants:
 * - History error copy uses i18n historyError / historyRetry keys.
 *
 * Related:
 * - pages/Desktop/components/assistant/AssistantChatHistorySidebar.tsx
 * - pages/Desktop/components/assistant/AssistantChatMessageList.tsx
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AssistantChatHistorySidebar } from '../AssistantChatHistorySidebar';
import { AssistantChatMessageList } from '../AssistantChatMessageList';
import type { AssistantChatMessage } from '../../../services/productDesktopApi';

const t = ((key: string) => key) as Parameters<
	typeof AssistantChatMessageList
>[0]['t'];

function chatMessage(id: string): AssistantChatMessage {
	return {
		id,
		role: 'user',
		content: `message-${id}`,
		created_at: '2026-01-01T00:00:00.000Z',
	};
}

describe('AssistantChatHistorySidebar', () => {
	it('shows sticky prompt without mounting older bubbles when details closed', () => {
		render(
			<AssistantChatHistorySidebar
				olderMessages={[chatMessage('old-1')]}
				t={t}
				renderMessage={(m) => (
					<div data-testid={`msg-${m.id}`}>{m.content}</div>
				)}
			/>
		);
		expect(screen.queryByTestId('msg-old-1')).toBeNull();
		expect(
			document.querySelector('[data-assistant-guide="history-sticky-prompt"]')
		).toBeTruthy();
		expect(screen.queryByTestId('assistant-history-older-messages')).toBeNull();
	});

	it('mounts older bubbles after details opens', () => {
		render(
			<AssistantChatHistorySidebar
				olderMessages={[chatMessage('old-1')]}
				t={t}
				renderMessage={(m) => (
					<div data-testid={`msg-${m.id}`}>{m.content}</div>
				)}
			/>
		);
		fireEvent.click(screen.getByRole('button', { name: /loadMoreHistory/i }));
		expect(screen.getByTestId('assistant-history-older-messages')).toBeTruthy();
		expect(screen.getByTestId('msg-old-1')).toBeTruthy();
	});

	it('renders nothing when older messages are empty', () => {
		const { container } = render(
			<AssistantChatHistorySidebar
				olderMessages={[]}
				t={t}
				renderMessage={() => null}
			/>
		);
		expect(container.firstChild).toBeNull();
	});
});

describe('AssistantChatMessageList', () => {
	const baseProps = {
		bottomRef: createRef<HTMLDivElement>(),
		displayMessages: [] as AssistantChatMessage[],
		olderMessages: [] as AssistantChatMessage[],
		recentMessages: [] as AssistantChatMessage[],
		allVisibleMessages: [] as AssistantChatMessage[],
		messageIndexById: new Map<string, number>(),
		lastPersistedAssistantId: null,
		streamingRaw: '',
		streamingMarkdown: '',
		pendingUserText: null,
		sending: false,
		suggestedFaq: [],
		faqSearch: '',
		faqShowFlashId: null,
		faqInsertFlashId: null,
		faqAskFlashId: null,
		onShowFaqInChat: vi.fn(),
		onInsertFaqQuestion: vi.fn(),
		onTryAskFaq: vi.fn(),
		language: 'en',
		t,
		helpfulAckMessageId: null,
		copiedMessageFlashId: null,
		faqAskDisabled: false,
		rateLimitSecondsLeft: 0,
		onCopyMessageText: vi.fn(),
		onAcknowledgeHelpful: vi.fn(),
		onOpenFeedbackForExchange: vi.fn(),
	};

	it('shows user-facing history error and retry when query fails', () => {
		render(
			<AssistantChatMessageList
				{...baseProps}
				msgQuery={{
					isLoading: false,
					isError: true,
					isFetching: false,
					refetch: vi.fn(),
				}}
			/>
		);
		expect(screen.getByRole('alert')).toBeTruthy();
		expect(screen.getByText('historyError')).toBeTruthy();
		expect(screen.getByText('historyRetry')).toBeTruthy();
	});

	it('shows empty state title and FAQ-first hierarchy when history loaded with no messages', () => {
		const onFocusFaqSearch = vi.fn();
		render(
			<AssistantChatMessageList
				{...baseProps}
				onFocusFaqSearch={onFocusFaqSearch}
				msgQuery={{
					isLoading: false,
					isError: false,
					isFetching: false,
					refetch: vi.fn(),
				}}
			/>
		);
		expect(screen.getByText('emptyTitle')).toBeTruthy();
		expect(screen.getByText('emptyDesc')).toBeTruthy();
		expect(screen.getByText('emptyFaqCta')).toBeTruthy();
		expect(screen.getByText('emptyFeedbackHint')).toBeTruthy();
		expect(
			screen.getByRole('button', { name: 'openFeedbackEmptyAria' })
		).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'emptyFaqCta' }));
		expect(onFocusFaqSearch).toHaveBeenCalledOnce();
	});

	it('hides desktop Feedback Hub footer on embedded mobile empty chat', () => {
		render(
			<AssistantChatMessageList
				{...baseProps}
				embeddedMobileLayout
				onFocusFaqSearch={vi.fn()}
				msgQuery={{
					isLoading: false,
					isError: false,
					isFetching: false,
					refetch: vi.fn(),
				}}
			/>
		);
		expect(screen.getByText('emptyTitle')).toBeTruthy();
		expect(screen.getByText('emptyFaqCta')).toBeTruthy();
		expect(screen.queryByText('emptyFeedbackHint')).toBeNull();
		expect(
			screen.queryByRole('button', { name: 'openFeedbackEmptyAria' })
		).toBeNull();
	});

	it('does not mount older history bubbles while details stay closed', () => {
		const older = [chatMessage('old-1'), chatMessage('old-2')];
		const recent = [chatMessage('recent-1')];
		const allVisible = [...older, ...recent];
		const messageIndexById = new Map(
			allVisible.map((message, index) => [message.id, index])
		);

		render(
			<AssistantChatMessageList
				{...baseProps}
				displayMessages={allVisible}
				olderMessages={older}
				recentMessages={recent}
				allVisibleMessages={allVisible}
				messageIndexById={messageIndexById}
				msgQuery={{
					isLoading: false,
					isError: false,
					isFetching: false,
					refetch: vi.fn(),
				}}
			/>
		);

		expect(screen.queryByText('message-old-1')).toBeNull();
		expect(screen.queryByText('message-old-2')).toBeNull();
		expect(screen.getByText('message-recent-1')).toBeTruthy();
		expect(screen.queryByTestId('assistant-history-older-messages')).toBeNull();
	});
});
