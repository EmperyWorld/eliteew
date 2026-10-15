/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Cross-device inbox sync: GET/merge on login, PUT with dismiss tombstones
 * (immediate flush when ids were dismissed), refetch after a real socket restore.
 *
 * Invariants:
 * - PUT sends dismissed ids; the stored snapshot from the response is applied.
 * - Local dismiss ids are not revived by merge with a server list that omitted them.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-NOTIFICATIONS-DEVELOPER.md
 */

import { useAuth } from '@/contexts/AuthContext';
import { log } from '@/utils/logger';
import { useCallback, useEffect, useRef } from 'react';
import { getNotificationStoreRef, useNotificationStore } from './context';
import {
	apiItemsToNotifications,
	applyNotificationCenterGetSnapshot,
	dropDismissedNotificationIds,
	mergeNotificationLists,
	notificationsToApiPayload,
} from './notificationCenterMerge';
import {
	notificationCenterPutDebounceMs,
	shouldRefetchInboxOnConnectionRestored,
} from './notificationCenterSyncPolicy';
import {
	getNotificationCenter,
	putNotificationCenter,
	PROFILE_NOTIFICATION_CENTER_QUERY_KEY,
} from '@/services/profileService';
import { queryClient } from '@/providers/QueryProvider';
import { Services } from '@/services';
import type { Notification } from './types';

const PUT_RETRY_BACKOFF_MS = [2000, 5000, 10000, 20000, 30000] as const;

