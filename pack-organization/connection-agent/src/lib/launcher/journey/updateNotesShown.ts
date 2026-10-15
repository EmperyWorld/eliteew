/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Persist which update version already opened Релизы notes (once per version).
 *
 * Related:
 * - DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §4 / §5.2
 */

export const UPDATE_NOTES_SHOWN_KEY =
	'eliteew.journey.update_notes_shown_for' as const;

export function readUpdateNotesShownForVersion(): string | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const v = localStorage.getItem(UPDATE_NOTES_SHOWN_KEY);
		return v && v.trim() ? v.trim() : null;
	} catch {
		return null;
	}
}

export function markUpdateNotesShownForVersion(version: string): void {
	if (typeof localStorage === 'undefined') return;
	const v = version.trim();
	if (!v) return;
	try {
		localStorage.setItem(UPDATE_NOTES_SHOWN_KEY, v);
	} catch {
		/* ignore */
	}
}
