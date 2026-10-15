/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Primary desktop mission canvas for the companion center pane. It surfaces the
 * main mission narrative, decisions, artifacts, and deep review so the right rail
 * can stay secondary. Active agentic missions use a center 50/50 split: answer on
 * the left, live execution (timeline + tree/trace) on the right with auto poll.
 * Completed missions start collapsed; dismiss hides chrome without cancelling.
 *
 * Invariants:
 * - Consumes existing durable mission/run contracts; does not invent a parallel mission state.
 * - Center actions reuse the same app-opening and confirm/cancel boundaries as the rail.
 * - Dismiss/collapse are Shell Lifecycle Manager view prefs only; never cancel task runs.
 * - `missionChromeCollapsed` + `onSetMissionChromeCollapsed` are required (no local fallback).
 * - Active agentic: earlier chat is collapsed disclosure; execution column always mounted.
 *
 * Related:
 * - src/pages/Desktop/shell/shellLifecycleManager.ts
 * - src/features/ewa/companionOperations/companionOperationsUi.ts
 * - src/features/ewa/companionUx/CompanionTranscriptChatContent.tsx
 */

import {
	ArrowPathIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	ClockIcon,
	ExclamationTriangleIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import { lazy, Suspense, type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AgenticGatePrompt } from '@/features/ewa/agentic/AgenticGatePrompt';
import { parseAgenticGateFromRun } from '@/features/ewa/agentic/agenticGateUtils';
import { agenticCheckpointSummaryLooksLikeMarkdown } from '@/features/ewa/agentic/agenticObservabilityUi';
import { EwaCompanionChatMarkdown } from '@/features/ewa/EwaCompanionChatMarkdown';
import { humanizeAgenticPlanSummary } from '@/features/ewa/agentic/agenticObservabilityUi';
import { CompanionAgenticSessionArtifacts } from '@/features/ewa/companionOperations/CompanionAgenticSessionArtifacts';
import { CompanionConfirmBar } from '@/features/ewa/companionOperations/CompanionConfirmBar';
import { CompanionOperationStepTimeline } from '@/features/ewa/companionOperations/CompanionOperationStepTimeline';
import type { CompanionOperationsDegradedKind } from '@/features/ewa/companionOperations/companionOperationsStore';
import {
	type AgenticMissionDisplayState,
	type MissionSurfaceBundle,
	isAgenticMissionActiveState,
	isAgenticSessionRun,
	isOperationTruthfullyLive,
	isUserActionWorkflowRun,
	missionDisplayStatusLabel,
	parseAgenticSessionPlanPayload,
} from '@/features/ewa/companionOperations/companionOperationsUi';
import { CompanionWorkflowStepResultsReview } from '@/features/ewa/companionOperations/CompanionWorkflowStepResultsReview';
import { CompanionGlassSection } from '@/features/ewa/companionPremiumPrimitives';
import { EWA_COMPANION_TYPOGRAPHY } from '@/features/ewa/ewaShellTypography';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import type {
	CompanionChatAction,
	EwaCompanionTaskRun,
} from '@/services/ewa/ewaCompanionChatApi';
import { cn } from '@/utils/cn';

const CompanionOperationRunCardAgenticObservability = lazy(
	() =>
		import(
			'@/features/ewa/companionOperations/CompanionOperationRunCardAgenticObservability'
		)
);

export type CompanionCenterMissionCanvasProps = {
	mission: MissionSurfaceBundle;
	blockingDecisionRun?: EwaCompanionTaskRun | null;
	degradedKind?: CompanionOperationsDegradedKind | null;
	degradedMessage?: string | null;
	degradedRefreshing?: boolean;
	onRefreshMissionStatus?: () => void;
	confirmBusyRunId?: string | null;
	onConfirmRun?: (runId: string, decision: 'confirm' | 'cancel') => void;
	onDispatchActions: (actions: CompanionChatAction[]) => void;
	onPlayTrack: (action: CompanionChatAction) => void;
	onDraftPlayPrompt: (text: string) => void;
	onOpenPresentationInEwrp: (jobId: string) => void;
	onOpenCompanionPlan?: () => void;
	/** Hide completed/idle center mission chrome without cancelling the run. */
	onDismissMission?: (runId: string) => void;
	/**
	 * SLM-owned collapse (U0, required). Parent must supply Shell Lifecycle Manager
	 * prefs — canvas never keeps its own expand/collapse storage.
	 */
	missionChromeCollapsed: boolean;
	onSetMissionChromeCollapsed: (collapsed: boolean) => void;
	supportingTranscript?: ReactNode;
};

export type CompanionCenterDecisionCardProps = {
	run: EwaCompanionTaskRun;
	confirmBusyRunId?: string | null;
	onConfirmRun?: (runId: string, decision: 'confirm' | 'cancel') => void;
};

export type CompanionCenterMissionUnavailableProps = {
	kind?: CompanionOperationsDegradedKind | null;
	message?: string | null;
	refreshing?: boolean;
	onRefresh?: () => void;
};

export function CompanionCenterMissionUnavailable({
	kind = 'backend',
	message,
	refreshing = false,
	onRefresh,
}: CompanionCenterMissionUnavailableProps) {
	const { t } = useTranslation('marketing');
	const resolvedKind = kind ?? 'backend';
	const title =
		resolvedKind === 'auth'
			? t('ewaCompanion.centerMissionAuthTitle', 'Нужно обновить сессию')
			: resolvedKind === 'stale'
				? t(
						'ewaCompanion.centerMissionStaleTitle',
						'Показываю последний известный статус'
					)
				: resolvedKind === 'no_mission'
					? t(
							'ewaCompanion.centerMissionNoMissionTitle',
							'Активной миссии пока нет'
						)
					: t(
							'ewaCompanion.centerMissionDegradedTitle',
							'Кора временно не получает свежий статус'
						);
	const body =
		message?.trim() ||
		(resolvedKind === 'auth'
			? t(
					'ewaCompanion.centerMissionAuthBody',
					'Авторизация устарела. Обновите страницу или войдите снова, чтобы увидеть операции.'
				)
			: resolvedKind === 'stale'
				? t(
						'ewaCompanion.centerMissionStaleBody',
						'Свежий статус недоступен, но последний снимок миссии остаётся на экране.'
					)
				: resolvedKind === 'no_mission'
					? t(
							'ewaCompanion.centerMissionNoMissionBody',
							'Опишите цель одним сообщением, и Кора соберёт миссию в этом центре.'
						)
					: t(
							'ewaCompanion.centerMissionDegradedBody',
							'Показываю центр миссии вместо пустого экрана. Последний известный результат сохранится, когда связь с операциями восстановится.'
						));
	const refreshLabel =
		resolvedKind === 'auth'
			? t('ewaCompanion.centerMissionRefreshSession', 'Обновить сессию')
			: resolvedKind === 'no_mission'
				? t('ewaCompanion.centerMissionStartPrompt', 'Начать миссию')
				: t('ewaCompanion.centerMissionRefresh', 'Обновить статус миссии');
	return (
		<CompanionGlassSection tone="caution" className="mb-3 overflow-hidden p-4">
			<div className="flex items-start gap-3">
				<div className="rounded-2xl border border-amber-200/25 bg-amber-300/10 p-2 text-amber-100">
					<ExclamationTriangleIcon className="size-5" aria-hidden />
				</div>
				<div className="min-w-0 flex-1">
					<p
						className={cn(
							EWA_COMPANION_TYPOGRAPHY.overline,
							'text-amber-100/85'
						)}
					>
						{t(
							'ewaCompanion.centerMissionDegradedEyebrow',
							'Миссия остаётся в центре'
						)}
					</p>
					<h2 className={cn(EWA_COMPANION_TYPOGRAPHY.hero, 'mt-1')}>{title}</h2>
					<p
						className={cn(
							EWA_COMPANION_TYPOGRAPHY.bodyCompact,
							'mt-1 leading-snug text-(--desktop-text-secondary)'
						)}
					>
						{body}
					</p>
					{onRefresh ? (
						<button
							type="button"
							className={cn(
								'mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-200/30 bg-amber-300/10 px-3 py-1.5',
								EWA_COMPANION_TYPOGRAPHY.meta,
								'font-semibold text-amber-50 hover:bg-amber-300/15 disabled:opacity-65',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
							disabled={refreshing}
							onClick={onRefresh}
						>
							<ArrowPathIcon
								className={cn('size-3.5', refreshing && 'animate-spin')}
								aria-hidden
							/>
							{refreshing
								? t('ewaCompanion.centerMissionRefreshing', 'Обновляю статус…')
								: refreshLabel}
						</button>
					) : null}
				</div>
			</div>
		</CompanionGlassSection>
	);
}

export function CompanionCenterDecisionCard({
	run,
	confirmBusyRunId = null,
	onConfirmRun,
}: CompanionCenterDecisionCardProps) {
	const { t } = useTranslation('marketing');
	const title =
		run.user_message?.trim() ||
		t('ewaCompanion.centerMissionDecisionFallbackTitle', 'Нужно решение');
	const agenticGate = isAgenticSessionRun(run)
		? parseAgenticGateFromRun(run)
		: null;

	return (
		<CompanionGlassSection tone="caution" className="mb-3 overflow-hidden p-3">
			<div className="flex min-w-0 flex-col gap-2">
				<div className="min-w-0">
					<p
						className={cn(
							EWA_COMPANION_TYPOGRAPHY.overline,
							'text-amber-100/85'
						)}
					>
						{t('ewaCompanion.centerMissionDecisionEyebrow', 'Решение в центре')}
					</p>
					<h2
						className={cn(EWA_COMPANION_TYPOGRAPHY.label, 'mt-1 line-clamp-2')}
					>
						{title}
					</h2>
					<p
						className={cn(
							EWA_COMPANION_TYPOGRAPHY.bodyCompact,
							'mt-1 leading-snug text-(--desktop-text-secondary)'
						)}
					>
						{t(
							'ewaCompanion.centerMissionDecisionBody',
							'Ответьте здесь, чтобы Кора продолжила без поиска кнопки в правой панели.'
						)}
					</p>
				</div>
				{agenticGate && onConfirmRun ? (
					<AgenticGatePrompt
						runId={run.id}
						gate={agenticGate}
						busy={confirmBusyRunId === run.id}
						onConfirmRun={onConfirmRun}
					/>
				) : onConfirmRun ? (
					<CompanionConfirmBar
						runId={run.id}
						busy={confirmBusyRunId === run.id}
						onConfirm={onConfirmRun}
					/>
				) : null}
			</div>
		</CompanionGlassSection>
	);
}

function missionNextActionLabel({
	active,
	hasGate,
	hasDocuments,
	hasWorkflowSummary,
	recommendedNextAction,
	t,
}: {
	active: boolean;
	hasGate: boolean;
	hasDocuments: boolean;
	hasWorkflowSummary: boolean;
	recommendedNextAction: string;
	t: TFunction<'marketing'>;
}) {
	if (recommendedNextAction.trim()) {
		return recommendedNextAction.trim();
	}
	if (hasGate) {
		return t(
			'ewaCompanion.centerMissionNextConfirm',
			'Нужен ваш ответ, чтобы Кора продолжила миссию.'
		);
	}
	if (hasDocuments) {
		return t(
			'ewaCompanion.centerMissionNextArtifacts',
			'Откройте созданные материалы или продолжите работу с ними.'
		);
	}
	if (hasWorkflowSummary) {
		return t(
			'ewaCompanion.centerMissionNextReview',
			'Проверьте результат цепочки и выберите следующий шаг.'
		);
	}
	if (active) {
		return t(
			'ewaCompanion.centerMissionNextActive',
			'Кора выполняет миссию. Шаги и детали обновляются в колонке выполнения.'
		);
	}
	return t(
		'ewaCompanion.centerMissionNextCompleted',
		'Миссия завершена. Результат и материалы доступны в этом центре.'
	);
}

function agenticObservabilityRefreshToken(run: EwaCompanionTaskRun): number {
	return (
		(Number(run.run_revision) || 0) * 1_000_000_000 +
		(Date.parse(run.updated_at || '') || 0) +
		(run.steps?.length ?? 0) * 1_000_000
	);
}

function MissionAgenticObservabilityMount({
	sessionId,
	sessionStatus,
	run,
	onPlayTrack,
}: {
	sessionId: string;
	sessionStatus: string;
	run: EwaCompanionTaskRun;
	onPlayTrack: (action: CompanionChatAction) => void;
}) {
	const { t } = useTranslation('marketing');
	return (
		<Suspense
			fallback={
				<p className={cn(EWA_COMPANION_TYPOGRAPHY.meta, 'mt-2 text-white/50')}>
					{t(
						'ewaCompanion.agenticObservabilityLoading',
						'Loading mission details…'
					)}
				</p>
			}
		>
			<CompanionOperationRunCardAgenticObservability
				sessionId={sessionId}
				sessionStatus={sessionStatus}
				refreshToken={agenticObservabilityRefreshToken(run)}
				run={run}
				onPlayTrack={onPlayTrack}
			/>
		</Suspense>
	);
}

export function CompanionCenterMissionCanvas({
	mission,
	blockingDecisionRun = null,
	degradedKind = null,
	degradedMessage = null,
	degradedRefreshing = false,
	onRefreshMissionStatus,
	confirmBusyRunId = null,
	onConfirmRun,
	onDispatchActions,
	onPlayTrack,
	onDraftPlayPrompt,
	onOpenPresentationInEwrp,
	onOpenCompanionPlan,
	onDismissMission,
	missionChromeCollapsed,
	onSetMissionChromeCollapsed,
	supportingTranscript = null,
}: CompanionCenterMissionCanvasProps) {
	const { t } = useTranslation('marketing');
	const { run } = mission;
	const parsed = isAgenticSessionRun(run)
		? parseAgenticSessionPlanPayload(run)
		: null;
	const gate =
		isAgenticSessionRun(run) && run.status === 'awaiting_confirmation'
			? parseAgenticGateFromRun(run)
			: null;
	const primaryAwaitingConfirmation = run.status === 'awaiting_confirmation';
	const active =
		isAgenticMissionActiveState(
			mission.displayState as AgenticMissionDisplayState
		) || isOperationTruthfullyLive(mission.displayState);
	const canDismiss = Boolean(onDismissMission) && !active;
	const statusLabel = missionDisplayStatusLabel(
		mission.displayState as AgenticMissionDisplayState,
		t
	);
	const [detailsOpen, setDetailsOpen] = useState(false);
	const [technicalTraceOpen, setTechnicalTraceOpen] = useState(false);
	const missionRunId = mission.runId;
	useEffect(() => {
		void missionRunId;
		setDetailsOpen(false);
		setTechnicalTraceOpen(false);
	}, [missionRunId]);
	/** Live missions always expand; terminal chrome follows strict SLM prop. */
	const expanded = active || !missionChromeCollapsed;
	const setExpanded = (next: boolean) => {
		onSetMissionChromeCollapsed(!next);
	};
	const planSummaryText = parsed?.planSummary?.trim()
		? humanizeAgenticPlanSummary(parsed.planSummary, t)
		: '';
	const hasUserTimeline = Boolean(
		(run.steps && run.steps.length > 0) ||
			mission.workflowSummary ||
			planSummaryText
	);
	const hasTechnicalTrace = Boolean(
		isAgenticSessionRun(run) && parsed?.agenticSessionId
	);
	const hasDetails = hasUserTimeline || hasTechnicalTrace;
	/** Active agentic: split answer | live execution; CSS lg:grid handles desktop 50/50. */
	const useLiveExecutionSplit =
		active && isAgenticSessionRun(run) && hasDetails;
	const nextAction = missionNextActionLabel({
		active,
		hasGate: Boolean(gate),
		hasDocuments: mission.documents.length > 0,
		hasWorkflowSummary: Boolean(mission.workflowSummary),
		recommendedNextAction: mission.recommendedNextAction,
		t,
	});
	const primaryResult = mission.primaryResult.trim();
	const answerSummary = mission.answerSummary.trim();
	const answerLooksLikeMarkdown = agenticCheckpointSummaryLooksLikeMarkdown(
		answerSummary || primaryResult
	);
	const showAnswerBody =
		Boolean(answerSummary) && answerSummary !== primaryResult;
	const hasReadyMedia = Boolean(
		mission.readyTrack || mission.readyImage || mission.readyPresentation
	);

	const statusChip = (
		<div
			className={cn(
				EWA_COMPANION_TYPOGRAPHY.micro,
				'shrink-0 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2 py-1 font-medium text-cyan-50'
			)}
		>
			<span className="inline-flex items-center gap-1">
				<ClockIcon className="size-3" aria-hidden />
				{statusLabel}
			</span>
		</div>
	);

	const dismissButton =
		canDismiss && onDismissMission ? (
			<button
				type="button"
				className={cn(
					'inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1',
					'text-[11px] font-medium text-(--companion-text-soft) hover:bg-white/5',
					DESKTOP_CHROME_FOCUS_VISIBLE
				)}
				aria-label={t(
					'ewaCompanion.centerMissionDismissAria',
					'Скрыть блок результата миссии'
				)}
				onClick={() => onDismissMission(mission.runId)}
			>
				<XMarkIcon className="size-3.5" aria-hidden />
				{t('ewaCompanion.centerMissionDismiss', 'Скрыть')}
			</button>
		) : null;

	/** Collapse prior chat only while live agentic split is on (not terminal expanded). */
	const earlierChatCollapsed =
		Boolean(supportingTranscript) && useLiveExecutionSplit;

	const transcriptSection = supportingTranscript ? (
		earlierChatCollapsed ? (
			<details
				className="group/earlier-chat min-h-0 border-t border-(--companion-divider)/40 pt-2"
				data-testid="ewa-center-mission-earlier-chat"
			>
				<summary
					className={cn(
						'flex cursor-pointer list-none items-center gap-1 rounded-sm',
						'text-[10px] font-semibold uppercase tracking-[0.16em] text-(--companion-text-soft)',
						'[&::-webkit-details-marker]:hidden',
						DESKTOP_CHROME_FOCUS_VISIBLE
					)}
				>
					<ChevronDownIcon
						className={cn(
							'size-3 shrink-0 transition-transform',
							'group-open/earlier-chat:rotate-180'
						)}
						aria-hidden
					/>
					{t('ewaCompanion.centerMissionEarlierChatEyebrow', 'Раньше в чате')}
				</summary>
				<div
					className="mt-2 min-h-0"
					data-testid="ewa-center-mission-transcript"
				>
					{supportingTranscript}
				</div>
			</details>
		) : (
			<div
				className="min-h-0 flex-1 border-t border-(--companion-divider)/40 pt-2"
				data-testid="ewa-center-mission-transcript"
			>
				<p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-(--companion-text-soft)">
					{t('ewaCompanion.centerMissionTranscriptEyebrow', 'Контекст ответа')}
				</p>
				{supportingTranscript}
			</div>
		)
	) : null;

	const executionColumnBody = (
		<div className="space-y-3">
			{hasUserTimeline ? (
				<p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-(--companion-text-soft)">
					{t(
						'ewaCompanion.centerMissionUserTimelineEyebrow',
						'Понятный ход миссии'
					)}
				</p>
			) : null}

			{planSummaryText ? (
				<div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2.5">
					<p
						className={cn(
							EWA_COMPANION_TYPOGRAPHY.overline,
							'text-(--companion-text-soft)'
						)}
					>
						{t('ewaCompanion.centerMissionPlanEyebrow', 'План миссии')}
					</p>
					<p
						className={cn(
							EWA_COMPANION_TYPOGRAPHY.bodyCompact,
							'mt-1 whitespace-pre-line leading-snug'
						)}
					>
						{planSummaryText}
					</p>
				</div>
			) : null}

			{run.steps && run.steps.length > 0 ? (
				<CompanionOperationStepTimeline
					steps={run.steps}
					run={run}
					reducedMotion={false}
				/>
			) : null}

			{isUserActionWorkflowRun(run) && mission.workflowSummary ? (
				<CompanionWorkflowStepResultsReview
					run={run}
					onPlayTrack={onPlayTrack}
					onDraftPlayPrompt={onDraftPlayPrompt}
					onOpenDocEditor={(unifiedContentId) =>
						onDispatchActions([
							{
								type: 'open_app',
								app_component: 'DocEditor',
								unified_content_id: unifiedContentId,
							},
						])
					}
					onOpenPresentationInEwrp={onOpenPresentationInEwrp}
					onOpenContentManager={() =>
						onDispatchActions([
							{
								type: 'open_app',
								app_component: 'ContentManagerPro',
							},
						])
					}
					onOpenCompanionPlan={onOpenCompanionPlan}
				/>
			) : null}

			{hasTechnicalTrace && parsed ? (
				useLiveExecutionSplit ? (
					<div className="rounded-2xl border border-white/10 bg-black/10 p-2">
						<p
							className={cn(
								EWA_COMPANION_TYPOGRAPHY.overline,
								'mb-2 text-(--companion-text-soft)'
							)}
						>
							{t(
								'ewaCompanion.centerMissionLiveExecutionEyebrow',
								'Шаги и детали выполнения'
							)}
						</p>
						<MissionAgenticObservabilityMount
							sessionId={parsed.agenticSessionId}
							sessionStatus={parsed.sessionStatus}
							run={run}
							onPlayTrack={onPlayTrack}
						/>
					</div>
				) : (
					<div className="rounded-2xl border border-white/10 bg-black/10 p-2">
						<button
							type="button"
							className={cn(
								'inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1',
								'text-[11px] font-medium text-(--companion-text-soft) hover:bg-white/5',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
							aria-expanded={technicalTraceOpen}
							onClick={() => setTechnicalTraceOpen((value) => !value)}
						>
							{technicalTraceOpen
								? t(
										'ewaCompanion.centerMissionHideTechnicalTrace',
										'Hide execution details'
									)
								: t(
										'ewaCompanion.centerMissionOpenTechnicalTrace',
										'Show execution details'
									)}
						</button>
						{technicalTraceOpen ? (
							<MissionAgenticObservabilityMount
								sessionId={parsed.agenticSessionId}
								sessionStatus={parsed.sessionStatus}
								run={run}
								onPlayTrack={onPlayTrack}
							/>
						) : null}
					</div>
				)
			) : null}
		</div>
	);

	if (!expanded) {
		return (
			<div
				className="mb-3 flex min-h-0 flex-col gap-2"
				data-testid="ewa-center-mission-shell"
			>
				<CompanionGlassSection
					tone="mission"
					className="overflow-hidden p-3"
					data-testid="ewa-center-mission-collapsed"
				>
					<div className="flex min-w-0 items-center gap-2">
						<div className="min-w-0 flex-1">
							<p
								className={cn(
									EWA_COMPANION_TYPOGRAPHY.overline,
									'text-cyan-100/85'
								)}
							>
								{t(
									'ewaCompanion.centerMissionResultEyebrow',
									'Главный результат'
								)}
							</p>
							<p
								className={cn(
									EWA_COMPANION_TYPOGRAPHY.label,
									'mt-0.5 truncate leading-snug'
								)}
							>
								{mission.title}
							</p>
							<p
								className={cn(
									EWA_COMPANION_TYPOGRAPHY.meta,
									'mt-0.5 text-(--companion-text-soft)'
								)}
							>
								{t(
									'ewaCompanion.centerMissionCollapsedHint',
									'Свёрнуто — не мешает переписке'
								)}
							</p>
						</div>
						{statusChip}
						<button
							type="button"
							className={cn(
								'inline-flex items-center gap-1 rounded-md border border-cyan-300/25 bg-cyan-300/10 px-2 py-1',
								'text-[11px] font-semibold text-cyan-50 hover:bg-cyan-300/15',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
							onClick={() => setExpanded(true)}
						>
							<ChevronDownIcon className="size-3.5" aria-hidden />
							{t('ewaCompanion.centerMissionExpand', 'Развернуть')}
						</button>
						{dismissButton}
					</div>
				</CompanionGlassSection>
				{transcriptSection}
			</div>
		);
	}

	const missionAnswerColumn = (
		<div className="flex min-w-0 flex-col gap-3">
			{degradedKind && degradedKind !== 'no_mission' ? (
				<CompanionCenterMissionUnavailable
					kind={degradedKind}
					message={degradedMessage}
					refreshing={degradedRefreshing}
					onRefresh={onRefreshMissionStatus}
				/>
			) : null}

			<div className="flex min-w-0 items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<p
						className={cn(
							EWA_COMPANION_TYPOGRAPHY.overline,
							'text-cyan-100/85'
						)}
					>
						{active
							? t('ewaCompanion.centerMissionEyebrow', 'Главная миссия')
							: t(
									'ewaCompanion.centerMissionResultEyebrow',
									'Главный результат'
								)}
					</p>
					<h2
						className={cn(EWA_COMPANION_TYPOGRAPHY.hero, 'mt-1 line-clamp-2')}
					>
						{mission.title}
					</h2>
					<p
						className={cn(
							EWA_COMPANION_TYPOGRAPHY.bodyCompact,
							'mt-1 line-clamp-3 leading-snug text-(--desktop-text-secondary)'
						)}
					>
						{mission.subtitle}
					</p>
				</div>
				<div className="flex shrink-0 flex-col items-end gap-1.5">
					{statusChip}
					{!active ? (
						<button
							type="button"
							className={cn(
								'inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1',
								'text-[11px] font-medium text-(--companion-aura) hover:bg-white/5',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
							onClick={() => setExpanded(false)}
						>
							<ChevronUpIcon className="size-3.5" aria-hidden />
							{t('ewaCompanion.centerMissionCollapse', 'Свернуть')}
						</button>
					) : null}
					{dismissButton}
				</div>
			</div>

			{primaryResult || answerSummary ? (
				<div className="rounded-2xl border border-cyan-200/20 bg-cyan-300/8 px-3 py-2.5">
					<p
						className={cn(
							EWA_COMPANION_TYPOGRAPHY.overline,
							'text-cyan-100/80'
						)}
					>
						{t('ewaCompanion.centerMissionAnswerEyebrow', 'Главный ответ')}
					</p>
					{primaryResult && !answerLooksLikeMarkdown ? (
						<p
							className={cn(
								EWA_COMPANION_TYPOGRAPHY.label,
								'mt-1 leading-snug'
							)}
						>
							{primaryResult}
						</p>
					) : null}
					{answerLooksLikeMarkdown && (answerSummary || primaryResult) ? (
						<EwaCompanionChatMarkdown
							markdown={answerSummary || primaryResult}
							className={cn(
								'mt-1 !text-[12px] !leading-snug text-(--desktop-text-secondary)',
								'prose-headings:!mt-1.5 prose-headings:!mb-1 prose-headings:!text-[13px]',
								'prose-p:!my-1 prose-ul:!my-1 prose-ol:!my-1'
							)}
						/>
					) : showAnswerBody ? (
						<p
							className={cn(
								EWA_COMPANION_TYPOGRAPHY.bodyCompact,
								'mt-1 whitespace-pre-line leading-snug text-(--desktop-text-secondary)'
							)}
						>
							{answerSummary}
						</p>
					) : null}
				</div>
			) : null}

			<div className="rounded-2xl border border-white/10 bg-white/4.5 px-3 py-2.5">
				<p
					className={cn(
						EWA_COMPANION_TYPOGRAPHY.overline,
						'text-(--companion-text-soft)'
					)}
				>
					{t('ewaCompanion.centerMissionNowEyebrow', 'Что важно сейчас')}
				</p>
				<p className={cn(EWA_COMPANION_TYPOGRAPHY.label, 'mt-1 leading-snug')}>
					{nextAction}
				</p>
			</div>

			{gate && onConfirmRun ? (
				<AgenticGatePrompt
					runId={run.id}
					gate={gate}
					busy={confirmBusyRunId === run.id}
					onConfirmRun={onConfirmRun}
				/>
			) : primaryAwaitingConfirmation && onConfirmRun ? (
				<CompanionConfirmBar
					runId={run.id}
					busy={confirmBusyRunId === run.id}
					onConfirm={onConfirmRun}
				/>
			) : null}

			{blockingDecisionRun && blockingDecisionRun.id !== run.id ? (
				<CompanionCenterDecisionCard
					run={blockingDecisionRun}
					confirmBusyRunId={confirmBusyRunId}
					onConfirmRun={onConfirmRun}
				/>
			) : null}

			{mission.documents.length > 0 ? (
				<CompanionAgenticSessionArtifacts
					documents={mission.documents}
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
			) : null}

			{hasReadyMedia ? (
				<div className="rounded-2xl border border-cyan-200/20 bg-cyan-300/7 px-3 py-2.5">
					<p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100/80">
						{t('ewaCompanion.centerMissionMediaEyebrow', 'Готовый результат')}
					</p>
					<div className="mt-2 flex flex-wrap gap-2">
						{mission.readyTrack ? (
							<button
								type="button"
								className={cn(
									'rounded-full border border-cyan-200/25 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-50 hover:bg-cyan-300/15',
									DESKTOP_CHROME_FOCUS_VISIBLE
								)}
								onClick={() => {
									const readyTrack = mission.readyTrack;
									if (!readyTrack) return;
									onPlayTrack({
										type: 'music_play_track',
										unified_content_id: readyTrack.unifiedContentId,
										track_name: readyTrack.trackName,
									});
								}}
							>
								{t('ewaCompanion.centerMissionPlayTrack', 'Слушать трек')}
							</button>
						) : null}
						{mission.readyImage ? (
							<button
								type="button"
								className={cn(
									'rounded-full border border-cyan-200/25 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-50 hover:bg-cyan-300/15',
									DESKTOP_CHROME_FOCUS_VISIBLE
								)}
								onClick={() => {
									const readyImage = mission.readyImage;
									if (!readyImage) return;
									onDispatchActions([
										{
											type: 'open_app',
											app_component: 'ContentManagerPro',
											unified_content_id: readyImage.unifiedContentId,
										},
									]);
								}}
							>
								{t(
									'ewaCompanion.centerMissionOpenImage',
									'Открыть изображение'
								)}
							</button>
						) : null}
						{mission.readyPresentation ? (
							<button
								type="button"
								className={cn(
									'rounded-full border border-cyan-200/25 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-50 hover:bg-cyan-300/15',
									DESKTOP_CHROME_FOCUS_VISIBLE
								)}
								onClick={() =>
									mission.readyPresentation
										? onOpenPresentationInEwrp(mission.readyPresentation.jobId)
										: undefined
								}
							>
								{t(
									'ewaCompanion.centerMissionOpenPresentation',
									'Открыть презентацию'
								)}
							</button>
						) : null}
					</div>
				</div>
			) : null}

			{mission.progress ? (
				<div className="space-y-1">
					<div className="flex items-center justify-between gap-3 text-[11px] text-(--companion-text-soft)">
						<span className="truncate">
							{mission.progress.subtitle?.trim() || mission.progress.title}
						</span>
						<span className="shrink-0">
							{t('ewaCompanion.activeMissionProgress', {
								defaultValue: 'Шаг {{current}} из {{total}}',
								current: Math.max(
									0,
									Math.min(mission.progress.current, mission.progress.total)
								),
								total: Math.max(mission.progress.total, 1),
							})}
						</span>
					</div>
					<div className="h-1.5 overflow-hidden rounded-full bg-(--companion-divider)/40">
						<div
							className="h-full rounded-full bg-(--companion-aura)/85 transition-[width] duration-500 ease-out"
							style={{
								width: `${Math.min(100, Math.round((mission.progress.current / Math.max(mission.progress.total, 1)) * 100))}%`,
							}}
						/>
					</div>
				</div>
			) : null}

			{useLiveExecutionSplit ? transcriptSection : null}

			{!useLiveExecutionSplit && hasDetails ? (
				<div className="border-t border-(--companion-divider)/40 pt-2">
					<button
						type="button"
						className={cn(
							'inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1',
							'text-[11px] font-medium text-(--companion-aura) hover:bg-white/5',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						aria-expanded={detailsOpen}
						onClick={() => {
							setDetailsOpen((value) => {
								const next = !value;
								if (next && hasTechnicalTrace && !hasUserTimeline) {
									setTechnicalTraceOpen(true);
								}
								return next;
							});
						}}
					>
						{detailsOpen
							? t('ewaCompanion.centerMissionHideDetail', 'Скрыть ход миссии')
							: t(
									'ewaCompanion.centerMissionOpenDetail',
									'Показать ход и детали'
								)}
					</button>
					{detailsOpen ? (
						<div className="mt-2">{executionColumnBody}</div>
					) : null}
				</div>
			) : null}
		</div>
	);

	return (
		<div
			className="mb-3 flex min-h-0 flex-col gap-2"
			data-testid="ewa-center-mission-shell"
		>
			<CompanionGlassSection
				tone="mission"
				className="overflow-hidden p-3"
				data-testid="ewa-center-mission-expanded"
			>
				{useLiveExecutionSplit ? (
					<div className="flex min-w-0 flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
						{missionAnswerColumn}
						<div
							className="min-w-0 rounded-2xl border border-white/10 bg-black/10 p-2.5 lg:min-h-[12rem]"
							data-testid="ewa-center-mission-execution"
						>
							<p
								className={cn(
									EWA_COMPANION_TYPOGRAPHY.overline,
									'mb-2 text-cyan-100/80'
								)}
							>
								{t(
									'ewaCompanion.centerMissionExecutionColumnEyebrow',
									'Выполнение'
								)}
							</p>
							{executionColumnBody}
						</div>
					</div>
				) : (
					missionAnswerColumn
				)}
			</CompanionGlassSection>
			{!useLiveExecutionSplit ? transcriptSection : null}
		</div>
	);
}
