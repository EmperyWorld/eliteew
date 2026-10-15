import { useEffect } from 'react';
import emperyworldSocket, {
	type NotificationEvent,
} from '@/services/communication/EmperyworldSocketService';
import { deliverDocCollabInviteSocketNotification } from './docCollabSocketDelivery';
import { getNotificationStoreRef } from './context';
import { notify } from './api';
import { openAppDetailFromNotification } from './openAppFromMetadata';
import { buildSocketToastOptions } from './socketToastOptions';
import type { NotificationType, NotificationInput } from './types';

function mapEventTypeToNotificationType(
	eventType: NotificationEvent['type']
): NotificationType {
	if (eventType === 'system') {
		return 'info';
	}
	return eventType;
}

export function useSocketNotifications(): void {
	useEffect(() => {
		const socket = emperyworldSocket;

		const unsubscribe = socket.addEventListener(
			'notification',
			(data: unknown) => {
				const event = data as NotificationEvent;
				const level = mapEventTypeToNotificationType(event.type);

				const expiresAt = event.expires_at
					? new Date(event.expires_at)
					: undefined;

				const metaObj =
					event.metadata && typeof event.metadata === 'object'
						? (event.metadata as Record<string, unknown>)
						: undefined;
				const isDocCollabInvite = metaObj?.kind === 'doc_collaboration_invite';
				const isDesktopAiChatInvite =
					metaObj?.kind === 'desktop_ai_chat_invite';
				const isActionableInvite = isDocCollabInvite || isDesktopAiChatInvite;
				const serverActions =
					isActionableInvite && event.actions?.length
						? event.actions.map((a) => ({
								label: a.label,
								action: typeof a.action === 'string' ? a.action : '',
							}))
						: undefined;
				const openApp = openAppDetailFromNotification(
					event.source,
					event.metadata
				);
				const input: NotificationInput = {
					id: event.id,
					type: level,
					title: event.title,
					message: event.message,
					source: event.source ?? 'server',
					persistent: event.persistent,
					expiresAt,
					...(serverActions?.length ? { serverActions } : {}),
					...(metaObj ? { metadata: metaObj } : {}),
					...(openApp ? { openApp } : {}),
				};

				const shouldAddToCenter =
					event.persistent ||
					event.priority === 'high' ||
					event.priority === 'urgent';

				if (isActionableInvite && serverActions?.length && metaObj) {
					deliverDocCollabInviteSocketNotification({
						level,
						event,
						input,
						serverActions,
						metaObj,
						shouldAddToCenter,
					});
					return;
				}

				const toastOpts = buildSocketToastOptions({
					shouldAddToCenter,
					center: input,
				});

				if (level === 'success') {
					notify.success(event.title, event.message, toastOpts);
				} else if (level === 'error') {
					notify.error(event.title, event.message, toastOpts);
				} else if (level === 'warning') {
					notify.warning(event.title, event.message, toastOpts);
				} else {
					notify.info(event.title, event.message, toastOpts);
				}
			}
		);

		const unsubscribeDismiss = emperyworldSocket.addEventListener(
			'notification_dismiss',
			(data: unknown) => {
				const id =
					data &&
					typeof data === 'object' &&
					'id' in data &&
					typeof (data as { id: unknown }).id === 'string'
						? (data as { id: string }).id
						: null;
				if (!id) return;
				getNotificationStoreRef().current?.dismiss(id);
			}
		);

		return () => {
			unsubscribe();
			unsubscribeDismiss();
		};
	}, []);
}
