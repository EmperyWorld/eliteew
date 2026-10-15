/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF Chat (Global & Friends) — TypeScript mirrors of the REST contract in
 * `shared/api/gaf_chat/schemas.py` (`ChatPartner`, `ChatListItem`, `MessageItem`).
 *
 * Invariants:
 * - Socket and REST shapes stay additive so older clients tolerate new E2EE consent fields.
 *
 * Related:
 * - documentation/product/GAF-CHAT-BACKEND.md
 *
 * Socket payloads mirror `shared/api/routers/socketio_handler.py` (`GafMessageNewPayload`,
 * etc.). Server emits full key sets; malformed transport data should be narrowed with
 * {@link isGAFChatSocketMessageNewPayload} and siblings; for read receipts with a concrete
 * cursor, {@link isGAFChatSocketMessageReadPayloadWithUpTo}.
 *
 * **UI helpers** (runtime maps + types: {@link GAFChatMessageStatus}, {@link MessageStatus},
 * {@link GAFChatReadReceiptUi}, …) are client-only;
 * they are not part of the Python contract and are safe optional imports for components.
 */

/** Authenticated viewer id from `GET /api/v1/gaf-chat/me`. */
export interface GAFChatMeResponse {
	user_id: string;
}

/**
 * Counterparty in a 1:1 chat list row. Boolean flags are always sent by the API
 * (`ChatPartner` defaults: false).
 */
export interface GAFChatPartner {
	/** Platform user id (UUID string). */
	id: string;
	username: string | null;
	avatar_url: string | null;
	full_name: string | null;
	/** Profile tagline / bio when API exposes it (privacy-respecting). */
	bio?: string | null;
	/** Admin-granted trusted badge (optional on older API responses). */
	is_trusted?: boolean;
	admin_badge_label?: string | null;
	admin_badge_hint?: string | null;
	/** Internal system user (service messages). */
	is_system_account?: boolean;
	/** Local mute for this thread (suppresses notifications). */
	is_muted: boolean;
	/** Current user has blocked the partner. */
	is_blocked: boolean;
	/** Partner has blocked or restricted the current user. */
	blocked_by_partner: boolean;
}

/** One row from `GET /api/v1/gaf-chat/chats`. */
export interface GAFChatListItem {
	chat_id: string;
	partner: GAFChatPartner;
	/** ISO timestamp of the latest message, or null if empty. */
	last_message_at: string | null;
	/** Truncated plaintext preview for the sidebar. */
	last_message_preview: string | null;
	unread_count: number;
	/** Partner's read cursor (for ✓✓ on your messages). Omitted on older API responses. */
	partner_last_read_message_id?: string | null;
	e2ee_status?: 'off' | 'pending' | 'active' | 'declined';
	e2ee_requested_by_user_id?: string | null;
	e2ee_ready?: boolean;
}

/**
 * One message from list/send endpoints. `body` is plaintext for server-side
 * crypto (phase 1); ciphertext fields mirror `MessageItem` on the API.
 */
export interface GAFMessageItem {
	id: string;
	chat_id: string;
	sender_id: string;
	body: string;
	created_at: string;
	edited_at: string | null;
	deleted_for_sender: boolean;
	deleted_for_recipient: boolean;
	algorithm: string | null;
	encryption_version: string | null;
	body_ciphertext: string | null;
	nonce: string | null;
	/** Sender's unified_content id (file reference). */
	attachment_content_id?: string | null;
	attachment_mime_type?: string | null;
	attachment_name?: string | null;
	attachment_size?: number | null;
	/** Recipient's copy in Content Manager after «accept». */
	attachment_recipient_saved_id?: string | null;
	/** System messages: structured actions (onboarding steps, open_app_component, etc.). */
	metadata?: Record<string, unknown> | null;
	/** Reply / quote: id of the message this one replies to (same chat). */
	reply_to_message_id?: string | null;
	/** Per-message RSA-wrapped session key for the current viewer (E2EE). */
	e2ee_session_key_envelope?: string | null;
}

