/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Socket.IO event name and payload contracts for Desktop AI Chat collaboration fan-out.
 *
 * Invariants:
 * - Event names must match api/routers/socketio_emit_desktop_ai_chat.py.
 *
 * Related:
 * - hooks/useDesktopAiChatRealtime.ts
 * - documentation/product/desktop/DESKTOP-AI-CHAT-COLLABORATION.md
 */

import type { DesktopAiMessage } from '../api/desktopChatClient';

export const DESKTOP_AI_CHAT_SOCKET = {
	JOIN: 'desktop_ai_chat_join',
	LEAVE: 'desktop_ai_chat_leave',
	JOINED: 'desktop_ai_chat.joined',
	TURN_STARTED: 'desktop_ai_chat.turn_started',
	TURN_DONE: 'desktop_ai_chat.turn_done',
	MESSAGE_NEW: 'desktop_ai_chat.message_new',
	MEMBER_CHANGED: 'desktop_ai_chat.member_changed',
} as const;

export type DesktopAiChatMemberChangeReason =
	| 'invite'
	| 'accept'
	| 'decline'
	| 'remove'
	| 'leave';

export type DesktopAiChatJoinPayload = {
	chat_id: string;
};

export type DesktopAiChatTurnEventPayload = {
	chat_id: string;
	actor_user_id: string;
	timestamp?: string;
};

export type DesktopAiChatMemberChangedPayload = {
	chat_id: string;
	reason: DesktopAiChatMemberChangeReason;
	actor_user_id: string;
	target_user_id?: string | null;
	timestamp?: string;
};

export type DesktopAiChatMessageNewPayload = {
	chat_id: string;
	message: DesktopAiMessage;
	actor_user_id?: string;
	timestamp?: string;
};

export function isDesktopAiChatTurnEventPayload(
	value: unknown
): value is DesktopAiChatTurnEventPayload {
	if (!value || typeof value !== 'object') return false;
	const row = value as Record<string, unknown>;
	return (
		typeof row.chat_id === 'string' && typeof row.actor_user_id === 'string'
	);
}

export function isDesktopAiChatMemberChangedPayload(
	value: unknown
): value is DesktopAiChatMemberChangedPayload {
	if (!value || typeof value !== 'object') return false;
	const row = value as Record<string, unknown>;
	return (
		typeof row.chat_id === 'string' &&
		typeof row.reason === 'string' &&
		typeof row.actor_user_id === 'string'
	);
}

export function isDesktopAiChatMessageNewPayload(
	value: unknown
): value is DesktopAiChatMessageNewPayload {
	if (!value || typeof value !== 'object') return false;
	const row = value as Record<string, unknown>;
	if (
		typeof row.chat_id !== 'string' ||
		!row.message ||
		typeof row.message !== 'object'
	) {
		return false;
	}
	const msg = row.message as Record<string, unknown>;
	return (
		typeof msg.id === 'string' &&
		typeof msg.role === 'string' &&
		typeof msg.content === 'string'
	);
}
