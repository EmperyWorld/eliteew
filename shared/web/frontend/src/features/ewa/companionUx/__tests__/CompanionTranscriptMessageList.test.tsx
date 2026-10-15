/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionTranscriptMessageList (U8.3 slice 15).
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionTranscriptMessageList } from '@/features/ewa/companionUx/CompanionTranscriptMessageList';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';

vi.mock('@/features/ewa/companionUx/CompanionTranscriptMessageRow', () => ({
	CompanionTranscriptMessageRow: ({
		row,
	}: {
		row: { key: string; message: { content: string } };
	}) => <li data-testid="message-row">{row.message.content}</li>,
}));

vi.mock('@/features/ewa/companionUx/CompanionTranscriptThinkingBubble', () => ({
	CompanionTranscriptThinkingBubble: () => (
		<li data-testid="thinking-bubble">thinking</li>
	),
}));

vi.mock(
	'@/features/ewa/companionOperations/InTranscriptProgressBanner',
	() => ({
		InTranscriptProgressBanner: () => null,
	})
);

vi.mock('@/features/ewa/companionOperations/WorkflowCompletionSummary', () => ({
	WorkflowCompletionSummary: () => null,
}));

vi.mock(
	'@/features/ewa/companionOperations/CompanionAgenticSessionArtifacts',
	() => ({
		CompanionAgenticSessionArtifacts: ({
			documents,
		}: {
			documents: Array<{ name: string }>;
		}) => (
			<div data-testid="agentic-artifacts">
				{documents.map((doc) => doc.name).join(', ')}
			</div>
		),
	})
);

vi.mock('@/features/ewa/companionUx/CompanionActivityCenterStrip', () => ({
	CompanionActivityCenterStrip: ({
		items,
		onFocusRun,
	}: {
		items: Array<{ runId: string; title: string; subtitle?: string }>;
		onFocusRun: (runId: string) => void;
	}) => {
		if (items.length === 0) return null;
		const primary = items[0];
		return (
			<div data-testid="ewa-companion-activity-center">
				<button type="button" onClick={() => onFocusRun(primary.runId)}>
					{primary.subtitle || primary.title}
				</button>
				<span>{primary.title}</span>
			</div>
		);
	},
}));

function makeRun(
	overrides: Partial<EwaCompanionTaskRun> = {}
): EwaCompanionTaskRun {
	return {
		id: 'run-confirm',
		principal_id: 'p1',
		status: 'awaiting_confirmation',
		intent_kind: 'agentic_session',
		user_message: 'нужен ответ',
		plan_payload: {},
		confirmation_state: {},
		result_payload: {},
		error_payload: {},
		execution_mode: 'async',
		created_at: null,
		updated_at: null,
		completed_at: null,
		run_revision: 1,
		...overrides,
	};
}

