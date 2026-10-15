/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single operation run card for companion operations panel (Phase 3).
 *
 * Invariants:
 * - Card controls may hide/pin the UI card, but never cancel a run without the explicit cancel API.
 * - Failed run details are assertive alerts; active/completed status chips stay polite visual state only.
 *
 * Related:
 * - src/features/ewa/CompanionOperationsPanel.tsx
 */

import {
	ArrowDownTrayIcon,
	ArrowsPointingOutIcon,
	ArrowPathIcon,
	CheckCircleIcon,
	ClockIcon,
	ExclamationCircleIcon,
	PaperAirplaneIcon,
	ShareIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { type ReactNode, lazy, memo, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CompanionConfirmBar } from '@/features/ewa/companionOperations/CompanionConfirmBar';
import { AgenticGatePrompt } from '@/features/ewa/agentic/AgenticGatePrompt';
import { parseAgenticGateFromRun } from '@/features/ewa/agentic/agenticGateUtils';
import { CompanionAgenticSessionArtifacts } from '@/features/ewa/companionOperations/CompanionAgenticSessionArtifacts';
import { useAgenticSessionDocuments } from '@/features/ewa/companionOperations/useAgenticSessionDocuments';
import { CompanionOperationImagePreview } from '@/features/ewa/companionOperations/CompanionOperationImagePreview';
import { CompanionOperationMusicCard } from '@/features/ewa/companionOperations/CompanionOperationMusicCard';
import { CompanionOperationPresentationCard } from '@/features/ewa/companionOperations/CompanionOperationPresentationCard';
import { CompanionOperationStepTimeline } from '@/features/ewa/companionOperations/CompanionOperationStepTimeline';
import { CompanionWorkflowStepResultsReview } from '@/features/ewa/companionOperations/CompanionWorkflowStepResultsReview';
import {
	ACTIVE_OPERATION_STATUSES,
	type OperationReadyImage,
	isOperationRunCancellable,
	isOperationTruthfullyLive,
	isUserActionWorkflowRun,
	musicPipelineProgressForRun,
	operationDetailLabel,
	operationEffectiveStatusLabel,
	operationErrorLabel,
	operationIntentLabel,
	operationPlayPrompt,
	operationPresentationSummary,
	operationReadyImage,
	operationImageContentUnavailable,
	operationReadyPresentation,
	operationReadyTrack,
	operationTimeLabel,
	normalizeCompanionOperationStatus,
	resolveOperationEffectiveDisplayState,
	userWorkflowProgressForRun,
	isAgenticSessionRun,
	parseAgenticSessionPlanPayload,
	agenticSessionDisplaySummary,
	agenticProgressFromRun,
	companionRunVisualRevision,
} from '@/features/ewa/companionOperations/companionOperationsUi';
import { companionRetryPromptForIntent } from '@/features/ewa/companionOperations/companionRetryPrompts';
import { CompanionSurfaceBlockStrip } from '@/features/ewa/companionOutputSurface/CompanionSurfaceBlockStrip';
import { companionSurfaceBlockCardTitle } from '@/features/ewa/companionOutputSurface/companionSurfaceBlockUi';
import {
	companionProgressBarA11y,
	companionProgressBarValueTextKey,
} from '@/features/ewa/companionUx/companionProgressA11y';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import type { CompanionChatAction } from '@/services/ewa/ewaCompanionChatApi';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';
import { cn } from '@/utils/cn';

const CompanionOperationRunCardAgenticObservability = lazy(
	() =>
		import(
			'@/features/ewa/companionOperations/CompanionOperationRunCardAgenticObservability'
		)
);

export type CompanionOperationRunCardProps = {
	run: EwaCompanionTaskRun;
	ru: boolean;
	confirmBusyRunId: string | null;
	cancelBusyRunId?: string | null;
	onConfirmRun: (runId: string, decision: 'confirm' | 'cancel') => void;
	onCancelRun?: (runId: string) => void;
	onPlayTrack: (action: CompanionChatAction) => void;
	onDraftPlayPrompt: (text: string) => void;
	onOpenPresentationInEwrp: (jobId: string) => void;
	onDownloadImage?: (ready: OperationReadyImage) => void;
	onShareImageToGaf?: (ready: OperationReadyImage) => void;
	onSendImageToCompanion?: (ready: OperationReadyImage) => void;
	surfaceControls?: ReactNode;
	highlighted?: boolean;
	onRetryPrompt?: (prompt: string) => void;
	reducedMotion?: boolean;
	liveSse?: boolean;
	/** T1 / V-H5: poll refresh failure demotes Running → stale on this card. */
	pollDegradedKind?:
		| import('@/features/ewa/companionOperations/companionOperationsStore').CompanionOperationsDegradedKind
		| null;
	onFocusRun?: (runId: string) => void;
	onOpenCompanionPlan?: () => void;
	secondaryRailMode?: boolean;
};

function CompanionOperationRunCardView({
	run,
	ru,
	confirmBusyRunId,
	cancelBusyRunId = null,
	onConfirmRun,
	onCancelRun,
	onPlayTrack,
	onDraftPlayPrompt,
	onOpenPresentationInEwrp,
	onDownloadImage,
	onShareImageToGaf,
	onSendImageToCompanion,
	surfaceControls,
	highlighted = false,
	onRetryPrompt,
	reducedMotion = false,
	liveSse = false,
	pollDegradedKind = null,
	onFocusRun,
	onOpenCompanionPlan,
	secondaryRailMode = false,
}: CompanionOperationRunCardProps) {
	const { t } = useTranslation('marketing');
	const [agenticObservabilityOpen, setAgenticObservabilityOpen] =
		useState(false);
	const [enlargedImageContentId, setEnlargedImageContentId] = useState<
		string | null
	>(null);
	const st = normalizeCompanionOperationStatus(run.status || '');
	const effectiveDisplay = resolveOperationEffectiveDisplayState(run, {
		pollDegradedKind,
	});
	const isCompleted = st === 'completed' || effectiveDisplay === 'completed';
	const isFailed = st === 'failed' || effectiveDisplay === 'failed';
	const isStaleDisplay = effectiveDisplay === 'stale';
	const isActive = isOperationTruthfullyLive(effectiveDisplay);
	const readyTrack = operationReadyTrack(run);
	const readyImage = operationReadyImage(run);
	const imageContentUnavailable = operationImageContentUnavailable(run);
	const presentationSummary = operationPresentationSummary(run);
	const readyPresentation = operationReadyPresentation(run);
	const playPrompt = operationPlayPrompt(run, t);
	const detailLabel = operationDetailLabel(run, t);
	const timeLabel = operationTimeLabel(run, ru);
	const errorLabel = operationErrorLabel(run, t);
	const musicProgress = isActive ? musicPipelineProgressForRun(run) : null;
	const workflowProgress =
		isActive && isUserActionWorkflowRun(run)
			? userWorkflowProgressForRun(run)
			: null;
	// Cancel remains available while backend still reports an active status (even if display is stale).
	const canCancel =
		ACTIVE_OPERATION_STATUSES.has(st) &&
		isOperationRunCancellable(run) &&
		onCancelRun;
	const retryPrompt = isFailed
		? companionRetryPromptForIntent(run.intent_kind, t)
		: null;
	const stepProgress = workflowProgress ?? musicProgress;
	const musicStepProgressA11y =
		stepProgress && stepProgress.total > 0 && !workflowProgress
			? companionProgressBarA11y(stepProgress.current, stepProgress.total)
			: null;
	const workflowStepProgressA11y =
		workflowProgress && workflowProgress.total > 0
			? companionProgressBarA11y(
					workflowProgress.current,
					workflowProgress.total
				)
			: null;
	const completedAtMs = Date.parse(run.completed_at || '');
	const freshDone =
		isCompleted &&
		Number.isFinite(completedAtMs) &&
		Date.now() - completedAtMs < 2 * 60 * 1000;
	const agenticPlan = parseAgenticSessionPlanPayload(run);
	const statusTone = isCompleted
		? 'text-emerald-300'
		: isFailed
			? 'text-rose-300'
			: isStaleDisplay
				? 'text-amber-200'
				: isActive
					? 'text-(--companion-text-soft)'
					: 'text-(--desktop-text-secondary)';
	const agenticDisplay = isAgenticSessionRun(run)
		? agenticSessionDisplaySummary(run, t)
		: null;
	const agenticProgress =
		isActive && isAgenticSessionRun(run)
			? agenticProgressFromRun(run, t)
			: null;
	const showAgenticObservability = Boolean(agenticPlan?.agenticSessionId);
	const agenticGate =
		isAgenticSessionRun(run) && st === 'awaiting_confirmation'
			? parseAgenticGateFromRun(run)
			: null;
	const agenticRefreshToken =
		(Number(run.run_revision) || 0) * 1_000_000_000 +
		(Date.parse(run.updated_at || '') || 0) +
		(run.steps?.length ?? 0) * 1_000_000 +
		(agenticPlan?.sessionStatus?.length ?? 0) * 10_000;
	const agenticDocuments = useAgenticSessionDocuments(
		run,
		agenticPlan?.agenticSessionId
	);
	const statusLabel = operationEffectiveStatusLabel(effectiveDisplay, t);
	const hasCenterDetail =
		Boolean(onFocusRun) &&
		(isActive ||
			isCompleted ||
			isAgenticSessionRun(run) ||
			isUserActionWorkflowRun(run) ||
			agenticDocuments.length > 0 ||
			showAgenticObservability ||
			Boolean(readyImage) ||
			Boolean(readyTrack) ||
			Boolean(presentationSummary) ||
			st === 'awaiting_confirmation');
	const centerFocusLabel =
		st === 'awaiting_confirmation'
			? t('ewaCompanion.centerMissionAnswerInCenter', 'Ответить в центре')
			: isCompleted
				? t('ewaCompanion.centerMissionShowResult', 'Показать результат')
				: agenticDocuments.length > 0 || readyImage || readyTrack
					? t('ewaCompanion.centerMissionShowArtifacts', 'Открыть материалы')
					: isActive
						? t('ewaCompanion.centerMissionShowProgress', 'Показать ход')
						: t('ewaCompanion.centerMissionOpenInCenter', 'Открыть в центре');

	return (
		<li
			data-companion-operation-run-id={run.id}
			className={cn(
				'rounded-md border border-(--companion-divider)/70 bg-(--desktop-surface-soft)/30 px-2 py-1.5',
				freshDone && 'border-emerald-400/60 bg-emerald-500/10',
				highlighted &&
					'ring-2 ring-(--companion-aura)/70 border-(--companion-aura)/60',
				isActive && liveSse && !reducedMotion && 'companion-run-live-pulse'
			)}
		>
			{surfaceControls ? <div className="mb-1">{surfaceControls}</div> : null}
			<div className="min-w-0 space-y-0.5">
				<p className="truncate text-[12px] font-medium text-(--desktop-text-primary)">
					{companionSurfaceBlockCardTitle(
						run,
						agenticDisplay?.title ?? operationIntentLabel(run, t)
					)}
				</p>
				<CompanionSurfaceBlockStrip
					run={run}
					ru={ru}
					onConfirmRun={onConfirmRun}
					onDraftPlayPrompt={onDraftPlayPrompt}
					onFocusRun={onFocusRun}
				/>
				<div className="flex flex-wrap items-center gap-1.5">
					<p className={cn('text-[11px] font-medium', statusTone)}>
						{st === 'completed' ? (
							<CheckCircleIcon className="mr-1 inline size-3 align-[-1px]" />
						) : isFailed ? (
							<ExclamationCircleIcon className="mr-1 inline size-3 align-[-1px]" />
						) : (
							<ClockIcon className="mr-1 inline size-3 align-[-1px]" />
						)}
						{statusLabel}
					</p>
					{timeLabel ? (
						<span className="text-[10px] text-(--companion-text-soft)">
							{timeLabel}
						</span>
					) : null}
				</div>
				{!secondaryRailMode &&
				stepProgress &&
				stepProgress.total > 0 &&
				!workflowProgress ? (
					<div className="mt-1 space-y-1">
						<p className="text-[10px] text-(--companion-text-soft)">
							{stepProgress.title.trim()
								? t('ewaCompanion.musicProgressStep', {
										title: stepProgress.title,
										current: stepProgress.current,
										total: stepProgress.total,
									})
								: t('ewaCompanion.musicProgressPending')}
						</p>
						<div
							className="h-1 overflow-hidden rounded-full bg-(--companion-divider)/50"
							role="progressbar"
							aria-valuemin={musicStepProgressA11y?.valueMin ?? 0}
							aria-valuemax={musicStepProgressA11y?.valueMax ?? 1}
							aria-valuenow={musicStepProgressA11y?.valueNow ?? 0}
							aria-valuetext={
								musicStepProgressA11y
									? t(
											companionProgressBarValueTextKey(
												musicStepProgressA11y.mode
											),
											{
												current: musicStepProgressA11y.current,
												total: musicStepProgressA11y.total,
												percent: musicStepProgressA11y.percent,
											}
										)
									: undefined
							}
						>
							<div
								className="h-full rounded-full bg-(--companion-aura)/80 transition-[width] duration-300"
								style={{
									width: `${Math.min(100, Math.round((stepProgress.current / stepProgress.total) * 100))}%`,
								}}
							/>
						</div>
					</div>
				) : null}
				{!secondaryRailMode && agenticProgress && agenticProgress.total > 0 ? (
					<div className="mt-1 space-y-1.5">
						<p className="text-[10px] text-(--companion-text-soft)">
							{agenticProgress.subtitle.trim() ||
								t('ewaCompanion.agenticProgressRunning')}
						</p>
						<div className="h-1 overflow-hidden rounded-full bg-(--companion-divider)/50">
							<div
								className="h-full rounded-full bg-(--companion-aura)/80 transition-[width] duration-500 ease-out"
								style={{
									width: `${Math.min(
										100,
										Math.round(
											(agenticProgress.current / agenticProgress.total) * 100
										)
									)}%`,
								}}
							/>
						</div>
					</div>
				) : null}
				{!secondaryRailMode &&
				workflowProgress &&
				workflowProgress.total > 0 ? (
					<div className="mt-1 space-y-1.5">
						<p className="text-[10px] text-(--companion-text-soft)">
							{workflowProgress.title.trim()
								? t('ewaCompanion.workflowProgressStep', {
										title: workflowProgress.title,
										current: workflowProgress.current,
										total: workflowProgress.total,
									})
								: t('ewaCompanion.workflowProgressPending')}
						</p>
						<div
							className="h-1 overflow-hidden rounded-full bg-(--companion-divider)/50"
							role="progressbar"
							aria-valuemin={workflowStepProgressA11y?.valueMin ?? 0}
							aria-valuemax={workflowStepProgressA11y?.valueMax ?? 1}
							aria-valuenow={workflowStepProgressA11y?.valueNow ?? 0}
							aria-valuetext={
								workflowStepProgressA11y
									? t(
											companionProgressBarValueTextKey(
												workflowStepProgressA11y.mode
											),
											{
												current: workflowStepProgressA11y.current,
												total: workflowStepProgressA11y.total,
												percent: workflowStepProgressA11y.percent,
											}
										)
									: undefined
							}
						>
							<div
								className="h-full rounded-full bg-(--companion-aura)/80 transition-[width] duration-500 ease-out"
								style={{
									width: `${Math.min(100, Math.round((workflowProgress.current / workflowProgress.total) * 100))}%`,
								}}
							/>
						</div>
					</div>
				) : null}
				{secondaryRailMode && hasCenterDetail ? (
					<div className="mt-1">
						<button
							type="button"
							className={cn(
								'inline-flex items-center gap-1 rounded-md border border-cyan-300/35 px-2 py-1',
								'text-[10px] font-medium text-cyan-50 hover:bg-cyan-300/10',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
							onClick={() => onFocusRun?.(run.id)}
						>
							{centerFocusLabel}
						</button>
					</div>
				) : null}
				{imageContentUnavailable ? (
					<p className="mt-1 text-[10px] text-amber-200/90">
						{t('ewaCompanion.operationsImageContentUnavailable', {
							defaultValue: 'Content unavailable',
						})}
					</p>
				) : null}
				{!secondaryRailMode && readyImage ? (
					<div className="mt-1 flex items-start gap-2">
						<button
							type="button"
							className={cn(
								'shrink-0 overflow-hidden rounded border border-(--companion-divider)',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
							onClick={() =>
								setEnlargedImageContentId(readyImage.unifiedContentId)
							}
							aria-label={t('ewaCompanion.operationsImageEnlarge')}
						>
							<CompanionOperationImagePreview
								contentId={readyImage.unifiedContentId}
								className="size-16 object-cover"
							/>
						</button>
						<p className="line-clamp-3 min-w-0 text-[11px] text-(--companion-text-soft)">
							{readyImage.promptPreview}
						</p>
					</div>
				) : null}
				{!secondaryRailMode && presentationSummary ? (
					<CompanionOperationPresentationCard
						summary={presentationSummary}
						readyPresentation={readyPresentation}
						onOpenInEwrp={onOpenPresentationInEwrp}
					/>
				) : null}
				{agenticDisplay?.subtitle &&
				agenticDisplay.subtitle !== agenticDisplay.title ? (
					<p className="truncate text-[11px] text-(--companion-text-soft)">
						{agenticDisplay.subtitle}
					</p>
				) : null}
				{detailLabel ? (
					<p className="truncate text-[11px] text-(--companion-text-soft)">
						{detailLabel}
					</p>
				) : null}
				{errorLabel ? (
					<div
						className={cn(
							'mt-1 flex items-start gap-1.5 rounded-md border border-rose-400/30 bg-rose-500/10 px-2 py-1.5',
							'text-[11px] leading-snug text-rose-100'
						)}
						role="alert"
						aria-live="assertive"
					>
						<ExclamationCircleIcon
							className="mt-0.5 size-3 shrink-0 text-rose-200"
							aria-hidden
						/>
						<p>{errorLabel}</p>
					</div>
				) : null}
				{!secondaryRailMode && run.steps && run.steps.length > 0 ? (
					<CompanionOperationStepTimeline
						steps={run.steps}
						run={run}
						compact
						reducedMotion={reducedMotion}
					/>
				) : null}
				{!secondaryRailMode &&
				isAgenticSessionRun(run) &&
				agenticDocuments.length > 0 ? (
					<CompanionAgenticSessionArtifacts
						documents={agenticDocuments}
						onOpenDocEditor={(unifiedContentId) =>
							onPlayTrack({
								type: 'open_app',
								app_component: 'DocEditor',
								unified_content_id: unifiedContentId,
							})
						}
						onOpenContentManager={() =>
							onPlayTrack({
								type: 'open_app',
								app_component: 'ContentManagerPro',
							})
						}
					/>
				) : null}
				{!secondaryRailMode &&
				isUserActionWorkflowRun(run) &&
				(isCompleted || isFailed) ? (
					<CompanionWorkflowStepResultsReview
						run={run}
						onPlayTrack={onPlayTrack}
						onDraftPlayPrompt={onDraftPlayPrompt}
						onOpenDocEditor={(unifiedContentId) =>
							onDraftPlayPrompt(
								t('ewaCompanion.workflowOpenDocEditorPrompt', {
									id: unifiedContentId,
								})
							)
						}
						onOpenPresentationInEwrp={onOpenPresentationInEwrp}
						onOpenContentManager={() =>
							onDraftPlayPrompt(t('ewaCompanion.workflowOpenCatalogPrompt'))
						}
						onOpenCompanionPlan={onOpenCompanionPlan}
					/>
				) : null}
			</div>
			{st === 'awaiting_confirmation' && !secondaryRailMode ? (
				agenticGate && !secondaryRailMode ? (
					<AgenticGatePrompt
						runId={run.id}
						gate={agenticGate}
						busy={confirmBusyRunId === run.id}
						onConfirmRun={onConfirmRun}
					/>
				) : (
					<CompanionConfirmBar
						runId={run.id}
						busy={confirmBusyRunId === run.id}
						onConfirm={onConfirmRun}
					/>
				)
			) : null}
			{showAgenticObservability && !secondaryRailMode ? (
				<div className="mt-2 border-t border-(--companion-divider)/40 pt-2">
					<button
						type="button"
						className={cn(
							'inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1',
							'text-[10px] font-medium text-(--companion-aura) hover:bg-white/5',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						aria-expanded={agenticObservabilityOpen}
						onClick={() => setAgenticObservabilityOpen((open) => !open)}
					>
						<span>
							{agenticObservabilityOpen
								? t(
										'ewaCompanion.agenticObservabilityCollapse',
										'Скрыть дерево и трассу'
									)
								: t(
										'ewaCompanion.agenticObservabilityExpand',
										'Показать дерево и трассу'
									)}
						</span>
					</button>
					{agenticObservabilityOpen ? (
						<Suspense
							fallback={
								<p className="mt-2 text-[11px] text-white/50">
									{t(
										'ewaCompanion.agenticObservabilityLoading',
										'Загружаю наблюдаемость…'
									)}
								</p>
							}
						>
							<div className="mt-2">
								<CompanionOperationRunCardAgenticObservability
									sessionId={agenticPlan?.agenticSessionId ?? ''}
									sessionStatus={agenticPlan?.sessionStatus ?? ''}
									refreshToken={agenticRefreshToken}
									run={run}
									onPlayTrack={onPlayTrack}
								/>
							</div>
						</Suspense>
					) : null}
				</div>
			) : null}
			{isFailed && retryPrompt && onRetryPrompt ? (
				<div className="mt-1">
					<button
						type="button"
						className={cn(
							'inline-flex items-center gap-1 rounded-md border border-(--companion-aura)/40 px-2 py-1',
							'text-[11px] text-(--companion-aura) hover:bg-(--companion-aura)/10',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						onClick={() => onRetryPrompt(retryPrompt)}
					>
						<ArrowPathIcon className="size-3" aria-hidden />
						<span>{t('ewaCompanion.operationRetry')}</span>
					</button>
				</div>
			) : null}
			{canCancel ? (
				<div className="mt-1">
					<button
						type="button"
						className={cn(
							'inline-flex items-center gap-1 rounded-md border border-rose-500/40 px-2 py-1',
							'text-[11px] text-rose-200 hover:bg-rose-500/10',
							cancelBusyRunId === run.id && 'opacity-70',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						disabled={cancelBusyRunId === run.id}
						onClick={() => onCancelRun(run.id)}
						aria-label={t('ewaCompanion.operationsCancelRun')}
					>
						<XMarkIcon className="size-3" aria-hidden />
						<span>{t('ewaCompanion.operationsCancelRun')}</span>
					</button>
				</div>
			) : null}
			{!secondaryRailMode && readyTrack ? (
				<div className="mt-1">
					<CompanionOperationMusicCard
						track={readyTrack}
						variant="full"
						onPlayTrack={onPlayTrack}
						playPrompt={playPrompt}
						onDraftPlayPrompt={onDraftPlayPrompt}
					/>
				</div>
			) : null}
			{!secondaryRailMode && readyImage ? (
				<div className="mt-1 flex flex-wrap items-center gap-1">
					<button
						type="button"
						className={cn(
							'inline-flex items-center gap-1 rounded-md border border-(--companion-divider) px-2 py-1',
							'text-[11px] text-(--desktop-text-primary) hover:bg-(--companion-bg)',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						onClick={() =>
							setEnlargedImageContentId(readyImage.unifiedContentId)
						}
					>
						<ArrowsPointingOutIcon className="size-3" aria-hidden />
						<span>{t('ewaCompanion.operationsImageEnlarge')}</span>
					</button>
					{onDownloadImage ? (
						<button
							type="button"
							className={cn(
								'inline-flex items-center gap-1 rounded-md border border-(--companion-divider) px-2 py-1',
								'text-[11px] text-(--desktop-text-primary) hover:bg-(--companion-bg)',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
							onClick={() => onDownloadImage(readyImage)}
						>
							<ArrowDownTrayIcon className="size-3" aria-hidden />
							<span>{t('ewaCompanion.operationsImageDownload')}</span>
						</button>
					) : null}
					{onShareImageToGaf ? (
						<button
							type="button"
							className={cn(
								'inline-flex items-center gap-1 rounded-md border border-(--companion-divider) px-2 py-1',
								'text-[11px] text-(--desktop-text-primary) hover:bg-(--companion-bg)',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
							onClick={() => onShareImageToGaf(readyImage)}
						>
							<ShareIcon className="size-3" aria-hidden />
							<span>{t('ewaCompanion.operationsImageShareGaf')}</span>
						</button>
					) : null}
					{onSendImageToCompanion ? (
						<button
							type="button"
							className={cn(
								'inline-flex items-center gap-1 rounded-md border border-(--companion-divider) px-2 py-1',
								'text-[11px] text-(--companion-aura) hover:bg-(--companion-bg)',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
							onClick={() => onSendImageToCompanion(readyImage)}
						>
							<PaperAirplaneIcon className="size-3" aria-hidden />
							<span>{t('ewaCompanion.operationsImageAnalyze')}</span>
						</button>
					) : null}
					<button
						type="button"
						className={cn(
							'inline-flex items-center gap-1 rounded-md border border-sky-500/40 px-2 py-1',
							'text-[11px] text-sky-100 hover:bg-sky-500/10',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						onClick={() =>
							onDraftPlayPrompt(
								t('ewaCompanion.operationsImageEditDraft', {
									id: readyImage.unifiedContentId,
								})
							)
						}
					>
						<PaperAirplaneIcon className="size-3" aria-hidden />
						<span>{t('ewaCompanion.operationsImageEdit')}</span>
					</button>
					<button
						type="button"
						className={cn(
							'inline-flex items-center gap-1 rounded-md border border-amber-500/40 px-2 py-1',
							'text-[11px] text-amber-100 hover:bg-amber-500/10',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						onClick={() =>
							onDraftPlayPrompt(
								t('ewaCompanion.operationsImageVariantDraft', {
									prompt: readyImage.promptPreview,
								})
							)
						}
					>
						<PaperAirplaneIcon className="size-3" aria-hidden />
						<span>{t('ewaCompanion.operationsImageVariant')}</span>
					</button>
				</div>
			) : null}
			{run.user_message ? (
				<p className="mt-1 line-clamp-2 text-[11px] italic text-(--companion-text-soft)">
					{run.user_message}
				</p>
			) : null}
			{!secondaryRailMode && readyTrack ? (
				<p className="mt-1 text-[11px] text-(--companion-text-soft)">
					{t('ewaCompanion.operationReadyHint')}
				</p>
			) : null}
			{!secondaryRailMode && readyImage ? (
				<p className="mt-1 text-[11px] text-(--companion-text-soft)">
					{t('ewaCompanion.operationImageReadyHint')}
				</p>
			) : null}
			{enlargedImageContentId ? (
				<div
					className="fixed inset-0 z-12000 flex items-center justify-center bg-black/80 p-4"
					role="dialog"
					aria-modal="true"
					aria-label={t('ewaCompanion.operationsImageEnlarge')}
					onClick={(event) => {
						if (event.target === event.currentTarget) {
							setEnlargedImageContentId(null);
						}
					}}
					onKeyDown={(event) => {
						if (event.key === 'Escape') setEnlargedImageContentId(null);
					}}
				>
					<button
						type="button"
						className="absolute right-4 top-4 rounded-md border border-white/20 px-2 py-1 text-[12px] text-white"
						onClick={() => setEnlargedImageContentId(null)}
					>
						{t('ewaCompanion.operationsImageClosePreview')}
					</button>
					<CompanionOperationImagePreview
						contentId={enlargedImageContentId}
						className="max-h-[90vh] max-w-[90vw] rounded object-contain"
					/>
				</div>
			) : null}
		</li>
	);
}

function companionOperationRunCardPropsEqual(
	prev: CompanionOperationRunCardProps,
	next: CompanionOperationRunCardProps
): boolean {
	return (
		prev.ru === next.ru &&
		prev.highlighted === next.highlighted &&
		prev.reducedMotion === next.reducedMotion &&
		prev.liveSse === next.liveSse &&
		prev.secondaryRailMode === next.secondaryRailMode &&
		prev.onFocusRun === next.onFocusRun &&
		prev.surfaceControls === next.surfaceControls &&
		prev.confirmBusyRunId === next.confirmBusyRunId &&
		prev.cancelBusyRunId === next.cancelBusyRunId &&
		companionRunVisualRevision(prev.run) ===
			companionRunVisualRevision(next.run)
	);
}

export const CompanionOperationRunCard = memo(
	CompanionOperationRunCardView,
	companionOperationRunCardPropsEqual
);
