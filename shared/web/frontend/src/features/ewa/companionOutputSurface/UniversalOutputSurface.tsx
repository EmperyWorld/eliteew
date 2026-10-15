/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Universal Output Surface V2 renderer for task-run/result/confirm cards with close, pin, restore and history controls.
 * Lifecycle prefs come from useCompanionViewPrefs (SLM SSOT) — no component-local lifecycle useState.
 *
 * Invariants:
 * - UI lifecycle actions are local view preferences; they do not cancel task runs or execute tools.
 * - Confirm/cancel buttons delegate to existing task-run APIs owned by the operations card.
 *
 * Related:
 * - src/pages/Desktop/shell/useCompanionViewPrefs.ts
 * - src/features/ewa/companionOperations/CompanionOperationsPanel.tsx
 * - src/features/ewa/companionOutputSurface/companionSurfaceLifecycle.ts
 */

import {
	BookmarkIcon,
	ChatBubbleLeftRightIcon,
	ClockIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import {
	VirtualVariableList,
	type VirtualVariableListHandle,
} from '@/components/shared/VirtualList';
import { CompanionOperationRunCard } from '@/features/ewa/companionOperations/CompanionOperationRunCard';
import type { OperationReadyImage } from '@/features/ewa/companionOperations/companionOperationsUi';
import {
	cardIdForRun,
	deriveCompanionSurfaceCardRefs,
	legacyCardIdsForRun,
	type CompanionSurfaceCardZone,
} from '@/features/ewa/companionOutputSurface/companionSurfaceLifecycle';
import { CompanionPillButton } from '@/features/ewa/companionPremiumPrimitives';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { useCompanionViewPrefs } from '@/pages/Desktop/shell/useCompanionViewPrefs';
import type {
	CompanionChatAction,
	EwaCompanionTaskRun,
} from '@/services/ewa/ewaCompanionChatApi';
import { cn } from '@/utils/cn';

export type UniversalOutputSurfaceProps = {
	principalId: string;
	runs: EwaCompanionTaskRun[];
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
	reducedMotion?: boolean;
	liveActiveRunIds?: ReadonlySet<string>;
	/** T1 / V-H5: poll refresh failure demotes live chrome on cards. */
	pollDegradedKind?:
		| import('@/features/ewa/companionOperations/companionOperationsStore').CompanionOperationsDegradedKind
		| null;
	onFocusRun?: (runId: string) => void;
	onOpenCompanionPlan?: () => void;
	/** Pixel height for the virtualized run list scrollport. */
	virtualListHeight?: number;
	secondaryRailMode?: boolean;
};

function SurfaceControlButton({
	label,
	onClick,
	active = false,
	children,
}: {
	label: string;
	onClick: () => void;
	active?: boolean;
	children: ReactNode;
}) {
	return (
		<CompanionPillButton
			className={cn(
				'rounded-md px-1.5 py-0.5 text-[10px]',
				active
					? 'border-(--companion-aura)/70 bg-(--companion-aura)/10 text-(--companion-aura)'
					: 'border-(--companion-divider) text-(--companion-text-soft) hover:bg-(--companion-bg)',
				DESKTOP_CHROME_FOCUS_VISIBLE
			)}
			onClick={onClick}
			aria-label={label}
			title={label}
		>
			{children}
		</CompanionPillButton>
	);
}

function DiscussRunButton({
	run,
	companionDisplayName,
	onDraftPlayPrompt,
}: {
	run: EwaCompanionTaskRun;
	companionDisplayName: string;
	onDraftPlayPrompt: (text: string) => void;
}) {
	const { t } = useTranslation('marketing');
	const displayName = companionDisplayName.trim() || 'EWA';
	return (
		<SurfaceControlButton
			label={t('ewaCompanion.surfaceDiscussWithName', { name: displayName })}
			onClick={() => {
				const label = run.user_message?.trim() || run.intent_kind || run.id;
				onDraftPlayPrompt(
					t('ewaCompanion.surfaceDiscussPrompt', {
						runId: run.id,
						label,
					})
				);
			}}
		>
			<ChatBubbleLeftRightIcon className="size-3" aria-hidden />
			<span>{t('ewaCompanion.surfaceDiscuss')}</span>
		</SurfaceControlButton>
	);
}

function ZoneTitle({
	zone,
	count,
}: {
	zone: CompanionSurfaceCardZone;
	count: number;
}) {
	const { t } = useTranslation('marketing');
	const key =
		zone === 'pinned'
			? 'ewaCompanion.surfacePinnedSection'
			: zone === 'history'
				? 'ewaCompanion.surfaceHistorySection'
				: 'ewaCompanion.surfaceActiveSection';
	return (
		<p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-(--companion-text-soft)">
			{zone === 'history' ? <ClockIcon className="size-3" aria-hidden /> : null}
			<span>{t(key, { count })}</span>
		</p>
	);
}

type SurfaceVirtualEntry =
	| { kind: 'zone-title'; zone: CompanionSurfaceCardZone; key: string }
	| {
			kind: 'run-card';
			refId: string;
			zone: CompanionSurfaceCardZone;
			key: string;
	  };

const SURFACE_ZONE_TITLE_ESTIMATE_PX = 28;
const SURFACE_RUN_CARD_ESTIMATE_PX = 168;
const SURFACE_VIRTUAL_LIST_DEFAULT_HEIGHT = 280;

function UniversalOutputSurfaceView({
	principalId,
	runs,
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
	companionDisplayName,
	highlightedRunId = null,
	onRetryPrompt,
	reducedMotion = false,
	liveActiveRunIds,
	pollDegradedKind = null,
	onFocusRun,
	onOpenCompanionPlan,
	virtualListHeight = SURFACE_VIRTUAL_LIST_DEFAULT_HEIGHT,
	secondaryRailMode = false,
}: UniversalOutputSurfaceProps) {
	const { t } = useTranslation('marketing');
	const virtualListRef = useRef<VirtualVariableListHandle | null>(null);
	const { lifecycle, dispatchLifecycle } = useCompanionViewPrefs(principalId);

	const refs = useMemo(
		() => deriveCompanionSurfaceCardRefs(runs, lifecycle),
		[runs, lifecycle]
	);
	const runById = useMemo(
		() => new Map(runs.map((run) => [cardIdForRun(run), run])),
		[runs]
	);
	const visibleRefs = useMemo(
		() => refs.filter((ref) => !ref.dismissed),
		[refs]
	);
	const dismissedRefs = useMemo(
		() => refs.filter((ref) => ref.dismissed),
		[refs]
	);
	const byZone = useMemo(
		() => ({
			pinned: visibleRefs.filter((ref) => ref.zone === 'pinned'),
			active: visibleRefs.filter((ref) => ref.zone === 'active'),
			history: visibleRefs.filter((ref) => ref.zone === 'history'),
		}),
		[visibleRefs]
	);

	const virtualEntries = useMemo((): SurfaceVirtualEntry[] => {
		const entries: SurfaceVirtualEntry[] = [];
		for (const zone of ['pinned', 'active'] as const) {
			if (byZone[zone].length === 0) continue;
			entries.push({
				kind: 'zone-title',
				zone,
				key: `zone-title-${zone}`,
			});
			for (const ref of byZone[zone]) {
				entries.push({
					kind: 'run-card',
					refId: ref.id,
					zone,
					key: ref.id,
				});
			}
		}
		if (byZone.history.length > 0) {
			entries.push({
				kind: 'zone-title',
				zone: 'history',
				key: 'zone-title-history',
			});
			if (lifecycle.historyExpanded) {
				for (const ref of byZone.history) {
					entries.push({
						kind: 'run-card',
						refId: ref.id,
						zone: 'history',
						key: ref.id,
					});
				}
			}
		}
		return entries;
	}, [byZone, lifecycle.historyExpanded]);

	const virtualEntriesRef = useRef(virtualEntries);
	virtualEntriesRef.current = virtualEntries;

	const highlightedScrollKey = useMemo(() => {
		if (!highlightedRunId) return '';
		const index = virtualEntries.findIndex(
			(entry) =>
				entry.kind === 'run-card' &&
				runById.get(entry.refId)?.id === highlightedRunId
		);
		return index >= 0 ? `${highlightedRunId}:${index}` : '';
	}, [highlightedRunId, runById, virtualEntries]);

	useEffect(() => {
		if (!highlightedScrollKey) return;
		const index = Number(highlightedScrollKey.split(':')[1]);
		if (!Number.isFinite(index) || index < 0) return;
		virtualListRef.current?.scrollToIndex(index, {
			align: 'start',
			behavior: 'smooth',
		});
	}, [highlightedScrollKey]);

	const renderRun = useCallback(
		(id: string, zone: CompanionSurfaceCardZone) => {
			const run = runById.get(id);
			if (!run) return null;
			const isPinned = lifecycle.pinnedIds.includes(id);
			const isHighlighted = highlightedRunId === run.id;
			return (
				<CompanionOperationRunCard
					run={run}
					ru={ru}
					highlighted={isHighlighted}
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
					onRetryPrompt={onRetryPrompt}
					reducedMotion={reducedMotion}
					liveSse={liveActiveRunIds?.has(run.id) ?? false}
					pollDegradedKind={pollDegradedKind}
					onFocusRun={onFocusRun}
					onOpenCompanionPlan={onOpenCompanionPlan}
					secondaryRailMode={secondaryRailMode}
					surfaceControls={
						<div className="flex flex-wrap justify-end gap-1">
							{zone === 'history' ? (
								<SurfaceControlButton
									label={t('ewaCompanion.surfaceRestore')}
									onClick={() => dispatchLifecycle({ type: 'restore', id })}
								>
									<span>{t('ewaCompanion.surfaceRestore')}</span>
								</SurfaceControlButton>
							) : null}
							<DiscussRunButton
								run={run}
								companionDisplayName={companionDisplayName}
								onDraftPlayPrompt={onDraftPlayPrompt}
							/>
							<SurfaceControlButton
								label={
									isPinned
										? t('ewaCompanion.surfaceUnpin')
										: t('ewaCompanion.surfacePin')
								}
								active={isPinned}
								onClick={() =>
									dispatchLifecycle({ type: isPinned ? 'unpin' : 'pin', id })
								}
							>
								<BookmarkIcon className="size-3" aria-hidden />
								<span>
									{isPinned
										? t('ewaCompanion.surfaceUnpinShort')
										: t('ewaCompanion.surfacePinShort')}
								</span>
							</SurfaceControlButton>
							<SurfaceControlButton
								label={t('ewaCompanion.surfaceClose')}
								onClick={() =>
									dispatchLifecycle({
										type: 'close',
										id,
										alsoIds: legacyCardIdsForRun(run),
									})
								}
							>
								<XMarkIcon className="size-3" aria-hidden />
								<span>{t('ewaCompanion.surfaceCloseShort')}</span>
							</SurfaceControlButton>
						</div>
					}
				/>
			);
		},
		[
			cancelBusyRunId,
			companionDisplayName,
			confirmBusyRunId,
			highlightedRunId,
			lifecycle.pinnedIds,
			liveActiveRunIds,
			pollDegradedKind,
			onCancelRun,
			onConfirmRun,
			onDownloadImage,
			onDraftPlayPrompt,
			onFocusRun,
			onOpenCompanionPlan,
			onOpenPresentationInEwrp,
			onPlayTrack,
			onRetryPrompt,
			onSendImageToCompanion,
			onShareImageToGaf,
			reducedMotion,
			ru,
			runById,
			secondaryRailMode,
			t,
			dispatchLifecycle,
		]
	);

	const estimateEntrySize = useCallback((index: number) => {
		const entry = virtualEntriesRef.current[index];
		if (!entry) return SURFACE_RUN_CARD_ESTIMATE_PX;
		return entry.kind === 'zone-title'
			? SURFACE_ZONE_TITLE_ESTIMATE_PX
			: SURFACE_RUN_CARD_ESTIMATE_PX;
	}, []);

	const getVirtualEntryKey = useCallback(
		(index: number) => virtualEntriesRef.current[index]?.key ?? index,
		[]
	);

	const renderVirtualEntry = useCallback(
		(entry: SurfaceVirtualEntry) => {
			if (entry.kind === 'zone-title') {
				if (entry.zone === 'history' && !lifecycle.historyExpanded) {
					return (
						<p className="rounded-md border border-(--companion-divider)/70 px-2 py-1 text-[11px] text-(--companion-text-soft)">
							{t('ewaCompanion.surfaceHistoryCollapsed', {
								count: byZone.history.length,
							})}
						</p>
					);
				}
				return (
					<ZoneTitle zone={entry.zone} count={byZone[entry.zone].length} />
				);
			}
			return (
				<ul className="grid grid-cols-1 gap-1 pb-1">
					{renderRun(entry.refId, entry.zone)}
				</ul>
			);
		},
		[byZone, lifecycle.historyExpanded, renderRun, t]
	);

	if (visibleRefs.length === 0 && dismissedRefs.length === 0) return null;

	return (
		<div className="flex flex-col gap-2">
			{byZone.history.length > 0 ? (
				<div className="mb-1 flex items-center justify-end gap-2">
					<SurfaceControlButton
						label={t('ewaCompanion.surfaceHistoryToggle')}
						active={lifecycle.historyExpanded}
						onClick={() => dispatchLifecycle({ type: 'toggle_history' })}
					>
						<span>
							{lifecycle.historyExpanded
								? t('ewaCompanion.surfaceHistoryCollapse')
								: t('ewaCompanion.surfaceHistoryOpen', {
										count: byZone.history.length,
									})}
						</span>
					</SurfaceControlButton>
				</div>
			) : null}
			{virtualEntries.length > 0 ? (
				<VirtualVariableList
					virtualListRef={virtualListRef}
					items={virtualEntries}
					estimateSize={estimateEntrySize}
					getItemKey={getVirtualEntryKey}
					height={virtualListHeight}
					overscanCount={3}
					className="min-h-0"
					renderItem={renderVirtualEntry}
				/>
			) : null}
			{dismissedRefs.length > 0 ? (
				<div className="flex justify-end">
					<SurfaceControlButton
						label={t('ewaCompanion.surfaceRestoreClosed')}
						onClick={() => {
							for (const ref of dismissedRefs) {
								dispatchLifecycle({ type: 'restore', id: ref.id });
							}
						}}
					>
						<span>
							{t('ewaCompanion.surfaceRestoreClosed', {
								count: dismissedRefs.length,
							})}
						</span>
					</SurfaceControlButton>
				</div>
			) : null}
		</div>
	);
}

export const UniversalOutputSurface = memo(UniversalOutputSurfaceView);
