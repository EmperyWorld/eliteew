/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable tab session id (sessionStorage) for sync leader election before React mounts.
 *
 * Invariants:
 * - Survives reload within the same browser tab; not shared across tabs.
 *
 * Related:
 * - `pages/Desktop/utils/desktopRealtimeLeader.ts`
 */

const SESSION_TAB_ID_KEY = 'eliteew.browser-tab-session-id';

export function getOrCreateBrowserTabSessionId(): string {
	if (typeof sessionStorage === 'undefined') {
		return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	}
	try {
		const existing = sessionStorage.getItem(SESSION_TAB_ID_KEY);
		if (existing?.trim()) {
			return existing.trim();
		}
		const id =
			typeof crypto !== 'undefined' && 'randomUUID' in crypto
				? crypto.randomUUID()
				: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		sessionStorage.setItem(SESSION_TAB_ID_KEY, id);
		return id;
	} catch {
		return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	}
}
