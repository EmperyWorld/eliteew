/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Load personal CalendarApp events for a visible from/to range.
 *
 * Invariants:
 * - Failed GET is an error state, not an empty calendar pretending to be SoT.
 * - Mutations optimistically patch cached lists, then reconcile via invalidate.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-CALENDAR-APP.md
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	createDesktopCalendarEvent,
	deleteDesktopCalendarEvent,
	listDesktopCalendarEvents,
	updateDesktopCalendarEvent,
} from '../services/desktopApi';
import type {
	DesktopCalendarEventResponse,
	DesktopCalendarEventWrite,
} from '../services/desktopApi';

export const DESKTOP_CALENDAR_EVENTS_KEY = [
	'desktop',
	'calendar-events',
] as const;

type CalendarCacheSnapshot = Array<
	[readonly unknown[], DesktopCalendarEventResponse[] | undefined]
>;

function patchCalendarCaches(
	queryClient: ReturnType<typeof useQueryClient>,
	updater: (
		events: DesktopCalendarEventResponse[]
	) => DesktopCalendarEventResponse[]
) {
	queryClient.setQueriesData<DesktopCalendarEventResponse[]>(
		{ queryKey: DESKTOP_CALENDAR_EVENTS_KEY },
		(current) => (current ? updater(current) : current)
	);
}

function snapshotCalendarCaches(
	queryClient: ReturnType<typeof useQueryClient>
): CalendarCacheSnapshot {
	return queryClient.getQueriesData<DesktopCalendarEventResponse[]>({
		queryKey: DESKTOP_CALENDAR_EVENTS_KEY,
	});
}

function restoreCalendarCaches(
	queryClient: ReturnType<typeof useQueryClient>,
	snapshot: CalendarCacheSnapshot | undefined
) {
	snapshot?.forEach(([key, data]) => {
		queryClient.setQueryData(key, data);
	});
}

export function useDesktopCalendarEvents(
	range: {
		from: string;
		to: string;
	} | null
) {
	const queryClient = useQueryClient();
	const query = useQuery({
		queryKey: [...DESKTOP_CALENDAR_EVENTS_KEY, range?.from, range?.to],
		queryFn: () => {
			if (!range) {
				return Promise.resolve([]);
			}
			return listDesktopCalendarEvents(range);
		},
		enabled: range != null,
	});

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: DESKTOP_CALENDAR_EVENTS_KEY });

	const createMutation = useMutation({
		mutationFn: (data: DesktopCalendarEventWrite) =>
			createDesktopCalendarEvent(data),
		onMutate: async (data) => {
			await queryClient.cancelQueries({
				queryKey: DESKTOP_CALENDAR_EVENTS_KEY,
			});
			const snapshot = snapshotCalendarCaches(queryClient);
			const optimisticId = `optimistic-${Date.now()}`;
			const optimisticEvent: DesktopCalendarEventResponse = {
				id: optimisticId,
				title: data.title,
				notes: data.notes ?? '',
				starts_at: data.starts_at,
				ends_at: data.ends_at,
				all_day: data.all_day ?? false,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};
			patchCalendarCaches(queryClient, (events) => [
				...events,
				optimisticEvent,
			]);
			return { snapshot, optimisticId };
		},
		onSuccess: (created, _data, context) => {
			if (!context) return;
			patchCalendarCaches(queryClient, (events) =>
				events.map((event) =>
					event.id === context.optimisticId ? created : event
				)
			);
		},
		onError: (_error, _data, context) => {
			restoreCalendarCaches(queryClient, context?.snapshot);
		},
		onSettled: invalidate,
	});

	const updateMutation = useMutation({
		mutationFn: (input: {
			id: string;
			data: Partial<DesktopCalendarEventWrite>;
		}) => updateDesktopCalendarEvent(input.id, input.data),
		onMutate: async (input) => {
			await queryClient.cancelQueries({
				queryKey: DESKTOP_CALENDAR_EVENTS_KEY,
			});
			const snapshot = snapshotCalendarCaches(queryClient);
			patchCalendarCaches(queryClient, (events) =>
				events.map((event) =>
					event.id === input.id
						? {
								...event,
								...input.data,
								title: input.data.title ?? event.title,
								notes: input.data.notes ?? event.notes,
								starts_at: input.data.starts_at ?? event.starts_at,
								ends_at: input.data.ends_at ?? event.ends_at,
								all_day: input.data.all_day ?? event.all_day,
								updated_at: new Date().toISOString(),
							}
						: event
				)
			);
			return { snapshot };
		},
		onError: (_error, _input, context) => {
			restoreCalendarCaches(queryClient, context?.snapshot);
		},
		onSettled: invalidate,
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => deleteDesktopCalendarEvent(id),
		onMutate: async (id) => {
			await queryClient.cancelQueries({
				queryKey: DESKTOP_CALENDAR_EVENTS_KEY,
			});
			const snapshot = snapshotCalendarCaches(queryClient);
			patchCalendarCaches(queryClient, (events) =>
				events.filter((event) => event.id !== id)
			);
			return { snapshot };
		},
		onError: (_error, _id, context) => {
			restoreCalendarCaches(queryClient, context?.snapshot);
		},
		onSettled: invalidate,
	});

	return {
		events: query.data ?? [],
		isLoading: query.isLoading,
		isError: query.isError,
		refetch: query.refetch,
		createEvent: createMutation.mutateAsync,
		updateEvent: updateMutation.mutateAsync,
		deleteEvent: deleteMutation.mutateAsync,
		isSaving:
			createMutation.isPending ||
			updateMutation.isPending ||
			deleteMutation.isPending,
		saveError:
			createMutation.error ?? updateMutation.error ?? deleteMutation.error,
	};
}
