/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lightweight Desktop toast + notification-center helpers for the critical
 * view-model without subscribing to useNotifications().
 *
 * Invariants:
 * - Toast uses Sonner via notifications/api only.
 * - Center rows use getNotificationStoreRef (no React store subscription).
 * - Unread counts defer to DesktopDeferredShellExtrasRuntime.
 *
 * Related:
 * - useDesktopWorkspaceContentHeadEarlyCluster.ts
 * - documentation/platform/FRONTEND-BOOT-ORCHESTRATION.md
 */

import { getNotificationStoreRef } from '@/notifications/context';
import { notify } from '@/notifications/api';
import type { NotificationInput } from '@/notifications/types';

const addToCenter = (
	type: NotificationInput['type'],
	title: string,
	message: string
): void => {
	getNotificationStoreRef().current?.addToCenter({ type, title, message });
};

/** Sonner toasts for shell actions (install, folder ops, persist errors). */
export const desktopToast = {
	success: notify.success,
	error: notify.error,
	warning: notify.warning,
	info: notify.info,
	nowPlaying: notify.nowPlaying,
	loading: notify.loading,
	promise: notify.promise,
	action: notify.action,
	dismiss: notify.dismiss,
} as const;

/** Notification center rows without hook subscription. */
export const desktopNotifyCenter = {
	info: (title: string, message: string) =>
		addToCenter('info', title, message),
	success: (title: string, message: string) =>
		addToCenter('success', title, message),
	warning: (title: string, message: string) =>
		addToCenter('warning', title, message),
	error: (title: string, message: string) =>
		addToCenter('error', title, message),
} as const;

export const NOOP_MARK_ALL_NOTIFICATIONS_READ = (): void => {};
