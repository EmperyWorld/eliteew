/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Left-rail cluster for companion chat: memory strip, server actions, turn plan, active plan, anticipation (U8.1 slice 5).
 *
 * Invariants:
 * - Plan refresh errors respect feature-disabled / no-active-plan without generic toast when silent.
 * - Memory strip hidden for Arlika persona; server-action filter respects open desktop windows.
 * - Turn-plan hint sync is pure response mapping — no transcript mutation.
 * - Active-plan focus/visibility refresh runs only when visible; stale responses ignore state writes.
 * - Open-apps fingerprint for recent-actions updates only when the set of non-minimized apps changes
 *   (no blind 8s React re-render tick).
 *
 * Related:
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 * - src/features/ewa/companionLeftRailSection.tsx
 * - src/features/ewa/companionUx/companionShellOpenAppsFingerprint.ts
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TFunction } from 'i18next';

import type { CompanionLeftRailSectionId } from '@/features/ewa/companionLeftRailSection';
import {
	extractCompanionMemoryStripRows,
	EWA_COMPANION_MEMORY_STRIP_MAX_LINES,
} from '@/features/ewa/companionLearnedUi';
import {
	normalizeCompanionPlanStatus,
	partitionCompanionPlanTasks,
	resolveCompanionPlanDisplayProgress,
	sortCompanionPlanGoals,
} from '@/features/ewa/companionPlanStripUi';
import {
	extractRecentServerActionsForDisplay,
	filterRecentServerActionsForDisplay,
	type CompanionRecentServerActionDisplayLabels,
} from '@/features/ewa/companionRecentServerActionsUi';
import {
	resolveTurnPlanToolLabel,
	sanitizeTurnPlanHint,
	turnPlanContinuePhrase,
} from '@/features/ewa/companionTurnPlanUi';
import { companionShellOpenAppsFingerprint } from '@/features/ewa/companionUx/companionShellOpenAppsFingerprint';
import { useEwaCompanionAnticipationTick } from '@/features/ewa/useEwaCompanionAnticipationTick';
import {
	extractCompanionTurnPlanFromLearned,
	type CompanionChatMessageResponse,
	type CompanionTurnPlanSnapshot,
} from '@/services/ewa/ewaCompanionChatApi';
import {
	type EwaCompanionPlanBundle,
	archiveEwaCompanionActivePlan,
	completeEwaCompanionPlanTask,
	getEwaCompanionActivePlan,
	isCompanionPlansFeatureDisabledError,
	isCompanionPlansNoActivePlanError,
	isCompanionPlansOpaque404Error,
} from '@/services/ewa/ewaCompanionPlansApi';
import { dispatchCompanionActivePlanInvalidated } from '@/services/ewa/companionActivePlanInvalidation';
import {
	cacheCompanionPlansFeatureProbeState,
	readCompanionPlansFeatureProbeState,
} from '@/services/ewa/companionPlansFeatureProbe';
import {
	type EwaCompanionProfileOut,
	readEwaCompanionPresenceMode,
} from '@/services/ewa/ewaCompanionProfileApi';

export type CompanionTurnPlanHintState = {
	hint: string;
	nextTool: string | null;
	source: string | null;
};

export type CompanionTurnPlanVisual = {
	hint: string;
	nextTool: string | null;
	source: string | null;
	queued: boolean;
};

export type UseCompanionLeftRailControllerOptions = {
	profile: Pick<
		EwaCompanionProfileOut,
		| 'principal_id'
		| 'learned_preferences'
		| 'memory_display'
		| 'companion_revision'
	>;
	personaId: string;
	pending: boolean;
	ru: boolean;
	t: TFunction<'marketing'>;
	getSnapshot: () => {
		windows: Array<{ app_component: string; minimized?: boolean }>;
	} | null;
	isDesktopWindowActive: boolean;
	operationsPollEnabled: boolean;
	notifyError: (message: string) => void;
};

