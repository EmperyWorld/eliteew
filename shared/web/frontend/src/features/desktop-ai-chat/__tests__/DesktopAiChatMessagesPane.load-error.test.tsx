/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Verify messages-pane error recovery and assistant reply routing into conversational or expert-document presentation.
 *
 * Invariants:
 * - Blueprint routing remains separate from generic expert-document detection.
 * - Short replies with contract metadata stay in the conversational renderer.
 *
 * Related:
 * - src/features/desktop-ai-chat/components/DesktopAiChatMessagesPane.tsx
 * - src/features/desktop-ai-chat/DesktopAiExpertAnswerDocument.tsx
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DESKTOP_AI_CHAT_MESSAGES_ERROR_TESTID } from '../desktopAiChatDomIds';
import { DesktopAiChatMessagesPane } from '../components/DesktopAiChatMessagesPane';

vi.mock('../layout/DesktopAiChatStatePanel', () => ({
	DesktopAiChatStatePanel: ({
		title,
		description,
		onRetry,
		retryLabel,
	}: {
		title?: React.ReactNode;
		description?: React.ReactNode;
		onRetry?: () => void;
		retryLabel?: string;
	}) => (
		<div>
			<div>{title}</div>
			<div>{description}</div>
			{onRetry ? (
				<button type="button" onClick={onRetry}>
					{retryLabel ?? 'retry'}
				</button>
			) : null}
		</div>
	),
}));

vi.mock('../components/desktopAiChatIconTooltip', () => ({
	DesktopAiChatIconTooltip: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
}));

vi.mock('../DesktopAiExpertAnswerDocument', () => ({
	DesktopAiExpertAnswerDocument: ({
		evidenceSources,
		sources,
	}: {
		evidenceSources?: Array<{ url?: string }>;
		sources?: Array<{ url: string }>;
	}) => (
		<div
			data-testid="expert-document-renderer"
			data-source-count={String(
				evidenceSources?.length ?? sources?.length ?? 0
			)}
		/>
	),
}));

vi.mock('../DesktopAiCollapsibleAssistantMarkdown', () => ({
	DesktopAiCollapsibleAssistantMarkdown: () => (
		<div data-testid="conversation-renderer" />
	),
}));

vi.mock('../DesktopAiBlueprintArtifactBubble', () => ({
	DesktopAiBlueprintArtifactBubble: ({
		sources,
	}: {
		sources?: Array<{ url: string }>;
	}) => (
		<div
			data-testid="blueprint-renderer"
			data-source-count={sources?.length ?? 0}
		/>
	),
}));

vi.mock('../components/DesktopAiWebSearchSources', () => ({
	DesktopAiWebSearchSources: ({
		sources,
	}: {
		sources: Array<{ url: string }>;
	}) => <div data-testid="standalone-sources">{sources.length}</div>,
}));

const t = ((key: string) =>
	key) as import('i18next').TFunction<'desktopAiChat'>;

function minimalProps(
	overrides: Partial<
		React.ComponentProps<typeof DesktopAiChatMessagesPane>
	> = {}
) {
	return {
		scrollRef: { current: null },
		messagesRegionId: 'desktop-ai-chat-messages',
		messagesTestId: 'desktop-ai-chat-messages',
		shellMessagesPanelClass: 'panel',
		showLoadOlderMessages: false,
		messages: [],
		messagesTotal: null,
		messagesLoadingOlder: false,
		onLoadOlderMessages: vi.fn(),
		loadingList: false,
		activeId: 'chat-1',
		chatsCount: 1,
		messagesLoading: false,
		messagesLoadState: 'error' as const,
		onRetryLoadMessages: vi.fn(),
		sending: false,
		isEnsembleActive: false,
		ensembleRosterSubtitle: '',
		messageListEntries: [],
		activeChat: null,
		activeHeroId: null,
		assistantHeaderLabel: 'Assistant',
		ensembleDocConfirm: null,
		soloSendsBlocked: false,
		canRegenerate: true,
		canDeleteMessages: true,
		isSharedChat: false,
		currentUserId: 'viewer-1',
		webSearchSourcesByMessageId: {},
		saveBlueprintToProjectBusyId: null,
		showScrollDown: false,
		lowGpu: false,
		onMessagesScroll: vi.fn(),
		scrollMessagesToBottom: vi.fn(),
		onRegenerate: vi.fn(),
		onCopyBubble: vi.fn(),
		onDeleteUserMessage: vi.fn(),
		onSaveBlueprintToProject: vi.fn(),
		onExportAssistantMarkdown: vi.fn(),
		onOpenBubbleHeroDossier: vi.fn(),
		onBubbleContextMenu: vi.fn(),
		i18nLanguage: 'en',
		lucideStroke: 1.5,
		onOpenNewChat: vi.fn(),
		onFocusComposer: vi.fn(),
		t,
		...overrides,
	};
}

