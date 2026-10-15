/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Load active companion plan tasks for CalendarApp overlay (editable via companion-plans PATCH).
 * Overlay query failure is `isError` — CalendarApp must not treat it as an empty plan.
 *
 * Related:
 * - utils/companionPlanCalendarOverlay.ts
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
	getEwaCompanionActivePlan,
	type EwaCompanionPlanTask,
} from '@/services/ewa/ewaCompanionPlansApi';
import { readCompanionPlansFeatureProbeState } from '@/services/ewa/companionPlansFeatureProbe';
import { subscribeCompanionActivePlanInvalidated } from '@/services/ewa/companionActivePlanInvalidation';
import { useEffect } from 'react';

export const DESKTOP_COMPANION_PLAN_CALENDAR_KEY = [
	'desktop',
	'companion-plan-calendar',
] as const;

export function useCompanionPlanCalendarOverlay(options?: {
	enabled?: boolean;
}): {
	planTasks: readonly EwaCompanionPlanTask[];
	loading: boolean;
	isError: boolean;
} {
	const probeEnabled = readCompanionPlansFeatureProbeState() !== 'disabled';
	const enabled = probeEnabled && (options?.enabled ?? true);
	const queryClient = useQueryClient();
	const query = useQuery({
		queryKey: DESKTOP_COMPANION_PLAN_CALENDAR_KEY,
		queryFn: async () => {
			const bundle = await getEwaCompanionActivePlan({ cacheBust: true });
			return bundle?.tasks ?? [];
		},
		enabled,
		staleTime: 30_000,
	});

	useEffect(() => {
		if (!enabled) return;
		return subscribeCompanionActivePlanInvalidated(() => {
			void queryClient.invalidateQueries({
				queryKey: DESKTOP_COMPANION_PLAN_CALENDAR_KEY,
			});
		});
	}, [enabled, queryClient]);

	return {
		planTasks: query.data ?? [],
		loading: query.isLoading,
		isError: query.isError,
	};
}
