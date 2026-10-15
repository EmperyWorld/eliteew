/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Transcript message list, thinking bubble, in-chat operation banners, and activity strip (U8.3 slice 15).
 *
 * Invariants:
 * - Parent owns empty/onboarding chrome; this component renders the non-empty transcript body.
 *
 * Related:
 * - src/features/ewa/companionOperations/InTranscriptProgressBanner.tsx
 * - src/features/ewa/companionOperations/WorkflowCompletionSummary.tsx
 */

import { InTranscriptProgressBanner } from '@/features/ewa/companionOperations/InTranscriptProgressBanner';
import { AgenticGatePrompt } from '@/features/ewa/agentic/AgenticGatePrompt';
import { parseAgenticGateFromRun } from '@/features/ewa/agentic/agenticGateUtils';
import { CompanionAgenticSessionArtifacts } from '@/features/ewa/companionOperations/CompanionAgenticSessionArtifacts';
import { CompanionConfirmBar } from '@/features/ewa/companionOperations/CompanionConfirmBar';
import { WorkflowCompletionSummary } from '@/features/ewa/companionOperations/WorkflowCompletionSummary';
import type {
	AgenticMissionSummaryItem,
	CompanionTranscriptProgressItem,
	WorkflowCompletionSummaryItem,
} from '@/features/ewa/companionOperations/companionOperationsUi';
import {
	normalizeCompanionOperationStatus,
	operationDetailLabel,
	operationIntentLabel,
	isAgenticSessionRun,
} from '@/features/ewa/companionOperations/companionOperationsUi';
import { CompanionActivityCenterStrip } from '@/features/ewa/companionUx/CompanionActivityCenterStrip';
import {
	CompanionTranscriptMessageRow,
	type CompanionTranscriptKeyedMessage,
} from '@/features/ewa/companionUx/CompanionTranscriptMessageRow';
import { CompanionTranscriptThinkingBubble } from '@/features/ewa/companionUx/CompanionTranscriptThinkingBubble';
import { CompanionPendingReloadBanner } from '@/features/ewa/companionUx/CompanionPendingReloadBanner';
import type { CompanionChatAction } from '@/services/ewa/ewaCompanionChatApi';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';

export type CompanionTranscriptMessageListProps = {
	keyedMessages: readonly CompanionTranscriptKeyedMessage[];
	streamGrowingAssistant: boolean;
	reducedMotion: boolean;
	mobileEmbeddedLayout: boolean;
	displayName: string;
	copiedMessageKey: string | null;
	onCopyAssistantReply: (content: string, messageKey: string) => void;
	pending: boolean;
	streamingText: string;
	thinkingHintText: string;
	transcriptProgressItems: readonly CompanionTranscriptProgressItem[];
	transcriptWorkflowSummaries: readonly WorkflowCompletionSummaryItem[];
	agenticMissionSummaries?: readonly AgenticMissionSummaryItem[];
	awaitingConfirmationRuns?: readonly EwaCompanionTaskRun[];
	confirmBusyRunId?: string | null;
	onFocusOperationRun: (runId: string) => void;
	onConfirmOperationRun?: (
		runId: string,
		decision: 'confirm' | 'cancel'
	) => void;
	onDispatchActions: (actions: CompanionChatAction[]) => void;
	onOpenCompanionPlan?: () => void;
	pendingReloadDelayed?: boolean;
	showMissionChrome?: boolean;
};

