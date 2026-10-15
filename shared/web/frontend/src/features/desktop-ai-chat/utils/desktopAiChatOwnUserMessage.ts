/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resolve whether a Desktop AI Chat user bubble belongs to the viewing participant
 * (shared chats use DB author_user_id vs /me user_id; solo/optimistic fall back carefully).
 *
 * Invariants:
 * - Only meaningful for role=user; assistant/tool never treated as own-user bubbles.
 * - Shared: missing author → treat as owner_user_id when provided; never own if self id unknown.
 * - Solo: missing author/self → own (optimistic local rows).
 *
 * Related:
 * - api/desktopChatClient.ts DesktopAiMessage.author_user_id
 * - components/DesktopAiChatMessagesPane.tsx
 */

import type { DesktopAiMessage } from '../api/desktopChatClient';

export type OwnUserMessageOptions = {
	isSharedChat?: boolean;
	ownerUserId?: string | null;
};

export function isDesktopAiChatOwnUserMessage(
	message: Pick<DesktopAiMessage, 'role' | 'author_user_id'>,
	currentUserId: string | null | undefined,
	options?: OwnUserMessageOptions
): boolean {
	if (message.role !== 'user') return false;
	const selfId = typeof currentUserId === 'string' ? currentUserId.trim() : '';
	const isShared = options?.isSharedChat === true;
	const ownerId =
		typeof options?.ownerUserId === 'string' ? options.ownerUserId.trim() : '';

	let authorId =
		typeof message.author_user_id === 'string'
			? message.author_user_id.trim()
			: '';
	if (!authorId && isShared && ownerId) {
		authorId = ownerId;
	}

	if (isShared) {
		if (!selfId) return false;
		if (!authorId) return false;
		return authorId === selfId;
	}

	if (!authorId || !selfId) return true;
	return authorId === selfId;
}

export function desktopAiChatAuthorInitials(label: string): string {
	const cleaned = label.trim().replace(/\s+/g, ' ');
	if (!cleaned) return '?';
	const parts = cleaned.split(' ').filter(Boolean);
	if (parts.length >= 2) {
		const a = parts[0]?.[0] ?? '';
		const b = parts[1]?.[0] ?? '';
		return `${a}${b}`.toUpperCase() || '?';
	}
	return cleaned.slice(0, 2).toUpperCase();
}
