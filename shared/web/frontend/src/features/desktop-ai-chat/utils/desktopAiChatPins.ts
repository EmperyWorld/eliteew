/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * localStorage persistence for pinned Desktop AI Chat ids in the sidebar list.
 *
 * Invariants:
 * - At most MAX_CHAT_PINS ids are stored; order is preserved on read/write.
 *
 * Related:
 * - DesktopAiChatApp.tsx
 * ---
 */

export const PINS_STORAGE_KEY = 'desktop_ai_chat_pins';
export const MAX_CHAT_PINS = 10;

export function readChatPins(): string[] {
	try {
		const raw = localStorage.getItem(PINS_STORAGE_KEY);
		if (!raw) {
			return [];
		}
		const j = JSON.parse(raw) as unknown;
		if (!Array.isArray(j)) {
			return [];
		}
		return j
			.filter((x): x is string => typeof x === 'string')
			.slice(0, MAX_CHAT_PINS);
	} catch {
		return [];
	}
}

export function writeChatPins(ids: string[]): void {
	try {
		localStorage.setItem(
			PINS_STORAGE_KEY,
			JSON.stringify(ids.slice(0, MAX_CHAT_PINS))
		);
	} catch {
		/* best-effort pin persistence */
	}
}