/** Response from `POST /api/v1/gaf-chat/chats/by-username`. */
export interface GAFChatOrCreateResponse {
	chat_id: string;
	partner: GAFChatPartner;
	e2ee_status?: 'off' | 'pending' | 'active' | 'declined';
	e2ee_requested_by_user_id?: string | null;
	e2ee_ready?: boolean;
}

// --- UI-only (client state; not in REST/socket schema; optional imports) ---

/**
 * Outbound pipeline state for optimistic bubbles / composer (e.g. mutation pending, retry).
 * Does not appear on {@link GAFMessageItem}. Colloquial name: “message status”.
 * Use {@link GAFChatMessageStatus} for comparisons (`=== GAFChatMessageStatus.Sending`).
 */
export const GAFChatMessageStatus = {
	Sending: 'sending',
	Failed: 'failed',
} as const;

export type GAFChatMessageStatus =
	(typeof GAFChatMessageStatus)[keyof typeof GAFChatMessageStatus];

/** Alias for {@link GAFChatMessageStatus} (import from this module to avoid clashing with other features). */
export type MessageStatus = GAFChatMessageStatus;

/**
 * Checkmark row for own messages: derived from `gaf_chat.message_read` + message order,
 * not an API field.
 */
export const GAFChatReadReceiptUi = {
	Sent: 'sent',
	Read: 'read',
} as const;

export type GAFChatReadReceiptUi =
	(typeof GAFChatReadReceiptUi)[keyof typeof GAFChatReadReceiptUi];

/** Toolbar / banner pill: maps from `socketConnected` in GAF chat UI. */
export const GAFChatBrokerUiConnection = {
	Online: 'online',
	Offline: 'offline',
} as const;

export type GAFChatBrokerUiConnection =
	(typeof GAFChatBrokerUiConnection)[keyof typeof GAFChatBrokerUiConnection];

/**
 * Empty main pane when no thread is selected: matches branches in `GAFChatApp`.
 * Document-only unless you centralize placeholder state.
 */
export const GAFChatMainPanePlaceholder = {
	NoChatSelected: 'no_chat_selected',
	ResolvingInitialUsername: 'resolving_initial_username',
} as const;

export type GAFChatMainPanePlaceholder =
	(typeof GAFChatMainPanePlaceholder)[keyof typeof GAFChatMainPanePlaceholder];

// --- Socket.IO (Empery World) payloads emitted by the API ---

/** `gaf_chat.message_new` — see `emit_gaf_message_new` / `GafMessageNewPayload`. */
export interface GAFChatSocketMessageNewPayload {
	chat_id: string;
	message_id: string;
	sender_id: string;
	body: string;
	created_at: string;
	recipient_is_muted: boolean;
	/** Always emitted; null when message has no storage/E2E algorithm tag. */
	algorithm: string | null;
	/** Always emitted; null when no encryption version is set. */
	encryption_version: string | null;
	/** E2EE ciphertext for clients that can decrypt directly from realtime payload. */
	body_ciphertext?: string | null;
	/** E2EE nonce for clients that can decrypt directly from realtime payload. */
	nonce?: string | null;
	attachment_content_id?: string | null;
	attachment_mime_type?: string | null;
	attachment_name?: string | null;
	attachment_size?: number | null;
	attachment_recipient_saved_id?: string | null;
	metadata?: Record<string, unknown> | null;
	reply_to_message_id?: string | null;
	e2ee_session_key_envelope?: string | null;
}

/**
 * `gaf_chat.message_read` — read receipt for the other participant.
 * `up_to_message_id` is null when the chat has no messages (see `GafChatService.mark_read`).
 */
export interface GAFChatSocketMessageReadPayload {
	chat_id: string;
	user_id: string;
	up_to_message_id: string | null;
}

/** `gaf_chat.chat_created` — partner notified when a chat is created. */
export interface GAFChatSocketChatCreatedPayload {
	chat_id: string;
	initiator_id: string;
}

