/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF Chat message ordering, read-cursor, optimistic row, and send-mode helpers.
 *
 * Invariants:
 * - Optimistic ids never leak into server read markers.
 * - E2EE send mode rejects attachments/replies until encrypted attachments/replies exist.
 *
 * Related:
 * - documentation/product/GAF-CHAT-BACKEND.md
 */
import type { GAFMessageItem } from './types';

export const GAF_CHAT_PAGE_SIZE = 10;

/** Prefix for optimistic pending message ids (replaced on server ack). */
export const GAF_OPTIMISTIC_ID_PREFIX = 'gaf-opt-';

/** True when the id is a client-only optimistic bubble (must not be sent to REST mark-read). */
export function isGafOptimisticMessageId(
	messageId: string | null | undefined
): boolean {
	return Boolean(messageId?.startsWith(GAF_OPTIMISTIC_ID_PREFIX));
}

/**
 * Latest server-backed message id safe for POST `/gaf-chat/chats/{id}/read`.
 * Skips optimistic pending rows so the API never receives `gaf-opt-*` ids.
 */
export function resolveGafLastMessageIdForRead(
	messages: GAFMessageItem[],
	selectedChatId: string | null | undefined
): string | undefined {
	if (!selectedChatId || messages.length === 0) return undefined;
	for (let i = messages.length - 1; i >= 0; i--) {
		const m = messages[i];
		if (m.chat_id !== selectedChatId) continue;
		if (isGafOptimisticMessageId(m.id)) continue;
		return m.id;
	}
	return undefined;
}

export function sortMessagesAsc(items: GAFMessageItem[]): GAFMessageItem[] {
	return [...items].sort((a, b) => {
		const aTime = new Date(a.created_at).getTime();
		const bTime = new Date(b.created_at).getTime();
		return aTime - bTime;
	});
}

export function dedupeMessagesById(items: GAFMessageItem[]): GAFMessageItem[] {
	const seen = new Set<string>();
	return items.filter((m) => {
		if (seen.has(m.id)) return false;
		seen.add(m.id);
		return true;
	});
}

/**
 * Merges pages from useInfiniteQuery: page 0 is the newest window, page 1+ are older.
 * Returns chronological ascending list.
 */
export function mergeGafInfinitePages(
	pages: GAFMessageItem[][]
): GAFMessageItem[] {
	if (pages.length === 0) return [];
	const merged = pages.slice().reverse().flat();
	return dedupeMessagesById(sortMessagesAsc(merged));
}

export function makeOptimisticMessage(
	chatId: string,
	senderId: string,
	body: string,
	tempId: string,
	attachment?: {
		attachment_name?: string | null;
		attachment_size?: number | null;
		attachment_content_id?: string | null;
		attachment_mime_type?: string | null;
	},
	replyToMessageId?: string | null
): GAFMessageItem {
	const now = new Date().toISOString();
	return {
		id: tempId,
		chat_id: chatId,
		sender_id: senderId,
		body,
		created_at: now,
		edited_at: null,
		deleted_for_sender: false,
		deleted_for_recipient: false,
		algorithm: 'plain',
		encryption_version: null,
		body_ciphertext: null,
		nonce: null,
		attachment_name: attachment?.attachment_name ?? null,
		attachment_size: attachment?.attachment_size ?? null,
		attachment_content_id: attachment?.attachment_content_id ?? null,
		attachment_mime_type: attachment?.attachment_mime_type ?? null,
		attachment_recipient_saved_id: null,
		reply_to_message_id: replyToMessageId ?? null,
	};
}

export type GafChatSendModeResolution =
	| { kind: 'plain' }
	| { kind: 'e2ee' }
	| { kind: 'blocked'; reason: 'attachment' | 'reply' };

export function resolveGafChatSendMode({
	e2eeActive,
	hasAttachment: _hasAttachment,
	replyToMessageId,
}: {
	e2eeActive: boolean;
	hasAttachment: boolean;
	replyToMessageId?: string | null;
}): GafChatSendModeResolution {
	if (!e2eeActive) {
		return { kind: 'plain' };
	}
	if (replyToMessageId?.trim()) {
		return { kind: 'blocked', reason: 'reply' };
	}
	return { kind: 'e2ee' };
}

/** Locale-neutral marker duplicated by legacy mobile clients for ended calls. */
export const LEGACY_POST_CALL_SUMMARY_TOKEN = 'gaf:vcall_summary';

