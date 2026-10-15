/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF Chat REST helpers — all calls use {@link api} from `@/services/api/client`
 * (Bearer, retries, unified errors). Failures surface as {@link APIError}.
 *
 * Invariants:
 * - Keep REST helpers aligned with `shared/api/gaf_chat/router.py` paths.
 *
 * Related:
 * - documentation/product/GAF-CHAT-BACKEND.md
 *
 * **Rate limit (429):** The shared client retries eligible methods (GET, HEAD, OPTIONS, PUT)
 * up to `API_CONFIG.retry.attempts` with exponential backoff when the server returns 429.
 * **POST/DELETE/PATCH are not auto-retried** for 429; callers should catch errors and use
 * {@link isGafAPIError} + `statusCode === 429` to show a “too many requests” message and
 * optionally let the user retry after a delay. After retries are exhausted, any method
 * still failing with 429 is thrown as {@link APIError} with `statusCode` 429.
 *
 * **Per-request timeout:** Pass `timeout` (ms) in {@link GafChatRequestConfig}; axios merges
 * it per call and overrides the default `API_CONFIG.timeout` for that request only.
 */
import { listFriends as listPlatformFriends } from '@/features/friends/api/friendsApi';
import type { Friend as PlatformFriend } from '@/features/friends/types';
import type { components } from '@/generated/gaf-chat-openapi';
import { api, apiClient, APIError } from '@/services/api/client';
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';
import type {
	GAFChatListItem,
	GAFChatOrCreateResponse,
	GAFMessageItem,
} from '../types';

/** Canonical REST prefix (`shared/api/gaf_chat/router.py` + `domains/social.py`). */
export const GAF_CHAT_API_V1_BASE = '/api/v1/gaf-chat';

const PREFIX = GAF_CHAT_API_V1_BASE;

/** Thrown by GAF chat REST helpers (4xx/5xx, network, timeout). */
export type GAFChatAPIError = APIError;

/**
 * Type guard: errors from {@link api} in this module are {@link APIError}.
 * Use with `catch (e)` to narrow safely (e.g. branch on `statusCode === 429`).
 */
export function isGafAPIError(e: unknown): e is GAFChatAPIError {
	return e instanceof APIError;
}

/** Shared GAF Chat query root — use for custom keys / prefix checks. */
export const GAF_CHAT_QUERY_ROOT = ['gaf-chat'] as const;

export type GafChatQueryRoot = typeof GAF_CHAT_QUERY_ROOT;

/**
 * React Query keys for GAF Chat — single source for GAFChatApp, GAFChatProvider, useGAFUnreadCount.
 * Extended factory entries (`userSearch`, `keys`, `sessionKeyEnvelope`) are for granular `useQuery` / invalidation; core keys stay backward compatible.
 */
export const gafChatQueryKeys = {
	all: GAF_CHAT_QUERY_ROOT,
	me: [...GAF_CHAT_QUERY_ROOT, 'me'] as const,
	chats: [...GAF_CHAT_QUERY_ROOT, 'chats'] as const,
	messages: (chatId: string | null): QueryKey => [
		...GAF_CHAT_QUERY_ROOT,
		'messages',
		chatId,
	],
	/** User search (`searchUsers`) — optional cache scope. */
	userSearch: (q: string, limit = 20): QueryKey => [
		...GAF_CHAT_QUERY_ROOT,
		'users',
		'search',
		q,
		limit,
	],
	keys: {
		my: (): QueryKey => [...GAF_CHAT_QUERY_ROOT, 'keys', 'public', 'me'],
		user: (userId: string): QueryKey => [
			...GAF_CHAT_QUERY_ROOT,
			'keys',
			'public',
			userId,
		],
	},
	/** Session key envelope (`getSessionKeyEnvelope`). */
	sessionKeyEnvelope: (chatId: string): QueryKey => [
		...GAF_CHAT_QUERY_ROOT,
		'session-key',
		chatId,
	],
	e2eeStatus: (chatId: string | null): QueryKey => [
		...GAF_CHAT_QUERY_ROOT,
		'e2ee',
		chatId,
	],
};

/** Narrowing helper: first segment is the GAF Chat scope. */
export function isGafChatQueryKey(key: QueryKey): boolean {
	return Array.isArray(key) && key[0] === GAF_CHAT_QUERY_ROOT[0];
}

/**
 * Cancel, drop, and refetch everything under {@link gafChatQueryKeys.all} (same pattern as friends).
 */
