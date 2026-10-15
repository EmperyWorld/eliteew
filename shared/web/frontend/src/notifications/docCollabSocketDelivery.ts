/**
 * Doc collaboration invite: hub row + Sonner toast with buttons (shared desktop + legacy socket hook).
 */

import { playNotificationSoundForSourceThrottled } from '@/pages/Desktop/utils/notificationSound';
import type { NotificationEvent } from '@/services/communication/EmperyworldSocketService';
import { getNotificationStoreRef } from './context';
import { showDocCollabInviteToast } from './docCollabInviteSonner';
import { shouldDeliverInAppForType } from './prefsBridge';
import type { NotificationInput, NotificationType } from './types';

export function deliverDocCollabInviteSocketNotification(opts: {
	level: NotificationType;
	event: NotificationEvent;
	input: NotificationInput;
	serverActions: Array<{ label: string; action: string }>;
	metaObj: Record<string, unknown>;
	shouldAddToCenter: boolean;
}): void {
	const { level, event, input, serverActions, metaObj, shouldAddToCenter } =
		opts;
	if (shouldAddToCenter && shouldDeliverInAppForType(level)) {
		getNotificationStoreRef().current?.addToCenter(input);
	}
	if (shouldDeliverInAppForType(level)) {
		showDocCollabInviteToast({ level, event, serverActions, metaObj });
		playNotificationSoundForSourceThrottled(event.source ?? 'doc_editor');
	}
}
