/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared Socket.IO payload and connection types for EmperyworldSocketService.
 *
 * Invariants:
 * - GAF wire fields match API `emit_gaf_*` / `gaf_user_{db_user_id}` rooms.
 *
 * Related:
 * - EmperyworldSocketService.ts
 * - documentation/platform/REALTIME-SOCKETIO-AND-WS.md
 * - documentation/product/GAF-CHAT-BACKEND.md
 */

import type { GAFMessageItem } from '@/pages/Desktop/components/GAFChat/types';

export interface EmperyworldMessage {
	id: string;
	chat_id: string;
	user_id: string;
	user_name: string;
	content: string;
	message_type: 'text' | 'image' | 'file' | 'code' | 'system' | 'ai_response';
	metadata?: {
		timestamp: string;
		edited?: boolean;
		reply_to?: string;
		reactions?: Record<string, string[]>;
		attachments?: Array<{
			type: string;
			url: string;
			name: string;
			size: number;
		}>;
		ai_context?: {
			model: string;
			prompt: string;
			generation_time_ms: number;
		};
	};
	created_at: string;
	updated_at?: string;
}

export interface AIGenerationProgress {
	task_id: string;
	type: 'text' | 'image' | 'audio' | 'video';
	status: 'queued' | 'processing' | 'completed' | 'failed';
	progress: number;
	current_step?: string;
	estimated_completion?: string;
	model: string;
	provider: string;
	user_id: string;
	created_at: string;
	result?: {
		url?: string;
		text?: string;
		metadata?: unknown;
	};
	error?: string;
}

export interface CreativeCollaboration {
	document_id: string;
	title: string;
	type: 'text' | 'code' | 'design' | 'mixed';
	active_users: Array<{
		user_id: string;
		user_name: string;
		cursor_position?: number;
		selection_range?: [number, number];
		user_color: string;
		last_activity: string;
	}>;
	current_version: number;
	last_modified: string;
	permissions: {
		can_edit: string[];
		can_view: string[];
		can_comment: string[];
	};
}

export interface DocumentOperation {
	operation_id: string;
	document_id: string;
	user_id: string;
	type: 'insert' | 'delete' | 'format' | 'move';
	position: number;
	content?: string;
	length?: number;
	attributes?: Record<string, unknown>;
	timestamp: string;
	applied: boolean;
}

export interface NotificationEvent {
	id: string;
	type: 'info' | 'success' | 'warning' | 'error' | 'system';
	title: string;
	message: string;
	user_id?: string;
	priority: 'low' | 'normal' | 'high' | 'urgent';
	actions?: Array<{
		label: string;
		action: string;
		url?: string;
	}>;
	persistent: boolean;
	expires_at?: string;
	created_at: string;
	source?: string;
	metadata?: Record<string, unknown>;
}

/**
 * GAF Chat (1:1) — Socket.IO event payloads (`gaf_chat.*`).
 * Wire format matches `emit_gaf_*` in `shared/api/gaf_chat/router.py` (room `gaf_user_{db_user_id}`).
 * REST list/send uses {@link GAFMessageItem}; socket uses `message_id` where REST uses `id`.
 */
export interface GafChatMessageNewPayload {
	chat_id: GAFMessageItem['chat_id'];
	/** Same value as {@link GAFMessageItem.id} from the REST `MessageItem` response. */
	message_id: GAFMessageItem['id'];
	sender_id: GAFMessageItem['sender_id'];
	body: GAFMessageItem['body'];
	created_at: GAFMessageItem['created_at'];
	/** True when the recipient has muted the sender (notification/UI hint). */
	recipient_is_muted: boolean;
	algorithm?: GAFMessageItem['algorithm'];
	encryption_version?: GAFMessageItem['encryption_version'];
	metadata?: GAFMessageItem['metadata'];
}

export interface GafChatMessageReadPayload {
	chat_id: string;
	/** DB user id of the participant who marked read (the reader). */
	user_id: string;
	/** Last read message id; may be null if the server has nothing to report. */
	up_to_message_id: string | null;
}

export interface GafChatChatCreatedPayload {
	chat_id: string;
	/** DB user id of the user who opened/created the chat. */
	initiator_id: string;
}

export interface GafChatMessageEditedPayload {
	chat_id: GAFMessageItem['chat_id'];
	message_id: GAFMessageItem['id'];
	sender_id: GAFMessageItem['sender_id'];
	body: GAFMessageItem['body'];
	edited_at: string;
}

export interface GafChatMessageDeletedPayload {
	chat_id: GAFMessageItem['chat_id'];
	message_id: GAFMessageItem['id'];
	/** DB user id of the user who performed the delete. */
	user_id: string;
	for_me_only: boolean;
}

export interface VideoCallIncomingPayload {
	call_id: string;
	chat_id?: string | null;
	caller_user_id: string;
	created_at?: string;
	call_target?: string;
}

export interface VideoCallEndedPayload {
	call_id: string;
	ended_by_user_id: string;
	status?: string;
	missed_reason?: string;
}

export interface VideoCallAcceptedPayload {
	call_id: string;
	chat_id?: string | null;
	accepted_by_user_id: string;
}

export interface EwDeskNewsUpdatedPayload {
	post_id?: string;
	reason?: string;
	timestamp?: string;
}

/** Names of GAF Chat realtime events forwarded to EmperyworldSocketService.addEventListener. */
export type GafChatSocketEventName =
	| 'gaf_chat.message_new'
	| 'gaf_chat.message_read'
	| 'gaf_chat.chat_created'
	| 'gaf_chat.message_edited'
	| 'gaf_chat.message_deleted'
	| 'video_call.incoming'
	| 'video_call.accepted'
	| 'video_call.ended';

export interface SocketConnectionConfig {
	auto_connect: boolean;
	reconnect_enabled: boolean;
	max_reconnect_attempts: number;
	reconnect_delay_ms: number;
	heartbeat_interval_ms: number;
	timeout_ms: number;
	compression_enabled: boolean;
	upgrade_transport: boolean;
	/** Max serialized JSON size (bytes) for outbound emits; rejects oversized sends. Incoming is not capped. */
	max_outgoing_payload_bytes: number;
}

export type EmperyworldSocketConnectionState =
	| 'disconnected'
	| 'connecting'
	| 'connected'
	| 'reconnecting';