export async function invalidateAllGafChatQueries(
	queryClient: QueryClient
): Promise<void> {
	await queryClient.cancelQueries({ queryKey: gafChatQueryKeys.all });
	queryClient.removeQueries({ queryKey: gafChatQueryKeys.all });
	await queryClient.invalidateQueries({ queryKey: gafChatQueryKeys.all });
}

/** Invalidate inbox + every messages list (chat list invalidation does not refetch per-chat message queries). */
export async function invalidateGafChatChatsAndAllMessages(
	queryClient: QueryClient
): Promise<void> {
	await queryClient.invalidateQueries({ queryKey: gafChatQueryKeys.chats });
	await queryClient.invalidateQueries({
		queryKey: [...GAF_CHAT_QUERY_ROOT, 'messages'],
	});
}

/**
 * Optional per-request overrides (axios): {@link AbortSignal} for cancellation,
 * `timeout` in ms to override the default client timeout for a single call.
 */
export type GafChatRequestConfig = Pick<
	AxiosRequestConfig,
	'signal' | 'timeout'
>;

/** Partner shape aligned with {@link GAFChatListItem.partner}. */
export type GAFChatPartner = GAFChatListItem['partner'];

export type GetOrCreateChatResponse = GAFChatOrCreateResponse;

export type GAFMeResponse = components['schemas']['GafChatMeResponse'];

/**
 * Current user id for GAF chat scope.
 * @throws {APIError} From shared HTTP client (4xx/5xx, network, timeout).
 */
export async function getMe(
	config?: GafChatRequestConfig
): Promise<GAFMeResponse> {
	return api.get<GAFMeResponse>(`${PREFIX}/me`, config);
}

/**
 * List chats for the current user.
 * @throws {APIError} From shared HTTP client.
 */
export async function listChats(
	config?: GafChatRequestConfig
): Promise<GAFChatListItem[]> {
	const rows = await api.get<components['schemas']['ChatListItem'][]>(
		`${PREFIX}/chats`,
		config
	);
	return rows as GAFChatListItem[];
}

/**
 * Open or create a 1:1 chat by partner username.
 * @throws {APIError} From shared HTTP client.
 */
export async function getOrCreateChatByUsername(
	username: string,
	config?: GafChatRequestConfig
): Promise<GetOrCreateChatResponse> {
	return api.post<GetOrCreateChatResponse>(
		`${PREFIX}/chats/by-username`,
		{ username },
		config
	);
}

export type ListMessagesParams = {
	limit?: number;
	before?: string;
	after?: string;
};

/**
 * Paginate messages in a chat (optional cursor params).
 * @throws {APIError} From shared HTTP client.
 */
export async function listMessages(
	chatId: string,
	params?: ListMessagesParams,
	config?: GafChatRequestConfig
): Promise<GAFMessageItem[]> {
	return api.get<GAFMessageItem[]>(`${PREFIX}/chats/${chatId}/messages`, {
		params: params ?? {},
		...config,
	});
}

/**
 * Send a plaintext message.
 * @throws {APIError} From shared HTTP client.
 */
/**
 * Редактировать текст своего сообщения (PATCH).
 * @throws {APIError} Не автор, пустой body, 4xx/5xx.
 */
export async function editGafMessage(
	chatId: string,
	messageId: string,
	body: string,
	config?: GafChatRequestConfig
): Promise<GAFMessageItem> {
	return api.patch<GAFMessageItem>(
		`${PREFIX}/chats/${chatId}/messages/${messageId}`,
		{ body },
		config
	);
}

/**
 * Мягкое удаление сообщения: только у себя или у обоих (только автор).
 */
export async function deleteGafMessage(
	chatId: string,
	messageId: string,
	forMeOnly: boolean,
	config?: GafChatRequestConfig
): Promise<void> {
	await api.delete<void>(`${PREFIX}/chats/${chatId}/messages/${messageId}`, {
		params: { for_me_only: forMeOnly },
		...config,
	});
}

export async function sendMessagePlain(
	chatId: string,
	body: string,
	config?: GafChatRequestConfig,
	options?: {
		attachmentContentId?: string | null;
		replyToMessageId?: string | null;
	}
): Promise<GAFMessageItem> {
	const payload: Record<string, unknown> = { body };
	if (options?.attachmentContentId) {
		payload.attachment_content_id = options.attachmentContentId;
	}
	if (options?.replyToMessageId) {
		payload.reply_to_message_id = options.replyToMessageId;
	}
	return api.post<GAFMessageItem>(
		`${PREFIX}/chats/${chatId}/messages`,
		payload,
		config
	);
}

/**
 * Save incoming chat attachment into the recipient's Content Manager (unfiled).
 */