export function NotificationCenterSync(): null {
	const { isAuthenticated, loading } = useAuth();
	const { notifications, replaceNotifications } = useNotificationStore();
	const lastSentHashRef = useRef<string | null>(null);
	const retryTimerRef = useRef<number | null>(null);
	const retryHashRef = useRef<string | null>(null);
	const retryAttemptRef = useRef(0);
	const inFlightHashRef = useRef<string | null>(null);
	const prevIdsRef = useRef<Set<string>>(new Set());
	const pendingDismissedRef = useRef<Set<string>>(new Set());

	const clearRetryTimer = useCallback(() => {
		if (retryTimerRef.current !== null) {
			window.clearTimeout(retryTimerRef.current);
			retryTimerRef.current = null;
		}
	}, []);

	const resetRetryState = useCallback(() => {
		clearRetryTimer();
		retryHashRef.current = null;
		retryAttemptRef.current = 0;
	}, [clearRetryTimer]);

	const applyServerItems = useCallback(
		(serverItems: Notification[], serverDismissedIds: readonly string[]) => {
			const local = getNotificationStoreRef().current?.notifications ?? [];
			const applied = applyNotificationCenterGetSnapshot(
				local,
				serverItems,
				serverDismissedIds,
				pendingDismissedRef.current
			);
			replaceNotifications(applied.notifications);
			lastSentHashRef.current = applied.lastSentHash;
			prevIdsRef.current = new Set(applied.notifications.map((row) => row.id));
		},
		[replaceNotifications]
	);

	useEffect(() => {
		const currentIds = new Set(notifications.map((row) => row.id));
		for (const id of prevIdsRef.current) {
			if (!currentIds.has(id)) {
				pendingDismissedRef.current.add(id);
			}
		}
		for (const id of currentIds) {
			pendingDismissedRef.current.delete(id);
		}
		prevIdsRef.current = currentIds;
	}, [notifications]);

	useEffect(() => {
		if (!isAuthenticated || loading) return;
		let cancelled = false;
		void (async () => {
			try {
				const { ensureDesktopShellBootstrap } = await import(
					'@/pages/Desktop/services/desktopShellBootstrap'
				);
				await ensureDesktopShellBootstrap();
				if (cancelled) return;
				const res = await queryClient.fetchQuery({
					queryKey: PROFILE_NOTIFICATION_CENTER_QUERY_KEY,
					queryFn: () => getNotificationCenter(),
					staleTime: 0,
				});
				if (cancelled) return;
				applyServerItems(
					apiItemsToNotifications(res.items),
					res.dismissed_ids ?? []
				);
			} catch (e) {
				if (!cancelled) {
					log.warn(
						'NotificationCenterSync',
						'GET notification-center failed',
						e instanceof Error ? e : undefined
					);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [applyServerItems, isAuthenticated, loading]);

	useEffect(() => {
		if (!isAuthenticated || loading) return;
		const socket = Services.socket;
		const unsubscribe = socket.addEventListener(
			'connection-restored',
			(payload: unknown) => {
				if (!shouldRefetchInboxOnConnectionRestored(payload)) return;
				void (async () => {
					try {
						await queryClient.invalidateQueries({
							queryKey: PROFILE_NOTIFICATION_CENTER_QUERY_KEY,
						});
						const res = await queryClient.fetchQuery({
							queryKey: PROFILE_NOTIFICATION_CENTER_QUERY_KEY,
							queryFn: () => getNotificationCenter(),
							staleTime: 0,
						});
						applyServerItems(
							apiItemsToNotifications(res.items),
							res.dismissed_ids ?? []
						);
					} catch (e) {
						log.warn(
							'NotificationCenterSync',
							'GET notification-center after reconnect failed',
							e instanceof Error ? e : undefined
						);
					}
				})();
			}
		);
		return unsubscribe;
	}, [applyServerItems, isAuthenticated, loading]);

	useEffect(() => {
		if (!isAuthenticated || loading) {
			inFlightHashRef.current = null;
			resetRetryState();
			return;
		}

		const payload = notificationsToApiPayload(notifications);
		const dismissedIds = [...pendingDismissedRef.current];
		const hash = JSON.stringify({
			items: payload,
			dismissed_ids: dismissedIds,
		});
		if (hash === lastSentHashRef.current) {
			if (retryHashRef.current === hash) {
				resetRetryState();
			}
			return;
		}

		if (retryHashRef.current !== null && retryHashRef.current !== hash) {
			resetRetryState();
		}
		retryHashRef.current = hash;

		const sendPayload = (attempt: number) => {
			if (hash !== retryHashRef.current) return;
			if (hash === lastSentHashRef.current) {
				resetRetryState();
				return;
			}
			if (inFlightHashRef.current === hash) {
				return;
			}

			inFlightHashRef.current = hash;
			void (async () => {
				try {
					const res = await putNotificationCenter({
						items: payload,
						dismissed_ids: dismissedIds,
					});
					const stored = apiItemsToNotifications(res.items);
					const payloadIds = new Set(payload.map((row) => row.id));
					const local = getNotificationStoreRef().current?.notifications ?? [];
					const extras = local.filter(
						(row) =>
							!payloadIds.has(row.id) &&
							!pendingDismissedRef.current.has(row.id)
					);
					const next = dropDismissedNotificationIds(
						mergeNotificationLists(stored, extras),
						[...(res.dismissed_ids ?? []), ...pendingDismissedRef.current]
					);
					replaceNotifications(next);
					prevIdsRef.current = new Set(next.map((row) => row.id));
					for (const id of dismissedIds) {
						pendingDismissedRef.current.delete(id);
					}
					lastSentHashRef.current = JSON.stringify({
						items: notificationsToApiPayload(next),
						dismissed_ids: [...pendingDismissedRef.current],
					});
					retryAttemptRef.current = 0;
					resetRetryState();
				} catch (e) {
					if (hash !== retryHashRef.current) return;
					const nextAttempt = attempt + 1;
					retryAttemptRef.current = nextAttempt;
					const delay =
						PUT_RETRY_BACKOFF_MS[
							Math.min(nextAttempt - 1, PUT_RETRY_BACKOFF_MS.length - 1)
						];
					clearRetryTimer();
					retryTimerRef.current = window.setTimeout(() => {
						sendPayload(nextAttempt);
					}, delay);
					log.warn(
						'NotificationCenterSync',
						`PUT notification-center failed (attempt ${nextAttempt}, retry in ${delay}ms)`,
						e instanceof Error ? e : undefined
					);
				} finally {
					if (inFlightHashRef.current === hash) {
						inFlightHashRef.current = null;
					}
				}
			})();
		};

		if (retryHashRef.current === hash && retryTimerRef.current !== null) {
			return;
		}

		const t = window.setTimeout(() => {
			sendPayload(retryAttemptRef.current);
		}, notificationCenterPutDebounceMs(dismissedIds.length));

		return () => window.clearTimeout(t);
	}, [
		notifications,
		isAuthenticated,
		loading,
		clearRetryTimer,
		resetRetryState,
		replaceNotifications,
	]);

	useEffect(() => {
		return () => {
			clearRetryTimer();
		};
	}, [clearRetryTimer]);

	return null;
}
