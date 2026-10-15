/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Mobile operations bottom sheet (U5.1) with Universal Output Surface V2 lifecycle (U4.8).
 *
 * Invariants:
 * - Scrolls highlighted run into view when opened via deep link or focus (U5.10).
 * - Mobile sheet is a primary control surface; cancel/confirm/media controls stay visible.
 *
 * Related:
 * - src/features/ewa/companionOutputSurface/UniversalOutputSurface.tsx
 * - src/features/ewa/companionOperations/CompanionOperationsPanel.tsx
 */

import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { OperationReadyImage } from '@/features/ewa/companionOperations/companionOperationsUi';
import { partitionOperationRuns } from '@/features/ewa/companionOperations/companionOperationsUi';
import { UniversalOutputSurface } from '@/features/ewa/companionOutputSurface/UniversalOutputSurface';
import { CompanionMobileBottomSheet } from '@/features/ewa/companionUx/CompanionMobileBottomSheet';
import type { CompanionChatAction } from '@/services/ewa/ewaCompanionChatApi';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';

export type CompanionMobileOperationsSheetProps = {
	open: boolean;
	onClose: () => void;
	principalId: string;
	operationRuns: EwaCompanionTaskRun[];
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
	companionDisplayName: string;
	highlightedRunId?: string | null;
	onRetryPrompt?: (prompt: string) => void;
	onRefresh?: () => void;
	refreshing?: boolean;
	reducedMotion?: boolean;
	liveActiveRunIds?: ReadonlySet<string>;
	onFocusRun?: (runId: string) => void;
	onOpenCompanionPlan?: () => void;
	operationsDisplayLimit?: number;
	canLoadMoreHistory?: boolean;
	onLoadMoreHistory?: () => void;
	loadMoreHistoryBusy?: boolean;
};

export function CompanionMobileOperationsSheet({
	open,
	onClose,
	principalId,
	operationRuns,
	ru,
	confirmBusyRunId,
	cancelBusyRunId,
	onConfirmRun,
	onCancelRun,
	onPlayTrack,
	onDraftPlayPrompt,
	onOpenPresentationInEwrp,
	onDownloadImage,
	onShareImageToGaf,
	onSendImageToCompanion,
	companionDisplayName,
	highlightedRunId,
	onRetryPrompt,
	onRefresh,
	refreshing = false,
	reducedMotion = false,
	liveActiveRunIds,
	onFocusRun,
	onOpenCompanionPlan,
	operationsDisplayLimit,
	canLoadMoreHistory = false,
	onLoadMoreHistory,
	loadMoreHistoryBusy = false,
}: CompanionMobileOperationsSheetProps) {
	const { t } = useTranslation('marketing');

	const surfaceRuns = useMemo(() => {
		if (!operationsDisplayLimit) return operationRuns;
		const { active, history } = partitionOperationRuns(
			operationRuns,
			operationsDisplayLimit
		);
		return [...active, ...history];
	}, [operationRuns, operationsDisplayLimit]);

	useEffect(() => {
		if (!open || !highlightedRunId?.trim()) return;
		const timer = window.setTimeout(() => {
			const el = document.querySelector(
				`[data-companion-operation-run-id="${CSS.escape(highlightedRunId.trim())}"]`
			);
			el?.scrollIntoView({
				block: 'nearest',
				behavior: reducedMotion ? 'auto' : 'smooth',
			});
		}, 120);
		return () => window.clearTimeout(timer);
	}, [highlightedRunId, open, reducedMotion]);

	return (
		<CompanionMobileBottomSheet
			open={open}
			title={t('ewaCompanion.operationsSheetTitle')}
			onClose={onClose}
			testId="ewa-companion-mobile-operations-sheet"
		>
			{onRefresh ? (
				<button
					type="button"
					className="mb-2 text-[11px] text-(--companion-aura) underline-offset-2 hover:underline"
					disabled={refreshing}
					onClick={onRefresh}
				>
					{refreshing
						? t('ewaCompanion.operationsRefreshing')
						: t('ewaCompanion.operationsRefresh')}
				</button>
			) : null}
			{surfaceRuns.length === 0 ? (
				<p className="py-6 text-center text-[12px] text-(--companion-text-soft)">
					{t('ewaCompanion.operationsEmpty')}
				</p>
			) : (
				<div className="pb-2">
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
						companionDisplayName={companionDisplayName}
						highlightedRunId={highlightedRunId}
						onRetryPrompt={onRetryPrompt}
						reducedMotion={reducedMotion}
						liveActiveRunIds={liveActiveRunIds}
						onFocusRun={onFocusRun}
						onOpenCompanionPlan={onOpenCompanionPlan}
					/>
					{canLoadMoreHistory && onLoadMoreHistory ? (
						<button
							type="button"
							className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-medium text-(--companion-aura) hover:bg-white/10 disabled:opacity-70"
							disabled={loadMoreHistoryBusy || refreshing}
							onClick={onLoadMoreHistory}
						>
							{loadMoreHistoryBusy || refreshing
								? t('ewaCompanion.operationsHistoryLoadingMore')
								: t('ewaCompanion.operationsHistoryShowMore')}
						</button>
					) : null}
				</div>
			)}
		</CompanionMobileBottomSheet>
	);
}
