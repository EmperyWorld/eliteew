/**
 * Handles `serverActions[].action` ids from Socket.IO / persisted rows (metadata required).
 */

import { requestOpenDesktopApp } from '@/pages/Desktop/utils/desktopDeepLink';
import { apiClient } from '@/services/api';
import { API_PATHS } from '@/services/api/config';
import { getNotificationStoreRef } from './context';
import { notify } from './api';
import type { Notification } from './types';

const DOC_EDITOR = API_PATHS.DOC_EDITOR;
const DESKTOP_AI_CHAT = '/api/v1/desktop/ai-chat';

function docCollabInviteNotifId(inviteId: string): string {
	return `doc_collab_invite_${inviteId}`;
}

function desktopAiChatInviteNotifId(memberId: string): string {
	return `desktop_ai_chat_invite_${memberId}`;
}

export async function executeServerNotificationAction(
	notification: Notification,
	actionId: string
): Promise<void> {
	const meta = notification.metadata;
	if (!meta || typeof meta !== 'object') return;

	const kind = (meta as Record<string, unknown>).kind;
	if (kind === 'doc_collaboration_invite') {
		const inviteId = (meta as Record<string, unknown>).invite_id;
		const documentId = (meta as Record<string, unknown>).document_id;
		const inv = typeof inviteId === 'string' ? inviteId : '';
		const doc = typeof documentId === 'string' ? documentId : '';
		if (!inv || !doc) return;

		try {
			if (actionId === 'doc_collab_invite_accept') {
				await apiClient.post(`${DOC_EDITOR}/invites/${inv}/accept`);
				getNotificationStoreRef().current?.dismiss(docCollabInviteNotifId(inv));
				requestOpenDesktopApp({
					appComponent: 'DocEditor',
					documentId: doc,
					openCollabPanel: true,
					autoJoinCollaboration: true,
				});
				return;
			}
			if (actionId === 'doc_collab_invite_decline') {
				await apiClient.post(`${DOC_EDITOR}/invites/${inv}/decline`);
				getNotificationStoreRef().current?.dismiss(docCollabInviteNotifId(inv));
				return;
			}
			if (actionId === 'doc_collab_invite_open_collab') {
				requestOpenDesktopApp({
					appComponent: 'DocEditor',
					documentId: doc,
					openCollabPanel: true,
				});
				return;
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Операция не выполнена';
			notify.error('Ошибка', msg);
		}
		return;
	}

	if (kind === 'desktop_ai_chat_invite') {
		const memberId = (meta as Record<string, unknown>).member_id;
		const chatId = (meta as Record<string, unknown>).chat_id;
		const mid = typeof memberId === 'string' ? memberId : '';
		const cid = typeof chatId === 'string' ? chatId : '';
		if (!mid || !cid) return;

		try {
			if (actionId === 'desktop_ai_chat_invite_accept') {
				await apiClient.post(`${DESKTOP_AI_CHAT}/invites/${mid}/accept`);
				getNotificationStoreRef().current?.dismiss(
					desktopAiChatInviteNotifId(mid)
				);
				requestOpenDesktopApp({
					appComponent: 'DesktopAiChatApp',
					desktopAiChatId: cid,
				});
				return;
			}
			if (actionId === 'desktop_ai_chat_invite_decline') {
				await apiClient.post(`${DESKTOP_AI_CHAT}/invites/${mid}/decline`);
				getNotificationStoreRef().current?.dismiss(
					desktopAiChatInviteNotifId(mid)
				);
				return;
			}
			if (actionId === 'desktop_ai_chat_invite_open') {
				requestOpenDesktopApp({
					appComponent: 'DesktopAiChatApp',
					desktopAiChatId: cid,
				});
				return;
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Операция не выполнена';
			notify.error('Ошибка', msg);
		}
	}
}
