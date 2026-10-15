/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Persist per-user per-chat dismiss state for the E2EE readiness banner (localStorage).
 *
 * Invariants:
 * - Keys are scoped to viewer user id + chat id; cleared only via explicit user dismiss.
 *
 * Related:
 * - GAFChatApp.tsx · GAFChatE2eeReadinessBanner.tsx
 */

const STORAGE_PREFIX = 'eliteew.gafChat.e2eeBannerDismissed.v1::';

function key(userId: string, chatId: string): string {
	return `${STORAGE_PREFIX}${userId}::${chatId}`;
}

export function isE2eeReadinessBannerDismissed(
	userId: string | null,
	chatId: string | null
): boolean {
	if (!userId || !chatId) return false;
	try {
		return window.localStorage.getItem(key(userId, chatId)) === '1';
	} catch {
		return false;
	}
}

export function setE2eeReadinessBannerDismissed(
	userId: string,
	chatId: string
): void {
	try {
		window.localStorage.setItem(key(userId, chatId), '1');
	} catch {
		/* ignore */
	}
}
