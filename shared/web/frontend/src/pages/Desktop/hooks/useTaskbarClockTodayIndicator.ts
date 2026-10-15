/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Whether today has personal calendar events or assistant plan tasks (taskbar date dot).
 *
 * Related:
 * - components/TaskbarClock.tsx
 */

import { useMemo } from 'react';
import { mergeCalendarEventsWithCompanionPlanTasks } from '@/pages/Desktop/utils/companionPlanCalendarOverlay';
import {
	addLocalDays,
	eventOverlapsLocalDay,
	startOfLocalDay,
} from '@/pages/Desktop/utils/desktopCalendarEventPolicy';
import { useCompanionPlanCalendarOverlay } from './useCompanionPlanCalendarOverlay';
import { useDesktopCalendarEvents } from './useDesktopCalendarEvents';

export function useTaskbarClockTodayIndicator(): boolean {
	const today = useMemo(() => startOfLocalDay(new Date()), []);
	const range = useMemo(
		() => ({
			from: today.toISOString(),
			to: addLocalDays(today, 1).toISOString(),
		}),
		[today]
	);
	const calendar = useDesktopCalendarEvents(range);
	const companionPlanOverlay = useCompanionPlanCalendarOverlay();

	return useMemo(() => {
		const merged = mergeCalendarEventsWithCompanionPlanTasks(
			calendar.events,
			companionPlanOverlay.planTasks
		);
		return merged.some((event) => eventOverlapsLocalDay(event, today));
	}, [calendar.events, companionPlanOverlay.planTasks, today]);
}
