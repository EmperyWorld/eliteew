/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Deep-link CalendarApp to a specific local day via sessionStorage + desktop-open-app.
 *
 * Related:
 * - utils/desktopDeepLink.ts
 * - apps/CalendarApp.tsx
 */

import { localDayKey } from '@/pages/Desktop/utils/desktopCalendarEventPolicy';
import { requestOpenDesktopApp } from '@/pages/Desktop/utils/desktopDeepLink';

const DEEPLINK_CALENDAR_SELECTED_DAY =
	'eliteew.desktop.deepLink.calendarSelectedDay';

export function requestOpenCalendarApp(options?: { selectedDay?: Date }): void {
	if (typeof window === 'undefined') return;
	try {
		if (options?.selectedDay) {
			sessionStorage.setItem(
				DEEPLINK_CALENDAR_SELECTED_DAY,
				localDayKey(options.selectedDay)
			);
		}
		requestOpenDesktopApp({ appComponent: 'CalendarApp' });
	} catch {
		// ignore
	}
}

/** Read-and-clear YYYY-MM-DD selected day for CalendarApp first paint. */
export function consumeCalendarSelectedDayDeepLink(): string | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = sessionStorage.getItem(DEEPLINK_CALENDAR_SELECTED_DAY);
		sessionStorage.removeItem(DEEPLINK_CALENDAR_SELECTED_DAY);
		if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
		return raw;
	} catch {
		return null;
	}
}

export function parseCalendarDayKey(dayKey: string): Date | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
	if (!match) return null;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	if (
		!Number.isFinite(year) ||
		!Number.isFinite(month) ||
		!Number.isFinite(day)
	) {
		return null;
	}
	const date = new Date(year, month - 1, day);
	if (
		date.getFullYear() !== year ||
		date.getMonth() !== month - 1 ||
		date.getDate() !== day
	) {
		return null;
	}
	return date;
}
