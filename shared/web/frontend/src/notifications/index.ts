/**
 * Unified notifications module: one API, one store, one toast layer (Sonner).
 * Use NotificationProvider once in App root. Use useNotifications() in components or notify from services.
 */

export { notify } from './api';
export type { NotifyToastOptions, NowPlayingToastPayload } from './api';
export { NotificationProvider } from './NotificationProvider';
export { useNotifications } from './useNotifications';
export {
	useNotificationStore,
	getNotificationStoreRef,
	clearNotificationStore,
} from './context';
export {
	setNotificationPreferencesSnapshot,
	getNotificationPreferencesSnapshot,
	shouldDeliverInAppForType,
} from './prefsBridge';
export type {
	Notification,
	NotificationType,
	NotificationInput,
	NotificationAction,
	ServerNotificationAction,
} from './types';
export { executeServerNotificationAction } from './executeServerNotificationAction';
