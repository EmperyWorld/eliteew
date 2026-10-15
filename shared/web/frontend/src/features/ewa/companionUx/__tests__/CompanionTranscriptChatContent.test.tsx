/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionTranscriptChatContent (U8.3 slice 17).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionTranscriptChatContent } from '@/features/ewa/companionUx/CompanionTranscriptChatContent';

vi.mock('@/features/ewa/companionUx/CompanionUxOnboardingHints', () => ({
	CompanionUxOnboardingHints: () => (
		<div data-testid="onboarding-hints">onboarding</div>
	),
}));

vi.mock('@/features/ewa/companionUx/CompanionTranscriptEmptyState', () => ({
	CompanionTranscriptEmptyState: () => (
		<div data-testid="empty-state">empty</div>
	),
}));

vi.mock('@/features/ewa/companionUx/CompanionTranscriptMessageList', () => ({
	CompanionTranscriptMessageList: () => (
		<div data-testid="message-list">messages</div>
	),
}));

describe('CompanionTranscriptChatContent', () => {
	it('shows Gateway empty state without onboarding stack when transcript is empty', () => {
		render(
			<CompanionTranscriptChatContent
				showOnboardingHints={true}
				companionPrincipalId="parent"
				onOpenTools={vi.fn()}
				onOpenWorkflows={vi.fn()}
				onOpenOperations={vi.fn()}
				empty={true}
				displayName="EWA"
				showLatestReplyHint={false}
				messageListProps={{
					keyedMessages: [],
					streamGrowingAssistant: false,
					reducedMotion: true,
					mobileEmbeddedLayout: false,
					displayName: 'EWA',
					copiedMessageKey: null,
					onCopyAssistantReply: vi.fn(),
					pending: false,
					streamingText: '',
					thinkingHintText: '',
					transcriptProgressItems: [],
					transcriptWorkflowSummaries: [],
					agenticMissionSummaries: [],
					onFocusOperationRun: vi.fn(),
					onDispatchActions: vi.fn(),
				}}
				bottomRef={{ current: null }}
			/>
		);
		expect(screen.queryByTestId('onboarding-hints')).not.toBeInTheDocument();
		expect(screen.getByTestId('empty-state')).toBeInTheDocument();
	});

	it('renders mission narrative instead of empty state when mission context exists', () => {
		render(
			<CompanionTranscriptChatContent
				showOnboardingHints={false}
				companionPrincipalId="parent"
				onOpenTools={vi.fn()}
				onOpenWorkflows={vi.fn()}
				onOpenOperations={vi.fn()}
				empty={true}
				showMissionNarrativeWhenEmpty={true}
				displayName="EWA"
				showLatestReplyHint={false}
				messageListProps={{
					keyedMessages: [],
					streamGrowingAssistant: false,
					reducedMotion: true,
					mobileEmbeddedLayout: false,
					displayName: 'EWA',
					copiedMessageKey: null,
					onCopyAssistantReply: vi.fn(),
					pending: false,
					streamingText: '',
					thinkingHintText: '',
					transcriptProgressItems: [],
					transcriptWorkflowSummaries: [],
					agenticMissionSummaries: [],
					onFocusOperationRun: vi.fn(),
					onDispatchActions: vi.fn(),
				}}
				bottomRef={{ current: null }}
			/>
		);

		expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
		expect(screen.getByTestId('message-list')).toBeInTheDocument();
	});

	it('renders center mission canvas instead of standalone message list on mobile mission context', () => {
		render(
			<CompanionTranscriptChatContent
				showOnboardingHints={true}
				companionPrincipalId="parent"
				onOpenTools={vi.fn()}
				onOpenWorkflows={vi.fn()}
				onOpenOperations={vi.fn()}
				empty={false}
				centerMissionCanvas={
					<div data-testid="center-mission-canvas">mission</div>
				}
				displayName="EWA"
				showLatestReplyHint={false}
				messageListProps={{
					keyedMessages: [],
					streamGrowingAssistant: false,
					reducedMotion: true,
					mobileEmbeddedLayout: true,
					displayName: 'EWA',
					copiedMessageKey: null,
					onCopyAssistantReply: vi.fn(),
					pending: false,
					streamingText: '',
					thinkingHintText: '',
					transcriptProgressItems: [],
					transcriptWorkflowSummaries: [],
					agenticMissionSummaries: [],
					onFocusOperationRun: vi.fn(),
					onDispatchActions: vi.fn(),
				}}
				bottomRef={{ current: null }}
			/>
		);

		expect(screen.getByTestId('center-mission-canvas')).toBeInTheDocument();
		expect(screen.queryByTestId('message-list')).not.toBeInTheDocument();
		expect(screen.queryByTestId('onboarding-hints')).not.toBeInTheDocument();
	});

	it('shows welcome Gateway without onboarding when center mission canvas is absent', () => {
		render(
			<CompanionTranscriptChatContent
				showOnboardingHints={true}
				companionPrincipalId="parent"
				onOpenTools={vi.fn()}
				onOpenWorkflows={vi.fn()}
				onOpenOperations={vi.fn()}
				empty={true}
				centerMissionCanvas={null}
				displayName="EWA"
				showLatestReplyHint={false}
				messageListProps={{
					keyedMessages: [],
					streamGrowingAssistant: false,
					reducedMotion: true,
					mobileEmbeddedLayout: false,
					displayName: 'EWA',
					copiedMessageKey: null,
					onCopyAssistantReply: vi.fn(),
					pending: false,
					streamingText: '',
					thinkingHintText: '',
					transcriptProgressItems: [],
					transcriptWorkflowSummaries: [],
					agenticMissionSummaries: [],
					onFocusOperationRun: vi.fn(),
					onDispatchActions: vi.fn(),
				}}
				bottomRef={{ current: null }}
			/>
		);

		expect(screen.queryByTestId('onboarding-hints')).not.toBeInTheDocument();
		expect(screen.getByTestId('empty-state')).toBeInTheDocument();
	});

	it('keeps onboarding when transcript has messages and Gateway is hidden', () => {
		render(
			<CompanionTranscriptChatContent
				showOnboardingHints={true}
				companionPrincipalId="parent"
				onOpenTools={vi.fn()}
				onOpenWorkflows={vi.fn()}
				onOpenOperations={vi.fn()}
				empty={false}
				displayName="EWA"
				showLatestReplyHint={false}
				messageListProps={{
					keyedMessages: [],
					streamGrowingAssistant: false,
					reducedMotion: true,
					mobileEmbeddedLayout: false,
					displayName: 'EWA',
					copiedMessageKey: null,
					onCopyAssistantReply: vi.fn(),
					pending: false,
					streamingText: '',
					thinkingHintText: '',
					transcriptProgressItems: [],
					transcriptWorkflowSummaries: [],
					agenticMissionSummaries: [],
					onFocusOperationRun: vi.fn(),
					onDispatchActions: vi.fn(),
				}}
				bottomRef={{ current: null }}
			/>
		);

		expect(screen.getByTestId('onboarding-hints')).toBeInTheDocument();
		expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
		expect(screen.getByTestId('message-list')).toBeInTheDocument();
	});
});
