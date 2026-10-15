/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Merged personal calendar events + companion plan tasks for taskbar mini month grid.
 *
 * Invariants:
 * - Fetch only while the clock flyout is open (range query disabled when closed).
 * - Reuses react-query caches shared with CalendarApp / companion plan overlay.
 *
 * Related:
 * - components/TaskbarClock.tsx
 * - hooks/useDesktopCalendarEvents.ts
 * - hooks/useCompanionPlanCalendarOverlay.ts
 */

import { useMemo } from 'react';
import type { DesktopCalendarEventResponse } from '../services/desktopApi';
import { monthQueryRange } from '../utils/desktopCalendarEventPolicy';
import { mergeCalendarEventsWithCompanionPlanTasks } from '../utils/companionPlanCalendarOverlay';
import { useCompanionPlanCalendarOverlay } from './useCompanionPlanCalendarOverlay';
import { useDesktopCalendarEvents } from './useDesktopCalendarEvents';

export function useTaskbarMiniCalendarEvents(
	viewMonth: Date,
	enabled: boolean
): DesktopCalendarEventResponse[] {
	const range = useMemo(
		() =>
			enabled
				? monthQueryRange(viewMonth.getFullYear(), viewMonth.getMonth())
				: null,
		[enabled, viewMonth]
	);
	const calendar = useDesktopCalendarEvents(range);
	const companionPlanOverlay = useCompanionPlanCalendarOverlay({ enabled });

	return useMemo(() => {
		if (!enabled) return [];
		return [
			...mergeCalendarEventsWithCompanionPlanTasks(
				calendar.events,
				companionPlanOverlay.planTasks
			),
		];
	}, [calendar.events, companionPlanOverlay.planTasks, enabled]);
}
