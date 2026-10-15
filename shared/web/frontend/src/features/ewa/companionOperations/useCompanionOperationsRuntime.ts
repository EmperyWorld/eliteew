/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Side-effect runtime for companion operations: poll, SSE bridge, confirm/cancel,
 * toasts, and background play dispatch — writes into companionOperationsStore.
 *
 * Invariants:
 * - SSE-first: when active runs and task-events stream are enabled, periodic GET is safety-only (≥5 min).
 * - Poll uses list_profile=summary with includeSteps on reconcile GETs.
 * - Terminal SSE refresh may request steps once.
 * - Session tracking refs prune when runs leave OPERATIONS_STORE_CAP.
 * - Parent callbacks (onNewActiveRun, onDispatchActions, notify*) use refs — not effect deps.
 * - Runtime bridge handlers register once; poll loop reads flags from refs to avoid restart cascades.
 * - syncTaskRunSnapshot patches store only; list refetch is owned by submit/SSE handlers.
 * - Focus/visibility refresh runs only when the document is visible; stale responses ignore store writes.
 * - Idle background (no active runs + EWA window not foreground): stop periodic GET; restart on window/tab focus.
 *
 * Related:
 * - companionOperationsStore.ts
 * - useCompanionTaskEventsStream.ts
 */

import { useCallback, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { TFunction } from 'i18next';

import {
	ACTIVE_OPERATION_STATUSES,
	extractBackgroundPlayAction,
	mergeOperationRuns,
	OPERATIONS_FETCH_LIMIT_EXPANDED,
} from '@/features/ewa/companionOperations/companionOperationsUi';
import {
	type CompanionOperationsDegradedKind,
	selectActiveRunIdsKey,
	selectHasActiveOperations,
	selectOperationsFetchLimit,
	selectDisplayOperationRuns,
	useCompanionOperationsStore,
} from '@/features/ewa/companionOperations/companionOperationsStore';
import {
	clearCompanionOperationsRuntimeHandlers,
	setCompanionOperationsRuntimeHandlers,
} from '@/features/ewa/companionOperations/companionOperationsRuntimeBridge';
import { useCompanionTaskEventsStream } from '@/features/ewa/companionOperations/useCompanionTaskEventsStream';
import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';
import { resolveCompanionOperationCompletedToast } from '@/features/ewa/companionUx/companionUserSuccessToasts';
import type { CompanionChatAction } from '@/services/ewa/ewaCompanionChatApi';
import {
	cancelEwaCompanionTaskRun,
	coerceCompanionActions,
	coerceTaskRunListRow,
	confirmEwaCompanionTaskRun,
	isCompanionTaskRunRevisionConflictError,
	listEwaCompanionTaskRuns,
	type EwaCompanionTaskRun,
} from '@/services/ewa/ewaCompanionChatApi';

export type UseCompanionOperationsRuntimeOptions = {
	pollEnabled: boolean;
	isDesktopWindowActive: boolean;
	notifyError: (message: string) => void;
	notifySuccess?: (title: string, message?: string) => void;
	t: TFunction<'marketing'>;
	onDispatchActions: (actions: CompanionChatAction[]) => void;
	onNewActiveRun?: (run: EwaCompanionTaskRun) => void;
};

function pruneSessionRefs(
	knownRunIds: ReadonlySet<string>,
	refs: {
		prevActive: Set<string>;
		prevStatus: Map<string, string>;
		completedToast: Set<string>;
		backgroundPlay: Set<string>;
	}
) {
	for (const id of [...refs.prevActive]) {
		if (!knownRunIds.has(id)) refs.prevActive.delete(id);
	}
	for (const id of [...refs.prevStatus.keys()]) {
		if (!knownRunIds.has(id)) refs.prevStatus.delete(id);
	}
	for (const id of [...refs.completedToast]) {
		if (!knownRunIds.has(id)) refs.completedToast.delete(id);
	}
	for (const id of [...refs.backgroundPlay]) {
		if (!knownRunIds.has(id)) refs.backgroundPlay.delete(id);
	}
}

function companionOperationsErrorKind(
	error: unknown,
	hasSnapshot: boolean
): CompanionOperationsDegradedKind {
	const message =
		error && typeof error === 'object' && 'message' in error
			? String((error as { message: unknown }).message)
			: String(error);
	const normalized = message.toLowerCase();
	if (
		normalized.includes('401') ||
		normalized.includes('403') ||
		normalized.includes('unauthorized') ||
		normalized.includes('forbidden')
	) {
		return 'auth';
	}
	if (hasSnapshot) return 'stale';
	return 'backend';
}

export function useCompanionOperationsRuntime({
	pollEnabled,
	isDesktopWindowActive,
	notifyError,
	notifySuccess,
	t,
	onDispatchActions,
	onNewActiveRun,
}: UseCompanionOperationsRuntimeOptions): void {
	const onNewActiveRunRef = useRef(onNewActiveRun);
	const onDispatchActionsRef = useRef(onDispatchActions);
	const notifySuccessRef = useRef(notifySuccess);
	const notifyErrorRef = useRef(notifyError);
	const tRef = useRef(t);
	const pollEnabledRef = useRef(pollEnabled);
	const isDesktopWindowActiveRef = useRef(isDesktopWindowActive);
	const hasActiveOperationsRef = useRef(false);
	const taskEventsStreamEnabledRef = useRef(false);
	const operationsFetchLimitRef = useRef(
		selectOperationsFetchLimit(useCompanionOperationsStore.getState())
	);

	useEffect(() => {
		onNewActiveRunRef.current = onNewActiveRun;
		onDispatchActionsRef.current = onDispatchActions;
		notifySuccessRef.current = notifySuccess;
		notifyErrorRef.current = notifyError;
		tRef.current = t;
		pollEnabledRef.current = pollEnabled;
		isDesktopWindowActiveRef.current = isDesktopWindowActive;
	});

	const applyRunsUpdater = useCompanionOperationsStore(
		(s) => s.applyRunsUpdater
	);
	const mergePolledRuns = useCompanionOperationsStore((s) => s.mergePolledRuns);
	const mergePolledRunsRef = useRef(mergePolledRuns);
	const setOperationsRefreshing = useCompanionOperationsStore(
		(s) => s.setOperationsRefreshing
	);
	const setOperationsRefreshError = useCompanionOperationsStore(
		(s) => s.setOperationsRefreshError
	);
	const setConfirmBusyRunId = useCompanionOperationsStore(
		(s) => s.setConfirmBusyRunId
	);
	const setCancelBusyRunId = useCompanionOperationsStore(
		(s) => s.setCancelBusyRunId
	);
	const setOperationsHistoryExpanded = useCompanionOperationsStore(
		(s) => s.setOperationsHistoryExpanded
	);
	const operationRuns = useCompanionOperationsStore((s) => s.operationRuns);

	const prevActiveOperationIdsRef = useRef<Set<string>>(new Set());
	const prevRunStatusRef = useRef<Map<string, string>>(new Map());
	const completedToastShownRef = useRef<Set<string>>(new Set());
	const backgroundPlayDispatchedRef = useRef<Set<string>>(new Set());
	const refreshGenerationRef = useRef(0);

	const operationsFetchLimit = useCompanionOperationsStore(
		selectOperationsFetchLimit
	);
	const hasActiveOperations = useCompanionOperationsStore(
		selectHasActiveOperations
	);
	const activeRunIdsKey = useCompanionOperationsStore(selectActiveRunIdsKey);
	const displayOperationRuns = useCompanionOperationsStore(
		useShallow(selectDisplayOperationRuns)
	);

	useEffect(() => {
		operationsFetchLimitRef.current = operationsFetchLimit;
		hasActiveOperationsRef.current = hasActiveOperations;
		taskEventsStreamEnabledRef.current = pollEnabled && hasActiveOperations;
	}, [hasActiveOperations, operationsFetchLimit, pollEnabled]);

	useEffect(() => {
		mergePolledRunsRef.current = mergePolledRuns;
	}, [mergePolledRuns]);

	const refreshOperationRuns = useCallback(
		async (opts?: {
			silent?: boolean;
			fetchLimit?: number;
			includeSteps?: boolean;
		}) => {
			const generation = ++refreshGenerationRef.current;
			const limit = opts?.fetchLimit ?? operationsFetchLimitRef.current;
			setOperationsRefreshing(true);
			try {
				const rows = await listEwaCompanionTaskRuns(limit, {
					cacheBust: true,
					// Agentic mission timeline needs mirrored steps; summary trim still drops heavy blobs.
					includeSteps: opts?.includeSteps ?? true,
					listProfile: 'summary',
				});
				if (generation !== refreshGenerationRef.current) return;
				mergePolledRuns(rows);
				setOperationsRefreshError(null);
			} catch (e: unknown) {
				if (generation !== refreshGenerationRef.current) return;
				const msg =
					e && typeof e === 'object' && 'message' in e
						? String((e as { message: unknown }).message)
						: String(e);
				setOperationsRefreshError(
					msg || tRef.current('ewaCompanion.operationsRefreshFailed'),
					companionOperationsErrorKind(
						e,
						useCompanionOperationsStore.getState().operationRuns.length > 0
					)
				);
				if (!opts?.silent) {
					notifyErrorRef.current(
						msg || tRef.current('ewaCompanion.operationsRefreshFailed')
					);
				}
			} finally {
				if (generation === refreshGenerationRef.current) {
					setOperationsRefreshing(false);
				}
			}
		},
		[mergePolledRuns, setOperationsRefreshError, setOperationsRefreshing]
	);

	const patchOperationRun = useCallback(
		(raw: unknown) => {
			const run = coerceTaskRunListRow(raw, 'summary');
			if (!run) return;
			applyRunsUpdater((prev) => mergeOperationRuns(prev, [run]));
		},
		[applyRunsUpdater]
	);

	const handleCancelOperationRun = useCallback(
		async (runId: string) => {
			setCancelBusyRunId(runId);
			try {
				const out = await cancelEwaCompanionTaskRun(runId);
				patchOperationRun(out.task_run);
				void refreshOperationRuns({ silent: true });
			} catch (e: unknown) {
				const msg =
					e && typeof e === 'object' && 'message' in e
						? String((e as { message: unknown }).message)
						: String(e);
				notifyErrorRef.current(
					msg || tRef.current('ewaCompanion.operationsCancelFailed')
				);
			} finally {
				setCancelBusyRunId(null);
			}
		},
		[patchOperationRun, refreshOperationRuns, setCancelBusyRunId]
	);

	const handleConfirmOperationRun = useCallback(
		async (runId: string, decision: 'confirm' | 'cancel') => {
			setConfirmBusyRunId(runId);
			try {
				const run = useCompanionOperationsStore
					.getState()
					.operationRuns.find((row) => row.id === runId);
				const out = await confirmEwaCompanionTaskRun(runId, decision, {
					expectRunRevision: run?.run_revision,
				});
				patchOperationRun(out.task_run);
				const actions = coerceCompanionActions(out.actions);
				if (actions.length > 0) {
					onDispatchActionsRef.current(actions);
				}
				void refreshOperationRuns({ silent: true });
			} catch (e: unknown) {
				if (isCompanionTaskRunRevisionConflictError(e)) {
					notifyErrorRef.current(
						tRef.current('ewaCompanion.operationRunRevisionConflict')
					);
					void refreshOperationRuns({ silent: true });
					return;
				}
				const msg =
					e && typeof e === 'object' && 'message' in e
						? String((e as { message: unknown }).message)
						: String(e);
				notifyErrorRef.current(
					msg || tRef.current('ewaCompanion.operationConfirmFailed')
				);
			} finally {
				setConfirmBusyRunId(null);
			}
		},
		[patchOperationRun, refreshOperationRuns, setConfirmBusyRunId]
	);

	const loadMoreOperationsHistory = useCallback(() => {
		setOperationsHistoryExpanded(true);
		void refreshOperationRuns({
			fetchLimit: OPERATIONS_FETCH_LIMIT_EXPANDED,
		});
	}, [refreshOperationRuns, setOperationsHistoryExpanded]);

	const onTerminalRefreshRef = useRef(refreshOperationRuns);
	useEffect(() => {
		onTerminalRefreshRef.current = refreshOperationRuns;
	}, [refreshOperationRuns]);

	const taskEventsStreamEnabled = pollEnabled && hasActiveOperations;

	useCompanionTaskEventsStream(taskEventsStreamEnabled, activeRunIdsKey, {
		onTerminal: () => {
			void onTerminalRefreshRef.current({ silent: true, includeSteps: true });
		},
	});

	useEffect(() => {
		const knownIds = new Set(
			operationRuns.map((run) => run.id).filter(Boolean)
		);
		pruneSessionRefs(knownIds, {
			prevActive: prevActiveOperationIdsRef.current,
			prevStatus: prevRunStatusRef.current,
			completedToast: completedToastShownRef.current,
			backgroundPlay: backgroundPlayDispatchedRef.current,
		});
	}, [operationRuns]);

	useEffect(() => {
		const activeIds = new Set<string>();
		let newlyActiveRun: EwaCompanionTaskRun | null = null;
		for (const run of displayOperationRuns) {
			const st = (run.status || '').trim().toLowerCase();
			const runId = run.id?.trim();
			if (!runId || !ACTIVE_OPERATION_STATUSES.has(st)) continue;
			activeIds.add(runId);
			if (!newlyActiveRun && !prevActiveOperationIdsRef.current.has(runId)) {
				newlyActiveRun = run;
			}
		}
		if (newlyActiveRun) {
			onNewActiveRunRef.current?.(newlyActiveRun);
		}
		prevActiveOperationIdsRef.current = activeIds;
	}, [displayOperationRuns]);

	useEffect(() => {
		const notifySuccess = notifySuccessRef.current;
		if (!notifySuccess) return;
		for (const run of displayOperationRuns) {
			const runId = run.id?.trim();
			if (!runId) continue;
			const status = (run.status || '').trim().toLowerCase();
			const prevStatus = prevRunStatusRef.current.get(runId);
			prevRunStatusRef.current.set(runId, status);
			if (status !== 'completed') continue;
			if (completedToastShownRef.current.has(runId)) continue;
			if (!prevStatus || !ACTIVE_OPERATION_STATUSES.has(prevStatus)) continue;
			const toast = resolveCompanionOperationCompletedToast(run, tRef.current);
			if (!toast) continue;
			completedToastShownRef.current.add(runId);
			notifySuccess(toast.title, toast.message);
		}
	}, [displayOperationRuns]);

	useEffect(() => {
		for (const run of operationRuns) {
			if (!run.id || backgroundPlayDispatchedRef.current.has(run.id)) continue;
			const playAction = extractBackgroundPlayAction(run);
			if (!playAction) continue;
			backgroundPlayDispatchedRef.current.add(run.id);
			onDispatchActionsRef.current([playAction]);
		}
	}, [operationRuns]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: pollEnabled / isDesktopWindowActive start/stop the loop; interval flags read from refs.
	useEffect(() => {
		if (!pollEnabled) return;
		let alive = true;
		let timerId: number | null = null;
		const poll = async () => {
			try {
				const rows = await listEwaCompanionTaskRuns(
					operationsFetchLimitRef.current,
					{
						cacheBust: true,
						includeSteps: true,
						listProfile: 'summary',
					}
				);
				if (alive) {
					mergePolledRunsRef.current(rows);
					useCompanionOperationsStore
						.getState()
						.setOperationsRefreshError(null);
				}
			} catch (err) {
				const msg =
					err && typeof err === 'object' && 'message' in err
						? String((err as { message: unknown }).message)
						: String(err);
				useCompanionOperationsStore
					.getState()
					.setOperationsRefreshError(
						msg || tRef.current('ewaCompanion.operationsRefreshFailed'),
						companionOperationsErrorKind(
							err,
							useCompanionOperationsStore.getState().operationRuns.length > 0
						)
					);
				ewaCompanionDegradeDebug(
					'companion_operations_poll',
					'task-runs poll failed; keeping previous snapshot',
					err
				);
			}
			if (!alive || !pollEnabledRef.current) return;
			const hasActive = hasActiveOperationsRef.current;
			const desktopActive = isDesktopWindowActiveRef.current;
			const sseEnabled = taskEventsStreamEnabledRef.current;
			// Background + idle: stop periodic GET; focus/visibility handlers reconcile on return.
			if (!hasActive && !desktopActive) {
				return;
			}
			// SSE-first: dense poll only when stream is off; with SSE, safety reconcile ≥5 min.
			const intervalMs = hasActive
				? sseEnabled
					? 300_000
					: desktopActive
						? 20_000
						: 45_000
				: 120_000;
			timerId = window.setTimeout(() => {
				void poll();
			}, intervalMs);
		};
		void poll();
		return () => {
			alive = false;
			if (timerId !== null) window.clearTimeout(timerId);
		};
	}, [pollEnabled, isDesktopWindowActive]);

	useEffect(() => {
		if (!pollEnabled) return;
		const onVisibleFocus = () => {
			if (document.visibilityState === 'hidden') return;
			void refreshOperationRuns({ silent: true });
		};
		window.addEventListener('focus', onVisibleFocus);
		document.addEventListener('visibilitychange', onVisibleFocus);
		return () => {
			window.removeEventListener('focus', onVisibleFocus);
			document.removeEventListener('visibilitychange', onVisibleFocus);
		};
	}, [pollEnabled, refreshOperationRuns]);

	const syncTaskRunSnapshot = useCallback(
		(taskRun: unknown) => {
			patchOperationRun(taskRun);
		},
		[patchOperationRun]
	);

	const refreshOperationRunsRef = useRef(refreshOperationRuns);
	const handleConfirmOperationRunRef = useRef(handleConfirmOperationRun);
	const handleCancelOperationRunRef = useRef(handleCancelOperationRun);
	const loadMoreOperationsHistoryRef = useRef(loadMoreOperationsHistory);
	const patchOperationRunRef = useRef(patchOperationRun);
	const syncTaskRunSnapshotRef = useRef(syncTaskRunSnapshot);

	useEffect(() => {
		refreshOperationRunsRef.current = refreshOperationRuns;
		handleConfirmOperationRunRef.current = handleConfirmOperationRun;
		handleCancelOperationRunRef.current = handleCancelOperationRun;
		loadMoreOperationsHistoryRef.current = loadMoreOperationsHistory;
		patchOperationRunRef.current = patchOperationRun;
		syncTaskRunSnapshotRef.current = syncTaskRunSnapshot;
	});

	useEffect(() => {
		setCompanionOperationsRuntimeHandlers({
			refreshOperationRuns: (opts) => refreshOperationRunsRef.current(opts),
			handleConfirmOperationRun: (runId, decision) =>
				handleConfirmOperationRunRef.current(runId, decision),
			handleCancelOperationRun: (runId) =>
				handleCancelOperationRunRef.current(runId),
			loadMoreOperationsHistory: () => loadMoreOperationsHistoryRef.current(),
			patchOperationRun: (raw) => patchOperationRunRef.current(raw),
			syncTaskRunSnapshot: (taskRun) => syncTaskRunSnapshotRef.current(taskRun),
		});
		return () => clearCompanionOperationsRuntimeHandlers();
	}, []);
}