export function useCompanionLeftRailController({
	profile,
	personaId,
	pending,
	ru,
	t,
	getSnapshot,
	isDesktopWindowActive,
	operationsPollEnabled,
	notifyError,
}: UseCompanionLeftRailControllerOptions) {
	const [leftRailExpanded, setLeftRailExpanded] =
		useState<CompanionLeftRailSectionId | null>(null);
	const [turnPlanHintState, setTurnPlanHintState] =
		useState<CompanionTurnPlanHintState | null>(null);
	const [shellOpenAppsFp, setShellOpenAppsFp] = useState(() =>
		companionShellOpenAppsFingerprint(getSnapshot())
	);
	const shellOpenAppsFpRef = useRef(shellOpenAppsFp);
	const [plansFeatureState, setPlansFeatureState] = useState<
		'unknown' | 'disabled' | 'enabled'
	>(() => readCompanionPlansFeatureProbeState());
	const [activePlanBundle, setActivePlanBundle] =
		useState<EwaCompanionPlanBundle | null>(null);
	const [planRefreshing, setPlanRefreshing] = useState(false);
	const [completingPlanTaskId, setCompletingPlanTaskId] = useState<
		string | null
	>(null);
	const [archivingPlan, setArchivingPlan] = useState(false);
	const prevActivePlanIdRef = useRef<string | null>(null);
	const planRefreshGenerationRef = useRef(0);
	const [mobileMemoryOpen, setMobileMemoryOpen] = useState(false);

	const contemplationActive =
		readEwaCompanionPresenceMode(profile.learned_preferences) ===
		'contemplation';
	const { hint: anticipationHint, dismissHint: dismissAnticipationHint } =
		useEwaCompanionAnticipationTick(profile.principal_id, {
			enabled: isDesktopWindowActive,
			suppressHints: contemplationActive,
		});

	const toggleLeftRailSection = useCallback(
		(id: CompanionLeftRailSectionId) => {
			setLeftRailExpanded((prev) => (prev === id ? null : id));
		},
		[]
	);

	const syncTurnPlanHintFromResponse = useCallback(
		(out: CompanionChatMessageResponse) => {
			const hint =
				typeof out.turn_plan_hint === 'string' ? out.turn_plan_hint.trim() : '';
			const nextTool =
				typeof out.turn_plan_next_tool === 'string' &&
				out.turn_plan_next_tool.trim()
					? out.turn_plan_next_tool.trim()
					: null;
			const source =
				typeof out.turn_plan_source === 'string' && out.turn_plan_source.trim()
					? out.turn_plan_source.trim()
					: null;
			if (!hint && !nextTool && !source) {
				return;
			}
			setTurnPlanHintState({
				hint,
				nextTool,
				source,
			});
		},
		[]
	);

	const hideMemoryStrip = personaId === 'arlika';

	const memoryStripRows = useMemo(() => {
		if (hideMemoryStrip) return [];
		const idleLabel = t('ewaCompanion.memoryIdleAmnesiaStrip');
		return extractCompanionMemoryStripRows(
			profile.learned_preferences,
			EWA_COMPANION_MEMORY_STRIP_MAX_LINES,
			idleLabel,
			profile.memory_display
		);
	}, [hideMemoryStrip, profile.learned_preferences, profile.memory_display, t]);

	const memoryStrip = useMemo(
		() => memoryStripRows.map((row) => row.label),
		[memoryStripRows]
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: revision bumps after PATCH refresh learned_preferences ring.
	const recentServerActions = useMemo(() => {
		const raw = extractRecentServerActionsForDisplay(
			profile.learned_preferences
		);
		const snap = getSnapshot();
		const openAppComponents = snap
			? new Set(
					snap.windows.filter((w) => !w.minimized).map((w) => w.app_component)
				)
			: null;
		return filterRecentServerActionsForDisplay(raw, { openAppComponents });
	}, [
		profile.learned_preferences,
		profile.companion_revision,
		getSnapshot,
		shellOpenAppsFp,
	]);

	const prevServerActionsCountRef = useRef(0);
	useEffect(() => {
		const count = recentServerActions.length;
		if (count > prevServerActionsCountRef.current && count > 0) {
			setLeftRailExpanded('serverActions');
		}
		prevServerActionsCountRef.current = count;
	}, [recentServerActions.length]);

	const recentServerActionLabels = useMemo(
		(): CompanionRecentServerActionDisplayLabels => ({
			musicStudioOpen: t('ewaCompanion.operationIntentMusicStudioOpen'),
			appOpen: t('ewaCompanion.operationIntentAppOpen'),
			themeSet: t('ewaCompanion.operationIntentThemeSet'),
			docCreate: t('ewaCompanion.operationIntentDocCreate'),
			docInsert: t('ewaCompanion.operationIntentDocInsert'),
			fileRename: t('ewaCompanion.operationIntentFileRename'),
			fileDelete: t('ewaCompanion.operationIntentFileDelete'),
			planCreate: t('ewaCompanion.operationIntentPlanCreate'),
			planTaskComplete: t('ewaCompanion.operationIntentPlanTaskComplete'),
			operationsStatus: t(
				'ewaCompanion.operationIntentOperationsStatus',
				'Статус текущих операций'
			),
			operationCancel: t(
				'ewaCompanion.operationIntentOperationCancel',
				'Отмена операции'
			),
			generic: (tool) =>
				t('ewaCompanion.serverActionFallbackGeneric', { tool }),
			statusOk: t('ewaCompanion.serverActionFallbackDone'),
			statusNeedsConfirm: t('ewaCompanion.serverActionFallbackNeedsConfirm'),
		}),
		[t]
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: revision bump guard mirrors transcript extraction for learned_preferences snapshots.
	const queuedTurnPlan = useMemo(
		(): CompanionTurnPlanSnapshot | null =>
			extractCompanionTurnPlanFromLearned(profile.learned_preferences),
		[profile.learned_preferences, profile.companion_revision]
	);

	const turnPlanVisual = useMemo((): CompanionTurnPlanVisual | null => {
		const queuedSteps = Array.isArray(queuedTurnPlan?.steps)
			? queuedTurnPlan.steps
			: [];
		const queuedStep = queuedSteps[0];
		const queuedCount = queuedSteps.length;
		const nextTool =
			queuedStep?.tool?.trim() || turnPlanHintState?.nextTool || null;
		const rawHint = sanitizeTurnPlanHint(turnPlanHintState?.hint?.trim() ?? '');
		const fallbackHint =
			queuedCount > 0
				? t('ewaCompanion.turnPlanQueuedHintFallback', {
						tool: resolveTurnPlanToolLabel(t, nextTool),
					})
				: '';
		const hint = rawHint || fallbackHint;
		if (!nextTool && !hint && queuedCount === 0) {
			return null;
		}
		return {
			hint,
			nextTool,
			source: null,
			queued: queuedCount > 0,
		};
	}, [queuedTurnPlan, t, turnPlanHintState]);

	useEffect(() => {
		if (!isDesktopWindowActive) return;
		const syncOpenAppsFp = () => {
			const next = companionShellOpenAppsFingerprint(getSnapshot());
			if (next === shellOpenAppsFpRef.current) return;
			shellOpenAppsFpRef.current = next;
			setShellOpenAppsFp(next);
		};
		syncOpenAppsFp();
		const intervalId = window.setInterval(syncOpenAppsFp, 15_000);
		const onFocusOrVisible = () => {
			if (document.visibilityState === 'hidden') return;
			syncOpenAppsFp();
		};
		window.addEventListener('focus', onFocusOrVisible);
		document.addEventListener('visibilitychange', onFocusOrVisible);
		return () => {
			window.clearInterval(intervalId);
			window.removeEventListener('focus', onFocusOrVisible);
			document.removeEventListener('visibilitychange', onFocusOrVisible);
		};
	}, [getSnapshot, isDesktopWindowActive]);

	const planStripVisible = plansFeatureState === 'enabled';

	const planFsmStatus = useMemo(
		() => normalizeCompanionPlanStatus(activePlanBundle?.plan?.status),
		[activePlanBundle?.plan?.status]
	);

	const planTaskPartition = useMemo(
		() => partitionCompanionPlanTasks(activePlanBundle?.tasks ?? []),
		[activePlanBundle?.tasks]
	);

	const planGoalsSorted = useMemo(
		() => sortCompanionPlanGoals(activePlanBundle?.goals ?? []),
		[activePlanBundle?.goals]
	);

	const planDisplayProgress = useMemo(
		() => resolveCompanionPlanDisplayProgress(activePlanBundle),
		[activePlanBundle]
	);

	const refreshActivePlan = useCallback(
		async (opts?: { silent?: boolean; expandOnNew?: boolean }) => {
			if (readCompanionPlansFeatureProbeState() === 'disabled') {
				setPlansFeatureState('disabled');
				setActivePlanBundle(null);
				return;
			}
			const generation = ++planRefreshGenerationRef.current;
			setPlanRefreshing(true);
			try {
				const bundle = await getEwaCompanionActivePlan({ cacheBust: true });
				if (generation !== planRefreshGenerationRef.current) return;
				if (readCompanionPlansFeatureProbeState() === 'disabled') {
					setPlansFeatureState('disabled');
					setActivePlanBundle(null);
					return;
				}
				setPlansFeatureState('enabled');
				cacheCompanionPlansFeatureProbeState('enabled');
				const nextPlanId = bundle?.plan?.id ?? null;
				if (
					opts?.expandOnNew !== false &&
					nextPlanId &&
					nextPlanId !== prevActivePlanIdRef.current
				) {
					setLeftRailExpanded('plan');
				}
				prevActivePlanIdRef.current = nextPlanId;
				setActivePlanBundle(bundle?.plan ? bundle : null);
				dispatchCompanionActivePlanInvalidated();
			} catch (e: unknown) {
				if (generation !== planRefreshGenerationRef.current) return;
				if (
					isCompanionPlansFeatureDisabledError(e) ||
					isCompanionPlansOpaque404Error(e)
				) {
					setPlansFeatureState('disabled');
					cacheCompanionPlansFeatureProbeState('disabled');
					setActivePlanBundle(null);
					return;
				}
				if (isCompanionPlansNoActivePlanError(e)) {
					setPlansFeatureState('enabled');
					cacheCompanionPlansFeatureProbeState('enabled');
					setActivePlanBundle(null);
					return;
				}
				if (!opts?.silent) {
					const msg =
						e && typeof e === 'object' && 'message' in e
							? String((e as { message: unknown }).message)
							: String(e);
					notifyError(msg || t('ewaCompanion.planRefreshFailed'));
				}
			} finally {
				if (generation === planRefreshGenerationRef.current) {
					setPlanRefreshing(false);
				}
			}
		},
		[notifyError, t]
	);

	const refreshActivePlanRef = useRef(refreshActivePlan);
	refreshActivePlanRef.current = refreshActivePlan;

	const handleCompletePlanTask = useCallback(
		async (taskId: string) => {
			if (!taskId.trim() || completingPlanTaskId || pending) return;
			setCompletingPlanTaskId(taskId);
			try {
				const bundle = await completeEwaCompanionPlanTask(taskId);
				setPlansFeatureState('enabled');
				setActivePlanBundle(bundle?.plan ? bundle : null);
				dispatchCompanionActivePlanInvalidated();
			} catch (e: unknown) {
				const msg =
					e && typeof e === 'object' && 'message' in e
						? String((e as { message: unknown }).message)
						: String(e);
				notifyError(msg || t('ewaCompanion.planCompleteTaskFailed'));
			} finally {
				setCompletingPlanTaskId(null);
			}
		},
		[completingPlanTaskId, notifyError, pending, t]
	);

	const handleArchiveActivePlan = useCallback(async () => {
		if (archivingPlan || pending) return;
		setArchivingPlan(true);
		try {
			await archiveEwaCompanionActivePlan();
			setPlansFeatureState('enabled');
			setActivePlanBundle(null);
			prevActivePlanIdRef.current = null;
		} catch (e: unknown) {
			const msg =
				e && typeof e === 'object' && 'message' in e
					? String((e as { message: unknown }).message)
					: String(e);
			notifyError(msg || t('ewaCompanion.planArchiveFailed'));
		} finally {
			setArchivingPlan(false);
		}
	}, [archivingPlan, notifyError, pending, t]);

	useEffect(() => {
		if (!operationsPollEnabled || plansFeatureState === 'disabled') return;
		void refreshActivePlanRef.current({ silent: true });
	}, [operationsPollEnabled, plansFeatureState]);

	useEffect(() => {
		if (!operationsPollEnabled || plansFeatureState !== 'enabled') return;
		const onVisibleFocus = () => {
			if (document.visibilityState === 'hidden') return;
			void refreshActivePlanRef.current({ silent: true });
		};
		window.addEventListener('focus', onVisibleFocus);
		document.addEventListener('visibilitychange', onVisibleFocus);
		return () => {
			window.removeEventListener('focus', onVisibleFocus);
			document.removeEventListener('visibilitychange', onVisibleFocus);
		};
	}, [operationsPollEnabled, plansFeatureState]);

	const runTurnPlanContinue = useCallback(
		(submitCompanionLine: (text: string) => void | Promise<void>) => {
			if (pending || !turnPlanVisual?.queued) return;
			void submitCompanionLine(
				turnPlanContinuePhrase(ru, turnPlanVisual.nextTool)
			);
		},
		[pending, ru, turnPlanVisual]
	);

	return {
		leftRailExpanded,
		toggleLeftRailSection,
		turnPlanHintState,
		setTurnPlanHintState,
		syncTurnPlanHintFromResponse,
		hideMemoryStrip,
		memoryStrip,
		memoryStripRows,
		recentServerActions,
		recentServerActionLabels,
		turnPlanVisual,
		planStripVisible,
		activePlanBundle,
		planRefreshing,
		completingPlanTaskId,
		archivingPlan,
		planFsmStatus,
		planTaskPartition,
		planGoalsSorted,
		planDisplayProgress,
		mobileMemoryOpen,
		setMobileMemoryOpen,
		refreshActivePlan,
		handleCompletePlanTask,
		handleArchiveActivePlan,
		runTurnPlanContinue,
		anticipationHint,
		dismissAnticipationHint,
	};
}
