/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Persist up to three pinned built-in instrument ids per principal (localStorage).
 *
 * Invariants:
 * - Max 3 pins; invalid ids filtered on read.
 * - UI-only preference; does not affect server orchestration.
 *
 * Related:
 * - src/features/ewa/companionTools/companionToolsCatalogUi.ts
 */

const KEY_PREFIX = 'eliteew.companion.pinnedTools.v1:';
const MAX_PINS = 3;

export function readPinnedToolIds(principalId: string): string[] {
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
			.slice(0, MAX_PINS);
	} catch {
		return [];
	}
}

export function writePinnedToolIds(
	principalId: string,
	ids: readonly string[]
): void {
	if (typeof window === 'undefined' || !principalId.trim()) return;
	try {
		const unique = [
			...new Set(ids.map((id) => id.trim()).filter(Boolean)),
		].slice(0, MAX_PINS);
		window.localStorage.setItem(
			`${KEY_PREFIX}${principalId}`,
			JSON.stringify(unique)
		);
	} catch {
		/* best-effort */
	}
}

export function togglePinnedToolId(
	principalId: string,
	toolId: string
): string[] {
	const current = readPinnedToolIds(principalId);
	const id = toolId.trim();
	if (!id) return current;
	if (current.includes(id)) {
		const next = current.filter((row) => row !== id);
		writePinnedToolIds(principalId, next);
		return next;
	}
	if (current.length >= MAX_PINS) {
		const next = [...current.slice(1), id];
		writePinnedToolIds(principalId, next);
		return next;
	}
	const next = [...current, id];
	writePinnedToolIds(principalId, next);
	return next;
}

export const COMPANION_PINNED_TOOLS_MAX = MAX_PINS;
