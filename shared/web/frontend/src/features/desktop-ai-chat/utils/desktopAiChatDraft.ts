/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * localStorage helpers for per-chat composer drafts in Desktop AI Chat.
 *
 * Invariants:
 * - Draft keys are scoped by chat id; empty drafts are removed, not stored.
 *
 * Related:
 * - DesktopAiChatApp.tsx
 * ---
 */
import { eliteewDegradeDebug } from '@/utils/eliteewDegradeDebug';

export const DRAFT_STORAGE_PREFIX = 'desktop_ai_chat_draft:';

export function chatDraftKey(chatId: string): string {
	return `${DRAFT_STORAGE_PREFIX}${chatId}`;
}

/** Persist composer text in localStorage (survives page reload), per chat id. */
export function persistChatDraft(chatId: string | null, text: string): void {
	if (!chatId) {
		return;
	}
	try {
		if (text.trim()) {
			localStorage.setItem(chatDraftKey(chatId), text);
		} else {
			localStorage.removeItem(chatDraftKey(chatId));
		}
	} catch (err) {
		eliteewDegradeDebug(
			'desktop_ai_chat_draft_write',
			'localStorage chat draft write failed',
			err
		);
	}
}

export function removeChatDraft(chatId: string): void {
	try {
		localStorage.removeItem(chatDraftKey(chatId));
	} catch (err) {
		eliteewDegradeDebug(
			'desktop_ai_chat_draft_clear',
			'localStorage chat draft clear failed',
			err
		);
	}
}

export function readChatHasDraft(chatId: string): boolean {
	try {
		return Boolean(localStorage.getItem(chatDraftKey(chatId))?.trim());
	} catch {
		return false;
	}
}
