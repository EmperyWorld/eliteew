/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resolve GAF attachment blob download source for UI previews and modal opens.
 * Uses chat-scoped attachment endpoint for persisted messages and falls back to
 * unified content download for optimistic/pending rows or non-chat contexts.
 *
 * Invariants:
 * - Persisted GAF messages must prefer `/api/v1/gaf-chat/.../attachment`.
 * - Optimistic message ids (`gaf-opt-*`) must not call chat attachment endpoint.
 *
 * Related:
 * - src/pages/Desktop/components/GAFChat/api/gafChatApi.ts
 * - src/pages/Desktop/components/GAFChat/components/GafChatAttachmentBlock.tsx
 */
import { contentApi } from '@/services/contentApi';
import { downloadGafMessageAttachmentBlob } from '../api/gafChatApi';
import { GAF_OPTIMISTIC_ID_PREFIX } from '../gafChatMessageUtils';

export type GafAttachmentDownloadTarget = {
	contentId: string;
	chatId?: string | null;
	messageId?: string | null;
};

function canUseChatAttachmentEndpoint(
	target: GafAttachmentDownloadTarget
): target is {
	contentId: string;
	chatId: string;
	messageId: string;
} {
	return (
		typeof target.chatId === 'string' &&
		target.chatId.length > 0 &&
		typeof target.messageId === 'string' &&
		target.messageId.length > 0 &&
		!target.messageId.startsWith(GAF_OPTIMISTIC_ID_PREFIX)
	);
}

export async function downloadGafAttachmentBlob(
	target: GafAttachmentDownloadTarget
): Promise<Blob> {
	if (canUseChatAttachmentEndpoint(target)) {
		return downloadGafMessageAttachmentBlob(target.chatId, target.messageId);
	}
	const { blob } = await contentApi.downloadContentBlob(target.contentId);
	return blob;
}
