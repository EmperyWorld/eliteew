/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Extracted companion operations panel — Universal Output Surface V2 for active/result/confirm/history cards.
 *
 * Invariants:
 * - View controls (close/pin/restore) never cancel runs; explicit cancel remains a separate task-run API.
 *
 * Related:
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */

import {
	ArrowPathIcon,
	CheckCircleIcon,
	ChevronDownIcon,
	ClockIcon,
	SparklesIcon,
} from '@heroicons/react/24/outline';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	OPERATIONS_DISPLAY_LIMIT_DEFAULT,
	isOperationTruthfullyLive,
	partitionOperationRuns,
	resolveOperationEffectiveDisplayState,
} from '@/features/ewa/companionOperations/companionOperationsUi';
import type { OperationReadyImage } from '@/features/ewa/companionOperations/companionOperationsUi';
import type { CompanionOperationsDegradedKind } from '@/features/ewa/companionOperations/companionOperationsStore';
import { UniversalOutputSurface } from '@/features/ewa/companionOutputSurface/UniversalOutputSurface';
import {
	CompanionGlassSection,
	CompanionPillBadge,
} from '@/features/ewa/companionPremiumPrimitives';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import type { CompanionChatAction } from '@/services/ewa/ewaCompanionChatApi';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';
import { cn } from '@/utils/cn';

export type CompanionOperationsPanelProps = {
	principalId: string;
	operationRuns: EwaCompanionTaskRun[];
	operationsExpanded: boolean;
	onToggleExpanded: () => void;
	operationsRefreshing: boolean;
	onRefresh: () => void;
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
	companionDisplayName: string;
	ru: boolean;
	highlightedRunId?: string | null;
	onRetryPrompt?: (prompt: string) => void;
	reducedMotion?: boolean;
	liveActiveRunIds?: ReadonlySet<string>;
	onFocusRun?: (runId: string) => void;
	onOpenCompanionPlan?: () => void;
	/** U3.4 — expanded history via existing task-runs list API. */
	operationsDisplayLimit?: number;
	canLoadMoreHistory?: boolean;
	onLoadMoreHistory?: () => void;
	loadMoreHistoryBusy?: boolean;
	/** Desktop right rail: stretch panel to aside height; scroll runs inside. */
	fillViewport?: boolean;
	secondaryRailMode?: boolean;
	/** T1 / V-H5: poll/SSE refresh failure — never show live chrome while set. */
	operationsLastErrorKind?: CompanionOperationsDegradedKind | null;
	operationsLastErrorMessage?: string | null;
};

const OPERATIONS_FILL_VIEWPORT_MIN_HEIGHT = 240;
const OPERATIONS_FILL_VIEWPORT_FALLBACK_HEIGHT = 360;

function useMeasuredOperationsViewport(enabled: boolean) {
	const ref = useRef<HTMLDivElement | null>(null);
	const [height, setHeight] = useState<number | null>(null);

	useEffect(() => {
		if (!enabled) {
			setHeight(null);
			return;
		}
		const el = ref.current;
		if (!el) return;

		let rafId: number | null = null;
		const measure = () => {
			const next = Math.floor(el.getBoundingClientRect().height);
			if (!Number.isFinite(next) || next <= 0) return;
			setHeight((prev) => (prev === next ? prev : next));
		};
		const scheduleMeasure = () => {
			if (typeof window === 'undefined') {
				measure();
				return;
			}
			if (rafId !== null) window.cancelAnimationFrame(rafId);
			rafId = window.requestAnimationFrame(() => {
				rafId = null;
				measure();
			});
		};

		measure();
		if (typeof ResizeObserver === 'undefined') {
			window.addEventListener('resize', scheduleMeasure);
			return () => {
				window.removeEventListener('resize', scheduleMeasure);
				if (rafId !== null) window.cancelAnimationFrame(rafId);
			};
		}

		const observer = new ResizeObserver(scheduleMeasure);
		observer.observe(el);
		return () => {
			observer.disconnect();
			if (rafId !== null) window.cancelAnimationFrame(rafId);
		};
	}, [enabled]);

	const virtualListHeight = useMemo(() => {
		if (!enabled) return undefined;
		return Math.max(
			height ?? OPERATIONS_FILL_VIEWPORT_FALLBACK_HEIGHT,
			OPERATIONS_FILL_VIEWPORT_MIN_HEIGHT
		);
	}, [enabled, height]);

	return { ref, virtualListHeight };
}