describe('CompanionTranscriptMessageList', () => {
	it('renders keyed messages and thinking bubble while pending', () => {
		render(
			<CompanionTranscriptMessageList
				keyedMessages={[
					{ key: 'u1', message: { role: 'user', content: 'Hi' } },
				]}
				streamGrowingAssistant={false}
				reducedMotion={true}
				mobileEmbeddedLayout={false}
				displayName="EWA"
				copiedMessageKey={null}
				onCopyAssistantReply={vi.fn()}
				pending={true}
				streamingText=""
				thinkingHintText="Thinking…"
				transcriptProgressItems={[]}
				transcriptWorkflowSummaries={[]}
				agenticMissionSummaries={[]}
				onFocusOperationRun={vi.fn()}
				onDispatchActions={vi.fn()}
			/>
		);
		expect(screen.getByTestId('message-row')).toHaveTextContent('Hi');
		expect(screen.getByTestId('thinking-bubble')).toBeInTheDocument();
	});

	it('renders desktop confirmation as a single inline chat decision block', () => {
		const onConfirmOperationRun = vi.fn();
		render(
			<CompanionTranscriptMessageList
				keyedMessages={[
					{ key: 'a1', message: { role: 'assistant', content: 'Started' } },
				]}
				streamGrowingAssistant={false}
				reducedMotion={true}
				mobileEmbeddedLayout={false}
				displayName="Tala"
				copiedMessageKey={null}
				onCopyAssistantReply={vi.fn()}
				pending={false}
				streamingText=""
				thinkingHintText="Thinking…"
				transcriptProgressItems={[
					{
						runId: 'run-confirm',
						intentKind: 'agentic_session',
						title: 'нужен ответ',
						current: 0,
						total: 1,
						status: 'active',
					},
				]}
				transcriptWorkflowSummaries={[]}
				agenticMissionSummaries={[]}
				awaitingConfirmationRuns={[makeRun()]}
				confirmBusyRunId={null}
				onFocusOperationRun={vi.fn()}
				onConfirmOperationRun={onConfirmOperationRun}
				onDispatchActions={vi.fn()}
			/>
		);

		const decision = screen.getByTestId('ewa-companion-inline-confirmation');
		fireEvent.click(
			within(decision).getByRole('button', {
				name: /Подтвердить|Confirm|ewaCompanion\.operationConfirm/i,
			})
		);

		expect(onConfirmOperationRun).toHaveBeenCalledWith(
			'run-confirm',
			'confirm'
		);
		expect(
			screen.queryByTestId('ewa-companion-task-progress-banner')
		).not.toBeInTheDocument();
		expect(
			screen.queryByTestId('ewa-companion-activity-center')
		).not.toBeInTheDocument();
	});

	it('renders agentic gate prompt in fallback confirmation hub', () => {
		render(
			<CompanionTranscriptMessageList
				keyedMessages={[
					{ key: 'a1', message: { role: 'assistant', content: 'Started' } },
				]}
				streamGrowingAssistant={false}
				reducedMotion={true}
				mobileEmbeddedLayout={false}
				displayName="Tala"
				copiedMessageKey={null}
				onCopyAssistantReply={vi.fn()}
				pending={false}
				streamingText=""
				thinkingHintText="Thinking…"
				transcriptProgressItems={[]}
				transcriptWorkflowSummaries={[]}
				agenticMissionSummaries={[]}
				awaitingConfirmationRuns={[
					makeRun({
						confirmation_state: {
							state: 'confirming',
							gate: {
								kind: 'confirm',
								title: 'Agentic decision',
								prompt: 'Create the mission document?',
								pending_tool: 'file_create',
								companion_pending_task_run_id: 'doc-run-1',
							},
						},
					}),
				]}
				confirmBusyRunId={null}
				onFocusOperationRun={vi.fn()}
				onConfirmOperationRun={vi.fn()}
				onDispatchActions={vi.fn()}
			/>
		);

		expect(screen.getByText('Agentic decision')).toBeInTheDocument();
		expect(
			screen.getByText('Create the mission document?')
		).toBeInTheDocument();
		expect(
			screen.getByText(
				'Подтверждайте здесь — это шаг агентной миссии, не отдельная операция.'
			)
		).toBeInTheDocument();
	});

	it('renders sticky desktop activity strip for active mission without task cards', () => {
		const onFocusOperationRun = vi.fn();
		render(
			<CompanionTranscriptMessageList
				keyedMessages={[
					{ key: 'a1', message: { role: 'assistant', content: 'Started' } },
				]}
				streamGrowingAssistant={false}
				reducedMotion={true}
				mobileEmbeddedLayout={false}
				displayName="Tala"
				copiedMessageKey={null}
				onCopyAssistantReply={vi.fn()}
				pending={false}
				streamingText=""
				thinkingHintText="Thinking…"
				transcriptProgressItems={[
					{
						runId: 'run-active',
						intentKind: 'agentic_session',
						title: 'Стратегия EliteEW',
						subtitle: 'Выполняется · Поиск материалов',
						current: 1,
						total: 3,
						status: 'active',
					},
				]}
				transcriptWorkflowSummaries={[]}
				agenticMissionSummaries={[]}
				onFocusOperationRun={onFocusOperationRun}
				onDispatchActions={vi.fn()}
			/>
		);

		const strip = screen.getByTestId('ewa-companion-activity-center');
		expect(strip).toHaveTextContent('Стратегия EliteEW');
		expect(strip).toHaveTextContent('Поиск материалов');
		expect(
			screen.queryByTestId('ewa-companion-task-progress-banner')
		).not.toBeInTheDocument();

		fireEvent.click(within(strip).getByRole('button'));
		expect(onFocusOperationRun).toHaveBeenCalledWith('run-active');
	});

	it('renders mission artifacts summary in transcript narrative', () => {
		render(
			<CompanionTranscriptMessageList
				keyedMessages={[]}
				streamGrowingAssistant={false}
				reducedMotion={true}
				mobileEmbeddedLayout={false}
				displayName="Tala"
				copiedMessageKey={null}
				onCopyAssistantReply={vi.fn()}
				pending={false}
				streamingText=""
				thinkingHintText="Thinking…"
				transcriptProgressItems={[]}
				transcriptWorkflowSummaries={[]}
				agenticMissionSummaries={[
					{
						runId: 'run-mission',
						title: 'Пакет документов',
						subtitle: 'completed',
						status: 'completed',
						documents: [
							{ unifiedContentId: 'uc-1', name: 'правила.txt' },
							{ unifiedContentId: 'uc-2', name: 'roadmap.md' },
						],
					},
				]}
				onFocusOperationRun={vi.fn()}
				onDispatchActions={vi.fn()}
			/>
		);

		expect(
			screen.getByTestId('ewa-companion-mission-artifacts')
		).toHaveTextContent('Пакет документов');
		expect(screen.getByTestId('agentic-artifacts')).toHaveTextContent(
			'правила.txt, roadmap.md'
		);
	});

	it('suppresses mission chrome when center canvas owns the mission surface', () => {
		render(
			<CompanionTranscriptMessageList
				keyedMessages={[
					{
						key: 'a1',
						message: { role: 'assistant', content: 'Context reply' },
					},
				]}
				streamGrowingAssistant={false}
				reducedMotion={true}
				mobileEmbeddedLayout={false}
				displayName="Tala"
				copiedMessageKey={null}
				onCopyAssistantReply={vi.fn()}
				pending={false}
				streamingText=""
				thinkingHintText="Thinking…"
				transcriptProgressItems={[
					{
						runId: 'run-active',
						intentKind: 'agentic_session',
						title: 'Стратегия',
						current: 1,
						total: 3,
						status: 'active',
					},
				]}
				transcriptWorkflowSummaries={[]}
				agenticMissionSummaries={[
					{
						runId: 'run-mission',
						title: 'Пакет документов',
						subtitle: 'completed',
						status: 'completed',
						documents: [{ unifiedContentId: 'uc-1', name: 'правила.txt' }],
					},
				]}
				awaitingConfirmationRuns={[makeRun()]}
				onFocusOperationRun={vi.fn()}
				onDispatchActions={vi.fn()}
				showMissionChrome={false}
			/>
		);

		expect(
			screen.queryByTestId('ewa-companion-inline-confirmation')
		).not.toBeInTheDocument();
		expect(
			screen.queryByTestId('ewa-companion-activity-center')
		).not.toBeInTheDocument();
		expect(
			screen.queryByTestId('ewa-companion-mission-artifacts')
		).not.toBeInTheDocument();
		expect(screen.getByTestId('message-row')).toHaveTextContent(
			'Context reply'
		);
	});
});