describe('DesktopAiChatMessagesPane load error', () => {
	it('renders inline error panel with retry', () => {
		const onRetry = vi.fn();
		render(
			<DesktopAiChatMessagesPane
				{...minimalProps({ onRetryLoadMessages: onRetry })}
			/>
		);
		expect(
			screen.getByTestId(DESKTOP_AI_CHAT_MESSAGES_ERROR_TESTID)
		).toBeTruthy();
		expect(screen.getByText('messagesLoadErrorInline')).toBeTruthy();
		expect(screen.getByText('messagesLoadErrorInlineHint')).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'messagesLoadRetry' }));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});
});

describe('DesktopAiChatMessagesPane assistant presentation routing', () => {
	it('routes a structured non-blueprint answer into the expert document renderer', () => {
		const message = {
			id: 'assistant-expert-1',
			role: 'assistant',
			content:
				'## Вывод\n\nПредметный ответ.\n\n## Следующие шаги\n\n1. Проверить.',
			metadata: {
				desktop_expert_reply_contract: 'expert-document-v1',
				desktop_web_search_sources: [
					{ url: 'https://example.com/evidence' },
					{ url: 'https://example.com/second-source' },
				],
			},
			created_at: '2026-07-29T00:00:00Z',
		};

		render(
			<DesktopAiChatMessagesPane
				{...minimalProps({
					messages: [message],
					messagesLoadState: 'ready',
					messageListEntries: [
						{ kind: 'msg', msg: message, compactTop: false },
					],
					webSearchSourcesByMessageId: {
						[message.id]: [{ url: 'https://example.com/evidence' }],
					},
				})}
			/>
		);

		expect(
			screen.getByTestId('expert-document-renderer').dataset.sourceCount
		).toBe('2');
		expect(screen.queryByTestId('conversation-renderer')).toBeNull();
		expect(screen.queryByTestId('standalone-sources')).toBeNull();
	});

	it('keeps a short contract-tagged answer in the conversational renderer', () => {
		const message = {
			id: 'assistant-short-1',
			role: 'assistant',
			content: 'Спасибо, договорились.',
			metadata: {
				desktop_expert_reply_contract: 'expert-document-v1',
			},
			created_at: '2026-07-29T00:00:00Z',
		};

		render(
			<DesktopAiChatMessagesPane
				{...minimalProps({
					messages: [message],
					messagesLoadState: 'ready',
					messageListEntries: [
						{ kind: 'msg', msg: message, compactTop: false },
					],
					webSearchSourcesByMessageId: {
						[message.id]: [{ url: 'https://example.com/evidence' }],
					},
				})}
			/>
		);

		expect(screen.getByTestId('conversation-renderer')).toBeTruthy();
		expect(screen.queryByTestId('expert-document-renderer')).toBeNull();
		expect(screen.getByTestId('standalone-sources')).toBeTruthy();
	});

	it('keeps blueprint metadata on the dedicated artifact renderer', () => {
		const message = {
			id: 'assistant-blueprint-1',
			role: 'assistant',
			content: '## Раздел один\n\nТекст.\n\n## Раздел два\n\nТекст.',
			metadata: {
				desktop_ensemble_blueprint: true,
				desktop_expert_reply_contract: 'expert-document-v1',
			},
			created_at: '2026-07-29T00:00:00Z',
		};

		render(
			<DesktopAiChatMessagesPane
				{...minimalProps({
					messages: [message],
					messagesLoadState: 'ready',
					messageListEntries: [
						{ kind: 'msg', msg: message, compactTop: false },
					],
					webSearchSourcesByMessageId: {
						[message.id]: [{ url: 'https://example.com/evidence' }],
					},
				})}
			/>
		);

		expect(screen.getByTestId('blueprint-renderer').dataset.sourceCount).toBe(
			'1'
		);
		expect(screen.queryByTestId('expert-document-renderer')).toBeNull();
		expect(screen.queryByTestId('standalone-sources')).toBeNull();
	});

	it('keeps streaming chrome while sending or finalizing even with blueprint metadata', () => {
		const message = {
			id: 'assistant-live-1',
			role: 'assistant',
			content: '## Раздел один\n\nТекст.\n\n## Раздел два\n\nТекст.',
			metadata: {
				desktop_ensemble_blueprint: true,
				plan_template_id: 'project_audit_v1',
				desktop_stream_finalizing: true,
			},
			created_at: '2026-07-29T00:00:00Z',
		};

		const { rerender } = render(
			<DesktopAiChatMessagesPane
				{...minimalProps({
					sending: true,
					messages: [message],
					messagesLoadState: 'ready',
					messageListEntries: [
						{ kind: 'msg', msg: message, compactTop: false },
					],
				})}
			/>
		);

		expect(screen.getByTestId('conversation-renderer')).toBeTruthy();
		expect(screen.queryByTestId('blueprint-renderer')).toBeNull();

		rerender(
			<DesktopAiChatMessagesPane
				{...minimalProps({
					sending: false,
					messages: [message],
					messagesLoadState: 'ready',
					messageListEntries: [
						{ kind: 'msg', msg: message, compactTop: false },
					],
				})}
			/>
		);

		expect(screen.getByTestId('conversation-renderer')).toBeTruthy();
		expect(screen.queryByTestId('blueprint-renderer')).toBeNull();
	});
});