export async function acceptGafAttachment(
	chatId: string,
	messageId: string,
	config?: GafChatRequestConfig
): Promise<{ content_id: string; already_saved: boolean }> {
	return api.post<{ content_id: string; already_saved: boolean }>(
		`${PREFIX}/chats/${chatId}/messages/${messageId}/accept-attachment`,
		{},
		config
	);
}

/**
 * Байты вложения сообщения для участника чата (voice и др. у получателя без content_shares).
 */
export async function downloadGafMessageAttachmentBlob(
	chatId: string,
	messageId: string,
	config?: GafChatRequestConfig
): Promise<Blob> {
	const response = await apiClient.get<Blob>(
		`${PREFIX}/chats/${chatId}/messages/${messageId}/attachment`,
		{
			responseType: 'blob',
			timeout: 0,
			...config,
		}
	);
	return response.data;
}

export interface SendE2EMessagePayload {
	e2e_ciphertext: string;
	e2e_nonce: string;
	e2e_algorithm: string;
	e2e_encryption_version: string;
	e2e_session_key_for_recipient?: string;
	e2e_session_key_for_self?: string;
	attachment_content_id?: string;
	reply_to_message_id?: string;
}

export type GafE2eeStatusValue = 'off' | 'pending' | 'active' | 'declined';

export interface GafE2eeStatus {
	chat_id: string;
	status: GafE2eeStatusValue;
	requested_by_user_id: string | null;
	user_1_consented_at: string | null;
	user_2_consented_at: string | null;
	activated_at: string | null;
	declined_at: string | null;
	disabled_at: string | null;
	updated_at: string | null;
	ready: boolean;
	current_user_consented: boolean;
	partner_consented: boolean;
	partner_user_id: string;
}

export async function getE2eeStatus(
	chatId: string,
	config?: GafChatRequestConfig
): Promise<GafE2eeStatus> {
	return api.get<GafE2eeStatus>(`${PREFIX}/chats/${chatId}/e2ee`, config);
}

export async function proposeE2ee(
	chatId: string,
	config?: GafChatRequestConfig
): Promise<GafE2eeStatus> {
	return api.post<GafE2eeStatus>(
		`${PREFIX}/chats/${chatId}/e2ee/propose`,
		{},
		config
	);
}

export async function acceptE2ee(
	chatId: string,
	config?: GafChatRequestConfig
): Promise<GafE2eeStatus> {
	return api.post<GafE2eeStatus>(
		`${PREFIX}/chats/${chatId}/e2ee/accept`,
		{},
		config
	);
}

export async function declineE2ee(
	chatId: string,
	config?: GafChatRequestConfig
): Promise<GafE2eeStatus> {
	return api.post<GafE2eeStatus>(
		`${PREFIX}/chats/${chatId}/e2ee/decline`,
		{},
		config
	);
}

export async function disableE2ee(
	chatId: string,
	config?: GafChatRequestConfig
): Promise<GafE2eeStatus> {
	return api.post<GafE2eeStatus>(
		`${PREFIX}/chats/${chatId}/e2ee/disable`,
		{},
		config
	);
}

/**
 * Send an E2E-encrypted message body.
 * @throws {APIError} From shared HTTP client.
 */
export async function sendMessageE2E(
	chatId: string,
	payload: SendE2EMessagePayload,
	config?: GafChatRequestConfig
): Promise<GAFMessageItem> {
	return api.post<GAFMessageItem>(
		`${PREFIX}/chats/${chatId}/messages`,
		payload,
		config
	);
}

/**
 * Mark messages read up to an optional message id.
 * @throws {APIError} From shared HTTP client.
 */
export async function markRead(
	chatId: string,
	upToMessageId?: string,
	config?: GafChatRequestConfig
): Promise<void> {
	await api.post<void>(
		`${PREFIX}/chats/${chatId}/read`,
		upToMessageId ? { up_to_message_id: upToMessageId } : {},
		config
	);
}

/**
 * Clear message history for a chat (server-defined semantics).
 * @throws {APIError} From shared HTTP client.
 */
export async function clearChatHistory(
	chatId: string,
	config?: GafChatRequestConfig
): Promise<void> {
	await api.post<void>(`${PREFIX}/chats/${chatId}/clear`, {}, config);
}

/**
 * Archive a chat for the current user.
 * @throws {APIError} From shared HTTP client.
 */
export async function archiveChat(
	chatId: string,
	config?: GafChatRequestConfig
): Promise<void> {
	await api.post<void>(`${PREFIX}/chats/${chatId}/archive`, {}, config);
}

