/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Soft-recover helpers when a shared Desktop AI Chat turn is busy (409 turn_in_progress).
 *
 * Invariants:
 * - Strip only `local-*` optimistic rows; never drop persisted server ids.
 *
 * Related:
 * - hooks/desktopAiChatStream/useDesktopAiChatStreamRun.ts
 * - documentation/product/desktop/DESKTOP-AI-CHAT-COLLABORATION.md
 */
import type { DesktopAiMessage } from '../api/desktopChatClient';

/** Drop optimistic local user/assistant placeholders after a rejected concurrent send. */
export function stripDesktopAiOptimisticLocalMessages(
	messages: DesktopAiMessage[]
): DesktopAiMessage[] {
	return messages.filter((m) => !m.id.startsWith('local-'));
}

export function isDesktopAiChatOwnerForStreamLockClear(opts: {
	viewerRole?: string | null;
	ownerUserId?: string | null;
	currentUserId?: string | null;
}): boolean {
	const self = (opts.currentUserId ?? '').trim();
	if (!self) return false;
	if ((opts.viewerRole ?? '').trim() === 'owner') return true;
	const owner = (opts.ownerUserId ?? '').trim();
	return Boolean(owner) && owner === self;
}