/** `gaf_chat.message_edited`. */
export interface GAFChatSocketMessageEditedPayload {
	chat_id: string;
	message_id: string;
	sender_id: string;
	body: string;
	edited_at: string;
}

/** `gaf_chat.message_deleted`. */
export interface GAFChatSocketMessageDeletedPayload {
	chat_id: string;
	message_id: string;
	user_id: string;
	for_me_only: boolean;
}

export interface GAFChatSocketE2eeConsentChangedPayload {
	chat_id: string;
	status: 'off' | 'pending' | 'active' | 'declined';
	requested_by_user_id: string | null;
	actor_user_id: string;
	ready: boolean;
	activated_at: string | null;
	disabled_at: string | null;
	declined_at: string | null;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isStringOrNull(v: unknown): v is string | null {
	return v === null || typeof v === 'string';
}

/** Narrow unknown Socket.IO payload to {@link GAFChatSocketMessageNewPayload}. */
export function isGAFChatSocketMessageNewPayload(
	data: unknown
): data is GAFChatSocketMessageNewPayload {
	if (!isPlainObject(data)) return false;
	const {
		chat_id,
		message_id,
		sender_id,
		body,
		created_at,
		recipient_is_muted,
		algorithm,
		encryption_version,
	} = data;
	return (
		typeof chat_id === 'string' &&
		typeof message_id === 'string' &&
		typeof sender_id === 'string' &&
		typeof body === 'string' &&
		typeof created_at === 'string' &&
		typeof recipient_is_muted === 'boolean' &&
		isStringOrNull(algorithm) &&
		isStringOrNull(encryption_version)
	);
}

/** Narrow unknown Socket.IO payload to {@link GAFChatSocketMessageReadPayload}. */
export function isGAFChatSocketMessageReadPayload(
	data: unknown
): data is GAFChatSocketMessageReadPayload {
	if (!isPlainObject(data)) return false;
	const { chat_id, user_id, up_to_message_id } = data;
	return (
		typeof chat_id === 'string' &&
		typeof user_id === 'string' &&
		isStringOrNull(up_to_message_id)
	);
}

/**
 * Same as {@link isGAFChatSocketMessageReadPayload} but requires a non-null read cursor.
 * Matches UI paths in `GAFChatApp` / `GAFChatProvider` that ignore `up_to_message_id === null`.
 */
export function isGAFChatSocketMessageReadPayloadWithUpTo(
	data: unknown
): data is GAFChatSocketMessageReadPayload & { up_to_message_id: string } {
	return (
		isGAFChatSocketMessageReadPayload(data) &&
		typeof data.up_to_message_id === 'string'
	);
}

/** Narrow unknown Socket.IO payload to {@link GAFChatSocketChatCreatedPayload}. */
export function isGAFChatSocketChatCreatedPayload(
	data: unknown
): data is GAFChatSocketChatCreatedPayload {
	if (!isPlainObject(data)) return false;
	return (
		typeof data.chat_id === 'string' && typeof data.initiator_id === 'string'
	);
}

/** Narrow unknown Socket.IO payload to {@link GAFChatSocketMessageEditedPayload}. */
export function isGAFChatSocketMessageEditedPayload(
	data: unknown
): data is GAFChatSocketMessageEditedPayload {
	if (!isPlainObject(data)) return false;
	const { chat_id, message_id, sender_id, body, edited_at } = data;
	return (
		typeof chat_id === 'string' &&
		typeof message_id === 'string' &&
		typeof sender_id === 'string' &&
		typeof body === 'string' &&
		typeof edited_at === 'string'
	);
}

/** Narrow unknown Socket.IO payload to {@link GAFChatSocketMessageDeletedPayload}. */
export function isGAFChatSocketMessageDeletedPayload(
	data: unknown
): data is GAFChatSocketMessageDeletedPayload {
	if (!isPlainObject(data)) return false;
	const { chat_id, message_id, user_id, for_me_only } = data;
	return (
		typeof chat_id === 'string' &&
		typeof message_id === 'string' &&
		typeof user_id === 'string' &&
		typeof for_me_only === 'boolean'
	);
}
