/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Track locally clicked companion instrument chip ids per principal (localStorage).
 *
 * Invariants:
 * - Max 5 recent ids; most recent first; UI-only preference.
 * - Catalog «Недавние» merges with server ring via ``companionRecentToolsMerge.ts`` (U1.6).
 *
 * Related:
 * - src/features/ewa/companionTools/CompanionToolsCatalogPanel.tsx
 * - src/features/ewa/companionTools/companionRecentToolsMerge.ts
 */

const KEY_PREFIX = 'eliteew.companion.recentTools.v1:';
const MAX_RECENT = 5;

export function readRecentToolIds(principalId: string): string[] {
	if (typeof window === 'undefined' || !principalId.trim()) return [];
	try {
		const raw = window.localStorage.getItem(`${KEY_PREFIX}${principalId}`);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter(
				(id): id is string => typeof id === 'string' && id.trim().length > 0
			)
			.slice(0, MAX_RECENT);
	} catch {
		return [];
	}
}

export function recordRecentToolId(
	principalId: string,
	toolId: string
): string[] {
	const id = toolId.trim();
	if (!id || typeof window === 'undefined' || !principalId.trim()) {
		return readRecentToolIds(principalId);
	}
	const current = readRecentToolIds(principalId).filter((row) => row !== id);
	const next = [id, ...current].slice(0, MAX_RECENT);
	try {
		window.localStorage.setItem(
			`${KEY_PREFIX}${principalId}`,
			JSON.stringify(next)
		);
	} catch {
		/* best-effort */
	}
	return next;
}

export const COMPANION_RECENT_TOOLS_MAX = MAX_RECENT;