function CompanionTranscriptDecisionHub({
	runs,
	confirmBusyRunId,
	onConfirmOperationRun,
	onFocusOperationRun,
}: {
	runs: readonly EwaCompanionTaskRun[];
	confirmBusyRunId?: string | null;
	onConfirmOperationRun?: (
		runId: string,
		decision: 'confirm' | 'cancel'
	) => void;
	onFocusOperationRun: (runId: string) => void;
}) {
	const { t } = useTranslation('marketing');
	const awaitingRuns = runs.filter(
		(run) =>
			normalizeCompanionOperationStatus(run.status || '') ===
			'awaiting_confirmation'
	);
	if (awaitingRuns.length === 0 || !onConfirmOperationRun) return null;

	const [primary, ...rest] = awaitingRuns;
	const title = operationIntentLabel(primary, t);
	const detail = operationDetailLabel(primary, t);
	const agenticGate = isAgenticSessionRun(primary)
		? parseAgenticGateFromRun(primary)
		: null;

	const legend = t(
		'ewaCompanion.inlineConfirmationAria',
		'Операция ждёт подтверждения'
	);

	return (
		<li className="my-2 list-none">
			<fieldset
				className="rounded-2xl border border-amber-300/35 bg-[linear-gradient(135deg,rgba(251,191,36,0.16),rgba(15,23,42,0.74))] px-3 py-3 shadow-[0_18px_42px_rgba(2,6,23,0.28)]"
				data-testid="ewa-companion-inline-confirmation"
			>
				<legend className="sr-only">{legend}</legend>
				<div className="flex items-start gap-3">
					<div className="min-w-0 flex-1">
						<p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100/90">
							{t('ewaCompanion.inlineConfirmationEyebrow', 'Нужен ответ')}
						</p>
						<button
							type="button"
							className={cn(
								'mt-1 block max-w-full text-left text-[13px] font-semibold text-(--desktop-text-primary)',
								'hover:text-amber-100',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
							onClick={() => onFocusOperationRun(primary.id)}
						>
							<span className="line-clamp-2">{title}</span>
						</button>
						{detail ? (
							<p className="mt-1 line-clamp-3 text-[11px] leading-snug text-(--desktop-text-secondary)">
								{detail}
							</p>
						) : null}
						{agenticGate ? (
							<AgenticGatePrompt
								runId={primary.id}
								gate={agenticGate}
								busy={confirmBusyRunId === primary.id}
								onConfirmRun={onConfirmOperationRun}
							/>
						) : (
							<CompanionConfirmBar
								runId={primary.id}
								busy={confirmBusyRunId === primary.id}
								onConfirm={onConfirmOperationRun}
							/>
						)}
						{rest.length > 0 ? (
							<p className="mt-2 text-[10px] text-(--companion-text-soft)">
								{t('ewaCompanion.inlineConfirmationMore', {
									defaultValue:
										'Ещё {{count}} ожидает решения в центре миссии.',
									count: rest.length,
								})}
							</p>
						) : null}
					</div>
				</div>
			</fieldset>
		</li>
	);
}

function CompanionTranscriptMissionArtifactsCard({
	summary,
	onDispatchActions,
	onFocusRun,
}: {
	summary: AgenticMissionSummaryItem;
	onDispatchActions: (actions: CompanionChatAction[]) => void;
	onFocusRun: (runId: string) => void;
}) {
	const { t } = useTranslation('marketing');
	return (
		<li className="my-2 list-none">
			<section
				className="rounded-2xl border border-emerald-300/25 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(15,23,42,0.62))] px-3 py-3 shadow-[0_14px_34px_rgba(2,6,23,0.24)]"
				data-testid="ewa-companion-mission-artifacts"
			>
				<div className="mb-2 flex items-start justify-between gap-3">
					<div className="min-w-0 flex-1">
						<p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100/85">
							{summary.status === 'completed'
								? t(
										'ewaCompanion.agenticMissionReadyEyebrow',
										'Результат миссии'
									)
								: t(
										'ewaCompanion.agenticMissionArtifactsEyebrow',
										'Материалы миссии'
									)}
						</p>
						<p className="mt-1 line-clamp-2 text-[13px] font-semibold text-(--desktop-text-primary)">
							{summary.title}
						</p>
						<p className="mt-1 line-clamp-2 text-[11px] leading-snug text-(--desktop-text-secondary)">
							{summary.subtitle}
						</p>
					</div>
					<button
						type="button"
						className={cn(
							'shrink-0 rounded-lg border border-emerald-200/25 bg-emerald-300/10 px-2 py-1',
							'text-[11px] font-semibold text-emerald-50 hover:bg-emerald-300/15',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						onClick={() => onFocusRun(summary.runId)}
					>
						{t('ewaCompanion.activeMissionFocus', 'Открыть')}
					</button>
				</div>
				<CompanionAgenticSessionArtifacts
					documents={summary.documents}
					onOpenDocEditor={(unifiedContentId) =>
						onDispatchActions([
							{
								type: 'open_app',
								app_component: 'DocEditor',
								unified_content_id: unifiedContentId,
							},
						])
					}
					onOpenContentManager={() =>
						onDispatchActions([
							{
								type: 'open_app',
								app_component: 'ContentManagerPro',
							},
						])
					}
				/>
			</section>
		</li>
	);
}

export function CompanionTranscriptMessageList({
	keyedMessages,
	streamGrowingAssistant,
	reducedMotion,
	mobileEmbeddedLayout,
	displayName,
	copiedMessageKey,
	onCopyAssistantReply,
	pending,
	streamingText,
	thinkingHintText,
	transcriptProgressItems,
	transcriptWorkflowSummaries,
	agenticMissionSummaries = [],
	awaitingConfirmationRuns = [],
	confirmBusyRunId = null,
	onFocusOperationRun,
	onConfirmOperationRun,
	onDispatchActions,
	onOpenCompanionPlan,
	pendingReloadDelayed = false,
	showMissionChrome = true,
}: CompanionTranscriptMessageListProps) {
	const showInlineOperationProgress = mobileEmbeddedLayout;
	const hasAwaitingConfirmation = awaitingConfirmationRuns.some(
		(run) =>
			normalizeCompanionOperationStatus(run.status || '') ===
			'awaiting_confirmation'
	);

	return (
		<>
			<ol className="flex flex-col">
				{keyedMessages.map((row, idx) => (
					<CompanionTranscriptMessageRow
						key={row.key}
						row={row}
						index={idx}
						displayName={displayName}
						mobileEmbeddedLayout={mobileEmbeddedLayout}
						reducedMotion={reducedMotion}
						streamGrowingAssistant={streamGrowingAssistant}
						copiedMessageKey={copiedMessageKey}
						onCopyAssistantReply={onCopyAssistantReply}
					/>
				))}
				{pending && streamingText ? null : pending ? (
					<CompanionTranscriptThinkingBubble
						displayName={displayName}
						thinkingHintText={thinkingHintText}
						mobileEmbeddedLayout={mobileEmbeddedLayout}
						reducedMotion={reducedMotion}
					/>
				) : null}
				<CompanionPendingReloadBanner visible={pendingReloadDelayed} />
				{showMissionChrome ? (
					<CompanionTranscriptDecisionHub
						runs={awaitingConfirmationRuns}
						confirmBusyRunId={confirmBusyRunId}
						onConfirmOperationRun={onConfirmOperationRun}
						onFocusOperationRun={onFocusOperationRun}
					/>
				) : null}
				{showMissionChrome
					? agenticMissionSummaries.map((summary) => (
							<CompanionTranscriptMissionArtifactsCard
								key={`${summary.runId}:${summary.documents.length}:${summary.status}`}
								summary={summary}
								onDispatchActions={onDispatchActions}
								onFocusRun={onFocusOperationRun}
							/>
						))
					: null}
				{showInlineOperationProgress
					? transcriptProgressItems.map((item) => (
							<InTranscriptProgressBanner
								key={item.runId}
								progress={item}
								onFocusRun={onFocusOperationRun}
								reducedMotion={reducedMotion}
							/>
						))
					: null}
				{showMissionChrome
					? transcriptWorkflowSummaries.map((summary) => (
							<WorkflowCompletionSummary
								key={summary.runId}
								summary={summary}
								onPlayTrack={(action) => onDispatchActions([action])}
								onOpenDocEditor={(unifiedContentId) => {
									onDispatchActions([
										{
											type: 'open_app',
											app_component: 'DocEditor',
											unified_content_id: unifiedContentId,
										},
									]);
								}}
								onOpenContentManager={() => {
									onDispatchActions([
										{
											type: 'open_app',
											app_component: 'ContentManagerPro',
										},
									]);
								}}
								onOpenCompanionPlan={onOpenCompanionPlan}
							/>
						))
					: null}
			</ol>
			{showMissionChrome &&
			!hasAwaitingConfirmation &&
			transcriptProgressItems.some(
				(item) => item.status === 'active' || item.status === 'stale'
			) ? (
				<CompanionActivityCenterStrip
					items={[...transcriptProgressItems]}
					onFocusRun={onFocusOperationRun}
					reducedMotion={reducedMotion}
				/>
			) : null}
		</>
	);
}
