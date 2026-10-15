/**
 * Hook for notification center + toast. Use inside NotificationProvider.
 */

import { useMemo } from 'react';
import { useNotificationStore } from './context';
import { notify } from './api';
import type { NotificationInput } from './types';

export function useNotifications() {
	const store = useNotificationStore();

	const toast = useMemo(
		() => ({
			success: notify.success,
			error: notify.error,
			warning: notify.warning,
			info: notify.info,
			nowPlaying: notify.nowPlaying,
			loading: notify.loading,
			promise: notify.promise,
			action: notify.action,
			dismiss: notify.dismiss,
		}),
		[]
	);

	return {
		notifications: store.notifications,
		unreadCount: store.unreadCount,
		markAsRead: store.markAsRead,
		markAllAsRead: store.markAllAsRead,
		markAsReadByType: store.markAsReadByType,
		markAsReadBySource: store.markAsReadBySource,
		replaceNotifications: store.replaceNotifications,
		dismiss: store.dismiss,
		clearAll: store.clearAll,
		addToCenter: store.addToCenter,
		notify: {
			info: (
				title: string,
				message: string,
				action?: NotificationInput['action']
			) => store.addToCenter({ type: 'info', title, message, action }),
			success: (
				title: string,
				message: string,
				action?: NotificationInput['action']
			) => store.addToCenter({ type: 'success', title, message, action }),
			warning: (
				title: string,
				message: string,
				action?: NotificationInput['action']
			) => store.addToCenter({ type: 'warning', title, message, action }),
			error: (
				title: string,
				message: string,
				action?: NotificationInput['action']
			) => store.addToCenter({ type: 'error', title, message, action }),
		},
		toast,
		/** Backward compat with useToast(): success(title, message?) */
		success: (title: string, message?: string) => toast.success(title, message),
		error: (title: string, message?: string) => toast.error(title, message),
		warning: (title: string, message?: string) => toast.warning(title, message),
		info: (title: string, message?: string) => toast.info(title, message),
	};
}
