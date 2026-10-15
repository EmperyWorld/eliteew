/**
 * Notification center store (React state + localStorage). Used by NotificationProvider and exposed via ref for imperative API.
 */

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from 'react';
import { notificationCenterPayloadHash } from './notificationCenterMerge';
import {
	clearPersistedNotifications,
	loadPersistedNotifications,
	persistNotificationsToStorage,
} from './persistence';
import type {
	Notification,
	NotificationInput,
	NotificationType,
} from './types';

export interface NotificationStoreValue {
	notifications: Notification[];
	addToCenter: (input: NotificationInput) => string;
	markAsRead: (id: string) => void;
	markAllAsRead: () => void;
	markAsReadByType: (type: NotificationType) => void;
	/** Mark read all rows with this source; `null` = no source set */
	markAsReadBySource: (source: string | null) => void;
	dismiss: (id: string) => void;
	clearAll: () => void;
	/** Replace list (server sync / merge); capped at MAX_NOTIFICATIONS */
	replaceNotifications: (items: Notification[]) => void;
	unreadCount: number;
}

const NotificationContext = createContext<NotificationStoreValue | null>(null);

/** Ref set by provider so imperative notify.addToCenter() works outside React tree */
const storeRef: { current: NotificationStoreValue | null } = { current: null };

const MAX_NOTIFICATIONS = 200;

export function getNotificationStoreRef(): typeof storeRef {
	return storeRef;
}

/** Clear notification center (e.g. on logout). Safe if provider is unmounted. */
export function clearNotificationStore(): void {
	storeRef.current?.clearAll();
	clearPersistedNotifications();
}

export function NotificationProvider({ children }: { children: ReactNode }) {
	const [notifications, setNotifications] = useState<Notification[]>(() =>
		loadPersistedNotifications()
	);

	useEffect(() => {
		const t = window.setTimeout(() => {
			persistNotificationsToStorage(notifications);
		}, 400);
		return () => window.clearTimeout(t);
	}, [notifications]);

	const addToCenter = useCallback((input: NotificationInput) => {
		const now = new Date();
		const id =
			input.id ?? `notif-${Date.now()}-${Math.random().toString(36).slice(2)}`;

		const newNotification: Notification = {
			...input,
			id,
			timestamp: now,
			read: false,
		};

		setNotifications((prev) => {
			// Drop duplicates by id and prune expired notifications
			const filtered = prev.filter((n) => {
				if (n.id === id) return false;
				if (n.expiresAt && n.expiresAt.getTime() <= now.getTime()) return false;
				return true;
			});

			const next = [newNotification, ...filtered];
			if (next.length > MAX_NOTIFICATIONS) {
				return next.slice(0, MAX_NOTIFICATIONS);
			}
			return next;
		});

		return id;
	}, []);

	const markAsRead = useCallback((id: string) => {
		setNotifications((prev) =>
			prev.map((n) => (n.id === id ? { ...n, read: true } : n))
		);
	}, []);

	const markAllAsRead = useCallback(() => {
		setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
	}, []);

	const markAsReadByType = useCallback((type: NotificationType) => {
		setNotifications((prev) =>
			prev.map((n) => (n.type === type ? { ...n, read: true } : n))
		);
	}, []);

	const markAsReadBySource = useCallback((source: string | null) => {
		setNotifications((prev) =>
			prev.map((n) => {
				const has = Boolean(n.source?.trim());
				const match = source === null ? !has : has && n.source === source;
				return match ? { ...n, read: true } : n;
			})
		);
	}, []);

	const replaceNotifications = useCallback((items: Notification[]) => {
		setNotifications((prev) => {
			const next = items.slice(0, MAX_NOTIFICATIONS);
			if (
				notificationCenterPayloadHash(prev) ===
				notificationCenterPayloadHash(next)
			) {
				return prev;
			}
			return next;
		});
	}, []);

	const dismiss = useCallback((id: string) => {
		setNotifications((prev) => prev.filter((n) => n.id !== id));
	}, []);

	const clearAll = useCallback(() => {
		setNotifications([]);
	}, []);

	const unreadCount = useMemo(
		() => notifications.filter((n) => !n.read).length,
		[notifications]
	);

	const value: NotificationStoreValue = useMemo(
		() => ({
			notifications,
			addToCenter,
			markAsRead,
			markAllAsRead,
			markAsReadByType,
			markAsReadBySource,
			dismiss,
			clearAll,
			replaceNotifications,
			unreadCount,
		}),
		[
			notifications,
			addToCenter,
			markAsRead,
			markAllAsRead,
			markAsReadByType,
			markAsReadBySource,
			dismiss,
			clearAll,
			replaceNotifications,
			unreadCount,
		]
	);

	storeRef.current = value;

	useEffect(() => {
		return () => {
			storeRef.current = null;
		};
	}, []);

	return (
		<NotificationContext.Provider value={value}>
			{children}
		</NotificationContext.Provider>
	);
}

export function useNotificationStore(): NotificationStoreValue {
	const ctx = useContext(NotificationContext);
	if (!ctx)
		throw new Error(
			'useNotificationStore must be used within NotificationProvider'
		);
	return ctx;
}