function CompanionOperationsPanelView({
	principalId,
	operationRuns,
	operationsExpanded,
	onToggleExpanded,
	operationsRefreshing,
	onRefresh,
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
	companionDisplayName,
	ru,
	highlightedRunId = null,
	onRetryPrompt,
	reducedMotion = false,
	liveActiveRunIds,
	onFocusRun,
	onOpenCompanionPlan,
	operationsDisplayLimit = OPERATIONS_DISPLAY_LIMIT_DEFAULT,
	canLoadMoreHistory = false,
	onLoadMoreHistory,
	loadMoreHistoryBusy = false,
	fillViewport = false,
	secondaryRailMode = false,
	operationsLastErrorKind = null,
	operationsLastErrorMessage = null,
}: CompanionOperationsPanelProps) {
	const { t } = useTranslation('marketing');
	const { active, history } = partitionOperationRuns(
		operationRuns,
		operationsDisplayLimit
	);
	const surfaceRuns = [...active, ...history];
	const totalShown = active.length + history.length;
	const readyCount = operationRuns.filter(
		(run) => (run.status || '').trim().toLowerCase() === 'completed'
	).length;
	const pollDegraded =
		operationsLastErrorKind === 'stale' ||
		operationsLastErrorKind === 'backend' ||
		operationsLastErrorKind === 'auth';
	const truthfulLiveCount = active.filter((run) =>
		isOperationTruthfullyLive(
			resolveOperationEffectiveDisplayState(run, {
				pollDegradedKind: operationsLastErrorKind,
			})
		)
	).length;
	const hasActive = truthfulLiveCount > 0;
	const hasRuns = totalShown > 0;
	const displayName = companionDisplayName.trim() || 'EWA';
	const measuredViewport = useMeasuredOperationsViewport(
		fillViewport && hasRuns && operationsExpanded
	);
	const degradedBannerBody =
		operationsLastErrorMessage?.trim() ||
		(operationsLastErrorKind === 'auth'
			? t(
					'ewaCompanion.centerMissionAuthBody',
					'Сессия истекла — войдите снова, чтобы обновить операции.'
				)
			: operationsLastErrorKind === 'backend'
				? t(
						'ewaCompanion.centerMissionDegradedBody',
						'Сервер не ответил на обновление списка — показан последний снимок.'
					)
				: t(
						'ewaCompanion.operationsRailStaleBody',
						'Список операций мог устареть — нажмите обновить.'
					));

	return (
		<CompanionGlassSection
			className={cn(
				'relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl',
				fillViewport && 'h-full min-h-full flex-1',
				!hasRuns && 'border-white/10 bg-white/[0.035]',
				'shadow-[0_18px_46px_rgba(2,6,23,0.22)]'
			)}
		>
			<div
				className={cn(
					'flex shrink-0 flex-col px-2.5 py-2',
					hasRuns ? 'gap-2' : 'gap-1.5',
					'items-stretch'
				)}
			>
				<div className="flex min-w-0 items-start gap-2">
					<div className="min-w-0 flex-1">
						<CompanionPillBadge
							className={cn(
								'mb-1 inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.16em]',
								hasRuns
									? 'text-(--companion-aura)'
									: 'text-(--companion-text-soft)'
							)}
						>
							<SparklesIcon className="size-3" aria-hidden />
							<span>{t('ewaCompanion.operationsPanelEyebrow')}</span>
						</CompanionPillBadge>
						<button
							type="button"
							className={cn(
								'group inline-flex min-w-0 items-center gap-1.5 text-left',
								'text-[13px] font-semibold text-(--desktop-text-primary)',
								!hasRuns && 'cursor-default',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
							disabled={!hasRuns}
							onClick={onToggleExpanded}
							aria-expanded={hasRuns ? operationsExpanded : false}
						>
							<ChevronDownIcon
								className={cn(
									'size-3.5 shrink-0 text-(--companion-text-soft) transition-transform group-hover:text-(--companion-aura)',
									operationsExpanded && hasRuns && 'rotate-180',
									!hasRuns && 'opacity-45'
								)}
								aria-hidden
							/>
							<span className="truncate">
								{t('ewaCompanion.operationsPanelTitle')}
							</span>
							{hasActive ? (
								<span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-100">
									<span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.9)]" />
									{t('ewaCompanion.operationsPanelLive')}
								</span>
							) : pollDegraded && active.length > 0 ? (
								<span
									className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-100"
									data-testid="ewa-companion-operations-rail-stale-pill"
								>
									{t(
										'ewaCompanion.operationStatusStale',
										'Нет свежего статуса'
									)}
								</span>
							) : null}
						</button>
						<p className="mt-0.5 text-[10px] text-(--companion-text-soft)">
							{hasRuns
								? t('ewaCompanion.operationsPanelSubtitle', {
										active: truthfulLiveCount,
										history: history.length,
										limit: operationsDisplayLimit,
									})
								: t('ewaCompanion.operationsPanelIdle', {
										name: displayName,
									})}
						</p>
						{pollDegraded ? (
							<p
								className="mt-1 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-100"
								role="status"
								data-testid="ewa-companion-operations-rail-degraded"
							>
								{degradedBannerBody}
							</p>
						) : null}
					</div>
					<button
						type="button"
						className={cn(
							'relative z-10 inline-flex min-h-8 min-w-8 shrink-0 items-center justify-center',
							'rounded-lg border border-white/10 bg-white/5 p-1',
							'text-(--companion-text-soft) hover:border-(--companion-divider) hover:bg-(--companion-bg) hover:text-(--companion-aura)',
							'pointer-events-auto touch-manipulation',
							operationsRefreshing && 'opacity-70',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						disabled={operationsRefreshing}
						onClick={(e) => {
							e.stopPropagation();
							onRefresh();
						}}
						aria-label={t('ewaCompanion.operationsRefreshAria')}
						aria-busy={operationsRefreshing}
					>
						<ArrowPathIcon
							className={cn('size-3.5', operationsRefreshing && 'animate-spin')}
							aria-hidden
						/>
					</button>
				</div>
				{hasRuns ? (
					<div className="flex w-full shrink-0 flex-wrap items-center justify-start gap-1.5">
						<CompanionPillBadge
							className={cn(
								'inline-flex items-center gap-1 px-1.5',
								hasActive
									? 'border-emerald-300/35 bg-emerald-400/10 text-emerald-100'
									: 'bg-white/5',
								'whitespace-nowrap text-[10px] font-medium'
							)}
						>
							<ClockIcon className="size-3" aria-hidden />
							{t('ewaCompanion.operationsMetricActive', {
								count: truthfulLiveCount,
							})}
						</CompanionPillBadge>
						<CompanionPillBadge
							className={cn(
								'inline-flex items-center gap-1 border-(--companion-divider) bg-(--companion-bg) px-1.5',
								'whitespace-nowrap text-[10px] font-medium text-(--companion-aura)'
							)}
						>
							<CheckCircleIcon className="size-3" aria-hidden />
							{t('ewaCompanion.operationsMetricReady', { count: readyCount })}
						</CompanionPillBadge>
						<CompanionPillBadge className="bg-white/5 px-1.5 whitespace-nowrap text-[10px] font-medium">
							{t('ewaCompanion.operationsMetricHistory', {
								count: history.length,
							})}
						</CompanionPillBadge>
					</div>
				) : null}
			</div>
			{hasRuns ? (
				operationsExpanded ? (
					<div
						ref={measuredViewport.ref}
						data-testid="ewa-companion-operations-fill-viewport"
						className={cn(
							'flex flex-col gap-2 overflow-y-auto overscroll-y-contain',
							'border-t border-white/10 bg-black/10 px-2.5 pt-2 pb-2.5',
							fillViewport ? 'min-h-0 flex-1' : 'max-h-[min(44vh,17rem)]'
						)}
					>
						{active.length === 0 ? (
							<p className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] text-(--companion-text-soft)">
								{t('ewaCompanion.operationsNoActive')}
							</p>
						) : null}
						<UniversalOutputSurface
							principalId={principalId}
							runs={surfaceRuns}
							ru={ru}
							confirmBusyRunId={confirmBusyRunId}
							cancelBusyRunId={cancelBusyRunId}
							onConfirmRun={onConfirmRun}
							onCancelRun={onCancelRun}
							onPlayTrack={onPlayTrack}
							onDraftPlayPrompt={onDraftPlayPrompt}
							onOpenPresentationInEwrp={onOpenPresentationInEwrp}
							onDownloadImage={onDownloadImage}
							onShareImageToGaf={onShareImageToGaf}
							onSendImageToCompanion={onSendImageToCompanion}
							companionDisplayName={displayName}
							highlightedRunId={highlightedRunId}
							onRetryPrompt={onRetryPrompt}
							reducedMotion={reducedMotion}
							liveActiveRunIds={liveActiveRunIds}
							pollDegradedKind={operationsLastErrorKind}
							onFocusRun={onFocusRun}
							onOpenCompanionPlan={onOpenCompanionPlan}
							virtualListHeight={measuredViewport.virtualListHeight}
							secondaryRailMode={secondaryRailMode}
						/>
						{canLoadMoreHistory && onLoadMoreHistory ? (
							<button
								type="button"
								className={cn(
									'mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5',
									'text-[11px] font-medium text-(--companion-aura)',
									'hover:border-(--companion-divider) hover:bg-(--companion-bg)',
									loadMoreHistoryBusy && 'opacity-70',
									DESKTOP_CHROME_FOCUS_VISIBLE
								)}
								disabled={loadMoreHistoryBusy || operationsRefreshing}
								onClick={onLoadMoreHistory}
							>
								{loadMoreHistoryBusy || operationsRefreshing
									? t('ewaCompanion.operationsHistoryLoadingMore')
									: t('ewaCompanion.operationsHistoryShowMore')}
							</button>
						) : null}
					</div>
				) : (
					<p className="border-t border-white/10 bg-black/10 px-3 py-1.5 text-[10px] text-(--companion-text-soft)">
						{t('ewaCompanion.operationsPanelCollapsedHint', {
							active: active.length,
							ready: readyCount,
						})}
					</p>
				)
			) : null}
		</CompanionGlassSection>
	);
}

export const CompanionOperationsPanel = memo(CompanionOperationsPanelView);