/**
 * Permanently delete a chat.
 * @throws {APIError} From shared HTTP client.
 */
export async function deleteChatCompletely(
	chatId: string,
	config?: GafChatRequestConfig
): Promise<void> {
	await api.delete<void>(`${PREFIX}/chats/${chatId}`, config);
}

export interface GAFUserSearchItem {
	id: string;
	username: string | null;
	display_name: string | null;
	full_name: string | null;
	avatar_url: string | null;
}

/**
 * Search users to start chats (server-side filter).
 * @throws {APIError} From shared HTTP client.
 */
export async function searchUsers(
	q: string,
	limit = 20,
	config?: GafChatRequestConfig
): Promise<GAFUserSearchItem[]> {
	return api.get<GAFUserSearchItem[]>(`${PREFIX}/users/search`, {
		params: { q, limit },
		...config,
	});
}

export interface PublicKeyInfo {
	has_key: boolean;
	algorithm: string | null;
	public_key_pem: string | null;
}

/**
 * Register or replace the caller’s public key for E2E.
 * @throws {APIError} From shared HTTP client.
 */
export async function uploadMyPublicKey(
	input: {
		public_key_pem: string;
		algorithm: string;
	},
	config?: GafChatRequestConfig
): Promise<PublicKeyInfo> {
	return api.post<PublicKeyInfo>(`${PREFIX}/keys/public`, input, config);
}

/**
 * Fetch the caller’s stored public key metadata.
 * @throws {APIError} From shared HTTP client.
 */
export async function getMyPublicKey(
	config?: GafChatRequestConfig
): Promise<PublicKeyInfo> {
	return api.get<PublicKeyInfo>(`${PREFIX}/keys/public/me`, config);
}

/**
 * Fetch another user’s public key metadata.
 * @throws {APIError} From shared HTTP client.
 */
export async function getUserPublicKey(
	userId: string,
	config?: GafChatRequestConfig
): Promise<PublicKeyInfo> {
	return api.get<PublicKeyInfo>(`${PREFIX}/keys/public/${userId}`, config);
}

export interface SessionKeyEnvelope {
	chat_id: string;
	encrypted_key_payload: string;
}

function parseSessionKeyEnvelope(raw: unknown): SessionKeyEnvelope | null {
	if (raw == null || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	const chatId = o.chat_id;
	const encryptedKeyPayload = o.encrypted_key_payload;
	if (typeof chatId !== 'string' || typeof encryptedKeyPayload !== 'string') {
		return null;
	}
	return { chat_id: chatId, encrypted_key_payload: encryptedKeyPayload };
}

/**
 * Load encrypted session-key envelope for a chat, if present and well-formed.
 * Malformed or empty payloads resolve to `null` (no throw).
 * @throws {APIError} From shared HTTP client on request failure.
 */
export async function getSessionKeyEnvelope(
	chatId: string,
	config?: GafChatRequestConfig
): Promise<SessionKeyEnvelope | null> {
	const raw = await api.get<unknown>(
		`${PREFIX}/chats/${chatId}/session-key`,
		config
	);
	return parseSessionKeyEnvelope(raw);
}

export type GAFFriendListItem = PlatformFriend;

/**
 * Friends list for picker UI (delegates to platform friends API).
 * @throws Error shape depends on `@/features/friends` implementation (not necessarily {@link APIError}).
 */
export async function listFriends(): Promise<GAFFriendListItem[]> {
	return listPlatformFriends();
}

export interface GafPartnerDesktopAppOption {
	app_id: string;
	name: string;
	app_component: string;
	category: string;
}

/** Admin-only: apps from the chat partner's App Store access group. */
export async function listPartnerDesktopAppsForAdmin(
	chatId: string,
	config?: GafChatRequestConfig
): Promise<GafPartnerDesktopAppOption[]> {
	const raw = await api.get<{ apps?: GafPartnerDesktopAppOption[] }>(
		`${PREFIX}/chats/${chatId}/partner-desktop-apps`,
		config
	);
	return Array.isArray(raw?.apps) ? raw.apps : [];
}

/** Admin-only: send validated desktop app open button in chat. */
export async function sendDesktopAppLinkMessage(
	chatId: string,
	appId: string,
	note?: string,
	config?: GafChatRequestConfig
): Promise<GAFMessageItem> {
	const payload: Record<string, string> = { app_id: appId };
	if (note?.trim()) payload.note = note.trim();
	return api.post<GAFMessageItem>(
		`${PREFIX}/chats/${chatId}/messages/desktop-app-link`,
		payload,
		config
	);
}
