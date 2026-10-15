/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Workspace projection of the active Assistant companion plan for desktop widgets.
 *
 * Invariants:
 * - Reads GET /companion-plans/active; complete uses existing POST (no fake success).
 * - Probe disabled hides plan/agenda; empty plan is a CTA, not widget-todos.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-WIDGETS-AND-AGENDA.md
 * - services/ewa/ewaCompanionPlansApi.ts
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	partitionCompanionPlanTasks,
	resolveCompanionPlanDisplayProgress,
	normalizeCompanionPlanStatus,
	isCompanionPlanTaskOverdue,
	parseCompanionPlanDueDate,
	type CompanionPlanFsmStatus,
} from '@/features/ewa/companionPlanStripUi';
import { readCompanionPlansFeatureProbeState } from '@/services/ewa/companionPlansFeatureProbe';
import {
	completeEwaCompanionPlanTask,
	getEwaCompanionActivePlan,
	type EwaCompanionPlanBundle,
	type EwaCompanionPlanGoal,
	type EwaCompanionPlanTask,
} from '@/services/ewa/ewaCompanionPlansApi';
import { subscribeCompanionActivePlanInvalidated } from '@/services/ewa/companionActivePlanInvalidation';
import { log } from '@/utils/logger';
import {
	bucketDesktopWidgetAgendaTasks,
	resolveCompanionPlansWidgetVisibility,
	type DesktopWidgetAgendaBucket,
	type DesktopWidgetAgendaTask,
} from '../utils/desktopWidgetSurfacePolicy';

export type DesktopAssistantPlanProjection = {
	visibility: 'show' | 'hide-disabled' | 'empty-cta';
	loading: boolean;
	error: boolean;
	completingTaskId: string | null;
	forbidden: boolean;
	bundle: EwaCompanionPlanBundle | null;
	fsmStatus: CompanionPlanFsmStatus;
	progress: number;
	goals: readonly EwaCompanionPlanGoal[];
	openTasks: readonly EwaCompanionPlanTask[];
	agendaBuckets: DesktopWidgetAgendaBucket[];
	refresh: () => Promise<void>;
	completeTask: (taskId: string) => Promise<void>;
};

function toAgendaTasks(
	tasks: readonly EwaCompanionPlanTask[]
): DesktopWidgetAgendaTask[] {
	return tasks.map((task) => ({
		id: task.id,
		title: task.title,
		dueDate: parseCompanionPlanDueDate(task.due_date ?? null),
		overdue: isCompanionPlanTaskOverdue(task),
	}));
}

function visibilityFromBundle(
	bundle: EwaCompanionPlanBundle | null,
	loadFailed: boolean
): DesktopAssistantPlanProjection['visibility'] {
	if (readCompanionPlansFeatureProbeState() === 'disabled') {
		return 'hide-disabled';
	}
	if (loadFailed) {
		return 'empty-cta';
	}
	if (!bundle?.plan) {
		return resolveCompanionPlansWidgetVisibility('empty');
	}
	return resolveCompanionPlansWidgetVisibility('enabled');
}

function readHttpStatus(error: unknown): number | undefined {
	if (!error || typeof error !== 'object' || !('response' in error)) {
		return undefined;
	}
	const status = (error as { response?: { status?: unknown } }).response
		?.status;
	return typeof status === 'number' ? status : undefined;
}

export function useDesktopAssistantPlanProjection(options?: {
	enabled?: boolean;
}): DesktopAssistantPlanProjection {
	const enabled = options?.enabled ?? true;
	const [bundle, setBundle] = useState<EwaCompanionPlanBundle | null>(null);
	const [loading, setLoading] = useState(enabled);
	const [error, setError] = useState(false);
	const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
	const [forbidden, setForbidden] = useState(false);

	const refresh = useCallback(async () => {
		if (!enabled) {
			setLoading(false);
			return;
		}
		setLoading(true);
		try {
			const next = await getEwaCompanionActivePlan({ cacheBust: true });
			setBundle(next);
			setError(false);
			setForbidden(false);
		} catch (err) {
			setError(true);
			setForbidden(readHttpStatus(err) === 403);
			log.warn(
				'DesktopAssistantPlan',
				'Active plan fetch failed',
				err instanceof Error ? err : undefined
			);
		} finally {
			setLoading(false);
		}
	}, [enabled]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	useEffect(() => {
		return subscribeCompanionActivePlanInvalidated(() => {
			void refresh();
		});
	}, [refresh]);

	const completeTask = useCallback(async (taskId: string) => {
		setCompletingTaskId(taskId);
		try {
			const next = await completeEwaCompanionPlanTask(taskId);
			setBundle(next);
			setError(false);
			setForbidden(false);
		} catch (err) {
			setError(true);
			setForbidden(readHttpStatus(err) === 403);
			log.warn(
				'DesktopAssistantPlan',
				'Task complete failed',
				err instanceof Error ? err : undefined
			);
		} finally {
			setCompletingTaskId(null);
		}
	}, []);

	const openTasks = useMemo(
		() => partitionCompanionPlanTasks(bundle?.tasks ?? []).open,
		[bundle]
	);

	const agendaBuckets = useMemo(
		() => bucketDesktopWidgetAgendaTasks(toAgendaTasks(openTasks)),
		[openTasks]
	);

	return {
		visibility: visibilityFromBundle(bundle, error && !bundle?.plan),
		loading,
		error,
		forbidden,
		completingTaskId,
		bundle,
		fsmStatus: normalizeCompanionPlanStatus(bundle?.plan?.status),
		progress: resolveCompanionPlanDisplayProgress(bundle),
		goals: bundle?.goals ?? [],
		openTasks,
		agendaBuckets,
		refresh,
		completeTask,
	};
}
