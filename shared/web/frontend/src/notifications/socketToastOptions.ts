import type { NotifyToastOptions } from './api';
import { getNotificationSourceToastClassName } from './sourceMeta';
import type { NotificationInput } from './types';

/**
 * Shared policy for Socket.IO notifications:
 * - regular events use default Sonner timeout
 * - rows go to center only when explicitly requested by caller
 */
export function buildSocketToastOptions(params: {
	shouldAddToCenter: boolean;
	center: NotificationInput;
}): NotifyToastOptions | undefined {
	const className = getNotificationSourceToastClassName(params.center.source);
	if (!params.shouldAddToCenter) {
		return className ? { className } : undefined;
	}
	return {
		addToCenter: true,
		center: params.center,
		...(className ? { className } : {}),
	};
}
