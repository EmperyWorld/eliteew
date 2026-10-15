/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared constants, payload types, and React context types for GAFChatProvider.
 *
 * Invariants:
 * - NOTIFY_DEDUPE_MS and BC channel names stay aligned with multi-tab dedupe relay.
 *
 * Related:
 * - context/GAFChatProvider.tsx
 * - documentation/product/GAF-CHAT-DESKTOP-REFERENCE.md
 */
import { createContext } from 'react';

export const NOTIFY_DEDUPE_MS = 4000;
export const INVALIDATION_DEBOUNCE_MS = 100;
export const INVALIDATION_DEBOUNCE_MAX_MS = 2000;
/** Реже будить главный поток: статус сокета и так обновляется по событиям */
export const SOCKET_SYNC_INTERVAL_MS = 15_000;
/** Повтор connect после занятого browser lease (stale sid в Redis) */
export const SOCKET_LEASE_RETRY_MS = 15_000;
/** Периодический reconnect, если socket.io исчерпал внутренние попытки */
export const SOCKET_RECONNECT_PROBE_MS = 60_000;
export const VIDEO_CALL_RING_INTERVAL_MS = 2_700;

/** HTTP fallback when Socket.IO missed `video_call.incoming` (leader tab only). */
export const PENDING_INCOMING_VIDEO_POLL_MS = 8_000;
/** After consecutive empty `[]` responses, slow poll to cut Network noise. */
export const PENDING_INCOMING_EMPTY_BACKOFF_MS = 30_000;
export const PENDING_INCOMING_EMPTY_BACKOFF_AFTER = 3;

export const GAF_NOTIFY_BC = 'eliteew-gaf-chat-notify-v1';
export const VIDEO_CALL_ENDED_BROWSER_EVENT = 'eliteew-video-call-ended';

export type GafNotifyBcPayload = {
	type: 'gaf-notify';
	dedupeKey: string;
	t: number;
};

export type DesktopRealtimeRelayPayload = {
	type: 'socket-relay';
	event: string;
	payload: unknown;
	t: number;
};

export type GafMessageNewPayload = {
	chat_id?: string;
	sender_id?: string;
	body?: string;
	created_at?: string;
	recipient_is_muted?: boolean;
	message_id?: string;
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
};

export type VideoCallIncomingPayload = {
	call_id?: string;
	chat_id?: string | null;
	caller_user_id?: string;
	/** Server preference: suppress desktop ring when mobile_only. */
	call_target?: string;
};

export interface GAFChatProcessState {
	/** True when this tab holds the single desktop Socket.IO leader lock. */
	isDesktopRealtimeLeader: boolean;
}

export interface GAFChatContextValue extends GAFChatProcessState {
	/** Placeholder for future process-level controls (mute notifications, global status, etc.). */
}

export const defaultGafChatContextValue: GAFChatContextValue = {
	isDesktopRealtimeLeader: false,
};

export const GAFChatContext = createContext<GAFChatContextValue | null>(null);
