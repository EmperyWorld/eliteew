/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * HTTP client for personal CalendarApp events (`/api/v1/desktop/calendar/events`).
 *
 * Invariants:
 * - Throws on non-2xx so the window can show retry (no silent empty success).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-CALENDAR-APP.md
 */

import { api } from '../../../../services/api/client';
import { API_PATH, DESKTOP_API_OPTIONS } from './constants';
import type {
	DesktopCalendarEventResponse,
	DesktopCalendarEventWrite,
} from './types';
import { normalizeCalendarInstantIso } from '../../utils/desktopCalendarEventPolicy';

function normalizeCalendarEvent(
	event: DesktopCalendarEventResponse
): DesktopCalendarEventResponse {
	return {
		...event,
		starts_at: normalizeCalendarInstantIso(event.starts_at),
		ends_at: normalizeCalendarInstantIso(event.ends_at),
		created_at: normalizeCalendarInstantIso(event.created_at),
		updated_at: normalizeCalendarInstantIso(event.updated_at),
	};
}

export async function listDesktopCalendarEvents(params: {
	from: string;
	to: string;
}): Promise<DesktopCalendarEventResponse[]> {
	const search = new URLSearchParams({ from: params.from, to: params.to });
	return api
		.get<DesktopCalendarEventResponse[]>(
			`${API_PATH}/calendar/events?${search.toString()}`,
			DESKTOP_API_OPTIONS
		)
		.then((events) => events.map(normalizeCalendarEvent));
}

export async function createDesktopCalendarEvent(
	data: DesktopCalendarEventWrite
): Promise<DesktopCalendarEventResponse> {
	return api
		.post<DesktopCalendarEventResponse>(
			`${API_PATH}/calendar/events`,
			data,
			DESKTOP_API_OPTIONS
		)
		.then(normalizeCalendarEvent);
}

export async function updateDesktopCalendarEvent(
	eventId: string,
	data: Partial<DesktopCalendarEventWrite>
): Promise<DesktopCalendarEventResponse> {
	return api
		.patch<DesktopCalendarEventResponse>(
			`${API_PATH}/calendar/events/${eventId}`,
			data,
			DESKTOP_API_OPTIONS
		)
		.then(normalizeCalendarEvent);
}

export async function deleteDesktopCalendarEvent(
	eventId: string
): Promise<void> {
	await api.delete(
		`${API_PATH}/calendar/events/${eventId}`,
		DESKTOP_API_OPTIONS
	);
}