/** Legacy mobile client duplicated server video_call_event rows as plain user text. */
export function isLegacyPostCallSummaryBody(
	body: string,
	metadata?: Record<string, unknown> | null
): boolean {
	if (metadata && typeof metadata === 'object') {
		const kind = metadata.system_message_kind ?? metadata.kind;
		if (
			kind === 'legacy_post_call_summary' ||
			kind === 'legacy_video_call_summary'
		) {
			return true;
		}
	}
	const trimmed = body.trim();
	if (!trimmed.startsWith('📞')) return false;
	if (trimmed.includes(LEGACY_POST_CALL_SUMMARY_TOKEN)) return true;
	// Locale-neutral duration suffix from legacy mobile duplicates.
	return / · ~?\d/.test(trimmed);
}

export function getLegacyPostCallSummaryLabel(
	body: string,
	metadata?: Record<string, unknown> | null
): string | null {
	return isLegacyPostCallSummaryBody(body, metadata) ? body.trim() : null;
}

/** Map `gaf_chat.message_new` socket payload to a REST-shaped message row for cache merge. */
export function gafSocketPayloadToMessageItem(payload: {
	chat_id?: string;
	message_id?: string;
	sender_id?: string;
	body?: string;
	created_at?: string;
	algorithm?: string | null;
	encryption_version?: string | null;
	body_ciphertext?: string | null;
	nonce?: string | null;
	attachment_content_id?: string | null;
	attachment_mime_type?: string | null;
	attachment_name?: string | null;
	attachment_size?: number | null;
	attachment_recipient_saved_id?: string | null;
	reply_to_message_id?: string | null;
	metadata?: Record<string, unknown> | null;
	e2ee_session_key_envelope?: string | null;
}): GAFMessageItem | null {
	const chatId = payload.chat_id?.trim();
	const messageId = payload.message_id?.trim();
	const senderId = payload.sender_id?.trim();
	if (!chatId || !messageId || !senderId) return null;
	return {
		id: messageId,
		chat_id: chatId,
		sender_id: senderId,
		body: payload.body ?? '',
		created_at: payload.created_at || new Date().toISOString(),
		edited_at: null,
		deleted_for_sender: false,
		deleted_for_recipient: false,
		algorithm: payload.algorithm ?? null,
		encryption_version: payload.encryption_version ?? null,
		body_ciphertext: payload.body_ciphertext ?? null,
		nonce: payload.nonce ?? null,
		attachment_content_id: payload.attachment_content_id ?? null,
		attachment_mime_type: payload.attachment_mime_type ?? null,
		attachment_name: payload.attachment_name ?? null,
		attachment_size: payload.attachment_size ?? null,
		attachment_recipient_saved_id:
			payload.attachment_recipient_saved_id ?? null,
		reply_to_message_id: payload.reply_to_message_id ?? null,
		metadata: payload.metadata ?? null,
		e2ee_session_key_envelope: payload.e2ee_session_key_envelope ?? null,
	};
}

/** Append a realtime row to page 0 of the messages infinite query (newest window). */
export function appendGafSocketMessageToInfinitePages(
	pages: GAFMessageItem[][] | undefined,
	incoming: GAFMessageItem,
	options?: { myUserId?: string | null }
): GAFMessageItem[][] {
	if (!pages || pages.length === 0) return [[incoming]];
	const myUserId = options?.myUserId ?? null;
	const first = pages[0] ?? [];
	if (first.some((m) => m.id === incoming.id)) return pages;
	const optimisticIdx = first.findIndex((m) =>
		shouldReplaceGafOptimisticWithSocketRow(m, incoming, myUserId)
	);
	if (optimisticIdx >= 0) {
		const replaced = first.map((m, index) =>
			index === optimisticIdx ? incoming : m
		);
		return [sortMessagesAsc(replaced), ...pages.slice(1)];
	}
	return [sortMessagesAsc([...first, incoming]), ...pages.slice(1)];
}

function shouldReplaceGafOptimisticWithSocketRow(
	optimistic: GAFMessageItem,
	incoming: GAFMessageItem,
	myUserId: string | null
): boolean {
	if (!isGafOptimisticMessageId(optimistic.id)) return false;
	if (!myUserId || incoming.sender_id !== myUserId) return false;
	const optAtt = optimistic.attachment_content_id ?? null;
	const incAtt = incoming.attachment_content_id ?? null;
	if (optAtt !== incAtt) return false;
	const bodyMatch = optimistic.body.trim() === incoming.body.trim();
	const e2eeEcho =
		incoming.algorithm?.startsWith('e2e_') === true &&
		Boolean(incoming.body_ciphertext?.trim());
	return bodyMatch || e2eeEcho;
}
